import pytest
from google.auth.exceptions import TransportError

from backend.errors import AppError
from backend.Infrastructure.google_oauth import GoogleTokenVerifier


def verifier(fn):
    return GoogleTokenVerifier(
        "client-id.apps.googleusercontent.com", verify_fn=fn, request=object()
    )


def test_the_token_is_checked_against_our_client_id():
    seen = {}

    def fake(token, request, audience):
        seen.update(token=token, audience=audience)
        return {"sub": "1", "email": "a@b.c", "email_verified": True}

    claims = verifier(fake).verify("jwt")
    assert claims["sub"] == "1"
    assert seen == {"token": "jwt", "audience": "client-id.apps.googleusercontent.com"}


def test_invalid_tokens_become_401s():
    def bad(token, request, audience):
        raise ValueError("Wrong number of segments")

    with pytest.raises(AppError) as exc:
        verifier(bad).verify("nonsense")
    assert (exc.value.error_code, exc.value.http_status) == ("INVALID_GOOGLE_TOKEN", 401)


def test_claims_without_a_subject_or_email_are_rejected():
    for claims in ({"email": "a@b.c"}, {"sub": "1"}, {}):
        with pytest.raises(AppError) as exc:
            verifier(lambda *_args, c=claims: c).verify("jwt")
        assert exc.value.http_status == 401


def test_a_google_outage_is_a_502_not_a_login_failure():
    def down(token, request, audience):
        raise TransportError("certs unreachable")

    with pytest.raises(AppError) as exc:
        verifier(down).verify("jwt")
    assert (exc.value.error_code, exc.value.http_status) == ("GOOGLE_UNAVAILABLE", 502)

import pytest

from backend.errors import AppError, ConflictError
from backend.Security.Auth import decode_token
from backend.Services.auth_service import AuthService
from tests.fakes_auth import FakeGoogle, MemoryUsers, claims


@pytest.fixture
def users():
    return MemoryUsers()


def service(users, **tokens):
    return AuthService(FakeGoogle(tokens), users)


def test_a_new_google_user_becomes_a_customer_without_a_password(users):
    result = service(users, t=claims(given_name="Ana", family_name="García")).login_with_google("t")

    user = users.users[1]
    assert (user.role, user.auth_provider, user.google_sub) == ("customer", "google", "g-1")
    assert result["user"] == {
        "id": 1,
        "name": "Ana",
        "lastname": "García",
        "email": "ana@example.com",
        "role": "customer",
    }
    assert users.logins == [1]


def test_the_session_token_is_the_same_one_password_login_issues(users):
    result = service(users, t=claims()).login_with_google("t")
    decoded = decode_token(result["token"])
    assert (decoded["user_id"], decoded["role"]) == (1, "customer")


def test_names_fall_back_to_the_full_name_and_then_the_email(users):
    service(users, a=claims(sub="1", email="a@x.com", name="Lupita Pérez Ruiz")).login_with_google(
        "a"
    )
    service(users, b=claims(sub="2", email="solo@x.com")).login_with_google("b")
    assert (users.users[1].name, users.users[1].lastname) == ("Lupita", "Pérez Ruiz")
    assert (users.users[2].name, users.users[2].lastname) == ("solo", "")


def test_a_returning_google_user_is_found_by_their_google_id(users):
    svc = service(users, t=claims())
    svc.login_with_google("t")
    svc.login_with_google("t")
    assert len(users.users) == 1
    assert users.logins == [1, 1]


def test_the_google_id_wins_even_if_the_email_changed(users):
    service(users, a=claims(email="old@x.com")).login_with_google("a")
    result = service(users, b=claims(email="new@x.com")).login_with_google("b")
    assert len(users.users) == 1
    assert result["user"]["email"] == "old@x.com"


def test_an_existing_account_is_linked_by_verified_email_and_keeps_its_role(users):
    users.add(name="Sam", lastname="Cook", email="sam@foodstack.local", role="staff")
    result = service(users, t=claims(sub="g-9", email="Sam@FoodStack.local")).login_with_google("t")

    assert len(users.users) == 1
    assert users.users[1].google_sub == "g-9"
    assert result["user"]["role"] == "staff"  # from our database, not from Google
    assert decode_token(result["token"])["role"] == "staff"


def test_google_can_never_grant_a_role(users):
    token = claims(role="admin", roles=["admin"], hd="foodstack.local")
    result = service(users, t=token).login_with_google("t")
    assert result["user"]["role"] == "customer"


def test_unverified_emails_are_rejected_before_anything_is_stored(users):
    for verified in (False, "false", None):
        with pytest.raises(AppError) as exc:
            service(users, t=claims(verified=verified)).login_with_google("t")
        assert exc.value.error_code == "EMAIL_NOT_VERIFIED"
    assert users.users == {}


def test_google_sends_email_verified_as_a_string_sometimes(users):
    assert service(users, t=claims(verified="true")).login_with_google("t")["user"]["id"] == 1


def test_an_email_already_linked_to_another_google_account_is_refused(users):
    users.add(
        name="A", lastname="B", email="ana@example.com", role="customer", google_sub="g-original"
    )
    with pytest.raises(ConflictError) as exc:
        service(users, t=claims(sub="g-attacker")).login_with_google("t")
    assert exc.value.error_code == "ACCOUNT_LINKED_ELSEWHERE"
    assert users.users[1].google_sub == "g-original"


def test_disabled_accounts_cannot_sign_in(users):
    users.add(name="A", lastname="B", email="ana@example.com", role="customer", status=0)
    with pytest.raises(AppError) as exc:
        service(users, t=claims()).login_with_google("t")
    assert (exc.value.error_code, exc.value.http_status) == ("ACCOUNT_DISABLED", 403)
    assert users.logins == []


def test_an_invalid_token_is_rejected(users):
    with pytest.raises(AppError) as exc:
        service(users).login_with_google("forged")
    assert exc.value.http_status == 401
    assert users.users == {}

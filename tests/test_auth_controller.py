import pytest

from backend.app_factory import create_app
from backend.config import load_config
from backend.Services.container import build_services
from tests.fakes import FakeGateway, MemoryRepo, make_catalog
from tests.fakes_auth import FakeGoogle, MemoryUsers, claims


@pytest.fixture
def users():
    return MemoryUsers()


@pytest.fixture
def google_client(users):
    config = load_config({})
    repo = make_catalog(MemoryRepo())
    google = FakeGoogle({"good": claims(given_name="Ana", family_name="García")})
    services = build_services(config, repo, repo, gateway=FakeGateway(), users=users, google=google)
    return create_app(config, services=services).test_client()


def test_it_answers_503_until_google_sign_in_is_wired(client):
    response = client.post("/api/auth/google", json={"idToken": "x"})
    assert response.status_code == 503
    assert response.get_json()["errorCode"] == "GOOGLE_NOT_CONFIGURED"


def test_a_valid_token_sets_the_same_httponly_session_cookie_as_password_login(google_client):
    response = google_client.post("/api/auth/google", json={"idToken": "good"})
    assert response.status_code == 200
    assert response.get_json()["data"]["user"]["email"] == "ana@example.com"

    cookie = response.headers["Set-Cookie"]
    assert cookie.startswith("auth_token=")
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie
    assert "token" not in response.get_json()["data"]  # the token only travels in the cookie


def test_the_cookie_authenticates_later_requests(google_client):
    google_client.post("/api/auth/google", json={"idToken": "good"})
    # The role guard accepts the cookie: a customer gets 403 (forbidden), not 401 (anonymous).
    assert google_client.get("/api/orders").status_code == 403


def test_bad_or_missing_tokens_are_rejected(google_client, users):
    forged = google_client.post("/api/auth/google", json={"idToken": "forged"})
    assert (forged.status_code, forged.get_json()["errorCode"]) == (401, "INVALID_GOOGLE_TOKEN")
    assert "Set-Cookie" not in forged.headers
    for body in ({}, {"idToken": ""}, {"idToken": 5}):
        response = google_client.post("/api/auth/google", json=body)
        assert response.status_code == 422
        assert response.get_json()["errorCode"] == "ID_TOKEN_REQUIRED"
    assert users.users == {}

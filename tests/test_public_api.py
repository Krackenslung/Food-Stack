"""HTTP tests of the customer API over the real SQL repositories (scratch database only)."""

import os
import uuid
from datetime import UTC, datetime

import pytest

from backend.app_factory import create_app
from backend.config import load_config
from backend.Services.container import build_sql_services

DATABASE = os.getenv("TEST_DATABASE")
pytestmark = pytest.mark.skipif(not DATABASE, reason="TEST_DATABASE is not set")

CONTACT = {"name": "Ana García", "phone": "+16195550148", "email": "ana@example.com"}


@pytest.fixture(autouse=True)
def scratch(monkeypatch):
    if "scratch" not in (DATABASE or "").lower():
        pytest.exit("TEST_DATABASE must be a scratch database (its name must contain 'scratch').")
    monkeypatch.setenv("DATABASE", DATABASE)


@pytest.fixture
def api():
    config = load_config({})
    services = build_sql_services(config)
    open_now = lambda: datetime(2026, 6, 1, 20, 0, tzinfo=UTC)  # noqa: E731  13:00 in Tijuana
    services.checkout._clock = open_now
    services.public._clock = open_now
    return create_app(config, services=services).test_client()


def signup(api, email=None, password="Sup3rSecret!"):
    email = email or f"c{uuid.uuid4().hex[:10]}@example.com"
    response = api.post(
        "/api/auth/signup",
        json={
            "name": "Casey",
            "lastname": "Lee",
            "phoneNumber": "6645550101",
            "email": email,
            "password": password,
        },
    )
    return email, response


def test_store_and_menu_are_public(api):
    store = api.get("/api/store").json["data"]
    assert store["isOpen"] is True and store["opensAt"] == "11:00" and store["closesAt"] == "23:00"
    assert store["paymentsEnabled"] is False  # no Stripe keys in the test environment

    menu = api.get("/api/menu?lang=es").json["data"]
    assert [s["category"]["slug"] for s in menu] == ["burgers", "burritos", "sides", "beverages"]
    assert menu[0]["category"]["name"] == "Hamburguesas"
    assert menu[0]["products"][0]["name"] == "Hamburguesa Overkill Doble"
    # Only orderable products are listed: the out-of-stock Cheese Bites is not.
    assert "Cheese Bites" not in [p["name"] for s in menu for p in s["products"]]


def test_product_detail_has_ingredient_rules_and_hides_unavailable_ones(api):
    product = api.get("/api/products/1?lang=en").json["data"]
    assert product["name"] == "Overkill Double Burger"
    assert product["allowCustomization"] is True
    assert {"productIngredientId", "extraPrice", "default", "max", "removable"} <= set(
        product["ingredients"][0]
    )
    assert api.get("/api/products/9999").status_code == 404


def test_signup_login_session_and_logout_use_an_httponly_cookie(api):
    email, created = signup(api)
    assert created.status_code == 201, created.json
    assert created.json["data"]["user"]["role"] == "customer"
    assert "token" not in created.json["data"]
    assert "HttpOnly" in created.headers["Set-Cookie"]

    session = api.get("/api/session")  # the test client keeps the cookie
    assert session.status_code == 200
    assert session.json["data"]["user"]["email"] == email

    api.post("/api/auth/logout")
    assert api.get("/api/session").status_code == 401

    login = api.post("/api/auth/login", json={"email": email.upper(), "password": "Sup3rSecret!"})
    assert login.status_code == 200 and login.json["data"]["user"]["preferredLanguage"] == "en"


def test_bad_credentials_duplicates_and_weak_passwords_are_rejected(api):
    email, _ = signup(api)
    wrong = api.post("/api/auth/login", json={"email": email, "password": "nope"})
    assert (wrong.status_code, wrong.json["errorCode"]) == (401, "INVALID_CREDENTIALS")
    unknown = api.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"})
    assert unknown.json["errorCode"] == "INVALID_CREDENTIALS"  # same answer: no account probing

    _, again = signup(api, email=email)
    assert (again.status_code, again.json["errorCode"]) == (409, "EMAIL_TAKEN")
    _, weak = signup(api, password="short")
    assert (weak.status_code, weak.json["errorCode"]) == (422, "PASSWORD_TOO_SHORT")


def test_signup_cannot_choose_a_role(api):
    email = f"r{uuid.uuid4().hex[:8]}@example.com"
    response = api.post(
        "/api/auth/signup",
        json={
            "name": "A",
            "lastname": "B",
            "email": email,
            "password": "Sup3rSecret!",
            "role": "admin",
        },
    )
    assert response.json["data"]["user"]["role"] == "customer"


def test_profile_update_validates_preferences(api):
    signup(api)
    ok = api.patch("/api/me", json={"preferredLanguage": "es", "preferredTheme": "dark"})
    assert ok.json["data"]["user"]["preferredLanguage"] == "es"
    assert api.patch("/api/me", json={"preferredTheme": "neon"}).status_code == 422
    assert api.patch("/api/me", json={"role": "admin"}).json["data"]["user"]["role"] == "customer"


def test_my_orders_and_order_detail_are_private_to_the_owner(api):
    signup(api)
    order = api.post(
        "/api/checkout",
        json={
            "items": [{"productId": 2, "quantity": 1, "ingredients": []}],
            "fulfillmentType": "pickup",
            "contact": CONTACT,
            "paymentMethod": "counter",
        },
    )
    assert order.status_code == 201, order.json
    order_id = order.json["data"]["orderId"]

    mine = api.get("/api/me/orders?status=active&lang=en").json["data"]
    assert order_id in [o["id"] for o in mine["items"]]
    assert api.get("/api/me/orders?status=cancelled").json["data"]["total"] == 0

    detail = api.get(f"/api/orders/{order_id}")
    assert (
        detail.status_code == 200 and detail.json["data"]["lines"][0]["name"] == "BBQ Bacon Burger"
    )

    services = api.application.extensions["foodstack_services"]
    stranger = create_app(load_config({}), services=services).test_client()
    signup(stranger)
    assert stranger.get(f"/api/orders/{order_id}").status_code == 404
    anonymous = create_app(load_config({}), services=services).test_client()
    assert anonymous.get(f"/api/orders/{order_id}").status_code == 401

from datetime import UTC, datetime

import pytest

from backend.app_factory import create_app
from backend.config import load_config
from backend.Services.container import build_services
from backend.Services.ports import OrderRecord
from tests.fakes import VALID_SIGNATURE, FakeGateway, MemoryRepo, event, make_catalog

OPEN_NOW = datetime(2026, 6, 1, 20, 0, tzinfo=UTC)
CONTACT = {"name": "Ana", "phone": "123", "email": "ana@example.com"}


@pytest.fixture
def repo():
    return make_catalog(MemoryRepo())


@pytest.fixture
def gateway():
    return FakeGateway()


@pytest.fixture
def wired(repo, gateway):
    config = load_config({})
    services = build_services(config, repo, repo, gateway=gateway)
    # Pin the clock so the store is open regardless of when the tests run.
    services.checkout._clock = lambda: OPEN_NOW
    return create_app(config, services=services).test_client()


def checkout_body(method="card"):
    return {
        "items": [{"productId": 2, "quantity": 1, "ingredients": []}],
        "fulfillmentType": "pickup",
        "contact": CONTACT,
        "paymentMethod": method,
    }


# ---- not wired yet ------------------------------------------------------------------------


def test_every_payment_endpoint_answers_503_until_a_database_backs_the_services(
    client, auth_header
):
    assert client.post("/api/cart/quote", json={}).status_code == 503
    assert (
        client.post("/api/checkout", json={}, headers=auth_header(5, "customer")).status_code == 503
    )
    assert client.post("/api/payments/webhook", data=b"{}").status_code == 503
    assert (
        client.post("/api/orders/1/refund", json={}, headers=auth_header(1, "admin")).status_code
        == 503
    )
    body = client.post("/api/cart/quote", json={}).get_json()
    assert body["errorCode"] == "NOT_CONFIGURED"


def test_without_stripe_keys_card_endpoints_stay_off_but_checkout_still_works(repo, auth_header):
    config = load_config({})
    app = create_app(config, services=build_services(config, repo, repo))
    app.extensions["foodstack_services"].checkout._clock = lambda: OPEN_NOW
    client = app.test_client()

    assert (
        client.post("/api/payments/webhook", data=b"{}").get_json()["errorCode"]
        == "PAYMENTS_NOT_CONFIGURED"
    )
    card = client.post(
        "/api/checkout", json=checkout_body("card"), headers=auth_header(5, "customer")
    )
    assert card.status_code == 409
    counter = client.post(
        "/api/checkout", json=checkout_body("counter"), headers=auth_header(5, "customer")
    )
    assert counter.status_code == 201


# ---- quote and checkout -------------------------------------------------------------------


def test_quote_is_public_and_returns_the_envelope(wired):
    response = wired.post("/api/cart/quote", json={"items": [{"productId": 2, "quantity": 1}]})
    assert response.status_code == 200
    assert response.get_json()["data"]["total"] == "11.87"


def test_quote_validation_errors_use_422_with_an_error_code(wired):
    response = wired.post("/api/cart/quote", json={"items": []})
    assert response.status_code == 422
    assert response.get_json()["errorCode"] == "CART_EMPTY"


def test_checkout_requires_a_logged_in_customer(wired, auth_header):
    assert wired.post("/api/checkout", json=checkout_body()).status_code == 401
    assert (
        wired.post(
            "/api/checkout", json=checkout_body(), headers=auth_header(2, "staff")
        ).status_code
        == 403
    )


def test_a_card_checkout_returns_the_order_and_a_client_secret(wired, auth_header, repo):
    response = wired.post("/api/checkout", json=checkout_body(), headers=auth_header(5, "customer"))
    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["clientSecret"] == "pi_1_secret_x"
    assert repo.orders[data["orderId"]].user_id == 5  # from the token, not the request body


# ---- webhook ------------------------------------------------------------------------------


def paid_flow(wired, auth_header):
    data = wired.post(
        "/api/checkout", json=checkout_body(), headers=auth_header(5, "customer")
    ).get_json()["data"]
    amount = int(float(data["total"]) * 100)
    payload = event("evt_1", "payment_intent.succeeded", data["orderId"], amount=amount)
    return data, payload


def test_the_webhook_confirms_payment_and_is_idempotent(wired, auth_header, repo):
    data, payload = paid_flow(wired, auth_header)
    headers = {"Stripe-Signature": VALID_SIGNATURE}

    first = wired.post("/api/payments/webhook", data=payload, headers=headers)
    assert first.status_code == 200 and first.get_json()["data"]["result"] == "paid"
    assert repo.orders[data["orderId"]].payment_status == "paid"

    again = wired.post("/api/payments/webhook", data=payload, headers=headers)
    assert again.get_json()["data"]["result"] == "duplicate"


def test_the_webhook_rejects_unsigned_requests_without_needing_auth(wired, auth_header, repo):
    data, payload = paid_flow(wired, auth_header)
    response = wired.post(
        "/api/payments/webhook", data=payload, headers={"Stripe-Signature": "forged"}
    )
    assert response.status_code == 400
    assert response.get_json()["errorCode"] == "INVALID_SIGNATURE"
    assert repo.orders[data["orderId"]].payment_status == "unpaid"


# ---- refunds and cancellation -------------------------------------------------------------


def paid_order(repo, user_id=5):
    order = OrderRecord(
        id=len(repo.orders) + 1,
        user_id=user_id,
        total=__import__("decimal").Decimal("28.80"),
        currency="USD",
        status="received",
        payment_status="paid",
        payment_method="card",
        stripe_payment_intent_id="pi_9",
    )
    repo.orders[order.id] = order
    repo.drafts[order.id] = {"items": []}
    return order


def test_only_admins_can_refund(wired, auth_header, repo):
    order = paid_order(repo)
    assert (
        wired.post(
            f"/api/orders/{order.id}/refund", json={}, headers=auth_header(5, "customer")
        ).status_code
        == 403
    )
    assert (
        wired.post(
            f"/api/orders/{order.id}/refund", json={}, headers=auth_header(2, "staff")
        ).status_code
        == 403
    )

    response = wired.post(
        f"/api/orders/{order.id}/refund", json={"amount": "10.00"}, headers=auth_header(1, "admin")
    )
    assert response.status_code == 200
    assert response.get_json()["data"] == {
        "refundId": "re_1",
        "amount": "10.00",
        "full": False,
        "cancelled": False,
    }


def test_refund_errors_map_to_http_codes(wired, auth_header, repo):
    order = paid_order(repo)
    admin = auth_header(1, "admin")
    assert (
        wired.post(
            f"/api/orders/{order.id}/refund", json={"amount": "999"}, headers=admin
        ).status_code
        == 422
    )
    assert wired.post("/api/orders/999/refund", json={}, headers=admin).status_code == 404


def test_customers_cancel_their_own_received_order_with_an_automatic_refund(
    wired, auth_header, repo
):
    order = paid_order(repo, user_id=5)
    other = wired.post(
        f"/api/orders/{order.id}/cancel", json={}, headers=auth_header(6, "customer")
    )
    assert other.status_code == 403

    mine = wired.post(
        f"/api/orders/{order.id}/cancel",
        json={"reason": "oops"},
        headers=auth_header(5, "customer"),
    )
    assert mine.status_code == 200
    assert mine.get_json()["data"] == {"status": "cancelled", "refunded": "28.80"}
    assert wired.post(f"/api/orders/{order.id}/cancel", json={}).status_code == 401

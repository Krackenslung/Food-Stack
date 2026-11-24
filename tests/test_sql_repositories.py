"""Integration tests for the SQL repositories.

They run only when TEST_DATABASE names a *local scratch database* that already has the schema,
migrations and seed applied, e.g.:

    python scripts/migrate.py --database FoodStack_scratch --baseline --seed
    TEST_DATABASE=FoodStack_scratch pytest tests/test_sql_repositories.py

Without it (CI, a fresh checkout) the whole module is skipped. Each test creates its own user and
leaves rows behind; use a throwaway database.
"""

import os
import uuid
from datetime import UTC, datetime

import pytest

from backend.config import load_config
from backend.errors import ConflictError
from backend.Infrastructure.sql_repositories import (
    SqlCatalogRepository,
    SqlOrderRepository,
    SqlUserRepository,
)
from backend.Services.auth_service import AuthService
from backend.Services.checkout_service import CheckoutService
from backend.Services.payment_service import PaymentService
from tests.fakes import FakeGateway, event

DATABASE = os.getenv("TEST_DATABASE")
pytestmark = pytest.mark.skipif(not DATABASE, reason="TEST_DATABASE is not set")

OPEN_NOW = datetime(2026, 6, 1, 20, 0, tzinfo=UTC)  # 13:00 in Tijuana
CONTACT = {"name": "Ana García", "phone": "+16195550148", "email": "ana@example.com"}


@pytest.fixture(autouse=True)
def scratch_database(monkeypatch):
    if DATABASE.lower() == "foodstack" or "scratch" not in DATABASE.lower():
        pytest.exit("TEST_DATABASE must be a scratch database (its name must contain 'scratch').")
    monkeypatch.setenv("DATABASE", DATABASE)


@pytest.fixture
def user_id():
    repo = SqlUserRepository()
    email = f"t{uuid.uuid4().hex[:10]}@example.com"
    return repo.create_google_user(
        email=email, name="Test", lastname="User", google_sub=uuid.uuid4().hex, avatar_url=None
    ).id


class UniqueGateway(FakeGateway):
    """Real Stripe ids are unique; the fake restarts at pi_1 for every instance."""

    def create_payment_intent(self, **kwargs):
        result = super().create_payment_intent(**kwargs)
        unique = uuid.uuid4().hex[:12]
        return type(result)(id=f"pi_{unique}", client_secret=f"pi_{unique}_secret")

    def create_refund(self, **kwargs):
        result = super().create_refund(**kwargs)
        return type(result)(id=f"re_{uuid.uuid4().hex[:12]}", status=result.status)


@pytest.fixture
def stack():
    catalog, orders = SqlCatalogRepository(), SqlOrderRepository()
    gateway = UniqueGateway()
    payments = PaymentService(gateway, orders)
    checkout = CheckoutService(load_config({}), catalog, orders, payments, clock=lambda: OPEN_NOW)
    return checkout, payments, orders, catalog, gateway


def request(product_id, quantity=1, **extra):
    return {
        "items": [{"productId": product_id, "quantity": quantity, "ingredients": []}],
        "fulfillmentType": "pickup",
        "contact": CONTACT,
        "paymentMethod": "counter",
        **extra,
    }


def stock_of(catalog, product_id):
    return catalog.get_products([product_id])[product_id].stock


def test_catalog_loads_the_seeded_product_with_its_ingredient_rules(stack):
    catalog = stack[3]
    product = catalog.get_products([1])[1]
    assert str(product.price) == "12.99"
    assert product.orderable
    assert len(product.ingredients) == 6
    assert any(not i.removable for i in product.ingredients)  # the patty


def test_a_counter_order_is_received_and_consumes_stock_once(stack, user_id):
    checkout, _, orders, catalog, _ = stack
    before = stock_of(catalog, 1)
    result = checkout.place_order(request(1, 2), user_id)
    order = orders.get_order(result["orderId"])
    assert (order.status, order.payment_status) == ("received", "pay_at_counter")
    assert stock_of(catalog, 1) == before - 2


def test_cancelling_restores_the_stock(stack, user_id):
    checkout, payments, orders, catalog, _ = stack
    before = stock_of(catalog, 1)
    order_id = checkout.place_order(request(1, 3), user_id)["orderId"]
    payments.cancel_order(order_id, "customer", user_id, "changed my mind")
    assert orders.get_order(order_id).status == "cancelled"
    assert stock_of(catalog, 1) == before


def test_ordering_more_than_the_stock_is_refused(stack, user_id):
    checkout, *_ = stack
    with pytest.raises(ConflictError) as error:
        checkout.place_order(request(1, 10_000), user_id)
    assert error.value.error_code == "INSUFFICIENT_STOCK"


def test_a_card_order_waits_for_the_webhook_which_is_idempotent(stack, user_id):
    checkout, payments, orders, catalog, gateway = stack
    before = stock_of(catalog, 2)
    result = checkout.place_order(request(2, 1, paymentMethod="card"), user_id)
    order_id = result["orderId"]
    assert orders.get_order(order_id).status == "pending_payment"
    assert stock_of(catalog, 2) == before  # nothing consumed until paid

    cents = int(orders.get_order(order_id).total * 100)
    payload = event(
        f"evt_{uuid.uuid4().hex}",
        "payment_intent.succeeded",
        order_id,
        amount=cents,
        intent_id=orders.get_order(order_id).stripe_payment_intent_id,
    )
    assert payments.handle_webhook(payload, "valid") == "paid"
    assert payments.handle_webhook(payload, "valid") == "duplicate"  # same event id
    assert orders.get_order(order_id).status == "received"
    assert stock_of(catalog, 2) == before - 1


def test_a_refund_marks_the_order_refunded(stack, user_id):
    checkout, payments, orders, _, gateway = stack
    order_id = checkout.place_order(request(2, 1, paymentMethod="card"), user_id)["orderId"]
    cents = int(orders.get_order(order_id).total * 100)
    payments.handle_webhook(
        event(
            f"evt_{uuid.uuid4().hex}",
            "payment_intent.succeeded",
            order_id,
            amount=cents,
            intent_id=orders.get_order(order_id).stripe_payment_intent_id,
        ),
        "valid",
    )
    result = payments.refund_order(order_id)
    assert result["full"] is True
    assert orders.get_order(order_id).payment_status == "refunded"
    assert orders.total_refunded(order_id) == orders.get_order(order_id).total


def test_the_first_order_promo_applies_once_then_is_used_up(stack, user_id):
    checkout, _, orders, catalog, _ = stack
    quote = checkout.quote(request(1, 1, promoCode="foodstack20"), user_id)
    assert quote["promo"]["valid"] is True
    order_id = checkout.place_order(request(1, 1, promoCode="FOODSTACK20"), user_id)["orderId"]
    orders.change_status(order_id, "preparing", actor_user_id=None)
    orders.change_status(order_id, "ready", actor_user_id=None)
    orders.change_status(order_id, "completed", actor_user_id=None)
    again = checkout.quote(request(1, 1, promoCode="foodstack20"), user_id)
    assert again["promo"]["valid"] is False
    assert catalog.get_promo("FOODSTACK20").times_redeemed >= 1


def test_google_login_creates_then_links_users():
    users = SqlUserRepository()
    sub = uuid.uuid4().hex
    email = f"g{uuid.uuid4().hex[:8]}@example.com"

    class Verifier:
        def verify(self, token):
            return {"sub": sub, "email": email, "email_verified": "true", "name": "Gina Lee"}

    auth = AuthService(Verifier(), users, issue_token=lambda uid, role: f"{uid}:{role}")
    first = auth.login_with_google("t")
    second = auth.login_with_google("t")
    assert first["user"]["id"] == second["user"]["id"]
    assert first["user"]["role"] == "customer"
    stored = users.find_by_email(email)
    assert stored.auth_provider == "google" and stored.google_sub == sub

"""In-memory stand-ins for the repositories and the Stripe gateway (no SQL, no network)."""

import json
from decimal import Decimal

from backend.errors import AppError
from backend.Services.ports import (
    CatalogIngredient,
    CatalogProduct,
    OrderRecord,
    PaymentIntentResult,
    PromoRecord,
    RefundResult,
)

VALID_SIGNATURE = "valid"


class FakeGateway:
    def __init__(self):
        self.intents: list[dict] = []
        self.refunds: list[dict] = []

    def create_payment_intent(self, *, amount_cents, currency, order_id, idempotency_key):
        self.intents.append(
            {
                "amount_cents": amount_cents,
                "currency": currency,
                "order_id": order_id,
                "idempotency_key": idempotency_key,
            }
        )
        n = len(self.intents)
        return PaymentIntentResult(id=f"pi_{n}", client_secret=f"pi_{n}_secret_x")

    def create_refund(self, *, payment_intent_id, amount_cents, idempotency_key):
        self.refunds.append(
            {
                "payment_intent_id": payment_intent_id,
                "amount_cents": amount_cents,
                "idempotency_key": idempotency_key,
            }
        )
        return RefundResult(id=f"re_{len(self.refunds)}", status="succeeded")

    def parse_webhook(self, payload, signature):
        if signature != VALID_SIGNATURE:
            raise AppError(
                "Invalid webhook signature.", error_code="INVALID_SIGNATURE", http_status=400
            )
        return json.loads(payload)


def event(event_id, event_type, order_id, *, amount=None, currency="usd", intent_id="pi_1"):
    """A Stripe-shaped event as bytes (what the webhook receives)."""
    intent = {"id": intent_id, "currency": currency, "metadata": {"order_id": str(order_id)}}
    if amount is not None:
        intent["amount"] = amount
        intent["amount_received"] = amount
    return json.dumps({"id": event_id, "type": event_type, "data": {"object": intent}}).encode()


class MemoryRepo:
    """Implements CatalogRepository and OrderRepository."""

    def __init__(self):
        self.products: dict[int, CatalogProduct] = {}
        self.promos: dict[str, PromoRecord] = {}
        self.prior_orders: set[int] = set()
        self.orders: dict[int, OrderRecord] = {}
        self.drafts: dict[int, dict] = {}
        self.consumed: set[int] = set()
        self.events: set[str] = set()
        self.history: list[tuple[int, str]] = []
        self.payments: list[dict] = []
        self.fail_mark_paid = False

    # ---- catalog ----
    def get_products(self, product_ids):
        return {pid: self.products[pid] for pid in product_ids if pid in self.products}

    def get_promo(self, code):
        return self.promos.get(code)

    def has_prior_order(self, user_id):
        return user_id in self.prior_orders

    # ---- orders ----
    def create_order(self, draft):
        order_id = len(self.orders) + 1
        order = OrderRecord(
            id=order_id,
            user_id=draft["user_id"],
            total=draft["quote"].total,
            currency=draft["currency"],
            status=draft["status"],
            payment_status=draft["payment_status"],
            payment_method=draft["payment_method"],
            promo_code_id=draft["promo_code_id"],
        )
        self.orders[order_id] = order
        self.drafts[order_id] = draft
        self.history.append((order_id, draft["status"]))
        if draft["consume_on_create"]:
            self._consume(order_id)
        return order

    def get_order(self, order_id):
        return self.orders.get(order_id)

    def save_payment_intent(self, order_id, intent_id):
        self.orders[order_id].stripe_payment_intent_id = intent_id

    def claim_stripe_event(self, event_id, event_type, order_id):
        if event_id in self.events:
            return False
        self.events.add(event_id)
        return True

    def release_stripe_event(self, event_id):
        self.events.discard(event_id)

    def mark_paid(self, order_id, *, intent_id, amount):
        if self.fail_mark_paid:
            raise RuntimeError("database unavailable")
        order = self.orders[order_id]
        order.payment_status = "paid"
        order.status = "received"
        order.stripe_payment_intent_id = intent_id
        self.payments.append({"order": order_id, "kind": "charge", "amount": amount})
        self.history.append((order_id, "received"))
        self._consume(order_id)

    def mark_payment_failed(self, order_id, intent_id):
        self.orders[order_id].payment_status = "failed"

    def mark_cancelled(self, order_id, *, actor_user_id, reason):
        order = self.orders[order_id]
        order.status = "cancelled"
        self.history.append((order_id, "cancelled"))
        self._restore(order_id)

    def record_late_payment_refunded(self, order_id, *, intent_id, refund_id, amount):
        self.orders[order_id].payment_status = "refunded"
        self.payments.append({"order": order_id, "kind": "charge", "amount": amount})
        self.payments.append({"order": order_id, "kind": "refund", "amount": amount})

    def record_refund(self, order_id, *, refund_id, amount, full):
        self.payments.append({"order": order_id, "kind": "refund", "amount": amount})
        if full:
            self.orders[order_id].payment_status = "refunded"

    def total_refunded(self, order_id):
        return sum(
            (
                p["amount"]
                for p in self.payments
                if p["order"] == order_id and p["kind"] == "refund"
            ),
            Decimal("0.00"),
        )

    # ---- side effects of reaching "received" ----
    def _consume(self, order_id):
        if order_id in self.consumed:
            return
        self.consumed.add(order_id)
        for item in self.drafts[order_id]["items"]:
            product = self.products[item["product_id"]]
            if product.stock is not None:
                product.stock -= item["quantity"]
        promo_id = self.orders[order_id].promo_code_id
        for promo in self.promos.values():
            if promo.id == promo_id:
                promo.times_redeemed += 1

    def _restore(self, order_id):
        if order_id not in self.consumed:
            return
        self.consumed.discard(order_id)
        for item in self.drafts[order_id]["items"]:
            product = self.products[item["product_id"]]
            if product.stock is not None:
                product.stock += item["quantity"]


def make_catalog(repo: MemoryRepo):
    """A few products: ids 1-3 priced like the Figma cart (12.99 + 9.49 + 8.98 = 31.46)."""
    cheddar = CatalogIngredient(101, Decimal("1.00"), default=1, max=3, removable=True)
    patty = CatalogIngredient(102, Decimal("2.50"), default=1, max=3, removable=False)
    repo.products = {
        1: CatalogProduct(
            1, "Overkill Double Burger", Decimal("12.99"), ingredients=[cheddar, patty]
        ),
        2: CatalogProduct(2, "Chicken Burrito", Decimal("9.49")),
        3: CatalogProduct(3, "Cheese Bites + Horchata", Decimal("8.98"), allow_customization=False),
        4: CatalogProduct(4, "Out of stock", Decimal("5.00"), stock=0),
        5: CatalogProduct(5, "Limited", Decimal("5.00"), stock=2),
        6: CatalogProduct(6, "Hidden", Decimal("5.00"), publish_status="draft"),
    }
    repo.promos = {
        "FOODSTACK20": PromoRecord(
            1, "FOODSTACK20", percent_off=Decimal("20"), first_order_only=True
        )
    }
    return repo

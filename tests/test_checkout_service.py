from datetime import UTC, datetime
from decimal import Decimal

import pytest

from backend.config import load_config
from backend.errors import ConflictError, ValidationError
from backend.Services.checkout_service import CheckoutService
from backend.Services.payment_service import PaymentService
from tests.fakes import FakeGateway, MemoryRepo, make_catalog

# 2026-06-01 20:00 UTC = 13:00 in Tijuana (PDT): open. 10:00 UTC = 03:00: closed.
OPEN_NOW = datetime(2026, 6, 1, 20, 0, tzinfo=UTC)
CLOSED_NOW = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)

CONTACT = {"name": "Ana García", "phone": "+16195550148", "email": "ana@example.com"}


@pytest.fixture
def repo():
    return make_catalog(MemoryRepo())


@pytest.fixture
def gateway():
    return FakeGateway()


def build(repo, gateway=None, *, now=OPEN_NOW):
    config = load_config({})
    payments = PaymentService(gateway, repo) if gateway else None
    return CheckoutService(config, repo, repo, payments, clock=lambda: now)


def cart(*lines, **extra):
    items = [{"productId": pid, "quantity": qty, "ingredients": []} for pid, qty in lines]
    return {"items": items, "fulfillmentType": "pickup", **extra}


def order_request(*lines, **extra):
    base = cart(*lines)
    base.update({"contact": CONTACT, "paymentMethod": "counter", **extra})
    return base


# ---- quoting ------------------------------------------------------------------------------


def test_the_design_example_quotes_28_80_with_the_first_order_promo(repo):
    quote = build(repo).quote(cart((1, 1), (2, 1), (3, 1), promoCode="foodstack20"), user_id=5)
    assert quote["subtotal"] == "31.46"
    assert quote["discount"] == "6.29"
    assert quote["tax"] == "2.13"
    assert quote["total"] == "28.80"
    assert quote["promo"] == {"code": "FOODSTACK20", "valid": True, "reason": None}


def test_quotes_report_an_unusable_promo_instead_of_failing(repo):
    service = build(repo)
    repo.prior_orders.add(5)
    returning = service.quote(cart((1, 1), promoCode="FOODSTACK20"), user_id=5)
    assert returning["promo"]["reason"] == "PROMO_FIRST_ORDER_ONLY"
    assert returning["discount"] == "0.00"
    unknown = service.quote(cart((1, 1), promoCode="NOPE"), user_id=None)
    assert unknown["promo"] == {"code": "NOPE", "valid": False, "reason": "PROMO_NOT_FOUND"}


def test_extras_are_priced_by_the_server_from_catalog_prices(repo):
    body = cart((1, 2))
    body["items"][0]["ingredients"] = [{"productIngredientId": 101, "quantity": 3}]  # +2 cheddar
    quote = build(repo).quote(body)
    assert quote["lines"][0]["lineTotal"] == "29.98"  # (12.99 + 2 x 1.00) x 2


def test_delivery_adds_the_delivery_fee(repo):
    quote = build(repo).quote({**cart((2, 1)), "fulfillmentType": "delivery"})
    assert quote["deliveryFee"] == "2.99"


@pytest.mark.parametrize(
    ("body", "code"),
    [
        ({"items": []}, "CART_EMPTY"),
        ({}, "CART_EMPTY"),
        (cart((99, 1)), "PRODUCT_NOT_FOUND"),
        (cart((2, 0)), "QUANTITY_INVALID"),
    ],
)
def test_bad_carts_are_rejected_with_stable_codes(repo, body, code):
    with pytest.raises(ValidationError) as exc:
        build(repo).quote(body)
    assert exc.value.error_code == code


@pytest.mark.parametrize(
    ("ingredients", "pid", "code"),
    [
        ([{"productIngredientId": 101, "quantity": 4}], 1, "INGREDIENT_QUANTITY_EXCEEDS_MAX"),
        ([{"productIngredientId": 102, "quantity": 0}], 1, "INGREDIENT_NOT_REMOVABLE"),
        ([{"productIngredientId": 555, "quantity": 1}], 1, "INGREDIENT_NOT_FOUND"),
    ],
)
def test_ingredient_rules_are_enforced(repo, ingredients, pid, code):
    body = cart((pid, 1))
    body["items"][0]["ingredients"] = ingredients
    with pytest.raises(ValidationError) as exc:
        build(repo).quote(body)
    assert exc.value.error_code == code


def test_unavailable_and_out_of_stock_products_cannot_be_quoted(repo):
    for pid in (4, 6):
        with pytest.raises(ConflictError) as exc:
            build(repo).quote(cart((pid, 1)))
        assert exc.value.error_code == "PRODUCT_UNAVAILABLE"
    with pytest.raises(ConflictError) as exc:
        build(repo).quote(cart((5, 3)))  # only 2 left
    assert exc.value.error_code == "INSUFFICIENT_STOCK"


def test_notes_are_length_limited(repo):
    body = cart((2, 1))
    body["items"][0]["notes"] = "x" * 201
    with pytest.raises(ValidationError) as exc:
        build(repo).quote(body)
    assert exc.value.error_code == "NOTES_TOO_LONG"


# ---- placing orders -----------------------------------------------------------------------


def test_pay_at_counter_orders_are_received_immediately_and_consume_stock_and_promo(repo):
    result = build(repo).place_order(order_request((5, 1), promoCode="FOODSTACK20"), user_id=5)
    order = repo.orders[result["orderId"]]
    assert result["orderNumber"] == "FS-0001"
    assert "clientSecret" not in result
    assert (order.status, order.payment_status, order.payment_method) == (
        "received",
        "pay_at_counter",
        "counter",
    )
    assert repo.products[5].stock == 1
    assert repo.promos["FOODSTACK20"].times_redeemed == 1
    assert result["total"] == str(order.total)


def test_the_server_ignores_totals_and_prices_sent_by_the_client(repo):
    body = order_request((2, 1))
    body.update({"total": "0.01", "subtotal": "0.01"})
    body["items"][0]["price"] = "0.01"
    result = build(repo).place_order(body, user_id=5)
    # 9.49 + 1.50 service fee, tax 8% of 10.99 = 0.88 -> 11.87
    assert result["total"] == "11.87"


def test_card_orders_wait_for_payment_and_return_a_client_secret(repo, gateway):
    service = build(repo, gateway)
    result = service.place_order(order_request((5, 1), paymentMethod="card"), user_id=5)
    order = repo.orders[result["orderId"]]

    assert result["clientSecret"] == "pi_1_secret_x"
    assert (order.status, order.payment_status) == ("pending_payment", "unpaid")
    assert gateway.intents[0]["amount_cents"] == int(Decimal(result["total"]) * 100)
    # Nothing is consumed until the webhook confirms payment.
    assert repo.products[5].stock == 2
    assert order.stripe_payment_intent_id == "pi_1"


def test_card_payments_are_refused_when_stripe_is_not_configured(repo):
    with pytest.raises(ConflictError) as exc:
        build(repo).place_order(order_request((2, 1), paymentMethod="card"), user_id=5)
    assert exc.value.error_code == "PAYMENT_METHOD_UNAVAILABLE"
    assert repo.orders == {}


def test_an_invalid_promo_blocks_checkout(repo):
    with pytest.raises(ValidationError) as exc:
        build(repo).place_order(order_request((2, 1), promoCode="NOPE"), user_id=5)
    assert exc.value.error_code == "PROMO_NOT_FOUND"
    assert repo.orders == {}


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"contact": {"name": "", "phone": "1", "email": "a@b.c"}}, "CONTACT_INVALID"),
        ({"contact": {"name": "A", "phone": "1", "email": "nope"}}, "CONTACT_INVALID"),
        ({"fulfillmentType": "delivery"}, "DELIVERY_ADDRESS_REQUIRED"),
        ({"fulfillmentType": "drone"}, "FULFILLMENT_TYPE_INVALID"),
        ({"paymentMethod": "cash"}, "PAYMENT_METHOD_INVALID"),
    ],
)
def test_invalid_order_details_are_rejected(repo, overrides, code):
    with pytest.raises(ValidationError) as exc:
        build(repo).place_order(order_request((2, 1), **overrides), user_id=5)
    assert exc.value.error_code == code


def test_orders_are_refused_while_the_store_is_closed(repo):
    with pytest.raises(ConflictError) as exc:
        build(repo, now=CLOSED_NOW).place_order(order_request((2, 1)), user_id=5)
    assert exc.value.error_code == "STORE_CLOSED"


def test_a_closed_store_accepts_orders_scheduled_inside_opening_hours(repo):
    scheduled = "2026-06-01T20:00:00+00:00"  # 13:00 local, a few hours after "now" (03:00)
    result = build(repo, now=CLOSED_NOW).place_order(
        order_request((2, 1), scheduledFor=scheduled), user_id=5
    )
    assert repo.orders[result["orderId"]].id == 1
    assert repo.drafts[1]["scheduled_for"] == datetime(2026, 6, 1, 20, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("when", "code"),
    [
        ("2026-06-01T20:05:00+00:00", "SCHEDULE_PAST"),  # less than 15 min ahead of OPEN_NOW
        ("2026-06-01T10:00:00+00:00", "SCHEDULE_PAST"),
        ("2026-06-03T20:00:00+00:00", "SCHEDULE_TOO_FAR"),
        ("2026-06-02T12:00:00+00:00", "SCHEDULE_OUTSIDE_HOURS"),  # 05:00 local
        ("not a date", "SCHEDULE_INVALID"),
    ],
)
def test_scheduled_times_are_validated(repo, when, code):
    with pytest.raises(ValidationError) as exc:
        build(repo).place_order(order_request((2, 1), scheduledFor=when), user_id=5)
    assert exc.value.error_code == code

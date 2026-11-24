from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from backend.config import load_config
from backend.errors import ConflictError, ValidationError
from backend.Services import order_service as svc

CONFIG = load_config({})
NOW = datetime(2026, 6, 1, 12, 0)


def item(price, quantity=1, ingredients=None, **extra):
    return {
        "product_id": 1,
        "unit_price": price,
        "quantity": quantity,
        "ingredients": ingredients or [],
        **extra,
    }


def ingredient(quantity, default=1, maximum=3, removable=True, extra_price="0.50"):
    return {
        "quantity": quantity,
        "default": default,
        "max": maximum,
        "removable": removable,
        "extra_price": extra_price,
    }


def promo(**overrides):
    base = {"status": 1, "percent_off": 20, "times_redeemed": 0}
    base.update(overrides)
    return base


# ---- pricing ---------------------------------------------------------------


def test_design_example_totals_28_80():
    items = [item("12.99"), item("9.49"), item("8.98")]  # subtotal 31.46
    quote = svc.price_order(items, CONFIG, "pickup", {"percent_off": 20})
    assert quote.subtotal == Decimal("31.46")
    assert quote.discount == Decimal("6.29")
    assert quote.service_fee == Decimal("1.50")
    assert quote.tax == Decimal("2.13")
    assert quote.total == Decimal("28.80")


def test_delivery_adds_delivery_fee_before_tax():
    quote = svc.price_order([item("10.00")], CONFIG, "delivery")
    assert quote.delivery_fee == Decimal("2.99")
    # (10.00 + 1.50 + 2.99) x 0.08 = 1.1592 -> 1.16
    assert quote.tax == Decimal("1.16")
    assert quote.total == Decimal("15.65")


def test_extra_ingredients_are_charged_per_unit_over_default():
    # 2 extra units (default 1, chosen 3) at 0.50 -> +1.00 per burger, x2 burgers
    line = svc.price_line(item("10.00", 2, [ingredient(3)]))
    assert line["extras"] == "1.00"
    assert line["lineTotal"] == "22.00"


def test_removing_an_ingredient_never_lowers_the_price():
    line = svc.price_line(item("10.00", 1, [ingredient(0, default=1)]))
    assert line["lineTotal"] == "10.00"


def test_ingredient_above_max_is_rejected():
    with pytest.raises(ValidationError) as exc:
        svc.price_line(item("10.00", 1, [ingredient(4, maximum=3)]))
    assert exc.value.error_code == "INGREDIENT_QUANTITY_EXCEEDS_MAX"


def test_non_removable_ingredient_cannot_go_below_default():
    with pytest.raises(ValidationError) as exc:
        svc.price_line(item("10.00", 1, [ingredient(0, default=1, removable=False)]))
    assert exc.value.error_code == "INGREDIENT_NOT_REMOVABLE"


def test_non_customizable_product_rejects_changes_but_accepts_defaults():
    with pytest.raises(ValidationError) as exc:
        svc.price_line(item("5.00", 1, [ingredient(2)], allow_customization=False))
    assert exc.value.error_code == "PRODUCT_NOT_CUSTOMIZABLE"
    line = svc.price_line(item("5.00", 1, [ingredient(1)], allow_customization=False))
    assert line["lineTotal"] == "5.00"


@pytest.mark.parametrize("quantity", [0, -1, 1.5])
def test_invalid_quantity_is_rejected(quantity):
    with pytest.raises(ValidationError):
        svc.price_line(item("5.00", quantity))


def test_empty_cart_and_bad_fulfillment_are_rejected():
    with pytest.raises(ValidationError) as exc:
        svc.price_order([], CONFIG)
    assert exc.value.error_code == "CART_EMPTY"
    with pytest.raises(ValidationError):
        svc.price_order([item("5.00")], CONFIG, "teleport")


def test_rounding_is_half_up():
    assert svc.money("2.675") == Decimal("2.68")
    assert svc.money("0.005") == Decimal("0.01")


def test_discount_is_capped_at_subtotal():
    assert svc.compute_discount(Decimal("5.00"), {"amount_off": "20"}) == Decimal("5.00")
    assert svc.compute_discount(Decimal("5.00"), None) == Decimal("0.00")


def test_to_cents():
    assert svc.to_cents(Decimal("28.80")) == 2880
    assert svc.to_cents("0.29") == 29  # no float drift


# ---- promo codes -----------------------------------------------------------


def test_valid_promo():
    assert svc.validate_promo(promo(), Decimal("30"), NOW) == (True, None)


@pytest.mark.parametrize(
    ("overrides", "subtotal", "reason"),
    [
        ({"status": 0}, "30", "PROMO_NOT_FOUND"),
        ({"starts_at": NOW + timedelta(days=1)}, "30", "PROMO_NOT_STARTED"),
        ({"expires_at": NOW - timedelta(days=1)}, "30", "PROMO_EXPIRED"),
        ({"min_subtotal": "50"}, "30", "PROMO_MIN_SUBTOTAL"),
        ({"max_redemptions": 5, "times_redeemed": 5}, "30", "PROMO_EXHAUSTED"),
    ],
)
def test_invalid_promos(overrides, subtotal, reason):
    assert svc.validate_promo(promo(**overrides), Decimal(subtotal), NOW) == (False, reason)


def test_unknown_promo_and_first_order_only():
    assert svc.validate_promo(None, Decimal("30"), NOW) == (False, "PROMO_NOT_FOUND")
    first_only = promo(first_order_only=True)
    assert svc.validate_promo(first_only, Decimal("30"), NOW, has_prior_order=True) == (
        False,
        "PROMO_FIRST_ORDER_ONLY",
    )
    assert svc.validate_promo(first_only, Decimal("30"), NOW, has_prior_order=False)[0]


# ---- state machine ---------------------------------------------------------


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("received", "preparing"),
        ("preparing", "ready"),
        ("ready", "completed"),
        ("received", "cancelled"),
        ("pending_payment", "cancelled"),
    ],
)
def test_staff_can_follow_the_flow(current, target):
    assert svc.validate_transition(current, target, "staff") == target


@pytest.mark.parametrize(
    ("current", "target"),
    [
        ("received", "ready"),  # skipping a step
        ("preparing", "received"),  # backwards
        ("preparing", "cancelled"),  # too late to cancel
        ("ready", "cancelled"),
        ("completed", "preparing"),  # terminal
        ("cancelled", "received"),  # terminal
    ],
)
def test_illegal_transitions_are_conflicts(current, target):
    with pytest.raises(ConflictError) as exc:
        svc.validate_transition(current, target, "admin")
    assert exc.value.error_code == "ORDER_INVALID_TRANSITION"
    assert exc.value.http_status == 409


def test_only_the_system_confirms_payment():
    assert svc.validate_transition("pending_payment", "received", "system") == "received"
    with pytest.raises(ConflictError):
        svc.validate_transition("pending_payment", "received", "admin")


def test_customer_can_only_cancel_a_received_order():
    assert svc.validate_transition("received", "cancelled", "customer") == "cancelled"
    for current, target in [("received", "preparing"), ("pending_payment", "cancelled")]:
        with pytest.raises(ConflictError) as exc:
            svc.validate_transition(current, target, "customer")
        assert exc.value.http_status == 403


def test_unknown_status_and_role():
    with pytest.raises(ValidationError):
        svc.validate_transition("received", "teleported", "staff")
    with pytest.raises(ConflictError):
        svc.validate_transition("received", "preparing", "guest")


def test_legacy_pending_is_treated_as_received():
    assert svc.normalize_status("pending") == "received"
    assert svc.validate_transition("pending", "preparing", "staff") == "preparing"


def test_eta():
    assert svc.estimate_ready_minutes([6, 8], 3) == 14
    assert svc.estimate_ready_minutes([], 0) == 0

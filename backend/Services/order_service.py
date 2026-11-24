"""Order business logic: server-side pricing, promo validation and the status state machine.

Everything here is pure (no database, no Flask) so it can be unit tested with plain
dicts. Callers load rows from the models and pass them in. Rules come from
CLAUDE.md "Business rules"; fees and tax rate come from ``Config``, never from here.
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from backend.errors import ConflictError, ValidationError

CENT = Decimal("0.01")


def money(value):
    """Quantize to 2 decimals, ROUND_HALF_UP (applied at every pricing step)."""
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def to_cents(amount):
    """Convert a DECIMAL amount to integer cents (only for Stripe)."""
    return int(money(amount) * 100)


# --------------------------------------------------------------------------
# Pricing
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Quote:
    lines: list = field(default_factory=list)
    subtotal: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    service_fee: Decimal = Decimal("0.00")
    delivery_fee: Decimal = Decimal("0.00")
    tax: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")

    def to_dict(self):
        return {
            "lines": self.lines,
            "subtotal": str(self.subtotal),
            "discount": str(self.discount),
            "serviceFee": str(self.service_fee),
            "deliveryFee": str(self.delivery_fee),
            "tax": str(self.tax),
            "total": str(self.total),
        }


def _validate_ingredient_choices(item):
    """Enforce the customization limits for one cart item and return its extras total."""
    allow_customization = item.get("allow_customization", True)
    extras = Decimal("0.00")

    for ingredient in item.get("ingredients", []):
        chosen = ingredient["quantity"]
        default = ingredient.get("default", 0)
        maximum = ingredient.get("max", 1)

        if not isinstance(chosen, int) or chosen < 0:
            raise ValidationError(
                "Ingredient quantity must be a non-negative integer.",
                error_code="INGREDIENT_QUANTITY_INVALID",
            )
        if chosen > maximum:
            raise ValidationError(
                "Ingredient quantity exceeds the maximum allowed.",
                error_code="INGREDIENT_QUANTITY_EXCEEDS_MAX",
            )
        if chosen < default and not ingredient.get("removable", False):
            raise ValidationError(
                "This ingredient cannot be removed.",
                error_code="INGREDIENT_NOT_REMOVABLE",
            )
        if not allow_customization and chosen != default:
            raise ValidationError(
                "This product does not allow customization.",
                error_code="PRODUCT_NOT_CUSTOMIZABLE",
            )

        # Removing an ingredient never lowers the price.
        extra_units = max(0, chosen - default)
        extras += money(ingredient.get("extra_price", 0)) * extra_units

    return extras


def price_line(item):
    """line = (product price + sum of extras) x quantity."""
    quantity = item["quantity"]
    if not isinstance(quantity, int) or quantity < 1:
        raise ValidationError("Quantity must be at least 1.", error_code="QUANTITY_INVALID")

    unit_price = money(item["unit_price"])
    extras = _validate_ingredient_choices(item)
    unit_total = unit_price + extras
    return {
        "productId": item.get("product_id"),
        "quantity": quantity,
        "unitPrice": str(unit_price),
        "extras": str(extras),
        "lineTotal": str(money(unit_total * quantity)),
    }


def compute_discount(subtotal, promo):
    """Percent or fixed discount, capped at the subtotal. ``promo`` may be None."""
    if not promo:
        return Decimal("0.00")

    if promo.get("percent_off") is not None:
        discount = money(subtotal * Decimal(str(promo["percent_off"])) / Decimal(100))
    elif promo.get("amount_off") is not None:
        discount = money(promo["amount_off"])
    else:
        return Decimal("0.00")

    return min(discount, subtotal)


def price_order(items, config, fulfillment_type="pickup", promo=None):
    """Compute the full quote. ``promo`` must already be validated by ``validate_promo``.

    subtotal = sum(lines); discount capped at subtotal; fees = service fee
    (+ delivery fee for delivery); tax = (subtotal - discount + fees) x TAX_RATE;
    total = subtotal - discount + fees + tax.
    """
    if not items:
        raise ValidationError("The cart is empty.", error_code="CART_EMPTY")
    if fulfillment_type not in ("pickup", "delivery"):
        raise ValidationError(
            "fulfillmentType must be pickup or delivery.",
            error_code="FULFILLMENT_TYPE_INVALID",
        )

    lines = [price_line(item) for item in items]
    subtotal = sum((Decimal(line["lineTotal"]) for line in lines), Decimal("0.00"))
    discount = compute_discount(subtotal, promo)

    service_fee = money(config.service_fee)
    delivery_fee = money(config.delivery_fee) if fulfillment_type == "delivery" else Decimal("0.00")
    fees = service_fee + delivery_fee

    taxable = subtotal - discount + fees
    tax = money(taxable * config.tax_rate)
    total = taxable + tax

    return Quote(
        lines=lines,
        subtotal=money(subtotal),
        discount=discount,
        service_fee=service_fee,
        delivery_fee=delivery_fee,
        tax=tax,
        total=money(total),
    )


# --------------------------------------------------------------------------
# Promo codes
# --------------------------------------------------------------------------


def validate_promo(promo, subtotal, now=None, has_prior_order=False):
    """Return ``(valid, reason)``. ``reason`` is a stable code when invalid, else None."""
    now = now or datetime.utcnow()

    if not promo or promo.get("status", 1) != 1:
        return False, "PROMO_NOT_FOUND"

    starts_at, expires_at = promo.get("starts_at"), promo.get("expires_at")
    if starts_at and now < starts_at:
        return False, "PROMO_NOT_STARTED"
    if expires_at and now > expires_at:
        return False, "PROMO_EXPIRED"

    if subtotal < money(promo.get("min_subtotal") or 0):
        return False, "PROMO_MIN_SUBTOTAL"

    max_redemptions = promo.get("max_redemptions")
    if max_redemptions is not None and promo.get("times_redeemed", 0) >= max_redemptions:
        return False, "PROMO_EXHAUSTED"

    if promo.get("first_order_only") and has_prior_order:
        return False, "PROMO_FIRST_ORDER_ONLY"

    return True, None


# --------------------------------------------------------------------------
# Status state machine
# --------------------------------------------------------------------------

PENDING_PAYMENT = "pending_payment"
RECEIVED = "received"
PREPARING = "preparing"
READY = "ready"
COMPLETED = "completed"
CANCELLED = "cancelled"

ORDER_STATUSES = (PENDING_PAYMENT, RECEIVED, PREPARING, READY, COMPLETED, CANCELLED)

TRANSITIONS = {
    PENDING_PAYMENT: {RECEIVED, CANCELLED},
    RECEIVED: {PREPARING, CANCELLED},
    PREPARING: {READY},
    READY: {COMPLETED},
    COMPLETED: set(),
    CANCELLED: set(),
}

# Legacy rows/controllers still write "pending"; it means "received" in the new flow.
LEGACY_STATUS_ALIASES = {"pending": RECEIVED}

STAFF_ROLES = ("staff", "admin")


def normalize_status(status):
    value = str(status or "").strip().lower()
    return LEGACY_STATUS_ALIASES.get(value, value)


def validate_transition(current, target, actor_role):
    """Raise unless ``actor_role`` may move an order from ``current`` to ``target``.

    - Customers may only cancel, and only while the order is ``received``
      (before the kitchen accepts it).
    - Staff/admin follow the transition table (cancel from received/pending_payment).
    - Moves to ``received`` out of ``pending_payment`` belong to the payment webhook,
      which passes ``actor_role="system"``.
    """
    current = normalize_status(current)
    target = normalize_status(target)
    role = str(actor_role or "").lower()

    if current not in ORDER_STATUSES or target not in ORDER_STATUSES:
        raise ValidationError("Unknown order status.", error_code="ORDER_STATUS_INVALID")

    if target not in TRANSITIONS[current]:
        raise ConflictError(
            f"Cannot move an order from {current} to {target}.",
            error_code="ORDER_INVALID_TRANSITION",
        )

    if role == "system":
        return target

    if role == "customer":
        if target != CANCELLED or current != RECEIVED:
            raise ConflictError(
                "Customers can only cancel an order that has not been accepted yet.",
                error_code="ORDER_CANCEL_NOT_ALLOWED",
                http_status=403,
            )
        return target

    if role not in STAFF_ROLES:
        raise ConflictError("Forbidden.", error_code="FORBIDDEN", http_status=403)

    if current == PENDING_PAYMENT and target == RECEIVED:
        raise ConflictError(
            "Only a confirmed payment can move an order to received.",
            error_code="ORDER_INVALID_TRANSITION",
        )

    return target


def estimate_ready_minutes(prep_time_max_values, orders_preparing):
    """ETA: max(Prep_Time_Max of items) + 2 min x orders currently preparing."""
    longest = max(prep_time_max_values, default=0)
    return int(longest) + 2 * int(orders_preparing)

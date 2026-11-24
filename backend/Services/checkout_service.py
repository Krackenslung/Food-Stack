"""Cart quoting and order placement.

The client sends product ids, quantities and ingredient choices only. Prices, fees, tax,
promo discounts, availability, stock, opening hours and the order total are all decided here.
"""

import re
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from backend.config import Config
from backend.errors import ConflictError, ValidationError
from backend.Services import order_service as orders
from backend.Services.payment_service import PaymentService
from backend.Services.ports import CatalogProduct, CatalogRepository, OrderRepository
from backend.store_hours import StoreHours, parse_hours

EMAIL = re.compile(r"^\S+@\S+\.\S+$")
MAX_NOTES = 200
MIN_SCHEDULE_LEAD = timedelta(minutes=15)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def order_number(order_id: int) -> str:
    return f"FS-{order_id:04d}"


class CheckoutService:
    def __init__(
        self,
        config: Config,
        catalog: CatalogRepository,
        order_repo: OrderRepository,
        payments: PaymentService | None = None,
        clock: Callable[[], datetime] = _utcnow,
    ):
        self._config = config
        self._catalog = catalog
        self._orders = order_repo
        self._payments = payments
        self._clock = clock
        self._hours: StoreHours = parse_hours(config.store_hours, config.store_timezone)

    @property
    def payments_enabled(self) -> bool:
        return self._payments is not None

    # ---- quote ----------------------------------------------------------------------------

    def quote(self, body: dict, user_id: int | None = None) -> dict:
        """Price a cart. Invalid promos are reported in ``promo`` instead of raising."""
        priced = self._price(body, user_id, strict_promo=False)
        quote = priced["quote"]
        result = quote.to_dict()
        result["promo"] = priced["promo_result"]
        return result

    def _price(self, body: dict, user_id: int | None, *, strict_promo: bool) -> dict:
        raw_items = body.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise ValidationError("The cart is empty.", error_code="CART_EMPTY")

        fulfillment = body.get("fulfillmentType", "pickup")
        products = self._catalog.get_products(
            [item.get("productId") for item in raw_items if isinstance(item.get("productId"), int)]
        )

        items = [self._price_input(raw, products) for raw in raw_items]
        self._check_stock(items, products)

        subtotal = orders.price_order(items, self._config, fulfillment).subtotal

        promo_rule = None
        promo_record = None
        promo_result = None
        code = str(body.get("promoCode") or "").strip().upper()
        if code:
            promo_record = self._catalog.get_promo(code)
            prior = self._catalog.has_prior_order(user_id) if user_id else False
            valid, reason = orders.validate_promo(
                promo_record.as_rule() if promo_record else None,
                subtotal,
                self._clock().replace(tzinfo=None),
                prior,
            )
            promo_result = {"code": code, "valid": valid, "reason": reason}
            if valid and promo_record is not None:
                promo_rule = {
                    "percent_off": promo_record.percent_off,
                    "amount_off": promo_record.amount_off,
                }
            elif strict_promo:
                raise ValidationError("This promo code can't be used.", error_code=reason)

        quote = orders.price_order(items, self._config, fulfillment, promo_rule)
        return {
            "quote": quote,
            "promo_result": promo_result,
            "promo_record": promo_record if promo_rule else None,
            "items": items,
        }

    def _price_input(self, raw: dict, products: dict[int, CatalogProduct]) -> dict:
        product = products.get(raw.get("productId"))
        if product is None:
            raise ValidationError("Unknown product.", error_code="PRODUCT_NOT_FOUND")
        if not product.orderable:
            raise ConflictError(
                f"{product.name} is not available.", error_code="PRODUCT_UNAVAILABLE"
            )

        notes = str(raw.get("notes") or "")
        if len(notes) > MAX_NOTES:
            raise ValidationError("Notes are too long.", error_code="NOTES_TOO_LONG")

        by_id = {i.product_ingredient_id: i for i in product.ingredients}
        choices = []
        for choice in raw.get("ingredients") or []:
            rule = by_id.get(choice.get("productIngredientId"))
            if rule is None:
                raise ValidationError("Unknown ingredient.", error_code="INGREDIENT_NOT_FOUND")
            choices.append(
                {
                    "product_ingredient_id": rule.product_ingredient_id,
                    "quantity": choice.get("quantity"),
                    "default": rule.default,
                    "max": rule.max,
                    "removable": rule.removable,
                    "extra_price": rule.extra_price,
                }
            )

        return {
            "product_id": product.id,
            "unit_price": product.price,
            "quantity": raw.get("quantity"),
            "allow_customization": product.allow_customization,
            "ingredients": choices,
            "notes": notes,
        }

    @staticmethod
    def _check_stock(items: list[dict], products: dict[int, CatalogProduct]) -> None:
        wanted: dict[int, int] = {}
        for item in items:
            wanted[item["product_id"]] = wanted.get(item["product_id"], 0) + item["quantity"]
        for product_id, quantity in wanted.items():
            stock = products[product_id].stock
            if stock is not None and quantity > stock:
                raise ConflictError(
                    f"Only {stock} of {products[product_id].name} left.",
                    error_code="INSUFFICIENT_STOCK",
                )

    # ---- place order ----------------------------------------------------------------------

    def place_order(self, body: dict, user_id: int) -> dict:
        contact = self._validate_contact(body)
        fulfillment = body.get("fulfillmentType", "pickup")
        if fulfillment not in ("pickup", "delivery"):
            raise ValidationError(
                "fulfillmentType is invalid.", error_code="FULFILLMENT_TYPE_INVALID"
            )
        address = str(body.get("deliveryAddress") or "").strip()
        if fulfillment == "delivery" and not address:
            raise ValidationError(
                "A delivery address is required.", error_code="DELIVERY_ADDRESS_REQUIRED"
            )

        method = body.get("paymentMethod")
        if method not in ("card", "counter"):
            raise ValidationError("paymentMethod is invalid.", error_code="PAYMENT_METHOD_INVALID")
        if method == "card" and self._payments is None:
            raise ConflictError(
                "Card payments are not available.", error_code="PAYMENT_METHOD_UNAVAILABLE"
            )

        now = self._clock()
        scheduled = self._validate_schedule(body.get("scheduledFor"), now)
        if scheduled is None and not self._hours.is_open(now):
            raise ConflictError("The store is closed.", error_code="STORE_CLOSED")

        priced = self._price(body, user_id, strict_promo=True)
        quote = priced["quote"]
        promo = priced["promo_record"]

        card = method == "card"
        draft = {
            "user_id": user_id,
            "status": orders.PENDING_PAYMENT if card else orders.RECEIVED,
            "payment_status": "unpaid" if card else "pay_at_counter",
            "payment_method": method,
            "fulfillment_type": fulfillment,
            "contact": contact,
            "delivery_address": address or None,
            "scheduled_for": scheduled,
            "currency": self._config.currency,
            "quote": quote,
            "items": priced["items"],
            "promo_code_id": promo.id if promo else None,
            # Stock and promo redemptions are consumed when an order reaches "received": right
            # away for pay-at-counter, on the webhook for cards.
            "consume_on_create": not card,
        }
        order = self._orders.create_order(draft)

        result = {
            "orderId": order.id,
            "orderNumber": order_number(order.id),
            "total": str(order.total),
        }
        if card:
            assert self._payments is not None
            result["clientSecret"] = self._payments.start_card_payment(order).client_secret
        return result

    @staticmethod
    def _validate_contact(body: dict) -> dict:
        contact = body.get("contact") or {}
        name = str(contact.get("name") or "").strip()
        phone = str(contact.get("phone") or "").strip()
        email = str(contact.get("email") or "").strip()
        if not name or not phone or not EMAIL.match(email):
            raise ValidationError("Contact details are incomplete.", error_code="CONTACT_INVALID")
        return {"name": name, "phone": phone, "email": email}

    def _validate_schedule(self, value, now: datetime) -> datetime | None:
        if not value:
            return None
        try:
            when = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValidationError(
                "scheduledFor is invalid.", error_code="SCHEDULE_INVALID"
            ) from exc
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)

        if when < now + MIN_SCHEDULE_LEAD:
            raise ValidationError(
                "Pick a time at least 15 minutes ahead.", error_code="SCHEDULE_PAST"
            )
        local = when.astimezone(self._hours.tz)
        end_of_tomorrow = (now.astimezone(self._hours.tz) + timedelta(days=1)).replace(
            hour=23, minute=59, second=59
        )
        if local > end_of_tomorrow:
            raise ValidationError(
                "Schedule for today or tomorrow only.", error_code="SCHEDULE_TOO_FAR"
            )
        if not self._hours.is_open(when):
            raise ValidationError(
                "That time is outside opening hours.", error_code="SCHEDULE_OUTSIDE_HOURS"
            )
        return when


def _decimal(value) -> Decimal:
    return Decimal(str(value))

"""Interfaces the payment/checkout services depend on.

The services contain the business rules and are tested against in-memory fakes. A SQL
implementation of these Protocols (over the Orders/Payments/Stripe_Events/Promo_Codes tables)
plugs in later without touching the services. Until then the controllers answer 503.
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Protocol


@dataclass
class OrderRecord:
    id: int
    user_id: int
    total: Decimal
    currency: str
    status: str
    payment_status: str
    payment_method: str
    stripe_payment_intent_id: str | None = None
    promo_code_id: int | None = None


@dataclass(frozen=True)
class PaymentIntentResult:
    id: str
    client_secret: str


@dataclass(frozen=True)
class RefundResult:
    id: str
    status: str


@dataclass
class CatalogIngredient:
    product_ingredient_id: int
    extra_price: Decimal
    default: int
    max: int
    removable: bool


@dataclass
class CatalogProduct:
    id: int
    name: str
    price: Decimal
    allow_customization: bool = True
    is_available: bool = True
    publish_status: str = "active"
    #: None = stock is not tracked.
    stock: int | None = None
    ingredients: list[CatalogIngredient] = field(default_factory=list)

    @property
    def orderable(self) -> bool:
        return (
            self.is_available
            and self.publish_status == "active"
            and (self.stock is None or self.stock > 0)
        )


@dataclass
class PromoRecord:
    id: int
    code: str
    status: int = 1
    percent_off: Decimal | None = None
    amount_off: Decimal | None = None
    min_subtotal: Decimal | None = None
    first_order_only: bool = False
    max_redemptions: int | None = None
    times_redeemed: int = 0
    starts_at: datetime | None = None
    expires_at: datetime | None = None

    def as_rule(self) -> dict:
        return {
            "status": self.status,
            "percent_off": self.percent_off,
            "amount_off": self.amount_off,
            "min_subtotal": self.min_subtotal,
            "first_order_only": self.first_order_only,
            "max_redemptions": self.max_redemptions,
            "times_redeemed": self.times_redeemed,
            "starts_at": self.starts_at,
            "expires_at": self.expires_at,
        }


class PaymentGateway(Protocol):
    def create_payment_intent(
        self, *, amount_cents: int, currency: str, order_id: int, idempotency_key: str
    ) -> PaymentIntentResult: ...

    def create_refund(
        self, *, payment_intent_id: str, amount_cents: int, idempotency_key: str
    ) -> RefundResult: ...

    def parse_webhook(self, payload: bytes, signature: str) -> dict:
        """Verify the signature and return the event as a plain dict (raises AppError)."""
        ...


class CatalogRepository(Protocol):
    def get_products(self, product_ids: list[int]) -> dict[int, CatalogProduct]: ...

    def get_promo(self, code: str) -> PromoRecord | None: ...

    def has_prior_order(self, user_id: int) -> bool:
        """True when the user already has a paid or completed order (first-order promos)."""
        ...


class OrderRepository(Protocol):
    def create_order(self, draft: dict) -> OrderRecord:
        """Insert the order (status/payment fields from ``draft``) with its lines and a
        first Order_Status_History row. Returns the stored record."""
        ...

    def get_order(self, order_id: int) -> OrderRecord | None: ...

    def save_payment_intent(self, order_id: int, intent_id: str) -> None: ...

    def claim_stripe_event(self, event_id: str, event_type: str, order_id: int | None) -> bool:
        """Insert into Stripe_Events. False when the id already exists (duplicate delivery)."""
        ...

    def release_stripe_event(self, event_id: str) -> None:
        """Undo ``claim_stripe_event`` so Stripe's retry can reprocess after a failure."""
        ...

    def mark_paid(self, order_id: int, *, intent_id: str, amount: Decimal) -> None:
        """Atomically: Payments charge row, payment_status=paid, status pending_payment ->
        received (+ history row by the system), decrement stock and Times_Redeemed."""
        ...

    def mark_payment_failed(self, order_id: int, intent_id: str) -> None: ...

    def mark_cancelled(
        self, order_id: int, *, actor_user_id: int | None, reason: str | None
    ) -> None:
        """status -> cancelled (+ history row), restore stock."""
        ...

    def record_late_payment_refunded(
        self, order_id: int, *, intent_id: str, refund_id: str, amount: Decimal
    ) -> None:
        """A payment arrived for an already-cancelled order and was refunded straight away:
        write the charge and refund Payments rows, payment_status=refunded."""
        ...

    def record_refund(self, order_id: int, *, refund_id: str, amount: Decimal, full: bool) -> None:
        """Payments refund row; payment_status=refunded when ``full``."""
        ...

    def total_refunded(self, order_id: int) -> Decimal: ...


@dataclass
class UserRecord:
    id: int
    name: str
    lastname: str
    email: str
    role: str
    status: int = 1  # 1 = alive, 0 = soft-deleted
    google_sub: str | None = None
    auth_provider: str = "password"


class GoogleVerifier(Protocol):
    def verify(self, id_token: str) -> dict:
        """Return the verified claims of a Google ID token or raise AppError (401)."""
        ...


class UserRepository(Protocol):
    def find_by_google_sub(self, google_sub: str) -> UserRecord | None: ...

    def find_by_email(self, email: str) -> UserRecord | None: ...

    def create_google_user(
        self, *, email: str, name: str, lastname: str, google_sub: str, avatar_url: str | None
    ) -> UserRecord:
        """Insert a customer with auth_provider=google and no password."""
        ...

    def link_google(
        self, user_id: int, *, google_sub: str, avatar_url: str | None
    ) -> UserRecord: ...

    def touch_login(self, user_id: int) -> None:
        """Set last_login_at."""
        ...

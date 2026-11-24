"""Customer-facing reads: store info, menu, product detail, the customer's own orders."""

from collections.abc import Callable
from datetime import UTC, datetime

from backend.config import Config
from backend.errors import RecordNotFoundException, ValidationError
from backend.store_hours import parse_hours


def _utcnow() -> datetime:
    return datetime.now(UTC)


class PublicService:
    def __init__(
        self, repo, config: Config, payments_enabled: bool, clock: Callable[[], datetime] = _utcnow
    ):
        self._repo = repo
        self._config = config
        self._payments_enabled = payments_enabled
        self._clock = clock
        self._hours = parse_hours(config.store_hours, config.store_timezone)

    def store(self) -> dict:
        return {
            "name": self._config.store_name,
            "address": self._config.store_address,
            "timezone": self._config.store_timezone,
            "currency": self._config.currency,
            "isOpen": self._hours.is_open(self._clock()),
            "paymentsEnabled": self._payments_enabled,
            "opensAt": self._hours.opens.strftime("%H:%M"),
            "closesAt": self._hours.closes.strftime("%H:%M"),
            "waitMinutes": self._repo.store_wait(),
        }

    def menu(self, lang: str) -> list[dict]:
        return self._repo.menu(lang)

    def product(self, product_id: int, lang: str) -> dict:
        product = self._repo.product_detail(product_id, lang)
        if product is None:
            raise RecordNotFoundException(f"Product {product_id} not found.")
        return product

    def my_orders(self, user_id: int, group: str | None, page: int, page_size: int, lang: str):
        if group not in (None, "", "all", "active", "completed", "cancelled"):
            raise ValidationError("Unknown status filter.", error_code="ORDER_STATUS_INVALID")
        return self._repo.my_orders(
            user_id, group or None, max(1, page), min(max(1, page_size), 50), lang
        )

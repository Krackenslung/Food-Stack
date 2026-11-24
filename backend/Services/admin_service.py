"""Kitchen board, admin order/product management and the dashboard.

Rules (state machine, validation) live here; SQL lives in ``Infrastructure/sql_admin.py`` and the
order writes in the order repository. Controllers only parse input and shape the envelope.
"""

import re
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal

from backend.errors import AppError, RecordNotFoundException, ValidationError
from backend.Services import order_service as orders
from backend.Services.payment_service import PaymentService

MONEY = re.compile(r"^\d+(\.\d{1,2})?$")
RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
KITCHEN_COLUMNS = ("received", "preparing", "ready", "completed")
COMPLETED_SHOWN = 6


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AdminService:
    def __init__(
        self,
        admin_repo,
        order_repo,
        payments: PaymentService | None,
        storage=None,
        clock: Callable[[], datetime] = _utcnow,
    ):
        self._admin = admin_repo
        self._orders = order_repo
        self._payments = payments
        self._storage = storage
        self._clock = clock

    # ---- kitchen --------------------------------------------------------------------------

    def kitchen(self, lang: str) -> dict:
        now = self._clock()
        columns: dict[str, list] = {key: [] for key in KITCHEN_COLUMNS}
        delayed = 0
        for ticket in self._admin.kitchen_orders(lang, now):
            status = orders.normalize_status(ticket["status"])
            ticket["status"] = status
            age_minutes = (now - datetime.fromisoformat(ticket["createdAt"])).total_seconds() / 60
            ticket["delayed"] = (
                status in ("received", "preparing") and age_minutes > ticket["targetMinutes"]
            )
            delayed += int(ticket["delayed"])
            columns[status].append(ticket)
        columns["completed"] = columns["completed"][-COMPLETED_SHOWN:]
        active = sum(len(columns[key]) for key in ("received", "preparing", "ready"))
        prep = self._admin.avg_prep_seconds(now.replace(hour=0, minute=0, second=0, microsecond=0))
        return {
            "columns": columns,
            "stats": {"active": active, "avgPrepSeconds": prep or 0, "delayed": delayed},
        }

    def set_status(self, order_id: int, target: str, actor_role: str, actor_id: int) -> dict:
        order = self._orders.get_order(order_id)
        if order is None:
            raise RecordNotFoundException(f"Order {order_id} not found.")
        target = orders.validate_transition(order.status, target, actor_role)
        if target == orders.CANCELLED:
            # Goes through the payment service so a paid card order is refunded automatically.
            if self._payments is None:
                self._orders.change_status(order_id, target, actor_user_id=actor_id)
            else:
                self._payments.cancel_order(order_id, actor_role, actor_id, None)
        else:
            self._orders.change_status(order_id, target, actor_user_id=actor_id)
        return {"status": target}

    # ---- orders ---------------------------------------------------------------------------

    def orders_page(self, status, page, page_size, lang) -> dict:
        if status not in (None, "", "all", *orders.ORDER_STATUSES):
            raise ValidationError("Unknown status filter.", error_code="ORDER_STATUS_INVALID")
        return self._admin.orders_page(
            status or None, max(1, page), min(max(1, page_size), 100), lang
        )

    def order_detail(self, order_id: int, lang: str, viewer_id: int, viewer_role: str) -> dict:
        detail = self._admin.order_detail(order_id, lang)
        if detail is None:
            raise RecordNotFoundException(f"Order {order_id} not found.")
        if viewer_role == "customer" and detail["userId"] != viewer_id:
            raise RecordNotFoundException(f"Order {order_id} not found.")
        del detail["userId"]
        if detail["status"] in ("received", "preparing"):
            detail["eta"] = self._eta(order_id, detail["createdAt"], lang)
        return detail

    def _eta(self, order_id: int, created_at: str, lang: str) -> dict | None:
        lines = self._admin.lines_for([order_id], lang)[order_id]
        targets = [self._admin.prep_max(line["productId"]) for line in lines]
        minutes = orders.estimate_ready_minutes(targets, self._admin.count_status("preparing"))
        created = datetime.fromisoformat(created_at)
        ready_at = created.timestamp() + minutes * 60
        return {
            "minutes": max(0, int(minutes - (self._clock() - created).total_seconds() // 60)),
            "readyAt": datetime.fromtimestamp(ready_at, UTC).isoformat().replace("+00:00", "Z"),
        }

    # ---- dashboard ------------------------------------------------------------------------

    def dashboard(self, range_key: str, lang: str) -> dict:
        days = RANGE_DAYS.get(range_key or "7d")
        if days is None:
            raise ValidationError("Unknown range.", error_code="RANGE_INVALID")
        data = self._admin.dashboard(days, lang, self._clock())
        data["range"] = range_key or "7d"
        return data

    # ---- products -------------------------------------------------------------------------

    def products_page(self, category, q, page, page_size, lang) -> dict:
        return self._admin.products_page(
            category, (q or "").strip() or None, max(1, page), min(max(1, page_size), 100), lang
        )

    def ingredients(self, lang: str) -> list[dict]:
        return self._admin.ingredients(lang)

    def get_product(self, product_id: int) -> dict:
        product = self._admin.product(product_id)
        if product is None:
            raise RecordNotFoundException(f"Product {product_id} not found.")
        return product

    def save_product(self, product_id: int | None, body: dict) -> dict:
        data = self._validate_product(body)
        saved_id = self._admin.save_product(product_id, data)
        return self.get_product(saved_id)

    def set_available(self, product_id: int, value) -> dict:
        if not isinstance(value, bool):
            raise ValidationError(
                "isAvailable must be true or false.", error_code="VALIDATION_ERROR"
            )
        self._admin.set_available(product_id, value)
        return {"isAvailable": value}

    def delete_product(self, product_id: int) -> dict:
        self._admin.soft_delete(product_id)
        return {"deleted": True}

    def upload_image(self, product_id: int, data: bytes, content_type: str) -> dict:
        if self._storage is None:
            raise AppError(
                "Image storage is not configured.",
                error_code="STORAGE_NOT_CONFIGURED",
                http_status=503,
            )
        if content_type not in ("image/png", "image/jpeg"):
            raise ValidationError("Use a PNG or JPG image.", error_code="IMAGE_TYPE_INVALID")
        if not data:
            raise ValidationError("An image file is required.", error_code="IMAGE_REQUIRED")
        if len(data) > MAX_IMAGE_BYTES:
            raise ValidationError("The image is too large.", error_code="IMAGE_TOO_LARGE")
        self.get_product(product_id)  # 404 before storing anything
        url = self._storage.upload_image(product_id, data, content_type)
        self._admin.set_image(product_id, url)
        return {"imageUrl": url}

    @staticmethod
    def _validate_product(body: dict) -> dict:
        """The editor validates too, but the API never trusts it."""

        def fail(message, code):
            raise ValidationError(message, error_code=code)

        translations = body.get("translations") or {}
        clean = {}
        for lang in ("en", "es"):
            text = translations.get(lang) or {}
            name = str(text.get("name") or "").strip()
            description = str(text.get("description") or "").strip()
            if not name:
                fail("Name is required in both languages.", "PRODUCT_NAME_REQUIRED")
            if len(description) > 240:
                fail("Description is too long.", "DESCRIPTION_TOO_LONG")
            clean[lang] = {"name": name, "description": description}

        price, cost = str(body.get("price", "")), str(body.get("cost", ""))
        if not MONEY.match(price) or Decimal(price) <= 0:
            fail("Price must be a positive amount.", "PRICE_INVALID")
        if not MONEY.match(cost):
            fail("Cost must be an amount.", "COST_INVALID")

        def whole(key, *, nullable=False, minimum=0):
            value = body.get(key)
            if value is None and nullable:
                return None
            if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
                fail(f"{key} must be a whole number.", "STOCK_INVALID")
            return value

        stock = whole("stock", nullable=True)
        low = whole("lowStockThreshold")
        prep_min, prep_max = whole("prepTimeMin"), whole("prepTimeMax")
        if prep_min > prep_max:
            fail("Prep time range is invalid.", "PREP_TIME_INVALID")
        calories = whole("calories", nullable=True)

        publish = body.get("publishStatus")
        if publish not in ("active", "draft"):
            fail("publishStatus must be active or draft.", "VALIDATION_ERROR")
        category_id = body.get("categoryId")
        if isinstance(category_id, bool) or not isinstance(category_id, int):
            fail("Unknown category.", "CATEGORY_INVALID")

        rows = []
        seen = set()
        for row in body.get("ingredients") or []:
            ingredient_id = row.get("ingredientId")
            default, maximum = row.get("default"), row.get("max")
            extra = str(row.get("extraPrice", ""))
            if (
                not isinstance(ingredient_id, int)
                or not isinstance(default, int)
                or not isinstance(maximum, int)
                or default < 0
                or maximum < 1
                or default > maximum
                or not MONEY.match(extra)
            ):
                fail("Ingredient limits are invalid.", "INGREDIENT_RULE_INVALID")
            if ingredient_id in seen:
                fail("An ingredient can only be listed once.", "INGREDIENT_RULE_INVALID")
            seen.add(ingredient_id)
            rows.append(
                {
                    "id": row.get("id") if isinstance(row.get("id"), int) else None,
                    "ingredientId": ingredient_id,
                    "default": default,
                    "max": maximum,
                    "extraPrice": Decimal(extra).quantize(Decimal("0.01")),
                    "removable": bool(row.get("removable", True)),
                }
            )

        return {
            "categoryId": category_id,
            "price": Decimal(price).quantize(Decimal("0.01")),
            "cost": Decimal(cost).quantize(Decimal("0.01")),
            "stock": stock,
            "lowStockThreshold": low,
            "prepTimeMin": prep_min,
            "prepTimeMax": prep_max,
            "calories": calories,
            "isAvailable": bool(body.get("isAvailable")),
            "isFeatured": bool(body.get("isFeatured")),
            "allowCustomization": bool(body.get("allowCustomization", True)),
            "publishStatus": publish,
            "translations": clean,
            "ingredients": rows,
        }

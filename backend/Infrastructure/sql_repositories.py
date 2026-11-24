"""SQL Server implementations of the repository Protocols in ``Services/ports.py``.

Raw parameterized SQL over pyodbc, one connection per call (same as the legacy models). Every
write that touches more than one table runs in a single transaction. ``connect`` is injectable
so the integration tests can point the repositories at a scratch database.
"""

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from decimal import Decimal

import pyodbc

from backend.errors import ConflictError
from backend.Infrastructure.SQLServerConnection import SQLServerConnection
from backend.Services.ports import (
    CatalogIngredient,
    CatalogProduct,
    OrderRecord,
    PromoRecord,
    UserRecord,
)

Connect = Callable[[], pyodbc.Connection]

DUPLICATE_KEY = ("2627", "2601")  # unique constraint / unique index violations


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


class _Base:
    def __init__(self, connect: Connect = SQLServerConnection.get_connection):
        self._connect = connect

    @contextmanager
    def _tx(self) -> Iterator[pyodbc.Cursor]:
        """One transaction: commit on success, roll back on any error."""
        conn = self._connect()
        try:
            cursor = conn.cursor()
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _query(self, sql: str, *params) -> list:
        conn = self._connect()
        try:
            return conn.cursor().execute(sql, *params).fetchall()
        finally:
            conn.close()


# ---- catalog --------------------------------------------------------------------------------


class SqlCatalogRepository(_Base):
    def get_products(self, product_ids: list[int]) -> dict[int, CatalogProduct]:
        ids = sorted({int(i) for i in product_ids})
        if not ids:
            return {}
        marks = ",".join("?" for _ in ids)
        products: dict[int, CatalogProduct] = {}
        for row in self._query(
            f"SELECT Id, Name, Price, Allow_Customization, Is_Available, Publish_Status, Stock "
            f"FROM dbo.Products WHERE Status = 1 AND Id IN ({marks})",
            *ids,
        ):
            products[row.Id] = CatalogProduct(
                id=row.Id,
                name=row.Name,
                price=_money(row.Price),
                allow_customization=bool(row.Allow_Customization),
                is_available=bool(row.Is_Available),
                publish_status=row.Publish_Status,
                stock=row.Stock,
            )
        if products:
            marks = ",".join("?" for _ in products)
            for row in self._query(
                f"SELECT pi.Id, pi.Product_Id, pi.Default_Ingredients, pi.Max_Ingredients, "
                f"pi.Is_Removable, i.Extra_Price FROM dbo.Product_Ingredients pi "
                f"JOIN dbo.Ingredients i ON i.Id = pi.Ingredient_Id "
                f"WHERE pi.Status = 1 AND i.Status = 1 AND pi.Product_Id IN ({marks}) "
                f"ORDER BY pi.Sort_Order, pi.Id",
                *products,
            ):
                products[row.Product_Id].ingredients.append(
                    CatalogIngredient(
                        product_ingredient_id=row.Id,
                        extra_price=_money(row.Extra_Price),
                        default=row.Default_Ingredients,
                        max=row.Max_Ingredients,
                        removable=bool(row.Is_Removable),
                    )
                )
        return products

    def get_promo(self, code: str) -> PromoRecord | None:
        rows = self._query(
            "SELECT Id, Code, Status, Percent_Off, Amount_Off, Min_Subtotal, First_Order_Only, "
            "Max_Redemptions, Times_Redeemed, Starts_At, Expires_At "
            "FROM dbo.Promo_Codes WHERE Code = ?",
            code,
        )
        if not rows:
            return None
        r = rows[0]
        return PromoRecord(
            id=r.Id,
            code=r.Code,
            status=int(r.Status),
            percent_off=None if r.Percent_Off is None else Decimal(str(r.Percent_Off)),
            amount_off=None if r.Amount_Off is None else _money(r.Amount_Off),
            min_subtotal=None if r.Min_Subtotal is None else _money(r.Min_Subtotal),
            first_order_only=bool(r.First_Order_Only),
            max_redemptions=r.Max_Redemptions,
            times_redeemed=r.Times_Redeemed,
            starts_at=r.Starts_At,
            expires_at=r.Expires_At,
        )

    def has_prior_order(self, user_id: int) -> bool:
        rows = self._query(
            "SELECT TOP 1 1 FROM dbo.Orders WHERE User_Id = ? "
            "AND (Payment_Status = 'paid' OR Status = 'completed')",
            user_id,
        )
        return bool(rows)


# ---- orders ---------------------------------------------------------------------------------


def _record(row) -> OrderRecord:
    return OrderRecord(
        id=row.Id,
        user_id=row.User_Id,
        total=_money(row.Total),
        currency=row.Currency,
        status=row.Status,
        payment_status=row.Payment_Status,
        payment_method=row.Payment_Method,
        stripe_payment_intent_id=row.Stripe_Payment_Intent_Id,
        promo_code_id=row.Promo_Code_Id,
    )


ORDER_COLUMNS = (
    "Id, User_Id, Total, Currency, Status, Payment_Status, Payment_Method, "
    "Stripe_Payment_Intent_Id, Promo_Code_Id"
)


class SqlOrderRepository(_Base):
    # ---- reads ----
    def get_order(self, order_id: int) -> OrderRecord | None:
        rows = self._query(f"SELECT {ORDER_COLUMNS} FROM dbo.Orders WHERE Id = ?", order_id)
        return _record(rows[0]) if rows else None

    def total_refunded(self, order_id: int) -> Decimal:
        rows = self._query(
            "SELECT COALESCE(SUM(Amount), 0) FROM dbo.Payments "
            "WHERE Order_Id = ? AND Kind = 'refund' AND Payment_State = 'succeeded'",
            order_id,
        )
        return _money(rows[0][0])

    # ---- create ----
    def create_order(self, draft: dict) -> OrderRecord:
        quote = draft["quote"]
        contact = draft["contact"]
        with self._tx() as cur:
            order_id = cur.execute(
                "INSERT INTO dbo.Orders (User_Id, Total, Status, Payment_Status, Payment_Method, "
                "Fulfillment_Type, Contact_Name, Contact_Phone, Contact_Email, Delivery_Address, "
                "Scheduled_For, Currency, Subtotal, Discount, Service_Fee, Delivery_Fee, Tax, "
                "Promo_Code_Id) OUTPUT INSERTED.Id "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                draft["user_id"],
                quote.total,
                draft["status"],
                draft["payment_status"],
                draft["payment_method"],
                draft["fulfillment_type"],
                contact["name"],
                contact["phone"],
                contact["email"],
                draft["delivery_address"],
                None
                if draft["scheduled_for"] is None
                else draft["scheduled_for"].replace(tzinfo=None),
                draft["currency"],
                quote.subtotal,
                quote.discount,
                quote.service_fee,
                quote.delivery_fee,
                quote.tax,
                draft["promo_code_id"],
            ).fetchone()[0]

            for item in draft["items"]:
                line_id = cur.execute(
                    "INSERT INTO dbo.Order_Products (Order_Id, Product_Id, Quantity, Price, Notes) "
                    "OUTPUT INSERTED.Id VALUES (?,?,?,?,?)",
                    order_id,
                    item["product_id"],
                    item["quantity"],
                    item["unit_price"],
                    item.get("notes") or None,
                ).fetchone()[0]
                for choice in item["ingredients"]:
                    cur.execute(
                        "INSERT INTO dbo.Order_Product_Ingredients (Order_Product_Id, "
                        "Product_Ingredient_Id, Quantity, Unit_Extra_Price) VALUES (?,?,?,?)",
                        line_id,
                        choice["product_ingredient_id"],
                        choice["quantity"],
                        choice["extra_price"],
                    )

            self._history(cur, order_id, None, draft["status"], draft["user_id"])
            if draft["consume_on_create"]:
                self._consume(cur, order_id)
            row = cur.execute(
                f"SELECT {ORDER_COLUMNS} FROM dbo.Orders WHERE Id = ?", order_id
            ).fetchone()
            return _record(row)

    def save_payment_intent(self, order_id: int, intent_id: str) -> None:
        with self._tx() as cur:
            cur.execute(
                "UPDATE dbo.Orders SET Stripe_Payment_Intent_Id = ?, Updated_At = SYSUTCDATETIME() "
                "WHERE Id = ?",
                intent_id,
                order_id,
            )

    # ---- webhook idempotency ----
    def claim_stripe_event(self, event_id: str, event_type: str, order_id: int | None) -> bool:
        conn = self._connect()
        try:
            conn.cursor().execute(
                "INSERT INTO dbo.Stripe_Events (Event_Id, Type, Order_Id) VALUES (?,?,?)",
                event_id,
                event_type,
                order_id,
            )
            conn.commit()
            return True
        except pyodbc.IntegrityError:
            conn.rollback()
            return False
        finally:
            conn.close()

    def release_stripe_event(self, event_id: str) -> None:
        with self._tx() as cur:
            cur.execute("DELETE FROM dbo.Stripe_Events WHERE Event_Id = ?", event_id)

    # ---- payment outcomes ----
    def mark_paid(self, order_id: int, *, intent_id: str, amount: Decimal) -> None:
        with self._tx() as cur:
            current = cur.execute(
                "SELECT Status, Currency FROM dbo.Orders WITH (UPDLOCK) WHERE Id = ?", order_id
            ).fetchone()
            self._payment_row(cur, order_id, "charge", intent_id, amount, current.Currency)
            cur.execute(
                "UPDATE dbo.Orders SET Payment_Status = 'paid', Stripe_Payment_Intent_Id = ?, "
                "Updated_At = SYSUTCDATETIME() WHERE Id = ?",
                intent_id,
                order_id,
            )
            if current.Status == "pending_payment":
                cur.execute("UPDATE dbo.Orders SET Status = 'received' WHERE Id = ?", order_id)
                self._history(cur, order_id, "pending_payment", "received", None)
                self._consume(cur, order_id)

    def mark_payment_failed(self, order_id: int, intent_id: str) -> None:
        with self._tx() as cur:
            cur.execute(
                "UPDATE dbo.Orders SET Payment_Status = 'failed', Updated_At = SYSUTCDATETIME() "
                "WHERE Id = ? AND Payment_Status <> 'paid'",
                order_id,
            )

    def mark_cancelled(
        self, order_id: int, *, actor_user_id: int | None, reason: str | None
    ) -> None:
        with self._tx() as cur:
            current = cur.execute(
                "SELECT Status FROM dbo.Orders WITH (UPDLOCK) WHERE Id = ?", order_id
            ).fetchone()
            cur.execute(
                "UPDATE dbo.Orders SET Status = 'cancelled', Cancel_Reason = ?, "
                "Updated_At = SYSUTCDATETIME() WHERE Id = ?",
                reason,
                order_id,
            )
            self._history(cur, order_id, current.Status, "cancelled", actor_user_id, reason)
            self._restore(cur, order_id)

    def record_late_payment_refunded(
        self, order_id: int, *, intent_id: str, refund_id: str, amount: Decimal
    ) -> None:
        with self._tx() as cur:
            currency = (
                cur.execute("SELECT Currency FROM dbo.Orders WHERE Id = ?", order_id)
                .fetchone()
                .Currency
            )
            self._payment_row(cur, order_id, "charge", intent_id, amount, currency)
            self._payment_row(cur, order_id, "refund", refund_id, amount, currency)
            cur.execute(
                "UPDATE dbo.Orders SET Payment_Status = 'refunded', Stripe_Payment_Intent_Id = ?, "
                "Updated_At = SYSUTCDATETIME() WHERE Id = ?",
                intent_id,
                order_id,
            )

    def record_refund(self, order_id: int, *, refund_id: str, amount: Decimal, full: bool) -> None:
        with self._tx() as cur:
            currency = (
                cur.execute("SELECT Currency FROM dbo.Orders WHERE Id = ?", order_id)
                .fetchone()
                .Currency
            )
            self._payment_row(cur, order_id, "refund", refund_id, amount, currency)
            if full:
                cur.execute(
                    "UPDATE dbo.Orders SET Payment_Status = 'refunded', "
                    "Updated_At = SYSUTCDATETIME() WHERE Id = ?",
                    order_id,
                )

    # ---- status moves made by staff (used by the kitchen and the admin drawer) ----
    def change_status(
        self, order_id: int, target: str, *, actor_user_id: int | None, note: str | None = None
    ) -> str:
        """Set the status and write the history row. The caller has validated the transition."""
        with self._tx() as cur:
            current = cur.execute(
                "SELECT Status FROM dbo.Orders WITH (UPDLOCK) WHERE Id = ?", order_id
            ).fetchone()
            cur.execute(
                "UPDATE dbo.Orders SET Status = ?, Updated_At = SYSUTCDATETIME() WHERE Id = ?",
                target,
                order_id,
            )
            self._history(cur, order_id, current.Status, target, actor_user_id, note)
            if target == "cancelled":
                self._restore(cur, order_id)
            elif current.Status == "pending_payment" and target == "received":
                self._consume(cur, order_id)
            return current.Status

    # ---- helpers (all run inside the caller's transaction) ----
    @staticmethod
    def _history(cur, order_id, from_status, to_status, user_id, note=None) -> None:
        cur.execute(
            "INSERT INTO dbo.Order_Status_History (Order_Id, From_Status, To_Status, "
            "Changed_By_User_Id, Note) VALUES (?,?,?,?,?)",
            order_id,
            from_status,
            to_status,
            user_id,
            note,
        )

    @staticmethod
    def _payment_row(cur, order_id, kind, ref, amount, currency) -> None:
        cur.execute(
            "IF NOT EXISTS (SELECT 1 FROM dbo.Payments WHERE Provider_Ref = ? AND Kind = ?) "
            "INSERT INTO dbo.Payments (Order_Id, Kind, Provider, Provider_Ref, Amount, Currency) "
            "VALUES (?, ?, 'stripe', ?, ?, ?)",
            ref,
            kind,
            order_id,
            kind,
            ref,
            amount,
            currency,
        )

    @staticmethod
    def _consume(cur, order_id: int) -> None:
        """Decrement stock and count the promo redemption, once per order."""
        flag = cur.execute(
            "SELECT Stock_Consumed, Promo_Code_Id FROM dbo.Orders WITH (UPDLOCK) WHERE Id = ?",
            order_id,
        ).fetchone()
        if flag.Stock_Consumed:
            return
        lines = cur.execute(
            "SELECT Product_Id, SUM(Quantity) AS Qty FROM dbo.Order_Products "
            "WHERE Order_Id = ? GROUP BY Product_Id ORDER BY Product_Id",
            order_id,
        ).fetchall()
        for line in lines:
            stock = cur.execute(
                "SELECT Stock, Name FROM dbo.Products WITH (UPDLOCK) WHERE Id = ?", line.Product_Id
            ).fetchone()
            if stock.Stock is None:
                continue
            if stock.Stock < line.Qty:
                raise ConflictError(
                    f"Only {stock.Stock} of {stock.Name} left.", error_code="INSUFFICIENT_STOCK"
                )
            cur.execute(
                "UPDATE dbo.Products SET Stock = Stock - ?, Updated_At = SYSUTCDATETIME() "
                "WHERE Id = ?",
                line.Qty,
                line.Product_Id,
            )
        if flag.Promo_Code_Id is not None:
            cur.execute(
                "UPDATE dbo.Promo_Codes SET Times_Redeemed = Times_Redeemed + 1 WHERE Id = ?",
                flag.Promo_Code_Id,
            )
        cur.execute("UPDATE dbo.Orders SET Stock_Consumed = 1 WHERE Id = ?", order_id)

    @staticmethod
    def _restore(cur, order_id: int) -> None:
        flag = cur.execute(
            "SELECT Stock_Consumed FROM dbo.Orders WITH (UPDLOCK) WHERE Id = ?", order_id
        ).fetchone()
        if not flag.Stock_Consumed:
            return
        cur.execute(
            "UPDATE p SET p.Stock = p.Stock + l.Qty, p.Updated_At = SYSUTCDATETIME() "
            "FROM dbo.Products p JOIN (SELECT Product_Id, SUM(Quantity) AS Qty "
            "FROM dbo.Order_Products WHERE Order_Id = ? GROUP BY Product_Id) l "
            "ON l.Product_Id = p.Id WHERE p.Stock IS NOT NULL",
            order_id,
        )
        cur.execute("UPDATE dbo.Orders SET Stock_Consumed = 0 WHERE Id = ?", order_id)


# ---- users ----------------------------------------------------------------------------------


def _user(row) -> UserRecord:
    return UserRecord(
        id=row.id,
        name=row.name,
        lastname=row.lastname,
        email=row.email,
        role=row.role,
        status=int(row.status),
        google_sub=row.google_sub,
        auth_provider=row.auth_provider,
    )


USER_COLUMNS = "id, name, lastname, email, role, status, google_sub, auth_provider"


class SqlUserRepository(_Base):
    def find_by_google_sub(self, google_sub: str) -> UserRecord | None:
        rows = self._query(f"SELECT {USER_COLUMNS} FROM dbo.Users WHERE google_sub = ?", google_sub)
        return _user(rows[0]) if rows else None

    def find_by_email(self, email: str) -> UserRecord | None:
        rows = self._query(
            f"SELECT {USER_COLUMNS} FROM dbo.Users WHERE LOWER(email) = LOWER(?)", email
        )
        return _user(rows[0]) if rows else None

    def create_google_user(
        self, *, email: str, name: str, lastname: str, google_sub: str, avatar_url: str | None
    ) -> UserRecord:
        with self._tx() as cur:
            row = cur.execute(
                "INSERT INTO dbo.Users (name, lastname, email, password_hash, role, google_sub, "
                "auth_provider, avatar_url, status) OUTPUT INSERTED.id "
                "VALUES (?,?,?,NULL,'customer',?,'google',?,1)",
                name,
                lastname,
                email,
                google_sub,
                avatar_url,
            ).fetchone()
            return _user(
                cur.execute(f"SELECT {USER_COLUMNS} FROM dbo.Users WHERE id = ?", row[0]).fetchone()
            )

    def link_google(self, user_id: int, *, google_sub: str, avatar_url: str | None) -> UserRecord:
        with self._tx() as cur:
            cur.execute(
                "UPDATE dbo.Users SET google_sub = ?, avatar_url = COALESCE(?, avatar_url) "
                "WHERE id = ?",
                google_sub,
                avatar_url,
                user_id,
            )
            return _user(
                cur.execute(
                    f"SELECT {USER_COLUMNS} FROM dbo.Users WHERE id = ?", user_id
                ).fetchone()
            )

    def touch_login(self, user_id: int) -> None:
        with self._tx() as cur:
            cur.execute(
                "UPDATE dbo.Users SET last_login_at = SYSUTCDATETIME() WHERE id = ?", user_id
            )

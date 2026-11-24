"""Read models and product writes for the kitchen board and the admin back-office.

Returns plain dicts shaped like the API contract (camelCase). All times in the database are UTC
and leave here as ISO-8601 strings ending in ``Z``. Soft delete only: products are never removed.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from backend.errors import RecordNotFoundException, ValidationError
from backend.Infrastructure.sql_repositories import _Base

ACTIVE = ("received", "preparing", "ready")
ALL_STATUSES = ("pending_payment", "received", "preparing", "ready", "completed", "cancelled")
LANGS = ("en", "es")


def iso(value: datetime | None) -> str | None:
    return None if value is None else value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")


def money(value) -> str:
    return str(Decimal(str(value)).quantize(Decimal("0.01")))


def lang_of(lang: str | None) -> str:
    return lang if lang in LANGS else "en"


class SqlAdminRepository(_Base):
    # ---- order pieces ---------------------------------------------------------------------

    def lines_for(self, order_ids: list[int], lang: str) -> dict[int, list[dict]]:
        if not order_ids:
            return {}
        marks = ",".join("?" for _ in order_ids)
        lines: dict[int, list[dict]] = {i: [] for i in order_ids}
        by_line: dict[int, dict] = {}
        for r in self._query(
            f"SELECT op.Id, op.Order_Id, op.Product_Id, op.Quantity, op.Price, op.Notes, "
            f"COALESCE(pt.Name, p.Name) AS Name, p.Image, "
            f"op.Price * op.Quantity + COALESCE((SELECT SUM(opi.Quantity * opi.Unit_Extra_Price) "
            f"  FROM dbo.Order_Product_Ingredients opi JOIN dbo.Product_Ingredients pi "
            f"  ON pi.Id = opi.Product_Ingredient_Id WHERE opi.Order_Product_Id = op.Id "
            f"  AND opi.Quantity > pi.Default_Ingredients), 0) AS LineTotal "
            f"FROM dbo.Order_Products op JOIN dbo.Products p ON p.Id = op.Product_Id "
            f"LEFT JOIN dbo.Product_Translations pt ON pt.Product_Id = p.Id AND pt.Lang = ? "
            f"WHERE op.Order_Id IN ({marks}) ORDER BY op.Id",
            lang,
            *order_ids,
        ):
            line = {
                "id": r.Id,
                "productId": r.Product_Id,
                "name": r.Name,
                "image": r.Image or "",
                "quantity": r.Quantity,
                "unitPrice": money(r.Price),
                "lineTotal": money(r.LineTotal),
                "notes": r.Notes or "",
                "ingredients": [],
            }
            by_line[r.Id] = line
            lines[r.Order_Id].append(line)
        if by_line:
            marks = ",".join("?" for _ in by_line)
            for r in self._query(
                f"SELECT opi.Order_Product_Id, opi.Product_Ingredient_Id, opi.Quantity, "
                f"pi.Default_Ingredients, COALESCE(it.Name, i.Name) AS Name "
                f"FROM dbo.Order_Product_Ingredients opi "
                f"JOIN dbo.Product_Ingredients pi ON pi.Id = opi.Product_Ingredient_Id "
                f"JOIN dbo.Ingredients i ON i.Id = pi.Ingredient_Id "
                f"LEFT JOIN dbo.Ingredient_Translations it ON it.Ingredient_Id = i.Id AND it.Lang = ? "
                f"WHERE opi.Order_Product_Id IN ({marks}) ORDER BY pi.Sort_Order, pi.Id",
                lang,
                *by_line,
            ):
                by_line[r.Order_Product_Id]["ingredients"].append(
                    {
                        "productIngredientId": r.Product_Ingredient_Id,
                        "name": r.Name,
                        "default": r.Default_Ingredients,
                        "quantity": r.Quantity,
                    }
                )
        return lines

    def _summaries(self, rows, lang: str) -> list[dict]:
        ids = [r.Id for r in rows]
        lines = self.lines_for(ids, lang)
        out = []
        for r in rows:
            order_lines = lines[r.Id]
            out.append(
                {
                    "id": r.Id,
                    "orderNumber": r.Order_Number,
                    "status": r.Status,
                    "paymentStatus": r.Payment_Status,
                    "total": money(r.Total),
                    "createdAt": iso(r.Created_At),
                    "itemCount": sum(line["quantity"] for line in order_lines),
                    "items": [
                        {"name": x["name"], "image": x["image"], "quantity": x["quantity"]}
                        for x in order_lines[:3]
                    ],
                    "customerName": r.Contact_Name or "",
                    "fulfillmentType": r.Fulfillment_Type,
                    "paymentMethod": r.Payment_Method,
                }
            )
        return out

    ORDER_ROW = (
        "Id, Order_Number, Status, Payment_Status, Payment_Method, Fulfillment_Type, Total, "
        "Contact_Name, Created_At"
    )

    # ---- kitchen --------------------------------------------------------------------------

    def kitchen_orders(self, lang: str, now: datetime) -> list[dict]:
        today = now.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        rows = self._query(
            "SELECT o.Id, o.Order_Number, o.Status, o.Fulfillment_Type, o.Contact_Name, "
            "o.Created_At, "
            "COALESCE((SELECT MAX(h.Created_At) FROM dbo.Order_Status_History h "
            "  WHERE h.Order_Id = o.Id AND h.To_Status = o.Status), o.Created_At) AS Since, "
            "COALESCE((SELECT MAX(p.Prep_Time_Max) FROM dbo.Order_Products op "
            "  JOIN dbo.Products p ON p.Id = op.Product_Id WHERE op.Order_Id = o.Id), 0) AS Target "
            "FROM dbo.Orders o WHERE o.Status IN ('received','preparing','ready') "
            "OR (o.Status = 'completed' AND o.Updated_At >= ?) ORDER BY o.Created_At",
            today,
        )
        lines = self.lines_for([r.Id for r in rows], lang)
        return [
            {
                "id": r.Id,
                "orderNumber": r.Order_Number,
                "status": r.Status,
                "fulfillmentType": r.Fulfillment_Type,
                "customerName": r.Contact_Name or "",
                "createdAt": iso(r.Created_At),
                "statusSince": iso(r.Since),
                "targetMinutes": r.Target,
                "lines": lines[r.Id],
            }
            for r in rows
        ]

    def prep_max(self, product_id: int) -> int:
        rows = self._query("SELECT Prep_Time_Max FROM dbo.Products WHERE Id = ?", product_id)
        return rows[0][0] if rows else 0

    def count_status(self, status: str) -> int:
        return self._query("SELECT COUNT(*) FROM dbo.Orders WHERE Status = ?", status)[0][0]

    def avg_prep_seconds(self, since: datetime) -> int | None:
        row = self._query(
            "SELECT AVG(CAST(DATEDIFF(SECOND, r.Created_At, d.Created_At) AS FLOAT)) "
            "FROM dbo.Order_Status_History r JOIN dbo.Order_Status_History d "
            "ON d.Order_Id = r.Order_Id AND d.To_Status = 'ready' "
            "WHERE r.To_Status = 'received' AND d.Created_At >= ?",
            since.replace(tzinfo=None),
        )[0][0]
        return None if row is None else int(row)

    # ---- admin orders ---------------------------------------------------------------------

    def orders_page(self, status: str | None, page: int, page_size: int, lang: str) -> dict:
        counts = {s: 0 for s in ALL_STATUSES}
        for r in self._query("SELECT Status, COUNT(*) AS N FROM dbo.Orders GROUP BY Status"):
            key = "received" if r.Status == "pending" else r.Status
            counts[key] = counts.get(key, 0) + r.N
        counts["all"] = sum(counts.values())

        where, params = ("", [])
        if status and status != "all":
            where, params = ("WHERE Status = ?", [status])
        total = self._query(f"SELECT COUNT(*) FROM dbo.Orders {where}", *params)[0][0]
        rows = self._query(
            f"SELECT {self.ORDER_ROW} FROM dbo.Orders {where} ORDER BY Created_At DESC, Id DESC "
            f"OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            *params,
            (page - 1) * page_size,
            page_size,
        )
        return {
            "items": self._summaries(rows, lang),
            "page": page,
            "pageSize": page_size,
            "total": total,
            "counts": counts,
        }

    def order_detail(self, order_id: int, lang: str) -> dict | None:
        rows = self._query(
            "SELECT o.*, pc.Code AS Promo FROM dbo.Orders o "
            "LEFT JOIN dbo.Promo_Codes pc ON pc.Id = o.Promo_Code_Id WHERE o.Id = ?",
            order_id,
        )
        if not rows:
            return None
        r = rows[0]
        lines = self.lines_for([order_id], lang)[order_id]
        history = self._query(
            "SELECT From_Status, To_Status, Created_At FROM dbo.Order_Status_History "
            "WHERE Order_Id = ? ORDER BY Created_At, Id",
            order_id,
        )
        return {
            "id": r.Id,
            "orderNumber": r.Order_Number,
            "status": r.Status,
            "paymentStatus": r.Payment_Status,
            "paymentMethod": r.Payment_Method,
            "fulfillmentType": r.Fulfillment_Type,
            "total": money(r.Total),
            "subtotal": money(r.Subtotal),
            "discount": money(r.Discount),
            "serviceFee": money(r.Service_Fee),
            "deliveryFee": money(r.Delivery_Fee),
            "tax": money(r.Tax),
            "promoCode": r.Promo,
            "createdAt": iso(r.Created_At),
            "itemCount": sum(line["quantity"] for line in lines),
            "contact": {
                "name": r.Contact_Name or "",
                "phone": r.Contact_Phone or "",
                "email": r.Contact_Email or "",
            },
            "deliveryAddress": r.Delivery_Address,
            "scheduledFor": iso(r.Scheduled_For),
            "lines": lines,
            "history": [
                {
                    "fromStatus": h.From_Status,
                    "toStatus": h.To_Status,
                    "createdAt": iso(h.Created_At),
                }
                for h in history
            ],
            "eta": None,
            "userId": r.User_Id,
        }

    # ---- dashboard ------------------------------------------------------------------------

    def dashboard(self, days: int, lang: str, now: datetime) -> dict:
        start = (now - timedelta(days=days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
        )
        prev_start = start - timedelta(days=days)
        valid = "Status NOT IN ('cancelled', 'pending_payment')"

        def period(a, b):
            row = self._query(
                f"SELECT COALESCE(SUM(Total), 0), COUNT(*) FROM dbo.Orders "
                f"WHERE {valid} AND Created_At >= ? AND Created_At < ?",
                a,
                b,
            )[0]
            return Decimal(str(row[0])), int(row[1])

        revenue, orders = period(start, now.replace(tzinfo=None) + timedelta(days=1))
        prev_revenue, prev_orders = period(prev_start, start)

        def delta(cur, prev):
            return 0.0 if not prev else round((float(cur) - float(prev)) / float(prev) * 100, 1)

        per_day = {
            r.Day: (Decimal(str(r.Revenue)), r.N)
            for r in self._query(
                f"SELECT CAST(Created_At AS DATE) AS Day, SUM(Total) AS Revenue, COUNT(*) AS N "
                f"FROM dbo.Orders WHERE {valid} AND Created_At >= ? GROUP BY CAST(Created_At AS DATE)",
                start,
            )
        }
        series = []
        for i in range(days):
            day = (start + timedelta(days=i)).date()
            rev, n = per_day.get(day, (Decimal("0"), 0))
            series.append({"date": day.isoformat(), "revenue": money(rev), "orders": n})

        best = self._query(
            f"SELECT TOP 5 p.Id, COALESCE(pt.Name, p.Name) AS Name, p.Image, "
            f"SUM(op.Quantity) AS Sold, SUM(op.Quantity * op.Price) AS Revenue "
            f"FROM dbo.Order_Products op JOIN dbo.Orders o ON o.Id = op.Order_Id "
            f"JOIN dbo.Products p ON p.Id = op.Product_Id "
            f"LEFT JOIN dbo.Product_Translations pt ON pt.Product_Id = p.Id AND pt.Lang = ? "
            f"WHERE o.{valid} AND o.Created_At >= ? "
            f"GROUP BY p.Id, pt.Name, p.Name, p.Image ORDER BY Sold DESC",
            lang,
            start,
        )
        recent = self._query(
            f"SELECT TOP 5 {self.ORDER_ROW} FROM dbo.Orders ORDER BY Created_At DESC, Id DESC"
        )
        prep = self.avg_prep_seconds(datetime.combine(start, datetime.min.time(), UTC)) or 0
        prev_prep = (
            self.avg_prep_seconds(datetime.combine(prev_start, datetime.min.time(), UTC)) or prep
        )
        in_kitchen = self._query(
            "SELECT COUNT(*) FROM dbo.Orders WHERE Status IN ('received', 'preparing')"
        )[0][0]
        avg_ticket = (revenue / orders) if orders else Decimal("0")
        prev_ticket = (prev_revenue / prev_orders) if prev_orders else Decimal("0")
        return {
            "kpis": {
                "revenue": {"value": money(revenue), "deltaPct": delta(revenue, prev_revenue)},
                "orders": {"value": str(orders), "deltaPct": delta(orders, prev_orders)},
                "avgTicket": {
                    "value": money(avg_ticket),
                    "deltaPct": delta(avg_ticket, prev_ticket),
                },
                "avgPrepSeconds": {"value": prep, "deltaSeconds": prep - prev_prep},
            },
            "revenueTotal": money(revenue),
            "revenueDeltaPct": delta(revenue, prev_revenue),
            "series": series,
            "bestSellers": [
                {
                    "productId": b.Id,
                    "name": b.Name,
                    "image": b.Image or "",
                    "sold": b.Sold,
                    "revenue": money(b.Revenue),
                }
                for b in best
            ],
            "recentOrders": self._summaries(recent, lang),
            "ordersInKitchen": in_kitchen,
        }

    # ---- products -------------------------------------------------------------------------

    def ingredients(self, lang: str) -> list[dict]:
        return [
            {"id": r.Id, "name": r.Name}
            for r in self._query(
                "SELECT i.Id, COALESCE(it.Name, i.Name) AS Name FROM dbo.Ingredients i "
                "LEFT JOIN dbo.Ingredient_Translations it ON it.Ingredient_Id = i.Id AND it.Lang = ? "
                "WHERE i.Status = 1 ORDER BY Name",
                lang,
            )
        ]

    def products_page(
        self, category: str | None, q: str | None, page: int, page_size: int, lang: str
    ) -> dict:
        where = ["p.Status = 1", "c.Status = 1"]
        params: list = [lang, lang]
        if category and category != "all":
            where.append("c.Slug = ?")
            params.append(category)
        if q:
            where.append(
                "(p.Name LIKE ? OR p.Sku LIKE ? OR EXISTS (SELECT 1 FROM "
                "dbo.Product_Translations x WHERE x.Product_Id = p.Id AND x.Name LIKE ?))"
            )
            like = f"%{q}%"
            params += [like, like, like]
        clause = " AND ".join(where)
        base = (
            "FROM dbo.Products p JOIN dbo.Categories c ON c.Id = p.Category_Id "
            "LEFT JOIN dbo.Product_Translations pt ON pt.Product_Id = p.Id AND pt.Lang = ? "
            "LEFT JOIN dbo.Category_Translations ct ON ct.Category_Id = c.Id AND ct.Lang = ? "
        )
        total = self._query(f"SELECT COUNT(*) {base} WHERE {clause}", *params)[0][0]
        rows = self._query(
            f"SELECT p.Id, p.Sku, COALESCE(pt.Name, p.Name) AS Name, p.Image, c.Id AS CatId, "
            f"c.Slug, COALESCE(ct.Name, c.Name) AS CatName, p.Price, p.Stock, "
            f"p.Low_Stock_Threshold, p.Publish_Status, p.Is_Available, "
            f"(SELECT COUNT(*) FROM dbo.Product_Ingredients pi WHERE pi.Product_Id = p.Id "
            f"  AND pi.Status = 1) AS Ingredients {base} WHERE {clause} "
            f"ORDER BY c.Sort_Order, p.Id OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            *params,
            (page - 1) * page_size,
            page_size,
        )
        live = self._query(
            "SELECT p.Publish_Status, p.Is_Available, p.Stock, p.Low_Stock_Threshold, c.Slug "
            "FROM dbo.Products p JOIN dbo.Categories c ON c.Id = p.Category_Id "
            "WHERE p.Status = 1 AND c.Status = 1"
        )
        counts = {"all": len(live)}
        for r in live:
            counts[r.Slug] = counts.get(r.Slug, 0) + 1
        active = [r for r in live if r.Publish_Status == "active"]
        return {
            "items": [
                {
                    "id": r.Id,
                    "sku": r.Sku or "",
                    "name": r.Name,
                    "image": r.Image or "",
                    "category": {"id": r.CatId, "slug": r.Slug, "name": r.CatName},
                    "price": money(r.Price),
                    "stock": r.Stock,
                    "lowStockThreshold": r.Low_Stock_Threshold,
                    "publishStatus": r.Publish_Status,
                    "isAvailable": bool(r.Is_Available),
                    "ingredientCount": r.Ingredients,
                }
                for r in rows
            ],
            "page": page,
            "pageSize": page_size,
            "total": total,
            "categoryCounts": counts,
            "stats": {
                "active": sum(
                    1 for r in active if r.Is_Available and (r.Stock is None or r.Stock > 0)
                ),
                "lowStock": sum(
                    1 for r in active if r.Stock is not None and 0 < r.Stock < r.Low_Stock_Threshold
                ),
                "outOfStock": sum(1 for r in active if r.Stock == 0),
                "drafts": sum(1 for r in live if r.Publish_Status == "draft"),
            },
        }

    def product(self, product_id: int) -> dict | None:
        rows = self._query("SELECT * FROM dbo.Products WHERE Id = ? AND Status = 1", product_id)
        if not rows:
            return None
        p = rows[0]
        translations = {
            lang: {"name": p.Name, "description": p.Description or ""} for lang in LANGS
        }
        for t in self._query(
            "SELECT Lang, Name, Description FROM dbo.Product_Translations WHERE Product_Id = ?",
            product_id,
        ):
            translations[t.Lang] = {"name": t.Name, "description": t.Description or ""}
        ingredients = [
            {
                "id": r.Id,
                "ingredientId": r.Ingredient_Id,
                "name": r.Name,
                "default": r.Default_Ingredients,
                "max": r.Max_Ingredients,
                "extraPrice": money(r.Extra_Price),
                "removable": bool(r.Is_Removable),
            }
            for r in self._query(
                "SELECT pi.Id, pi.Ingredient_Id, pi.Default_Ingredients, pi.Max_Ingredients, "
                "pi.Is_Removable, i.Name, i.Extra_Price FROM dbo.Product_Ingredients pi "
                "JOIN dbo.Ingredients i ON i.Id = pi.Ingredient_Id "
                "WHERE pi.Product_Id = ? AND pi.Status = 1 ORDER BY pi.Sort_Order, pi.Id",
                product_id,
            )
        ]
        return {
            "id": p.Id,
            "sku": p.Sku or "",
            "image": p.Image or "",
            "categoryId": p.Category_Id,
            "price": money(p.Price),
            "cost": money(p.Cost),
            "stock": p.Stock,
            "lowStockThreshold": p.Low_Stock_Threshold,
            "prepTimeMin": p.Prep_Time_Min,
            "prepTimeMax": p.Prep_Time_Max,
            "calories": p.Calories,
            "isAvailable": bool(p.Is_Available),
            "isFeatured": bool(p.Is_Featured),
            "allowCustomization": bool(p.Allow_Customization),
            "publishStatus": p.Publish_Status,
            "translations": translations,
            "ingredients": ingredients,
        }

    def save_product(self, product_id: int | None, data: dict) -> int:
        en, es = data["translations"]["en"], data["translations"]["es"]
        with self._tx() as cur:
            if (
                cur.execute(
                    "SELECT 1 FROM dbo.Categories WHERE Id = ? AND Status = 1", data["categoryId"]
                ).fetchone()
                is None
            ):
                raise ValidationError("Unknown category.", error_code="CATEGORY_INVALID")
            values = (
                data["categoryId"],
                en["name"],
                en["description"],
                data["price"],
                data["cost"],
                data["stock"],
                data["lowStockThreshold"],
                data["prepTimeMin"],
                data["prepTimeMax"],
                data["calories"],
                int(data["isAvailable"]),
                int(data["isFeatured"]),
                int(data["allowCustomization"]),
                data["publishStatus"],
            )
            if product_id is None:
                product_id = cur.execute(
                    "INSERT INTO dbo.Products (Category_Id, Name, Description, Price, Cost, Stock, "
                    "Low_Stock_Threshold, Prep_Time_Min, Prep_Time_Max, Calories, Is_Available, "
                    "Is_Featured, Allow_Customization, Publish_Status, Status) OUTPUT INSERTED.Id "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)",
                    *values,
                ).fetchone()[0]
                cur.execute(
                    "UPDATE dbo.Products SET Sku = CONCAT('SKU-', RIGHT(CONCAT('0000', Id), 4)) "
                    "WHERE Id = ?",
                    product_id,
                )
            else:
                updated = cur.execute(
                    "UPDATE dbo.Products SET Category_Id=?, Name=?, Description=?, Price=?, Cost=?, "
                    "Stock=?, Low_Stock_Threshold=?, Prep_Time_Min=?, Prep_Time_Max=?, Calories=?, "
                    "Is_Available=?, Is_Featured=?, Allow_Customization=?, Publish_Status=?, "
                    "Updated_At=SYSUTCDATETIME() WHERE Id = ? AND Status = 1",
                    *values,
                    product_id,
                ).rowcount
                if updated == 0:
                    raise RecordNotFoundException(f"Product {product_id} not found.")

            for lang, text in (("en", en), ("es", es)):
                cur.execute(
                    "MERGE dbo.Product_Translations AS t USING (SELECT ? AS P, ? AS L) AS s "
                    "ON t.Product_Id = s.P AND t.Lang = s.L "
                    "WHEN MATCHED THEN UPDATE SET Name = ?, Description = ? "
                    "WHEN NOT MATCHED THEN INSERT (Product_Id, Lang, Name, Description) "
                    "VALUES (s.P, s.L, ?, ?);",
                    product_id,
                    lang,
                    text["name"],
                    text["description"],
                    text["name"],
                    text["description"],
                )
            self._save_ingredients(cur, product_id, data["ingredients"])
        return product_id

    @staticmethod
    def _save_ingredients(cur, product_id: int, rows: list[dict]) -> None:
        keep = [r["id"] for r in rows if r.get("id")]
        # Rows the editor removed are soft-deleted (past orders reference them).
        existing = [
            r.Id
            for r in cur.execute(
                "SELECT Id FROM dbo.Product_Ingredients WHERE Product_Id = ? AND Status = 1",
                product_id,
            ).fetchall()
        ]
        for gone in set(existing) - set(keep):
            cur.execute("UPDATE dbo.Product_Ingredients SET Status = 0 WHERE Id = ?", gone)
        for index, row in enumerate(rows):
            if (
                cur.execute(
                    "SELECT 1 FROM dbo.Ingredients WHERE Id = ? AND Status = 1", row["ingredientId"]
                ).fetchone()
                is None
            ):
                raise ValidationError("Unknown ingredient.", error_code="INGREDIENT_NOT_FOUND")
            args = (row["default"], row["max"], int(row["removable"]), index + 1)
            if row.get("id") and row["id"] in existing:
                cur.execute(
                    "UPDATE dbo.Product_Ingredients SET Ingredient_Id = ?, Default_Ingredients = ?, "
                    "Max_Ingredients = ?, Is_Removable = ?, Sort_Order = ? WHERE Id = ?",
                    row["ingredientId"],
                    *args,
                    row["id"],
                )
            else:
                cur.execute(
                    "INSERT INTO dbo.Product_Ingredients (Product_Id, Ingredient_Id, "
                    "Default_Ingredients, Max_Ingredients, Is_Removable, Sort_Order) "
                    "VALUES (?,?,?,?,?,?)",
                    product_id,
                    row["ingredientId"],
                    *args,
                )
            # Extra price lives on the shared Ingredients row.
            cur.execute(
                "UPDATE dbo.Ingredients SET Extra_Price = ? WHERE Id = ?",
                row["extraPrice"],
                row["ingredientId"],
            )

    def set_available(self, product_id: int, value: bool) -> None:
        with self._tx() as cur:
            n = cur.execute(
                "UPDATE dbo.Products SET Is_Available = ?, Updated_At = SYSUTCDATETIME() "
                "WHERE Id = ? AND Status = 1",
                int(value),
                product_id,
            ).rowcount
            if n == 0:
                raise RecordNotFoundException(f"Product {product_id} not found.")

    def soft_delete(self, product_id: int) -> None:
        with self._tx() as cur:
            n = cur.execute(
                "UPDATE dbo.Products SET Status = 0, Updated_At = SYSUTCDATETIME() "
                "WHERE Id = ? AND Status = 1",
                product_id,
            ).rowcount
            if n == 0:
                raise RecordNotFoundException(f"Product {product_id} not found.")

    def set_image(self, product_id: int, url: str) -> None:
        with self._tx() as cur:
            n = cur.execute(
                "UPDATE dbo.Products SET Image = ?, Updated_At = SYSUTCDATETIME() "
                "WHERE Id = ? AND Status = 1",
                url,
                product_id,
            ).rowcount
            if n == 0:
                raise RecordNotFoundException(f"Product {product_id} not found.")

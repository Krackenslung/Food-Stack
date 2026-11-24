"""Read models for the customer app: menu, product detail and the customer's own orders."""

from backend.Infrastructure.sql_admin import SqlAdminRepository, iso, money

GROUPS = {
    "active": ("pending_payment", "received", "preparing", "ready", "pending"),
    "completed": ("completed",),
    "cancelled": ("cancelled",),
}

PRODUCT_SELECT = (
    "SELECT p.Id, COALESCE(pt.Name, p.Name) AS Name, "
    "COALESCE(pt.Description, p.Description) AS Description, p.Image, p.Price, p.Calories, "
    "p.Prep_Time_Min, p.Prep_Time_Max, p.Is_Available, p.Stock, p.Is_Featured, "
    "p.Allow_Customization, c.Id AS CatId, c.Slug, COALESCE(ct.Name, c.Name) AS CatName, "
    "c.Sort_Order FROM dbo.Products p JOIN dbo.Categories c ON c.Id = p.Category_Id "
    "LEFT JOIN dbo.Product_Translations pt ON pt.Product_Id = p.Id AND pt.Lang = ? "
    "LEFT JOIN dbo.Category_Translations ct ON ct.Category_Id = c.Id AND ct.Lang = ? "
    "WHERE p.Status = 1 AND c.Status = 1 AND c.Slug IS NOT NULL "
)

ORDERABLE = "AND p.Publish_Status = 'active' AND p.Is_Available = 1 AND (p.Stock IS NULL OR p.Stock > 0) "


def _product(r) -> dict:
    return {
        "id": r.Id,
        "name": r.Name,
        "description": r.Description or "",
        "image": r.Image or "",
        "price": money(r.Price),
        "calories": r.Calories,
        "prepTimeMin": r.Prep_Time_Min,
        "prepTimeMax": r.Prep_Time_Max,
        "isAvailable": bool(r.Is_Available),
        "stock": r.Stock,
        "isFeatured": bool(r.Is_Featured),
    }


class SqlPublicRepository(SqlAdminRepository):
    def menu(self, lang: str) -> list[dict]:
        sections: dict[int, dict] = {}
        for r in self._query(PRODUCT_SELECT + ORDERABLE + "ORDER BY c.Sort_Order, p.Id", lang, lang):
            section = sections.setdefault(
                r.CatId,
                {"category": {"id": r.CatId, "slug": r.Slug, "name": r.CatName}, "products": []},
            )
            section["products"].append(_product(r))
        return list(sections.values())

    def product_detail(self, product_id: int, lang: str) -> dict | None:
        rows = self._query(
            PRODUCT_SELECT + ORDERABLE + "AND p.Id = ?", lang, lang, product_id
        )
        if not rows:
            return None
        r = rows[0]
        ingredients = [
            {
                "productIngredientId": i.Id,
                "name": i.Name,
                "extraPrice": money(i.Extra_Price),
                "default": i.Default_Ingredients,
                "max": i.Max_Ingredients,
                "removable": bool(i.Is_Removable),
            }
            for i in self._query(
                "SELECT pi.Id, COALESCE(it.Name, i.Name) AS Name, i.Extra_Price, "
                "pi.Default_Ingredients, pi.Max_Ingredients, pi.Is_Removable "
                "FROM dbo.Product_Ingredients pi JOIN dbo.Ingredients i ON i.Id = pi.Ingredient_Id "
                "LEFT JOIN dbo.Ingredient_Translations it ON it.Ingredient_Id = i.Id AND it.Lang = ? "
                "WHERE pi.Product_Id = ? AND pi.Status = 1 AND i.Status = 1 "
                "ORDER BY pi.Sort_Order, pi.Id",
                lang,
                product_id,
            )
        ]
        return {
            **_product(r),
            "category": {"id": r.CatId, "slug": r.Slug, "name": r.CatName},
            "allowCustomization": bool(r.Allow_Customization),
            "ingredients": ingredients,
        }

    def my_orders(
        self, user_id: int, group: str | None, page: int, page_size: int, lang: str
    ) -> dict:
        statuses = GROUPS.get(group or "")
        where, params = "WHERE User_Id = ?", [user_id]
        if statuses:
            where += f" AND Status IN ({','.join('?' for _ in statuses)})"
            params += list(statuses)
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
        }

    def store_wait(self) -> int:
        """Rough wait shown on the menu: base prep + 2 min per order being prepared."""
        return 10 + 2 * self.count_status("preparing")


__all__ = ["SqlPublicRepository", "iso"]

import json
from ..Infrastructure.SQLServerConnection import *
from .product_ingredient import ProductIngredient
from backend.errors import RecordNotFoundException


# -------------------------
# ATTRIBUTES
# -------------------------
class OrderProductIngredient:
    def __init__(self, *args):
        self._id = 0
        self._order_product_id = 0
        self._product_ingredient_id = 0
        self._quantity = 1
        self._status = 1
        self._created_at = None

        # Constructors
        if len(args) == 1:
            self.load_by_id(args[0])
        elif len(args) == 6:
            (
                self._id,
                self._order_product_id,
                self._product_ingredient_id,
                self._quantity,
                self._status,
                self._created_at
            ) = args

    # -------------------------
    # PROPERTIES
    # -------------------------

    @property
    def id(self):
        return self._id

    @id.setter
    def id(self, value):
        self._id = value

    @property
    def order_product_id(self):
        return self._order_product_id

    @order_product_id.setter
    def order_product_id(self, value):
        self._order_product_id = value

    @property
    def product_ingredient_id(self):
        return self._product_ingredient_id

    @product_ingredient_id.setter
    def product_ingredient_id(self, value):
        self._product_ingredient_id = value

    @property
    def quantity(self):
        return self._quantity

    @quantity.setter
    def quantity(self, value):
        self._quantity = value

    @property
    def status(self):
        return self._status

    @status.setter
    def status(self, value):
        self._status = value

    @property
    def created_at(self):
        return self._created_at

    @created_at.setter
    def created_at(self, value):
        self._created_at = value

    # -------------------------
    # METHODS
    # -------------------------

    # LOAD BY ID
    # -------------------------
    def load_by_id(self, opi_id, conn=None):
        try:
            if conn:
                cursor = conn.cursor()
            else:
                conn = SQLServerConnection.get_connection()
                cursor = conn.cursor()

            cursor.execute("""
                SELECT Id, Order_Product_Id, Product_Ingredient_Id, Quantity, Status, Created_At
                FROM Order_Product_Ingredients
                WHERE Id = ?
            """, opi_id)

            row = cursor.fetchone()
            if row:
                (
                    self._id,
                    self._order_product_id,
                    self._product_ingredient_id,
                    self._quantity,
                    self._status,
                    self._created_at
                ) = row
            else:
                raise RecordNotFoundException(
                    f"OrderProductIngredient with id {opi_id} was not found."
                )

        except Exception as e:
            raise e

    # GET BY ID
    # -------------------------
    @staticmethod
    def get_by_id(opi_id, conn=None):
        try:
            opi = OrderProductIngredient()
            opi.load_by_id(opi_id, conn)

            product_ingredient = ProductIngredient.get_by_id(opi.product_ingredient_id, conn)

            return {
                "id": opi.id,
                "order_product_id": opi.order_product_id,
                "product_ingredient_id": opi.product_ingredient_id,
                "quantity": opi.quantity,
                "status": opi.status,
                "created_at": opi.created_at.isoformat() if opi.created_at else None,

                "product_ingredient": product_ingredient
            }

        except Exception as ex:
            raise ex

    # GET BY ORDER_PRODUCT_ID 
    # -------------------------
    @staticmethod
    def get_by_order_product_id(order_product_id, conn):
        ingredients = []

        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id, Order_Product_Id, Product_Ingredient_Id, Quantity, Status, Created_At
                FROM Order_Product_Ingredients
                WHERE Order_Product_Id = ?
            """, order_product_id)

            for row in cursor.fetchall():
                opi = OrderProductIngredient(*row)

                product_ingredient = ProductIngredient.get_by_id(opi.product_ingredient_id, conn)

                ingredients.append({
                    "id": opi.id,
                    "order_product_id": opi.order_product_id,
                    "product_ingredient_id": opi.product_ingredient_id,
                    "quantity": opi.quantity,
                    "status": opi.status,
                    "created_at": opi.created_at.isoformat() if opi.created_at else None,

                    "product_ingredient": product_ingredient
                })

        except Exception as ex:
            raise ex

        return ingredients

    # GET ALL
    # -------------------------
    @staticmethod
    def get_all():
        results = []

        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Id, Order_Product_Id, Product_Ingredient_Id, Quantity, Status, Created_At
                    FROM Order_Product_Ingredients
                    ORDER BY Id DESC
                """)

                for row in cursor.fetchall():
                    results.append(OrderProductIngredient(*row))

        except Exception as ex:
            print("error fetching order product ingredients...", ex)

        return results

    # TO JSON
    # -------------------------
    def to_json(self):
        return json.dumps({
            "id": self._id,
            "order_product_id": self._order_product_id,
            "product_ingredient_id": self._product_ingredient_id,
            "quantity": self._quantity,
            "status": self._status,
            "created_at": self._created_at.isoformat() if self._created_at else None
        })

    # ADD
    # -------------------------
    def add(self):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO Order_Product_Ingredients
                    (Order_Product_Id, Product_Ingredient_Id, Quantity, Status)
                    OUTPUT INSERTED.Id
                    VALUES (?, ?, ?, ?)
                """, (
                    self._order_product_id,
                    self._product_ingredient_id,
                    self._quantity,
                    self._status
                ))

                self._id = cursor.fetchone()[0]
                conn.commit()

                return self._id

        except Exception as ex:
            raise ex

    # UPDATE
    # -------------------------
    def update(self):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE Order_Product_Ingredients
                    SET Order_Product_Id = ?, Product_Ingredient_Id = ?, Quantity = ?, Status = ?
                    WHERE Id = ?
                """, (
                    self._order_product_id,
                    self._product_ingredient_id,
                    self._quantity,
                    self._status,
                    self._id
                ))

                if cursor.rowcount == 0:
                    raise RecordNotFoundException(
                        f"OrderProductIngredient with id {self._id} was not found."
                    )

                conn.commit()

        except Exception as ex:
            raise ex
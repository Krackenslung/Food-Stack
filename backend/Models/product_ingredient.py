import json
from ..Infrastructure.SQLServerConnection import *
from .ingredient import Ingredient
from backend.errors import RecordNotFoundException


# -------------------------
# ATTRIBUTES
# -------------------------
class ProductIngredient:
    def __init__(self, *args):
        self._id = 0
        self._product_id = 0
        self._ingredient_id = 0
        self._max_ingredients = 0
        self._default_ingredients = 0
        self._status = 1
        self._created_at = None

        # Constructors
        if len(args) == 1:
            self.load_by_id(args[0])
        elif len(args) == 7:
            (
                self._id,
                self._product_id,
                self._ingredient_id,
                self._max_ingredients,
                self._default_ingredients,
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
    def product_id(self):
        return self._product_id

    @product_id.setter
    def product_id(self, value):
        self._product_id = value

    @property
    def ingredient_id(self):
        return self._ingredient_id

    @ingredient_id.setter
    def ingredient_id(self, value):
        self._ingredient_id = value

    @property
    def max_ingredients(self):
        return self._max_ingredients

    @max_ingredients.setter
    def max_ingredients(self, value):
        self._max_ingredients = value

    @property
    def default_ingredients(self):
        return self._default_ingredients

    @default_ingredients.setter
    def default_ingredients(self, value):
        self._default_ingredients = value

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
    def load_by_id(self, id, conn=None):
        try:
            if conn:
                cursor = conn.cursor()
            else:
                conn = SQLServerConnection.get_connection()
                cursor = conn.cursor()

            cursor.execute("""
                SELECT Id, Product_Id, Ingredient_Id, Max_Ingredients, Default_Ingredients, Status, Created_At
                FROM Product_Ingredients
                WHERE Id = ?
            """, id)

            row = cursor.fetchone()
            if row:
                (
                    self._id,
                    self._product_id,
                    self._ingredient_id,
                    self._max_ingredients,
                    self._default_ingredients,
                    self._status,
                    self._created_at
                ) = row
            else:
                raise RecordNotFoundException(f"Record with id {id} was not found.")

        except Exception as e:
            raise e

    # GET BY ID
    # -------------------------
    @staticmethod
    def get_by_id(id, conn=None):
        try:
            pi = ProductIngredient()
            pi.load_by_id(id, conn)

            ingredient = Ingredient(pi.ingredient_id)

            return {
                "id": pi.id,
                "product_id": pi.product_id,
                "ingredient_id": pi.ingredient_id,
                "max_ingredients": pi.max_ingredients,
                "default_ingredients": pi.default_ingredients,
                "status": pi.status,
                "created_at": pi.created_at.isoformat() if pi.created_at else None,

                "ingredient": ingredient.to_dict()
            }

        except Exception as ex:
            raise ex

    # GET BY PRODUCT ID (FULL DATA)
    # -------------------------
    @staticmethod
    def get_by_product_id(product_id, conn):
        results = []

        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Id, Product_Id, Ingredient_Id, Max_Ingredients, Default_Ingredients, Status, Created_At
                FROM Product_Ingredients
                WHERE Product_Id = ?
            """, product_id)

            for row in cursor.fetchall():
                pi = ProductIngredient(*row)

                ingredient = Ingredient(pi.ingredient_id)

                results.append({
                    "id": pi.id,
                    "product_id": pi.product_id,
                    "ingredient_id": pi.ingredient_id,
                    "max_ingredients": pi.max_ingredients,
                    "default_ingredients": pi.default_ingredients,
                    "status": pi.status,
                    "created_at": pi.created_at.isoformat() if pi.created_at else None,

                    "ingredient": ingredient.to_dict()
                })

        except Exception as ex:
            raise ex

        return results

    # GET ALL
    # -------------------------
    @staticmethod
    def get_all():
        results = []
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Id, Product_Id, Ingredient_Id, Max_Ingredients, Default_Ingredients, Status, Created_At
                    FROM Product_Ingredients
                    ORDER BY Id
                """)
                for row in cursor.fetchall():
                    results.append(ProductIngredient(*row))
        except Exception as ex:
            print("error fetching product_ingredients...", ex)

        return results

    # TO JSON
    # -------------------------
    def to_json(self):
        return json.dumps({
            "id": self._id,
            "product_id": self._product_id,
            "ingredient_id": self._ingredient_id,
            "max_ingredients": self._max_ingredients,
            "default_ingredients": self._default_ingredients,
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
                    INSERT INTO Product_Ingredients 
                    (Product_Id, Ingredient_Id, Max_Ingredients, Default_Ingredients, Status)
                    OUTPUT INSERTED.Id
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    self._product_id,
                    self._ingredient_id,
                    self._max_ingredients,
                    self._default_ingredients,
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
                    UPDATE Product_Ingredients
                    SET Product_Id = ?, Ingredient_Id = ?, Max_Ingredients = ?, Default_Ingredients = ?, Status = ?
                    WHERE Id = ?
                """, (
                    self._product_id,
                    self._ingredient_id,
                    self._max_ingredients,
                    self._default_ingredients,
                    self._status,
                    self._id
                ))

                if cursor.rowcount == 0:
                    raise RecordNotFoundException(f"Record with id {self._id} was not found.")

                conn.commit()

        except Exception as ex:
            raise ex

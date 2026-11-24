import json
from ..Infrastructure.SQLServerConnection import SQLServerConnection
from .product_ingredient import ProductIngredient
from backend.errors import RecordNotFoundException




# -------------------------
# ATTRIBUTES
# -------------------------
class Product:
    def __init__(self, *args):
        self._id = 0
        self._category_id = 0
        self._name = ""
        self._description = ""
        self._image = ""
        self._price = 0.0
        self._status = 1
        self._created_at = None

        # Constructors
        if len(args) == 1:
            self.load_by_id(args[0])
        elif len(args) == 8:
            (
                self._id,
                self._category_id,
                self._name,
                self._description,
                self._image,
                self._price,
                self._status,
                self._created_at,
            ) = args

    # -------------------------
    # PROPERTIES
    # -------------------------
    @property
    def id(self):
        return self._id

    @property
    def category_id(self):
        return self._category_id

    @category_id.setter
    def category_id(self, value):
        self._category_id = value

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value or ""

    @property
    def description(self):
        return self._description

    @description.setter
    def description(self, value):
        self._description = value or ""

    @property
    def image(self):
        return self._image

    @image.setter
    def image(self, value):
        self._image = value or ""

    @property
    def price(self):
        return self._price

    @price.setter
    def price(self, value):
        self._price = value if value is not None else 0.0

    @property
    def status(self):
        return self._status

    @status.setter
    def status(self, value):
        self._status = value if value is not None else 1

    @property
    def created_at(self):
        return self._created_at

    # -------------------------
    # METHODS
    # -------------------------

    # LOAD BY ID
    # -------------------------
    def load_by_id(self, product_id):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT
                        [Id],
                        [Category_Id],
                        [Name],
                        [Description],
                        [Image],
                        [Price],
                        [Status],
                        [Created_At]
                    FROM [dbo].[Products]
                    WHERE [Id] = ?
                    """,
                    (product_id,),
                )

                row = cursor.fetchone()

                if not row:
                    raise RecordNotFoundException(f"Product {product_id} not found")

                (
                    self._id,
                    self._category_id,
                    self._name,
                    self._description,
                    self._image,
                    self._price,
                    self._status,
                    self._created_at,
                ) = row

        except Exception as e:
            raise e

    # GET BY ID (FULL DATA)
    # -------------------------
    @staticmethod
    def get_by_id(product_id):
        try:
            with SQLServerConnection.get_connection() as conn:
                p = Product(product_id)
                ingredients = ProductIngredient.get_by_product_id(p.id, conn)

                return {
                    "id": p.id,
                    "category_id": p.category_id,
                    "name": p.name,
                    "description": p.description,
                    "image": p.image,
                    "price": float(p.price) if p.price is not None else 0.0,
                    "status": bool(p.status),
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                    "ingredients": ingredients,
                }

        except Exception as ex:
            raise ex

    # GET ALL
    # -------------------------
    @staticmethod
    def get_all():
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT
                        [Id],
                        [Category_Id],
                        [Name],
                        [Description],
                        [Image],
                        [Price],
                        [Status],
                        [Created_At]
                    FROM [dbo].[Products]
                    WHERE [Status] = 1 OR [Status] = CAST(1 AS BIT)
                    ORDER BY [Name]
                    """
                )

                rows = cursor.fetchall()
                return [Product(*row) for row in rows]

        except Exception as ex:
            raise ex

    # TO DICT
    # -------------------------
    def to_dict(self):
        return {
            "id": self._id,
            "category_id": self._category_id,
            "name": self._name,
            "description": self._description,
            "image": self._image,
            "price": float(self._price) if self._price is not None else 0.0,
            "status": bool(self._status),
            "created_at": self._created_at.isoformat() if self._created_at else None,
        }

    # TO JSON
    # -------------------------
    def to_json(self):
        return json.dumps(self.to_dict())

    # ADD
    # -------------------------
    def add(self):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO [dbo].[Products]
                        ([Category_Id], [Name], [Description], [Image], [Price], [Status])
                    OUTPUT INSERTED.[Id]
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        self._category_id,
                        self._name,
                        self._description,
                        self._image,
                        self._price,
                        self._status,
                    ),
                )

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
                cursor.execute(
                    """
                    UPDATE [dbo].[Products]
                    SET
                        [Category_Id] = ?,
                        [Name] = ?,
                        [Description] = ?,
                        [Image] = ?,
                        [Price] = ?,
                        [Status] = ?
                    WHERE [Id] = ?
                    """,
                    (
                        self._category_id,
                        self._name,
                        self._description,
                        self._image,
                        self._price,
                        self._status,
                        self._id,
                    ),
                )

                if cursor.rowcount == 0:
                    raise RecordNotFoundException(
                        f"Product with id {self._id} was not found."
                    )

                conn.commit()

        except Exception as ex:
            raise ex
import json
from datetime import datetime
from ..Infrastructure.SQLServerConnection import *
from .order_product import OrderProduct
from backend.errors import RecordNotFoundException


# -------------------------
# ATTRIBUTES
# -------------------------
class Order:
    def __init__(self, *args):
        self._id = 0
        self._user_id = 0
        self._total = 0.0
        self._datetime = None
        self._status = "pending"
        self._created_at = None

        # Constructors
        if len(args) == 1:
            self.load_by_id(args[0])
        elif len(args) == 6:
            (
                self._id,
                self._user_id,
                self._total,
                self._datetime,
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
    def user_id(self):
        return self._user_id

    @user_id.setter
    def user_id(self, value):
        self._user_id = value

    @property
    def total(self):
        return self._total

    @total.setter
    def total(self, value):
        self._total = value

    @property
    def datetime(self):
        return self._datetime

    @datetime.setter
    def datetime(self, value):
        self._datetime = value

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
    # HELPERS
    # -------------------------
    @staticmethod
    def _normalize_datetime(value):
        if value is None or value == "":
            return datetime.now()

        if isinstance(value, datetime):
            return value

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return datetime.now()

            # soporta ISO con Z
            raw = raw.replace("Z", "+00:00")

            try:
                return datetime.fromisoformat(raw)
            except ValueError:
                pass

            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M:%S.%f",
                "%Y-%m-%d",
                "%m/%d/%Y %H:%M:%S",
                "%m/%d/%Y",
            ]

            for fmt in formats:
                try:
                    return datetime.strptime(raw, fmt)
                except ValueError:
                    continue

        raise ValueError("Invalid datetime format for order.")

    # -------------------------
    # METHODS
    # -------------------------

    # LOAD BY ID
    # -------------------------
    def load_by_id(self, id):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Id, User_Id, Total, Datetime, Status, Created_At
                    FROM Orders
                    WHERE Id = ?
                """, id)

                row = cursor.fetchone()
                if row:
                    (
                        self._id,
                        self._user_id,
                        self._total,
                        self._datetime,
                        self._status,
                        self._created_at
                    ) = row
                else:
                    raise RecordNotFoundException(f"Order with id {id} was not found.")

        except Exception as e:
            raise e

    # GET BY ID (FULL DATA)
    # -------------------------
    @staticmethod
    def get_by_id(id):
        try:
            with SQLServerConnection.get_connection() as conn:
                o = Order(id)
                products = OrderProduct.get_by_order_id(o.id, conn)

                return {
                    "id": o.id,
                    "user_id": o.user_id,
                    "total": float(o.total),
                    "datetime": o.datetime.isoformat() if o.datetime else None,
                    "status": o.status,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "products": products
                }

        except Exception as ex:
            raise ex

    # GET BY USER ID (FULL DATA)
    # -------------------------
    @staticmethod
    def get_by_user_id(user_id):
        results = []
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Id, User_Id, Total, Datetime, Status, Created_At
                    FROM Orders
                    WHERE User_Id = ?
                    ORDER BY Created_At DESC
                """, user_id)

                for row in cursor.fetchall():
                    o = Order(*row)
                    products = OrderProduct.get_by_order_id(o.id, conn)

                    results.append({
                        "id": o.id,
                        "user_id": o.user_id,
                        "total": float(o.total),
                        "datetime": o.datetime.isoformat() if o.datetime else None,
                        "status": o.status,
                        "created_at": o.created_at.isoformat() if o.created_at else None,
                        "products": products
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
                    SELECT Id, User_Id, Total, Datetime, Status, Created_At
                    FROM Orders
                    ORDER BY Created_At DESC
                """)

                for row in cursor.fetchall():
                    results.append(Order(*row))

        except Exception as ex:
            print("error fetching orders...", ex)

        return results

    # TO DICT
    # -------------------------
    def to_dict(self):
        return {
            "id": self._id,
            "user_id": self._user_id,
            "total": float(self._total),
            "datetime": self._datetime.isoformat() if self._datetime else None,
            "status": self._status,
            "created_at": self._created_at.isoformat() if self._created_at else None
        }

    # TO JSON
    # -------------------------
    def to_json(self):
        return json.dumps(self.to_dict())

    # ADD
    # -------------------------
    def add(self):
        try:
            order_datetime = Order._normalize_datetime(self._datetime)

            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO Orders (User_Id, Total, Datetime, Status)
                    OUTPUT INSERTED.Id
                    VALUES (?, ?, ?, ?)
                """, (
                    self._user_id,
                    self._total,
                    order_datetime,
                    self._status
                ))

                self._id = cursor.fetchone()[0]
                self._datetime = order_datetime
                conn.commit()

                return self._id

        except Exception as ex:
            raise ex

    # UPDATE
    # -------------------------
    def update(self):
        try:
            order_datetime = Order._normalize_datetime(self._datetime)

            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE Orders
                    SET User_Id = ?, Total = ?, Datetime = ?, Status = ?
                    WHERE Id = ?
                """, (
                    self._user_id,
                    self._total,
                    order_datetime,
                    self._status,
                    self._id
                ))

                if cursor.rowcount == 0:
                    raise RecordNotFoundException(f"Order with id {self._id} was not found.")

                self._datetime = order_datetime
                conn.commit()

        except Exception as ex:
            raise ex
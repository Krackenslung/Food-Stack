import bcrypt
import json
from ..Infrastructure.SQLServerConnection import *
from .order import Order
from backend.errors import RecordNotFoundException


# -------------------------
# ATTRIBUTES
# -------------------------
class User:
    def __init__(self, *args):
        self._id = 0
        self._name = ""
        self._lastname = ""
        self._phoneNumber = ""
        self._email = ""
        self._password = ""
        self._role = ""
        self._status = 1
        self._created_at = None

        # Constructors
        if len(args) == 1:
            self.load_by_id(args[0])
        elif len(args) == 9:
            (
                self._id,
                self._name,
                self._lastname,
                self._phoneNumber,
                self._email,
                self._password,
                self._role,
                self._status,
                self._created_at,
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
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value

    @property
    def lastname(self):
        return self._lastname

    @lastname.setter
    def lastname(self, value):
        self._lastname = value

    @property
    def phoneNumber(self):
        return self._phoneNumber

    @phoneNumber.setter
    def phoneNumber(self, value):
        self._phoneNumber = value

    @property
    def email(self):
        return self._email

    @email.setter
    def email(self, value):
        self._email = value

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, value):
        if value:
            hashed = bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt())
            self._password = hashed.decode("utf-8")

    @property
    def role(self):
        return self._role

    @role.setter
    def role(self, value):
        self._role = value

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
    def load_by_id(self, user_id):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, name, lastname, phone_number, email, password_hash, role, status, created_at
                    FROM Users
                    WHERE id = ?
                """, user_id)

                row = cursor.fetchone()
                if row:
                    (
                        self._id,
                        self._name,
                        self._lastname,
                        self._phoneNumber,
                        self._email,
                        self._password,
                        self._role,
                        self._status,
                        self._created_at,
                    ) = row
                else:
                    raise RecordNotFoundException(f"User with id {user_id} was not found.")

        except Exception as e:
            raise e

    # GET ALL
    # -------------------------
    @staticmethod
    def get_all():
        users = []
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, name, lastname, phone_number, email, password_hash, role, status, created_at
                    FROM Users
                    ORDER BY name, lastname
                """)
                for row in cursor.fetchall():
                    users.append(User(*row))
        except Exception as ex:
            print("error fetching users...", ex)
        return users

    # GET BY EMAIL
    # -------------------------
    @staticmethod
    def get_by_email(email):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, name, lastname, phone_number, email, password_hash, role, status, created_at
                    FROM Users
                    WHERE email = ?
                """, email)

                row = cursor.fetchone()
                if row:
                    return User(*row)

        except Exception as ex:
            print("error fetching user by email...", ex)

        return None

    # GET ORDERS
    # -------------------------
    def get_orders(self, conn):
        try:
            return Order.get_by_user_id(self._id)
        except Exception as ex:
            raise ex

    # DETAILS
    # -------------------------
    def details(self, conn):
        self.load_by_id(self._id)
        orders = self.get_orders(conn)

        return {
            "id": self._id,
            "name": self._name,
            "lastname": self._lastname,
            "email": self._email,
            "orders": orders
        }

    # TO DICT
    # -------------------------
    def to_dict(self):
        return {
            "id": self._id,
            "name": self._name,
            "lastname": self._lastname,
            "phoneNumber": self._phoneNumber,
            "email": self._email,
            "role": self._role,
            "status": self._status,
            "created_at": self._created_at.isoformat() if self._created_at else None
        }

    # TO JSON
    # -------------------------
    def to_json(self):
        return json.dumps(self.to_dict())

    # CHECK PASSWORD
    # -------------------------
    def check_password(self, plain_password):
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            self._password.encode("utf-8")
        )

    # ADD
    # -------------------------
    def add(self):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO Users (name, lastname, phone_number, email, password_hash, role, status)
                    OUTPUT INSERTED.id
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    self._name,
                    self._lastname,
                    self._phoneNumber,
                    self._email,
                    self._password,
                    self._role,
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
                    UPDATE Users
                    SET name = ?, lastname = ?, phone_number = ?, email = ?, role = ?, status = ?
                    WHERE id = ?
                """, (
                    self._name,
                    self._lastname,
                    self._phoneNumber,
                    self._email,
                    self._role,
                    self._status,
                    self._id
                ))

                if cursor.rowcount == 0:
                    raise RecordNotFoundException(f"User with id {self._id} was not found.")

                conn.commit()

        except Exception as ex:
            raise ex

    # UPDATE PASSWORD
    # -------------------------
    def update_password(self):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE Users
                    SET password_hash = ?
                    WHERE id = ?
                """, (
                    self._password,
                    self._id
                ))

                if cursor.rowcount == 0:
                    raise RecordNotFoundException(f"User with id {self._id} was not found.")

                conn.commit()

        except Exception as ex:
            raise ex
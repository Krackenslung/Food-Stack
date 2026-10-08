#import classes
from .SQLServerConnection import SQLServerConnection
import json
import bcrypt

# Record not found exception 
class RecordNotFoundError(Exception):
    pass

class User:
    # ====== Attributes ======
    def __init__(self, args):
        self._id = 0
        self._name = ""
        self._lastname = ""
        self._dateOfBirth = ""
        self._username = ""
        self._password = ""
        self._phone = ""
        self._status = 1

        # ====== Constructor ======
        if(len(args) == 1):
            self._load_by_id(args[0])
        elif(len(args) == 8):
            self._id, self._name, self._lastname, self._dateOfBirth, self._username, self._password, self._phone, self._status = args

    # ====== Properties ======
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
    def dateOfBirth(self):
        return self._dateOfBirth
    @dateOfBirth.setter
    def dateOfBirth(self, value):
        self._dateOfBirth = value

    @property
    def username(self):
        return self._username
    @username.setter
    def username(self, value):
        self._username = value

    @property
    def password(self):
        return self._password
    @password.setter
    def password(self, value):
        if value:
            hashed = bcrypt.hashpw(value.encode('utf-8'), bcrypt.gensalt())
            self._password = hashed.decode('utf-8')
        else:
            self._password = value

    @property
    def phone(self):
        return self._phone
    @phone.setter
    def phone(self, value):
        self._phone = value

    @property
    def status(self):
        return self._status
    @status.setter
    def status(self, value):
        self._status = value

    # ====== Methods ======

    # Load user by ID
    def _load_by_id(self, user_id):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, name, lastname, dateOfBirth, username, password, phone, status FROM Users WHERE id = ?",
                    user_id
                )
                row = cursor.fetchone()
                if row:
                    self._id, self._name, self._lastname, self._dateOfBirth, self._username, self._password, self._phone, self._status = row
                else:
                    raise RecordNotFoundError(f"User with id {user_id} was not found.")
        except Exception as e:
            raise e

    # Parse to JSON
    def to_json(self):
        return json.dumps({
            'id': self._id,
            'name': self._name,
            'lastname': self._lastname,
            'dateOfBirth': str(self._dateOfBirth),
            'username': self._username,
            'password': self._password,
            'phone': self._phone,
            'status': self._status
        })

    # Get all users
    @staticmethod 
    def get_all():
        list = []
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, name, lastname, dateOfBirth, username, password, phone, status FROM Users"
                )
                rows = cursor.fetchall()
                for row in rows:
                    user = User(row)
                    list.append(user)
        except Exception as ex:
            print("Error fetching users: ", ex)
        return list

    # Get all users in JSON
    @staticmethod
    def get_all_json():
        return json.dumps([json.loads(u.to_json()) for u in User.get_all()])

    # ADD
    def add(self):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO Users 
                    (name, lastname, dateOfBirth, username, password, phone, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    self._name, self._lastname, self._dateOfBirth,
                    self._username, self._password, self._phone, self._status
                )
                conn.commit()
        except Exception as e:
            raise e

    # Login by username
    @staticmethod
    def get_by_username(username):
        with SQLServerConnection.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, name, lastname, dateOfBirth, username, password, phone, status FROM Users WHERE username = ?",
                username
            )
            row = cursor.fetchone()
            if row:
                return User(row)
            return None

    # Check password
    def check_password(self, plain_password):
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            self._password.encode('utf-8')
        )


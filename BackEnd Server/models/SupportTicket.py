# Import classes
from .OracleConnection import OracleConnection
import json

# record not found exception
class RecordNotFoundException(Exception):
    pass

class SupportTicket:
    # ====== Attributes =======
    def __init__(self, args):
        self._id = 0
        self._name = ""
        self._email = ""
        self._topic = "General"
        self._message = ""
        self._userId = None
        self._createdAt = None

        # ===== Constructor ======
        if(len(args) == 1):
            self._load_by_id(args[0])
        elif(len(args) == 7):
            (self._id, self._name, self._email, self._topic,
             self._message, self._userId, self._createdAt) = args

    # ===== Properties ======
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
    def email(self):
        return self._email
    @email.setter
    def email(self, value):
        self._email = value

    @property
    def topic(self):
        return self._topic
    @topic.setter
    def topic(self, value):
        self._topic = value

    @property
    def message(self):
        return self._message
    @message.setter
    def message(self, value):
        self._message = value

    # Optional: the form is public, so a ticket can arrive with no session
    @property
    def userId(self):
        return self._userId
    @userId.setter
    def userId(self, value):
        self._userId = value

    @property
    def createdAt(self):
        return self._createdAt
    @createdAt.setter
    def createdAt(self, value):
        self._createdAt = value

    # ===== Methods ======
    # Load ticket by id
    def _load_by_id(self, id):
        try:
            with OracleConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """SELECT id, name, email, topic, message, userID, createdAt
                       FROM SupportTickets WHERE id = :1""",
                    [id]
                )
                row = cursor.fetchone()
                if row:
                    (self._id, self._name, self._email, self._topic,
                     self._message, self._userId, self._createdAt) = row
                else:
                    raise RecordNotFoundException(f"Ticket with ID {id} not found.")
        except Exception as ex:
            raise ex

    # To JSON
    def to_json(self):
        return json.dumps({
            "id": self._id,
            "name": self._name,
            "email": self._email,
            "topic": self._topic,
            "message": self._message,
            "userId": self._userId,
            "createdAt": str(self._createdAt) if self._createdAt else None
        })

    # Add ticket
    def add(self):
        try:
            with OracleConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO SupportTickets (name, email, topic, message, userID)
                    VALUES (:1, :2, :3, :4, :5)
                """, [
                    self._name,
                    self._email,
                    self._topic,
                    self._message,
                    self._userId,
                ])
                conn.commit()
        except Exception as ex:
            raise ex

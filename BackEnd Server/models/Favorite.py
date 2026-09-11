# Import classes
from .OracleConnection import OracleConnection
import json

# record not found exception
class RecordNotFoundException(Exception):
    pass

class Favorite:
    # ====== Attributes =======
    def __init__(self, args):
        self._id = 0
        self._userId = 0
        self._placeId = ""
        self._createdAt = None

        # ===== Constructor ======
        if(len(args) == 1):
            self._load_by_id(args[0])
        elif(len(args) == 4):
            self._id, self._userId, self._placeId, self._createdAt = args

    # ===== Properties ======
    @property
    def id(self):
        return self._id
    @id.setter
    def id(self, value):
        self._id = value

    @property
    def userId(self):
        return self._userId
    @userId.setter
    def userId(self, value):
        self._userId = value

    @property
    def placeId(self):
        return self._placeId
    @placeId.setter
    def placeId(self, value):
        self._placeId = value

    @property
    def createdAt(self):
        return self._createdAt
    @createdAt.setter
    def createdAt(self, value):
        self._createdAt = value

    # ===== Methods ======
    # Load favorite by id
    def _load_by_id(self, id):
        try:
            with OracleConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, userID, placeID, createdAt FROM Favorites WHERE id = :1",
                    [id]
                )
                row = cursor.fetchone()
                if row:
                    self._id, self._userId, self._placeId, self._createdAt = row
                else:
                    raise RecordNotFoundException(f"Favorite with ID {id} not found.")
        except Exception as ex:
            raise ex

    # To JSON
    def to_json(self):
        return json.dumps({
            "id": self._id,
            "userId": self._userId,
            "placeId": self._placeId,
            "createdAt": str(self._createdAt) if self._createdAt else None
        })

    # Get all favorites of a user (newest first)
    @staticmethod
    def get_by_user_id(user_id):
        try:
            with OracleConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, userID, placeID, createdAt
                    FROM Favorites
                    WHERE userID = :1
                    ORDER BY createdAt DESC
                """, [user_id])

                rows = cursor.fetchall()

                favorites = []
                for row in rows:
                    favorites.append({
                        "id": row[0],
                        "userId": row[1],
                        "placeId": row[2],
                        "createdAt": str(row[3]) if row[3] else None,
                    })

                return favorites
        except Exception as ex:
            raise ex

    # Idempotent on purpose: marking the same hotel twice must not blow
    # up on the UNIQUE constraint, it just does nothing
    def add(self):
        try:
            with OracleConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    MERGE INTO Favorites f
                    USING (SELECT :1 AS userID, :2 AS placeID FROM dual) src
                       ON (f.userID = src.userID AND f.placeID = src.placeID)
                    WHEN NOT MATCHED THEN
                        INSERT (userID, placeID) VALUES (src.userID, src.placeID)
                """, [
                    self._userId,
                    self._placeId,
                ])
                conn.commit()
        except Exception as ex:
            raise ex

    # Remove a favorite of a given user
    @staticmethod
    def delete(user_id, place_id):
        try:
            with OracleConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "DELETE FROM Favorites WHERE userID = :1 AND placeID = :2",
                    [user_id, place_id]
                )
                deleted = cursor.rowcount
                conn.commit()

                if deleted == 0:
                    raise RecordNotFoundException(
                        f"Favorite {place_id} was not found for this user."
                    )
        except Exception as ex:
            raise ex

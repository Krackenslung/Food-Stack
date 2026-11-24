import json
from ..Infrastructure.SQLServerConnection import *
from backend.errors import RecordNotFoundException
 
 
# -------------------------
# ATTRIBUTES
# -------------------------
class Ingredient:
    def __init__(self, *args):
        self._id = 0
        self._name = ""
        self._extra_price = 0.0
        self._status = 1
        self._created_at = None
 
        # Constructors
        if len(args) == 1:
            self.load_by_id(args[0])
        elif len(args) == 5:
            self._id, self._name, self._extra_price, self._status, self._created_at = args
 
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
    def extra_price(self):
        return self._extra_price
    @extra_price.setter
    def extra_price(self, value):
        self._extra_price = value
 
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
    def load_by_id(self, ingredient_id):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Id, Name, Extra_Price, Status, Created_At
                    FROM Ingredients
                    WHERE Id = ?
                """, ingredient_id)
 
                row = cursor.fetchone()
                if row:
                    self._id, self._name, self._extra_price, self._status, self._created_at = row
                else:
                    raise RecordNotFoundException(f"Ingredient with id {ingredient_id} was not found.")
        except Exception as e:
            raise e
 
    # GET ALL
    # -------------------------
    @staticmethod
    def get_all():
        results = []
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Id, Name, Extra_Price, Status, Created_At
                    FROM Ingredients
                    ORDER BY Name
                """)
                for row in cursor.fetchall():
                    results.append(Ingredient(*row))
        except Exception as ex:
            print("error fetching ingredients...", ex)
        return results
 
    # TO DICT
    # -------------------------
    def to_dict(self):
        return {
            "id": self._id,
            "name": self._name,
            "extra_price": float(self._extra_price),
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
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO Ingredients (Name, Extra_Price, Status)
                    OUTPUT INSERTED.Id
                    VALUES (?, ?, ?)
                """, (
                    self._name,
                    self._extra_price,
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
                    UPDATE Ingredients
                    SET Name = ?, Extra_Price = ?, Status = ?
                    WHERE Id = ?
                """, (
                    self._name,
                    self._extra_price,
                    self._status,
                    self._id
                ))
 
                if cursor.rowcount == 0:
                    raise RecordNotFoundException(f"Ingredient with id {self._id} was not found.")
 
                conn.commit()
 
        except Exception as ex:
            raise ex
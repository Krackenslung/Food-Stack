# Import classes 
from .SQLServerConnection import SQLServerConnection
import json
import bcrypt
from .User import User

# record not found exception 
class RecordNotFoundException(Exception):
    pass
class Location:
    # ====== Attributes =======
    def __init__(self, args):
        self._id = 0
        self._name = ""
        self._description = ""
        self._address = ""
        self._lat = 0.0
        self._lng = 0.0
        self._userId = 0
        self._status = True 

        # ===== Constructor ======
        if(len(args) == 1):
            self._load_by_id(args[0])
        elif(len(args) == 8):
            self._id, self._name, self._description, self._address, self._lat, self._lng, self._userId, self._status = args

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
    def description(self):
        return self._description
    @description.setter
    def description(self, value):
        self._description = value

    @property
    def address(self):
        return self._address    
    @address.setter
    def address(self, value):
        self._address = value

    @property
    def lat(self):
        return self._lat
    @lat.setter
    def lat(self, value):
        self._lat = value

    @property
    def lng(self):
        return self._lng    
    @lng.setter
    def lng(self, value):
        self._lng = value

    @property
    def userId(self):
        return self._userId
    @userId.setter
    def userId(self, value):
        self._userId = value
    
    @property
    def status(self):
        return self._status
    @status.setter
    def status(self, value):
        self._status = value

    # ===== Methods ======
    # Load location by id
    def __load_by_id(self, id):
        try:
            with SQLServerConnection.get_connection() as conn:
                #cursor
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, description, address, lat, lng, userId, status FROM Locations WHERE id = ?", id)
                row = cursor.fetchone()
                if row:
                    self._id, self._name, self._description, self._address, self._lat, self._lng, self._userId, self._status = row
                else:
                    raise RecordNotFoundException(f"Task with ID {id} not found.")
        except Exception as ex:
            raise ex
        
    # To JSON
    def to_json(self):
        return json.dumps({
            "id": self._id,
            "name": self._name,
            "description": self._description,
            "address": self._address,
            "lat": self._lat,
            "lng": self._lng,
            "userId": self._userId,
            "status": self._status
        })
    
    # Get all locations
    @staticmethod
    def get_all():
        # list locations
        locations = []
        try:
            # Connection
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                # Query
                cursor.execute("SELECT id, name, description, address, lat, lng, userId, status FROM Locations")
                # Save data
                rows = cursor.fetchall()
                for row in rows:
                    location = Location(row)
                    locations.append(location)
        except Exception as ex:
            raise ex
        return locations
    
    # Get all Locations to JSON
    @staticmethod
    def get_all_json():
        return json.dumps([json.loads(u.to_json()) for u in Location.get_all()])
    
    # Get all Locations by user id
    @staticmethod
    def get_by_user_id(user_id):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, name, description, address, lat, lng, userId, status
                    FROM Locations
                    WHERE userId = ?
                """, user_id)

                rows = cursor.fetchall()

                locations = []
                for row in rows:
                    loc = {
                        "id": row[0],
                        "name": row[1],
                        "description": row[2],
                        "address": row[3],
                        "lat": row[4],
                        "lng": row[5],
                        "userId": row[6],
                        "status": row[7],
                    }
                    locations.append(loc)

                return locations
        except Exception as e:
            raise e

    
    # Add location
    def add(self):
        try:
            with SQLServerConnection.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO Locations
                    (name, description, address, lat, lng, userId, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    self._name,
                    self._description,
                    self._address,
                    self._lat,
                    self._lng,
                    self._userId,
                    self._status
                ))
                conn.commit()
        except Exception as ex:
            raise ex


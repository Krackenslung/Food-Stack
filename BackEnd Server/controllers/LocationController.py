from flask import Blueprint, request, jsonify
import json
from models.Location import Location, RecordNotFoundException

# Exported to server.py
location_bp = Blueprint('location_bp', __name__)

# Get ALL (/locations)
@location_bp.route('/locations', methods=['GET'])
def get_locations():
    try:
        return jsonify({
            "status": 0,
            "data": [json.loads(l.to_json()) for l in Location.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
    
# GET /locations/id
@location_bp.route('/locations/<int:id>', methods=['GET'])

def get_location_by_id(id):
    try:
        l = Location([])
        return jsonify({
            "status": 0,
            "data": json.loads(l.to_json())
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
    
# POST
@location_bp.route('/locations', methods=['POST'])
def add():
    try:
        data = request.get_json()
        l = Location([])
        l.name = data.get('name')
        l.description = data.get('description')
        l.address = data.get('address')
        l.lat = data.get('lat')
        l.lng = data.get('lng')
        l.userId = data.get('userId')
        # Send to add
        l.add()

        return jsonify({
            "status": 0,
            "message": "Location added successfully."
        })
    
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
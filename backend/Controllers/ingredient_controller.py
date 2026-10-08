from flask import jsonify, Blueprint, request
import json

from backend.Models.ingredient import Ingredient
from ..Security.Auth import require_auth

ingredient_bp = Blueprint('ingredient_bp', __name__)

# GET ALL
# -------------------------
@ingredient_bp.route('/ingredients', methods=['GET'])
#@require_auth
def get_ingredients():
    try:
        return jsonify({
            "status": 0,
            "data": [i.to_dict() for i in Ingredient.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# GET BY ID
# -------------------------
@ingredient_bp.route('/ingredients/<int:ingredient_id>', methods=['GET'])
@ingredient_bp.route('/ingredient/<int:ingredient_id>', methods=['GET'])
#@require_auth
def get_ingredient_by_id(ingredient_id):
    try:
        i = Ingredient(ingredient_id)
        return jsonify({
            "status": 0,
            "data": i.to_dict()
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# POST
# -------------------------
@ingredient_bp.route('/ingredients', methods=['POST'])
@ingredient_bp.route('/ingredient', methods=['POST'])
#@require_auth
def create_ingredient():
    try:
        data = request.get_json()
        i = Ingredient()

        i.name = data.get("name")
        i.extra_price = data.get("extra_price")
        i.status = data.get("status", 1)

        new_id = i.add()

        return jsonify({
            "status": 0,
            "message": "Ingredient created successfully",
            "data": {
                "id": new_id
            }
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# PUT
# -------------------------
@ingredient_bp.route('/ingredients/<int:ingredient_id>', methods=['PUT'])
@ingredient_bp.route('/ingredient/<int:ingredient_id>', methods=['PUT'])
#@require_auth
def update_ingredient(ingredient_id):
    try:
        data = request.get_json()
        i = Ingredient(ingredient_id)

        i.name = data.get("name", i.name)
        i.extra_price = data.get("extra_price", i.extra_price)
        i.status = data.get("status", i.status)

        i.update()

        return jsonify({
            "status": 0,
            "message": "Ingredient updated successfully"
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
from flask import jsonify, Blueprint, request
import json

from backend.Models.product_ingredient import ProductIngredient
from ..Security.Auth import require_auth

product_ingredient_bp = Blueprint('product_ingredient_bp', __name__)

# GET ALL
# -------------------------
@product_ingredient_bp.route('/product-ingredients', methods=['GET'])
#@require_auth
def get_all_product_ingredients():
    try:
        return jsonify({
            "status": 0,
            "data": [json.loads(pi.to_json()) for pi in ProductIngredient.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# GET BY ID
# -------------------------
@product_ingredient_bp.route('/product-ingredients/<int:id>', methods=['GET'])
@product_ingredient_bp.route('/product-ingredient/<int:id>', methods=['GET'])
#@require_auth
def get_product_ingredient_by_id(id):
    try:
        return jsonify({
            "status": 0,
            "data": ProductIngredient.get_by_id(id)
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# GET BY PRODUCT ID
# -------------------------
@product_ingredient_bp.route('/product-ingredients/product/<int:product_id>', methods=['GET'])
#@require_auth
def get_product_ingredients_by_product_id(product_id):
    try:
        from backend.Infrastructure.SQLServerConnection import SQLServerConnection
        with SQLServerConnection.get_connection() as conn:
            return jsonify({
                "status": 0,
                "data": ProductIngredient.get_by_product_id(product_id, conn)
            })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# POST
# --------------------------
@product_ingredient_bp.route('/product-ingredients', methods=['POST'])
@product_ingredient_bp.route('/product-ingredient', methods=['POST'])
#@require_auth
def create_product_ingredient():
    try:
        data = request.get_json()
        pi = ProductIngredient()

        pi.product_id = data.get("product_id")
        pi.ingredient_id = data.get("ingredient_id")
        pi.max_ingredients = data.get("max_ingredients", 0)
        pi.default_ingredients = data.get("default_ingredients", 0)
        pi.status = data.get("status", 1)

        new_id = pi.add()

        return jsonify({
            "status": 0,
            "message": "Product ingredient created successfully",
            "id": new_id
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# PUT
# --------------------------
@product_ingredient_bp.route('/product-ingredients/<int:id>', methods=['PUT'])
@product_ingredient_bp.route('/product-ingredient/<int:id>', methods=['PUT'])
#@require_auth
def update_product_ingredient(id):
    try:
        data = request.get_json()
        pi = ProductIngredient(id)

        pi.product_id = data.get("product_id", pi.product_id)
        pi.ingredient_id = data.get("ingredient_id", pi.ingredient_id)
        pi.max_ingredients = data.get("max_ingredients", pi.max_ingredients)
        pi.default_ingredients = data.get("default_ingredients", pi.default_ingredients)
        pi.status = data.get("status", pi.status)

        pi.update()

        return jsonify({
            "status": 0,
            "message": "Product ingredient updated successfully"
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
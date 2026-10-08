from flask import jsonify, Blueprint, request
import json
 
from backend.Models.order_product_ingredient import OrderProductIngredient
from backend.Infrastructure.SQLServerConnection import SQLServerConnection
 
order_product_ingredient_bp = Blueprint('order_product_ingredient_bp', __name__)

# GET ALL
# -------------------------
@order_product_ingredient_bp.route('/order-product-ingredients', methods=['GET'])
#@require_auth
def get_all():
    try:
        return jsonify({
            "status": 0,
            "data": [json.loads(opi.to_json()) for opi in OrderProductIngredient.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# GET BY ID
# -------------------------
@order_product_ingredient_bp.route('/order-product-ingredients/<int:id>', methods=['GET'])
@order_product_ingredient_bp.route('/order-product-ingredient/<int:id>', methods=['GET'])
#@require_auth
def get_by_id(id):
    try:
        return jsonify({
            "status": 0,
            "data": OrderProductIngredient.get_by_id(id)
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
 
# GET BY ORDER PRODUCT ID
# -------------------------
@order_product_ingredient_bp.route('/order-product-ingredients/order-product/<int:order_product_id>', methods=['GET'])
#@require_auth
def get_by_order_product_id(order_product_id):
    try:
        with SQLServerConnection.get_connection() as conn:
            return jsonify({
                "status": 0,
                "data": OrderProductIngredient.get_by_order_product_id(order_product_id, conn)
            })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# POST
# -------------------------
@order_product_ingredient_bp.route('/order-product-ingredients', methods=['POST'])
@order_product_ingredient_bp.route('/order-product-ingredient', methods=['POST'])
#@require_auth
def create():
    try:
        data = request.get_json()
 
        opi = OrderProductIngredient()
        opi.order_product_id = data.get("order_product_id")
        opi.product_ingredient_id = data.get("product_ingredient_id")
        opi.quantity = data.get("quantity", 1)
        opi.status = data.get("status", 1)
 
        new_id = opi.add()
 
        return jsonify({
            "status": 0,
            "message": "Order product ingredient created successfully",
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
@order_product_ingredient_bp.route('/order-product-ingredients/<int:id>', methods=['PUT'])
@order_product_ingredient_bp.route('/order-product-ingredient/<int:id>', methods=['PUT'])
#@require_auth
def update(id):
    try:
        data = request.get_json()
 
        opi = OrderProductIngredient(id)
        opi.order_product_id = data.get("order_product_id", opi.order_product_id)
        opi.product_ingredient_id = data.get("product_ingredient_id", opi.product_ingredient_id)
        opi.quantity = data.get("quantity", opi.quantity)
        opi.status = data.get("status", opi.status)
 
        opi.update()
 
        return jsonify({
            "status": 0,
            "message": "Order product ingredient updated successfully"
        })
 
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
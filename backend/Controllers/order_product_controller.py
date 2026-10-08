from flask import jsonify, Blueprint, request
import json

from backend.Models.order_product import OrderProduct
from backend.Infrastructure.SQLServerConnection import SQLServerConnection
from ..Security.Auth import require_auth

order_product_bp = Blueprint('order_product_bp', __name__)

# GET ALL
# --------------------------
@order_product_bp.route('/order-products', methods=['GET'])
#@require_auth
def get_order_products():
    try:
        return jsonify({
            "status": 0,
            "data": [json.loads(op.to_json()) for op in OrderProduct.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })


# GET BY ID
# --------------------------
@order_product_bp.route('/order-products/<int:id>', methods=['GET'])
@order_product_bp.route('/order-product/<int:id>', methods=['GET'])
#@require_auth
def get_order_product_by_id(id):
    try:
        return jsonify({
            "status": 0,
            "data": OrderProduct.get_by_id(id)
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })


# GET BY ORDER ID
# --------------------------
@order_product_bp.route('/order-products/order/<int:order_id>', methods=['GET'])
#@require_auth
def get_order_products_by_order_id(order_id):
    try:
        with SQLServerConnection.get_connection() as conn:
            return jsonify({
                "status": 0,
                "data": OrderProduct.get_by_order_id(order_id, conn)
            })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })


# POST
# --------------------------
@order_product_bp.route('/order-products', methods=['POST'])
@order_product_bp.route('/order-product', methods=['POST'])
@order_product_bp.route('/order-products', methods=['POST'])
#@require_auth
def create_order_product():
    try:
        data = request.get_json() or {}

        op = OrderProduct()
        op.order_id = data.get("order_id")
        op.product_id = data.get("product_id")
        op.quantity = data.get("quantity", 1)
        op.price = data.get("price")
        op.status = data.get("status", 1)

        new_id = op.add()

        return jsonify({
            "status": 0,
            "message": "Order product created successfully",
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
# --------------------------
@order_product_bp.route('/order-products/<int:id>', methods=['PUT'])
@order_product_bp.route('/order-product/<int:id>', methods=['PUT'])
@order_product_bp.route('/order-products/<int:id>', methods=['PUT'])
#@require_auth
def update_order_product(id):
    try:
        data = request.get_json() or {}
        op = OrderProduct(id)

        op.order_id = data.get("order_id", op.order_id)
        op.product_id = data.get("product_id", op.product_id)
        op.quantity = data.get("quantity", op.quantity)
        op.price = data.get("price", op.price)
        op.status = data.get("status", op.status)

        op.update()

        return jsonify({
            "status": 0,
            "message": "Order product updated successfully"
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
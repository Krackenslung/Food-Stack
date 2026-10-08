from flask import jsonify, Blueprint, request
import json
from datetime import datetime

from backend.Models.order import Order, RecordNotFoundException
from ..Security.Auth import require_auth

order_bp = Blueprint('order_bp', __name__)

# GET ALL
# -------------------------
@order_bp.route('/orders', methods=['GET'])
# @require_auth
def get_all():
    try:
        return jsonify({
            "status": 0,
            "data": [o.to_dict() for o in Order.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })


# GET BY ID
# -------------------------
@order_bp.route('/orders/<int:id>', methods=['GET'])
@order_bp.route('/order/<int:id>', methods=['GET'])
# @require_auth
def get_by_id(id):
    try:
        return jsonify({
            "status": 0,
            "data": Order.get_by_id(id)
        })
    except RecordNotFoundException as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })


# GET BY USER ID
# -------------------------
@order_bp.route('/orders/user/<int:user_id>', methods=['GET'])
# @require_auth
def get_by_user_id(user_id):
    try:
        return jsonify({
            "status": 0,
            "data": Order.get_by_user_id(user_id)
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })


# POST
# Soporta /order y /orders para no romper frontend viejo o nuevo
# -------------------------
@order_bp.route('/orders', methods=['POST'])
@order_bp.route('/order', methods=['POST'])
@order_bp.route('/orders', methods=['POST'])
# @require_auth
def create():
    try:
        data = request.get_json() or {}

        o = Order()
        o.user_id = data.get("user_id")
        o.total = data.get("total", 0.0)
        o.datetime = data.get("datetime") or datetime.now()
        o.status = data.get("status", "pending")

        new_id = o.add()

        return jsonify({
            "status": 0,
            "message": "Order created successfully",
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
@order_bp.route('/orders/<int:id>', methods=['PUT'])
@order_bp.route('/order/<int:id>', methods=['PUT'])
# @require_auth
def update(id):
    try:
        data = request.get_json() or {}

        o = Order(id)
        o.user_id = data.get("user_id", o.user_id)
        o.total = data.get("total", o.total)
        o.datetime = data.get("datetime", o.datetime)
        o.status = data.get("status", o.status)

        o.update()

        return jsonify({
            "status": 0,
            "message": "Order updated successfully"
        })
    except RecordNotFoundException as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
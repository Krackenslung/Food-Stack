from flask import jsonify, Blueprint, request
from datetime import datetime

from backend.Models.order import Order, RecordNotFoundException
from ..Security.Auth import require_auth, require_roles, is_staff_request

order_bp = Blueprint('order_bp', __name__)


def _error(message, http_status):
    return jsonify({
        "status": 1,
        "errorMessage": str(message)
    }), http_status


def _current_user_id():
    try:
        return int(getattr(request, "user_id", 0) or 0)
    except (TypeError, ValueError):
        return 0


def _is_owner(order_user_id):
    try:
        return int(order_user_id) == _current_user_id()
    except (TypeError, ValueError):
        return False


# GET ALL (staff/admin only)
# -------------------------
@order_bp.route('/orders', methods=['GET'])
@require_auth
@require_roles("staff", "admin")
def get_all():
    try:
        return jsonify({
            "status": 0,
            "data": [o.to_dict() for o in Order.get_all()]
        })
    except Exception as e:
        return _error(e, 500)


# GET BY ID (owner, staff, admin)
# -------------------------
@order_bp.route('/orders/<int:id>', methods=['GET'])
@order_bp.route('/order/<int:id>', methods=['GET'])
@require_auth
def get_by_id(id):
    try:
        order = Order.get_by_id(id)
        if not (is_staff_request() or _is_owner(order.get("user_id"))):
            return _error("Forbidden", 403)

        return jsonify({
            "status": 0,
            "data": order
        })
    except RecordNotFoundException as e:
        return _error(e, 404)
    except Exception as e:
        return _error(e, 500)


# GET BY USER ID (that user, staff, admin)
# -------------------------
@order_bp.route('/orders/user/<int:user_id>', methods=['GET'])
@require_auth
def get_by_user_id(user_id):
    if not (is_staff_request() or user_id == _current_user_id()):
        return _error("Forbidden", 403)

    try:
        return jsonify({
            "status": 0,
            "data": Order.get_by_user_id(user_id)
        })
    except Exception as e:
        return _error(e, 500)


# POST
# Soporta /order y /orders para no romper frontend viejo o nuevo
# -------------------------
@order_bp.route('/orders', methods=['POST'])
@order_bp.route('/order', methods=['POST'])
@require_auth
def create():
    try:
        data = request.get_json(silent=True) or {}

        # Customers can only create orders for themselves, always as "pending".
        # Staff/admin may create on behalf of another user.
        if is_staff_request():
            user_id = data.get("user_id") or _current_user_id()
            status = data.get("status", "pending")
        else:
            requested = data.get("user_id")
            if requested not in (None, "") and not _is_owner(requested):
                return _error("Forbidden", 403)
            user_id = _current_user_id()
            status = "pending"

        o = Order()
        o.user_id = user_id
        o.total = data.get("total", 0.0)
        o.datetime = data.get("datetime") or datetime.now()
        o.status = status

        new_id = o.add()

        return jsonify({
            "status": 0,
            "message": "Order created successfully",
            "data": {
                "id": new_id
            }
        }), 201
    except Exception as e:
        return _error(e, 500)


# PUT (staff/admin only: status changes)
# -------------------------
@order_bp.route('/orders/<int:id>', methods=['PUT'])
@order_bp.route('/order/<int:id>', methods=['PUT'])
@require_auth
@require_roles("staff", "admin")
def update(id):
    try:
        data = request.get_json(silent=True) or {}

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
        return _error(e, 404)
    except Exception as e:
        return _error(e, 500)

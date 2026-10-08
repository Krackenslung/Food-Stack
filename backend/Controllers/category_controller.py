from flask import jsonify, Blueprint, request
from backend.Models.category import Category, RecordNotFoundException
from ..Security.Auth import require_auth

category_bp = Blueprint('category_bp', __name__)

# -------------------------
# GET ALL
# -------------------------
@category_bp.route('/categories', methods=['GET'])
def get_all():
    try:
        return jsonify({
            "status": 0,
            "data": [c.to_dict() for c in Category.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# -------------------------
# GET BY ID
# -------------------------
@category_bp.route('/categories/<int:id>', methods=['GET'])
@category_bp.route('/category/<int:id>', methods=['GET'])
def get_by_id(id):
    try:
        c = Category(id)
        return jsonify({
            "status": 0,
            "data": c.to_dict()
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

# -------------------------
# CREATE
# -------------------------
@category_bp.route('/categories', methods=['POST'])
@category_bp.route('/category', methods=['POST'])
def create():
    try:
        data = request.get_json()

        c = Category()
        c.name = data.get("name")
        c.status = data.get("status", 1)

        new_id = c.add()

        return jsonify({
            "status": 0,
            "message": "Category created successfully",
            "data": {
                "id": new_id
            }
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# -------------------------
# UPDATE
# -------------------------
@category_bp.route('/categories/<int:id>', methods=['PUT'])
@category_bp.route('/category/<int:id>', methods=['PUT'])
def update(id):
    try:
        data = request.get_json()
        c = Category(id)

        c.name = data.get("name", c.name)
        c.status = data.get("status", c.status)

        c.update()

        return jsonify({
            "status": 0,
            "message": "Category updated successfully"
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
from flask import jsonify, Blueprint, request
from backend.Models.product import Product, RecordNotFoundException
from backend.Infrastructure.SQLServerConnection import SQLServerConnection
from ..Security.Auth import require_auth
 
product_bp = Blueprint('product_bp', __name__)

# GET ALL
# -------------------------
@product_bp.route('/products', methods=['GET'])
def get_all():
    try:
        return jsonify({
            "status": 0,
            "data": [p.to_dict() for p in Product.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
 

# GET BY ID
# -------------------------
@product_bp.route('/products/<int:product_id>', methods=['GET'])
@product_bp.route('/product/<int:product_id>', methods=['GET'])
def get_product_by_id(product_id):
    try:
        return jsonify({
            "status": 0,
            "data": Product.get_by_id(product_id)
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

# PUT
# -------------------------
@product_bp.route('/products', methods=['POST'])
@product_bp.route('/product', methods=['POST'])
#@require_auth
def create_product():
    try:
        data = request.get_json()
 
        p = Product()
        p.category_id = data.get("category_id")
        p.name = data.get("name")
        p.description = data.get("description")
        p.image = data.get("image")
        p.price = data.get("price")
        p.status = data.get("status", 1)
 
        new_id = p.add()
 
        return jsonify({
            "status": 0,
            "message": "Product created successfully",
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
@product_bp.route('/products/<int:product_id>', methods=['PUT'])
@product_bp.route('/product/<int:product_id>', methods=['PUT'])
#@require_auth
def update_product(product_id):
    try:
        data = request.get_json()
        p = Product(product_id)
 
        p.category_id = data.get("category_id", p.category_id)
        p.name = data.get("name", p.name)
        p.description = data.get("description", p.description)
        p.image = data.get("image", p.image)
        p.price = data.get("price", p.price)
        p.status = data.get("status", p.status)
 
        p.update()
 
        return jsonify({
            "status": 0,
            "message": "Product updated successfully"
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

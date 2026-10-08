import json
from flask import jsonify, Blueprint, request, make_response
from ..Infrastructure.SQLServerConnection import *
from backend.Models.user import User
from ..Security.Auth import require_auth, generate_token

user_bp = Blueprint("user_bp", __name__)

# GET ALL
# -------------------------
@user_bp.route('/users', methods=['GET'])
#@require_auth
def get_user():
    try:
        return jsonify({
            "status": 0,
            "data": [json.loads(u.to_json()) for u in User.get_all()]
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# GET BY USER ID
# -------------------------
@user_bp.route('/users/<int:user_id>', methods=['GET'])
@user_bp.route('/user/<int:user_id>', methods=['GET'])
@user_bp.route('/users/<int:user_id>', methods=['GET'])
#@require_auth
def get_user_with_orders(user_id):
    try:
        with SQLServerConnection.get_connection() as conn:
            u = User()
            u._id = user_id

            return jsonify({
                "status": 0,
                "data": u.details(conn)
            })

    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })
    
# POST
# -------------------------
@user_bp.route('/users', methods=['POST'])
@user_bp.route('/user', methods=['POST'])
@user_bp.route('/users', methods=['POST'])
#@require_auth
def create_user():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({
                "status": 1,
                "errorMessage": "Invalid payload. JSON body is required."
            }), 400

        u = User()
        u.name = data.get("name")
        u.lastname = data.get("lastname")
        u.phoneNumber = data.get("phoneNumber")
        u.email = data.get("email")
        u.password = data.get("password")

        u.role = data.get("role")
        u.status = 1

        u.add()

        return jsonify({
            "status": 0,
            "message": "User created successfully"
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# LOGIN
# -------------------------
@user_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json(silent=True)

        if not data or "email" not in data or "password" not in data:
            return jsonify({
                'status': 1,
                'errorMessage': "Email and password are required."
            }), 400
        
        u = User.get_by_email(data["email"])

        if not u or not u.check_password(data["password"]):
            return jsonify({
                'status': 1,
                'errorMessage': "Invalid credentials."
            }), 401
        
        token = generate_token(u.id, u.role)

        response = make_response(jsonify({
            "status": 0,
            "user": json.loads(u.to_json()),
            "token": token
        }))

        response.set_cookie(
            "auth_token",
            token,
            httponly=True,
            secure=False,
            samesite="Lax",
            max_age=60 * 60 * 10
        )
        return response

    except Exception as ex:
        return jsonify({
            "status": 2,
            "errorMessage": str(ex)
        }), 400

# SESSION
# -------------------------
@user_bp.route("/session", methods=["GET"])
@require_auth
def get_session():
    try:
        user_id = int(getattr(request, "user_id", 0) or 0)
        if user_id <= 0:
            return jsonify({
                "status": 1,
                "errorMessage": "Invalid session."
            }), 401

        user = User(user_id)
        return jsonify({
            "status": 0,
            "data": json.loads(user.to_json())
        })
    except Exception as ex:
        return jsonify({
            "status": 1,
            "errorMessage": str(ex)
        }), 401

# LOGOUT
# -------------------------
@user_bp.route("/logout", methods=["POST"])
#@require_auth
def logout():
    response = jsonify({
        "status": 0,
        "message": "Logged Out"
    })

    response.delete_cookie("auth_token")

    return response

# PUT
# -------------------------
@user_bp.route('/users/<int:user_id>', methods=['PUT'])
@user_bp.route('/user/<int:user_id>', methods=['PUT'])
@user_bp.route('/users/<int:user_id>', methods=['PUT'])
#@require_auth
def update_user(user_id):
    try:
        data = request.get_json()
        u = User(user_id)

        if "name" in data:
            u.name = data.get("name")

        if "lastname" in data:
            u.lastname = data.get("lastname")

        if "phoneNumber" in data:
            u.phoneNumber = data.get("phoneNumber")

        if "email" in data:
            u.email = data.get("email")

        if "password" in data:
            u.password = data.get("password")

        if "role" in data:
            u.role = data.get("role")

        if "status" in data:
            u.status = data.get("status")

        u.update()

        return jsonify({
            "status": 0,
            "message": "User updated successfully"
        })

    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

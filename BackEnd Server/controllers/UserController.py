from flask import Blueprint, request, jsonify, make_response
import json
from models.User import User, RecordNotFoundError
from models.Location import Location
from security.auth import generate_token, require_auth

# Export to server
user_bp = Blueprint('user_bp', __name__)

# ===== Get ALL (/users) =====
@user_bp.route('/users', methods=['GET'])
@require_auth
def get_users():
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

# ===== GET /users/id =====
@user_bp.route('/users/<int:user_id>', methods=['GET'])
@require_auth
def get_user_by_id(user_id):
    try:
        u = User([user_id])  # loads user
        locations = Location.get_by_user_id(user_id)

        return jsonify({
            "status": 0,
            "data": {
                "user": json.loads(u.to_json()),
                "locations": locations
            }
        })
    except RecordNotFoundError as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        }), 500

# ===== Post /users =====
@user_bp.route('/users', methods=['POST'])
def add():
    try:
        data = request.get_json()
        u = User([])
        u.name = data.get('name')
        u.lastname = data.get('lastname')
        u.dateOfBirth = data.get('dateOfBirth')
        u.username = data.get('username')
        u.password = data.get('password')
        u.phone = data.get('phone')
        u.status = data.get('status', 1)
        u.add()
        return jsonify({
            "status": 0,
            "message": "User added successfully"
        })
    except Exception as e:
        return jsonify({
            "status": 1,
            "errorMessage": str(e)
        })

# Login / Post 
@user_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or "username" not in data or "password" not in data:
            return jsonify({
                "status": 1,
                "errorMessage": "Username and password are required."
            }), 400
        u = User.get_by_username(data["username"])
        if not u or not u.check_password(data["password"]):
            return jsonify({
                "status": 1,
                "errorMessage": "Invalid credentials."
            }), 401
        token = generate_token(u.id)
        response = make_response(jsonify({
            "status": 0,
            "user": json.loads(u.to_json())
        }))
        response.set_cookie(
            "auth_token",
            token,
            httponly=True,
            secure=True,
            samesite="Strict",
            max_age=60 * 60 * 10
        )
        return response
    except Exception as ex:
        return jsonify({
            "status": 2,
            "errorMessage": str(ex)
        }), 400

# ===== Logout =====
@user_bp.route("/logout", methods=["POST"])
def logout():
    response = jsonify({
        "status": 0,
        "message": "Logged Out"
    })
    response.delete_cookie("auth_token")
    return response

# @user_bp.route('/login', methods=['POST'])
# def login():
# try:
#     #get data
#     data = request.get_json()
#     if not data or 'username' not in data or 'password' not in data:
#         # display 
#         return jsonify({
#             "status": 1,
#             "errorMessage": "Username and password are required."
#         }), 400
    
#     username = data.get('username')
#     password = data.get('password')

#     # check if user and password exists
#     u = User([])
#     u._load_by_username(username)
#     if not u or not u.check_password(password):
#         return jsonify({
#             "status": 1,
#             "errorMessage": "Invalid Credentials"
#         }), 401

#     # generate token
#     token = generate_token(u.id)
#     return jsonify({
#         "status": 0,
#         "token": token,
#         "user": json.loads(u.to_json())
#     })

# except Exception as e:
#     return jsonify({
#         "status": 1,
#         "errorMessage": str(e)
#     })
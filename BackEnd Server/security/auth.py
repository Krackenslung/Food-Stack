import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
import datetime
from functools import wraps
from flask import request, jsonify

# Key
SECRET_KEY = '9876543210'

# Generate JWT Token
def generate_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=2),
        'iat': datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

# Decode token 
def decode_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])

# Middleware require auth 
def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.cookies.get("auth_token")

        if not token:
            return jsonify({
                'status': 1,
                'errorMessage': "Not authenticated"
            }), 401

        try:
            decode = decode_token(token)
            request.user_id = decode.get("user_id")
        except ExpiredSignatureError:
            return jsonify({
                'status': 1,
                'errorMessage': 'Token expired'
            }), 401
        except InvalidTokenError:
            return jsonify({
                'status': 1,
                'errorMessage': 'Invalid Token'
            }), 401
        except Exception:
            return jsonify({
                'status': 1,
                'errorMessage': 'Authentication error'
            }), 401

        return f(*args, **kwargs)

    return wrapper



# def require_auth(f):
#     @wraps(f)
#     def wrapper(*args, **kwargs):
#         # recieve token from header
#         token = request.headers.get('Authorization')

#         if not token:
#             return jsonify({
#                 'status':  1,
#                 'errorMessage': 'Token missing'
#             }), 401
        
#         # Remove Bearer from token
#         token = token.replace("Bearer ", "").strip()
        
#         try:

#             decode = decode_token(token)
#             # Save user id in request 
#             request.user_id = decode.get("user_id")
#         except ExpiredSignatureError:
#             return jsonify({
#                 'status':  1,
#                 'errorMessage': 'Token expired'
#             }), 401
#         except InvalidTokenError:
#             return jsonify({
#                 'status':  1,
#                 'errorMessage': 'Invalid Token'
#             }), 401
#         except Exception as e:
#             return jsonify({
#                 'status':  1,
#                 'errorMessage': 'Authentication error'
#             }), 401
        
#         return f(*args, **kwargs)
    
#     return wrapper
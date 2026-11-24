import datetime
import os
from functools import wraps

import jwt
from flask import jsonify, request
from jwt import ExpiredSignatureError, InvalidTokenError

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "9876543210")
TOKEN_DURATION_MINUTES = 60 * 10


def generate_token(user_id, role):
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=TOKEN_DURATION_MINUTES),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


def _read_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return None

    if not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header[7:].strip()
    return token or None


def _read_auth_token():
    header_token = _read_bearer_token()
    if header_token:
        return header_token

    cookie_token = request.cookies.get("auth_token")
    return cookie_token or None


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = _read_auth_token()

        if not token:
            return jsonify({
                "status": 1,
                "errorMessage": "Not authenticated"
            }), 401

        try:
            decoded = decode_token(token)
            request.user_id = decoded.get("user_id")
            request.user_role = str(decoded.get("role") or "").lower()

            if not request.user_id:
                return jsonify({
                    "status": 1,
                    "errorMessage": "Invalid Session"
                }), 401

        except ExpiredSignatureError:
            return jsonify({
                "status": 1,
                "errorMessage": "Session Expired"
            }), 401
        except InvalidTokenError:
            return jsonify({
                "status": 1,
                "errorMessage": "Invalid Session"
            }), 401
        except Exception:
            return jsonify({
                "status": 1,
                "errorMessage": "Authentication error"
            }), 401

        return f(*args, **kwargs)

    return wrapper


def require_roles(*allowed_roles):
    normalized_roles = {str(role).strip().lower() for role in allowed_roles if str(role).strip()}

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            current_role = str(getattr(request, "user_role", "") or "").lower()
            if current_role not in normalized_roles:
                return jsonify({
                    "status": 1,
                    "errorMessage": "Forbidden"
                }), 403
            return f(*args, **kwargs)

        return wrapper

    return decorator


STAFF_ROLES = ("staff", "admin")


def is_staff_request():
    """True when the authenticated caller is staff or admin (call after @require_auth)."""
    return str(getattr(request, "user_role", "") or "").lower() in STAFF_ROLES

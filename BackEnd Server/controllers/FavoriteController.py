from flask import Blueprint, request
from models.Favorite import Favorite
from security.auth import require_auth
from utils import ok, fail, handle_errors

# Exported to server.py
favorite_bp = Blueprint('favorite_bp', __name__)

# The owner comes from the cookie (request.user_id), never the body,
# so nobody can read or edit somebody else's list

# ===== GET /favorites =====
@favorite_bp.route('/favorites', methods=['GET'])
@require_auth
@handle_errors
def get_favorites():
    return ok(Favorite.get_by_user_id(request.user_id))

# ===== POST /favorites =====
@favorite_bp.route('/favorites', methods=['POST'])
@require_auth
@handle_errors
def add_favorite():
    data = request.get_json(silent=True) or {}
    place_id = (data.get('placeId') or '').strip()

    if not place_id:
        return fail("placeId is required", 400)

    f = Favorite([])
    f.userId = request.user_id
    f.placeId = place_id
    f.add()

    return ok(message="Favorite added successfully.")

# ===== DELETE /favorites/<place_id> =====
@favorite_bp.route('/favorites/<place_id>', methods=['DELETE'])
@require_auth
@handle_errors
def delete_favorite(place_id):
    Favorite.delete(request.user_id, place_id)
    return ok(message="Favorite removed successfully.")

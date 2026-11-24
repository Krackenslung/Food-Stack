"""POST /api/auth/google: exchange a Google ID token for the same FoodStack session that
password login creates (HttpOnly cookie)."""

from flask import Blueprint, current_app, jsonify, request

from backend.errors import AppError, ValidationError

auth_bp = Blueprint("auth_bp", __name__)

SESSION_SECONDS = 60 * 60 * 10


@auth_bp.route("/auth/google", methods=["POST"])
def google_login():
    services = current_app.extensions.get("foodstack_services")
    if services is None or services.auth is None:
        raise AppError(
            "Google sign-in is not available.", error_code="GOOGLE_NOT_CONFIGURED", http_status=503
        )

    body = request.get_json(silent=True)
    token = body.get("idToken") if isinstance(body, dict) else None
    if not isinstance(token, str) or not token.strip():
        raise ValidationError("idToken is required.", error_code="ID_TOKEN_REQUIRED")

    result = services.auth.login_with_google(token.strip())

    response = jsonify({"status": 0, "data": {"user": result["user"]}})
    response.set_cookie(
        "auth_token",
        result["token"],
        httponly=True,
        secure=current_app.config["FOODSTACK"].is_production,
        samesite="Lax",
        max_age=SESSION_SECONDS,
    )
    return response

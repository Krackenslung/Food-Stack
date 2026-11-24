"""Customer app API: store, menu, product detail, order detail, my orders, account.

This blueprint is registered before the legacy ones. Three paths (GET /products/<id>,
GET /orders/<id>, GET /session) also exist in the legacy controllers with a different response
shape; when the SQL services are not enabled they fall through to the legacy handler so the old
behaviour is unchanged.
"""

from flask import Blueprint, current_app, jsonify, make_response, request

from backend.errors import AppError
from backend.Infrastructure.sql_admin import lang_of
from backend.Security.Auth import require_auth

public_bp = Blueprint("public_bp", __name__)

SESSION_SECONDS = 60 * 60 * 10


def _services():
    return current_app.extensions.get("foodstack_services")


def _need(attr: str):
    service = getattr(_services(), attr, None) if _services() else None
    if service is None:
        raise AppError("This API is not available.", error_code="NOT_CONFIGURED", http_status=503)
    return service


def _legacy(endpoint: str, **kwargs):
    return current_app.view_functions[endpoint](**kwargs)


def _enabled(attr: str) -> bool:
    return _services() is not None and getattr(_services(), attr, None) is not None


def _ok(data, status=200):
    return jsonify({"status": 0, "data": data}), status


def _lang():
    header = request.headers.get("Accept-Language", "")[:2].lower()
    return lang_of(request.args.get("lang") or header)


def _int(name, default):
    try:
        return int(request.args.get(name, default))
    except ValueError:
        return default


def _body() -> dict:
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def _with_cookie(payload: dict, status=200):
    """Envelope with the user only; the token travels as an HttpOnly cookie."""
    response = make_response(jsonify({"status": 0, "data": {"user": payload["user"]}}), status)
    response.set_cookie(
        "auth_token",
        payload["token"],
        httponly=True,
        secure=current_app.config["FOODSTACK"].is_production,
        samesite="Lax",
        max_age=SESSION_SECONDS,
    )
    return response


# ---- public -------------------------------------------------------------------------------


@public_bp.route("/store", methods=["GET"])
def store():
    return _ok(_need("public").store())


@public_bp.route("/menu", methods=["GET"])
def menu():
    return _ok(_need("public").menu(_lang()))


@public_bp.route("/products/<int:product_id>", methods=["GET"])
def product(product_id):
    if not _enabled("public"):
        return _legacy("product_bp.get_product", product_id=product_id)
    return _ok(_need("public").product(product_id, _lang()))


# ---- account ------------------------------------------------------------------------------


@public_bp.route("/auth/login", methods=["POST"])
def login():
    body = _body()
    return _with_cookie(_need("account").login(body.get("email"), body.get("password")))


@public_bp.route("/auth/signup", methods=["POST"])
def signup():
    return _with_cookie(_need("account").signup(_body()), 201)


@public_bp.route("/auth/logout", methods=["POST"])
def logout():
    response = make_response(jsonify({"status": 0, "data": {"message": "Logged out"}}))
    response.delete_cookie("auth_token")
    return response


@public_bp.route("/session", methods=["GET"])
def session():
    if not _enabled("account"):
        return _legacy("user_bp.get_session")
    return _session_authenticated()


@require_auth
def _session_authenticated():
    return _ok(_need("account").me(int(request.user_id)))


@public_bp.route("/me", methods=["PATCH"])
@require_auth
def update_me():
    return _ok(_need("account").update_me(int(request.user_id), _body()))


# ---- orders -------------------------------------------------------------------------------


@public_bp.route("/me/orders", methods=["GET"])
@require_auth
def my_orders():
    return _ok(
        _need("public").my_orders(
            int(request.user_id),
            request.args.get("status"),
            _int("page", 1),
            _int("pageSize", 5),
            _lang(),
        )
    )


@public_bp.route("/orders/<int:order_id>", methods=["GET"])
def order(order_id):
    if not _enabled("admin"):
        return _legacy("order_bp.get_by_id", id=order_id)
    return _order_authenticated(order_id)


@require_auth
def _order_authenticated(order_id):
    return _ok(
        _need("admin").order_detail(order_id, _lang(), int(request.user_id), request.user_role)
    )

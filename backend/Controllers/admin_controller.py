"""Kitchen board, admin orders/products/dashboard. Thin: parse input, call AdminService, envelope.

``GET /orders/<id>`` is intentionally not here: the legacy order controller owns that path until
Phase 7 replaces it, so the order detail is exposed at ``/orders/<id>/detail`` for now.
"""

from flask import Blueprint, current_app, jsonify, request

from backend.errors import AppError
from backend.Infrastructure.sql_admin import lang_of
from backend.Security.Auth import require_auth, require_roles

admin_bp = Blueprint("admin_bp", __name__)


def _service():
    services = current_app.extensions.get("foodstack_services")
    if services is None or services.admin is None:
        raise AppError("Admin API is not available.", error_code="NOT_CONFIGURED", http_status=503)
    return services.admin


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


# ---- kitchen & status ---------------------------------------------------------------------


@admin_bp.route("/kitchen/orders", methods=["GET"])
@require_auth
@require_roles("staff", "admin")
def kitchen():
    return _ok(_service().kitchen(_lang()))


@admin_bp.route("/orders/<int:order_id>/status", methods=["PATCH"])
@require_auth
@require_roles("staff", "admin")
def set_status(order_id):
    target = _body().get("status")
    return _ok(_service().set_status(order_id, target, request.user_role, int(request.user_id)))


@admin_bp.route("/orders/<int:order_id>/detail", methods=["GET"])
@require_auth
def order_detail(order_id):
    return _ok(_service().order_detail(order_id, _lang(), int(request.user_id), request.user_role))


# ---- admin ----------------------------------------------------------------------------------


@admin_bp.route("/admin/dashboard", methods=["GET"])
@require_auth
@require_roles("admin")
def dashboard():
    return _ok(_service().dashboard(request.args.get("range", "7d"), _lang()))


@admin_bp.route("/admin/orders", methods=["GET"])
@require_auth
@require_roles("admin")
def admin_orders():
    return _ok(
        _service().orders_page(
            request.args.get("status"), _int("page", 1), _int("pageSize", 10), _lang()
        )
    )


@admin_bp.route("/admin/ingredients", methods=["GET"])
@require_auth
@require_roles("admin")
def ingredients():
    return _ok(_service().ingredients(_lang()))


@admin_bp.route("/admin/products", methods=["GET"])
@require_auth
@require_roles("admin")
def products():
    return _ok(
        _service().products_page(
            request.args.get("category"),
            request.args.get("q"),
            _int("page", 1),
            _int("pageSize", 10),
            _lang(),
        )
    )


@admin_bp.route("/admin/products", methods=["POST"])
@require_auth
@require_roles("admin")
def create_product():
    return _ok(_service().save_product(None, _body()), 201)


@admin_bp.route("/admin/products/<int:product_id>", methods=["GET"])
@require_auth
@require_roles("admin")
def get_product(product_id):
    return _ok(_service().get_product(product_id))


@admin_bp.route("/admin/products/<int:product_id>", methods=["PUT"])
@require_auth
@require_roles("admin")
def update_product(product_id):
    return _ok(_service().save_product(product_id, _body()))


@admin_bp.route("/admin/products/<int:product_id>", methods=["PATCH"])
@require_auth
@require_roles("admin")
def toggle_product(product_id):
    return _ok(_service().set_available(product_id, _body().get("isAvailable")))


@admin_bp.route("/admin/products/<int:product_id>", methods=["DELETE"])
@require_auth
@require_roles("admin")
def delete_product(product_id):
    return _ok(_service().delete_product(product_id))


@admin_bp.route("/admin/products/<int:product_id>/image", methods=["POST"])
@require_auth
@require_roles("admin")
def upload_image(product_id):
    file = request.files.get("image")
    if file is None:
        return _ok(_service().upload_image(product_id, b"", ""), 200)
    return _ok(_service().upload_image(product_id, file.read(MAX_READ + 1), file.mimetype or ""))


MAX_READ = 5 * 1024 * 1024

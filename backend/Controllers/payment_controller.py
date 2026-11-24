"""Quote, checkout, Stripe webhook, refunds and cancellation. Controllers only parse input and
return the envelope: all rules live in the services."""

from flask import Blueprint, current_app, jsonify, request

from backend.errors import AppError
from backend.Security.Auth import get_optional_user_id, require_auth, require_roles

payment_bp = Blueprint("payment_bp", __name__)


def _services():
    services = current_app.extensions.get("foodstack_services")
    if services is None or services.checkout is None:
        raise AppError(
            "Checkout is not available yet.", error_code="NOT_CONFIGURED", http_status=503
        )
    return services


def _payments():
    payments = _services().payments
    if payments is None:
        raise AppError("Card payments are not available.", error_code="PAYMENTS_NOT_CONFIGURED", http_status=503)
    return payments


def _ok(data, status=200):
    return jsonify({"status": 0, "data": data}), status


def _json_body() -> dict:
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


@payment_bp.route("/cart/quote", methods=["POST"])
def quote():
    return _ok(_services().checkout.quote(_json_body(), get_optional_user_id()))


@payment_bp.route("/checkout", methods=["POST"])
@require_auth
@require_roles("customer")
def checkout():
    return _ok(_services().checkout.place_order(_json_body(), int(request.user_id)), 201)


@payment_bp.route("/payments/webhook", methods=["POST"])
def stripe_webhook():
    # Raw bytes: the signature covers the exact payload. No auth/CSRF: Stripe calls this.
    outcome = _payments().handle_webhook(
        request.get_data(), request.headers.get("Stripe-Signature", "")
    )
    return _ok({"result": outcome})


@payment_bp.route("/orders/<int:order_id>/cancel", methods=["POST"])
@require_auth
def cancel_order(order_id):
    body = _json_body()
    return _ok(
        _payments().cancel_order(
            order_id, request.user_role, int(request.user_id), body.get("reason")
        )
    )


@payment_bp.route("/orders/<int:order_id>/refund", methods=["POST"])
@require_auth
@require_roles("admin")
def refund_order(order_id):
    return _ok(_payments().refund_order(order_id, _json_body().get("amount")))

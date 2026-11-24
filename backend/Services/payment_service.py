"""Card payments: PaymentIntents, the Stripe webhook, refunds and cancellation of paid orders.

Rules (CLAUDE.md "Stripe payments"):
- The webhook is the ONLY source of truth for "paid". It is idempotent: every Stripe event id is
  claimed in Stripe_Events before it is processed, and released again if processing fails so
  Stripe's retry can run it.
- Amounts are DECIMAL(10,2) in the database and integer cents only at the Stripe boundary.
- Never log card data or full Stripe objects.
"""

import logging
from decimal import Decimal

from backend.errors import AppError, ConflictError, RecordNotFoundException, ValidationError
from backend.Services import order_service as orders
from backend.Services.ports import OrderRecord, OrderRepository, PaymentGateway, PaymentIntentResult

logger = logging.getLogger(__name__)

HANDLED_EVENTS = {"payment_intent.succeeded", "payment_intent.payment_failed"}


class PaymentService:
    def __init__(self, gateway: PaymentGateway, repo: OrderRepository):
        self._gateway = gateway
        self._repo = repo

    # ---- creating the payment -------------------------------------------------------------

    def start_card_payment(self, order: OrderRecord) -> PaymentIntentResult:
        """Create the PaymentIntent for a freshly created ``pending_payment`` order."""
        if order.payment_method != "card":
            raise ConflictError("This order is not paid by card.", error_code="ORDER_NOT_CARD")
        if order.status != orders.PENDING_PAYMENT or order.payment_status not in (
            "unpaid",
            "failed",
        ):
            raise ConflictError(
                "This order is not awaiting payment.", error_code="ORDER_NOT_PAYABLE"
            )

        intent = self._gateway.create_payment_intent(
            amount_cents=orders.to_cents(order.total),
            currency=order.currency,
            order_id=order.id,
            # Retrying the same order returns the same intent instead of creating a second one.
            idempotency_key=f"order-{order.id}-intent",
        )
        self._repo.save_payment_intent(order.id, intent.id)
        return intent

    # ---- webhook --------------------------------------------------------------------------

    def handle_webhook(self, payload: bytes, signature: str) -> str:
        """Verify and process one Stripe event. Returns a short outcome label for logs/tests."""
        event = self._gateway.parse_webhook(payload, signature)
        event_type = event.get("type")
        if event_type not in HANDLED_EVENTS:
            return "ignored"

        intent = (event.get("data") or {}).get("object") or {}
        order_id = _order_id_of(intent)

        if not self._repo.claim_stripe_event(str(event.get("id")), event_type, order_id):
            return "duplicate"

        try:
            return self._apply(event_type, intent, order_id)
        except Exception:
            # Let Stripe retry: the claim must not survive a failed attempt.
            self._repo.release_stripe_event(str(event.get("id")))
            raise

    def _apply(self, event_type: str, intent: dict, order_id: int | None) -> str:
        order = self._repo.get_order(order_id) if order_id is not None else None
        if order is None:
            logger.warning("Stripe event for unknown order %s", order_id)
            return "unknown_order"

        if event_type == "payment_intent.payment_failed":
            if order.payment_status != "paid":
                self._repo.mark_payment_failed(order.id, str(intent.get("id")))
            return "failed"

        # payment_intent.succeeded
        received = intent.get("amount_received", intent.get("amount"))
        currency = str(intent.get("currency", "")).lower()
        if received != orders.to_cents(order.total) or currency != order.currency.lower():
            # Never trust a payment that does not match what the server priced.
            logger.error("Stripe amount mismatch for order %s", order.id)
            return "amount_mismatch"

        if order.payment_status == "paid":
            return "already_paid"

        if order.status == orders.CANCELLED:
            # Paid after the customer cancelled: give the money straight back.
            refund = self._gateway.create_refund(
                payment_intent_id=str(intent["id"]),
                amount_cents=orders.to_cents(order.total),
                idempotency_key=f"late-payment-{order.id}",
            )
            self._repo.record_late_payment_refunded(
                order.id, intent_id=str(intent["id"]), refund_id=refund.id, amount=order.total
            )
            return "refunded_late_payment"

        orders.validate_transition(order.status, orders.RECEIVED, "system")
        self._repo.mark_paid(order.id, intent_id=str(intent["id"]), amount=order.total)
        return "paid"

    # ---- refunds and cancellation ---------------------------------------------------------

    def refund_order(self, order_id: int, amount: Decimal | str | None = None) -> dict:
        """Admin refund (full by default). A full refund also cancels the order when the state
        machine still allows it (pending_payment / received)."""
        order = self._require_order(order_id)
        full, refund_id, refunded = self._refund(order, amount)

        cancelled = False
        if full and order.status in (orders.PENDING_PAYMENT, orders.RECEIVED):
            self._repo.mark_cancelled(order.id, actor_user_id=None, reason="refund")
            cancelled = True

        return {
            "refundId": refund_id,
            "amount": str(refunded),
            "full": full,
            "cancelled": cancelled,
        }

    def cancel_order(
        self, order_id: int, actor_role: str, actor_user_id: int | None, reason: str | None = None
    ) -> dict:
        """Cancel an order. A paid card order is refunded automatically."""
        order = self._require_order(order_id)
        if actor_role == "customer" and order.user_id != actor_user_id:
            raise AppError("Forbidden", error_code="FORBIDDEN", http_status=403)
        orders.validate_transition(order.status, orders.CANCELLED, actor_role)

        refunded = None
        if order.payment_method == "card" and order.payment_status == "paid":
            _, _, amount = self._refund(order, None)
            refunded = str(amount)

        self._repo.mark_cancelled(order.id, actor_user_id=actor_user_id, reason=reason)
        return {"status": orders.CANCELLED, "refunded": refunded}

    def _refund(self, order: OrderRecord, amount) -> tuple[bool, str, Decimal]:
        if (
            order.payment_method != "card"
            or order.payment_status != "paid"
            or not order.stripe_payment_intent_id
        ):
            raise ConflictError(
                "This order has nothing to refund.", error_code="ORDER_NOT_REFUNDABLE"
            )

        already = self._repo.total_refunded(order.id)
        remaining = order.total - already
        value = remaining if amount is None else orders.money(amount)
        if value <= 0 or value > remaining:
            raise ValidationError(
                "Refund amount must be between 0.01 and the remaining balance.",
                error_code="REFUND_AMOUNT_INVALID",
            )

        refund = self._gateway.create_refund(
            payment_intent_id=order.stripe_payment_intent_id,
            amount_cents=orders.to_cents(value),
            # Same order + same amount + same history => same refund (safe to retry).
            idempotency_key=f"refund-{order.id}-{orders.to_cents(already)}-{orders.to_cents(value)}",
        )
        full = already + value == order.total
        self._repo.record_refund(order.id, refund_id=refund.id, amount=value, full=full)
        return full, refund.id, value

    def _require_order(self, order_id: int) -> OrderRecord:
        order = self._repo.get_order(order_id)
        if order is None:
            raise RecordNotFoundException(f"Order {order_id} not found.")
        return order


def _order_id_of(intent: dict) -> int | None:
    try:
        return int((intent.get("metadata") or {}).get("order_id"))
    except (TypeError, ValueError):
        return None

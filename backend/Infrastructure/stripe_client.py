"""Thin Stripe adapter. Only the payment service talks to this; nothing else imports ``stripe``."""

import json

from backend.errors import AppError
from backend.Services.ports import PaymentIntentResult, RefundResult

WEBHOOK_TOLERANCE_SECONDS = 300


class StripeGateway:
    """Implements the PaymentGateway protocol on top of the Stripe SDK."""

    def __init__(self, secret_key: str, webhook_secret: str, client=None):
        self._webhook_secret = webhook_secret
        if client is None:
            import stripe

            client = stripe.StripeClient(secret_key)
        self._client = client

    def create_payment_intent(
        self, *, amount_cents: int, currency: str, order_id: int, idempotency_key: str
    ) -> PaymentIntentResult:
        intent = self._client.payment_intents.create(
            params={
                "amount": amount_cents,
                "currency": currency.lower(),
                # Apple Pay / Google Pay come with the Payment Element automatically.
                "automatic_payment_methods": {"enabled": True},
                "metadata": {"order_id": str(order_id)},
            },
            options={"idempotency_key": idempotency_key},
        )
        return PaymentIntentResult(id=intent.id, client_secret=intent.client_secret)

    def create_refund(
        self, *, payment_intent_id: str, amount_cents: int, idempotency_key: str
    ) -> RefundResult:
        refund = self._client.refunds.create(
            params={"payment_intent": payment_intent_id, "amount": amount_cents},
            options={"idempotency_key": idempotency_key},
        )
        return RefundResult(id=refund.id, status=refund.status)

    def parse_webhook(self, payload: bytes, signature: str) -> dict:
        import stripe

        try:
            stripe.WebhookSignature.verify_header(
                payload.decode("utf-8"),
                signature or "",
                self._webhook_secret,
                WEBHOOK_TOLERANCE_SECONDS,
            )
            return json.loads(payload)
        except (stripe.SignatureVerificationError, ValueError, UnicodeDecodeError) as exc:
            raise AppError(
                "Invalid webhook signature.", error_code="INVALID_SIGNATURE", http_status=400
            ) from exc

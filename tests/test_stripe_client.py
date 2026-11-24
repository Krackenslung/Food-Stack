import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest

from backend.errors import AppError
from backend.Infrastructure.stripe_client import StripeGateway

SECRET = "whsec_test_secret"


class FakeStripeClient:
    """Mimics the parts of stripe.StripeClient the gateway uses."""

    def __init__(self):
        self.calls = []
        client = self

        class PaymentIntents:
            def create(self, params, options):
                client.calls.append(("payment_intents.create", params, options))
                return SimpleNamespace(id="pi_123", client_secret="pi_123_secret_abc")

        class Refunds:
            def create(self, params, options):
                client.calls.append(("refunds.create", params, options))
                return SimpleNamespace(id="re_123", status="succeeded")

        self.payment_intents = PaymentIntents()
        self.refunds = Refunds()


def sign(payload: bytes, secret: str = SECRET, timestamp: int | None = None) -> str:
    timestamp = int(time.time()) if timestamp is None else timestamp
    signed = f"{timestamp}.".encode() + payload
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


@pytest.fixture
def client():
    return FakeStripeClient()


@pytest.fixture
def gateway(client):
    return StripeGateway("sk_test_x", SECRET, client=client)


def test_payment_intents_carry_the_order_id_and_an_idempotency_key(gateway, client):
    intent = gateway.create_payment_intent(
        amount_cents=2880, currency="USD", order_id=42, idempotency_key="order-42-intent"
    )
    assert (intent.id, intent.client_secret) == ("pi_123", "pi_123_secret_abc")

    name, params, options = client.calls[0]
    assert name == "payment_intents.create"
    assert params == {
        "amount": 2880,
        "currency": "usd",
        "automatic_payment_methods": {"enabled": True},
        "metadata": {"order_id": "42"},
    }
    assert options == {"idempotency_key": "order-42-intent"}


def test_refunds_target_the_payment_intent(gateway, client):
    refund = gateway.create_refund(
        payment_intent_id="pi_123", amount_cents=500, idempotency_key="refund-42-0-500"
    )
    assert (refund.id, refund.status) == ("re_123", "succeeded")
    assert client.calls[0][1] == {"payment_intent": "pi_123", "amount": 500}
    assert client.calls[0][2] == {"idempotency_key": "refund-42-0-500"}


def test_a_correctly_signed_webhook_is_parsed(gateway):
    payload = json.dumps({"id": "evt_1", "type": "payment_intent.succeeded"}).encode()
    assert gateway.parse_webhook(payload, sign(payload))["id"] == "evt_1"


@pytest.mark.parametrize(
    "tamper",
    [
        lambda payload, header: (payload + b" ", header),  # body changed after signing
        lambda payload, header: (payload, header.replace("v1=", "v1=0")),  # bad digest
        lambda payload, header: (payload, ""),  # missing header
        lambda payload, header: (payload, sign(payload, "whsec_other")),  # wrong secret
        lambda payload, header: (
            payload,
            sign(payload, timestamp=int(time.time()) - 3600),
        ),  # replay
    ],
)
def test_forged_or_stale_webhooks_are_rejected(gateway, tamper):
    payload = json.dumps({"id": "evt_1"}).encode()
    bad_payload, bad_header = tamper(payload, sign(payload))
    with pytest.raises(AppError) as exc:
        gateway.parse_webhook(bad_payload, bad_header)
    assert exc.value.error_code == "INVALID_SIGNATURE"
    assert exc.value.http_status == 400

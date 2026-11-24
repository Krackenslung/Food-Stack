from decimal import Decimal

import pytest

from backend.errors import AppError, ConflictError, RecordNotFoundException, ValidationError
from backend.Services.payment_service import PaymentService
from backend.Services.ports import OrderRecord
from tests.fakes import VALID_SIGNATURE, FakeGateway, MemoryRepo, event, make_catalog


def card_order(
    repo, *, total="28.80", status="pending_payment", payment_status="unpaid", user_id=5
):
    order = OrderRecord(
        id=len(repo.orders) + 1,
        user_id=user_id,
        total=Decimal(total),
        currency="USD",
        status=status,
        payment_status=payment_status,
        payment_method="card",
        stripe_payment_intent_id="pi_1",
    )
    repo.orders[order.id] = order
    repo.drafts[order.id] = {"items": [{"product_id": 5, "quantity": 1}]}
    return order


@pytest.fixture
def repo():
    return make_catalog(MemoryRepo())


@pytest.fixture
def gateway():
    return FakeGateway()


@pytest.fixture
def service(gateway, repo):
    return PaymentService(gateway, repo)


def webhook(service, payload):
    return service.handle_webhook(payload, VALID_SIGNATURE)


# ---- starting a payment -------------------------------------------------------------------


def test_start_card_payment_uses_cents_and_an_idempotency_key(service, gateway, repo):
    order = card_order(repo)
    order.stripe_payment_intent_id = None
    intent = service.start_card_payment(order)

    assert gateway.intents == [
        {
            "amount_cents": 2880,
            "currency": "USD",
            "order_id": order.id,
            "idempotency_key": f"order-{order.id}-intent",
        }
    ]
    assert order.stripe_payment_intent_id == intent.id


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"payment_method": "counter"}, "ORDER_NOT_CARD"),
        ({"status": "received"}, "ORDER_NOT_PAYABLE"),
        ({"payment_status": "paid"}, "ORDER_NOT_PAYABLE"),
    ],
)
def test_start_card_payment_rejects_the_wrong_kind_of_order(service, repo, overrides, code):
    order = card_order(repo)
    for key, value in overrides.items():
        setattr(order, key, value)
    with pytest.raises(ConflictError) as exc:
        service.start_card_payment(order)
    assert exc.value.error_code == code


# ---- webhook: payment succeeded -----------------------------------------------------------


def test_succeeded_event_marks_the_order_paid_and_received(service, repo):
    order = card_order(repo)
    assert (
        webhook(service, event("evt_1", "payment_intent.succeeded", order.id, amount=2880))
        == "paid"
    )
    assert order.payment_status == "paid"
    assert order.status == "received"
    assert repo.history[-1] == (order.id, "received")
    assert repo.payments == [{"order": order.id, "kind": "charge", "amount": Decimal("28.80")}]


def test_paying_consumes_stock_and_the_promo_exactly_once(service, repo):
    order = card_order(repo)
    order.promo_code_id = 1
    repo.products[5].stock = 2

    webhook(service, event("evt_1", "payment_intent.succeeded", order.id, amount=2880))
    # Stripe re-sends the same event, and may also send a second succeeded event.
    webhook(service, event("evt_1", "payment_intent.succeeded", order.id, amount=2880))
    webhook(service, event("evt_2", "payment_intent.succeeded", order.id, amount=2880))

    assert repo.products[5].stock == 1
    assert repo.promos["FOODSTACK20"].times_redeemed == 1


def test_duplicate_event_ids_are_skipped(service, repo):
    order = card_order(repo)
    payload = event("evt_1", "payment_intent.succeeded", order.id, amount=2880)
    assert webhook(service, payload) == "paid"
    assert webhook(service, payload) == "duplicate"
    assert len(repo.payments) == 1


def test_a_second_succeeded_event_for_a_paid_order_changes_nothing(service, repo):
    order = card_order(repo)
    webhook(service, event("evt_1", "payment_intent.succeeded", order.id, amount=2880))
    assert (
        webhook(service, event("evt_2", "payment_intent.succeeded", order.id, amount=2880))
        == "already_paid"
    )
    assert len(repo.payments) == 1


@pytest.mark.parametrize(
    ("amount", "currency"),
    [(2879, "usd"), (1, "usd"), (2880, "mxn")],
)
def test_a_payment_that_does_not_match_the_server_total_is_never_marked_paid(
    service, repo, amount, currency
):
    order = card_order(repo)
    result = webhook(
        service,
        event("evt_1", "payment_intent.succeeded", order.id, amount=amount, currency=currency),
    )
    assert result == "amount_mismatch"
    assert order.payment_status == "unpaid"
    assert order.status == "pending_payment"


def test_a_failed_attempt_to_process_releases_the_event_so_stripe_can_retry(service, repo):
    order = card_order(repo)
    payload = event("evt_1", "payment_intent.succeeded", order.id, amount=2880)

    repo.fail_mark_paid = True
    with pytest.raises(RuntimeError):
        webhook(service, payload)
    assert "evt_1" not in repo.events
    assert order.payment_status == "unpaid"

    repo.fail_mark_paid = False
    assert webhook(service, payload) == "paid"


def test_payment_after_cancellation_is_refunded_immediately(service, gateway, repo):
    order = card_order(repo, status="cancelled")
    assert (
        webhook(service, event("evt_1", "payment_intent.succeeded", order.id, amount=2880))
        == "refunded_late_payment"
    )
    assert gateway.refunds[0]["amount_cents"] == 2880
    assert gateway.refunds[0]["idempotency_key"] == f"late-payment-{order.id}"
    assert order.payment_status == "refunded"


# ---- webhook: other events ----------------------------------------------------------------


def test_failed_payment_keeps_the_order_awaiting_payment(service, repo):
    order = card_order(repo)
    assert (
        webhook(service, event("evt_1", "payment_intent.payment_failed", order.id, amount=2880))
        == "failed"
    )
    assert order.payment_status == "failed"
    assert order.status == "pending_payment"


def test_a_late_failure_never_downgrades_a_paid_order(service, repo):
    order = card_order(repo, status="received", payment_status="paid")
    webhook(service, event("evt_1", "payment_intent.payment_failed", order.id, amount=2880))
    assert order.payment_status == "paid"


def test_unknown_orders_and_unhandled_events_are_acknowledged_without_side_effects(service, repo):
    assert (
        webhook(service, event("evt_1", "payment_intent.succeeded", 999, amount=100))
        == "unknown_order"
    )
    assert webhook(service, event("evt_2", "charge.dispute.created", 1)) == "ignored"
    assert "evt_2" not in repo.events
    no_metadata = (
        b'{"id":"evt_3","type":"payment_intent.succeeded","data":{"object":{"id":"pi_9"}}}'
    )
    assert webhook(service, no_metadata) == "unknown_order"


def test_a_bad_signature_is_rejected_before_anything_is_read(service, repo):
    order = card_order(repo)
    with pytest.raises(AppError) as exc:
        service.handle_webhook(
            event("evt_1", "payment_intent.succeeded", order.id, amount=2880), "forged"
        )
    assert exc.value.http_status == 400
    assert repo.events == set()


# ---- refunds ------------------------------------------------------------------------------


def test_full_refund_refunds_cancels_and_restores_stock(service, gateway, repo):
    order = card_order(repo)
    webhook(service, event("evt_1", "payment_intent.succeeded", order.id, amount=2880))
    stock_after_payment = repo.products[5].stock

    result = service.refund_order(order.id)
    assert result == {"refundId": "re_1", "amount": "28.80", "full": True, "cancelled": True}
    assert gateway.refunds[0]["amount_cents"] == 2880
    assert order.status == "cancelled"
    assert order.payment_status == "refunded"
    assert (
        repo.products[5].stock == (stock_after_payment or 0) + 1
        if stock_after_payment is not None
        else True
    )


def test_partial_refunds_accumulate_and_the_last_one_completes_the_refund(service, gateway, repo):
    order = card_order(repo, status="received", payment_status="paid")
    first = service.refund_order(order.id, "10.00")
    assert first["full"] is False and first["cancelled"] is False
    assert order.payment_status == "paid" and order.status == "received"

    second = service.refund_order(order.id)  # the remaining 18.80
    assert second["amount"] == "18.80" and second["full"] is True
    assert order.payment_status == "refunded"
    # Different history -> different idempotency key, so Stripe treats them as separate refunds.
    assert gateway.refunds[0]["idempotency_key"] != gateway.refunds[1]["idempotency_key"]


@pytest.mark.parametrize("amount", ["0", "-1", "28.81", "100"])
def test_refund_amount_must_be_within_the_remaining_balance(service, repo, amount):
    order = card_order(repo, status="received", payment_status="paid")
    with pytest.raises(ValidationError) as exc:
        service.refund_order(order.id, amount)
    assert exc.value.error_code == "REFUND_AMOUNT_INVALID"


def test_a_refund_past_the_balance_is_rejected_after_a_partial_refund(service, repo):
    order = card_order(repo, status="received", payment_status="paid")
    service.refund_order(order.id, "20.00")
    with pytest.raises(ValidationError):
        service.refund_order(order.id, "10.00")


def test_only_paid_card_orders_can_be_refunded(service, repo):
    unpaid = card_order(repo)
    with pytest.raises(ConflictError):
        service.refund_order(unpaid.id)
    counter = card_order(repo, status="received", payment_status="pay_at_counter")
    counter.payment_method = "counter"
    with pytest.raises(ConflictError) as exc:
        service.refund_order(counter.id)
    assert exc.value.error_code == "ORDER_NOT_REFUNDABLE"
    with pytest.raises(RecordNotFoundException):
        service.refund_order(999)


def test_refunding_an_order_already_in_the_kitchen_returns_money_but_keeps_the_status(
    service, repo
):
    order = card_order(repo, status="preparing", payment_status="paid")
    result = service.refund_order(order.id)
    assert result["full"] is True and result["cancelled"] is False
    assert order.status == "preparing"
    assert order.payment_status == "refunded"


# ---- cancelling ---------------------------------------------------------------------------


def test_a_customer_cancelling_a_paid_order_gets_an_automatic_refund(service, gateway, repo):
    order = card_order(repo, status="received", payment_status="paid")
    result = service.cancel_order(order.id, "customer", 5, "changed my mind")
    assert result == {"status": "cancelled", "refunded": "28.80"}
    assert gateway.refunds[0]["amount_cents"] == 2880
    assert order.status == "cancelled"


def test_customers_cannot_cancel_after_the_kitchen_accepts_or_cancel_other_peoples_orders(
    service, repo
):
    kitchen = card_order(repo, status="preparing", payment_status="paid")
    with pytest.raises(ConflictError) as exc:
        service.cancel_order(kitchen.id, "customer", 5)
    assert exc.value.error_code == "ORDER_INVALID_TRANSITION"  # too late: the state machine says no

    waiting = card_order(repo)  # pending_payment: customers may only cancel "received" orders
    with pytest.raises(ConflictError) as exc:
        service.cancel_order(waiting.id, "customer", 5)
    assert exc.value.http_status == 403

    mine = card_order(repo, status="received", payment_status="paid")
    with pytest.raises(AppError) as exc:
        service.cancel_order(mine.id, "customer", 99)
    assert exc.value.http_status == 403
    assert mine.status == "received"


def test_staff_can_cancel_an_unpaid_pay_at_counter_order_without_a_refund(service, gateway, repo):
    order = card_order(repo, status="received", payment_status="pay_at_counter")
    order.payment_method = "counter"
    assert service.cancel_order(order.id, "staff", 2) == {"status": "cancelled", "refunded": None}
    assert gateway.refunds == []


def test_cancelling_an_order_awaiting_payment_is_allowed_for_staff(service, repo):
    order = card_order(repo)
    assert service.cancel_order(order.id, "staff", 2)["status"] == "cancelled"

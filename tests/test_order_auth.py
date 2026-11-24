"""Auth/role guards on the order routes (no database: the Order model is stubbed)."""

import pytest

from backend.errors import RecordNotFoundException


class StubOrder:
    orders = {7: {"id": 7, "user_id": 5, "total": 10.0, "status": "received"}}

    @staticmethod
    def get_by_id(order_id):
        try:
            return StubOrder.orders[order_id]
        except KeyError:
            raise RecordNotFoundException(f"Order {order_id} not found") from None

    @staticmethod
    def get_by_user_id(user_id):
        return [o for o in StubOrder.orders.values() if o["user_id"] == user_id]


@pytest.fixture(autouse=True)
def stub_order(monkeypatch):
    monkeypatch.setattr("backend.Controllers.order_controller.Order", StubOrder)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/orders"),
        ("get", "/api/orders/7"),
        ("get", "/api/orders/user/5"),
        ("post", "/api/orders"),
        ("put", "/api/orders/7"),
        ("get", "/api/order-products"),
        ("get", "/api/order-product-ingredients"),
    ],
)
def test_anonymous_requests_are_rejected(client, method, path):
    assert getattr(client, method)(path).status_code == 401


def test_customer_cannot_list_all_orders_or_update(client, auth_header):
    headers = auth_header(5, "customer")
    assert client.get("/api/orders", headers=headers).status_code == 403
    assert client.put("/api/orders/7", json={"status": "ready"}, headers=headers).status_code == 403
    assert client.get("/api/order-products", headers=headers).status_code == 403


def test_customer_reads_only_their_own_order(client, auth_header):
    assert client.get("/api/orders/7", headers=auth_header(5, "customer")).status_code == 200
    assert client.get("/api/orders/7", headers=auth_header(6, "customer")).status_code == 403


def test_customer_lists_only_their_own_orders(client, auth_header):
    assert client.get("/api/orders/user/5", headers=auth_header(5, "customer")).status_code == 200
    assert client.get("/api/orders/user/5", headers=auth_header(6, "customer")).status_code == 403


def test_staff_can_read_any_order(client, auth_header):
    assert client.get("/api/orders/7", headers=auth_header(1, "staff")).status_code == 200
    assert client.get("/api/orders/user/5", headers=auth_header(1, "admin")).status_code == 200


def test_missing_order_is_404(client, auth_header):
    response = client.get("/api/orders/999", headers=auth_header(1, "staff"))
    assert response.status_code == 404
    assert response.get_json()["status"] == 1


def test_customer_cannot_create_an_order_for_someone_else(client, auth_header):
    response = client.post("/api/orders", json={"user_id": 9}, headers=auth_header(5, "customer"))
    assert response.status_code == 403

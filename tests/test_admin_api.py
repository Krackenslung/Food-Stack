"""HTTP-level tests of the kitchen/admin API over the real SQL repositories.

Skipped unless TEST_DATABASE names a local scratch database (see test_sql_repositories.py).
"""

import io
import os
import uuid
from datetime import UTC, datetime

import pytest

from backend.app_factory import create_app
from backend.config import load_config
from backend.Infrastructure.sql_repositories import SqlUserRepository
from backend.Security.Auth import generate_token
from backend.Services.container import build_sql_services

DATABASE = os.getenv("TEST_DATABASE")
pytestmark = pytest.mark.skipif(not DATABASE, reason="TEST_DATABASE is not set")

CONTACT = {"name": "Ana García", "phone": "+16195550148", "email": "ana@example.com"}


class FakeStorage:
    def upload_image(self, product_id, data, content_type):
        return f"https://blob.example/products/{product_id}.png"


@pytest.fixture(autouse=True)
def scratch(monkeypatch):
    if "scratch" not in (DATABASE or "").lower():
        pytest.exit("TEST_DATABASE must be a scratch database (its name must contain 'scratch').")
    monkeypatch.setenv("DATABASE", DATABASE)


@pytest.fixture
def api():
    config = load_config({})
    services = build_sql_services(config)
    services.admin._storage = FakeStorage()
    # The checkout clock must be inside opening hours whenever the tests run.
    services.checkout._clock = lambda: datetime(2026, 6, 1, 20, 0, tzinfo=UTC)
    services.admin._clock = lambda: datetime.now(UTC)
    return create_app(config, services=services).test_client()


def make_user(role="customer"):
    users = SqlUserRepository()
    user = users.create_google_user(
        email=f"u{uuid.uuid4().hex[:10]}@example.com",
        name="T",
        lastname="U",
        google_sub=uuid.uuid4().hex,
        avatar_url=None,
    )
    return user.id, {"Authorization": f"Bearer {generate_token(user.id, role)}"}


def place_order(api, headers, product_id=1, quantity=1):
    body = {
        "items": [{"productId": product_id, "quantity": quantity, "ingredients": []}],
        "fulfillmentType": "pickup",
        "contact": CONTACT,
        "paymentMethod": "counter",
    }
    response = api.post("/api/checkout", json=body, headers=headers)
    assert response.status_code == 201, response.json
    return response.json["data"]["orderId"]


def product_body(**overrides):
    body = {
        "categoryId": 1,
        "price": "9.50",
        "cost": "3.00",
        "stock": 25,
        "lowStockThreshold": 5,
        "prepTimeMin": 8,
        "prepTimeMax": 12,
        "calories": 600,
        "isAvailable": True,
        "isFeatured": False,
        "allowCustomization": True,
        "publishStatus": "active",
        "translations": {
            "en": {"name": "Test Burger", "description": "Tasty."},
            "es": {"name": "Hamburguesa de prueba", "description": "Rica."},
        },
        "ingredients": [
            {"ingredientId": 1, "default": 1, "max": 2, "extraPrice": "1.25", "removable": True}
        ],
    }
    body.update(overrides)
    return body


def test_the_kitchen_moves_an_order_through_the_state_machine(api):
    _, customer = make_user("customer")
    _, staff = make_user("staff")
    order_id = place_order(api, customer)

    board = api.get("/api/kitchen/orders", headers=staff).json["data"]
    assert order_id in [t["id"] for t in board["columns"]["received"]]

    for target in ("preparing", "ready", "completed"):
        response = api.patch(
            f"/api/orders/{order_id}/status", json={"status": target}, headers=staff
        )
        assert response.status_code == 200, response.json
    jump = api.patch(f"/api/orders/{order_id}/status", json={"status": "preparing"}, headers=staff)
    assert (jump.status_code, jump.json["errorCode"]) == (409, "ORDER_INVALID_TRANSITION")

    detail = api.get(f"/api/orders/{order_id}/detail", headers=staff).json["data"]
    assert [h["toStatus"] for h in detail["history"]] == [
        "received",
        "preparing",
        "ready",
        "completed",
    ]


def test_roles_are_enforced(api):
    _, customer = make_user("customer")
    _, staff = make_user("staff")
    order_id = place_order(api, customer)
    assert api.get("/api/kitchen/orders", headers=customer).status_code == 403
    assert api.get("/api/admin/products", headers=staff).status_code == 403
    assert api.get("/api/admin/dashboard").status_code == 401
    other_customer = make_user("customer")[1]
    assert api.get(f"/api/orders/{order_id}/detail", headers=other_customer).status_code == 404
    assert api.get(f"/api/orders/{order_id}/detail", headers=customer).status_code == 200


def test_cancelling_from_the_drawer_restores_stock(api):
    _, customer = make_user("customer")
    _, admin = make_user("admin")
    before = api.get("/api/admin/products/1", headers=admin).json["data"]["stock"]
    order_id = place_order(api, customer, quantity=2)
    assert api.get("/api/admin/products/1", headers=admin).json["data"]["stock"] == before - 2
    response = api.patch(
        f"/api/orders/{order_id}/status", json={"status": "cancelled"}, headers=admin
    )
    assert response.status_code == 200, response.json
    assert api.get("/api/admin/products/1", headers=admin).json["data"]["stock"] == before


def test_admin_orders_and_dashboard(api):
    _, customer = make_user("customer")
    _, admin = make_user("admin")
    place_order(api, customer)
    page = api.get("/api/admin/orders?page=1&pageSize=5", headers=admin).json["data"]
    assert page["total"] >= 1 and len(page["items"]) <= 5
    assert page["counts"]["all"] >= page["counts"]["received"] >= 1
    filtered = api.get("/api/admin/orders?status=received", headers=admin).json["data"]
    assert all(o["status"] == "received" for o in filtered["items"])
    dash = api.get("/api/admin/dashboard?range=7d", headers=admin).json["data"]
    assert len(dash["series"]) == 7 and dash["recentOrders"]
    assert api.get("/api/admin/dashboard?range=1y", headers=admin).status_code == 422


def test_product_crud_validation_and_soft_delete(api):
    _, admin = make_user("admin")
    created = api.post("/api/admin/products", json=product_body(), headers=admin)
    assert created.status_code == 201, created.json
    product = created.json["data"]
    assert product["sku"].startswith("SKU-") and len(product["ingredients"]) == 1

    changed = product_body(price="10.25", translations=product["translations"])
    changed["ingredients"] = [{**product["ingredients"][0], "max": 3}]
    updated = api.put(f"/api/admin/products/{product['id']}", json=changed, headers=admin)
    assert updated.status_code == 200, updated.json
    assert updated.json["data"]["price"] == "10.25"
    assert updated.json["data"]["ingredients"][0]["max"] == 3

    off = api.patch(
        f"/api/admin/products/{product['id']}", json={"isAvailable": False}, headers=admin
    )
    assert off.json["data"]["isAvailable"] is False

    bad = api.post("/api/admin/products", json=product_body(price="-1"), headers=admin)
    assert (bad.status_code, bad.json["errorCode"]) == (422, "PRICE_INVALID")
    no_name = product_body()
    no_name["translations"]["es"]["name"] = " "
    assert api.post("/api/admin/products", json=no_name, headers=admin).status_code == 422

    listing = api.get("/api/admin/products?q=Test Burger", headers=admin).json["data"]
    assert product["id"] in [row["id"] for row in listing["items"]]

    assert api.delete(f"/api/admin/products/{product['id']}", headers=admin).status_code == 200
    assert api.get(f"/api/admin/products/{product['id']}", headers=admin).status_code == 404
    assert api.delete(f"/api/admin/products/{product['id']}", headers=admin).status_code == 404


def test_image_upload_validates_type_and_stores_the_url(api):
    _, admin = make_user("admin")
    product_id = api.post("/api/admin/products", json=product_body(), headers=admin).json["data"][
        "id"
    ]
    path = f"/api/admin/products/{product_id}/image"

    wrong = api.post(
        path, data={"image": (io.BytesIO(b"GIF89a"), "x.gif", "image/gif")}, headers=admin
    )
    assert (wrong.status_code, wrong.json["errorCode"]) == (422, "IMAGE_TYPE_INVALID")

    ok = api.post(
        path, data={"image": (io.BytesIO(b"\x89PNG"), "x.png", "image/png")}, headers=admin
    )
    assert ok.status_code == 200, ok.json
    assert ok.json["data"]["imageUrl"].endswith(f"/{product_id}.png")
    assert (
        api.get(f"/api/admin/products/{product_id}", headers=admin).json["data"]["image"]
        == (ok.json["data"]["imageUrl"])
    )


def test_image_upload_without_storage_answers_503(api):
    _, admin = make_user("admin")
    api.application.extensions["foodstack_services"].admin._storage = None
    response = api.post(
        "/api/admin/products/1/image",
        data={"image": (io.BytesIO(b"\x89PNG"), "x.png", "image/png")},
        headers=admin,
    )
    assert (response.status_code, response.json["errorCode"]) == (503, "STORAGE_NOT_CONFIGURED")

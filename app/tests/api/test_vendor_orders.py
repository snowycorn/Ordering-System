from datetime import date, datetime, timezone
from contextlib import contextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import vendor_orders as vendor_orders_api


ORDER_ID = "11111111-1111-4111-8111-111111111111"
HISTORY_ORDER_ID = "22222222-2222-4222-8222-222222222222"


def order_payload(order_id: str = ORDER_ID, status: str = "confirmed", quantity: int = 1) -> dict:
    return {
        "id": order_id,
        "employee_id": 1,
        "vendor_id": 7,
        "menu_id": 42,
        "menu_name": "Lunch Box",
        "price_snapshot": 120,
        "quantity": quantity,
        "total_price": 120 * quantity,
        "order_date": date(2026, 5, 26),
        "pickup_date": date(2026, 5, 27),
        "status": status,
        "created_at": datetime(2026, 5, 26, 4, 0, tzinfo=timezone.utc),
    }


class FakeOrderService:
    def __init__(self):
        self.today_call = None
        self.history_call = None

    async def get_vendor_orders_today(self, vendor_id: int) -> list[dict]:
        self.today_call = vendor_id
        return [order_payload()]

    async def get_vendor_orders_history(self, vendor_id: int, from_dt: datetime, to_dt: datetime) -> list[dict]:
        self.history_call = (vendor_id, from_dt, to_dt)
        return [
            order_payload(order_id=ORDER_ID, status="confirmed", quantity=1),
            order_payload(order_id=HISTORY_ORDER_ID, status="cancelled", quantity=2),
        ]


@contextmanager
def make_client(user: dict):
    app = FastAPI()
    app.include_router(vendor_orders_api.router, prefix="/vendor/orders")

    service = FakeOrderService()
    app.dependency_overrides[vendor_orders_api.get_current_user] = lambda: user
    app.dependency_overrides[vendor_orders_api.get_service] = lambda: service

    with TestClient(app) as client:
        yield client, service


def test_vendor_can_get_today_orders():
    # arrange: an authenticated vendor and a fake order service
    with make_client({"user_id": 7, "role": "vendor"}) as (client, service):
        # act: receive a GET /vendor/orders/today request
        response = client.get("/vendor/orders/today")

        # assert: response should be status code 200 and use the vendor id
        assert response.status_code == 200
        assert response.json()[0]["id"] == ORDER_ID
        assert service.today_call == 7


def test_admin_can_get_vendor_order_history():
    # arrange: an authenticated admin and a fake order service
    with make_client({"user_id": 7, "role": "admin"}) as (client, service):
        # act: receive a GET /vendor/orders/history request
        response = client.get(
            "/vendor/orders/history",
            params={"from": "2026-05-01T00:00:00+00:00", "to": "2026-05-31T00:00:00+00:00"},
        )

        # assert: response should include orders, count, and parsed date filters
        vendor_id, from_dt, to_dt = service.history_call
        assert response.status_code == 200
        assert response.json()["count"] == 2
        assert [order["id"] for order in response.json()["orders"]] == [ORDER_ID, HISTORY_ORDER_ID]
        assert response.json()["orders"][1]["status"] == "cancelled"
        assert response.json()["orders"][1]["quantity"] == 2
        assert response.json()["orders"][1]["total_price"] == 240
        assert vendor_id == 7
        assert from_dt == datetime(2026, 5, 1, tzinfo=timezone.utc)
        assert to_dt == datetime(2026, 5, 31, tzinfo=timezone.utc)


def test_employee_cannot_get_vendor_orders():
    # arrange: an authenticated employee and a fake order service
    with make_client({"user_id": 1, "role": "employee"}) as (client, service):
        # act: receive a GET /vendor/orders/today request
        response = client.get("/vendor/orders/today")

        # assert: response should be status code 403 and not call the service
        assert response.status_code == 403
        assert response.json() == {"detail": "Only vendors can access vendor orders"}
        assert service.today_call is None

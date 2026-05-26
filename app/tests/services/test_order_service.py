import asyncio
from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.order import Order, OrderStatus, PlaceOrderRequest, UpdateOrderRequest
from app.services import order_service
from app.services.order_service import OrderService


ORDER_ID = "11111111-1111-4111-8111-111111111111"


def make_order() -> Order:
    return Order(
        id=ORDER_ID,
        employee_id=1,
        vendor_id=7,
        menu_id=42,
        menu_name="Lunch Box",
        price_snapshot=120,
        quantity=1,
        total_price=120,
        order_date=date(2026, 5, 26),
        pickup_date=date(2026, 5, 27),
        status=OrderStatus.confirmed,
        created_at=datetime(2026, 5, 26, 4, 0, tzinfo=timezone.utc),
    )


class FakeRedis:
    def __init__(self, cached=None):
        self.cached = cached
        self.set_calls = []

    async def get(self, key: str):
        return self.cached

    async def set(self, key: str, value: str, ex: int):
        self.set_calls.append((key, value, ex))


class FakeOrderRepository:
    def __init__(self, order=None):
        self.order = order
        self.update_status_call = None
        self.update_quantity_call = None

    async def get_by_id(self, order_id: str):
        return self.order

    async def update_status(self, order_id: str, status: OrderStatus):
        self.update_status_call = (order_id, status)
        if self.order:
            self.order.status = status
        return True

    async def update_quantity(self, order_id: str, quantity: int, total_price: int):
        self.update_quantity_call = (order_id, quantity, total_price)
        if self.order:
            self.order.quantity = quantity
            self.order.total_price = total_price
        return True


class FakeInventoryRepository:
    def __init__(self):
        self.increment_call = None
        self.decrement_call = None

    async def decrement(self, menu_id: int, target_date: date, qty: int):
        self.decrement_call = (menu_id, target_date, qty)

    async def increment(self, menu_id: int, target_date: date, qty: int):
        self.increment_call = (menu_id, target_date, qty)


def test_resolve_next_status_prefers_status():
    # arrange: an order service and a payload with explicit status
    svc = OrderService()
    payload = UpdateOrderRequest(status=OrderStatus.completed, action="cancel")

    # act: resolve the next status
    result = svc._resolve_next_status(payload)

    # assert: result should use the explicit status value
    assert result == OrderStatus.completed


def test_create_order_raises_conflict_when_out_of_stock(monkeypatch):
    # arrange: an order service and Redis inventory decrement returning sold out
    svc = OrderService()
    req = PlaceOrderRequest(
        vendor_id=7,
        menu_id=42,
        menu_name="Lunch Box",
        price=120,
        quantity=2,
        pickup_date=date(2026, 5, 27),
    )
    monkeypatch.setattr(order_service.rdb_mod, "decr_inventory", lambda menu_id, target_date: asyncio.sleep(0, result=0))

    # act: create an order for an out-of-stock menu
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(svc.create_order(req, employee_id=1))

    # assert: response should be a 409 out-of-stock error
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Out of stock"


def test_resolve_next_status_maps_reject_action_to_cancelled():
    # arrange: an order service and a vendor reject action payload
    svc = OrderService()
    payload = UpdateOrderRequest(action="reject")

    # act: resolve the next status
    result = svc._resolve_next_status(payload)

    # assert: result should map reject to cancelled
    assert result == OrderStatus.cancelled


def test_resolve_next_status_requires_status_or_action():
    # arrange: an order service and an empty update payload
    svc = OrderService()
    payload = UpdateOrderRequest()

    # act: resolve the next status
    with pytest.raises(HTTPException) as exc_info:
        svc._resolve_next_status(payload)

    # assert: response should be a 400 validation error
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "status or action is required"


def test_get_order_for_actor_allows_matching_vendor(monkeypatch):
    # arrange: an order service with a vendor-owned order and no cached override
    svc = OrderService()
    svc.order_repo = FakeOrderRepository(order=make_order())
    monkeypatch.setattr(order_service.rdb_mod, "get_redis", lambda: FakeRedis(cached=None))

    # act: get the order as the matching vendor
    result = asyncio.run(svc.get_order_for_actor(ORDER_ID, {"user_id": 7, "role": "vendor"}))

    # assert: result should be the vendor order
    assert result.id == ORDER_ID
    assert result.vendor_id == 7


def test_get_order_for_actor_rejects_wrong_employee():
    # arrange: an order service with an order owned by a different employee
    svc = OrderService()
    svc.order_repo = FakeOrderRepository(order=make_order())

    # act: get the order as another employee
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(svc.get_order_for_actor(ORDER_ID, {"user_id": 99, "role": "employee"}))

    # assert: response should be a 403 ownership error
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Not your order"


def test_admin_update_order_can_set_non_cancelled_status(monkeypatch):
    # arrange: an order service with an order and fake Redis cache
    rdb = FakeRedis()
    svc = OrderService()
    svc.order_repo = FakeOrderRepository(order=make_order())
    monkeypatch.setattr(order_service.rdb_mod, "get_redis", lambda: rdb)

    # act: update the order as admin to completed
    result = asyncio.run(
        svc.update_order(
            ORDER_ID,
            actor={"user_id": 99, "role": "admin"},
            payload=UpdateOrderRequest(status=OrderStatus.completed),
        )
    )

    # assert: repository and Redis should receive the completed status
    assert result.status == OrderStatus.completed
    assert svc.order_repo.update_status_call == (ORDER_ID, OrderStatus.completed)
    assert rdb.set_calls == [(f"order:today:{ORDER_ID}", "completed", 86400)]


def test_employee_update_order_can_increase_quantity(monkeypatch):
    # arrange: an order service with an employee-owned order and available inventory
    svc = OrderService()
    svc.order_repo = FakeOrderRepository(order=make_order())
    svc.inventory_repo = FakeInventoryRepository()
    decr_calls = []
    monkeypatch.setattr(
        order_service.rdb_mod,
        "decr_inventory",
        lambda menu_id, target_date: asyncio.sleep(0, result=decr_calls.append((menu_id, target_date)) or 5),
    )
    monkeypatch.setattr(order_service.rdb_mod, "get_redis", lambda: FakeRedis(cached=None))

    # act: update the order quantity as the owning employee
    result = asyncio.run(
        svc.update_order(
            ORDER_ID,
            actor={"user_id": 1, "role": "employee"},
            payload=UpdateOrderRequest(quantity=3),
        )
    )

    # assert: order quantity, total price, Redis stock, and DB inventory should be updated
    assert result.quantity == 3
    assert result.total_price == 360
    assert len(decr_calls) == 2
    assert svc.inventory_repo.decrement_call == (42, date.today(), 2)
    assert svc.order_repo.update_quantity_call == (ORDER_ID, 3, 360)


def test_employee_update_order_quantity_returns_conflict_when_out_of_stock(monkeypatch):
    # arrange: an order service with an employee-owned order and no extra inventory
    svc = OrderService()
    svc.order_repo = FakeOrderRepository(order=make_order())
    svc.inventory_repo = FakeInventoryRepository()
    monkeypatch.setattr(order_service.rdb_mod, "decr_inventory", lambda menu_id, target_date: asyncio.sleep(0, result=0))

    # act: update the order quantity above available inventory
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            svc.update_order(
                ORDER_ID,
                actor={"user_id": 1, "role": "employee"},
                payload=UpdateOrderRequest(quantity=3),
            )
        )

    # assert: response should be a 409 out-of-stock error and not update the order
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Out of stock"
    assert svc.order_repo.update_quantity_call is None
    assert svc.inventory_repo.decrement_call is None


def test_vendor_update_order_can_cancel_own_order(monkeypatch):
    # arrange: an order service with a vendor-owned order and fake inventory dependencies
    rdb = FakeRedis()
    svc = OrderService()
    svc.order_repo = FakeOrderRepository(order=make_order())
    svc.inventory_repo = FakeInventoryRepository()
    publish_calls = []
    monkeypatch.setattr(order_service.rdb_mod, "get_redis", lambda: rdb)
    monkeypatch.setattr(order_service.rdb_mod, "incr_inventory", lambda menu_id, target_date: asyncio.sleep(0, result=2))
    monkeypatch.setattr(order_service.mq_mod, "publish", lambda routing_key, payload: asyncio.sleep(0, result=publish_calls.append((routing_key, payload))))

    # act: update the order as vendor to cancelled
    result = asyncio.run(
        svc.update_order(
            ORDER_ID,
            actor={"user_id": 7, "role": "vendor"},
            payload=UpdateOrderRequest(status=OrderStatus.cancelled),
        )
    )

    # assert: repository, inventory, Redis, and RabbitMQ should receive the cancellation
    assert result.status == OrderStatus.cancelled
    assert svc.order_repo.update_status_call == (ORDER_ID, OrderStatus.cancelled)
    assert svc.inventory_repo.increment_call == (42, date.today(), 1)
    assert rdb.set_calls == [(f"order:today:{ORDER_ID}", "cancelled", 86400)]
    assert publish_calls[0][0] == order_service.ORDER_CANCELLED
    assert publish_calls[0][1]["order_id"] == ORDER_ID

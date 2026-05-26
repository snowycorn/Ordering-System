import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status

from app.db import redis as rdb_mod, rabbitmq as mq_mod
from app.models.order import Order, OrderEvent, OrderStatus, PlaceOrderRequest
from app.repositories.order_repository import OrderRepository
from app.repositories.inventory_repository import InventoryRepository

ORDER_CREATED = "order.created"
ORDER_CANCELLED = "order.cancelled"


class OrderService:
    def __init__(self):
        self.order_repo = OrderRepository()
        self.inventory_repo = InventoryRepository()

# For Employee APIs
    # ── Place Order ────────────────────────────────────────────
    async def place_order(self, req: PlaceOrderRequest, employee_id: int) -> dict:
        today = date.today().isoformat()

        # Step 1: Atomic DECR in Redis (Lua script) — prevents oversell
        remaining = await rdb_mod.decr_inventory(req.menu_id, today)
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Out of stock",
            )

        # Step 2: Build order
        order_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        order = Order(
            id=order_id,
            employee_id=employee_id,
            vendor_id=req.vendor_id,
            menu_id=req.menu_id,
            menu_name=req.menu_name,
            price_snapshot=req.price,
            quantity=req.quantity,
            total_price=req.price * req.quantity,
            order_date=now.date(),
            pickup_date=req.pickup_date,
            status=OrderStatus.pending,
            created_at=now,
        )

        # Step 3: Cache live order status in Redis (TTL 24h)
        rdb = rdb_mod.get_redis()
        await rdb.set(rdb_mod.order_status_key(order_id), "pending", ex=86400)

        # Step 4: Publish to RabbitMQ → worker writes DB async
        event = OrderEvent(
            event=ORDER_CREATED,
            order_id=order_id,
            employee_id=employee_id,
            vendor_id=req.vendor_id,
            menu_id=req.menu_id,
            menu_name=req.menu_name,
            price=req.price,
            quantity=req.quantity,
            status=OrderStatus.pending,
            timestamp=int(now.timestamp()),
        )
        try:
            await mq_mod.publish(ORDER_CREATED, event.model_dump())
        except Exception as e:
            # Compensate: restore Redis stock
            await rdb_mod.incr_inventory(req.menu_id, today)
            await rdb.delete(rdb_mod.order_status_key(order_id))
            raise HTTPException(status_code=500, detail=f"Queue error: {e}")

        return {"order_id": order_id, "status": "pending", "message": "order queued"}

    # ── Cancel Order ───────────────────────────────────────────
    async def cancel_order(self, order_id: str, employee_id: int) -> None:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Not your order")
        if order.status == OrderStatus.cancelled:
            raise HTTPException(status_code=422, detail="Already cancelled")

        # Business rule: must cancel before 17:00 the day before pickup
        deadline = datetime.combine(order.pickup_date, datetime.min.time()).replace(
            tzinfo=timezone.utc
        ) - timedelta(hours=7)  # 17:00 prev day
        if datetime.now(timezone.utc) > deadline:
            raise HTTPException(status_code=422, detail="Cancellation deadline passed")

        await self.order_repo.update_status(order_id, OrderStatus.cancelled)

        # Restore Redis inventory
        today = date.today().isoformat()
        await rdb_mod.incr_inventory(order.menu_id, today)

        # Update cached status
        rdb = rdb_mod.get_redis()
        await rdb.set(rdb_mod.order_status_key(order_id), "cancelled", ex=86400)

        # Publish cancellation event
        event = OrderEvent(
            event=ORDER_CANCELLED,
            order_id=order_id,
            employee_id=employee_id,
            menu_id=order.menu_id,
            timestamp=int(time.time()),
        )
        await mq_mod.publish(ORDER_CANCELLED, event.model_dump())

    # ── Get Order ──────────────────────────────────────────────
    async def get_order(self, order_id: str, employee_id: int) -> Order:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Not your order")

        return await self._overlay_live_status(order)
    
    # ── Today's Order ──────────────────────────────────────────
    async def get_today_order(self, employee_id: int) -> Order:
        order = await self.order_repo.get_today_order(employee_id)
        if not order:
            raise HTTPException(status_code=404, detail="No order today")
        return await self._overlay_live_status(order)

    # ── Order History ──────────────────────────────────────────
    async def get_orders_history(self, employee_id: int, from_dt: datetime, to_dt: datetime) -> list[Order]:
        return await self.order_repo.list_by_employee(employee_id, from_dt, to_dt)
    
# For Vendor APIs

    async def get_billing(self, order_id: str, vendor_id: int) -> Order:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not your billing order")

        return await self._overlay_live_status(order)

    async def cancel_billing(self, order_id: str, vendor_id: int) -> None:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not your billing order")
        if order.status == OrderStatus.cancelled:
            raise HTTPException(status_code=422, detail="Already cancelled")

        await self.order_repo.update_status(order_id, OrderStatus.cancelled)

        today = date.today().isoformat()
        await rdb_mod.incr_inventory(order.menu_id, today)
        await self.inventory_repo.increment(order.menu_id, date.today(), order.quantity)

        rdb = rdb_mod.get_redis()
        await rdb.set(rdb_mod.order_status_key(order_id), "cancelled", ex=86400)

        event = OrderEvent(
            event=ORDER_CANCELLED,
            order_id=order_id,
            employee_id=order.employee_id,
            vendor_id=vendor_id,
            menu_id=order.menu_id,
            timestamp=int(time.time()),
        )
        await mq_mod.publish(ORDER_CANCELLED, event.model_dump())

    async def get_billing_today(self, vendor_id: int) -> list[Order]:
        orders = await self.order_repo.list_today_by_vendor(vendor_id)
        return await self._overlay_live_statuses(orders)

    async def get_billing_history(self, vendor_id: int, from_dt: datetime, to_dt: datetime) -> list[Order]:
        orders = await self.order_repo.list_by_vendor(vendor_id, from_dt, to_dt)
        return await self._overlay_live_statuses(orders)

    async def _overlay_live_status(self, order: Order) -> Order:
        rdb = rdb_mod.get_redis()
        cached = await rdb.get(rdb_mod.order_status_key(order.id))
        if cached:
            order.status = OrderStatus(cached)
        return order

    async def _overlay_live_statuses(self, orders: list[Order]) -> list[Order]:
        for order in orders:
            await self._overlay_live_status(order)
        return orders

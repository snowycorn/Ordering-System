import time
import uuid
from datetime import date, datetime, time as dt_time, timedelta, timezone

from fastapi import HTTPException, status

from app.db import redis as rdb_mod, rabbitmq as mq_mod
from app.models.order import Order, OrderEvent, OrderStatus, PlaceOrderRequest, UpdateOrderRequest
from app.repositories.order_repository import OrderRepository
from app.repositories.inventory_repository import InventoryRepository

ORDER_CREATED = "order.created"
ORDER_CANCELLED = "order.cancelled"


class OrderService:
    def __init__(self):
        self.order_repo = OrderRepository()
        self.inventory_repo = InventoryRepository()

    def _now_utc(self) -> datetime:
        return datetime.now(timezone.utc)

    def _change_deadline(self, pickup_date: date) -> datetime:
        return datetime.combine(
            pickup_date - timedelta(days=1),
            dt_time(hour=17, tzinfo=timezone.utc),
        )

    def _ensure_before_change_deadline(self, pickup_date: date, detail: str) -> None:
        if self._now_utc() > self._change_deadline(pickup_date):
            raise HTTPException(status_code=422, detail=detail)

# For Employee APIs
    # ── Place Order ────────────────────────────────────────────
    async def create_order(self, req: PlaceOrderRequest, employee_id: int) -> dict:
        self._ensure_before_change_deadline(req.pickup_date, "Order change deadline passed")
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
        if self._now_utc() > self._change_deadline(order.pickup_date):
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

    async def get_order_for_actor(self, order_id: str, actor: dict) -> Order:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        role = actor["role"]
        user_id = actor["user_id"]
        if role == "employee" and order.employee_id != user_id:
            raise HTTPException(status_code=403, detail="Not your order")
        if role == "vendor" and order.vendor_id != user_id:
            raise HTTPException(status_code=403, detail="Not your vendor order")
        if role not in ("employee", "vendor", "admin"):
            raise HTTPException(status_code=403, detail="Unsupported role")

        return await self._overlay_live_status(order)

    async def update_order(self, order_id: str, actor: dict, payload: UpdateOrderRequest) -> Order:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        role = actor["role"]
        user_id = actor["user_id"]
        has_status_update = payload.status is not None or payload.action is not None

        if role == "employee":
            if order.employee_id != user_id:
                raise HTTPException(status_code=403, detail="Not your order")
            if payload.quantity is not None and not has_status_update:
                await self._update_order_quantity(order, payload.quantity)
                return await self.get_order_for_actor(order_id, actor)
            next_status = self._resolve_next_status(payload)
            if next_status != OrderStatus.cancelled:
                raise HTTPException(status_code=403, detail="Employees can only cancel orders")
            await self.cancel_order(order_id, employee_id=user_id)
        elif role == "vendor":
            if order.vendor_id != user_id:
                raise HTTPException(status_code=403, detail="Not your vendor order")
            next_status = self._resolve_next_status(payload)
            if next_status != OrderStatus.cancelled:
                raise HTTPException(status_code=403, detail="Vendors can only reject or cancel orders")
            await self.cancel_vendor_order(order_id, vendor_id=user_id)
        elif role == "admin":
            next_status = self._resolve_next_status(payload)
            if next_status == OrderStatus.cancelled:
                await self._cancel_loaded_order(order, actor)
            else:
                await self.order_repo.update_status(order_id, next_status)
                await self._cache_status(order_id, next_status)
        else:
            raise HTTPException(status_code=403, detail="Unsupported role")

        return await self.get_order_for_actor(order_id, actor)

    async def update_order_quantity(self, order_id: str, employee_id: int, quantity: int) -> Order:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.employee_id != employee_id:
            raise HTTPException(status_code=403, detail="Not your order")

        self._ensure_before_change_deadline(order.pickup_date, "Order change deadline passed")

        await self._update_order_quantity(order, quantity)
        order.quantity = quantity
        order.total_price = order.price_snapshot * quantity
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

    async def get_vendor_order(self, order_id: str, vendor_id: int) -> Order:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not your vendor order")

        return await self._overlay_live_status(order)

    async def cancel_vendor_order(self, order_id: str, vendor_id: int) -> None:
        order = await self.order_repo.get_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.vendor_id != vendor_id:
            raise HTTPException(status_code=403, detail="Not your vendor order")
        if order.status == OrderStatus.cancelled:
            raise HTTPException(status_code=422, detail="Already cancelled")

        self._ensure_before_change_deadline(order.pickup_date, "Order change deadline passed")

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

    async def reject_vendor_order(self, order_id: str, vendor_id: int) -> Order:
        await self.cancel_vendor_order(order_id, vendor_id)
        return await self.get_vendor_order(order_id, vendor_id)

    async def get_vendor_orders_today(self, vendor_id: int) -> list[Order]:
        orders = await self.order_repo.list_today_by_vendor(vendor_id)
        return await self._overlay_live_statuses(orders)

    async def get_vendor_orders_history(self, vendor_id: int, from_dt: datetime, to_dt: datetime) -> list[Order]:
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

    def _resolve_next_status(self, payload: UpdateOrderRequest) -> OrderStatus:
        if payload.status is not None:
            return payload.status

        if payload.action is None:
            raise HTTPException(status_code=400, detail="status or action is required")

        action = payload.action.lower()
        if action in ("cancel", "cancelled", "reject", "rejected"):
            return OrderStatus.cancelled
        raise HTTPException(status_code=400, detail="Unsupported action")

    async def _cache_status(self, order_id: str, status_value: OrderStatus) -> None:
        rdb = rdb_mod.get_redis()
        await rdb.set(rdb_mod.order_status_key(order_id), status_value.value, ex=86400)

    async def _update_order_quantity(self, order: Order, quantity: int) -> None:
        if order.status == OrderStatus.cancelled:
            raise HTTPException(status_code=422, detail="Cannot update cancelled order")
        if quantity == order.quantity:
            return

        diff = quantity - order.quantity
        today = date.today()
        today_str = today.isoformat()

        if diff > 0:
            reserved = 0
            try:
                for _ in range(diff):
                    remaining = await rdb_mod.decr_inventory(order.menu_id, today_str)
                    if remaining < 0:
                        raise HTTPException(status_code=404, detail="Inventory not found")
                    if remaining <= 0:
                        raise HTTPException(status_code=409, detail="Out of stock")
                    reserved += 1
            except HTTPException:
                for _ in range(reserved):
                    await rdb_mod.incr_inventory(order.menu_id, today_str)
                raise
            await self.inventory_repo.decrement(order.menu_id, today, diff)
        else:
            restore_qty = abs(diff)
            for _ in range(restore_qty):
                await rdb_mod.incr_inventory(order.menu_id, today_str)
            await self.inventory_repo.increment(order.menu_id, today, restore_qty)

        await self.order_repo.update_quantity(
            order.id,
            quantity,
            order.price_snapshot * quantity,
        )

    async def _cancel_loaded_order(self, order: Order, actor: dict) -> None:
        if order.status == OrderStatus.cancelled:
            raise HTTPException(status_code=422, detail="Already cancelled")

        self._ensure_before_change_deadline(order.pickup_date, "Order change deadline passed")

        await self.order_repo.update_status(order.id, OrderStatus.cancelled)

        today = date.today().isoformat()
        await rdb_mod.incr_inventory(order.menu_id, today)
        await self.inventory_repo.increment(order.menu_id, date.today(), order.quantity)
        await self._cache_status(order.id, OrderStatus.cancelled)

        event = OrderEvent(
            event=ORDER_CANCELLED,
            order_id=order.id,
            employee_id=order.employee_id,
            vendor_id=order.vendor_id,
            menu_id=order.menu_id,
            timestamp=int(time.time()),
        )
        await mq_mod.publish(ORDER_CANCELLED, event.model_dump())

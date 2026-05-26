from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.models.order import Order
from app.services.order_service import OrderService

router = APIRouter()


def get_service() -> OrderService:
    return OrderService()


def require_vendor(user: dict) -> None:
    if user["role"] not in ("vendor", "admin"):
        raise HTTPException(status_code=403, detail="Only vendors can access vendor orders")


# GET /vendor/orders/today
@router.get("/today", response_model=list[Order])
async def get_vendor_orders_today(
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_vendor(user)
    return await svc.get_vendor_orders_today(vendor_id=user["user_id"])


# GET /vendor/orders/history?from=2024-01-01&to=2024-01-31
@router.get("/history")
async def get_vendor_orders_history(
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
    from_date: str = Query(default=None, alias="from"),
    to_date: str = Query(default=None, alias="to"),
):
    require_vendor(user)

    now = datetime.now(timezone.utc)
    from_dt = datetime.fromisoformat(from_date) if from_date else now - timedelta(days=30)
    to_dt = datetime.fromisoformat(to_date) if to_date else now

    orders = await svc.get_vendor_orders_history(user["user_id"], from_dt, to_dt)
    return {"orders": orders, "count": len(orders)}

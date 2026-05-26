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
        raise HTTPException(status_code=403, detail="Only vendors can access billing")

# /billing/today_billing
@router.get("/today_billing", response_model=list[Order])
async def get_today_billing(
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_vendor(user)
    return await svc.get_billing_today(vendor_id=user["user_id"])


@router.get("/billing_history")
async def get_billing_history(
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
    from_date: str = Query(default=None, alias="from"),
    to_date: str = Query(default=None, alias="to"),
):
    require_vendor(user)

    now = datetime.now(timezone.utc)
    from_dt = datetime.fromisoformat(from_date) if from_date else now - timedelta(days=30)
    to_dt = datetime.fromisoformat(to_date) if to_date else now

    orders = await svc.get_billing_history(user["user_id"], from_dt, to_dt)
    return {"orders": orders, "count": len(orders)}


@router.get("/{order_id}", response_model=Order)
async def get_billing_order(
    order_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_vendor(user)
    return await svc.get_billing(order_id, vendor_id=user["user_id"])


@router.delete("/cancel/{order_id}")
async def cancel_billing_order(
    order_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_vendor(user)
    await svc.cancel_billing(order_id, vendor_id=user["user_id"])
    return {"message": "billing order cancelled"}

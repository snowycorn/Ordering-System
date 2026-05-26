from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.models.order import Order, PlaceOrderRequest, UpdateOrderQuantityRequest
from app.services.order_service import OrderService

router = APIRouter()


def get_service() -> OrderService:
    return OrderService()


def require_employee(user: dict) -> None:
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Only employees can access employee orders")


# POST /orders
@router.post("", status_code=201)
async def create_order(
    req: PlaceOrderRequest,
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_employee(user)
    return await svc.create_order(req, employee_id=user["user_id"])


# GET /orders/me
@router.get("/me", response_model=Order)
async def get_today_order(
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_employee(user)
    return await svc.get_today_order(employee_id=user["user_id"])


# GET /orders/me/history?from=2024-01-01&to=2024-01-31
@router.get("/me/history")
async def get_my_orders(
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
    from_date: str = Query(default=None, alias="from"),
    to_date: str = Query(default=None, alias="to"),
):
    require_employee(user)

    now = datetime.now(timezone.utc)
    from_dt = datetime.fromisoformat(from_date) if from_date else now - timedelta(days=30)
    to_dt = datetime.fromisoformat(to_date) if to_date else now

    orders = await svc.get_orders_history(user["user_id"], from_dt, to_dt)
    return {"orders": orders, "count": len(orders)}


# GET /orders/{order_id}
@router.get("/{order_id}", response_model=Order)
async def get_order(
    order_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    return await svc.get_order_for_actor(order_id, actor=user)


# PATCH /orders/{order_id}/quantity
@router.patch("/{order_id}/quantity", response_model=Order)
async def update_order_quantity(
    order_id: str,
    req: UpdateOrderQuantityRequest,
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_employee(user)
    return await svc.update_order_quantity(order_id, employee_id=user["user_id"], quantity=req.quantity)


# PATCH /orders/{order_id}/cancel
@router.patch("/{order_id}/cancel", response_model=Order)
async def cancel_order(
    order_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    svc: OrderService = Depends(get_service),
):
    require_employee(user)
    await svc.cancel_order(order_id, employee_id=user["user_id"])
    return await svc.get_order_for_actor(order_id, actor=user)

import asyncio
from datetime import date

import pytest
from fastapi import HTTPException

from app.models.order import DailyInventory
from app.services import inventory_service
from app.services.inventory_service import InventoryService


class FakeRedis:
    def __init__(self, cached=None):
        self.cached = cached
        self.set_calls = []

    async def get(self, key: str):
        return self.cached

    async def set(self, key: str, value, ex: int):
        self.set_calls.append((key, value, ex))


class FakeInventoryRepository:
    def __init__(self, item=None):
        self.item = item
        self.get_call = None
        self.upsert_call = None

    async def get(self, menu_id: int, target_date: date):
        self.get_call = (menu_id, target_date)
        return self.item

    async def upsert(self, menu_id: int, target_date: date, qty: int):
        self.upsert_call = (menu_id, target_date, qty)


def test_get_inventory_returns_cached_quantity(monkeypatch):
    # arrange: an inventory service with Redis containing cached stock
    rdb = FakeRedis(cached="8")
    svc = InventoryService()
    svc.repo = FakeInventoryRepository()
    monkeypatch.setattr(inventory_service.rdb_mod, "get_redis", lambda: rdb)

    # act: get inventory for a menu and date
    result = asyncio.run(svc.get_inventory(42, date(2026, 5, 26)))

    # assert: result should come from Redis and not call the repository
    assert result == 8
    assert svc.repo.get_call is None


def test_get_inventory_warms_cache_on_miss(monkeypatch):
    # arrange: an inventory service with Redis cache miss and DB inventory
    rdb = FakeRedis(cached=None)
    inv = DailyInventory(id=1, menu_id=42, target_date=date(2026, 5, 26), remaining_quantity=12)
    svc = InventoryService()
    svc.repo = FakeInventoryRepository(item=inv)
    monkeypatch.setattr(inventory_service.rdb_mod, "get_redis", lambda: rdb)

    # act: get inventory for a menu and date
    result = asyncio.run(svc.get_inventory(42, date(2026, 5, 26)))

    # assert: result should come from DB and warm Redis
    assert result == 12
    assert svc.repo.get_call == (42, date(2026, 5, 26))
    assert rdb.set_calls == [("inventory:42:2026-05-26", 12, 600)]


def test_get_inventory_raises_when_missing(monkeypatch):
    # arrange: an inventory service with Redis cache miss and no DB inventory
    rdb = FakeRedis(cached=None)
    svc = InventoryService()
    svc.repo = FakeInventoryRepository(item=None)
    monkeypatch.setattr(inventory_service.rdb_mod, "get_redis", lambda: rdb)

    # act: get inventory for a menu and date
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(svc.get_inventory(42, date(2026, 5, 26)))

    # assert: response should be a 404 missing inventory error
    assert exc_info.value.status_code == 404
    assert "No inventory for menu 42" in exc_info.value.detail


def test_set_inventory_upserts_and_warms_cache(monkeypatch):
    # arrange: an inventory service with fake repository and Redis
    rdb = FakeRedis()
    svc = InventoryService()
    svc.repo = FakeInventoryRepository()
    monkeypatch.setattr(inventory_service.rdb_mod, "get_redis", lambda: rdb)

    # act: set inventory for a menu and date
    asyncio.run(svc.set_inventory(42, date(2026, 5, 26), 30))

    # assert: repository should be updated and Redis should be warmed
    assert svc.repo.upsert_call == (42, date(2026, 5, 26), 30)
    assert rdb.set_calls[0][0] == "inventory:42:2026-05-26"
    assert rdb.set_calls[0][1] == 30
    assert rdb.set_calls[0][2] >= 1

import redis.asyncio as aioredis
from app.core.config import settings

_redis: aioredis.Redis | None = None


async def init_redis():
    global _redis
    _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    await _redis.ping()


async def close_redis():
    if _redis:
        await _redis.aclose()


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialised")
    return _redis


# ── Key helpers ────────────────────────────────────────────────

def inventory_key(menu_id: int, date: str) -> str:
    """Redis key for daily inventory: inventory:<menu_id>:<date>"""
    return f"inventory:{menu_id}:{date}"


def order_status_key(order_id: str) -> str:
    """Redis key for live order status: order:today:<order_id>"""
    return f"order:today:{order_id}"


def rate_limit_key(user_id: int) -> str:
    return f"rate_limit:{user_id}"


# ── Lua Scripts ────────────────────────────────────────────────
# Redis executes Lua atomically (single-threaded), so this is
# race-condition-free even under heavy concurrency.

# Returns: remaining stock after decrement (≥1), 0 if out of stock, -1 if key missing
DECR_INVENTORY_SCRIPT = """
local key   = KEYS[1]
local stock = redis.call('GET', key)
if not stock then return -1 end
stock = tonumber(stock)
if stock <= 0 then return 0 end
return redis.call('DECR', key)
"""

# Returns: stock after increment, -1 if key missing
INCR_INVENTORY_SCRIPT = """
local key = KEYS[1]
local cur = redis.call('GET', key)
if not cur then return -1 end
return redis.call('INCR', key)
"""


async def decr_inventory(menu_id: int, date: str) -> int:
    """Atomically decrement inventory. Returns remaining stock, 0=sold out, -1=not set."""
    rdb = get_redis()
    key = inventory_key(menu_id, date)
    result = await rdb.eval(DECR_INVENTORY_SCRIPT, 1, key)
    return int(result)


async def incr_inventory(menu_id: int, date: str) -> int:
    """Atomically restore one unit (used on cancellation)."""
    rdb = get_redis()
    key = inventory_key(menu_id, date)
    result = await rdb.eval(INCR_INVENTORY_SCRIPT, 1, key)
    return int(result)

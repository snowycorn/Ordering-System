import argparse
import asyncio
import os
import random
import statistics
import time
from datetime import date, timedelta

import httpx


def build_payload(menu_id: int, menu_name: str, price: int, pickup_date: str) -> dict:
    return {
        "vendor_id": 1,
        "menu_id": menu_id,
        "menu_name": menu_name,
        "price": price,
        "quantity": random.randint(1, 3),
        "pickup_date": pickup_date,
    }


def default_pickup_date() -> str:
    return (date.today() + timedelta(days=2)).isoformat()


async def send_order(client: httpx.AsyncClient, api_url: str, payload: dict, stats: dict) -> None:
    start = time.perf_counter()

    try:
        response = await client.post(api_url, json=payload)
        latency = time.perf_counter() - start
        stats["latencies"].append(latency)
        stats["status_codes"].append(response.status_code)

        if response.status_code in (200, 201):
            stats["success"] += 1
        else:
            stats["fail"] += 1
            stats["fail_status_counts"][response.status_code] = (
                stats["fail_status_counts"].get(response.status_code, 0) + 1
            )
    except Exception as exc:
        stats["fail"] += 1
        stats["errors"].append(repr(exc))


async def worker(client: httpx.AsyncClient, api_url: str, queue: asyncio.Queue, stats: dict) -> None:
    while True:
        item = await queue.get()
        try:
            if item is None:
                return
            await send_order(client, api_url, item, stats)
        finally:
            queue.task_done()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Async stress test for order-service")
    parser.add_argument("--url", default="http://localhost:8081/orders", help="Order API URL")
    parser.add_argument("--total", type=int, default=800, help="Total requests")
    parser.add_argument("--concurrency", type=int, default=100, help="Concurrent workers")
    parser.add_argument("--menu-id", type=int, default=1, help="Menu ID")
    parser.add_argument("--menu-name", default="Lunch Box", help="Menu name")
    parser.add_argument("--price", type=int, default=100, help="Order price")
    parser.add_argument("--pickup-date", default=default_pickup_date(), help="Pickup date (YYYY-MM-DD)")
    parser.add_argument("--token", default=os.getenv("AUTH_TOKEN", ""), help="Bearer JWT token")
    args = parser.parse_args()

    queue: asyncio.Queue = asyncio.Queue()
    stats = {
        "success": 0,
        "fail": 0,
        "latencies": [],
        "status_codes": [],
        "fail_status_counts": {},
        "errors": [],
    }

    for _ in range(args.total):
        queue.put_nowait(build_payload(args.menu_id, args.menu_name, args.price, args.pickup_date))

    headers = {}
    if args.token:
        headers["Authorization"] = f"Bearer {args.token}"

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        tasks = [
            asyncio.create_task(worker(client, args.url, queue, stats))
            for _ in range(args.concurrency)
        ]

        start = time.perf_counter()
        await queue.join()

        for _ in tasks:
            queue.put_nowait(None)

        await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start

    latencies = stats["latencies"]
    print("\n===== RESULT =====")
    print("url:", args.url)
    print("total:", args.total)
    print("concurrency:", args.concurrency)
    print("success:", stats["success"])
    print("fail:", stats["fail"])
    print("time:", round(total_time, 2), "sec")
    print("req/sec:", round(args.total / total_time, 2))

    if latencies:
        print("avg latency:", round(statistics.mean(latencies), 4), "sec")
        print("p95 latency:", round(statistics.quantiles(latencies, n=20)[18], 4), "sec")
        print("max latency:", round(max(latencies), 4), "sec")

    if stats["fail_status_counts"]:
        print("\nstatus counts:")
        for code, count in sorted(stats["fail_status_counts"].items()):
            print(f"  {code}: {count}")

        if stats["fail_status_counts"].get(403):
            print("\nnote: 403 usually means the request is missing a valid Bearer JWT or the role is not allowed.")
            print("      Re-run with --token <jwt> or set AUTH_TOKEN in your shell.")

    if stats["errors"]:
        print("\nerrors:")
        for error in stats["errors"][:10]:
            print(" ", error)


if __name__ == "__main__":
    asyncio.run(main())
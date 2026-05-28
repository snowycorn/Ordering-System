# Order & Inventory Service

一個以 FastAPI 實作的訂餐與庫存管理服務，支援員工建立訂單、商家查單與拒單、以及以日別（`pickup_date`）為單位的庫存管理。

**重點功能**

- 日別庫存管理（`daily_inventory`）：以 `menu_id` + `target_date` 為 key。
- API 層（FastAPI）→ 服務層（Service）→ 存取層（Repository）→ PostgreSQL。
- 使用 Redis 作為下訂時的 atomic reserve（Redis Lua script `reserve_inventory`），先在 Redis 扣庫存並將訂單狀態設為 `pending`。
- 使用 RabbitMQ 發佈 `order.created` 事件，由 worker 非同步寫入 PostgreSQL 並把 Redis 訂單狀態改為 `confirmed`。

## 專案結構

主要資料夾：

- `app/api/`：HTTP 路由（orders、vendor_orders、inventory）。
- `app/services/`：商業邏輯（建立/取消/修改訂單、庫存邏輯）。
- `app/repositories/`：PostgreSQL 存取程式。
- `app/db/`：Postgres / Redis / RabbitMQ client 與 helper。 
- `app/models/`：Pydantic request/response 與事件 schema。
- `app/worker/`：RabbitMQ consumer（處理 `order.created` 事件）。
- `app/tests/`：pytest 測試（主要覆蓋 API 層）。

資料庫 migration 在 `migrations/001_init.sql`。

## 主要流程（概要）

- 建立訂單：API `POST /orders` → `OrderService.create_order()` → 呼叫 Redis Lua `reserve_inventory` 做 atomic 減庫存
  - Redis 回傳：`-2`（日別庫存不存在）、`-1`（庫存不足）、>=0（成功，回傳剩餘數量）
  - 成功：在 Redis 設定 order status=`pending`，發佈 RabbitMQ `order.created` 事件，回傳 API queued 回應。
- Worker 處理：消費 `order.created` → 寫入 PostgreSQL `orders`、更新 `daily_inventory`（以 `pickup_date` 扣減）→ 將 Redis 上的 order status 設為 `confirmed`。

取消 / 拒單 / 修改：

- `PATCH /orders/{order_id}/cancel`：員工取消（受 cutoff 規則）→ 更新 PostgreSQL / Redis，必要時補回庫存，發佈 `order.cancelled`。
- `PATCH /orders/{order_id}/quantity`：員工更新數量 → 重新計算價格與庫存，同步至 Redis/Postgres。
- `PATCH /vendor/orders/{order_id}/reject`：商家拒單 → 更新狀態並補回庫存。

## API 概覽

### Orders

檔案： [app/api/orders.py](app/api/orders.py)

主要路由（已合併為可用 `range/from/to` 查詢的單一介面）：

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/orders` | 建立訂單（會以 `pickup_date` 做日別庫存預扣） |
| `GET` | `/orders/me` | 查目前登入員工的訂單（支援 `range` / `from` / `to` / `status`） |
| `GET` | `/orders/employee/{employee_id}` | 查指定員工的訂單（支援 `range` / `from` / `to` / `status`） |
| `GET` | `/orders/{order_id}` | 查單筆訂單（依角色回傳不同欄位） |
| `PATCH` | `/orders/{order_id}/cancel` | 員工取消自己的訂單（受 cutoff 規則限制） |
| `PATCH` | `/orders/{order_id}/quantity` | 員工修改自己的訂單數量 |

- `range`： 有 `today`、`upcoming`、`history`
- `from`、`to`：年月日，格式：`2000-01-01`
- `status`： `pending` 、 `confirmed` 、 `cancelled` 、 `completed`

### Vendor Orders

檔案： [app/api/vendor_orders.py](app/api/vendor_orders.py)

主要路由：

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/vendor/orders` | 商家查詢收到的訂單，支援 `range=upcoming|history|today` 或 `from`/`to` 指定區間，與 `status` 過濾（需 vendor/admin）。 |
| `GET` | `/vendor/orders/vendor/{vendor_id}` | 以商家 ID 查詢該商家的訂單（需 vendor/admin）。 |
| `PATCH` | `/vendor/orders/{order_id}/reject` | 商家拒單（需 vendor/admin），回傳被拒的 `Order`。 |

說明：`GET /vendor/orders` 支援 query 參數 `range`（`today`/`upcoming`/`history`/`custom`），或使用 `from`、`to`、`status` 來自訂區間與過濾。

### Inventory

檔案： [app/api/inventory.py](app/api/inventory.py)

主要路由：

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/inventory/{menu_id}` | 取得指定 `menu_id` 在 `date`（query，預設為今日）的日別庫存。 |
| `PUT` | `/inventory/{menu_id}` | 設定指定 `menu_id` 在某個 `date` 的庫存數量（需 `vendor` 或 `admin`）。 |

範例 GET：`GET /inventory/42?date=2026-05-22`。

範例 PUT request body：

```json
{
  "date": "2026-05-27",
  "quantity": 30
}
```

`PUT /inventory/{menu_id}` 僅限 `vendor` 或 `admin`（`app/core/auth.py` 驗證）。

所有需驗證的 API 使用 Bearer JWT（`app/core/auth.py` 解析 token，回傳 `user_id`、`role`）。支援角色：`employee`、`vendor`、`admin`。

範例 request（建立訂單）：

```json
{
  "vendor_id": 7,
  "menu_id": 42,
  "menu_name": "Lunch Box",
  "price": 120,
  "quantity": 1,
  "pickup_date": "2026-05-27"
}
```

## 環境變數

配置請放在 `.env`

## Docker（快速啟動）

啟動所有服務：

```bash
docker compose up -d --build
```

只在本機跑測試容器（第一次或 requirements 更新）：

```bash
docker compose --profile test run --rm --build order-service-test
```

預設 API 地址： `http://localhost:8081`。

Health check：

```bash
curl http://localhost:8081/health
```

RabbitMQ management UI： `http://localhost:15672`（預設 guest/guest）。

## 測試

測試位於 `app/tests/`。範例命令（container 內）：

```bash
python -m pytest app/tests -vv \
  --html=reports/test-report.html \
  --self-contained-html \
  --cov=app \
  --cov-report=html:reports/coverage \
  --cov-report=xml:reports/coverage.xml
```

測試策略：使用 FastAPI `TestClient` + dependency override，避免連外部 service（Postgres/Redis/RabbitMQ）。


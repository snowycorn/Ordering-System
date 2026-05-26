# Order & Inventory Service

Order & Inventory Service 是一個 FastAPI 服務，負責員工訂餐、商家查看訂單、庫存管理，以及透過 RabbitMQ worker 非同步寫入訂單資料。

## 架構

```text
Client
  |
  v
FastAPI API layer
  |
  v
Service layer
  |
  +--> Repository layer --> PostgreSQL
  |
  +--> Redis
  |
  +--> RabbitMQ --> Worker --> Repository layer --> PostgreSQL
```

主要分層：

- `app/api/`：HTTP route，處理 request/response、權限入口、呼叫 service。
- `app/services/`：商業邏輯，例如建立訂單、取消訂單、查詢訂單、庫存處理。
- `app/repositories/`：PostgreSQL 存取層。
- `app/db/`：PostgreSQL、Redis、RabbitMQ client 初始化與 helper。
- `app/models/`：Pydantic request/response model 與 event schema。
- `app/worker/`：RabbitMQ consumer，處理非同步訂單建立流程。
- `app/tests/`：pytest 測試，目前主要覆蓋 API router。

## API

所有需要登入的 API 都使用 Bearer JWT。`app/core/auth.py` 會解析 token，回傳：

```json
{
  "user_id": 1,
  "role": "employee"
}
```

支援角色：

- `employee`
- `vendor`
- `admin`

### Orders

檔案：[app/api/orders.py](app/api/orders.py)

| Method | Path | 說明 |
| --- | --- | --- |
| `POST` | `/orders` | 建立訂單 |
| `GET` | `/orders/me` | 查目前登入員工今日訂單 |
| `GET` | `/orders/me/history` | 查目前登入員工歷史訂單 |
| `GET` | `/orders/{order_id}` | 依角色查單筆訂單 |
| `PATCH` | `/orders/{order_id}/cancel` | 員工取消自己的訂單 |
| `PATCH` | `/orders/{order_id}/quantity` | 員工修改自己的訂單數量 |

建立訂單：

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

員工取消訂單：

無 request body。

員工修改訂單數量：

```json
{
  "quantity": 3
}
```

`PATCH /orders/{order_id}/cancel` 由 `OrderService.cancel_order(order_id, employee_id)` 處理，
`PATCH /orders/{order_id}/quantity` 由 `OrderService.update_order_quantity(order_id, employee_id, quantity)` 處理：

- `employee`：可以取消自己的訂單，或修改自己的訂單數量。
- `vendor`：在 `vendor/orders` 路由下可 reject 自己收到的訂單。
- `admin`：仍可透過共用查詢路由讀取訂單。

### Vendor Orders

檔案：[app/api/vendor_orders.py](app/api/vendor_orders.py)

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/vendor/orders/today` | 商家查今日收到的訂單 |
| `GET` | `/vendor/orders/history` | 商家查歷史收到的訂單 |
| `PATCH` | `/vendor/orders/{order_id}/reject` | 商家拒絕訂單 |

只有 `vendor` 和 `admin` 可以使用。

### Inventory

檔案：[app/api/inventory.py](app/api/inventory.py)

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/inventory/{menu_id}` | 查指定菜單庫存 |
| `PUT` | `/inventory/{menu_id}` | 設定指定菜單庫存 |

設定庫存：

```json
{
  "date": "2026-05-27",
  "quantity": 30
}
```

`PUT /inventory/{menu_id}` 只有 `vendor` 和 `admin` 可以使用。

## 訂單流程

建立訂單：

```text
POST /orders
  -> app/api/orders.py
  -> OrderService.create_order()
  -> Redis Lua script 扣庫存
  -> Redis 寫入 order status = pending
  -> RabbitMQ publish order.created
  -> API 回傳 order queued
```

worker 非同步處理：

```text
RabbitMQ order.created
  -> OrderWorker.handle_created()
  -> PostgreSQL 寫入 orders
  -> PostgreSQL 更新 daily_inventory
  -> Redis order status = confirmed
```

取消 / reject / 更新狀態：

```text
PATCH /orders/{order_id}/cancel
  -> app/api/orders.py
  -> OrderService.cancel_order(order_id, employee_id)
  -> 更新 PostgreSQL status
  -> 更新 Redis status
  -> 必要時補回 inventory
  -> publish order.cancelled

PATCH /orders/{order_id}/quantity
  -> app/api/orders.py
  -> OrderService.update_order_quantity(order_id, employee_id, quantity)
  -> 檢查是否為本人訂單
  -> 重新計算數量與總價
  -> 同步 Redis / PostgreSQL 庫存

PATCH /vendor/orders/{order_id}/reject
  -> app/api/vendor_orders.py
  -> OrderService.reject_vendor_order(order_id, vendor_id)
  -> 更新 PostgreSQL status
  -> 更新 Redis status
  -> 補回 inventory
  -> publish order.cancelled
```

## Data Model

主要資料表定義在 [migrations/001_init.sql](migrations/001_init.sql)。

`orders`：

- `id`
- `employee_id`
- `vendor_id`
- `menu_id`
- `menu_name`
- `price_snapshot`
- `quantity`
- `total_price`
- `order_date`
- `pickup_date`
- `status`
- `created_at`

`daily_inventory`：

- `menu_id`
- `target_date`
- `remaining_quantity`

`daily_inventory` 對 `(menu_id, target_date)` 有 unique constraint。

## Docker

啟動完整服務：

```bash
docker compose up --build
```

背景啟動：

```bash
docker compose up -d --build
```

服務：

- `order-service`：FastAPI app
- `postgres`：PostgreSQL
- `redis`：Redis
- `rabbitmq`：RabbitMQ + management UI
- `order-service-test`：測試容器，只有 `test` profile 啟用

預設 API port：

```text
http://localhost:8081
```

Health check：

```bash
curl http://localhost:8081/health
```

RabbitMQ management UI：

```text
http://localhost:15672
```

預設帳密：

```text
guest / guest
```

## Environment

本機設定放在 `.env`：

```env
JWT_SECRET=thisisasecret_shu
DATABASE_URL=postgresql://order_user:order_pass@postgres:5432/order_db
REDIS_URL=redis://redis:6379/0
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
TEST_REPORT_DIR=./reports
```

`TEST_REPORT_DIR` 是 Docker 測試容器輸出 report 的本機資料夾。預設會寫到：

```text
reports/
```

## Testing

目前測試放在：

```text
app/tests/
```

測試檔：

- [app/tests/api/test_inventory.py](app/tests/api/test_inventory.py)
- [app/tests/api/test_orders.py](app/tests/api/test_orders.py)
- [app/tests/api/test_vendor_orders.py](app/tests/api/test_vendor_orders.py)
- [app/tests/core/test_auth.py](app/tests/core/test_auth.py)
- [app/tests/db/test_redis.py](app/tests/db/test_redis.py)
- [app/tests/services/test_inventory_service.py](app/tests/services/test_inventory_service.py)
- [app/tests/services/test_order_service.py](app/tests/services/test_order_service.py)

測試策略：

- 使用 `FastAPI` + `TestClient` 掛單一 router。
- 用 dependency override 替換 `get_current_user` 和 service。
- 不連 PostgreSQL、Redis、RabbitMQ。
- 目前主要測 API router 行為、權限分支、request/response shape。

### 用 Docker 跑測試

第一次或 requirements 有更新時：

```bash
docker compose --profile test run --rm --build order-service-test
```

平常跑：

```bash
docker compose --profile test run --rm order-service-test
```

測試容器會執行：

```bash
python -m pytest app/tests -vv \
  --html=reports/test-report.html \
  --self-contained-html \
  --cov=app \
  --cov-report=term-missing \
  --cov-report=html:reports/coverage \
  --cov-report=xml:reports/coverage.xml
```

因為 compose 有掛 volume：

```yaml
${TEST_REPORT_DIR:-./reports}:/app/reports
```

所以 Docker 跑完後，report 會出現在本機：

```text
reports/test-report.html
reports/coverage/index.html
reports/coverage.xml
```

在 Windows 開啟測試結果：

```powershell
start reports/test-report.html
```

在 Windows 開啟 coverage：

```powershell
start reports/coverage/index.html
```

### Coverage 說明

目前 coverage 涵蓋 API router、core auth、Redis helper，以及部分 service logic。若 coverage 仍偏低是正常的，因為以下部分還沒被完整測到：

- `app/repositories/`
- `app/db/postgres.py`
- `app/db/rabbitmq.py`
- `app/worker/`
- `app/main.py` lifespan

要提高 coverage，下一步可以補 repository、worker、RabbitMQ/PostgreSQL 初始化流程的測試。

## Useful Commands

啟動服務：

```bash
docker compose up -d --build
```

只跑測試並輸出本機 report：

```bash
docker compose --profile test run --rm --build order-service-test
```

這個專案是一個 **Order & Inventory Service**，用 FastAPI 做 HTTP API，PostgreSQL 存正式資料，Redis 做庫存快取與即時狀態，RabbitMQ 做非同步訂單事件。整體是典型「API → Service → Repository → DB/Cache/Queue」分層。

**整體架構**

```
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
  +--> RabbitMQ --> Worker --> Repository --> PostgreSQL
```

**入口層：app/main.py**

[app/main.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/main.py>) 是服務啟動入口。

它做幾件事：

1. 建立 FastAPI app。
2. 啟動時初始化 PostgreSQL、Redis、RabbitMQ。
3. 啟動背景 worker：`OrderWorker()`。
4. 掛上兩組 API router：
   - `/orders`
   - `/inventory`
5. 提供 `/health` 健康檢查。

也就是說，這個服務啟動後，API server 和訂單背景 worker 會跑在同一個應用程式裡。

**API 層：app/api/**

API 層負責接 HTTP request、做基本權限檢查、呼叫 service。

[app/api/orders.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/api/orders.py>) 提供訂單 API：

- `POST /orders`：建立訂單
```
{
  "vendor_id": 0,
  "menu_id": 0,
  "menu_name": "string",
  "price": 0,
  "quantity": 1,
  "pickup_date": "2026-05-26"
}
```
- `DELETE /orders/{order_id}`：取消訂單
- `GET /orders/me/today`：查今天自己的訂單
- `GET /orders/me/history`：查歷史訂單
- `GET /orders/{order_id}`：查單筆訂單

[app/api/billing.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/api/orders.py>)：提供商家收到的訂單 API

- `GET	/vendor_orders/me/today`：查某商家今天收到的訂單
- `GET	/vendor_orders/me/history`：查某商家的歷史訂單
- `DELETE	/vendor_orders/{order_id}`：商家取消訂單，只有 `vendor` 或 `admin` 可以用

[app/api/inventory.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/api/inventory.py>) 提供庫存 API：

- `GET /inventory/{menu_id}`：查某菜單某天剩餘庫存
- `PUT /inventory/{menu_id}`：設定庫存，只有 `vendor` 或 `admin` 可以用

API 層本身不直接操作 DB。它把工作交給 `OrderService` 或 `InventoryService`。

**Service 層：app/services/**

Service 層是商業邏輯核心。

[app/services/order_service.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/services/order_service.py>) 負責訂單流程。

建立訂單時大致流程是：

1. 用 Redis Lua script 原子扣庫存，避免超賣。
2. 建立訂單 ID 和訂單物件。
3. 把訂單狀態先寫到 Redis，狀態是 `pending`。
4. 發送 `order.created` event 到 RabbitMQ。
5. 回傳 `order queued` 給 client。

注意：建立訂單時不是馬上寫 PostgreSQL，而是丟到 RabbitMQ，之後由 worker 非同步寫入 DB。

取消訂單時流程是：

1. 從 PostgreSQL 查訂單。
2. 檢查訂單是否存在、是否屬於目前使用者、是否已取消。
3. 檢查是否超過取消期限。
4. 更新 PostgreSQL 訂單狀態為 `cancelled`。
5. Redis 補回庫存。
6. Redis 更新訂單狀態。
7. 發送 `order.cancelled` event。

[app/services/inventory_service.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/services/inventory_service.py>) 負責庫存邏輯。

查庫存時使用 cache-aside：

1. 先查 Redis。
2. Redis 有資料就直接回傳。
3. Redis 沒資料才查 PostgreSQL。
4. 查到後寫回 Redis，TTL 10 分鐘。

設定庫存時：

1. 寫入或更新 PostgreSQL。
2. 同步把庫存寫入 Redis。

**Repository 層：app/repositories/**

Repository 層負責包裝 SQL，讓 service 不需要直接寫資料庫查詢。

[app/repositories/order_repository.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/repositories/order_repository.py>) 負責 `orders` table：

- `create()`：新增訂單
- `get_by_id()`：用 ID 查訂單
- `update_status()`：更新狀態
- `list_by_employee()`：查某員工歷史訂單
- `get_today_order()`：查今天的訂單

[app/repositories/inventory_repository.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/repositories/inventory_repository.py>) 負責 `daily_inventory` table：

- `get()`：查庫存
- `decrement()`：扣 DB 庫存
- `increment()`：加回 DB 庫存
- `upsert()`：新增或更新庫存

Repository 不應該處理商業規則，它只負責資料存取。

**Model 層：app/models/**

[app/models/order.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/models/order.py>) 定義資料結構，主要用 Pydantic。

裡面有：

- `OrderStatus`：訂單狀態 enum，包含 `pending`、`confirmed`、`cancelled`、`completed`
- `Order`：訂單資料模型
- `DailyInventory`：每日庫存模型
- `PlaceOrderRequest`：建立訂單 request body
- `SetInventoryRequest`：設定庫存 request body
- `OrderEvent`：送到 RabbitMQ 的事件格式

簡單講，model 層定義「資料長什麼樣子」。

**DB / Infra 層：app/db/**

這層負責外部系統連線。

[app/db/postgres.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/db/postgres.py>) 建立 asyncpg connection pool。

[app/db/redis.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/db/redis.py>) 建立 Redis client，並定義：

- inventory key：`inventory:{menu_id}:{date}`
- order status key：`order:today:{order_id}`
- 原子扣庫存 Lua script
- 原子補庫存 Lua script

[app/db/rabbitmq.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/db/rabbitmq.py>) 負責 RabbitMQ：

- 建立 exchange：`order_events`
- 建立 queue：
  - `order.created`
  - `order.cancelled`
- 提供 `publish()`
- 提供 `consume()`

**Worker 層：app/worker/**

[app/worker/order_worker.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/worker/order_worker.py>) 是背景消費者。

它目前主要消費 `order.created` queue：

1. 收到 `order.created` event。
2. 建立 `Order` 物件。
3. 寫入 PostgreSQL。
4. 扣 PostgreSQL 裡的庫存。
5. 把 Redis 訂單狀態從 `pending` 改成 `confirmed`。

所以訂單建立流程是非同步的：API 先快速回應，DB 寫入由 worker 處理。

**Core 層：app/core/**

[app/core/config.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/core/config.py>) 管理設定值，例如：

- `DATABASE_URL`
- `REDIS_URL`
- `RABBITMQ_URL`
- `JWT_SECRET`

[app/core/auth.py](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/app/core/auth.py>) 負責 JWT 驗證。

API 裡的：

```python
user: Annotated[dict, Depends(get_current_user)]
```

會從 Bearer token 解出：

```python
{
    "user_id": ...,
    "role": ...
}
```

後面 service 就用 `user_id` 判斷訂單是不是自己的，用 `role` 判斷能不能設定庫存。

**資料庫結構**

[migrations/001_init.sql](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/migrations/001_init.sql>) 建立兩張表：

`orders`：存訂單資料。

重點欄位：

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

`daily_inventory`：存每日庫存。

重點欄位：

- `menu_id`
- `target_date`
- `remaining_quantity`

並且有唯一限制：

```sql
UNIQUE (menu_id, target_date)
```

代表同一個菜單同一天只能有一筆庫存紀錄。

**Docker / 部署**

[docker-compose.yml](</c:/Users/USER/Desktop/雲原生/order-service (2)/order-service/docker-compose.yml>) 會啟動四個服務：

- `order-service`：FastAPI app
- `postgres`：正式資料庫
- `redis`：快取與即時庫存
- `rabbitmq`：訊息佇列

PostgreSQL 初始化時會掛載 `migrations/001_init.sql`，所以 container 第一次啟動會建表。

**一個訂單從建立到完成的資料流**

```
POST /orders
  -> orders.py
  -> OrderService.place_order()
  -> Redis 原子扣庫存
  -> Redis 寫入 order status = pending
  -> RabbitMQ publish order.created
  -> 回傳 order queued

背景：
RabbitMQ order.created
  -> OrderWorker.handle_created()
  -> PostgreSQL 寫入 orders
  -> PostgreSQL 扣 daily_inventory
  -> Redis order status = confirmed
```

這個設計的核心想法是：**用 Redis 擋高併發庫存扣減，用 RabbitMQ 平滑化訂單寫入，用 PostgreSQL 保存最終正式資料**。
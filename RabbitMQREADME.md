# RabbitMQ in Order-Service

這份說明檔描述本專案中 RabbitMQ 的角色、資料流、優先級處理與常見運維/偵錯建議。

## 目的與角色

- RabbitMQ 作為事件總線，用於把 API 的同步請求與實際資料庫寫入流程解耦。
- API 層在 `POST /orders` 成功保留（Redis）庫存後，會發出 `order.created` 事件；worker 非同步消費此事件並完成 PostgreSQL 的 `orders` 寫入與 `daily_inventory` 的最終扣減。

## 架構概要

```
Client -> FastAPI (/orders) -> OrderService
                     \-> Redis reserve (Lua)
                     \-> publish to RabbitMQ (topic exchange: order_events)

RabbitMQ (exchange: order_events)
  -> queue: order.created (quorum)  -> OrderWorker.consume -> PostgreSQL update
  -> queue: order.cancelled (quorum) -> OrderWorker.consume -> PostgreSQL update
```

實作要點：

- Exchange: `order_events`（Topic）。
- Queues: `order.created`、`order.cancelled`。在程式中皆以 Quorum Queue 方式宣告（arguments: `x-queue-type`: `quorum`），提高持久性與可用性。
- Channel QoS: `prefetch_count=10`，每個 consumer 同時處理最多 10 則未 ack 的訊息以控制 concurrency。

## 訊息格式（範例）

- `order.created` payload 範例：

```json
{
  "order_id": null,
  "employee_id": 123,
  "vendor_id": 7,
  "menu_id": 42,
  "menu_name": "Lunch Box",
  "price": 120,
  "quantity": 3,
  "pickup_date": "2026-05-27",
  "status": "pending",
  "created_at": "2026-05-27T09:00:00+08:00"
}
```

注意：事件中包含 `pickup_date`（ISO 日期字串），worker 會以該日做 `daily_inventory` 的扣減。

## 優先級（Priority）如何決定

目前專案的 `app/db/rabbitmq.py` 實作：

- 使用單純的 queue 名與 routing key（routing_key 等於 queue 名），沒有設定 `x-max-priority`，因此 RabbitMQ 預設為 FIFO（先進先出）。
- 消費端透過 `prefetch_count` 控制每個 consumer 的併發數量。

因此：

- 現行行為沒有顆粒度的訊息優先級；訊息優先依發佈順序（queue 順序）處理。若要實作優先級，可採下列方案：
  - 使用 `x-max-priority` 與 message property `priority`（需要在 `declare_queue` 時加 `arguments={"x-max-priority": N}`），並於 publish 時在 `Message` 設定 `priority`。
  - 或採用多個 queue（例如 `order.created.high` / `order.created.normal`），並由 producer 根據條件選擇 routing_key；consumer 可先綁定高優先 queue，或使用 consumer fairness 策略。
  - 在高可用環境中，若使用 Quorum Queue，要留意目前 Quorum Queue 對 `x-max-priority` 的支援情況（歷史上 priority queue 與 quorum queue 的行為有所限制），實作前請先在測試環境驗證。

建議（短期）：若希望立刻支持高優先級訊息，建議採「多 queue + routing_key」方案（較容易回溯與控制），長期可考慮評估是否改用 Classic queue 並啟用 `x-max-priority`。

## 消費/處理語意

- Consumer 在接收訊息時以 `message.process()` 包裝；若發生例外，會在 consumer log 記錄錯誤，但目前實作沒有自動重試或 dead-letter exchange（可改進項）。
- `delivery_mode=DeliveryMode.PERSISTENT` 與 Quorum Queue 可確保訊息持久性與耐久性。
- Consumer 應以 idempotent 的方式處理訊息（例如資料庫寫入請用 unique-key 或先查詢避免重複寫入），以應對重傳或重試狀況。

## 錯誤處理與重試建議

- 目前代碼在 `consume()` 的 callback 捕捉 Exception 並記錄錯誤，但不會將錯誤 requeue（因此 message 一旦被 ack 就不會重試）。若要更可靠：
  - 將錯誤分級：可在錯誤發生時選擇 `message.nack(requeue=True)`（短暫性錯誤）或 `message.reject(requeue=False)`（不可重試）並交由 DLX（dead-letter exchange）處理。
  - 宣告 dead-letter exchange 與 dead-letter queue，並在該 queue 上設定重試延遲（或用 retry queue pattern）。

## 與 Redis / Service 的整合重點

- 預扣（reserve）流程：API 端先在 Redis 以 atomic Lua script 做 `DECRBY`（針對 `menu_id` + `pickup_date`），成功後將訂單狀態記為 `pending`（寫入 Redis），然後 publish `order.created`。若 publish 失敗，API 會把 Redis 的預扣回滾（`INCRBY`）。
- Worker consume 後會在 PostgreSQL `orders` 表寫入實際訂單，並在 `daily_inventory` 做扣減（同樣以 `pickup_date` 為 key）；最後在 Redis 將訂單狀態改為 `confirmed`。

因此整個流程是「Redis fast-path 保證使用者不會超賣」→「RabbitMQ 保證 eventual persistence 到 DB」→「Worker 做最終寫入與確認」。

## 運維與偵錯建議

- 啟動順序：確保 `postgres`、`redis`、`rabbitmq` 先啟動，`order-service` 在 lifespan 會重試連線（15 次嘗試）直到 RabbitMQ 可用。
- 常用指令：

```bash
docker compose up -d --build
docker compose logs -f order-service
docker compose logs -f rabbitmq
```

- 檢查 RabbitMQ queues：

```bash
docker compose exec rabbitmq rabbitmqctl list_queues name messages ready unacked
```

- 如果發現大量 `unacked` 訊息或 consumer error：檢查 worker log、檢查 consumer 的 `prefetch_count` 與併發數，並確認 consumer 沒有頻繁拋出例外。

## 改進建議（可選）

- 加入 Dead-Letter 與 Retry policies，以自動化處理暫時性錯誤與觀察累積失敗訊息。  
- 若需要訊息優先級，短期採 `high` / `normal` 分流 queue，長期評估 `x-max-priority` 的可行性與相容性。  
- 強化 consumer 的監控（metrics: processed, failed, processing_time, queue_depth）與 alert。  

---

若您想把 `priority` 直接寫入目前佈署，或要我幫您把 `consume()` 的錯誤處理改為 DLX+retry 的實作，我可以接著修改 `app/db/rabbitmq.py` 與 worker 的消費邏輯並更新相應 README 範例。

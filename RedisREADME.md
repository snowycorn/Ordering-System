# Redis in Order-Service

本檔說明本專案中 Redis 的用途、關鍵設計（包含 atomic Lua scripts）、key 命名、故障回滾行為，以及運維/除錯建議。

## Redis 的角色

- 作為 fast-path 的日別庫存預扣（reserve）快取，避免在高併發下超賣。API 會先在 Redis 做預扣，成功才回應使用者。
- 同時作為「訂單狀態 overlay」：在 reservation 成功後，API 會在 Redis 上寫入訂單狀態（`pending`）；worker 成功寫入 DB 後會把狀態改為 `confirmed`。

這樣的設計讓 API 回應快速且可短暫容忍 PostgreSQL、worker 的延遲或不可用情況。

## Key 命名與範例

- 日別庫存 key（string / integer）:

```
inventory:{menu_id}:{YYYY-MM-DD}  -> integer remaining
```

- 訂單狀態（hash 或 string）：

```
order:{order_uuid}:status -> "pending" | "confirmed" | "cancelled"
```

## Atomic Lua Script: `reserve_inventory`

目前在 `app/db/redis.py` 實作了一個 Lua script（`RESERVE_INVENTORY_SCRIPT`），用以原子地對 `inventory:{menu_id}:{date}` 執行 `DECRBY quantity`，避免 race condition 與 round-trip 次數過多。

語意：

- 當 key 不存在，script 回傳 `-2`（代表 404-like: inventory not set）。
- 當剩餘數量 < requested quantity，script 回傳 `-1`（代表不足，應回傳 409）。
- 否則回傳執行後的剩餘數量（>= 0），代表預扣成功。

呼叫流程（於 `OrderService.create_order()`）：

1. 使用 `reserve_inventory(menu_id, target_date, quantity)` 呼叫 Lua script。
2. 若回傳 `-2` 或 `-1`，API 回傳對應 HTTP 錯誤給 client（404 / 409）。
3. 若成功（>=0），在 Redis 上寫入 `order:{id_or_uuid}:status = pending`，接著 publish `order.created` 到 RabbitMQ。
4. 若 publish 失敗，API 會呼叫 `INCRBY` 把已預扣的數量回滾。

注意：Lua script 的原子性保證即使多個 API 同時請求也不會超賣。

## TTL、過期與清理

- 日別庫存通常不應該自動過期（由 `PUT /inventory/{menu_id}` 來管理每日庫存），但你可以在不再需要的 key 上設定適當 TTL（例如舊日期的 key）。
- 訂單狀態可以設定比較短的 TTL（例如 24-72 小時），視業務需求而定，或定期以 background job 做清理。

## 一致性與回滾

- 因為 Redis 只是 fast-path cache，實際資料仍以 PostgreSQL 為來源（source of truth）。
- 在 publish 失敗時 API 會回滾 Redis 的預扣；但在極少數情況（例如 publish 成功但 worker 未處理）可能導致 eventual inconsistency。為此設計了：
  - Worker 在處理訊息時應該是 idempotent（用 unique constraint 檢查重複寫入），並在成功後把 Redis 上的狀態設為 `confirmed`。
  - 可考慮建立 reconciliation job，比對 Redis 與 Postgres 的差異並補正。

## 操作與偵錯指令

- 列出某菜單某日的庫存：

```bash
docker compose exec redis redis-cli GET "inventory:42:2026-05-27"
```

- 在本地檢查一筆 order overlay：

```bash
docker compose exec redis redis-cli GET "order:some-order-uuid:status"
```

- 若懷疑 reserve 失敗或回滾：檢查 API logs（是否有 publish 失敗訊息）、以及 worker log（是否有消費並回寫 DB）。

## 為何要保留 Redis？（利弊簡述）

- 優點：
  - 極速的預扣響應，適合高併發場景；
  - Lua script 原子性避免 race condition；
  - 可做快速 overlay（status）給前端顯示訂單即時狀態。

- 缺點：
  - 增加系統複雜度與運維（需部署與監控 Redis）；
  - 需處理 cache 與 DB 之間的 eventual consistency。

若系統低流量且需要強一致性，可考慮移除 Redis，直接在 API 同步寫入 DB（需實作回滾）。若仍希望保留快速回應與短期緩衝，則保留 Redis 是合理選擇。

## 改進建議

- 將 Lua script 的錯誤/執行統計上報 metrics（成功/失敗/insufficient），以便監控熱點菜單或庫存耗盡情況。  
- 增加 reconciliation job，定期比對 `daily_inventory` 與 Redis `inventory:*`，自動修正或列報差異。  
- 若考慮移除 RabbitMQ，Redis Streams 可以同時提供預扣與持久化（視場景而定），我可以協助評估與轉換。

---

檔案新增完成。若您要我同時把 `app/db/redis.py` 的 Lua script 註解擴充到 README 示例中，或把 `INCR/DECR` 的 fallback 邏輯改成 queue retry，我可以接著修改程式碼與測試。

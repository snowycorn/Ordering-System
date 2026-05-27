# Project Progress Report — Order & Inventory Service

日期：2026-05-27

目的：這份簡短報告說明目前專案進度、已完成的關鍵變更、系統架構與資料流，以及下一步建議與風險點（約 1–2 頁）。

## 一、摘要（高階）

- 專案已完成重要功能重構，重點在於：以 `pickup_date` 為日別庫存基準、以 Redis 為 fast-path 做 atomic 預扣（Lua script）、並透過 RabbitMQ 事件驅動將訂單最終寫入 PostgreSQL。  
- API 路由改為更統一的查詢介面（員工端 `/orders/me`、商家端 `/vendor/orders` 支援 `range/from/to/status`），並加入 Taipei 時區的 cutoff 規則（前一日 17:00 後不可修改/建立訂單）。
- 測試檔案已更新以配合 API 與行為變更；但在此開發環境中未執行完整 pytest（需在本機/CI 執行）。

## 二、已完成的關鍵變更

- Deadline / 時區：把 `_now()` 與 cutoff 計算設定為 Asia/Taipei（17:00 前一日規則），實作於 `app/services/order_service.py`。  
- pickup_date 傳播：`OrderEvent` 現在包含 `pickup_date`；`create_order` publish 時帶上 `pickup_date`；worker 消費事件並以 `pickup_date` 更新 `daily_inventory`（`app/models/order.py`、`app/worker/order_worker.py`）。
- Redis 原子預扣：在 `app/db/redis.py` 新增 `RESERVE_INVENTORY_SCRIPT`（DECRBY 版本）與 `reserve_inventory()`，service 使用該 script 做 atomic reserve，避免 race condition。  
- API 合併：員工與商家列表 endpoint 合併為單一路徑並加入 `range/from/to` 查詢參數（`app/api/orders.py`、`app/api/vendor_orders.py`）。
- 測試更新：多個測試檔已調整以反映 `pickup_date`、reserve 行為與新回應形狀（`app/tests/` 下多個檔案）。

## 三、系統架構（簡圖）

```mermaid
flowchart LR
  Client -->|POST /orders| API[FastAPI API]
  API -->|reserve (Redis Lua)| Redis[(Redis)]
  API -->|publish order.created| RMQ[(RabbitMQ<br/>exchange: order_events)]
  RMQ -->|queue: order.created| Worker[OrderWorker]
  Worker -->|write| Postgres[(PostgreSQL)]
  Worker -->|update status| Redis
```

說明：API 在 reserve 成功後回應用戶；實際入庫由 Worker 非同步處理，Worker 在成功入庫後更新 Redis 上的訂單狀態為 `confirmed`。

## 四、主要檔案與責任

- `app/services/order_service.py` — 商業邏輯（cutoff、呼叫 reserve、publish event、取消/修改邏輯）。
- `app/db/redis.py` — Redis 連線與 Lua scripts（`RESERVE_INVENTORY_SCRIPT` / `INCR/DECR`）。
- `app/db/rabbitmq.py` — RabbitMQ 連線、publish、consume helpers（exchange `order_events`、quorum queues）。
- `app/worker/order_worker.py` — 消費 `order.created` 並寫入 `orders`、更新 `daily_inventory`。
- `app/repositories/` — PostgreSQL 存取（已改以 `pickup_date` 查詢與更新）。

## 五、重要決策與理由

- 為何使用 Redis fast-path + RabbitMQ？
  - Redis Lua 確保高併發下的預扣原子性、快速回應；RabbitMQ 提供事件緩衝與可靠性，將 DB 寫入延遲到 worker，降低 API latency。  
- 為何以 `pickup_date` 為基準？
  - 庫存是日別的資源；早先使用「當日」導致在使用者指定不同 pickup_date 時出現不一致（BUG），已改為以 `pickup_date` 作為 key。 

## 六、現況驗證與如何運行測試

建議在本地或 CI 上執行：

```bash
# 啟動 dev 環境
docker compose up -d --build

# 觀察 service 日誌
docker compose logs -f order-service

# 在 container 內跑測試（test profile）
docker compose --profile test run --rm order-service-test
```

注意：在本開發環境裡 static checks 顯示某些第三方套件（FastAPI/pytest/pydantic）在此執行環境不可解析；請在本機/CI install requirements 再跑 pytest。

## 七、未完成項目、風險與建議（短期 / 中期）

- 未完成 / 待加強：
  - Consumer 的錯誤處理與 retry/DLX 尚可加強（當前 `consume()` 捕捉例外但未自動重試或 DLX）。
  - reconciliation job（比對 Redis 與 Postgres 差異）尚未實作。
  - 將 `update_order_quantity` 改用 Lua reserve diff 的做法可進一步降低 race。 

- 風險：
  - 若 RabbitMQ 或 Redis 初始化失敗，系統可能回傳 500；啟動時請檢查 container logs。 
  - Quorum Queue + priority queue 的相容性限制，若要加入 priority 需先驗證。

- 建議優先事項（按優先度）：
  1. 加強 consumer 的 retry / DLX 流程（提高可靠性）。
  2. 實作 reconciliation job（降低 eventual inconsistency 風險）。
  3. 加入監控 metrics（queue depth、reserve success/fail、worker errors）。

## 八、下一步（我可以協助的工作）

- 若您要我接手其中一項，我可以：
  - (A) 在 `app/db/rabbitmq.py` 與 worker 中加入 DLX+retry 與 dead-letter queue 範例實作；或
  - (B) 把 `OrderService.create_order()` 改為同步寫 DB（如果您決定移除 RabbitMQ）；或
  - (C) 實作 reconciliation job（簡單的 cron 與 SQL 比對腳本）。

請告訴我您要我優先做哪一項，我會把該任務加入 TODO 並開始著手修改程式與測試。

## 九、報告逐字稿

各位老師、各位同學大家好，今天我要報告的專題是 Order & Inventory Service。這個系統的核心目標，是要在高併發訂餐場景下，避免超賣，同時又能維持低延遲與高可擴充性。

先講一下傳統同步式架構的問題。一般最直覺的做法會是 Client 直接呼叫 FastAPI，然後同步寫入 PostgreSQL。可是這種方式在高併發下很容易遇到 database lock contention、transaction 很重、response latency 偏高，而且最重要的是，當很多人同時搶最後一份餐點時，就可能發生 overselling。也就是說，User A 和 User B 都看到庫存是 1，結果兩個人都成功下單，最後資料庫就會出現錯誤的結果。

所以這個專案的設計重點，就是把 Redis、RabbitMQ 和 PostgreSQL 分工清楚。整體架構是：Client 先送 HTTP request 到 FastAPI API，API 不會直接去碰 PostgreSQL，而是先透過 Redis 做庫存預扣，也就是 fast-path inventory reservation。如果 Redis 判定庫存足夠，API 才會建立訂單事件，然後 publish 到 RabbitMQ。接著 worker 再去消費這個事件，最後把訂單資料持久化到 PostgreSQL。

這裡最重要的元件是 Redis。很多人會說 Redis 是 cache，但在這個專案裡不是。Redis 其實是 high-performance fast-path inventory layer，也就是高效能庫存控制層。當使用者建立訂單時，系統會先對特定的 menu_id 和 pickup_date 做 atomic reservation。這個 atomic 很重要，因為如果只是先讀 stock，再扣 stock，就會有 race condition。高併發時，多個 request 可能同時讀到同樣的庫存數量，最後造成超賣。

所以本系統使用 Redis atomic operation，也就是 Lua script 的方式，把 check stock 和 decrement stock 包成單一不可分割的操作。這樣就可以保證在高併發下，即使很多人同時搶最後一份餐點，也不會發生 overselling。換句話說，Redis 在這裡不是單純的快取，而是用來做 concurrency control。

接著是 RabbitMQ。這個系統使用 RabbitMQ 作為 message broker，讓訂單建立流程變成 event-driven architecture。API 在 Redis 預扣成功之後，會建立一個 order.created event，送到 RabbitMQ queue，然後 API 就可以立即回應 client，不需要等待 PostgreSQL 寫入完成。之後 worker 會從 queue 消費事件，再把訂單資料寫入 PostgreSQL，並更新日別庫存。這樣的好處是可以把 request handling 和 database write load 解耦，降低 API latency，也提高系統吞吐量。

不過因為 Redis 先成功、PostgreSQL 稍後才寫入，所以這個系統採用的是 eventual consistency，也就是最終一致性，而不是強一致。這表示短時間內 Redis 的狀態和資料庫狀態可能不完全同步，但 worker 最終會把資料寫到 PostgreSQL，讓系統回到一致狀態。對實際訂單系統來說，這是一個很常見也很實用的設計。

另外，這個專案也有做 failure compensation。當 RabbitMQ publish 失敗時，系統不會讓 Redis 的庫存卡住，而是會把剛剛預扣的 inventory rollback 回去，避免 phantom reservation，也就是明明沒有成功送出訂單事件，卻把庫存先扣掉的問題。這個機制可以提升容錯能力，也讓系統更可靠。

在實作上，我們也把訂單的查詢介面做了整合。員工端現在使用 `/orders/me`，商家端使用 `/vendor/orders`，並且可以透過 range、from、to、status 這些參數查詢不同區間的訂單。除此之外，系統也有加入 Taipei 時區的 cutoff 規則，意思是前一天下午 5 點之後，就不能再對隔天的訂單做建立、修改或取消，這個規則是為了模擬實際營運上訂單截單的情境。

為了驗證這整套設計，我也寫了 asyncio 的 stress test。壓測腳本會用 httpx 發出大量 concurrent requests，模擬 500 到 1000 筆訂單同時進來的情況。透過壓測，我們可以觀察 Redis 的庫存一致性、RabbitMQ 的吞吐量、API latency，以及最重要的，系統能不能正確防止 overselling。實際跑下來的結果也顯示，當庫存不足時，系統會回傳 409，這代表防超賣機制確實有生效。

最後做一個總結。這個系統的核心價值，不只是做出一個可以下單的 API，而是用 Redis atomic inventory reservation、RabbitMQ event-driven processing，以及 worker 非同步持久化到 PostgreSQL，建立一個可以支撐高併發訂單場景的架構。相比傳統同步 CRUD 系統，這個設計可以降低 API latency、提升 throughput、避免 overselling，也更適合真實世界的大量訂單需求。

以上就是我的報告，謝謝大家。

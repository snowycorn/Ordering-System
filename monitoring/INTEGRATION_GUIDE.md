# 監控接入指引（給各服務 owner）

我建了一套集中監控（Prometheus + Loki + Grafana，跑在 `<monitoring-EC2-IP>`）。
本文件說明**你的服務最少要做什麼**才能被監控到。`vendor-menu` 與 `register`（NestJS）已完成，
以下針對其餘服務。

## 共通約定

- **Metrics 端點**：你的服務暴露 `GET /metrics`（Prometheus 文字格式），**走 VPC 內網**被抓，不經 Kong。
- **Metric 命名統一**（方便共用儀表板）：
  - `http_requests_total`（counter）labels：`method`、`route`、`status_code`
  - `http_request_duration_seconds`（histogram）同上 labels
  - `route` 用**模板路徑**（如 `/orders/:id`）而非實際 id，避免高基數爆量。
- **Logs**：輸出 **JSON 到 stdout**（讓 Loki 好解析），不要自己寫檔。
- **網路**：確認 security group 允許 monitoring EC2 抓你的 metrics port（入向）、你那台能對 monitoring `:3100` 出向。
- 把你服務的**私有 `IP:port`** 給我，我加進 [`prometheus/prometheus.yml`](prometheus/prometheus.yml) 的 scrape 清單。

---

## C1. Express 服務（iam / notification / recommendation / billing / appeal-admin）

安裝：

```bash
npm install prom-client pino pino-http
```

在 `src/app.js`：

```js
const client = require('prom-client');
client.collectDefaultMetrics(); // Node process/GC/heap 預設 metric

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// 量測每個請求
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    // 用 route template 避免高基數；Express 是 req.route?.path
    const route = req.route?.path || req.path;
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

// 暴露 /metrics
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

JSON 日誌（`pino-http`）：

```js
const pinoHttp = require('pino-http')();
app.use(pinoHttp); // 每請求一筆 JSON log 到 stdout
```

---

## C2. FastAPI 服務（order-inventory，Python）

安裝：

```bash
pip install prometheus-fastapi-instrumentator python-json-logger
```

在 `app/main.py`：

```python
from prometheus_fastapi_instrumentator import Instrumentator

# app = FastAPI(...) 之後
Instrumentator().instrument(app).expose(app)  # 自動提供 GET /metrics + 請求延遲/數量 metric
```

JSON 日誌：

```python
import logging
from pythonjsonlogger import jsonlogger

handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter())
logging.getLogger().handlers = [handler]
logging.getLogger().setLevel(logging.INFO)
```

**選配** Redis / RabbitMQ 監控：
- Redis：跑 `oliver006/redis_exporter`，Prometheus 加一個 job 抓它的 `:9121`。
- RabbitMQ：啟用內建 `rabbitmq_prometheus` plugin（`rabbitmq-plugins enable rabbitmq_prometheus`），暴露 `:15692/metrics`，Prometheus 加 job 抓。

---

## C3. Kong gateway（基礎設施層，強烈建議、CP 值最高）

**不需任何後端服務配合**，光改 `kong.yml` 就能拿到「所有 API 整體流量視圖」（每條 route 的請求數、延遲、HTTP 狀態碼分布、上游健康度、頻寬）。

在 `kong.yml` 的全域 `plugins:` 加：

```yaml
plugins:
  - name: prometheus
    config:
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true
```

Kong 會在 Admin API（通常 `:8001`）暴露 `/metrics`。Prometheus 的 `kong` job 已預留，把 target 改成 Kong host 私有 IP 即可。

---

## C5. 部署 Promtail 收集你那台 host 的 log

若你的服務跑在**獨立 EC2**（如 order-inventory 的 `172.31.10.107`），請在那台跑一支 Promtail：

```bash
# 取得 monitoring/promtail/ 下的兩個檔，編輯 promtail-config.yml：
#   clients.url -> http://<monitoring-EC2-IP>:3100/loki/api/v1/push
docker compose -f docker-compose.promtail.yml up -d
```

它會自動 tail 你機器上**所有** Docker 容器的 stdout，打上 `container_name` label 推到中央 Loki。
完成後我可在 Grafana 用 `{container_name="order-service"}` 查到你的日誌。

---

## 完成後

把私有 `IP:port` 給我加進 scrape 清單；Prometheus `/targets` 對應 job 會由 `down` 轉 `up`，
Grafana Overview 儀表板就會出現你服務的曲線。

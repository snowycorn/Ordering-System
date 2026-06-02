# Ordering System 監控 Stack（Prometheus + Loki + Grafana）

集中式可觀測性：Prometheus 收 **metrics**、Loki 收 **logs**、Grafana 出 **儀表板**。

## 架構

```
            ┌──────────────────────── monitoring EC2 ─────────────────────────┐
            │  Prometheus :9090 ──(scrape /metrics)──┐                         │
            │  Loki :3100 ◄──(push)──┐               │                         │
            │  Grafana :3000 ◄───────┴── datasources ┴── Prometheus + Loki     │
            └───────────────▲────────────────────────────▲────────────────────┘
                            │ push logs                   │ scrape metrics (VPC 內網，不經 Kong)
        ┌───────────────────┴──────────┐      ┌───────────┴───────────────────────────────┐
   每台 host 的 Promtail            各服務 /metrics（vendor-menu:3007 / register:3008 / ...）
```

- **Metrics 走 VPC 內網直抓**，不經 Kong gateway（監控屬東西向流量，避免被 JWT/限流攔截、避免 `/metrics` 暴露公網）。
- **Logs** 由每台 host 的 Promtail tail 容器 stdout，推到中央 Loki。

## 部署位置

監控 stack 跑在**一台與各微服務同 VPC 的 EC2**（建議獨立一台；退而求其次放現有 `172.31.2.29`）。
**不可放本機**——本機連不到 `172.x` 私有網段。

Security group 需放行：
- monitoring EC2 → 各服務 metrics port（3007/3008/8081/3001-3005/8001）**入向**
- 各服務 host → monitoring EC2 `:3100`（Loki）**出向**（Promtail push）

## 自動部署（GitHub Actions → EC2-B）

[`.github/workflows/monitoring.yml`](../.github/workflows/monitoring.yml) 會在 `monitoring/**` 變更
（或手動 `workflow_dispatch`）時，SSH 進 **EC2-B** 自動部署，沿用既有 secrets `EC2_B_HOST` /
`EC2_B_SSH_KEY`（**不需新增 secret**）。流程：

1. 檢查並（必要時）安裝 Docker Engine + compose plugin
2. `git pull` 既有 `~/app`
3. `docker compose up -d` 起中央 stack（Prometheus + Loki + Grafana）
4. 起 **PM2 版 Promtail**（見下）收 NestJS 服務的 log
5. health check：Prometheus `/-/healthy`、Loki `/ready`、Grafana `/api/health`

> EC2-B 上 vendor-menu / register 是用 **PM2 跑（非 Docker）**，pino 的 JSON log 進 `~/.pm2/logs/*.log`，
> 所以這台用 [`promtail/promtail-config.pm2.yml`](promtail/promtail-config.pm2.yml) +
> [`promtail/docker-compose.promtail-pm2.yml`](promtail/docker-compose.promtail-pm2.yml)（tail PM2 log 檔），
> 而非 docker_sd 版。其他用 Docker 跑服務的主機才用 [`promtail/promtail-config.yml`](promtail/promtail-config.yml)。

## 手動啟動中央 stack

```bash
cd monitoring
docker compose up -d
```

UI：
- Prometheus `http://54.252.173.148:9090`（`/targets` 看抓取狀態）
- Grafana `http://54.252.173.148:3000`（預設 admin / admin；已自動佈建 datasources 與 "Ordering System Overview" 儀表板）
- Loki `http://54.252.173.148:3100/ready`

> 若 monitoring EC2 同時也跑 NestJS（佔 3000），把 `docker-compose.yml` 的 grafana port 改成 `3300:3000`。

## 設定 scrape targets

編輯 [`prometheus/prometheus.yml`](prometheus/prometheus.yml)，把各 job 的 `targets` 換成實際私有 IP:port。
未埋點的服務（order-inventory、Express x5、Kong）在 owner 完成前會顯示 `down`，屬正常。

> 正式環境建議改用 `ec2_sd_config` 自動發現（範例已寫在 prometheus.yml 註解內）。

## 部署 Promtail（每一台跑容器的 host 都要）

```bash
# 在每台 host 上：
# 1. 編輯 promtail/promtail-config.yml，把 <monitoring-host> 換成 monitoring EC2 私有 IP
# 2. 啟動
cd monitoring/promtail
docker compose -f docker-compose.promtail.yml up -d
```

同台主機的服務會被自動收集（owner 不用改 code）。跨主機（別人的 EC2）需該 owner 自行起 Promtail——見 [`INTEGRATION_GUIDE.md`](INTEGRATION_GUIDE.md)。

## 驗證

1. Prometheus `/targets`：`vendor-menu`、`register` 兩個 job 為 `up`。
2. Grafana Overview：打幾個 API 後出現 QPS / p95 延遲 / 5xx 曲線。
3. Grafana Explore 選 Loki，查 `{container_name="vendor-menu-service"}` 看得到 JSON 請求日誌。

## 給其他服務 owner

非我管轄的 6 個服務（Express x5 + FastAPI order-inventory）與 Kong 各自要做的事，整理在
[`INTEGRATION_GUIDE.md`](INTEGRATION_GUIDE.md)，可直接轉給對應 owner。

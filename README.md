# Ordering System

Ordering System 是企業餐點訂購平台的 monorepo，包含後端微服務、前端 Next.js 介面，以及監控設定。

## 專案結構

```text
.
├── frontend/              # Next.js frontend / BFF
├── register-service/      # NestJS 註冊申請服務
├── vendor-menu-service/   # NestJS 廠商與菜單服務
├── monitoring/            # Prometheus / Grafana / Loki / Promtail
└── .github/workflows/     # GitHub Actions CI/CD
```

## 服務說明

| 路徑 | 說明 |
| --- | --- |
| `frontend/` | 員工、廠商、管理委員會三種角色的 Web UI，並提供 Next.js BFF API routes。 |
| `register-service/` | 處理註冊申請、申請審核、S3 上傳 URL、IAM 與 Vendor Menu service integration。 |
| `vendor-menu-service/` | 處理廠商資料、菜單、庫存同步、廠區、廠商停權與公開菜單查詢。 |
| `monitoring/` | 監控與日誌收集設定。 |

## Frontend

安裝與啟動：

```bash
cd frontend
npm ci
npm run dev
```

常用檢查：

```bash
cd frontend
npm run lint
npm run test:coverage -- --runInBand
npm run build
```

Frontend unit coverage 目前由 Jest threshold 保護，目標為全域 80% 以上：

- Statements: 90%+
- Branches: 80%+
- Functions: 90%+
- Lines: 90%+

詳細前端文件請看 `frontend/README.md`。

## Backend Services

### register-service

```bash
cd register-service
npm ci
npx prisma generate
npm test
npm run build
```

### vendor-menu-service

```bash
cd vendor-menu-service
npm ci
npx prisma generate
npm test
npm run build
```

各服務需要的資料庫、S3、IAM 或其他 integration URL，請參考各服務資料夾內的 README 與 GitHub Actions workflow。

## GitHub Actions

目前有兩組主要 workflow：

| Workflow | 觸發條件 | 內容 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `register-service/**`、`vendor-menu-service/**` 或 workflow 變更 push 到 `main` | 後端服務測試與 EC2-B deploy。 |
| `.github/workflows/frontend-ci.yml` | `frontend/**` 或 workflow 變更 push / PR 到 `main` | Frontend lint、unit coverage、Next.js build。 |

Frontend CI 會執行：

```bash
npm ci
npm run lint
npm run test:coverage -- --runInBand
npm run build
```

## 部署

後端部署流程目前保留在 `.github/workflows/ci.yml`，會透過 SSH 更新 EC2-B 上的 `vendor-menu-service` 和 `register-service`。

前端目前已整合到 repo，CI 會先確保 lint、coverage 與 build 通過。若要讓前端也自動部署，可在 `frontend-ci.yml` 後續新增 Docker build/push 或 SSH deploy job。

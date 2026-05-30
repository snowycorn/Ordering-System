# Vendor Menu Service

負責管理商家資料與菜單的微服務，屬於 Ordering System 雲原生架構中的一個獨立服務節點。

## 技術棧

- **Framework**: NestJS (TypeScript)
- **ORM**: Prisma 7 + Driver Adapter (`@prisma/adapter-pg`)
- **Database**: PostgreSQL 15
- **Runtime**: Node.js 20

## 服務架構

```
vendor-menu-service
├── /api/v1/vendors              # 公開商家列表（員工查詢用）
├── /api/v1/vendors/:id/menus    # 公開菜單查詢，含當日配額（員工查詢用）
├── /api/v1/menus                # 全量菜單查詢（Recommendation Service 內部用）
├── /api/v1/vendors/me           # 商家自身資料管理（需 x-user-id header）
├── /api/v1/vendors/:id          # 管理員用商家查詢與修改
├── /api/v1/vendors/me/menus     # 商家菜單 CRUD 與每日限量管理
└── /health                      # K8s Liveness/Readiness Probe
```

## 資料庫 Schema

| Table | 說明 |
|---|---|
| `vendors` | 商家基本資料（名稱、類別、服務廠區、狀態） |
| `menus` | 菜單項目（名稱、價格、圖片、預設每日限量） |
| `daily_quotas` | 指定日期的限量覆蓋設定 |

---

## 本地開發快速啟動

### 前置需求

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 步驟

**1. 安裝套件**

```bash
npm install
```

**2. 設定環境變數**

複製範本並依需求調整（預設值通常不需要改）：

```bash
cp .env.example .env
```

> `.env` 已包含預設的本地連線字串 `postgresql://postgres:postgres@localhost:5432/vendor_menu_db`

**3. 啟動 PostgreSQL 資料庫**

```bash
docker-compose up -d
```

確認資料庫健康狀態：

```bash
docker-compose ps
```

**4. 執行資料庫遷移 (建立 Table)**

```bash
npx prisma migrate dev
```

**5. 啟動開發伺服器**

```bash
npm run start:dev
```

服務啟動後可透過 `http://localhost:3000` 存取。健康檢查：`http://localhost:3000/health`

---

## 常用指令

```bash
# 啟動開發伺服器（熱重載）
npm run start:dev

# 執行單元測試
npm run test

# 執行測試覆蓋率報告
npm run test:cov

# 開啟 Prisma Studio（資料庫視覺化 GUI）
npx prisma studio

# 新增 DB migration
npx prisma migrate dev --name <migration-name>

# 停止並移除本地資料庫容器
docker-compose down

# 停止並同時清除資料（慎用）
docker-compose down -v
```

---

## API 設計說明

### 身分驗證機制

本服務不直接處理 JWT 驗證。所有需要身分識別的請求，預設由上游 **API Gateway** 驗證 Token 後，將解析出的使用者 ID 透過 `x-user-id` Header 傳入。

### Endpoints

#### 公開查詢（員工端，無需 Header）

| Method | Path | Query Params | 說明 |
|---|---|---|---|
| `GET` | `/api/v1/vendors` | `factoryZone` (選填) | 查詢所有上架商家 |
| `GET` | `/api/v1/vendors/:id/menus` | `date` YYYY-MM-DD (選填，預設今天) | 查詢指定商家菜單及當日配額 |
| `GET` | `/api/v1/menus` | `vendorId` (選填)、`isActive` (選填，預設 true) | 全量菜單，供 Recommendation Service |
| `GET` | `/api/v1/menus/:menuId` | — | 查詢單一菜單詳情（含商家資訊，下架回 404） |

#### 商家自管（需 `x-user-id` Header）

| Method | Path | 說明 |
|---|---|---|
| `GET` | `/api/v1/vendors/me` | 查詢自己的商家資料 |
| `PUT` | `/api/v1/vendors/me` | 更新自己的商家資料（name / category / description / factoryZone / status） |
| `GET` | `/api/v1/vendors/me/menus` | 查詢自己所有菜單（含下架） |
| `GET` | `/api/v1/vendors/me/menus/:menuId` | 查詢單一菜單詳情（含今日起的 DailyQuota 排程，越權回 404） |
| `POST` | `/api/v1/vendors/me/menus` | 新增菜單項目 |
| `PUT` | `/api/v1/vendors/me/menus/:menuId` | 更新菜單項目（name / price / imageUrl / dailyLimit / isActive） |
| `DELETE` | `/api/v1/vendors/me/menus/:menuId` | 下架菜單（軟刪除，`isActive = false`） |
| `PUT` | `/api/v1/vendors/me/menus/:menuId/quotas` | Upsert 指定日期的每日限量 |
| `GET` | `/api/v1/vendors/me/menus/upload-image-url` | 取得 S3 Pre-signed PUT URL（`?contentType=image/jpeg`，限速 10 req/min） |

#### 管理員（福委會，需 `x-user-role: admin`）

| Method | Path | 說明 |
|---|---|---|
| `POST` | `/api/v1/vendors` | **建立新商家帳號**（僅管理員可用，回傳 201） |
| `GET` | `/api/v1/vendors/:id` | 查詢指定商家 |
| `PUT` | `/api/v1/vendors/:id` | 更新指定商家資料 |

> **角色驗證機制**：API Gateway 驗證 JWT 後，將使用者角色寫入 `x-user-role` Header（值如 `admin` / `vendor` / `employee`）。服務內的 `RolesGuard` 讀取此 Header 並對照 `@Roles()` 裝飾器；未標記 `@Roles()` 的端點一律放行。

#### 系統

| Method | Path | 說明 |
|---|---|---|
| `GET` | `/health` | K8s Liveness / Readiness Probe（回傳 DB ping 狀態） |

### 圖片上傳機制 (AWS S3 Pre-signed URL)

為降低後端伺服器負載並提升上傳速度，圖片上傳採用 **S3 Pre-signed URL** 機制，流程如下：

1. 前端呼叫 `GET /api/v1/vendors/me/menus/upload-image-url?contentType=image/jpeg`
2. 後端向 AWS 請求並回傳一組具時效性（5 分鐘）的 `{ uploadUrl, imageUrl }`
3. 前端使用 `uploadUrl` 透過 `HTTP PUT` 直接將圖片二進位檔案上傳至 AWS S3
4. 前端將 `imageUrl` 帶入建立/更新菜單的 API（`POST /menus` 或 `PUT /menus/:menuId`）

> **優勢**：圖片流量不經過 NestJS Container，節省頻寬與記憶體；搭配 CloudFront CDN 加速讀取；透過 IAM IRSA 控管權限，無需在程式碼中配置 Secret Key。

---

## 生產部署

本服務使用 Multi-Stage Docker Build，生產 Image 不包含原始碼與開發依賴：

```bash
# 建置 Production Image
docker build -t vendor-menu-service:latest .
```

生產環境的環境變數（`DATABASE_URL` 等）請透過 **Kubernetes Secret** 或環境變數注入，不應直接寫入 Image。

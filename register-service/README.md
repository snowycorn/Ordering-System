# Register Service（入駐申請與審核服務）

負責外部商家**全流程入駐管理**的獨立微服務：外部商家填寫申請表單、上傳營登 PDF，福委會後台進行審核，核准後自動在 IAM 建立商家帳號、在 Vendor & Menu 服務建立商家記錄，並寄出帳號資訊給新商家。

- **Port（生產 / 本地）**：`3008`
- **Framework**：NestJS (TypeScript) + Prisma 7
- **Database**：PostgreSQL（`register_db`，只存入駐流程資料）
- **物件儲存**：AWS S3 私有 Bucket（存放營登 PDF）
- **跨服務溝通**：HTTP（呼叫 IAM、Vendor & Menu Service）

---

## 入駐流程總覽

```
外部商家                    Register Service              S3 (私有)     IAM Service     Vendor & Menu
   │                              │                          │               │                 │
   │  1. GET /register/upload-url │                          │               │                 │
   │ ────────────────────────────►│                          │               │                 │
   │ ◄── { uploadUrl, documentKey}│                          │               │                 │
   │                              │                          │               │                 │
   │  2. PUT PDF（直傳 S3）        │                          │               │                 │
   │ ──────────────────────────────────────────────────────►│               │                 │
   │                              │                          │               │                 │
   │  3. POST /register/applications                         │               │                 │
   │ ────────────────────────────►│ 寫入 pending_vendors      │               │                 │
   │ ◄── { id, status: PENDING }  │ (status = PENDING)        │               │                 │
   │                              │                          │               │                 │
福委會                            │                          │               │                 │
   │  4. GET /admin/.../applications                         │               │                 │
   │ ────────────────────────────►│                          │               │                 │
   │                              │ 產生讀取 Pre-signed URL ──►│               │                 │
   │ ◄── { ...application, document: { downloadUrl } }      │               │                 │
   │                              │                          │               │                 │
   │  5. POST /admin/.../:id/approve                         │               │                 │
   │ ────────────────────────────►│ 產生 tempPassword         │               │                 │
   │                              │ POST /users ──────────────────────────►│                 │
   │                              │ (建立 vendor 帳號)         │               │                 │
   │                              │ POST /api/v1/admin/vendors ─────────────────────────────►│
   │                              │ (建立商家記錄)              │               │                 │
   │                              │ status → APPROVED         │               │                 │
   │                              │ 寄歡迎信（email + 初始密碼）  │               │                 │
   │ ◄── { ...record, tempPassword}│                          │               │                 │
```

> **冪等保證**：IAM 若回 409（帳號已存在）視為成功，approve 可安全重試。步驟 5 只要 IAM 或 vendor-menu 任一失敗，`status` 保持 `PENDING`，福委會可直接重送。

---

## 資料庫 Schema（`pending_vendors`）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID | 主鍵，同時是申請人查詢進度的隨機 Key（不可猜測） |
| `vendor_name` | VARCHAR(255) | 商家名稱 |
| `email` | VARCHAR(255) | 聯絡 email；核准後作為 IAM 登入帳號 |
| `phone` | VARCHAR(50) | 聯絡電話（選填） |
| `factory_zone` | VARCHAR(100) | 申請服務的廠區（選填） |
| `documents_url` | TEXT | 營登 PDF 在私有 S3 Bucket 的 object key |
| `status` | VARCHAR(50) | `PENDING` \| `APPROVED` \| `REJECTED` |
| `review_notes` | TEXT | 福委會審核備註 / 駁回原因（選填） |
| `reviewed_by` | VARCHAR(255) | 審核者識別（`x-user-id` header，選填） |
| `reviewed_at` | TIMESTAMPTZ | 審核時間 |
| `created_at` | TIMESTAMPTZ | 申請送出時間 |
| `updated_at` | TIMESTAMPTZ | 最後更新時間 |

> 採 **Database per Service**：核准後正式的 `vendors` / `users` 資料分別由 Vendor & Menu Service 和 IAM 各自建立，本服務只負責入駐流程本身。

---

## 本地開發快速啟動

### 前置需求

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- 若要測試完整核准流程：IAM（port 3001）與 Vendor & Menu Service（port 3007）同時啟動

### 步驟

**1. 安裝套件**

```bash
npm install
```

**2. 設定環境變數**

```bash
cp .env.example .env
```

`.env` 預設已填入本地開發值，AWS / SMTP 等選填項可暫時留空（見下方說明）。

**3. 啟動 PostgreSQL**

```bash
docker-compose up -d
```

**4. 執行資料庫遷移**

```bash
npx prisma migrate dev
```

**5. 啟動開發伺服器**

```bash
npm run start:dev
```

| URL | 說明 |
|---|---|
| `http://localhost:3008` | 服務根路徑 |
| `http://localhost:3008/health` | Healthcheck（含 DB ping） |

### 本地環境說明

| 功能 | 本地行為 |
|---|---|
| S3 上傳 / 讀取 URL | 需真實 AWS 憑證（`~/.aws/credentials` 或 env），否則產 URL 的步驟會失敗；若只測試非 S3 流程可暫時跳過 |
| 核准時呼叫 IAM | 需 IAM 在 `localhost:3001` 啟動，且 `INTERNAL_ADMIN_EMAIL/PASSWORD` 對應有效 admin 帳號 |
| 核准時呼叫 vendor-menu | 需 vendor-menu 在 `localhost:3007` 啟動 |
| 歡迎信 | 未設定 `SMTP_HOST` 時只寫入 log（不中斷流程） |

---

## 常用指令

```bash
npm run start:dev                      # 啟動開發伺服器（熱重載）
npm run build                          # 編譯到 dist/
npm run test                           # 單元測試
npx prisma studio                      # 資料庫視覺化 GUI
npx prisma migrate dev --name <name>   # 新增 migration
docker-compose down                    # 停止本地 PostgreSQL
docker-compose down -v                 # 停止並清除資料（慎用）
```

---

## API 文件

### 身分驗證機制

本服務**不直接驗 JWT**。流程如下：

- **公開端點**（外部商家入駐用）：Kong 不掛 JWT plugin，直接放行。
- **管理員端點**（福委會審核用）：Kong 驗證 JWT 後，將使用者 ID 與角色注入為 Header：
  - `x-user-id`：使用者 ID
  - `x-user-role`：角色字串（需為 `admin`）
- 服務內的 `RolesGuard` 讀取 `x-user-role` Header；未標記 `@Roles()` 的端點一律放行。

---

### 外部商家端點（公開，不需登入）

#### `GET /api/v1/register/upload-url`

取得一組具時效（5 分鐘）的 S3 Pre-signed **PUT** URL，供前端直接上傳營登 PDF。

**Query Params**

| 參數 | 必填 | 說明 |
|---|---|---|
| `contentType` | ✅ | 必須為 `application/pdf` |

**限速**：同一 IP 每分鐘最多 5 次。

**Response 200**

```json
{
  "uploadUrl": "https://s3.ap-northeast-1.amazonaws.com/register-documents-private-01/vendor-documents/3f1c...?X-Amz-...",
  "documentKey": "vendor-documents/3f1c...pdf",
  "expiresIn": 300
}
```

**上傳流程**

```
1. 呼叫本端點取得 { uploadUrl, documentKey }
2. 前端以 HTTP PUT 直接上傳 PDF 至 uploadUrl（Content-Type: application/pdf）
3. 保留 documentKey，於送出申請時帶入 body
```

> PDF 流量**完全不經過後端容器**，節省頻寬與記憶體。

---

#### `POST /api/v1/register/applications`

送出入駐申請表單。

**限速**：同一 IP 每分鐘最多 5 次。

**Request Body**

```json
{
  "vendorName": "好吃便當",
  "email": "owner@example.com",
  "phone": "0912345678",
  "factoryZones": ["A廠", "B廠"],
  "documentsKey": "vendor-documents/3f1c...pdf"
}
```

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `vendorName` | string | ✅ | 商家名稱，最多 255 字 |
| `email` | string (email) | ✅ | 聯絡 email；核准後作為登入帳號，最多 255 字 |
| `phone` | string | — | 聯絡電話，最多 50 字 |
| `factoryZones` | string[] | — | 申請服務廠區（可多個），每項最多 100 字。合法廠區清單由 vendor-menu 把關（見 `GET /api/v1/vendors/factory-zones`） |
| `documentsKey` | string | — | upload-url 端點回傳的 S3 object key |

**Response 201**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "createdAt": "2026-05-30T08:00:00.000Z",
  "message": "入駐申請已送出，請保留此 id 以查詢審核進度"
}
```

> **請妥善保存回傳的 `id`**（隨機 UUID），這是後續查詢進度的唯一憑證。

---

#### `GET /api/v1/register/applications/:id`

申請人憑 `id` 查詢自己的審核進度。

**Response 200**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "vendorName": "好吃便當",
  "status": "PENDING",
  "reviewNotes": null,
  "createdAt": "2026-05-30T08:00:00.000Z",
  "reviewedAt": null
}
```

`status` 可能值：`PENDING`（待審核）、`APPROVED`（核准）、`REJECTED`（駁回）

---

### 福委會端點（管理員，需 `x-user-role: admin`）

> 以下所有端點均需 API Gateway 注入 `x-user-role: admin` Header，否則回 403。

#### `GET /api/v1/admin/register/applications`

列出入駐申請，可依狀態過濾。

**Query Params**

| 參數 | 說明 |
|---|---|
| `status` | 選填，`PENDING` / `APPROVED` / `REJECTED` |

**Response 200**（陣列）

```json
[
  {
    "id": "550e8400-...",
    "vendorName": "好吃便當",
    "email": "owner@example.com",
    "phone": "0912345678",
    "factoryZones": ["A廠", "B廠"],
    "documentsKey": "vendor-documents/3f1c...pdf",
    "status": "PENDING",
    "reviewNotes": null,
    "reviewedBy": null,
    "reviewedAt": null,
    "createdAt": "2026-05-30T08:00:00.000Z",
    "updatedAt": "2026-05-30T08:00:00.000Z"
  }
]
```

---

#### `GET /api/v1/admin/register/applications/:id`

取得單筆申請完整內容，**若有上傳文件，回傳中附帶當次動態產生的 PDF 讀取連結**。

**Response 200**

```json
{
  "id": "550e8400-...",
  "vendorName": "好吃便當",
  "email": "owner@example.com",
  "phone": "0912345678",
  "factoryZones": ["A廠", "B廠"],
  "documentsKey": "vendor-documents/3f1c...pdf",
  "status": "PENDING",
  "reviewNotes": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "createdAt": "2026-05-30T08:00:00.000Z",
  "updatedAt": "2026-05-30T08:00:00.000Z",
  "document": {
    "downloadUrl": "https://s3.ap-northeast-1.amazonaws.com/...?X-Amz-...",
    "expiresIn": 300
  }
}
```

`document` 為 `null` 表示申請時未上傳文件；`downloadUrl` 效期 5 分鐘。

---

#### `GET /api/v1/admin/register/applications/:id/document-url`

單獨產生 PDF 讀取 Pre-signed URL（用於需要重新取得新連結的情境）。

**Response 200**

```json
{
  "downloadUrl": "https://s3.ap-northeast-1.amazonaws.com/...?X-Amz-...",
  "expiresIn": 300
}
```

---

#### `POST /api/v1/admin/register/applications/:id/approve`

**核准入駐**。核准後自動執行：

1. 在 IAM 建立 `role='vendor'` 帳號（以申請 email 為帳號）
2. 在 Vendor & Menu Service 建立商家記錄
3. 更新 `status → APPROVED`
4. 寄出歡迎信（含初始密碼）給商家

**Headers**

| Header | 說明 |
|---|---|
| `x-user-role: admin` | Gateway 注入，必要 |
| `x-user-id` | Gateway 注入，記錄為審核者 |

**Request Body**（選填）

```json
{
  "reviewNotes": "文件齊全，核准通過。"
}
```

**Response 200**

```json
{
  "id": "550e8400-...",
  "vendorName": "好吃便當",
  "email": "owner@example.com",
  "status": "APPROVED",
  "reviewNotes": "文件齊全，核准通過。",
  "reviewedBy": "admin-user-id",
  "reviewedAt": "2026-05-30T09:00:00.000Z",
  "createdAt": "2026-05-30T08:00:00.000Z",
  "updatedAt": "2026-05-30T09:00:00.000Z",
  "tempPassword": "a1b2c3d4e5f6a1b2c3d4e5f6"
}
```

> `tempPassword` 為商家的初始登入密碼，同時已透過歡迎信寄出。若信件發送失敗，可憑此欄位人工告知商家。**此欄位僅在核准當下回傳一次，不會再次查詢到。**

**錯誤回應**

| Status | 情境 |
|---|---|
| `409 Conflict` | 申請不是 `PENDING` 狀態（已審核過） |
| `400 Bad Request` | 呼叫 IAM 或 Vendor & Menu Service 失敗（status 維持 PENDING，可重試） |
| `404 Not Found` | `id` 不存在 |

---

#### `POST /api/v1/admin/register/applications/:id/reject`

**駁回**入駐申請。

**Request Body**（選填）

```json
{
  "reviewNotes": "營業登記文件過期，請重新申請。"
}
```

**Response 200**

```json
{
  "id": "550e8400-...",
  "status": "REJECTED",
  "reviewNotes": "營業登記文件過期，請重新申請。",
  "reviewedBy": "admin-user-id",
  "reviewedAt": "2026-05-30T09:00:00.000Z",
  ...
}
```

---

### 系統端點

#### `GET /health`

DB 健康狀態探活，供 EC2 負載平衡器或 Docker Healthcheck 使用。

**Response 200**

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" } }
}
```

---

## 文件上傳機制（AWS S3 Pre-signed URL）

營登 PDF 存放在**私有 S3 Bucket**，整個上傳/讀取流程完全透過 Pre-signed URL：

```
上傳（前端執行）：
  GET /register/upload-url → 取得 PUT presigned URL（5 分鐘效期）
  PUT <uploadUrl>（Content-Type: application/pdf）

讀取（後端動態產生，福委會審核用）：
  GET /admin/register/applications/:id 或 /:id/document-url
  → 後端對 S3 產生 GET presigned URL（5 分鐘效期）
```

**安全設計**：
- Bucket 設為私有，無公開讀取 URL
- 讀取連結有 5 分鐘效期，每次讀取都重新產生
- 生產環境以 **EC2 Instance Profile** 提供 AWS 權限，程式中無靜態 access key
- 公開上傳端點以 `@Throttle` 限制 5 req/min，防止濫用

---

## 跨服務整合（給其他微服務開發者）

Register Service 在核准入駐時會**主動呼叫**以下兩個服務的 API。請確保這些端點存在且行為符合描述。

### 呼叫 IAM Service

**取得 Admin Token**

```
POST {IAM_SERVICE_URL}/auth/login
Content-Type: application/json

{ "email": "<INTERNAL_ADMIN_EMAIL>", "password": "<INTERNAL_ADMIN_PASSWORD>" }

Response: { "token": "<JWT>", "role": "admin", "userId": 1 }
```

**建立商家帳號**

```
POST {IAM_SERVICE_URL}/users
Content-Type: application/json
Authorization: Bearer <admin JWT>

{ "email": "<申請人 email>", "password": "<24字元 hex 初始密碼>", "role": "vendor" }

Response 201: { "id": 42, "email": "...", "role": "vendor", "created_at": "..." }
Response 409: 帳號已存在 → Register Service 視為冪等成功，繼續流程
```

### 呼叫 Vendor & Menu Service

**建立商家記錄**

```
POST {VENDOR_MENU_SERVICE_URL}/api/v1/admin/vendors
Content-Type: application/json
x-user-role: admin

{ "name": "<vendorName>", "userId": <IAM userId>, "factoryZones": ["A廠", "B廠"] }

Response 201: { "id": "<UUID>", "name": "...", "status": "ACTIVE", ... }
```

> `x-user-role: admin` header 是 Register Service 直接對 Vendor & Menu 發出的內部呼叫（繞過 Kong），vendor-menu 的 `RolesGuard` 只看此 header。

---

## 生產部署（EC2）

### 方式 A：Docker

```bash
docker build -t register-service:latest .

docker run -d --name register-service \
  -p 3008:3008 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://USER:PASS@<RDS>:5432/register_db" \
  -e AWS_REGION=ap-northeast-1 \
  -e AWS_S3_BUCKET_NAME=<your-private-bucket> \
  -e IAM_SERVICE_URL=http://localhost:3001 \
  -e VENDOR_MENU_SERVICE_URL=http://localhost:3007 \
  -e INTERNAL_ADMIN_EMAIL=<admin-email> \
  -e INTERNAL_ADMIN_PASSWORD=<admin-password> \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=<email> \
  -e SMTP_PASS=<app-password> \
  -e EMAIL_FROM=<email> \
  register-service:latest
```

### 方式 B：PM2

```bash
npm install && npm run build
npx prisma migrate deploy   # 套用所有 migration
pm2 start dist/main.js --name register
```

> AWS 權限以 **EC2 Instance Profile** 的 IAM Role 提供，不需在環境變數中設定 access key。

### Kong 路由設定

```yaml
- name: register-service
  url: http://127.0.0.1:3008
  routes:
    # 外部商家公開端點（不驗 JWT）
    - name: register-public-route
      paths:
        - /register
      strip_path: true   # /register/upload-url → /api/v1/register/upload-url

    # 福委會審核端點（驗 JWT）
    - name: register-admin-route
      paths:
        - /admin/register
      strip_path: true   # /admin/register/applications → /api/v1/admin/register/applications
      plugins:
        - name: jwt
          config:
            secret_is_base64: false
            key_claim_name: iss
```

# 企業訂餐系統 — 微服務後端

## 服務一覽

| 服務 | Port | 資料庫 | 說明 |
|------|------|--------|------|
| IAM | 3001 | iam_db | 使用者、員工、登入、JWT 簽發 |
| Notification | 3002 | notification_db | 通知 |
| Recommendation | 3003 | recommendation_db | 推薦偏好與快取 |
| Billing | 3004 | billing_db | 帳單、廠商違規 |
| Appeal-Admin | 3005 | appeal_admin_db | 申訴 |

---

## 快速啟動

### 1. 建立資料庫（每個服務各一個 DB）

在 pgAdmin 或 psql 執行：
```sql
CREATE DATABASE iam_db;
CREATE DATABASE notification_db;
CREATE DATABASE recommendation_db;
CREATE DATABASE billing_db;
CREATE DATABASE appeal_admin_db;
```

然後對每個 DB 執行對應的 `schema.sql`：
```bash
psql -U myuser -d iam_db -f services/iam/schema.sql
psql -U myuser -d notification_db -f services/notification/schema.sql
psql -U myuser -d recommendation_db -f services/recommendation/schema.sql
psql -U myuser -d billing_db -f services/billing/schema.sql
psql -U myuser -d appeal_admin_db -f services/appeal-admin/schema.sql
```

### 2. 設定環境變數

每個服務資料夾都有 `.env.example`，複製並填入：
```bash
# Windows
copy services\iam\.env.example services\iam\.env
# ... 其他服務同理
```

**重要：** 所有服務的 `JWT_SECRET` 必須設定為同一個值！

### 3. 安裝套件並啟動

```bash
cd services/iam && npm install && npm run dev
cd services/notification && npm install && npm run dev
cd services/recommendation && npm install && npm run dev
cd services/billing && npm install && npm run dev
cd services/appeal-admin && npm install && npm run dev
```

---

## JWT 驗證流程

```
前端 → POST /auth/login → IAM Service → 回傳 JWT token
前端 → 之後所有請求帶 Header: Authorization: Bearer <token>
各服務 → 用相同 JWT_SECRET 驗證 token（不需要查 DB）
```

JWT payload 結構：
```json
{ "userId": 1, "email": "user@example.com", "role": "admin" }
```

## Auth Middleware 使用方式

每個服務的 `src/middleware/auth.js` 提供三個函式：

```js
// 只驗登入
router.get("/", authenticate, handler)

// 限定角色
router.post("/", authenticate, authorize("admin"), handler)
router.post("/", authenticate, authorize("admin", "employee"), handler)

// 本人或 admin（比對 req.params.userId）
router.get("/user/:userId", authenticate, requireSelf, handler)
```

---

## Billing ↔ Order 跨服務呼叫

Billing service 在 `createStatement` 時會以 admin 身份打 Order service：

```
POST /billing/statements
  → orderService.getOrdersByVendor(vendor_id, period)
  → GET {ORDER_SERVICE_URL}/orders/vendor/:vendorId?period=2024-01
  → 計算 total_amount → 寫入 billing_statements
```

**設定步驟：**
1. 用 admin 帳號打 `POST /auth/login` 取得 token
2. 把這個 token 放到 billing service 的 `.env` → `INTERNAL_ADMIN_TOKEN=xxx`
3. 設定 `ORDER_SERVICE_URL` 為 order service 的位址

---

## API 端點總覽

### IAM (port 3001)
```
POST   /auth/login
GET    /auth/verify-email?token=xxx

POST   /users               (admin)
GET    /users               (admin)
GET    /users/:userId       (self/admin)
PATCH  /users/:userId/password  (self)
PATCH  /users/:userId/email     (self, 寄驗證信)
DELETE /users/:userId       (admin)

POST   /employees                    (admin)
GET    /employees                    (admin)
GET    /employees/user/:userId       (self/admin)
PATCH  /employees/:id                (admin)
PATCH  /employees/user/:userId/phone (self employee)
DELETE /employees/:id                (admin)
```

### Notification (port 3002)
```
POST   /notifications                 (admin/employee/vendor)
GET    /notifications                 (admin)
GET    /notifications/user/:userId    (self)
PATCH  /notifications/user/:userId/read (self)
DELETE /notifications/:id             (admin)
```

### Recommendation (port 3003)
```
POST   /recommendations/preferences               (admin)
GET    /recommendations/preferences/user/:userId  (self/admin)
PATCH  /recommendations/preferences/:employeeId   (admin)
DELETE /recommendations/preferences/:employeeId   (admin)

POST   /recommendations/cache               (admin)
GET    /recommendations/cache/user/:userId  (self/admin)
PATCH  /recommendations/cache/:employeeId   (admin)
DELETE /recommendations/cache/:employeeId   (admin)
```

### Billing (port 3004)
```
POST   /billing/statements               (admin)
GET    /billing/statements               (admin)
GET    /billing/statements/user/:userId  (self/admin)
DELETE /billing/statements/:id           (admin)

POST   /billing/incidents               (admin)
GET    /billing/incidents               (admin)
GET    /billing/incidents/user/:userId  (self/admin)
PATCH  /billing/incidents/:id           (admin)
DELETE /billing/incidents/:id           (admin)
```

### Appeal-Admin (port 3005)
```
POST   /appeals                 (admin/employee)
GET    /appeals                 (admin)
GET    /appeals/user/:userId    (self/admin)
PATCH  /appeals/:id             (admin)
DELETE /appeals/:id             (admin)
```
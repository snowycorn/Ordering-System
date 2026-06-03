# Cloud Native Final Frontend

這是一個以 **Next.js App Router** 建置的企業餐點訂購前端專案，提供員工、廠商與管理委員會三種角色的操作介面。前端同時包含 BFF API routes，用來統一處理 cookie 驗證、後端服務路徑、mock fallback、資料格式轉換與前端頁面需要的聚合資料。

## 目錄

- [功能總覽](#功能總覽)
- [技術棧](#技術棧)
- [專案架構](#專案架構)
- [資料流與後端串接](#資料流與後端串接)
- [環境需求](#環境需求)
- [快速開始](#快速開始)
- [環境變數](#環境變數)
- [常用指令](#常用指令)
- [Unit Test](#unit-test)
- [Docker](#docker)
- [Kubernetes](#kubernetes)
- [路由與角色](#路由與角色)
- [開發注意事項](#開發注意事項)
- [疑難排解](#疑難排解)

## 功能總覽

### 員工端

- 登入、註冊與個人資料維護。
- 依廠區選擇餐點供應商。
- 查看菜單、依日期下訂、顯示剩餘數量。
- 查看訂單列表與訂單明細。
- 依取消截止時間控制是否可取消訂單。
- 完成取餐後可標記訂單完成。
- 查看通知與未讀通知數。
- 建立與追蹤申訴案件。

### 廠商端

- 廠商首頁儀表板。
- 菜單列表、建立菜單、編輯菜單與圖片上傳 URL 代理。
- 查看今日與歷史訂單。
- 接受、拒絕或處理訂單狀態。
- 廠商個人資料維護。
- 查看通知與帳務資訊。

### 管理委員會端

- 管理儀表板。
- 審核註冊申請。
- 管理廠商資料。
- 管理帳號。
- 查看與處理申訴案件。
- 建立、查看與管理帳務月結單。
- 發送通知或審核結果信件的 API 代理。

## 技術棧

- **Next.js 16**：App Router、Route Handlers、standalone production output。
- **React 19**：Client components 與互動狀態管理。
- **Tailwind CSS 4**：全站樣式。
- **Jest + Testing Library**：unit tests 與 component interaction tests。
- **Docker**：多階段建置 production image。
- **Kubernetes**：ConfigMap、Deployment、Service manifest skeleton。

## 專案架構

```text
.
├── app/
│   ├── (main)/                 # 員工端頁面
│   ├── (vendor)/               # 廠商端頁面
│   ├── (admin)/                # 管理委員會端頁面
│   ├── api/                    # BFF API routes
│   ├── login/                  # 登入頁
│   ├── register/               # 註冊頁
│   ├── globals.css             # 全站樣式
│   └── layout.js               # Root layout
├── components/                 # 共用 UI 與角色頁面元件
├── lib/                        # API helper、mock data、日期與廠區工具
├── public/                     # 靜態資源
├── k8s/                        # Kubernetes manifests
├── __tests__/                  # Unit tests
├── proxy.js                    # Next proxy / route guard
├── Dockerfile                  # Production image build
├── jest.config.mjs             # Jest 設定
├── jest.setup.js               # Testing Library 與 Next navigation mock
└── package.json
```

## 資料流與後端串接

前端頁面不直接呼叫外部微服務，而是透過 `app/api/*` route handlers 作為 BFF：

```text
Browser
  -> Next.js page / client component
  -> app/api/* BFF route
  -> IAM / Vendor / Order / Notification / Recommendation / Billing / Appeal service
```

BFF 主要負責：

- 從 cookie 讀取 `token` 與角色資訊。
- 將 JWT payload 中的使用者資訊轉成後端需要的 `x-user-id` 與 `x-user-role` headers。
- 將前端欄位名稱轉換成後端 API 欄位名稱。
- 在開發或後端不可用時回傳 mock data。
- 將多個後端 API response 聚合成前端頁面需要的資料格式。

核心 helper 位於 `lib/api.js`：

- `serviceUrl(base, path)`：組合 service base URL 與 endpoint path。
- `withPathParams(path, params)`：替換 `:id` 或 `{id}` 形式的 path params。
- `parseJwt(token)`：解析 JWT payload 的 `userId` 與 `role`。
- `apiFetch(url, options)`：統一加上 JSON header、Authorization header 與使用者 context headers。
- `jsonOrEmpty(response)`：安全解析 JSON body。

## 環境需求

- Node.js 22 或相容版本。
- npm。
- 若要部署到 Kubernetes，需要可用的 Docker 與 kubectl。

## 快速開始

1. 安裝依賴：

   ```bash
   npm install
   ```

2. 建立本機環境變數檔：

   ```bash
   cp .env.example .env.local
   ```

   Windows PowerShell 可使用：

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. 啟動開發伺服器：

   ```bash
   npm run dev
   ```

4. 開啟：

   ```text
   http://localhost:3000
   ```

## 環境變數

`lib/api.js` 會依環境變數決定後端服務位址與 endpoint path。

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `USE_LOCAL_MOCKS` | dev 環境預設為 `true` | 是否使用本機 mock data。若設為 `false`，會嘗試串接後端。 |
| `BACKEND_URL` | 空字串 | 通用 API gateway base URL。 |
| `API_GATEWAY_URL` | 空字串 | `BACKEND_URL` 的替代名稱。 |
| `IAM_URL` | `http://140.113.62.166:3001` | IAM service base URL。 |
| `NOTIFICATION_URL` | `http://140.113.62.166:3002` | Notification service base URL。 |
| `RECOMMENDATION_URL` | `http://140.113.62.166:3003` | Recommendation service base URL。 |
| `BILLING_URL` | `http://140.113.62.166:3004` | Billing service base URL。 |
| `APPEAL_URL` | `http://140.113.62.166:3005` | Appeal service base URL。 |
| `VENDOR_URL` | `BACKEND_URL` 或空字串 | Vendor service 或 gateway URL。 |
| `ORDER_URL` | `BACKEND_URL` 或空字串 | Order service 或 gateway URL。 |
| `AUTH_COOKIE_NAME` | `token` | 登入 token cookie 名稱。 |
| `AUTH_ROLE_COOKIE_NAME` | `role` | 使用者角色 cookie 名稱。 |
| `COOKIE_SECURE` | `false` | 設為 `true` 時 auth cookie 只會透過 HTTPS 傳送。 |
| `AUTH_COOKIE_MAX_AGE` | `28800` | auth cookie 有效秒數，預設 8 小時。 |

常見 endpoint path 也可覆寫，例如：

- `IAM_LOGIN_PATH`
- `IAM_USERS_PATH`
- `IAM_EMPLOYEES_PATH`
- `VENDOR_LIST_PATH`
- `VENDOR_BY_ID_PATH`
- `VENDOR_MENUS_PATH`
- `ORDER_COLLECTION_PATH`
- `ORDER_ME_PATH`
- `ORDER_CANCEL_PATH`
- `ORDER_COMPLETE_PATH`
- `NOTIFICATION_COLLECTION_PATH`
- `APPEAL_COLLECTION_PATH`
- `BILLING_STATEMENTS_PATH`
- `BILLING_INCIDENTS_PATH`

### Mock 模式

開發環境中，只要沒有明確設定 `USE_LOCAL_MOCKS=false`，專案會傾向使用 mock data。這讓前端在後端服務尚未啟動時仍可開發與展示。

若要強制串接真實後端：

```env
USE_LOCAL_MOCKS=false
IAM_URL=http://your-kong-host:8000/iam
NOTIFICATION_URL=http://your-kong-host:8000/notification
RECOMMENDATION_URL=http://your-kong-host:8000/recommendation
BILLING_URL=http://your-kong-host:8000/billing
APPEAL_URL=http://your-kong-host:8000/appeal-admin
VENDOR_URL=http://your-kong-host:8000
ORDER_URL=http://your-kong-host:8000
```

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動 Next.js 開發伺服器。 |
| `npm run build` | 建置 production bundle。 |
| `npm run start` | 啟動 production server，需要先執行 `npm run build`。 |
| `npm run lint` | 執行 ESLint。 |
| `npm test` | 執行全部 unit tests。 |
| `npm run test:watch` | 以 watch mode 執行測試。 |
| `npm run test:coverage` | 執行測試並產生 coverage report。 |

## Unit Test

本專案使用 **Jest + Testing Library**。Jest 設定使用 `next/jest`，可支援 Next.js 專案的 module alias、JSX transform 與 App Router 相關檔案。

測試檔案位置：

```text
__tests__/
├── components/
│   ├── DateSelector.test.js
│   ├── MarkAllReadButton.test.js
│   ├── MenuCard.test.js
│   ├── OrderCompleteButton.test.js
│   └── ZoneSelector.test.js
└── lib/
    ├── api.test.js
    ├── dates.test.js
    ├── orderCutoff.test.js
    └── zones.test.js
```

目前測試涵蓋：

- API helper：URL 組合、path params、JWT 解析、cookie options、`apiFetch` header/body 行為、空 JSON response fallback。
- 日期 helper：可訂日期產生、17:00 後隔日 disabled、日期格式驗證。
- 取消截止 helper：前一日 17:00 前後是否可取消與 deadline label。
- 廠區 helper：廠區清單、驗證、label fallback、backend zone 格式。
- Client components：日期選擇、廠區 query 更新、通知全部已讀、餐點下訂、訂單完成按鈕。

執行：

```bash
npm test
```

產生 coverage：

```bash
npm run test:coverage
```

`jest.setup.js` 內提供 `next/navigation` mock，component test 可以透過 `global.__NEXT_NAVIGATION_MOCKS__` 設定 pathname、search params，並檢查 `router.push()` 或 `router.refresh()` 是否被呼叫。

## Docker

建置 image：

```bash
docker build -t employee-frontend:latest .
```

以 `.env.local` 啟動 container：

```bash
docker run --rm -p 3000:3000 --env-file .env.local employee-frontend:latest
```

開啟：

```text
http://localhost:3000
```

Dockerfile 採用多階段建置：

- `deps`：安裝 npm dependencies。
- `builder`：執行 `npm run build`。
- `runner`：使用 Next.js standalone output 啟動 production server。

## Kubernetes

Kubernetes manifest 位於 `k8s/`：

```text
k8s/
├── configmap.yaml
├── deployment.yaml
├── service.yaml
└── README.md
```

套用 manifests：

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

若 image 已推到遠端 registry，請更新 `k8s/deployment.yaml` 中的 image 名稱。

若後端服務改由 Kong 或其他 API gateway 管理，請更新 `k8s/configmap.yaml` 的 service URL 與 endpoint path。

## 路由與角色

公開頁面：

- `/`
- `/login`
- `/register`

員工端：

- `/employee`
- `/employee/vendors/[id]`
- `/orders`
- `/orders/[id]`
- `/notifications`
- `/notifications/[id]`
- `/appeal`
- `/appeal/new`
- `/appeal/[id]`
- `/profile`

廠商端：

- `/vendor`
- `/vendor/profile`
- `/vendor/menus`
- `/vendor/menus/new`
- `/vendor/menus/[id]/edit`
- `/vendor/orders`
- `/vendor/orders/[id]`
- `/vendor/notifications`
- `/vendor/notifications/[id]`
- `/vendor/billing`

管理委員會端：

- `/committee`
- `/committee/registrations`
- `/committee/registrations/[id]`
- `/committee/vendors`
- `/committee/accounts`
- `/committee/appeals`
- `/committee/appeals/[id]`
- `/committee/billing`

`proxy.js` 會根據 cookie 判斷是否需要導回登入頁。未登入使用者進入受保護路由時，會被導向 `/login`，並附上 `next` 與推測角色。

## 開發注意事項

- `app/api/*` 是前端與後端的介面邊界，新增後端串接時優先放在 route handler 中，不要讓 client component 直接呼叫外部微服務。
- 新增需要 auth 的 API call 時，建議使用 `apiFetch()`，確保 token 與 user context headers 一致。
- 新增 path param endpoint 時，建議使用 `withPathParams()`，避免手動字串替換造成未 encode 的特殊字元。
- 日期與訂單截止規則集中在 `lib/dates.js` 與 `lib/orderCutoff.js`，變更規則時應同步更新 unit tests。
- 若新增 client component 且有 router 行為，測試可沿用 `jest.setup.js` 中的 navigation mock。
- 開發環境預設可能使用 mock data；若測試真實後端，請確認 `.env.local` 已設定 `USE_LOCAL_MOCKS=false`。

## 疑難排解

### 開發時資料看起來不像後端回傳

檢查 `.env.local`：

```env
USE_LOCAL_MOCKS=false
```

並確認 service URL 可從本機連線。

### 登入後角色頁面不正確

檢查 cookies：

- `AUTH_COOKIE_NAME` 對應的 token 是否存在。
- `AUTH_ROLE_COOKIE_NAME` 對應的角色是否為 `employee`、`vendor`、`committee` 或 `admin`。

### `npm run start` 無法啟動

請先建置：

```bash
npm run build
npm run start
```

### Docker container 無法連到後端

container 內的 `localhost` 代表 container 本身，不是 host machine。請使用可由 container 存取的 service host、host network 設定或 API gateway URL。

### 測試中需要操作 Next router

使用 `global.__NEXT_NAVIGATION_MOCKS__`：

```js
global.__NEXT_NAVIGATION_MOCKS__.setPathname("/employee");
global.__NEXT_NAVIGATION_MOCKS__.setSearchParams("page=2");
expect(global.__NEXT_NAVIGATION_MOCKS__.router.push).toHaveBeenCalled();
```

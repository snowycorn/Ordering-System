# --- Stage 1: Build Stage (編譯階段) ---
FROM node:20-alpine AS builder

# 1. 設定容器內的工作目錄
WORKDIR /usr/src/app

# 2. 複製 package.json 和 package-lock.json
# 這樣做是為了利用 Docker 的快取機制。如果依賴沒變，Docker 就不會重新下載
COPY package*.json ./

# 3. 安裝所有依賴 (包含開發用的依賴如 TypeScript)
RUN npm install

# 4. 複製 Prisma schema 並產生 Prisma Client
# Prisma Client 是用來跟資料庫溝通的程式碼，需要根據 schema 動態產生
COPY prisma ./prisma/
RUN npx prisma generate

# 5. 複製所有原始碼進容器
COPY . .

# 6. 編譯 NestJS 專案 (將 TypeScript 轉成能運行的 JavaScript，放入 dist 資料夾)
RUN npm run build


# --- Stage 2: Production Stage (生產階段) ---
FROM node:20-alpine AS production

# 7. 設定環境變數為 production，告訴 Node.js 這是正式環境
ENV NODE_ENV=production

# 8. 設定工作目錄
WORKDIR /usr/src/app

# 9. 複製 package.json 和 package-lock.json
COPY package*.json ./

# 10. 僅安裝生產環境所需的依賴 (--omit=dev 排除 devDependencies)
# 這樣可以大幅縮小最終 Image 的體積
RUN npm install --omit=dev && npm cache clean --force

# 11. 從 builder 階段複製編譯好的 Prisma Client
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# 12. 從 builder 階段複製編譯後的 JavaScript 程式碼
COPY --from=builder /usr/src/app/dist ./dist

# 13. 雲原生資安最佳實踐：不要用 root 執行應用程式
# Node image 內建了一個權限較低的 node 使用者
USER node

# 14. 宣告這個容器預計會監聽的 Port
EXPOSE 3008

# 15. 啟動應用的指令
CMD ["node", "dist/main"]

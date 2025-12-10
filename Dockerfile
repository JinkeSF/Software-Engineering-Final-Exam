FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

# 複製所有程式碼 (包含 init_db.js 和 CSV)
COPY . .

EXPOSE 3000

# 啟動時：先執行 ETL 建立資料庫，再啟動網頁伺服器
CMD ["sh", "-c", "node init_db.js && node server.js"]
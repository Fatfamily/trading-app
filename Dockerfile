FROM node:20-alpine
RUN apk add --no-cache tzdata && ln -sf /usr/share/zoneinfo/Asia/Seoul /etc/localtime
WORKDIR /app
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev
WORKDIR /app
COPY server ./server
COPY client ./client
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "index.js"]

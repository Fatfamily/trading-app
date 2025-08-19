# Multi-stage is overkill; keep simple for Render
FROM node:20-alpine

# Timezone data
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul

WORKDIR /app
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev

WORKDIR /app
COPY server ./server
COPY client ./client

WORKDIR /app/server
EXPOSE 10000
CMD ["node","index.js"]

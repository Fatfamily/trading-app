# Node 20 (has native fetch)
FROM node:20-alpine

ENV NODE_ENV=production
ENV TZ=Asia/Seoul

RUN apk add --no-cache tzdata

WORKDIR /app

# Install server deps
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev

# Copy source
WORKDIR /app
COPY server ./server

# Expose & run
WORKDIR /app/server
EXPOSE 10000
CMD ["node", "index.js"]

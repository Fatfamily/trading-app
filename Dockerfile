
# Node 18-alpine
FROM node:18-alpine

# timezone for KR logs
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul

WORKDIR /app

# Install server deps first (better caching)
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev

# Copy source
WORKDIR /app
COPY server ./server
COPY client ./client

# Expose and run
WORKDIR /app/server
EXPOSE 10000
CMD ["node", "index.js"]

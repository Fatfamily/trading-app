# Use Node 20 to avoid undici File issue
FROM node:20-alpine

# Install tzdata for Asia/Seoul
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul

WORKDIR /app

# Copy only server package first for caching
COPY server/package.json ./server/package.json
WORKDIR /app/server

# Install production deps
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev

# Copy source
WORKDIR /app
COPY server ./server
COPY client ./client

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 10000

# Render reads PORT env; default 10000
ENV PORT=10000

# Start server
CMD ["node","index.js"]

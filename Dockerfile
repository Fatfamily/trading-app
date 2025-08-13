# Multi-stage is overkill here; keep simple for Render
FROM node:18-alpine

# Install tzdata for correct timestamps (optional)
RUN apk add --no-cache tzdata

WORKDIR /app

# Install server deps first for better caching
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev

# Copy source
WORKDIR /app
COPY server ./server
COPY client ./client

# Expose port (Render uses $PORT)
ENV NODE_ENV=production
WORKDIR /app/server
CMD ["node", "index.js"]

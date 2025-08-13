# Render-ready single container serving both API and static client
FROM node:18-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install server deps
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev

# Copy source
WORKDIR /app
COPY server ./server
COPY client ./client

ENV PORT=10000
EXPOSE 10000

WORKDIR /app/server
CMD ["node", "index.js"]

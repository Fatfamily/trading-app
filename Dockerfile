
# Node 20 for Undici/File API compatibility
FROM node:20-alpine

RUN apk add --no-cache tzdata
WORKDIR /app

# install server deps first (layer cache)
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi || npm install --omit=dev

# copy source
WORKDIR /app
COPY server ./server
COPY client ./client

WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD [ "node", "index.js" ]

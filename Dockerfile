FROM node:20-alpine
RUN apk add --no-cache tzdata && ln -sf /usr/share/zoneinfo/Asia/Seoul /etc/localtime
WORKDIR /app/server
COPY server/package.json ./package.json
RUN npm install --omit=dev
COPY server ./
WORKDIR /app
COPY client ./client
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "index.js"]

# Build client
FROM node:20-alpine AS build
WORKDIR /app

COPY client ./client
COPY server ./server

WORKDIR /app/client

# 👇 vite와 @vitejs/plugin-react 설치 (devDependencies)
RUN npm install -D @vitejs/plugin-react vite

# 클라이언트 빌드
RUN npm install && npm run build

# 빌드 결과를 서버 public으로 이동
RUN rm -rf /app/server/public && cp -r dist /app/server/public

# Runtime server
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/server ./server
WORKDIR /app/server
RUN npm install --omit=dev

ENV PORT=10000
EXPOSE 10000
CMD ["npm", "start"]

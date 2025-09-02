# Build client
FROM node:20-alpine AS build
WORKDIR /app

# 클라이언트 / 서버 복사
COPY client ./client
COPY server ./server

WORKDIR /app/client

# 👇 vite와 @vitejs/plugin-react 강제로 설치
RUN npm install @vitejs/plugin-react vite --save-dev

# 클라이언트 빌드
RUN npm install && npm run build

# 빌드된 결과를 서버 public 폴더로 이동
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


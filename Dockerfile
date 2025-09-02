# Build client
FROM node:20-alpine AS build
WORKDIR /app

COPY client ./client
COPY server ./server

WORKDIR /app/client

# 👇 package.json, package-lock.json 먼저 복사
COPY client/package*.json ./

# 패키지 설치
RUN npm install

# vite & plugin-react 추가 설치
RUN npm install -D vite @vitejs/plugin-react

# 클라이언트 빌드
COPY client ./
RUN npm run build

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

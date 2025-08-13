# 1. 베이스 이미지 선택 (Node LTS)
FROM node:18-alpine

# 2. 앱 디렉터리 설정
WORKDIR /app

# 3. package.json + lock 파일 복사
COPY package.json package-lock.json* ./

# 4. 의존성 설치 (production 모드)
RUN npm ci --omit=dev

# 5. 소스 코드 복사
COPY . .

# 6. 앱 빌드나 준비 과정이 있다면 여기에 추가
# RUN npm run build

# 7. 실행 환경 설정
ENV NODE_ENV=production
EXPOSE 3000

# 8. 앱 실행 명령
CMD ["node", "index.js"]

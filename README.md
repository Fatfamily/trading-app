
# KR Trading App (Server + Static Client)

이 저장소는 **Express 기반 서버**와 **정적 클라이언트(HTML/CSS/JS)** 를 포함합니다.  
Docker로 빌드하여 Render에서 쉽게 배포할 수 있습니다.

## 서버
- Node.js 20 이상
- PostgreSQL 사용 (`DATABASE_URL` 필요)
- 환경변수:
  - `PORT` (기본: 10000)
  - `DATABASE_URL` (Render PostgreSQL 연결 문자열)
  - `JWT_SECRET` (임의의 긴 문자열)

## 클라이언트
- 빌드 과정이 필요 없는 **정적 SPA** 입니다.
- 서버가 `/client` 폴더를 정적으로 제공하도록 되어 있습니다.

## 로컬 실행
```bash
# 서버 디펜던시 설치
cd server
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에서 DATABASE_URL, JWT_SECRET 설정

# 서버 실행
node index.js
```

브라우저에서 `http://localhost:10000` 접속 → UI 확인

## Render 배포 (Docker)
1. Render에서 **Web Service** 생성
2. **Repository** 또는 **Public Git**를 선택해 이 프로젝트를 연결 (또는 zip으로 업로드 후 연결)
3. **Docker** 선택
4. 환경변수 추가
   - `DATABASE_URL`: Render에서 생성한 PostgreSQL의 Internal URL
   - `JWT_SECRET`: 임의의 긴 문자열
   - `PORT`: `10000` (선택)
5. 생성 후 배포

### 포트
- 컨테이너 내부 포트는 `10000` 입니다. Render는 자동으로 이 포트를 감지합니다.

## 문제 해결
- `COPY client ./client` 에러가 난다면: 저장소 루트에 `client/` 폴더가 없기 때문입니다.
  - 본 저장소에는 `client/`를 포함해 두었습니다.
- DB 마이그레이션이 필요한 경우 `server/schema.sql` 참고 후 수동으로 적용하세요.

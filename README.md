# 주식 가상거래소 (Render 완전 동작 버전)

## 배포 순서 (Render)
1) 이 레포를 GitHub에 올립니다.
2) Render에서 New + --> Web Service --> **Environment: Docker** 로 선택합니다.
3) (선택) render.yaml을 사용하면 자동설정됩니다. 아니면 수동으로도 OK.
4) Render Managed PostgreSQL을 하나 생성하고, 연결 정보(Internal Connection String)를 가져옵니다.
5) 서비스의 **Environment** 변수에 아래를 추가합니다.
   - `DATABASE_URL`: (Postgres 연결 문자열)
   - `JWT_SECRET`: (임의의 긴 문자열)
   - `PORT`: 10000
   - `TOP_SYMBOLS`: "005930.KS,000660.KS,035420.KS,AAPL,TSLA,MSFT,GOOGL,AMZN"
6) 배포하면 `/api/*`는 백엔드, 정적 파일은 `/`에서 서비스됩니다.

## 초기 자산
- 사용자 생성 시 잔고는 1억원(1,000,000,000원; 1원 단위 정수)으로 설정됩니다.

## 기능
- 로그인/회원가입/로그아웃/초기화(JWT + 쿠키)
- 시세조회(야후파이낸스; 실패시 모의가격 fallback)
- 상위 10종목(환경변수로 설정)
- 관심종목 컨텍스트 메뉴(매수/매도/풀매수/풀매도)
- 보유/체결로그
- 뉴스(RSS 기반)
- F1~F8 단축키, 다크 UI (키움/영웅문 느낌)

## 개발 메모
- 서버는 CommonJS, Node 18-alpine.
- ssl 옵션: Render/Cloud의 호스트일 경우 `rejectUnauthorized: false` 설정.
- Yahoo가 차단되거나 실패할 수 있어 모의가격으로 자동 대체됩니다.

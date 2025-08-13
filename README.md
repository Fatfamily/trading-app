# KR Virtual Exchange (Naver Finance)

국내 주식 전용 가상 거래소 (Render 배포용). 서버는 **네이버 금융**을 스크래핑하여 초단위 시세/상위종목/뉴스를 제공합니다.  
클라이언트는 단일 페이지(HTML/CSS/JS)로 관심종목/보유/매수/매도/풀매수/풀매도/우클릭 컨텍스트 메뉴를 제공합니다.

## 배포 (Render)

1. 이 레포를 GitHub에 업로드
2. Render 대시보드 → **New +** → **Web Service** → GitHub 레포 선택
3. **Environment**: Docker  
4. 기타 기본값 그대로 Deploy
5. 배포 후 기본 URL 접속

> DB 필요 없음 (브라우저 LocalStorage).

## 로컬 실행
```bash
docker build -t kr-virtual-exchange .
docker run -p 10000:10000 kr-virtual-exchange
# http://localhost:10000
```

## API
- `GET /api/search?q=삼성전자` → [{ name, code, market }]
- `GET /api/top?market=KOSPI|KOSDAQ` → top 10
- `GET /api/quote?code=005930` → { price, change, changePct, time }
- `GET /api/news?code=005930` → 뉴스 목록

## 주의
- 비공식 스크래핑 방식이라 요청이 너무 잦으면 제한될 수 있습니다.
- 초단위 갱신은 서버 캐시(약 0.8초)로 조절됩니다.

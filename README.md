# Trading App (KR) — Live

- 상위 10개 종목, 검색, 관심종목, 보유/주문, 뉴스
- Candlestick 1분봉, 초당 카드 업데이트(SSE)

## 환경변수
- `MARKET_DATA_PROVIDER`: `FINNHUB`(기본) | `ALPHAVANTAGE`
- `FINNHUB_API_KEY`: Finnhub 키
- `ALPHA_VANTAGE_KEY`: Alpha Vantage 키
- `NEWSAPI_KEY`: (선택) 뉴스 키

## Render
- Environment: Docker
- Root Directory: (비워둠)
- Dockerfile Path: `Dockerfile`
- 환경변수 설정 후 배포

## 로컬
```bash
docker build -t trading-app .
docker run -p 8080:8080 -e MARKET_DATA_PROVIDER=FINNHUB -e FINNHUB_API_KEY=YOUR_KEY trading-app
```

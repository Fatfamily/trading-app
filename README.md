# K-Stock Sim (Java + HTML)

한국 주식(비공식 네이버 엔드포인트) 1초 폴링 + 로컬 모의체결 엔진이 들어있는 샘플입니다.  
로그인/회원가입(H2 DB), 단축키(B/S/N, / 검색), 뉴스 패널, 포트폴리오, 간단 차트까지 포함.

## 실행
```bash
mvn -v   # Java 17 필요
mvn spring-boot:run
# 브라우저에서 http://localhost:8080/login.html
```
## 주의
- 시세: `api.finance.naver.com/service/itemSummary.nhn?itemcode={code}` 우선 사용, 실패 시 `m.stock.naver.com/api/stock/{code}/price`(최근 종가)로 폴백합니다.
- 네이버 비공식 API는 변경/차단될 수 있습니다. 모의투자 및 교육 목적 외 사용을 지양하세요.
- 레이트리밋/일시 실패 시 2초 이내 구간은 로컬 랜덤워크로 미세 변동을 생성합니다.

## 구조
- `PriceService` : 시세 캐시 + 랜덤워크
- `SimEngine` : 시장가 체결, 지갑/포지션/H2 저장
- `NewsService` : m.stock JSON → 실패 시 finance.naver.com HTML 크롤링
- `static/app.html` : Kiwoom 느낌의 3열 PC UI, 단축키/핫키

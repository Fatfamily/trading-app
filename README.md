# Java + HTML MTS-Style Trading App (Simulation)

이 프로젝트는 **Spring Boot(백엔드) + WebSocket(STOMP) + 단일 HTML 프런트엔드**로 구성된
`MTS 스타일` 트레이딩 화면입니다. 실시간 가격은 **서버에서 1초마다 랜덤 시세**를 생성하여
브로드캐스트합니다. (브로커 실계좌 API는 연결되지 않은 데모 버전)

## 실행 방법
### 1) 사전 준비
- Java 17 이상, Maven 설치

### 2) 실행
```bash
cd backend
mvn spring-boot:run
```
브라우저에서 `http://localhost:8080/` 접속

### 3) 빌드 후 JAR 실행
```bash
cd backend
mvn -q -DskipTests package
java -jar target/trading-app-0.0.1-SNAPSHOT.jar
```

## 기능
- 워치리스트(삼성전자/하이닉스/NAVER/카카오/현대차) 실시간 가격
- 종목 선택 시 라인 차트 (초단위)
- 간단 주문(매수/매도) → 포트폴리오 반영 (현금/평가/총자산, 보유종목, 로그)
- 검색/필터, 실시간 연결 상태 표시

## 구조
- 백엔드: Spring Boot (Web + WebSocket), `/api/order`, `/api/portfolio`, `/api/symbols`
- 프런트: `src/main/resources/static/index.html` (CDN: SockJS, STOMP, Lightweight Charts)

## 주의/확장
- 현재는 **시뮬레이션**입니다. 실제 브로커 API(KIS/키움 등)로 교체하려면:
  - 백엔드에서 실시간/주문/잔고/체결 API를 호출하고
  - 프런트로는 동일한 `/topic/quotes` 채널에 실제 틱을 브로드캐스트 하세요.
- UI 테마/레이아웃은 MTS 스타일로 구성했으며, 호가창/미체결/조건검색 등은 확장 가능합니다.

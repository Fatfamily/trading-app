# Korea Stock Paper Trading (Spring Boot)

최신 Spring Boot 3 기반의 국내 주식 모의투자 시뮬레이터입니다. 프론트는 정적 HTML/JS, 서버는 REST + JPA 구조입니다.

## 빠른 시작 (로컬)

```bash
# JDK 17 필요
mvn spring-boot:run
# http://localhost:8080/login.html
```

기본 초기자산은 **1억**입니다.

## 데이터베이스

- 로컬: H2 파일 DB (`./data/kstocksim`)
- 프로덕션(Render): PostgreSQL

### 프로필
- `default` (로컬): H2
- `prod` (Render): Postgres

## Render 배포 (Blueprint)

1. 이 저장소를 GitHub에 푸시
2. Render 대시보드 → **Blueprints** → `render.yaml` 선택
3. 데이터베이스와 웹 서비스가 자동 생성됩니다.

### 환경 변수 (자동 연결됨)
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` (Render DB에서 주입)
- `SPRING_PROFILES_ACTIVE=prod`

## 수동 배포 (서비스 1개만 생성)

- 서비스 타입: **Web Service**
- **Docker** 사용
- 포트: `8080` (Render의 `$PORT`에 자동 바인딩)
- Health check: `/actuator/health` (선택)

## 단축키 & UX
- `/` 종목 입력 포커스
- `B`/`S` 매수/매도
- `F1` 주문창 포커스
- `F6` 관심종목 등록
- `Delete` 관심종목 삭제
- `F8` 뉴스 토글
- 우클릭: 주문/관심 컨텍스트 메뉴

## 주의
- 네이버 비공식 API 포맷은 변경될 수 있습니다.
- 세션 로그인 방식입니다. 멀티 인스턴스 구성 시 외부 세션 스토리지(예: Redis) 사용을 권장합니다.

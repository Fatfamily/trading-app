# K-Stock Simulator — Fixed Minimal Version

This is a simplified, cleaned-up Spring Boot + static frontend simulator adapted from the project you uploaded.
It provides:
- Session-based register/login (simple, H2 by default)
- Price endpoints that return deterministic pseudo-random prices per code (for offline testing)
- Simple order engine: market orders update wallet and positions (H2)
- News endpoint (attempts to scrape Naver, falls back to mocked items)
- Static single-file frontend (app.html / app.js / styles.css) that polls prices and allows placing orders

How to run locally:
1. Java 17 + Maven installed.
2. From project root:
   - `mvn -DskipTests package`
   - `java -jar target/koreastock-sim-fixed-1.0.0.jar`
   - Open http://localhost:8080/login.html

Docker:
- A Dockerfile is included. Build with `docker build -t koreastock-sim-fixed .` then run port 8080.

Notes:
- This is a minimal working baseline — you can extend the price source to call Naver (the original used an unofficial API).
- The frontend is intentionally simple but styled to be compact/dark.

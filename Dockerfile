# ---- Build stage ----
FROM maven:3.9.8-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- Run stage ----
FROM eclipse-temurin:17-jre
WORKDIR /app
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
COPY --from=builder /app/target/koreastock-sim-*.jar app.jar
EXPOSE 8080
# Activate prod profile and bind to $PORT (Render provides PORT env)
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -Dspring.profiles.active=prod -Dserver.port=${PORT:-8080} -jar app.jar"]

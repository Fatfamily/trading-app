# Build multi-stage
FROM maven:3.9.8-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /app/target/koreastock-sim-fixed-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["sh","-c","java -Dspring.profiles.active=prod -Dserver.port=${PORT:-8080} -jar app.jar"]

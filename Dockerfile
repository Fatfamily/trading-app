# Build stage
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /build
COPY backend/pom.xml ./
COPY backend/src ./src
RUN mvn -q -DskipTests package

# Run stage
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/trading-app.jar app.jar
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["sh","-c","java -jar app.jar --server.port=${PORT}"]

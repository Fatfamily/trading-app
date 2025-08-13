# ---- build stage ----
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY backend/pom.xml backend/pom.xml
COPY backend/src backend/src
RUN mvn -f backend/pom.xml -DskipTests clean package

# ---- run stage ----
FROM eclipse-temurin:17-jdk
WORKDIR /app
# copy fat jar
COPY --from=build /app/backend/target/*.jar app.jar
# Render exposes PORT env; bind server.port to it
EXPOSE 8080
CMD ["java","-Dserver.port=${PORT}","-jar","app.jar"]

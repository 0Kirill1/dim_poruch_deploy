FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace

COPY pom.xml mvnw ./
COPY .mvn .mvn
COPY security/pom.xml security/pom.xml
COPY user/pom.xml user/pom.xml
COPY listings/pom.xml listings/pom.xml
COPY bookings/pom.xml bookings/pom.xml
COPY reviews/pom.xml reviews/pom.xml
COPY notifications/pom.xml notifications/pom.xml
COPY admin/pom.xml admin/pom.xml
COPY app/pom.xml app/pom.xml

COPY . .

RUN ./mvnw -pl app -am package -DskipTests

FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

RUN groupadd --system spring && useradd --system --gid spring spring \
    && mkdir -p /var/app/uploads/listings \
    && chown -R spring:spring /var/app

COPY --from=build /workspace/app/target/app-0.0.1-SNAPSHOT.jar app.jar
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

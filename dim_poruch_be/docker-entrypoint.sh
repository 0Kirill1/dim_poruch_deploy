#!/bin/sh
set -eu

mkdir -p /var/app/uploads/listings
chown -R spring:spring /var/app/uploads

exec su -s /bin/sh spring -c 'exec /opt/java/openjdk/bin/java -jar /app/app.jar'

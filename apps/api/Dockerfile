FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma + PostgreSQL client for direct SQL migration
RUN apk add --no-cache openssl postgresql-client

# OpenSSL legacy config: enables TLS 1.0 and old cipher suites
# for Control iD biometric reader compatibility (old firmware)
COPY apps/api/openssl_legacy.cnf /app/openssl_legacy.cnf
ENV OPENSSL_CONF=/app/openssl_legacy.cnf

# Copy API package and install all deps
COPY apps/api/package.json ./
RUN npm install

# Copy prisma and generate client
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy config and source - CACHEBUST forces rebuild from here
ARG CACHEBUST=69
RUN echo "CACHEBUST=${CACHEBUST}"
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/nest-cli.json ./nest-cli.json
COPY apps/api/src/ ./src/

# Build NestJS - allow failure since entrypoint rebuilds from volume-mounted source
RUN npx nest build 2>&1 && echo "BUILD SUCCESS v${CACHEBUST}" || echo "BUILD WARNING: nest build had issues, will rebuild at startup"

# Copy update scripts
COPY scripts/update-employee-data.js ./scripts/update-employee-data.js
COPY scripts/fix-unmatched-employees.js ./scripts/fix-unmatched-employees.js
COPY scripts/migrate-employee-punches.js ./scripts/migrate-employee-punches.js
COPY scripts/migrate-employee-punches.sql ./scripts/migrate-employee-punches.sql
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 4010

CMD ["./entrypoint.sh"]

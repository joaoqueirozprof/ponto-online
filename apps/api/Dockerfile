FROM node:20-alpine

ARG CACHEBUST=53

WORKDIR /app

# Install OpenSSL for Prisma + PostgreSQL client for direct SQL migration
RUN apk add --no-cache openssl postgresql-client

# Copy API package and install all deps
COPY apps/api/package.json ./
RUN npm install

# Copy prisma and generate client
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Force rebuild - build 41
RUN echo "build-53-dual-id-fix"

# Copy config and source
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/nest-cli.json ./nest-cli.json
COPY apps/api/src/ ./src/

# Build NestJS
RUN npx nest build

# Copy update scripts
COPY scripts/update-employee-data.js ./scripts/update-employee-data.js
COPY scripts/fix-unmatched-employees.js ./scripts/fix-unmatched-employees.js
COPY scripts/migrate-employee-punches.js ./scripts/migrate-employee-punches.js
COPY scripts/migrate-employee-punches.sql ./scripts/migrate-employee-punches.sql
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 4010

# CACHEBUST 53
CMD ["./entrypoint.sh"]

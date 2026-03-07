FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma (Alpine 3.20+ uses OpenSSL 3.x)
RUN apk add --no-cache openssl

# Copy API package and install all deps
COPY apps/api/package.json ./
RUN npm install

# Copy prisma and generate client
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy config and source
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/nest-cli.json ./nest-cli.json
COPY apps/api/src/ ./src/

# Build NestJS
RUN npx nest build

# Copy update scripts
COPY scripts/update-employee-data.js ./scripts/update-employee-data.js
COPY scripts/fix-unmatched-employees.js ./scripts/fix-unmatched-employees.js
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 4010

# CACHEBUST 28
CMD ["./entrypoint.sh"]

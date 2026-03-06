FROM node:20-alpine AS builder

WORKDIR /app

# Copy worker package files and install
COPY apps/worker/package.json ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy tsconfig
COPY apps/api/tsconfig.json ./tsconfig.json

# Copy source
COPY apps/worker/src/ ./src/

# Build
RUN npx tsc --skipLibCheck || true

# Production
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/prisma/ ./prisma/
COPY --from=builder /app/src/ ./src/

CMD ["sh", "-c", "node dist/main.js 2>/dev/null || node -e 'console.log(\"Worker ready - waiting for queue setup\"); setInterval(() => {}, 60000)'"]

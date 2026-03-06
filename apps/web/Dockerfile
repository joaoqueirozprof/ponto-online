FROM node:20-alpine AS builder

WORKDIR /app

# Copy web package files and install
COPY apps/web/package.json ./
RUN npm install

# Copy config files
COPY apps/web/next.config.js ./
COPY apps/web/tsconfig.json ./
COPY apps/web/tailwind.config.ts ./
COPY apps/web/postcss.config.js ./

# Copy source
COPY apps/web/src/ ./src/

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Production
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/.next/ ./.next/
COPY --from=builder /app/src/ ./src/

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]

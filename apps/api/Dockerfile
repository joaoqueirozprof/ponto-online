FROM node:20-alpine AS builder

WORKDIR /app

# Copy API package files and install dependencies
COPY apps/api/package.json ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy tsconfig and NestJS config
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/nest-cli.json ./nest-cli.json

# Copy source code
COPY apps/api/src/ ./src/

# Build with NestJS CLI
RUN npx nest build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/prisma/ ./prisma/

EXPOSE 4010

CMD ["node", "dist/main.js"]

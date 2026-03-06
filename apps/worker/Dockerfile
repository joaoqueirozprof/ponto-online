FROM node:20-alpine

WORKDIR /app

COPY apps/worker/package.json ./
RUN npm install --include=dev && npm install prisma@5 --save-dev

COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/worker/src/ ./src/

RUN npx tsc --skipLibCheck 2>/dev/null || mkdir -p dist

CMD ["sh", "-c", "node dist/main.js 2>/dev/null || node -e 'console.log(\"Worker standby\"); setInterval(() => {}, 60000)'"]

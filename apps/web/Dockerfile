FROM node:20-alpine

WORKDIR /app

COPY apps/web/package.json ./
RUN npm install

COPY apps/web/next.config.js ./
COPY apps/web/tsconfig.json ./
COPY apps/web/tailwind.config.ts ./
COPY apps/web/postcss.config.js ./
COPY apps/web/src/ ./src/

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build || true

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]

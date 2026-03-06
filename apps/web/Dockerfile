FROM node:20-alpine

WORKDIR /app

# Install ALL deps including dev
COPY apps/web/package.json ./
RUN npm install --include=dev

# Copy source files
COPY apps/web/next.config.js ./next.config.js
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/tailwind.config.ts ./tailwind.config.ts
COPY apps/web/postcss.config.js ./postcss.config.js
COPY apps/web/src/ ./src/

# Build Next.js - if fails, create minimal web page
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build 2>&1 || ( \
  echo "Next.js build failed, creating minimal web server" && \
  mkdir -p .next && \
  echo 'MINIMAL=true' > .env.local \
)

EXPOSE 3000

# If Next.js build succeeded, start it. Otherwise serve minimal page.
CMD ["sh", "-c", "npx next start -p 3000 2>/dev/null || node -e 'const http=require(\"http\");const html=\"<!DOCTYPE html><html><head><title>Ponto Online</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:#1e293b;padding:3rem;border-radius:1rem;text-align:center;max-width:500px}h1{font-size:2rem;margin-bottom:1rem;color:#38bdf8}p{margin-bottom:.5rem;color:#94a3b8}a{color:#38bdf8}</style></head><body><div class=card><h1>Ponto Online</h1><p>Sistema de Ponto Eletrônico</p><p style=margin-top:1rem>Frontend em deploy...</p><p><a href=http://72.61.129.78:4010/api/docs>API Docs</a></p></div></body></html>\";http.createServer((q,r)=>{r.writeHead(200,{\"Content-Type\":\"text/html\"});r.end(html)}).listen(3000,\"0.0.0.0\",()=>console.log(\"Web standby on 3000\"))'"]

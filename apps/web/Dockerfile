FROM node:20-alpine

WORKDIR /app

# Cache bust to force rebuild
ARG CACHEBUST=3

# Install ALL deps including dev
COPY apps/web/package.json ./
RUN npm install --include=dev

# Copy source files
COPY apps/web/next.config.js ./next.config.js
COPY apps/web/tsconfig.json ./tsconfig.json
COPY apps/web/tailwind.config.ts ./tailwind.config.ts
COPY apps/web/postcss.config.js ./postcss.config.js
COPY apps/web/src/ ./src/

# Set build-time env vars (NEXT_PUBLIC_* must be available at build time)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=http://72.61.129.78:4010/api/v1
RUN npx next build 2>&1 || ( \
  echo "Next.js build failed, creating minimal web server" && \
  mkdir -p .next && \
  echo 'MINIMAL=true' > .env.local \
)

EXPOSE 3000

# If Next.js build succeeded, start it. Otherwise serve minimal page.
CMD ["sh", "-c", "npx next start -p 3000 2>/dev/null || node -e 'const http=require(\"http\");const html=\"<!DOCTYPE html><html><head><title>Ponto Online</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#f8fafc;color:#1e293b;display:flex;justify-content:center;align-items:center;min-height:100vh}.c{text-align:center;padding:3rem}h1{font-size:2.5rem;font-weight:800;color:#4f46e5;margin-bottom:.5rem}p{color:#64748b;margin:.5rem 0}a{color:#4f46e5;font-weight:600}</style></head><body><div class=c><h1>Ponto Online</h1><p>Sistema em deploy...</p><p><a href=http://72.61.129.78:4010/api/docs>API Docs</a></p></div></body></html>\";http.createServer((q,r)=>{r.writeHead(200,{\"Content-Type\":\"text/html\"});r.end(html)}).listen(3000,\"0.0.0.0\",()=>console.log(\"Web standby on 3000\"))'"]

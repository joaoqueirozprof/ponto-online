FROM node:20-alpine

WORKDIR /app

# Cache bust to force rebuild
ARG CACHEBUST=10

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

# Build Next.js - log errors for debugging
RUN npx next build > /tmp/web-build.log 2>&1 && echo "BUILD_OK" || ( \
  echo "=== WEB BUILD FAILED ===" && \
  cat /tmp/web-build.log && \
  cp /tmp/web-build.log /app/build-error.log && \
  echo "BUILD_FAILED" \
)

EXPOSE 3000

# Start Next.js - if build failed, show error page with build log
CMD ["sh", "-c", "if [ -f /app/build-error.log ]; then echo 'Build failed, serving error page'; node -e 'const http=require(\"http\");const fs=require(\"fs\");let err=\"unknown\";try{err=fs.readFileSync(\"/app/build-error.log\",\"utf8\")}catch(e){}const html=\"<!DOCTYPE html><html><head><title>Ponto Online - Build Error</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#f8fafc;color:#1e293b;padding:2rem}h1{color:#dc2626;margin-bottom:1rem}pre{background:#1e293b;color:#e2e8f0;padding:1rem;border-radius:8px;overflow-x:auto;font-size:12px;max-height:80vh;overflow-y:auto}</style></head><body><h1>Build Error</h1><pre>\"+err.replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\")+\"</pre></body></html>\";http.createServer((q,r)=>{r.writeHead(200,{\"Content-Type\":\"text/html\"});r.end(html)}).listen(3000,\"0.0.0.0\",()=>console.log(\"Error page on 3000\"))'; else npx next start -p 3000; fi"]

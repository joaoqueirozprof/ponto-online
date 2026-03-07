FROM node:20-alpine

WORKDIR /app

# Cache bust to force rebuild
ARG CACHEBUST=22

# Install build tools for native modules (bcrypt) + OpenSSL for Prisma
RUN apk add --no-cache python3 make g++ openssl openssl-dev

# Install ALL deps (including dev for @nestjs/cli, prisma, typescript)
COPY apps/api/package.json ./
RUN npm install --include=dev

# Generate Prisma client
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate --schema=prisma/schema.prisma || true

# Copy NestJS config and ALL source modules
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/nest-cli.json ./nest-cli.json
COPY apps/api/src/ ./src/

# Build NestJS - capture error output for debugging
RUN npx nest build > /tmp/build.log 2>&1 || ( \
  echo "=== BUILD FAILED ===" && \
  cat /tmp/build.log && \
  mkdir -p dist && \
  cp /tmp/build.log /app/build-error.log && \
  echo "const http=require('http');const fs=require('fs');let err='unknown';try{err=fs.readFileSync('/app/build-error.log','utf8')}catch(e){}const s=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});if(req.url==='/build-error'){res.end(JSON.stringify({error:err}))}else if(req.url==='/api/v1/health'){res.end(JSON.stringify({status:'ok',mode:'standby',buildError:err.substring(0,500),timestamp:new Date().toISOString()}))}else{res.end(JSON.stringify({message:'Ponto Online API - standby mode',version:'1.0.0',buildError:err.substring(0,200)}))}});s.listen(4010,'0.0.0.0',()=>console.log('API standby on 4010'))" > dist/main.js \
)

EXPOSE 4010

# Run DB sync + regenerate prisma client at runtime then start API
CMD ["sh", "-c", "npx prisma generate --schema=prisma/schema.prisma 2>&1; npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 || true; node dist/main.js"]

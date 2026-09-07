FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY python/ ./python/

EXPOSE 4100

ENV ENGINE_PORT=4100
ENV ENGINE_RUN_ON_START=1

CMD ["npx", "tsx", "src/index.ts"]

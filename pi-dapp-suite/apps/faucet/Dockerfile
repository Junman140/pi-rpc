FROM node:20-alpine

WORKDIR /app

COPY apps/faucet/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund --fetch-retries=5 --fetch-retry-maxtimeout=120000

COPY apps/faucet/src ./src

EXPOSE 4000
CMD ["node", "src/index.js"]


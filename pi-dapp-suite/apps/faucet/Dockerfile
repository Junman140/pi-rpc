FROM rust:1-bookworm AS contracts

WORKDIR /build

RUN apt-get update && apt-get install -y pkg-config libdbus-1-dev \
  && rustup target add wasm32-unknown-unknown \
  && cargo install --locked soroban-cli --version 23.0.0

COPY contracts ./contracts
RUN cd contracts && cargo build --target wasm32-unknown-unknown --release

FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY apps/faucet/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund --fetch-retries=5 --fetch-retry-maxtimeout=120000

COPY apps/faucet/src ./src
COPY contracts ./contracts
COPY --from=contracts /build/contracts ./contracts
COPY --from=contracts /usr/local/cargo/bin/soroban /usr/local/bin/soroban

EXPOSE 4000
CMD ["node", "src/index.js"]


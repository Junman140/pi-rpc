# Pi Dapp Suite (Soroban v21–23) — RPC Test + DEX Playground

Standalone repo folder that connects to **Pi RPC** (`PI_RPC_URL`, default `http://localhost:8000`) and provides:

- **Public frontend**: create wallet, fund via faucet, run RPC smoke tests, tokens, swaps, liquidity, subscriptions.
- **Backend faucet**: holds the faucet secret server-side and funds new accounts.
- **Soroban contracts** (protocol 21-era SDK): token, DEX pool+router, subscription service.

> Security: the faucet secret **must never** be exposed to the browser. It is only used by the backend.

## Prereqs

- Node.js 20+
- `pnpm` (recommended via Corepack: `corepack enable`)
- A running `pi-rpc` reachable at `http://localhost:8000` (or set `PI_RPC_URL`)

## Quickstart (no Docker)

From `pi-dapp-suite/`:

```powershell
corepack enable
pnpm install
copy .env.example .env
copy apps/web/.env.example apps/web/.env
pnpm run dev
```

Open:

- Web app: `http://localhost:5173`
- Faucet API: `http://localhost:4000/health`

## Docker (full stack)

Compose brings up **Pi RPC**, the **faucet backend**, and the **web app** together. Paths assume this folder lives inside the **pi-rpc** repo next to `config.pi.toml` and `pi-core.cfg` (see `docker-compose.yml` volume mounts).

### 1) Build the RPC image once

From the **repository root** (`pi-rpc/`, parent of `pi-dapp-suite/`):

```powershell
docker build -t pi-rpc:local -f cmd/stellar-rpc/docker/Dockerfile .
```

If `docker compose` fails with “pull access denied” for `pi-rpc:local`, you skipped this step—the tag must exist locally.

### 2) Environment file for the faucet service

From `pi-dapp-suite/`:

```powershell
copy .env.example .env
```

Edit `.env`. For Compose, point the faucet at the RPC **container** on the default Docker network (not `localhost`, which inside the faucet container is only the faucet itself):

```env
PI_RPC_URL=http://pi-rpc:8000
```

Keep `FAUCET_SECRET`, `FAUCET_PUBLIC`, `NETWORK_PASSPHRASE`, and optionally `ADMIN_TOKEN` as described in [Configure](#configure).

### 3) Start everything

Still in `pi-dapp-suite/`:

```powershell
docker compose up --build
```

Detach with `-d` if you want containers in the background.

Open the same URLs as in [Quickstart (no Docker)](#quickstart-no-docker):

- Web: `http://localhost:5173` (`VITE_*` URLs in compose target your host’s published ports)
- Faucet: `http://localhost:4000/health`

Contract state files `./.contracts-state.json` and `./.contracts.env` are bind-mounted so IDs persist across restarts.

### Notes

- **RPC config**: `pi-rpc` reads `/app/config.pi.toml` inside the image; compose mounts `../config.pi.toml` and `../pi-core.cfg` from the repo root.
- **Browser vs backend**: The web container sets `VITE_PI_RPC_URL` and `VITE_FAUCET_URL` to `http://localhost:8000` and `http://localhost:4000` because the browser runs on your machine; only the faucet backend needs `http://pi-rpc:8000` for server-side RPC calls.

## Configure

Copy the example env files and fill in values:

```powershell
copy .env.example .env
copy apps/web/.env.example apps/web/.env
```

Required:

- `PI_RPC_URL` (example `http://localhost:8000`)
- `NETWORK_PASSPHRASE` (`Pi Testnet`)
- `FAUCET_SECRET` (server-side only)
- `FAUCET_PUBLIC`
- `ADMIN_TOKEN` (recommended; required for backend deploy/invoke endpoints)

## Notes

- The frontend only talks to the **faucet backend**; it never receives `FAUCET_SECRET`.
- `pnpm run dev` starts both the faucet backend (port 4000) and the web app (port 5173).
- If `PI_RPC_URL` points to a remote machine, update both `.env` and `apps/web/.env` and restart `pnpm run dev`.

## Contracts scaffold

Contract workspace is in `contracts/` and includes:

- `token`
- `dex_pool`
- `dex_router`
- `subscription`

Build contracts:

```powershell
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

Deploy helper scripts:

- `contracts/scripts/deploy.ps1`
- `contracts/scripts/init-demo.ps1`

These are scaffold contracts for local RPC and flow testing (not production-audited DEX/token code).

## Deploy and use contracts from the UI

1) Set `ADMIN_TOKEN` in `.env` and restart the faucet backend.
2) In the web UI “Contracts (Soroban)” section:
   - paste the same token into “Admin token”
   - click **Deploy all (backend)** (requires `soroban` CLI installed)
   - click **Load contract IDs**
3) Use the buttons to call `subscribe`, `is_active`, pool liquidity, and basic token balance.

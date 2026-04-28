# Pi Dapp Suite (Soroban v21–23) — RPC Test + DEX Playground

Standalone repo folder that connects to **Pi RPC** (`PI_RPC_URL`, default `http://localhost:8000`) and provides:

- **Public frontend**: create wallet, fund via faucet, run RPC smoke tests, tokens, swaps, liquidity, subscriptions.
- **Backend faucet**: holds the faucet secret server-side and funds new accounts.
- **Soroban contracts** (protocol 21-era SDK): token, DEX pool+router, subscription service.

> Security: the faucet secret **must never** be exposed to the browser. It is only used by the backend.

## Prereqs

- Node.js 20+
- A running `pi-rpc` reachable at `http://localhost:8000` (or set `PI_RPC_URL`)

## Quickstart (no Docker)

From `pi-dapp-suite/`:

```powershell
copy .env.example .env
copy apps/web/.env.example apps/web/.env
pnpm run dev
```

Open:

- Web app: `http://localhost:5173`
- Faucet API: `http://localhost:4000/health`

## Configure

Copy the example env and fill in values:

```powershell
copy .env.example .env
```

Required:

- `PI_RPC_URL` (example `http://localhost:8000`)
- `NETWORK_PASSPHRASE` (`Pi Testnet`)
- `FAUCET_SECRET` (server-side only)
- `FAUCET_PUBLIC`
- `ADMIN_TOKEN` (recommended; required for backend deploy/invoke endpoints)

## Notes

- The frontend only talks to the **faucet backend**; it never receives `FAUCET_SECRET`.
- If `PI_RPC_URL` points to a remote machine, update both `.env` and `apps/web/.env`.

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

# pi-rpc
RPC Server for the Pi Network.

This repository contains the Pi RPC server. The RPC server provides a JSON-RPC interface for interacting with the Pi Network. It allows you to:
- Query the current state of the network.
- Submit transactions to the network.
- Fetch transaction status and history.
- Simulate transaction execution (preflight).

The Pi RPC server is designed to be simple, scalable, and compatible with Soroban protocol version 21.2.0.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Building from Source](#building-from-source)
  - [Linux and WSL](#linux-and-wsl)
  - [macOS](#macos)
  - [Windows (Native)](#windows-native)
- [Running the Server](#running-the-server)
  - [Development Mode](#development-mode)
  - [Production Mode](#production-mode)
- [Docker](#docker)
- [Configuration](#configuration)
- [Testing](#testing)

## Prerequisites
To build and run `pi-rpc`, you will need:
- **Go**: Version 1.25 or higher.
- **Rust**: Latest stable version (required for Soroban preflight libraries).
- **C Compiler**: GCC or Clang (for SQLite and FFI components).
- **Pi Node**: A running `pi-node` (or `stellar-core` compatible) instance.
- **Make**: For running build automation scripts.

## Building from Source

### Linux and WSL
1. Ensure all prerequisites are installed.
2. Clone the repository:
   ```bash
   git clone https://github.com/junman140/pi-rpc.git
   cd pi-rpc
   ```
3. Build the server and its dependencies:
   ```bash
   make build-pi-rpc
   ```
   This will compile the Rust preflight libraries and the Go binary. The resulting binary will be named `pi-rpc`.

### macOS
Building on macOS is similar to Linux:
1. Ensure you have Xcode Command Line Tools installed (`xcode-select --install`).
2. Install Go and Rust using Homebrew or their official installers.
3. Build the binary:
   ```bash
   make build-pi-rpc
   ```

### Windows (Native)
While WSL is the recommended way to build on Windows, you can build natively if you have a C compiler (like MinGW-w64) and `make` installed:
1. Install Go, Rust, and MinGW-w64.
2. Open PowerShell and navigate to the repository root.
3. Run the build command:
   ```powershell
   make build-pi-rpc
   ```
   *Note: If you encounter issues with `make`, you can manually run the Go and Cargo commands found in the Makefile.*

## Running the Server

### Development Mode
To run the server for development purposes with a local configuration:
1. Copy the example configuration file:
   ```bash
   cp config.example.toml config.toml
   ```
2. Edit `config.toml` to match your environment (especially `PI_NODE_URL` and `NETWORK_PASSPHRASE`).
3. Start the server:
   ```bash
   ./pi-rpc --config-path config.toml
   ```

### Production Mode
For production, it is recommended to use environment variables for configuration and run the server as a systemd service or within a Docker container.

Example using environment variables:
```bash
export PI_RPC_NETWORK_PASSPHRASE="Pi Network"
export PI_RPC_PI_NODE_URL="http://localhost:11626"
export PI_RPC_DB_PATH="./pi-rpc.sqlite"
./pi-rpc
```

In Docker, prefer storing the DB on a mounted data directory (for example `/data/pi-rpc.sqlite`) so the RPC does not re-ingest from scratch on every restart.

## Docker

## Quickstart (copy/paste)

### Step 0: Build the Docker image (required on each PC)

On a new PC, you must build the image locally before `docker run` will work.

**PowerShell (Windows):**
```powershell
docker build -t pi-rpc:local -f cmd/stellar-rpc/docker/Dockerfile .
```

If you see `pull access denied` / `repository does not exist`, it means you ran `docker run pi-rpc:local` **without building** `pi-rpc:local` first.

### Step-by-step Docker setup (from scratch)

This section assumes:
- you are in the repo root (where `config.pi.toml` and `pi-core.cfg` exist)
- you are using **PowerShell** on Windows

#### 1) Clean up any old runs (optional but recommended)

If you previously ran a container named `pi-rpc`, remove it:

```powershell
docker rm -f pi-rpc 2>$null
```

If ports are “already allocated”, list what’s running:

```powershell
docker ps
```

#### 2) Build the image locally (this creates `pi-rpc:local`)

```powershell
docker build -t pi-rpc:local -f cmd/stellar-rpc/docker/Dockerfile .
```

Confirm the tag exists:

```powershell
docker images pi-rpc
```

#### 3) Start `pi-rpc` in the background (recommended)

Running in the background avoids accidental shutdowns (Ctrl+C produces “got signal 2”).

```powershell
docker run -d --name pi-rpc `
  -p 8000:8000 -p 8001:8001 `
  -v "${PWD}/config.pi.toml:/app/config.pi.toml" `
  -v "${PWD}/pi-core.cfg:/app/pi-core.cfg" `
  -v pi_rpc_db:/data `
  -v pi_captive_core:/captive-core `
  pi-rpc:local --config-path /app/config.pi.toml
```

Watch logs:

```powershell
docker logs -f pi-rpc
```

Stop it later:

```powershell
docker stop pi-rpc
```

#### 4) Verify it’s working (3 quick checks)

1) **Admin metrics** (should load text):
- `http://localhost:8001/metrics`

2) **RPC health** (should return JSON):

```powershell
$body = @{ jsonrpc = "2.0"; id = 1; method = "getHealth" } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/" -ContentType "application/json" -Body $body
```

3) **Latest ledger** (returns current ledger + headers):

```powershell
$body = @{ jsonrpc = "2.0"; id = 1; method = "getLatestLedger"; params = @{} } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/" -ContentType "application/json" -Body $body
```

#### 5) (Optional) Start Grafana + Prometheus (Admin GUI)

```powershell
docker compose -f monitoring/docker-compose.yml up -d --force-recreate
```

- Grafana: `http://localhost:3001` (login `admin` / `admin`)
- Prometheus: `http://localhost:9090` (Status → Targets should show `pi_rpc_admin` as **UP**)

### Option A: Pi Testnet shortcut (fastest)

This is the simplest way to start without managing config files (good for first boot).

**PowerShell (Windows):**
```powershell
docker run --rm --name pi-rpc `
  -p 8000:8000 -p 8001:8001 `
  -e NETWORK="testnet" `
  -e ADMIN_ENDPOINT="0.0.0.0:8001" `
  pi-rpc:local
```

### Option B: Explicit config files (recommended)

This repo includes `config.pi.toml` and `pi-core.cfg`. If you don’t mount them (or the mount path is wrong), `pi-rpc` will refuse to start with:
`captive-core-config-path is required`, `history-archive-urls is required`, `network-passphrase is required`.

**PowerShell (Windows):**
```powershell
docker run --rm --name pi-rpc `
  -p 8000:8000 -p 8001:8001 `
  -v "${PWD}/config.pi.toml:/app/config.pi.toml" `
  -v "${PWD}/pi-core.cfg:/app/pi-core.cfg" `
  pi-rpc:local --config-path /app/config.pi.toml
```

### Building the Image
**Important**: Ensure you are in the root directory of the repository before running the build command.

```bash
docker build -t pi-rpc:local -f cmd/stellar-rpc/docker/Dockerfile .
```

### Running the Container

#### Method 1: Using Shortcuts (Easiest for quick testing)
The `NETWORK` environment variable (set to `testnet`, `pubnet`, or `futurenet`) automatically configures captive-core defaults, passphrases, and history archives for Pi environments.

**PowerShell (Windows):**
```powershell
docker run -p 8000:8000 -p 8001:8001 `
  -e NETWORK="testnet" `
  -e ADMIN_ENDPOINT="0.0.0.0:8001" `
  pi-rpc:local
```

#### Method 2: Using your `config.toml` (Recommended for Pi Network)
Mount your local `config.toml` into the container to use your specific Pi settings. Ensure you have set `CAPTIVE_CORE_CONFIG_PATH` and `HISTORY_ARCHIVE_URLS` in your `config.toml`.

**PowerShell (Windows):**
```powershell
docker run -p 8000:8000 -p 8001:8001 `
  -v "${PWD}/config.toml:/app/config.toml" `
  -e ADMIN_ENDPOINT="0.0.0.0:8001" `
  pi-rpc:local --config-path /app/config.toml
```

**Bash (Linux/macOS/WSL):**
```bash
docker run -p 8000:8000 -p 8001:8001 \
  -v "$(pwd)/config.toml:/app/config.toml" \
  -e ADMIN_ENDPOINT="0.0.0.0:8001" \
  pi-rpc:local --config-path /app/config.toml
```

#### Method 3: Explicit Pi config (recommended)
Use the included `config.pi.toml` and `pi-core.cfg`:

**PowerShell (Windows):**
```powershell
docker run -p 8000:8000 -p 8001:8001 `
  -v "${PWD}/config.pi.toml:/app/config.pi.toml" `
  -v "${PWD}/pi-core.cfg:/app/pi-core.cfg" `
  pi-rpc:local --config-path /app/config.pi.toml
```

## Config setup (clear + foolproof)

### Which config do I edit?

- **Docker (recommended)**: edit `config.pi.toml` and `pi-core.cfg` in this repo, then mount them into the container (see Option B above).
- **Running the local binary**: copy `config.example.toml` to `config.toml`, then edit it.

### The 3 required settings (why it “refuses to start”)

If `pi-rpc` starts without these, it exits immediately with:
`captive-core-config-path is required`, `history-archive-urls is required`, `network-passphrase is required`.

In Docker, the easiest working values are:
- **`CAPTIVE_CORE_CONFIG_PATH`**: `/app/pi-core.cfg`
- **`HISTORY_ARCHIVE_URLS`**: `http://history.testnet.minepi.com`
- **`NETWORK_PASSPHRASE`**: `Pi Testnet`

Those are already set in the repo’s `config.pi.toml`. The key is: **the paths inside the TOML must match where you mount the files inside the container**.

### Common mistakes

- Built the image as `pi-rpc` but ran `pi-rpc:local` (tags must match).
- Ran `docker run pi-rpc:local ...` on a new PC without building first (Docker tries to pull from the internet and fails).
- Mounted the TOML but used a different `--config-path` than the mount target.
- Edited `config.pi.toml` but forgot to mount it into the container.

### What “Herder: Asking peers for SCP messages…” means

If captive-core logs repeat:
`Herder: Asking peers for SCP messages more recent than <ledger>`

it usually means core is **not receiving consensus messages from peers yet**. Common causes:
- **Outbound networking is restricted** (corporate firewall/VPN, strict router rules)
- **DNS/connectivity problems inside Docker**
- A misconfigured `pi-core.cfg` peer/quorum settings (less common if you use the repo’s `pi-core.cfg`)

Important notes for Pi Testnet:
- Captive-core TOML parsing runs in **strict mode**: some stellar-core config keys (for example `KNOWN_PEERS`) are rejected.
- Use `PREFERRED_PEERS` (and optionally `PREFERRED_PEER_KEYS`) and set `PEER_PORT=31402` for Pi Testnet.

This line by itself is not a crash; it’s core waiting to make progress.

### Why you see “got signal 2, shutting down”

`signal 2` is an interrupt (Ctrl+C). It means the process/container was stopped by the user or by closing the terminal.
Use `docker run -d ...` + `docker logs -f ...` (above) to avoid accidentally stopping it.

## Endpoints (what’s running where)

- **RPC endpoint (JSON-RPC)**: `http://localhost:8000/`
  - You send **HTTP POST** requests containing JSON-RPC 2.0 payloads.
- **Admin endpoint (metrics + pprof)**: `http://localhost:8001/`
  - **Prometheus metrics**: `http://localhost:8001/metrics`
  - **pprof** (debug): `http://localhost:8001/debug/pprof/`

## How to make RPC requests (examples)

### 1) Health check

**curl (Linux/macOS/WSL):**
```bash
curl -sS http://localhost:8000/ \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

**PowerShell (Windows):**
```powershell
$body = @{ jsonrpc = "2.0"; id = 1; method = "getHealth" } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/" -ContentType "application/json" -Body $body
```

### 2) Latest ledger

**curl:**
```bash
curl -sS http://localhost:8000/ \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger","params":{}}'
```

### 3) Discover network info

**curl:**
```bash
curl -sS http://localhost:8000/ \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getNetwork","params":{}}'
```

### 4) Other commonly used methods

These methods are supported by the server and follow the same JSON-RPC format:
- `getEvents`
- `getLedgers`
- `getLedgerEntries`
- `getTransaction`
- `getTransactions`
- `sendTransaction`
- `simulateTransaction`
- `getFeeStats`
- `getVersionInfo`

Tip: params are **always an object** (not an array). (Array params are rejected for backwards-compatibility.)

## Configuration
The server can be configured via command-line flags, environment variables, or a TOML configuration file. Environment variables take precedence over the configuration file, and flags take precedence over everything.

| Flag | Environment Variable | Description |
|------|----------------------|-------------|
| `--config-path` | `PI_RPC_CONFIG_PATH` | Path to the TOML configuration file. |
| `--endpoint` | `ENDPOINT` | The HTTP endpoint for the RPC server (default: `localhost:8000`). |
| `--pi-node-url` | `PI_NODE_URL` | URL of the Pi Node instance. |
| `--network-passphrase`| `NETWORK_PASSPHRASE` | Network passphrase for the Pi network. |
| `--db-path` | `DB_PATH` | Path to the SQLite database file. |
| `--log-level` | `LOG_LEVEL` | Minimum log severity (debug, info, warn, error). |

## Troubleshooting

### Docker Build Failures (Network Issues)
If you encounter `400 Bad Request` or `Connection refused` errors during `docker build`, it is often due to local network or proxy issues when fetching from Ubuntu mirrors. 

Try the following:
1. **Restart Docker Desktop**: Sometimes the internal DNS/network state gets corrupted.
2. **Clear Docker Cache**: `docker builder prune`
3. **Use a Different Mirror**: You can modify the Dockerfile to use a specific mirror if your local one is down.

### "NETWORK_PASSPHRASE ... does not match"
This happens if your `NETWORK_PASSPHRASE` conflicts with the passphrase configured in your `CAPTIVE_CORE_CONFIG_PATH` or history archive. For Pi Network deployments, prefer running with `--config-path /app/config.toml` and explicit Pi values instead of the `NETWORK` shortcut.

## Testing

### Unit Tests
Run the Go unit tests:
```bash
make go-test
```

Run individual package tests:
```bash
go test -v ./cmd/stellar-rpc/internal/config
```

### Integration Tests
Integration tests require a running Pi Node environment:
```bash
PI_RPC_INTEGRATION_TESTS_ENABLED=true \
PI_RPC_INTEGRATION_TESTS_CORE_MAX_SUPPORTED_PROTOCOL=23 \
PI_RPC_INTEGRATION_TESTS_CAPTIVE_CORE_BIN=$(which pi-node) \
  go test -v ./cmd/stellar-rpc/internal/integrationtest/...
```

## Admin GUI (Grafana)
The admin endpoint already exposes Prometheus metrics at `/metrics`.

1. Start `pi-rpc` with admin endpoint exposed on `8001`.
2. Start monitoring stack:
```powershell
docker compose -f monitoring/docker-compose.yml up -d
```
3. Open Grafana at `http://localhost:3001` (default `admin/admin`; port `3001` avoids clashes with other apps on `3000`).
4. The Prometheus datasource is auto-provisioned; use URL `http://prometheus:9090` only if you add a datasource manually.

### Auto-Provisioned Monitoring
Grafana is pre-provisioned with:
- a Prometheus datasource (`Prometheus`)
- a starter dashboard (`Pi RPC Overview`)

Start/restart monitoring stack:
```powershell
docker compose -f monitoring/docker-compose.yml up -d --force-recreate
```

Open Grafana:
- `http://localhost:3001`
- Login: `admin` / `admin`
- Dashboard: **Pi RPC Overview** (already loaded)

### What the dashboard is showing
- **Pi RPC Up**: whether Prometheus can scrape `pi-rpc` admin metrics (`up{job="pi_rpc_admin"}` should be `1`)
- **Memory / CPU / Goroutines**: standard Go process health metrics from the admin `/metrics` endpoint

If “Pi RPC Up” is `0`, Prometheus cannot reach `http://<target>/metrics` yet—start by checking `http://localhost:8001/metrics` in your browser.

### Monitoring: Prometheus shows `host.docker.internal` down / “no such host”
If the `pi_rpc_admin` target is **down** with `lookup host.docker.internal ... no such host`, recreate the stack so Prometheus picks up `extra_hosts` in `monitoring/docker-compose.yml`:

```powershell
docker compose -f monitoring/docker-compose.yml up -d --force-recreate
```

`pi-rpc` must listen on the host at port `8001` (for example `docker run ... -p 8001:8001` or a local binary). If you prefer not to use `host.docker.internal`, edit `monitoring/prometheus.yml` and set `targets` to your host IP and port, for example `192.168.x.x:8001`.

If `docker run` reports `port is already allocated` (e.g., `8000`), stop old containers first:
```powershell
docker ps
docker stop <container_id>
```

---
Developer Docs: https://developers.minepi.com (Placeholder)
Report Bugs: Please open an issue on the repository.

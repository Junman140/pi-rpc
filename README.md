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

## Docker

## Quickstart (copy/paste)

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
docker build -t pi-rpc -f cmd/stellar-rpc/docker/Dockerfile .
```

### Running the Container

#### Method 1: Using Shortcuts (Easiest for quick testing)
The `NETWORK` environment variable (set to `testnet`, `pubnet`, or `futurenet`) automatically configures captive-core defaults, passphrases, and history archives for Pi environments.

**PowerShell (Windows):**
```powershell
docker run -p 8000:8000 -p 8001:8001 `
  -e NETWORK="testnet" `
  -e ADMIN_ENDPOINT="0.0.0.0:8001" `
  pi-rpc
```

#### Method 2: Using your `config.toml` (Recommended for Pi Network)
Mount your local `config.toml` into the container to use your specific Pi settings. Ensure you have set `CAPTIVE_CORE_CONFIG_PATH` and `HISTORY_ARCHIVE_URLS` in your `config.toml`.

**PowerShell (Windows):**
```powershell
docker run -p 8000:8000 -p 8001:8001 `
  -v "${PWD}/config.toml:/app/config.toml" `
  -e ADMIN_ENDPOINT="0.0.0.0:8001" `
  pi-rpc --config-path /app/config.toml
```

**Bash (Linux/macOS/WSL):**
```bash
docker run -p 8000:8000 -p 8001:8001 \
  -v "$(pwd)/config.toml:/app/config.toml" \
  -e ADMIN_ENDPOINT="0.0.0.0:8001" \
  pi-rpc --config-path /app/config.toml
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

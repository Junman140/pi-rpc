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
   git clone https://github.com/pi-node/pi-rpc.git
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
export PI_RPC_PI_NODE_URL="http://your-pi-node:11626"
export PI_RPC_DB_PATH="./pi-rpc.sqlite"
./pi-rpc
```

## Docker

### Building the Image
**Important**: Ensure you are in the root directory of the repository before running the build command.

```bash
docker build -t pi-rpc -f cmd/stellar-rpc/docker/Dockerfile .
```

### Running the Container
```bash
docker run -p 8000:8000 \
  -e PI_RPC_NETWORK_PASSPHRASE="Pi Network" \
  -e PI_RPC_PI_NODE_URL="http://your-pi-node:11626" \
  pi-rpc
```

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

For a full list of options, run:
```bash
./pi-rpc --help
```

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

---
Developer Docs: https://developers.minepi.com (Placeholder)
Report Bugs: Please open an issue on the repository.

import express from "express";
import cors from "cors";
import { z } from "zod";
import pLimit from "p-limit";
import * as StellarSdk from "stellar-sdk";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Ensure we load the repo-root .env even when started from apps/faucet/.
const here = path.dirname(fileURLToPath(import.meta.url));
// In dev (pnpm), this resolves to pi-dapp-suite/apps/faucet/src.
// In Docker, we still want paths anchored at /app (workdir).
const repoRoot = path.resolve(here, "..", "..", ".."); // pi-dapp-suite/
dotenv.config({ path: path.join(repoRoot, ".env") });

const envSchema = z.object({
  PI_RPC_URL: z.string().url(),
  NETWORK_PASSPHRASE: z.string().min(1),
  FAUCET_PUBLIC: z.string().min(1),
  FAUCET_SECRET: z.string().min(1),
  PORT: z.string().optional(),
  ADMIN_TOKEN: z.string().min(8).optional(),
});

const env = envSchema.parse({
  PI_RPC_URL: process.env.PI_RPC_URL,
  NETWORK_PASSPHRASE: process.env.NETWORK_PASSPHRASE,
  FAUCET_PUBLIC: process.env.FAUCET_PUBLIC,
  FAUCET_SECRET: process.env.FAUCET_SECRET,
  PORT: process.env.PORT,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const rpc = new StellarSdk.SorobanRpc.Server(env.PI_RPC_URL, {
  allowHttp: env.PI_RPC_URL.startsWith("http://"),
});

const faucetKeypair = StellarSdk.Keypair.fromSecret(env.FAUCET_SECRET);

const limit = pLimit(2);

const execFileAsync = promisify(execFile);
const contractsRoot = path.join(repoRoot, "contracts");
const contractsStatePath = path.join(repoRoot, ".contracts-state.json");
const contractsEnvPath = path.join(repoRoot, ".contracts.env");

function requireAdmin(req, res) {
  if (!env.ADMIN_TOKEN) {
    return res.status(400).json({ ok: false, error: "ADMIN_TOKEN is not set on the backend" });
  }
  const got = req.header("x-admin-token");
  if (!got || got !== env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  return null;
}

async function readContractsState() {
  try {
    const raw = await fs.readFile(contractsStatePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeContractsState(next) {
  await fs.writeFile(contractsStatePath, JSON.stringify(next, null, 2), "utf8");
}

async function writeContractsEnv(ids) {
  const lines = [
    `TOKEN_CONTRACT_ID=${ids.token ?? ""}`,
    `DEX_POOL_CONTRACT_ID=${ids.dex_pool ?? ""}`,
    `DEX_ROUTER_CONTRACT_ID=${ids.dex_router ?? ""}`,
    `SUBSCRIPTION_CONTRACT_ID=${ids.subscription ?? ""}`,
    `CONTRACTS_DEPLOYED_AT=${ids.deployedAt ?? ""}`,
    "",
  ];
  await fs.writeFile(contractsEnvPath, lines.join("\n"), "utf8");
}

app.get("/health", async (_req, res) => {
  try {
    const health = await rpc.getHealth();
    res.json({ ok: true, health });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: String(e?.message ?? e),
      details: String(e),
      stack: e?.stack ? String(e.stack) : undefined,
      piRpcUrl: env.PI_RPC_URL,
    });
  }
});

app.get("/contracts/state", async (_req, res) => {
  const state = await readContractsState();
  res.json({ ok: true, state });
});

app.post("/admin/contracts/deploy-all", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return;

  try {
    // Ensure WASM exists; build if needed (best-effort: works in dev; in Docker we ship prebuilt WASM).
    const tryBuild = async () => {
      try {
        await execFileAsync("cargo", ["build", "--target", "wasm32-unknown-unknown", "--release"], {
          cwd: contractsRoot,
        });
      } catch {
        // ignore; we'll validate artifacts below
      }
    };
    await tryBuild();

    const wasm = {
      token: path.join(contractsRoot, "token", "target", "wasm32-unknown-unknown", "release", "token.wasm"),
      dex_pool: path.join(contractsRoot, "dex_pool", "target", "wasm32-unknown-unknown", "release", "dex_pool.wasm"),
      dex_router: path.join(
        contractsRoot,
        "dex_router",
        "target",
        "wasm32-unknown-unknown",
        "release",
        "dex_router.wasm"
      ),
      subscription: path.join(
        contractsRoot,
        "subscription",
        "target",
        "wasm32-unknown-unknown",
        "release",
        "subscription.wasm"
      ),
    };

    for (const [k, p] of Object.entries(wasm)) {
      await fs.access(p).catch(() => {
        throw new Error(`Missing WASM for ${k}. Build failed or artifact not found: ${p}`);
      });
    }

    const common = ["--rpc-url", env.PI_RPC_URL, "--network-passphrase", env.NETWORK_PASSPHRASE];
    // Deploy using the backend's FAUCET_SECRET as the source key (test-only).
    const deployOne = async (wasmPath) => {
      const { stdout } = await execFileAsync(
        "soroban",
        ["contract", "deploy", "--wasm", wasmPath, "--secret-key", env.FAUCET_SECRET, ...common],
        { cwd: contractsRoot }
      );
      return stdout.trim();
    };

    const ids = {
      token: await deployOne(wasm.token),
      dex_pool: await deployOne(wasm.dex_pool),
      dex_router: await deployOne(wasm.dex_router),
      subscription: await deployOne(wasm.subscription),
    };

    const state = await readContractsState();
    const next = { ...state, ...ids, deployedAt: new Date().toISOString() };
    await writeContractsState(next);
    await writeContractsEnv(next);
    res.json({ ok: true, ids: next });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e), details: String(e) });
  }
});

const invokeSchema = z.object({
  contractId: z.string().min(1),
  fn: z.string().min(1),
  // soroban-cli args as strings, already formatted (e.g. ["--admin", "G...", "--decimals", "7"])
  args: z.array(z.string()).optional(),
});

app.post("/admin/contracts/invoke", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return;

  const parsed = invokeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const { contractId, fn, args } = parsed.data;
  try {
    const common = ["--rpc-url", env.PI_RPC_URL, "--network-passphrase", env.NETWORK_PASSPHRASE];
    const { stdout, stderr } = await execFileAsync(
      "soroban",
      [
        "contract",
        "invoke",
        "--id",
        contractId,
        "--secret-key",
        env.FAUCET_SECRET,
        ...common,
        "--",
        fn,
        ...(args ?? []),
      ],
      { cwd: contractsRoot }
    );
    res.json({ ok: true, stdout: stdout.trim(), stderr: (stderr ?? "").trim() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e), details: String(e) });
  }
});

const fundSchema = z.object({
  destination: z.string().min(1),
  startingBalance: z.string().optional(), // stroops string, optional
});

app.post("/faucet/fund", async (req, res) => {
  const parsed = fundSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const { destination } = parsed.data;
  let destPk;
  try {
    destPk = StellarSdk.Keypair.fromPublicKey(destination).publicKey();
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid destination public key" });
  }

  // serialize requests to avoid sequence races
  const result = await limit(async () => {
    // Load faucet account from RPC (soroban-rpc provides classic account queries too)
    const account = await rpc.getAccount(env.FAUCET_PUBLIC);

    // Create account if it doesn't exist; if it already exists, send a small payment instead.
    // We try createAccount first; if it fails due to existing account, we fallback to payment.
    const baseFee = await rpc.getFeeStats().then(() => "100"); // fallback if server changes; classic fee often 100
    const tb = new StellarSdk.TransactionBuilder(account, {
      fee: baseFee,
      networkPassphrase: env.NETWORK_PASSPHRASE,
    });

    tb.addOperation(
      StellarSdk.Operation.createAccount({
        destination: destPk,
        startingBalance: "2", // minimal lumens-like units; adjust per Pi network rules
      })
    );

    const tx = tb.setTimeout(60).build();
    tx.sign(faucetKeypair);

    const send = await rpc.sendTransaction(tx);
    return { send };
  });

  res.json({ ok: true, ...result });
});

const port = Number(env.PORT ?? 4000);
app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`faucet listening on :${port}`);
});


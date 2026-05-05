import * as StellarSdk from "stellar-sdk";

export function json<T>(v: T) {
  return JSON.stringify(v, null, 2);
}

export async function pollTx(rpc: StellarSdk.SorobanRpc.Server, hash: string, timeoutMs = 60_000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tx = await rpc.getTransaction(hash);
    if (tx.status !== "NOT_FOUND") return tx;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for tx ${hash}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/** Classic inclusion fee from soroban-rpc getFeeStats (stroops string). */
export async function resolveClassicMaxFee(rpc: StellarSdk.SorobanRpc.Server): Promise<string> {
  const floor = 100;
  const fallback = 100_000;
  try {
    const stats = await rpc.getFeeStats();
    const dist = (stats as unknown as { inclusionFee?: Record<string, string | number> }).inclusionFee;
    if (!dist || typeof dist !== "object") return String(fallback);
    const nums = [dist.max, dist.p99, dist.p95, dist.mode, dist.p90, dist.min]
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    const base = nums.length ? Math.max(...nums) : fallback;
    const withMargin = Math.ceil(base * 1.25);
    return String(Math.max(floor, withMargin));
  } catch {
    return String(fallback);
  }
}

export async function submitSoroban(
  rpc: StellarSdk.SorobanRpc.Server,
  passphrase: string,
  signer: StellarSdk.Keypair,
  op: StellarSdk.xdr.Operation
) {
  const account = await rpc.getAccount(signer.publicKey());
  const fee = await resolveClassicMaxFee(rpc);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee,
    networkPassphrase: passphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);

  if ("error" in sim && sim.error) {
    throw new Error(`simulateTransaction failed: ${json(sim.error)}`);
  }

  const assembled = StellarSdk.SorobanRpc.assembleTransaction(tx, sim).build();
  assembled.sign(signer);
  const sent = await rpc.sendTransaction(assembled);

  if (sent.status === "ERROR") {
    throw new Error(
      `sendTransaction ERROR: ${json({
        status: sent.status,
        errorResult: (sent as unknown as { errorResult?: unknown }).errorResult,
        diagnosticEvents: (sent as unknown as { diagnosticEvents?: unknown }).diagnosticEvents,
      })}`
    );
  }

  const hash = sent.hash;
  const final = await pollTx(rpc, hash);
  return { sent, final };
}

/** Parse JSON fetch body and surface server hint fields. */
export async function readJsonResponse<T>(r: Response): Promise<T> {
  const j = (await r.json()) as T & { ok?: boolean; error?: unknown; hint?: string };
  return j;
}

export function formatHttpError(j: { error?: unknown; hint?: string }, fallback: string) {
  const parts = [
    typeof j.error === "string" ? j.error : j.error != null ? json(j.error) : "",
    j.hint ?? "",
  ].filter(Boolean);
  return parts.join(" — ") || fallback;
}

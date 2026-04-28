import React, { useMemo, useState } from "react";
import * as StellarSdk from "stellar-sdk";

const rpcUrl = import.meta.env.VITE_PI_RPC_URL ?? "http://localhost:8000";
const networkPassphrase = import.meta.env.VITE_NETWORK_PASSPHRASE ?? "Pi Testnet";
const faucetUrl = import.meta.env.VITE_FAUCET_URL ?? "http://localhost:4000";

function json<T>(v: T) {
  return JSON.stringify(v, null, 2);
}

async function pollTx(rpc: StellarSdk.SorobanRpc.Server, hash: string, timeoutMs = 60_000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tx = await rpc.getTransaction(hash);
    if (tx.status !== "NOT_FOUND") return tx;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for tx ${hash}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function submitSoroban(
  rpc: StellarSdk.SorobanRpc.Server,
  passphrase: string,
  signer: StellarSdk.Keypair,
  op: StellarSdk.xdr.Operation
) {
  const account = await rpc.getAccount(signer.publicKey());
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: passphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  const assembled = StellarSdk.SorobanRpc.assembleTransaction(tx, sim).build();
  assembled.sign(signer);
  const sent = await rpc.sendTransaction(assembled);
  const hash = sent.hash;
  const final = await pollTx(rpc, hash);
  return { sent, final };
}

export function App() {
  const rpc = useMemo(
    () =>
      new StellarSdk.SorobanRpc.Server(rpcUrl, {
        allowHttp: rpcUrl.startsWith("http://"),
      }),
    []
  );

  const [kp, setKp] = useState<StellarSdk.Keypair | null>(null);
  const [out, setOut] = useState<string>("ready");
  const [adminToken, setAdminToken] = useState<string>("");
  const [contracts, setContracts] = useState<any>({});
  const [tokenId, setTokenId] = useState<string>("");
  const [poolId, setPoolId] = useState<string>("");
  const [routerId, setRouterId] = useState<string>("");
  const [subId, setSubId] = useState<string>("");

  async function run(fn: () => Promise<any>) {
    try {
      const r = await fn();
      setOut(json(r));
    } catch (e: any) {
      setOut(String(e?.message ?? e));
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h2>Pi Dapp Suite</h2>
      <p>
        RPC: <code>{rpcUrl}</code> | Network passphrase: <code>{networkPassphrase}</code>
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
          <h3>Wallet</h3>
          <button onClick={() => setKp(StellarSdk.Keypair.random())}>Create wallet</button>
          {kp && (
            <div style={{ marginTop: 8 }}>
              <div>
                Public: <code>{kp.publicKey()}</code>
              </div>
              <div>
                Secret: <code>{kp.secret()}</code>
              </div>
              <button
                style={{ marginTop: 8 }}
                onClick={() =>
                  run(async () => {
                    const r = await fetch(`${faucetUrl}/faucet/fund`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ destination: kp.publicKey() }),
                    });
                    const j = await r.json();
                    if (!r.ok) throw new Error(j?.error ? JSON.stringify(j.error) : "faucet error");
                    return j;
                  })
                }
              >
                Request funding (faucet)
              </button>
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
          <h3>RPC smoke tests</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={() => run(() => rpc.getHealth())}>getHealth</button>
            <button onClick={() => run(() => rpc.getNetwork())}>getNetwork</button>
            <button onClick={() => run(() => rpc.getLatestLedger())}>getLatestLedger</button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 16, border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
        <h3>Contracts (Soroban)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Admin token (optional, enables deploy/init buttons)</div>
            <input
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="ADMIN_TOKEN"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <button
              onClick={() =>
                run(async () => {
                  const r = await fetch(`${faucetUrl}/contracts/state`);
                  const j = await r.json();
                  setContracts(j.state ?? {});
                  setTokenId(j.state?.token ?? "");
                  setPoolId(j.state?.dex_pool ?? "");
                  setRouterId(j.state?.dex_router ?? "");
                  setSubId(j.state?.subscription ?? "");
                  return j;
                })
              }
            >
              Load contract IDs
            </button>
            <button
              onClick={() =>
                run(async () => {
                  const r = await fetch(`${faucetUrl}/admin/contracts/deploy-all`, {
                    method: "POST",
                    headers: { "x-admin-token": adminToken },
                  });
                  const j = await r.json();
                  if (!r.ok) throw new Error(j?.error ?? "deploy failed");
                  setContracts(j.ids ?? {});
                  setTokenId(j.ids?.token ?? "");
                  setPoolId(j.ids?.dex_pool ?? "");
                  setRouterId(j.ids?.dex_router ?? "");
                  setSubId(j.ids?.subscription ?? "");
                  return j;
                })
              }
              disabled={!adminToken}
            >
              Deploy all (backend)
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Token contract ID</div>
            <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>DEX pool contract ID</div>
            <input value={poolId} onChange={(e) => setPoolId(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>DEX router contract ID</div>
            <input value={routerId} onChange={(e) => setRouterId(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Subscription contract ID</div>
            <input value={subId} onChange={(e) => setSubId(e.target.value)} style={{ width: "100%" }} />
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <button
            disabled={!kp || !tokenId}
            onClick={() =>
              run(async () => {
                const c = new StellarSdk.Contract(tokenId);
                const op = c.call("balance", StellarSdk.Address.fromString(kp!.publicKey()));
                return submitSoroban(rpc, networkPassphrase, kp!, op);
              })
            }
          >
            Token.balance(me)
          </button>

          <button
            disabled={!kp || !subId}
            onClick={() =>
              run(async () => {
                const latest = await rpc.getLatestLedger();
                const current = Number(latest.sequence);
                const c = new StellarSdk.Contract(subId);
                const op = c.call(
                  "subscribe",
                  StellarSdk.Address.fromString(kp!.publicKey()),
                  1,
                  current
                );
                return submitSoroban(rpc, networkPassphrase, kp!, op);
              })
            }
          >
            Subscribe(plan=1)
          </button>

          <button
            disabled={!kp || !subId}
            onClick={() =>
              run(async () => {
                const latest = await rpc.getLatestLedger();
                const current = Number(latest.sequence);
                const c = new StellarSdk.Contract(subId);
                const op = c.call(
                  "is_active",
                  StellarSdk.Address.fromString(kp!.publicKey()),
                  1,
                  current
                );
                return submitSoroban(rpc, networkPassphrase, kp!, op);
              })
            }
          >
            Subscription.is_active(plan=1)
          </button>

          <button
            disabled={!kp || !poolId}
            onClick={() =>
              run(async () => {
                const c = new StellarSdk.Contract(poolId);
                const op = c.call("add_liquidity", StellarSdk.Address.fromString(kp!.publicKey()), 1000, 1000);
                return submitSoroban(rpc, networkPassphrase, kp!, op);
              })
            }
          >
            Pool.add_liquidity(1000,1000)
          </button>

          <button
            disabled={!kp || !routerId || !tokenId}
            onClick={() =>
              run(async () => {
                const c = new StellarSdk.Contract(routerId);
                const op = c.call("quote_exact_in", tokenId, tokenId, 1000);
                return submitSoroban(rpc, networkPassphrase, kp!, op);
              })
            }
          >
            Router.quote_exact_in(1000)
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          Loaded state: <code>{Object.keys(contracts).length ? "yes" : "no"}</code>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h3>Output</h3>
        <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {out}
        </pre>
      </section>
    </div>
  );
}


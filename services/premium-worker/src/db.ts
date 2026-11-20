// `:name` placeholder binding, copied from spikes/premium-p0/ledger/ledger.ts.
export type Params = Record<string, string | number | null | ArrayBuffer | Uint8Array>;

/** Turns `:name` placeholders into ?N and binds. Same name = same ?N. */
export function stmt(db: D1Database, sql: string, p: Params): D1PreparedStatement {
  const order: string[] = [];
  const text = sql.replace(/:([a-z_]+)/g, (_m, n: string) => {
    let i = order.indexOf(n);
    if (i < 0) {
      if (!(n in p)) throw new Error(`missing param ${n}`);
      order.push(n);
      i = order.length - 1;
    }
    return `?${i + 1}`;
  });
  return db.prepare(text).bind(...order.map((n) => p[n]));
}

/** UTC calendar day key, the `periods.day` value. */
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

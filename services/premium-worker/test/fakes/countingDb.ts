// A D1Database wrapper that sums `meta.rows_written` / `meta.rows_read` of every statement it
// runs (prepare().bind() chains and batch()). first() goes through all() so its meta is counted.

interface Counters {
  written: number;
  read: number;
}

function add(c: Counters, meta: { rows_written?: number; rows_read?: number } | undefined) {
  c.written += meta?.rows_written ?? 0;
  c.read += meta?.rows_read ?? 0;
}

class CountingStatement {
  constructor(
    readonly inner: D1PreparedStatement,
    private readonly c: Counters
  ) {}
  bind(...values: unknown[]): CountingStatement {
    return new CountingStatement(this.inner.bind(...values), this.c);
  }
  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const r = await this.inner.all<T>();
    add(this.c, r.meta);
    return r;
  }
  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const r = await this.inner.run<T>();
    add(this.c, r.meta);
    return r;
  }
  async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
    const r = await this.all<Record<string, unknown>>();
    const row = r.results[0];
    if (row === undefined) return null;
    return (col === undefined ? row : (row[col] ?? null)) as T | null;
  }
  async raw<T = unknown[]>(): Promise<T[]> {
    return (await this.inner.raw()) as T[];
  }
}

export interface CountingDb {
  db: D1Database;
  rowsWritten(): number;
  rowsRead(): number;
  reset(): void;
}

export function countingDb(db: D1Database): CountingDb {
  const c: Counters = { written: 0, read: 0 };
  const wrapper = {
    prepare: (sql: string) => new CountingStatement(db.prepare(sql), c),
    async batch(stmts: CountingStatement[]) {
      const out = await db.batch(stmts.map((s) => s.inner));
      for (const r of out) add(c, r.meta);
      return out;
    },
    exec: (q: string) => db.exec(q),
    dump: () => db.dump(),
    withSession: (...a: unknown[]) => (db.withSession as (...x: unknown[]) => unknown)(...a),
  };
  return {
    db: wrapper as unknown as D1Database,
    rowsWritten: () => c.written,
    rowsRead: () => c.read,
    reset() {
      c.written = 0;
      c.read = 0;
    },
  };
}

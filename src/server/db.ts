// GSLabIt fork: PostgreSQL (DATABASE_URL) instead of D1. Same query/get/run
// surface as @clawnify/db, and upstream's SQLite-dialect SQL (index.ts,
// schema.sql) is translated here, so those files stay untouched and upstream
// merges stay clean. If upstream adds SQL the rules below miss, Postgres
// rejects it loudly — extend `toPg`.
import fs from "node:fs";
import pg from "pg";

pg.types.setTypeParser(20, Number); // COUNT()/bigint arrive as strings otherwise
pg.types.setTypeParser(1700, Number); // numeric (SUM of ints)

const NOW = "to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')";
const day = (mod?: string) =>
  `to_char(current_date${mod ? ` + interval '${mod.replace(/['"]/g, "")}'` : ""}, 'YYYY-MM-DD')`;

/** SQLite dialect → Postgres: only what upstream's SQL actually uses. */
export function toPg(sql: string): string {
  let i = 0;
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "SERIAL PRIMARY KEY")
    .replace(/\bREAL\b/g, "DOUBLE PRECISION")
    .replace(/\(datetime\('now'\)\)/g, `(${NOW})`)
    .replace(/datetime\('now'\)/g, NOW)
    .replace(/date\('now',\s*'([^']*)'\)/g, (_m, mod) => day(mod))
    .replace(/date\('now'\)/g, day())
    .replace(/\bLIKE\b/g, "ILIKE")
    .replace(/INSERT OR IGNORE INTO ([\s\S]*?\))\s*VALUES([\s\S]*)$/i, "INSERT INTO $1 VALUES$2 ON CONFLICT DO NOTHING")
    .replace(/\?/g, () => `$${++i}`);
}

let pool: pg.Pool | null = null;
let ready: Promise<unknown> | null = null;

export function initDB(_env?: unknown): void {
  if (pool) return;
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  ready = (async () => {
    for (const f of ["./schema.sql", "./schema-it.sql"]) {
      await pool!.query(toPg(fs.readFileSync(new URL(f, import.meta.url), "utf8")));
    }
  })();
}

async function exec(sql: string, params: unknown[]) {
  initDB();
  await ready;
  return pool!.query(toPg(sql), params);
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await exec(sql, params)).rows as T[];
}

export async function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  return ((await exec(sql, params)).rows[0] as T | undefined) ?? null;
}

export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  // Tables with a serial `id` give SQLite's lastInsertRowid; these keyed tables have none.
  const ret = /^\s*INSERT INTO (?!(?:settings|lease_it|unit_it|foi_index)\b)/i.test(sql) && !/RETURNING/i.test(sql) ? " RETURNING id" : "";
  const r = await exec(sql + ret, params);
  return { changes: r.rowCount ?? 0, lastInsertRowid: Number(r.rows[0]?.id ?? 0) };
}

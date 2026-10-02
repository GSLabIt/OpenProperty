// Italian-specific API, mounted next to upstream's routes (see node.ts).
import { Hono } from "hono";
import { z } from "zod";
import { get, query, run } from "./db";
import {
  addDaysIso, addMonthsIso, foiVariation, imuAnnual, imuRateFor, istatNewRent, istatPct, leaseDeadlines, parseCfg, parseFoiText,
  type Deadline, type FoiIndex, type LeaseFacts,
} from "./it-fiscal";

const app = new Hono();

async function loadFoi(): Promise<FoiIndex> {
  const rows = await query<{ month: string; value: number }>("SELECT month, value FROM foi_index");
  return Object.fromEntries(rows.map((r) => [r.month, r.value]));
}

async function saveFoi(index: FoiIndex): Promise<number> {
  const entries = Object.entries(index);
  for (const [month, value] of entries) {
    await run("INSERT INTO foi_index (month, value) VALUES (?, ?) ON CONFLICT (month) DO UPDATE SET value = excluded.value", [month, value]);
  }
  return entries.length;
}

/** Fetch monthly FOI indices from the configured CSV URL. Returns the number of months stored. */
export async function refreshFoi(): Promise<number> {
  const { foiUrl } = await loadCfg();
  if (!foiUrl) return 0;
  if (!/^https:\/\//i.test(foiUrl)) throw new Error("FOI URL must be https");
  const res = await fetch(foiUrl, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`FOI source answered ${res.status}`);
  return saveFoi(parseFoiText(await res.text()));
}

async function loadCfg() {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key LIKE 'it_%'");
  return parseCfg(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

const today = () => new Date().toISOString().slice(0, 10);
const intParam = (v: string | undefined) => (v && /^\d+$/.test(v) ? parseInt(v, 10) : null);

app.get("/api/it/foi", async (c) => {
  const index = await loadFoi();
  return c.json({ index, text: Object.keys(index).sort().map((m) => `${m}|${index[m]}`).join("\n") });
});

app.put("/api/it/foi", async (c) => {
  const b = z.object({ text: z.string().max(200_000) }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "Invalid body" }, 400);
  return c.json({ stored: await saveFoi(parseFoiText(b.data.text)) });
});

app.post("/api/it/foi/refresh", async (c) => {
  try {
    return c.json({ stored: await refreshFoi() });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

app.get("/api/it/config", async (c) => c.json(await loadCfg()));

// ── Lease fiscal data ───────────────────────────────────────────────
const LeaseIt = z.object({
  contract_type: z.string().max(100).nullable().optional(),
  tax_regime: z.enum(["irpef", "cedolare_21", "cedolare_10"]).optional(),
  registration_tax_mode: z.enum(["annual", "full_term"]).optional(),
  payment_method: z.string().max(100).nullable().optional(),
  registration_date: z.string().nullable().optional(),
  registration_number: z.string().max(100).nullable().optional(),
  istat_mode: z.string().max(100).nullable().optional(),
  istat_last_adjust: z.string().nullable().optional(),
});

app.get("/api/it/lease/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);
  const row = await get("SELECT * FROM lease_it WHERE lease_id = ?", [id]);
  return c.json({ lease_it: row ?? { lease_id: id, tax_regime: "irpef", registration_tax_mode: "annual" } });
});

app.put("/api/it/lease/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);
  if (!(await get("SELECT id FROM leases WHERE id = ?", [id]))) return c.json({ error: "Not found" }, 404);
  const parsed = LeaseIt.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
  const d = parsed.data;
  await run(
    `INSERT INTO lease_it (lease_id, contract_type, tax_regime, registration_tax_mode, payment_method, registration_date, registration_number, istat_mode, istat_last_adjust)
     VALUES (?, ?, COALESCE(?, 'irpef'), COALESCE(?, 'annual'), ?, ?, ?, ?, ?)
     ON CONFLICT (lease_id) DO UPDATE SET contract_type = excluded.contract_type, tax_regime = excluded.tax_regime,
       registration_tax_mode = excluded.registration_tax_mode, payment_method = excluded.payment_method,
       registration_date = excluded.registration_date, registration_number = excluded.registration_number,
       istat_mode = excluded.istat_mode, istat_last_adjust = excluded.istat_last_adjust`,
    [id, d.contract_type ?? null, d.tax_regime ?? null, d.registration_tax_mode ?? null, d.payment_method ?? null,
     d.registration_date || null, d.registration_number ?? null, d.istat_mode ?? null, d.istat_last_adjust || null],
  );
  return c.json({ lease_it: await get("SELECT * FROM lease_it WHERE lease_id = ?", [id]) });
});

// ── Unit cadastral data ─────────────────────────────────────────────
const UnitIt = z.object({
  cadastral_category: z.string().max(20).nullable().optional(),
  cadastral_income: z.number().min(0).nullable().optional(),
  cadastral_ref: z.string().max(200).nullable().optional(),
  ownership_pct: z.number().min(0).max(100).optional(),
  imu_exempt: z.boolean().optional(),
});

app.get("/api/it/unit/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);
  const row = await get("SELECT * FROM unit_it WHERE unit_id = ?", [id]);
  return c.json({ unit_it: row ?? { unit_id: id, ownership_pct: 100, imu_exempt: 0 } });
});

app.put("/api/it/unit/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid id" }, 400);
  if (!(await get("SELECT id FROM units WHERE id = ?", [id]))) return c.json({ error: "Not found" }, 404);
  const parsed = UnitIt.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
  const d = parsed.data;
  await run(
    `INSERT INTO unit_it (unit_id, cadastral_category, cadastral_income, cadastral_ref, ownership_pct, imu_exempt)
     VALUES (?, ?, ?, ?, COALESCE(?, 100), ?)
     ON CONFLICT (unit_id) DO UPDATE SET cadastral_category = excluded.cadastral_category, cadastral_income = excluded.cadastral_income,
       cadastral_ref = excluded.cadastral_ref, ownership_pct = excluded.ownership_pct, imu_exempt = excluded.imu_exempt`,
    [id, d.cadastral_category ?? null, d.cadastral_income ?? null, d.cadastral_ref ?? null, d.ownership_pct ?? null, d.imu_exempt ? 1 : 0],
  );
  return c.json({ unit_it: await get("SELECT * FROM unit_it WHERE unit_id = ?", [id]) });
});

// ── Aggregates ──────────────────────────────────────────────────────
const FACTS_SQL = `
  SELECT l.id AS lease_id, p.name || ' · ' || u.name AS label, l.start_date, l.end_date, l.monthly_rent, l.status,
         i.contract_type, i.tax_regime, i.registration_tax_mode, i.registration_date, i.istat_mode, i.istat_last_adjust
  FROM leases l
  JOIN units u ON u.id = l.unit_id
  JOIN properties p ON p.id = u.property_id
  LEFT JOIN lease_it i ON i.lease_id = l.id
  WHERE l.status IN ('active', 'upcoming')`;

type Facts = LeaseFacts & { istat_last_adjust: string | null };

async function imuRows(year: number) {
  const cfg = await loadCfg();
  const rows = await query<{
    unit_id: number; label: string; cadastral_category: string; cadastral_income: number;
    ownership_pct: number; contract_type: string | null;
  }>(
    `SELECT u.id AS unit_id, p.name || ' · ' || u.name AS label, x.cadastral_category, x.cadastral_income, x.ownership_pct,
       (SELECT i.contract_type FROM leases l LEFT JOIN lease_it i ON i.lease_id = l.id
         WHERE l.unit_id = u.id AND l.status = 'active' ORDER BY l.start_date DESC LIMIT 1) AS contract_type
     FROM unit_it x JOIN units u ON u.id = x.unit_id JOIN properties p ON p.id = u.property_id
     WHERE x.imu_exempt = 0 AND x.cadastral_category IS NOT NULL AND x.cadastral_income IS NOT NULL
     ORDER BY p.name, u.name`,
  );
  const items = rows.map((r) => {
    const annual = imuAnnual({
      category: r.cadastral_category, income: r.cadastral_income, ratePermille: imuRateFor(r.cadastral_category, cfg),
      ownershipPct: r.ownership_pct, concordato: /concordat/i.test(r.contract_type ?? ""),
    });
    return { ...r, rate_permille: imuRateFor(r.cadastral_category, cfg), annual, acconto: annual === null ? null : Math.round(annual * 50) / 100, saldo: annual === null ? null : Math.round((annual - Math.round(annual * 50) / 100) * 100) / 100 };
  });
  return { year, rate_permille: cfg.imuRatePermille, items, total: Math.round(items.reduce((s, i) => s + (i.annual ?? 0), 0) * 100) / 100 };
}

app.get("/api/it/imu", async (c) => c.json(await imuRows(intParam(c.req.query("year")) ?? new Date().getFullYear())));

app.get("/api/it/deadlines", async (c) => {
  const cfg = await loadCfg();
  const from = c.req.query("from") ?? addDaysIso(today(), -30);
  const to = c.req.query("to") ?? addDaysIso(today(), 120);
  const out: Deadline[] = [];
  for (const f of await query<Facts>(FACTS_SQL)) out.push(...leaseDeadlines(f, cfg));
  // IMU: 16 June (acconto) and 16 December (saldo)
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const imu = await imuRows(y);
    if (imu.total > 0) {
      out.push({ date: `${y}-06-16`, kind: "imu_acconto", lease_id: null, label: "IMU", amount: Math.round(imu.total * 50) / 100 });
      out.push({ date: `${y}-12-16`, kind: "imu_saldo", lease_id: null, label: "IMU", amount: Math.round((imu.total - Math.round(imu.total * 50) / 100) * 100) / 100 });
    }
  }
  const res = out.filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  return c.json({ from, to, deadlines: res });
});

app.get("/api/it/istat", async (c) => {
  const cfg = await loadCfg();
  const horizon = addDaysIso(today(), 60);
  const index = await loadFoi();
  const items = [];
  for (const f of await query<Facts>(FACTS_SQL)) {
    if (f.status !== "active") continue;
    const mode = cfg.istatModes.find((m) => m.label === f.istat_mode);
    const pct = istatPct(f.tax_regime, mode?.pct ?? 0);
    // next anniversary after the last applied adjustment (or the start)
    const anchor = f.istat_last_adjust ?? f.start_date;
    let due = addMonthsIso(anchor, 12);
    while (due < f.start_date) due = addMonthsIso(due, 12);
    if (pct === 0 || due > horizon || due >= f.end_date) continue;
    // Per-lease variation from the monthly index when available, else the manual yearly figure.
    const fromIndex = foiVariation(index, due);
    const foi = fromIndex ?? cfg.foiVariation;
    const { delta, newRent } = istatNewRent(f.monthly_rent, foi, pct);
    items.push({ lease_id: f.lease_id, label: f.label, due, monthly_rent: f.monthly_rent, pct, foi, foi_source: fromIndex === null ? "manual" : "index", delta, new_rent: newRent });
  }
  return c.json({ foi: cfg.foiVariation, items: items.sort((a, b) => a.due.localeCompare(b.due)) });
});

// Apply: update the lease rent and remember the adjustment date.
app.post("/api/it/istat/:leaseId/apply", async (c) => {
  const id = intParam(c.req.param("leaseId"));
  if (!id) return c.json({ error: "Invalid id" }, 400);
  const body = z.object({ new_rent: z.number().min(0), date: z.string() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  const r = await run("UPDATE leases SET monthly_rent = ? WHERE id = ?", [body.data.new_rent, id]);
  if (!r.changes) return c.json({ error: "Not found" }, 404);
  await run(
    `INSERT INTO lease_it (lease_id, istat_last_adjust) VALUES (?, ?)
     ON CONFLICT (lease_id) DO UPDATE SET istat_last_adjust = excluded.istat_last_adjust`,
    [id, body.data.date],
  );
  return c.json({ ok: true });
});

export default app;

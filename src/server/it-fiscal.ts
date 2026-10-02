// Italian rental rules as pure functions (no I/O) so they are easy to check.
// Simplifications are marked `ponytail:`; validate against a real contract before trusting amounts.

export type IstatMode = { label: string; pct: number };
export type ImuRate = { comune: string; uso: string; key: string; permille: number };
export type Cfg = {
  contractTypes: string[];
  paymentMethods: string[];
  istatModes: IstatMode[];
  foiVariation: number; // % annual FOI variation, updated by hand in settings
  imuRatePermille: number; // default municipal rate, per mille
  imuRates: ImuRate[]; // most specific match wins (comune > use > category)
  foiUrl: string; // optional CSV source for monthly FOI indices
};

export const DEFAULT_CFG_RAW: Record<string, string> = {
  it_contract_types: "4+4 (libero)\n3+2 (concordato)\nTransitorio\nUso commerciale 6+6\nStudenti universitari",
  it_payment_methods: "Bonifico bancario\nContanti\nAssegno\nRID/SEPA",
  it_istat_modes: "75%|75\n100%|100\nRinunciata|0",
  it_foi_variation: "0",
  it_imu_rate: "10.6",
  it_imu_rates: "",
  it_foi_url: "",
};

export const parseList = (s: string): string[] =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);

const norm = (x: string) => x.toUpperCase().replace(/\s/g, "");

/** 'Category|permille' or 'Comune|Use|Category|permille' ('*' = any). */
export function parseImuRate(line: string): ImuRate | null {
  const f = line.split("|").map((x) => x.trim());
  const [comune, uso, key, pm] = f.length === 2 ? ["*", "*", f[0], f[1]] : f.length === 4 ? f : ["", "", "", ""];
  const permille = Number(pm);
  if (!key || !Number.isFinite(permille)) return null;
  return { comune: norm(comune) || "*", uso: uso || "*", key: norm(key), permille };
}

export function parseCfg(raw: Record<string, string>): Cfg {
  const g = (k: string) => raw[k] ?? DEFAULT_CFG_RAW[k];
  return {
    contractTypes: parseList(g("it_contract_types")),
    paymentMethods: parseList(g("it_payment_methods")),
    istatModes: parseList(g("it_istat_modes")).map((l) => {
      const [label, pct] = l.split("|");
      return { label: label.trim(), pct: Number(pct) || 0 };
    }),
    foiVariation: Number(g("it_foi_variation")) || 0,
    imuRatePermille: Number(g("it_imu_rate")) || 0,
    imuRates: parseList(g("it_imu_rates")).map(parseImuRate).filter((r): r is ImuRate => r !== null),
    foiUrl: g("it_foi_url").trim(),
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function addMonthsIso(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
}
export function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export const isCedolare = (regime: string | null | undefined) => !!regime && regime.startsWith("cedolare");

/** Cedolare secca requires waiving the ISTAT update: it is forced to 0 whatever the stored mode. */
export function istatPct(regime: string | null | undefined, modePct: number): number {
  return isCedolare(regime) ? 0 : modePct;
}

export function istatNewRent(rent: number, foiPct: number, modePct: number) {
  const delta = Math.round(rent * (foiPct / 100) * (modePct / 100) * 100) / 100;
  return { delta, newRent: Math.round((rent + delta) * 100) / 100 };
}

// ponytail: category multipliers hard-coded (art. 1 c. 745 L. 160/2019); extend if a category is missing.
export function imuMultiplier(category: string): number | null {
  const c = category.toUpperCase().replace(/\s/g, "");
  if (c === "A/10" || c === "D/5") return 80;
  if (c.startsWith("A/")) return 160;
  if (c.startsWith("B/")) return 140;
  if (c === "C/1") return 55;
  if (["C/2", "C/6", "C/7"].includes(c)) return 160;
  if (c.startsWith("C/")) return 140;
  if (c.startsWith("D/")) return 65;
  return null;
}

export const IMU_USES = ["abitazione_principale", "locata_libero", "locata_concordato", "disposizione", "comodato", "commerciale"] as const;
export type ImuUse = (typeof IMU_USES)[number];

/** Use when none is set explicitly: derived from the active lease's contract type. */
export function deriveImuUse(contractType: string | null | undefined, hasActiveLease: boolean): ImuUse {
  if (!hasActiveLease) return "disposizione";
  if (/concordat/i.test(contractType ?? "")) return "locata_concordato";
  if (/commercial/i.test(contractType ?? "")) return "commerciale";
  return "locata_libero";
}

/** Rate for (comune, use, category): the most specific configured row wins, else the default. */
export function imuRateFor(o: { comune?: string; uso?: string; category: string }, cfg: Pick<Cfg, "imuRates" | "imuRatePermille">): number {
  const com = norm(o.comune ?? "");
  const cat = norm(o.category);
  let best: { score: number; permille: number } | null = null;
  for (const r of cfg.imuRates) {
    if (r.comune !== "*" && r.comune !== com) continue;
    if (r.uso !== "*" && r.uso !== o.uso) continue;
    if (r.key !== "*" && !cat.startsWith(r.key)) continue;
    const score = (r.comune !== "*" ? 4 : 0) + (r.uso !== "*" ? 2 : 0) + (r.key !== "*" ? 1 + r.key.length / 100 : 0);
    if (!best || score > best.score) best = { score, permille: r.permille };
  }
  return best ? best.permille : cfg.imuRatePermille;
}

const LUXURY = ["A/1", "A/8", "A/9"];
const ABITAZIONE_PRINCIPALE_DEFAULT_PERMILLE = 5; // ponytail: statutory base rate; override with a configured row

/** Annual IMU for one unit. Main residence is exempt except A/1, A/8, A/9 (rate + 200 EUR deduction). */
export function imuUnit(o: {
  category: string; income: number; uso: ImuUse; comune?: string; ownershipPct?: number;
  cfg: Pick<Cfg, "imuRates" | "imuRatePermille">;
}): { annual: number | null; rate: number; exempt: boolean } {
  const m = imuMultiplier(o.category);
  const pct = (o.ownershipPct ?? 100) / 100;
  if (o.uso === "abitazione_principale" && !LUXURY.includes(norm(o.category))) return { annual: 0, rate: 0, exempt: true };
  let rate = imuRateFor({ comune: o.comune, uso: o.uso, category: o.category }, o.cfg);
  if (o.uso === "abitazione_principale" && !o.cfg.imuRates.some((r) => r.uso === "abitazione_principale")) rate = ABITAZIONE_PRINCIPALE_DEFAULT_PERMILLE;
  if (m === null) return { annual: null, rate, exempt: false };
  let tax = o.income * 1.05 * m * (rate / 1000) * pct;
  if (o.uso === "abitazione_principale") tax = Math.max(0, tax - 200 * pct);
  if (o.uso === "locata_concordato") tax *= 0.75; // 25% reduction for canone concordato
  return { annual: Math.round(tax * 100) / 100, rate, exempt: false };
}

/** FOI index series: month 'YYYY-MM' -> value. */
export type FoiIndex = Record<string, number>;

/** Parse lines like '2026-05|123.4' (also ';' ',' or tab). Extra columns are ignored, last numeric wins. */
export function parseFoiText(text: string): FoiIndex {
  const out: FoiIndex = {};
  for (const line of text.split("\n")) {
    const m = line.match(/(\d{4}-\d{2})(?:-\d{2})?\D+(\d+(?:[.,]\d+)?)\s*$/);
    if (m) out[m[1]] = Number(m[2].replace(",", "."));
  }
  return out;
}

/** ISTAT variation for an anniversary: index of the previous month vs the same month a year earlier (%). */
export function foiVariation(index: FoiIndex, anniversary: string): number | null {
  const cur = addMonthsIso(`${anniversary.slice(0, 7)}-01`, -1).slice(0, 7);
  const prev = addMonthsIso(`${cur}-01`, -12).slice(0, 7);
  if (!index[cur] || !index[prev]) return null;
  return Math.round((index[cur] / index[prev] - 1) * 10000) / 100;
}

/** Imposta di registro: 2% of the annual rent, minimum 67 EUR. ponytail: bollo not included. */
export const registrationTax = (monthlyRent: number) => Math.max(67, Math.round(monthlyRent * 12 * 2) / 100);

export type LeaseFacts = {
  lease_id: number; label: string; start_date: string; end_date: string;
  monthly_rent: number; status: string;
  contract_type: string | null; tax_regime: string | null; registration_tax_mode: string | null;
  registration_date: string | null; istat_mode: string | null;
};
export type Deadline = { date: string; kind: string; lease_id: number | null; label: string; amount?: number };

export function leaseDeadlines(l: LeaseFacts, cfg: Cfg): Deadline[] {
  if (l.status !== "active" && l.status !== "upcoming") return [];
  const out: Deadline[] = [];
  const add = (date: string, kind: string, amount?: number) =>
    out.push({ date, kind, lease_id: l.lease_id, label: l.label, amount });

  if (!l.registration_date) add(addDaysIso(l.start_date, 30), "registration");
  if (!isCedolare(l.tax_regime) && l.registration_tax_mode !== "full_term") {
    // yearly renewal tax, 30 days after each anniversary
    for (let y = 1; addMonthsIso(l.start_date, 12 * y) < l.end_date; y++) {
      add(addDaysIso(addMonthsIso(l.start_date, 12 * y), 30), "registration_renewal", registrationTax(l.monthly_rent));
    }
  }
  const mode = cfg.istatModes.find((m) => m.label === l.istat_mode);
  if (istatPct(l.tax_regime, mode?.pct ?? 0) > 0) {
    for (let y = 1; addMonthsIso(l.start_date, 12 * y) < l.end_date; y++) add(addMonthsIso(l.start_date, 12 * y), "istat");
  }
  if (!/transitor/i.test(l.contract_type ?? "")) add(addMonthsIso(l.end_date, -6), "notice"); // ponytail: 6 months for every type
  add(l.end_date, "lease_end");
  return out;
}

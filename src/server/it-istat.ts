// ISTAT SDMX source for the FOI (senza tabacchi) year-on-year variation.
// ISTAT allows 5 queries/minute per IP and blocks for 1-2 days beyond that: one request per dataflow, spaced out.
// Key = FREQ.REF_AREA.DATA_TYPE.MEASURE.COICOP: M = monthly, IT = Italy, MEASURE 7 = year-on-year %, 00ST = no tobacco.
// ponytail: ISTAT rebases every ~5 years; when 2031 brings a new base, add its dataflow here.
export const ISTAT_BASE = "https://esploradati.istat.it/SDMXWS/rest/data";

export type IstatFlow = { id: string; key: string; from: string; to?: string; once: boolean };
export const ISTAT_FLOWS: IstatFlow[] = [
  { id: "169_745_DF_DCSP_FOI1B2015_1", key: "M.IT.55.7.00ST", from: "2016-01", to: "2025-12", once: true }, // closed series
  { id: "169_748_DF_DCSP_FOI1B2025_1", key: "M.IT.101.7.00ST", from: "2026-01", once: false },
];

export function istatUrl(f: IstatFlow): string {
  const range = `startPeriod=${f.from}${f.to ? `&endPeriod=${f.to}` : ""}`;
  return `${ISTAT_BASE}/IT1,${f.id},1.0/${f.key}/ALL/?detail=full&${range}&dimensionAtObservation=TIME_PERIOD`;
}

/** SDMX-CSV -> { 'YYYY-MM': value }. Reads columns by header name, so extra columns do not matter. */
export function parseIstatCsv(text: string): Record<string, number> {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(",");
  const t = cols.indexOf("TIME_PERIOD");
  const v = cols.indexOf("OBS_VALUE");
  const out: Record<string, number> = {};
  if (t < 0 || v < 0) return out;
  for (const line of lines) {
    const f = line.split(",");
    const n = Number(f[v]);
    if (/^\d{4}-\d{2}$/.test(f[t] ?? "") && f[v] !== "" && Number.isFinite(n)) out[f[t]] = n;
  }
  return out;
}

export async function fetchIstatFlow(f: IstatFlow): Promise<Record<string, number>> {
  const res = await fetch(istatUrl(f), {
    // Accept-Language "*" (the Node default) makes ISTAT answer 500 "languageTag1"
    headers: { Accept: "application/vnd.sdmx.data+csv;version=1.0.0", "Accept-Language": "it" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`ISTAT answered ${res.status}`);
  return parseIstatCsv(await res.text());
}

import assert from "node:assert/strict";
import { landlordShare, addMonthsIso, foiVariation, imuUnit, deriveImuUse, imuRateFor, parseFoiText, istatNewRent, istatPct, leaseDeadlines, parseCfg, registrationTax } from "./it-fiscal";

// ISTAT: 1000 EUR, FOI 2.0%, 75% -> +15
assert.deepEqual(istatNewRent(1000, 2, 75), { delta: 15, newRent: 1015 });
assert.equal(istatPct("cedolare_21", 75), 0, "cedolare secca forces waiving ISTAT");
assert.equal(istatPct("irpef", 75), 75);
assert.equal(registrationTax(800), 192);
assert.equal(registrationTax(100), 67);
assert.equal(addMonthsIso("2026-01-31", 1), "2026-02-28");

const cfg = parseCfg({ it_foi_variation: "2" });
const base = {
  lease_id: 1, label: "x", start_date: "2026-01-01", end_date: "2030-01-01", monthly_rent: 800, status: "active",
  contract_type: "4+4", registration_tax_mode: "annual", registration_date: null,
};
const kinds = (r: ReturnType<typeof leaseDeadlines>) => r.map((d) => d.kind);
const irpef = leaseDeadlines({ ...base, tax_regime: "irpef", istat_mode: "75%" }, cfg);
assert.ok(kinds(irpef).includes("registration") && kinds(irpef).includes("registration_renewal") && kinds(irpef).includes("istat"));
const ced = leaseDeadlines({ ...base, tax_regime: "cedolare_21", istat_mode: "75%" }, cfg);
assert.ok(!kinds(ced).includes("registration_renewal") && !kinds(ced).includes("istat"), "cedolare: no yearly tax, no ISTAT");
assert.ok(kinds(ced).includes("notice") && kinds(ced).includes("lease_end"));
// IMU
const d = parseCfg({ it_imu_rate: "10.6" });
// A/2, rendita 500, 10.6 per mille: 500*1.05*160*0.0106 = 890.4; concordato -25% = 667.8
assert.equal(imuUnit({ category: "A/2", income: 500, uso: "locata_libero", cfg: d }).annual, 890.4);
assert.equal(imuUnit({ category: "A/2", income: 500, uso: "locata_concordato", cfg: d }).annual, 667.8);
assert.equal(imuUnit({ category: "X/9", income: 1, uso: "locata_libero", cfg: d }).annual, null);
// main residence: exempt, except A/1 A/8 A/9 (5 per mille, minus 200 deduction)
assert.deepEqual(imuUnit({ category: "A/2", income: 500, uso: "abitazione_principale", cfg: d }), { annual: 0, rate: 0, exempt: true });
assert.equal(imuUnit({ category: "A/8", income: 2000, uso: "abitazione_principale", cfg: d }).annual, 2000 * 1.05 * 160 * 0.005 - 200);
assert.equal(imuUnit({ category: "A/8", income: 2000, uso: "abitazione_principale", ownershipPct: 50, cfg: d }).annual, (2000 * 1.05 * 160 * 0.005 - 200) / 2);
assert.equal(registrationTax(800), 192);
assert.equal(registrationTax(100), 67);
assert.equal(addMonthsIso("2026-01-31", 1), "2026-02-28");
assert.equal(deriveImuUse("3+2 (concordato)", true), "locata_concordato");
assert.equal(deriveImuUse(null, true), "locata_libero");
assert.equal(deriveImuUse("4+4", false), "disposizione");
// Rates: comune > use > category; legacy 2-field rows still work
const rc = parseCfg({ it_imu_rate: "10.6", it_imu_rates: "C|9\nC/1|7.6\nBologna|locata_concordato|A|8.6\nBologna|*|A|10.1" });
const rate = (o: { comune?: string; uso?: string; category: string }) => imuRateFor(o, rc);
assert.equal(rate({ category: "C/1" }), 7.6);
assert.equal(rate({ category: "C/6" }), 9);
assert.equal(rate({ category: "A/2", comune: "Milano" }), 10.6);
assert.equal(rate({ category: "A/2", comune: "bologna", uso: "locata_libero" }), 10.1);
assert.equal(rate({ category: "A/2", comune: "Bologna", uso: "locata_concordato" }), 8.6);
assert.equal(rate({ category: "a / 10" }), 10.6);
// FOI: anniversary 2026-07-01 -> June 2026 vs June 2025
const idx = parseFoiText("2025-06;120.0\n2026-06;122,4\nnoise line");
assert.deepEqual(idx, { "2025-06": 120, "2026-06": 122.4 });
assert.equal(foiVariation(idx, "2026-07-01"), 2);
assert.equal(foiVariation(idx, "2027-07-01"), null);
// Registration tax split
assert.equal(landlordShare(200, "split"), 100);
assert.equal(landlordShare(200, "landlord"), 200);
assert.equal(landlordShare(200, "tenant"), 0);
const regs = leaseDeadlines({ ...base, tax_regime: "irpef", istat_mode: null, registration_tax_payer: "tenant" } as never, cfg);
assert.equal(regs[0].kind, "registration");
assert.equal(regs[0].amount, 192);
assert.equal(regs[0].landlord_share, 0);
console.log("it-fiscal ok");

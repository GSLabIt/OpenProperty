import assert from "node:assert/strict";
import { addMonthsIso, imuAnnual, istatNewRent, istatPct, leaseDeadlines, parseCfg, registrationTax } from "./it-fiscal";

// ISTAT: 1000 EUR, FOI 2.0%, 75% -> +15
assert.deepEqual(istatNewRent(1000, 2, 75), { delta: 15, newRent: 1015 });
assert.equal(istatPct("cedolare_21", 75), 0, "cedolare secca forces waiving ISTAT");
assert.equal(istatPct("irpef", 75), 75);
// IMU: A/2 rendita 500, 10.6 per mille -> 500*1.05*160*0.0106 = 890.4
assert.equal(imuAnnual({ category: "A/2", income: 500, ratePermille: 10.6 }), 890.4);
assert.equal(imuAnnual({ category: "A/2", income: 500, ratePermille: 10.6, concordato: true }), 667.8);
assert.equal(imuAnnual({ category: "X/9", income: 1, ratePermille: 1 }), null);
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
console.log("it-fiscal ok");

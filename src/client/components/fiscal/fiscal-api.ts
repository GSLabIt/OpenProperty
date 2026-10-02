import { useEffect, useState } from "react";
import { api } from "@/api";

export interface ItConfig {
  contractTypes: string[];
  paymentMethods: string[];
  istatModes: { label: string; pct: number }[];
  foiVariation: number;
  imuRatePermille: number;
}

export interface LeaseIt {
  contract_type: string | null;
  tax_regime: "irpef" | "cedolare_21" | "cedolare_10";
  registration_tax_mode: "annual" | "full_term";
  payment_method: string | null;
  registration_date: string | null;
  registration_number: string | null;
  istat_mode: string | null;
  istat_last_adjust: string | null;
}

export interface UnitIt {
  cadastral_category: string | null;
  cadastral_income: number | null;
  cadastral_ref: string | null;
  ownership_pct: number;
  imu_exempt: boolean;
}

export const EMPTY_LEASE_IT: LeaseIt = {
  contract_type: null, tax_regime: "irpef", registration_tax_mode: "annual", payment_method: null,
  registration_date: null, registration_number: null, istat_mode: null, istat_last_adjust: null,
};
export const EMPTY_UNIT_IT: UnitIt = {
  cadastral_category: null, cadastral_income: null, cadastral_ref: null, ownership_pct: 100, imu_exempt: false,
};

export function useItConfig(active = true): ItConfig | null {
  const [cfg, setCfg] = useState<ItConfig | null>(null);
  useEffect(() => {
    if (!active) return;
    api<ItConfig>("GET", "/api/it/config").then(setCfg).catch(() => setCfg(null));
  }, [active]);
  return cfg;
}

/** Loads the fiscal record next to a lease while the dialog is open; save() writes it back. */
export function useLeaseFiscal(open: boolean, leaseId?: number) {
  const [value, setValue] = useState<LeaseIt>(EMPTY_LEASE_IT);
  useEffect(() => {
    if (!open) return;
    setValue(EMPTY_LEASE_IT);
    if (!leaseId) return;
    api<{ lease_it: LeaseIt }>("GET", `/api/it/lease/${leaseId}`)
      .then((r) => setValue({ ...EMPTY_LEASE_IT, ...r.lease_it }))
      .catch(() => undefined);
  }, [open, leaseId]);
  const save = (id: number) => api("PUT", `/api/it/lease/${id}`, value);
  return { value, setValue, save };
}

export function useUnitFiscal(open: boolean, unitId?: number) {
  const [value, setValue] = useState<UnitIt>(EMPTY_UNIT_IT);
  useEffect(() => {
    if (!open) return;
    setValue(EMPTY_UNIT_IT);
    if (!unitId) return;
    api<{ unit_it: UnitIt & { imu_exempt: number | boolean } }>("GET", `/api/it/unit/${unitId}`)
      .then((r) => setValue({ ...EMPTY_UNIT_IT, ...r.unit_it, imu_exempt: !!r.unit_it.imu_exempt }))
      .catch(() => undefined);
  }, [open, unitId]);
  const save = (id: number) => api("PUT", `/api/it/unit/${id}`, value);
  return { value, setValue, save };
}

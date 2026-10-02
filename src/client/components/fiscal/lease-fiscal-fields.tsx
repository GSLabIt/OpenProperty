import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/i18n";
import { useItConfig, type LeaseIt } from "./fiscal-api";

const NONE = "__none__";

/** Select over a configurable list; keeps a stored value that is no longer in the list. */
function ListSelect({ value, options, onChange }: { value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function LeaseFiscalFields({ open, value, onChange }: { open: boolean; value: LeaseIt; onChange: (v: LeaseIt) => void }) {
  const cfg = useItConfig(open);
  const set = <K extends keyof LeaseIt>(k: K, v: LeaseIt[K]) => onChange({ ...value, [k]: v });
  const cedolare = value.tax_regime !== "irpef";
  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="section-label">{t("Fiscal data (Italy)")}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("Contract type")}</Label>
          <ListSelect value={value.contract_type} options={cfg?.contractTypes ?? []} onChange={(v) => set("contract_type", v)} />
        </div>
        <div>
          <Label>{t("Payment method")}</Label>
          <ListSelect value={value.payment_method} options={cfg?.paymentMethods ?? []} onChange={(v) => set("payment_method", v)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("Tax regime")}</Label>
          <Select value={value.tax_regime} onValueChange={(v) => set("tax_regime", v as LeaseIt["tax_regime"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="irpef">{t("Ordinary (IRPEF)")}</SelectItem>
              <SelectItem value="cedolare_21">{t("Cedolare secca 21%")}</SelectItem>
              <SelectItem value="cedolare_10">{t("Cedolare secca 10%")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("Registration tax")}</Label>
          <Select value={value.registration_tax_mode} onValueChange={(v) => set("registration_tax_mode", v as LeaseIt["registration_tax_mode"])} disabled={cedolare}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">{t("Paid every year")}</SelectItem>
              <SelectItem value="full_term">{t("Paid once for the whole term")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="l-regdate">{t("Registration date")}</Label>
          <Input id="l-regdate" type="date" value={value.registration_date ?? ""} onChange={(e) => set("registration_date", e.target.value || null)} />
        </div>
        <div>
          <Label htmlFor="l-regnum">{t("Registration number")}</Label>
          <Input id="l-regnum" value={value.registration_number ?? ""} onChange={(e) => set("registration_number", e.target.value || null)} />
        </div>
      </div>
      <div>
        <Label>{t("ISTAT update")}</Label>
        <ListSelect value={value.istat_mode} options={(cfg?.istatModes ?? []).map((m) => m.label)} onChange={(v) => set("istat_mode", v)} />
        {cedolare && (
          <p className="mt-1 text-xs text-muted-foreground">{t("With cedolare secca the ISTAT update must be waived: it is ignored.")}</p>
        )}
      </div>
    </div>
  );
}

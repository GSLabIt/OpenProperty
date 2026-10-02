import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/i18n";
import type { UnitIt } from "./fiscal-api";

const AUTO = "__auto__";
const USES = ["abitazione_principale", "locata_libero", "locata_concordato", "disposizione", "comodato", "commerciale"];

export function UnitFiscalFields({ value, onChange }: { value: UnitIt; onChange: (v: UnitIt) => void }) {
  const set = <K extends keyof UnitIt>(k: K, v: UnitIt[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="section-label">{t("Cadastral data (IMU)")}</div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="u-cat">{t("Category")}</Label>
          <Input id="u-cat" value={value.cadastral_category ?? ""} placeholder="A/2" onChange={(e) => set("cadastral_category", e.target.value || null)} />
        </div>
        <div>
          <Label htmlFor="u-inc">{t("Cadastral income")}</Label>
          <Input id="u-inc" type="number" step="0.01" value={value.cadastral_income ?? ""} onChange={(e) => set("cadastral_income", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
        <div>
          <Label htmlFor="u-own">{t("Ownership %")}</Label>
          <Input id="u-own" type="number" min={0} max={100} value={value.ownership_pct} onChange={(e) => set("ownership_pct", parseFloat(e.target.value) || 0)} />
        </div>
      </div>
      <div>
        <Label htmlFor="u-ref">{t("Cadastral reference")}</Label>
        <Input id="u-ref" value={value.cadastral_ref ?? ""} placeholder={t("Sheet / parcel / sub")} onChange={(e) => set("cadastral_ref", e.target.value || null)} />
      </div>
      <div>
        <Label>{t("Use for IMU")}</Label>
        <Select value={value.imu_use ?? AUTO} onValueChange={(v) => set("imu_use", v === AUTO ? null : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{t("Automatic (from the active lease)")}</SelectItem>
            {USES.map((u) => <SelectItem key={u} value={u}>{t(u)}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">{t("The municipality is the property's city; rates are set in Settings → Fiscal.")}</p>
      </div>
    </div>
  );
}

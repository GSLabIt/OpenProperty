import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";
import type { UnitIt } from "./fiscal-api";

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
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.imu_exempt} onChange={(e) => set("imu_exempt", e.target.checked)} />
        {t("Exempt from IMU (e.g. main residence)")}
      </label>
    </div>
  );
}

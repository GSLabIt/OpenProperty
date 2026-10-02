import { useEffect, useState } from "react";
import { api } from "@/api";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";

const KEYS = ["it_contract_types", "it_payment_methods", "it_istat_modes", "it_foi_variation", "it_imu_rate"] as const;
const DEFAULTS: Record<string, string> = {
  it_contract_types: "4+4 (libero)\n3+2 (concordato)\nTransitorio\nUso commerciale 6+6\nStudenti universitari",
  it_payment_methods: "Bonifico bancario\nContanti\nAssegno\nRID/SEPA",
  it_istat_modes: "75%|75\n100%|100\nRinunciata|0",
  it_foi_variation: "0",
  it_imu_rate: "10.6",
};

export function FiscalSettingsTab() {
  const { setError } = useApp();
  const [v, setV] = useState<Record<string, string>>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ settings: Record<string, string> }>("GET", "/api/settings")
      .then((r) => setV(Object.fromEntries(KEYS.map((k) => [k, r.settings[k] ?? DEFAULTS[k]]))))
      .catch((e) => setError((e as Error).message));
  }, [setError]);

  async function save() {
    setSaving(true);
    try {
      await api("PUT", "/api/settings", v);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const area = (k: string, label: string, hint: string) => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      <Textarea id={k} rows={5} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <Card className="grid gap-4 p-6">
      {area("it_contract_types", t("Contract types"), t("One per line. Add your own."))}
      {area("it_payment_methods", t("Payment methods"), t("One per line. Add your own."))}
      {area("it_istat_modes", t("ISTAT modes"), t("One per line as Label|percent, e.g. 75%|75. Percent of the FOI variation applied."))}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="it_foi_variation">{t("FOI variation (%)")}</Label>
          <Input id="it_foi_variation" type="number" step="0.1" value={v.it_foi_variation} onChange={(e) => setV({ ...v, it_foi_variation: e.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">{t("Annual ISTAT FOI variation. Update it by hand when ISTAT publishes it.")}</p>
        </div>
        <div>
          <Label htmlFor="it_imu_rate">{t("IMU rate (‰)")}</Label>
          <Input id="it_imu_rate" type="number" step="0.1" value={v.it_imu_rate} onChange={(e) => setV({ ...v, it_imu_rate: e.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">{t("Your municipality's rate for rented homes, per mille.")}</p>
        </div>
      </div>
      <div><Button onClick={save} disabled={saving}>{t("Save settings")}</Button></div>
    </Card>
  );
}

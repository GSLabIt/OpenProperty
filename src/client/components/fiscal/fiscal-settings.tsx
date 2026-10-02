import { useEffect, useState } from "react";
import { api } from "@/api";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";

const KEYS = ["it_contract_types", "it_payment_methods", "it_istat_modes", "it_foi_variation", "it_imu_rate", "it_imu_rates", "it_foi_url"] as const;
const DEFAULTS: Record<string, string> = {
  it_contract_types: "4+4 (libero)\n3+2 (concordato)\nTransitorio\nUso commerciale 6+6\nStudenti universitari",
  it_payment_methods: "Bonifico bancario\nContanti\nAssegno\nRID/SEPA",
  it_istat_modes: "75%|75\n100%|100\nRinunciata|0",
  it_foi_variation: "0",
  it_imu_rate: "10.6",
  it_imu_rates: "",
  it_foi_url: "",
};

export function FiscalSettingsTab() {
  const { setError } = useApp();
  const [v, setV] = useState<Record<string, string>>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [foiText, setFoiText] = useState("");
  const [foiMsg, setFoiMsg] = useState<string | null>(null);

  useEffect(() => {
    api<{ settings: Record<string, string> }>("GET", "/api/settings")
      .then((r) => setV(Object.fromEntries(KEYS.map((k) => [k, r.settings[k] ?? DEFAULTS[k]]))))
      .catch((e) => setError((e as Error).message));
    api<{ text: string }>("GET", "/api/it/foi").then((r) => setFoiText(r.text)).catch(() => undefined);
  }, [setError]);

  async function save() {
    setSaving(true);
    try {
      await api("PUT", "/api/settings", v);
      const r = await api<{ stored: number }>("PUT", "/api/it/foi", { text: foiText });
      setFoiMsg(t("{n} monthly indices stored.", { n: r.stored }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    setFoiMsg(null);
    try {
      await api("PUT", "/api/settings", v); // the URL may have just been edited
      const r = await api<{ stored: number }>("POST", "/api/it/foi/refresh");
      setFoiMsg(t("{n} monthly indices stored.", { n: r.stored }));
      setFoiText((await api<{ text: string }>("GET", "/api/it/foi")).text);
    } catch (e) {
      setFoiMsg((e as Error).message);
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
      {area("it_imu_rates", t("IMU rates"), t("One per line as Municipality|Use|Category|permille, e.g. Bologna|locata_concordato|A|8.6; use * for any. Short form Category|permille also works. The most specific row wins; otherwise the default rate above. Uses: abitazione_principale, locata_libero, locata_concordato, disposizione, comodato, commerciale."))}
      <div>
        <Label htmlFor="it_foi_url">{t("FOI source URL (CSV, https)")}</Label>
        <Input id="it_foi_url" value={v.it_foi_url} placeholder="https://…" onChange={(e) => setV({ ...v, it_foi_url: e.target.value })} />
        <p className="mt-1 text-xs text-muted-foreground">{t("Optional. Leave empty to use ISTAT directly (daily). Otherwise a CSV with lines of month (YYYY-MM) and index value.")}</p>
      </div>
      <div>
        <Label htmlFor="foi_text">{t("Monthly FOI indices")}</Label>
        <Textarea id="foi_text" rows={6} value={foiText} placeholder="2026-05|123.4" onChange={(e) => setFoiText(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">{t("One per line as YYYY-MM|index. With the indices, ISTAT is computed per contract anniversary instead of using the yearly figure above.")}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{t("Save settings")}</Button>
        <Button variant="outline" onClick={refresh} >{t("Refresh FOI now")}</Button>
        {foiMsg && <span className="text-sm text-muted-foreground">{foiMsg}</span>}
      </div>
    </Card>
  );
}

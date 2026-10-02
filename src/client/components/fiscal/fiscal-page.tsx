import { useEffect, useState } from "react";
import { api } from "@/api";
import { useApp } from "@/context";
import { formatDate, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell } from "@/components/page-shell";
import { t } from "@/i18n";

interface Deadline { date: string; kind: string; lease_id: number | null; label: string; amount?: number }
interface IstatItem { lease_id: number; label: string; due: string; monthly_rent: number; pct: number; foi: number; foi_source: string; delta: number; new_rent: number }
interface ImuItem { unit_id: number; label: string; comune: string | null; uso: string; uso_derived: boolean; exempt: boolean; cadastral_category: string; cadastral_income: number; rate_permille: number; annual: number | null; acconto: number | null; saldo: number | null }

const KIND: Record<string, string> = {
  registration: "Contract registration",
  registration_renewal: "Registration tax (yearly)",
  istat: "ISTAT update",
  notice: "Notice deadline",
  lease_end: "Lease end",
  imu_acconto: "IMU advance",
  imu_saldo: "IMU balance",
};

export function FiscalPage() {
  return (
    <PageShell title={t("Fiscal")} meta={t("Deadlines, ISTAT and IMU")} width="max-w-5xl">
      <Tabs defaultValue="deadlines">
        <TabsList>
          <TabsTrigger value="deadlines">{t("Deadlines")}</TabsTrigger>
          <TabsTrigger value="istat">{t("ISTAT")}</TabsTrigger>
          <TabsTrigger value="imu">{t("IMU")}</TabsTrigger>
        </TabsList>
        <TabsContent value="deadlines" className="mt-4"><DeadlinesTab /></TabsContent>
        <TabsContent value="istat" className="mt-4"><IstatTab /></TabsContent>
        <TabsContent value="imu" className="mt-4"><ImuTab /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

function useLoad<T>(path: string) {
  const { setError } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    api<T>("GET", path).then(setData).catch((e) => setError((e as Error).message));
  }, [path, n, setError]);
  return { data, reload: () => setN((x) => x + 1) };
}

function DeadlinesTab() {
  const { settings } = useApp();
  const { data } = useLoad<{ deadlines: Deadline[] }>("/api/it/deadlines");
  const today = new Date().toISOString().slice(0, 10);
  if (!data) return <Card className="p-8 text-center text-sm text-muted-foreground">{t("Loading…")}</Card>;
  if (data.deadlines.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">{t("No deadlines in the next 120 days.")}</Card>;
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Date")}</TableHead><TableHead>{t("Deadline")}</TableHead>
            <TableHead>{t("Lease")}</TableHead><TableHead className="text-right">{t("Amount")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.deadlines.map((d, i) => (
            <TableRow key={i}>
              <TableCell className={d.date < today ? "font-medium text-destructive" : ""}>{formatDate(d.date)}</TableCell>
              <TableCell>{t(KIND[d.kind] ?? d.kind)}</TableCell>
              <TableCell className="text-muted-foreground">{d.lease_id ? d.label : ""}</TableCell>
              <TableCell className="text-right tabular-nums">{d.amount != null ? formatMoney(d.amount, settings.currency) : ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function IstatTab() {
  const { settings, setError } = useApp();
  const { data, reload } = useLoad<{ foi: number; items: IstatItem[] }>("/api/it/istat");
  async function apply(i: IstatItem) {
    try {
      await api("POST", `/api/it/istat/${i.lease_id}/apply`, { new_rent: i.new_rent, date: i.due });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data) return <Card className="p-8 text-center text-sm text-muted-foreground">{t("Loading…")}</Card>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("FOI per contract from the monthly indices; * = yearly figure from Settings → Fiscal ({foi}%). Applying updates the lease rent.", { foi: data.foi })}
      </p>
      {data.items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t("No ISTAT updates due in the next 60 days.")}</Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Lease")}</TableHead><TableHead>{t("Due")}</TableHead>
                <TableHead className="text-right">{t("Current rent")}</TableHead>
                <TableHead className="text-right">{t("New rent")}</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i) => (
                <TableRow key={i.lease_id}>
                  <TableCell>{i.label}</TableCell>
                  <TableCell>{formatDate(i.due)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(i.monthly_rent, settings.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatMoney(i.new_rent, settings.currency)} <span className="text-xs text-muted-foreground">(+{i.delta.toFixed(2)} · FOI {i.foi}%{i.foi_source === "manual" ? "*" : ""})</span>
                  </TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => apply(i)}>{t("Apply")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function ImuTab() {
  const { settings } = useApp();
  const { data } = useLoad<{ year: number; total: number; items: ImuItem[] }>("/api/it/imu");
  if (!data) return <Card className="p-8 text-center text-sm text-muted-foreground">{t("Loading…")}</Card>;
  if (data.items.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">{t("No units with cadastral data. Add category and income in a unit.")}</Card>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("IMU {year}. Rates by municipality (the property city), use and category from Settings → Fiscal; canone concordato: 25% reduction.", { year: data.year })}
      </p>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Unit")}</TableHead><TableHead>{t("Municipality")}</TableHead><TableHead>{t("Use")}</TableHead><TableHead>{t("Category")}</TableHead>
              <TableHead className="text-right">{t("Cadastral income")}</TableHead>
              <TableHead className="text-right">{t("Rate")}</TableHead>
              <TableHead className="text-right">{t("Advance (16 Jun)")}</TableHead>
              <TableHead className="text-right">{t("Balance (16 Dec)")}</TableHead>
              <TableHead className="text-right">{t("Annual")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((i) => (
              <TableRow key={i.unit_id}>
                <TableCell>{i.label}</TableCell>
                <TableCell>{i.comune ?? "—"}</TableCell>
                <TableCell>{t(i.uso)}{i.uso_derived ? " *" : ""}</TableCell>
                <TableCell>{i.cadastral_category}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(i.cadastral_income, settings.currency)}</TableCell>
                <TableCell className="text-right tabular-nums">{i.exempt ? "—" : `${i.rate_permille}‰`}</TableCell>
                <TableCell className="text-right tabular-nums">{i.acconto != null ? formatMoney(i.acconto, settings.currency) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{i.saldo != null ? formatMoney(i.saldo, settings.currency) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{i.exempt ? t("Exempt") : i.annual != null ? formatMoney(i.annual, settings.currency) : t("Unknown category")}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={8} className="text-right font-medium">{t("Total")}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{formatMoney(data.total, settings.currency)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

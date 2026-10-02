import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Plus, Search, User } from "lucide-react";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenantDialog } from "./tenant-dialog";
import type { Tenant } from "@/types";
import { PageShell } from "@/components/page-shell";
import { t } from "@/i18n";

export function TenantsList({ navigate }: { navigate: (to: string) => void }) {
  const app = useApp();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const list = await app.listTenants();
      setTenants(list);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return tenants;
    const needle = q.toLowerCase();
    return tenants.filter((tn) =>
      `${tn.first_name} ${tn.last_name} ${tn.email ?? ""} ${tn.phone ?? ""} ${tn.active_property_name ?? ""} ${tn.active_unit_name ?? ""}`.toLowerCase().includes(needle),
    );
  }, [tenants, q]);

  return (
    <PageShell
      title={t("Tenants")}
      meta={t(tenants.length === 1 ? "{n} record" : "{n} records", { n: tenants.length })}
      actions={
        tenants.length > 0 ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> {t("New tenant")}
          </Button>
        ) : null
      }
      width="max-w-6xl"
    >

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("Search by name, email, phone, property, or unit")}
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{t("Loading…")}</Card>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <User className="size-7 text-faint" aria-hidden />
            <p className="font-medium">{tenants.length === 0 ? t("No tenants yet") : t("No matches")}</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{tenants.length === 0 ? t("Add a tenant to start signing leases.") : t("Try a different search.")}</p>
            {tenants.length === 0 && (
              <Button className="mt-2" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> {t("New tenant")}
              </Button>
            )}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Name")}</TableHead>
                  <TableHead>{t("Active unit")}</TableHead>
                  <TableHead>{t("Email")}</TableHead>
                  <TableHead>{t("Phone")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tn) => (
                  <TableRow key={tn.id} className="cursor-pointer" onClick={() => navigate(`/tenants/${tn.id}`)}>
                    <TableCell className="font-medium">
                      {tn.first_name} {tn.last_name}
                    </TableCell>
                    <TableCell>
                      {tn.active_unit_name ? (
                        <span className="text-sm">
                          {tn.active_property_name && <span className="text-muted-foreground">{tn.active_property_name} · </span>}
                          {tn.active_unit_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tn.email ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" /> {tn.email}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {tn.phone ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" /> {tn.phone}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

      <TenantDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) load(); }} />
    </PageShell>
  );
}

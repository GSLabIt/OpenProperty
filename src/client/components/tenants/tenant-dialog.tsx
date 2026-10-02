import { useEffect, useState } from "react";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tenant } from "@/types";
import { t } from "@/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant;
  onSaved?: (t: Tenant) => void;
}

export function TenantDialog({ open, onOpenChange, tenant, onSaved }: Props) {
  const app = useApp();
  const [firstName, setFirstName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [employer, setEmployer] = useState("");
  const [income, setIncome] = useState("");
  const [emergency, setEmergency] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(tenant?.first_name ?? "");
    setLastName(tenant?.last_name ?? "");
    setEmail(tenant?.email ?? "");
    setPhone(tenant?.phone ?? "");
    setDob(tenant?.date_of_birth ?? "");
    setEmployer(tenant?.employer ?? "");
    setIncome(tenant?.monthly_income ? String(tenant.monthly_income) : "");
    setEmergency(tenant?.emergency_contact ?? "");
    setNotes(tenant?.notes ?? "");
  }, [open, tenant]);

  async function save() {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dob || null,
        employer: employer.trim() || null,
        monthly_income: income ? parseFloat(income) : null,
        emergency_contact: emergency.trim() || null,
        notes: notes.trim() || null,
      };
      const saved = tenant
        ? await app.updateTenant(tenant.id, payload)
        : await app.createTenant(payload);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!tenant) return;
    try {
      await app.deleteTenant(tenant.id);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tenant ? t("Edit tenant") : t("New tenant")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-first">{t("First name")}</Label>
              <Input id="t-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-last">{t("Last name")}</Label>
              <Input id="t-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-email">{t("Email")}</Label>
              <Input id="t-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-phone">{t("Phone")}</Label>
              <Input id="t-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-dob">{t("Date of birth")}</Label>
              <Input id="t-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-emerg">{t("Emergency contact")}</Label>
              <Input id="t-emerg" value={emergency} onChange={(e) => setEmergency(e.target.value)} placeholder={t("Name · phone")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-emp">{t("Employer")}</Label>
              <Input id="t-emp" value={employer} onChange={(e) => setEmployer(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t-inc">{t("Monthly income")}</Label>
              <Input id="t-inc" type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="t-notes">{t("Notes")}</Label>
            <Textarea id="t-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="mt-2">
          {tenant && (
            <Button type="button" variant="destructive" className="sm:mr-auto" onClick={() => setConfirming(true)}>
              {t("Delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("Cancel")}</Button>
          <Button type="button" onClick={save} disabled={saving || !firstName.trim() || !lastName.trim()}>
            {tenant ? t("Save changes") : t("Create tenant")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {tenant ? (
        <ConfirmDelete
          open={confirming}
          onOpenChange={setConfirming}
          title={t("Delete {name}?", { name: `${tenant.first_name} ${tenant.last_name}` })}
          description={t("Their leases and rent history go with them. This cannot be undone.")}
          onConfirm={remove}
        />
      ) : null}
    </>
  );
}

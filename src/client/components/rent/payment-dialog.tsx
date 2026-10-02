import { useEffect, useState } from "react";
import { useApp } from "@/context";
import { api } from "@/api";
import { formatDate, formatMoney, toIsoDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Payment, PaymentMethod, RentCharge } from "@/types";
import { t } from "@/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: RentCharge | null;
  onSaved?: () => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: t("Cash") },
  { value: "check", label: t("Check") },
  { value: "ach", label: t("Bank transfer") },
  { value: "credit", label: t("Credit card") },
  { value: "other", label: t("Other") },
];

export function PaymentDialog({ open, onOpenChange, charge, onSaved }: Props) {
  const app = useApp();
  const [amount, setAmount] = useState("0");
  /** The payment awaiting confirmation — its id is the open state. */
  const [confirming, setConfirming] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("ach");
  const [paidAt, setPaidAt] = useState(toIsoDate(new Date()));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Payment[]>([]);

  useEffect(() => {
    if (!open || !charge) return;
    const remaining = Math.max(0, (charge.amount ?? 0) - (charge.amount_paid ?? 0));
    setAmount(String(remaining));
    setMethod("ach");
    setPaidAt(toIsoDate(new Date()));
    setReference("");
    setNotes("");
    (async () => {
      try {
        const data = await api<{ payments: Payment[] }>("GET", `/api/rent-charges/${charge.id}/payments`);
        setHistory(data.payments);
      } catch {
        setHistory([]);
      }
    })();
  }, [open, charge]);

  async function save() {
    if (!charge) return;
    const a = parseFloat(amount);
    if (!Number.isFinite(a) || a <= 0) return;
    setSaving(true);
    try {
      await app.recordPayment({
        charge_id: charge.id,
        amount: a,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        paid_at: paidAt,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(id: number) {
    try {
      await api("DELETE", `/api/payments/${id}`);
      setHistory((prev) => prev.filter((p) => p.id !== id));
      onSaved?.();
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  const pending = history.find((p) => p.id === confirming) ?? null;

  if (!charge) return null;
  const remaining = Math.max(0, (charge.amount ?? 0) - (charge.amount_paid ?? 0));

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Record payment")}</DialogTitle>
        </DialogHeader>

        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <div className="font-medium">
            {charge.property_name} · {charge.unit_name}
          </div>
          <div className="text-xs text-muted-foreground">
            {charge.tenant_first_name} {charge.tenant_last_name} · {t("Due {date}", { date: formatDate(charge.due_date) })} · {t("{amount} charged", { amount: formatMoney(charge.amount, app.settings.currency) })}
          </div>
          <div className="mt-1 text-xs">
            {t("Paid so far:")} <span className="font-medium tabular-nums">{formatMoney(charge.amount_paid, app.settings.currency)}</span> ·
            {t("Remaining:")} <span className="font-medium tabular-nums">{formatMoney(remaining, app.settings.currency)}</span>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pay-amount">{t("Amount")}</Label>
              <Input id="pay-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pay-date">{t("Paid on")}</Label>
              <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("Method")}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((mt) => <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pay-ref">{t("Reference")}</Label>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("Check #, transaction ID")} />
            </div>
          </div>
          <div>
            <Label htmlFor="pay-notes">{t("Notes")}</Label>
            <Textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-2">
            <div className="section-label mb-1.5">{t("Past payments")}</div>
            <ul className="divide-y divide-border overflow-hidden rounded-md shadow-edge">
              {history.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium tabular-nums">{formatMoney(p.amount, app.settings.currency)}</span>
                    <span className="text-muted-foreground"> · {formatDate(p.paid_at)} · {t(p.method)}</span>
                    {p.reference && <span className="text-muted-foreground"> · {p.reference}</span>}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    onClick={() => setConfirming(p.id)}
                    aria-label={t("Remove the {amount} payment from {date}", { amount: formatMoney(p.amount, app.settings.currency), date: formatDate(p.paid_at) })}
                  >
                    {t("Remove")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("Close")}</Button>
          <Button type="button" onClick={save} disabled={saving || parseFloat(amount) <= 0}>
            {t("Record payment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {pending ? (
        <ConfirmDelete
          open
          onOpenChange={(o) => !o && setConfirming(null)}
          title={t("Remove the {amount} payment?", { amount: formatMoney(pending.amount, app.settings.currency) })}
          description={t("The charge it was applied to goes back to its outstanding balance.")}
          confirmLabel={t("Remove payment")}
          onConfirm={() => {
            const id = pending.id;
            setConfirming(null);
            deletePayment(id);
          }}
        />
      ) : null}
    </>
  );
}

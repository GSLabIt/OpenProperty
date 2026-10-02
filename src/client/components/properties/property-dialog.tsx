import { useEffect, useState } from "react";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Property, PropertyType } from "@/types";
import { t } from "@/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property;
  onSaved?: (p: Property) => void;
}

const TYPES: { value: PropertyType; label: string }[] = [
  { value: "single_family", label: t("Single-family home") },
  { value: "multi_family", label: t("Multi-family / apartments") },
  { value: "condo", label: t("Condo") },
  { value: "townhouse", label: t("Townhouse") },
  { value: "commercial", label: t("Commercial") },
];

const COLORS = ["sky", "emerald", "amber", "rose", "violet", "fuchsia", "teal", "orange", "slate"];

export function PropertyDialog({ open, onOpenChange, property, onSaved }: Props) {
  const app = useApp();
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [type, setType] = useState<PropertyType>("single_family");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [zip, setZip] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [color, setColor] = useState("sky");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(property?.name ?? "");
    setType((property?.type as PropertyType) ?? "single_family");
    setAddress(property?.address ?? "");
    setCity(property?.city ?? "");
    setStateName(property?.state ?? "");
    setZip(property?.zip ?? "");
    setYearBuilt(property?.year_built ? String(property.year_built) : "");
    setColor(property?.color ?? "sky");
    setNotes(property?.notes ?? "");
  }, [open, property]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        address: address.trim() || null,
        city: city.trim() || null,
        state: stateName.trim() || null,
        zip: zip.trim() || null,
        year_built: yearBuilt ? parseInt(yearBuilt, 10) : null,
        color,
        notes: notes.trim() || null,
      };
      const saved = property
        ? await app.updateProperty(property.id, payload)
        : await app.createProperty(payload);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!property) return;
    try {
      await app.deleteProperty(property.id);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{property ? t("Edit property") : t("New property")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="prop-name">{t("Name")}</Label>
            <Input id="prop-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Via Roma 12")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("Type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as PropertyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((ty) => <SelectItem key={ty.value} value={ty.value}>{ty.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Color")}</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full bg-${c}-500`} />
                        <span className="capitalize">{t(c)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="prop-addr">{t("Address")}</Label>
            <Input id="prop-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("Street and number")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="prop-city">{t("City")}</Label>
              <Input id="prop-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="prop-state">{t("Province")}</Label>
              <Input id="prop-state" value={stateName} onChange={(e) => setStateName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="prop-zip">{t("Postal code")}</Label>
              <Input id="prop-zip" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="prop-year">{t("Year built")}</Label>
            <Input id="prop-year" type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="prop-notes">{t("Notes")}</Label>
            <Textarea id="prop-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter className="mt-2">
          {property && (
            <Button type="button" variant="destructive" className="sm:mr-auto" onClick={() => setConfirming(true)}>
              {t("Delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("Cancel")}</Button>
          <Button type="button" onClick={save} disabled={saving || !name.trim()}>
            {property ? t("Save changes") : t("Create property")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {property ? (
        <ConfirmDelete
          open={confirming}
          onOpenChange={setConfirming}
          title={t('Delete "{name}"?', { name: property.name })}
          description={t("Its units, leases, and rent history go with it. This cannot be undone.")}
          onConfirm={remove}
        />
      ) : null}
    </>
  );
}

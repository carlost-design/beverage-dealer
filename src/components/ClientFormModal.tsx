import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { useErrorMessage, useT } from "../i18n";
import { parsePeso, pesoInput } from "../lib/format";
import { DiscountFields, readDiscount, type DiscountDraft } from "./DiscountFields";
import { Alert, Button, Field, Input, Modal, PesoInput, Select, Textarea } from "./ui";

const TERM_PRESETS = [0, 7, 15, 30];

export function ClientFormModal({
  open,
  onClose,
  client,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  client?: Doc<"clients">;
  onSaved?: (clientId: Id<"clients">) => void;
}) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={client ? t.clientForm.editTitle : t.clientForm.addTitle}>
      {/* Remount on open so the form starts from the saved values each time. */}
      {open && <ClientForm client={client} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function ClientForm({
  client,
  onClose,
  onSaved,
}: {
  client?: Doc<"clients">;
  onClose: () => void;
  onSaved?: (clientId: Id<"clients">) => void;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const create = useMutation(api.clients.create);
  const update = useMutation(api.clients.update);
  const [name, setName] = useState(client?.name ?? "");
  const [storeName, setStoreName] = useState(client?.storeName ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const initialTerms = client?.termsDays ?? 7;
  const [termsChoice, setTermsChoice] = useState(TERM_PRESETS.includes(initialTerms) ? String(initialTerms) : "custom");
  const [customTerms, setCustomTerms] = useState(String(initialTerms));
  const [creditLimit, setCreditLimit] = useState(pesoInput(client?.creditLimit));
  const [discount, setDiscount] = useState<DiscountDraft>(() => ({
    type: client?.discount?.type ?? "none",
    value: client?.discount
      ? client.discount.type === "percent"
        ? String(client.discount.value)
        : pesoInput(client.discount.value)
      : "",
  }));
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const termsDays = termsChoice === "custom" ? Number(customTerms) : Number(termsChoice);
    if (!Number.isInteger(termsDays) || termsDays < 0) return setError(t.clientForm.termsError);
    const limit = creditLimit.trim() ? parsePeso(creditLimit) : undefined;
    if (limit === null) return setError(t.clientForm.limitError);
    const rule = readDiscount(discount);
    if (rule === null) return setError(t.clientForm.discountError);

    const fields = { name, storeName, phone, address, termsDays, creditLimit: limit, discount: rule, notes };
    setSaving(true);
    try {
      if (client) {
        await update({ clientId: client._id, client: fields });
        toast.success(t.clientForm.updated);
        onSaved?.(client._id);
      } else {
        const id = await create({ client: fields });
        toast.success(t.clientForm.added(name.trim()));
        onSaved?.(id);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label={t.clientForm.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder={t.clientForm.namePlaceholder} />
      </Field>
      <Field label={t.clientForm.storeName} hint={t.common.optional}>
        <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder={t.clientForm.storePlaceholder} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.clientForm.phone} hint={t.common.optional}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
        </Field>
        <Field label={t.clientForm.terms}>
          <div className="flex gap-2">
            <Select value={termsChoice} onChange={(e) => setTermsChoice(e.target.value)}>
              <option value="0">{t.terms.payOnDelivery}</option>
              <option value="7">{t.terms.days(7)}</option>
              <option value="15">{t.terms.days(15)}</option>
              <option value="30">{t.terms.days(30)}</option>
              <option value="custom">{t.clientForm.otherTerms}</option>
            </Select>
            {termsChoice === "custom" && (
              <Input
                value={customTerms}
                onChange={(e) => setCustomTerms(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="w-24"
                aria-label={t.clientForm.daysLabel}
              />
            )}
          </div>
        </Field>
      </div>
      <Field label={t.clientForm.address} hint={t.clientForm.addressHint}>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label={t.clientForm.creditLimit} hint={t.clientForm.creditLimitHint}>
        <PesoInput value={creditLimit} onChange={setCreditLimit} placeholder={t.clientForm.noLimit} />
      </Field>
      <DiscountFields label={t.clientForm.usualDiscount} hint={t.clientForm.usualDiscountHint} value={discount} onChange={setDiscount} />
      <Field label={t.clientForm.notes} hint={t.common.optional}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      {error && <Alert tone="red" title={error} />}
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button type="submit" size="lg" loading={saving}>
          {client ? t.common.saveChanges : t.clientForm.add}
        </Button>
      </div>
    </form>
  );
}

import { useMutation } from "convex/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { parsePeso, pesoInput } from "../lib/format";
import { Button, ChoiceCards, Field, Input, Modal, PesoInput, Textarea } from "./ui";

type Method = "cash" | "gcash" | "maya" | "bank" | "check";

export function RecordPaymentModal({ onClose, order }: { onClose: () => void; order: Doc<"orders"> }) {
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const record = useMutation(api.payments.record);
  const balance = order.total - order.amountPaid;
  const [amount, setAmount] = useState(pesoInput(balance));
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = parsePeso(amount);
    if (!value || value <= 0) return toast.error(t.pay.enterAmount);
    if (value > balance) return toast.error(t.pay.tooMuch(fmt.money(balance)));
    setSaving(true);
    try {
      await record({ orderId: order._id, amount: value, method, reference });
      toast.success(value === balance ? t.pay.paidInFull : t.pay.recorded(fmt.money(value)));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.pay.orderTitle(order.orderNo)} description={t.pay.balance(fmt.money(balance))}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label={t.flow.amountReceived} hint={t.pay.upTo(fmt.money(balance))}>
          <PesoInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <div>
          <p className="mb-2 text-base font-semibold text-ink-2">{t.flow.paidWith}</p>
          <ChoiceCards
            label={t.flow.paidWith}
            value={method}
            onChange={setMethod}
            columns={3}
            options={(["cash", "gcash", "maya", "bank", "check"] as const).map((m) => ({ value: m, label: t.methods[m] }))}
          />
        </div>
        {method !== "cash" && (
          <Field label={t.flow.reference} hint={t.flow.referenceHint}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        )}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="success" size="lg" loading={saving}>
            {t.pay.savePayment}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Asks for a reason, then runs the action. Used for cancelling and removing.
export function ReasonModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  blocked = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  blocked?: boolean;
}) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return toast.error(t.damage.needReason);
    setSaving(true);
    try {
      await onConfirm(reason);
      setReason("");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="text-base text-ink-2">{description}</div>
        {!blocked && (
          <Field label={t.common.reason}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus />
          </Field>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {!blocked && (
            <Button type="submit" variant="danger" size="lg" loading={saving}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

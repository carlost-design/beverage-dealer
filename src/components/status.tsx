import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Truck } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { useT } from "../i18n";
import { cx } from "../lib/format";
import { Chip } from "./ui";

type PaymentStatus = Doc<"orders">["paymentStatus"];

// The Tagalog status words are the business's own terms, so they stay the
// same in English and Filipino.
const STATUS_WORDS: Record<PaymentStatus, string> = {
  paid: "Bayad na",
  partial: "May balanse",
  unpaid: "Hindi pa bayad",
};

export function PaymentBadge({
  status,
  isLate,
  daysLate,
  voided,
}: {
  status: PaymentStatus;
  isLate?: boolean;
  daysLate?: number;
  voided?: boolean;
}) {
  const t = useT();
  if (voided) return <Chip tone="gray">{t.status.cancelled}</Chip>;
  if (status === "paid") {
    return (
      <Chip tone="green" icon={CheckCircle2}>
        {STATUS_WORDS.paid}
      </Chip>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Chip tone={isLate ? "red" : "amber"} icon={Clock}>
        {STATUS_WORDS[status]}
      </Chip>
      {isLate && (
        <Chip tone="red" solid icon={AlertTriangle}>
          {t.status.late(daysLate ?? 0)}
        </Chip>
      )}
    </span>
  );
}

export function FulfillmentBadge({
  fulfillment,
  status,
}: {
  fulfillment: Doc<"orders">["fulfillment"];
  status: Doc<"orders">["fulfillmentStatus"];
}) {
  const t = useT();
  if (fulfillment === "pickup") {
    return status === "completed" ? (
      <Chip tone="green" icon={PackageCheck}>
        {t.status.pickedUp}
      </Chip>
    ) : (
      <Chip tone="gray">{t.status.forPickup}</Chip>
    );
  }
  if (status === "completed") {
    return (
      <Chip tone="green" icon={Truck}>
        {t.status.delivered}
      </Chip>
    );
  }
  if (status === "out_for_delivery") {
    return (
      <Chip tone="blue" icon={Truck}>
        {t.status.onTheWay}
      </Chip>
    );
  }
  return (
    <Chip tone="gray" icon={Truck}>
      {t.status.toDeliver}
    </Chip>
  );
}

// A client who is late shows in red wherever their name appears.
export function ClientName({
  name,
  isLate,
  className,
}: {
  name: string;
  isLate?: boolean;
  className?: string;
}) {
  return (
    <span className={cx(isLate ? "font-bold text-[#B42318]" : "font-semibold text-ink", className)}>{name}</span>
  );
}

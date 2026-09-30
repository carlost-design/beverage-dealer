import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Ban, MessageSquareText, Pencil, Phone, Printer, Truck, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { lineAmount } from "../../convex/lib/money";
import { ReasonModal, RecordPaymentModal } from "../components/PaymentModals";
import { PrintPreview } from "../components/print";
import { ProductTile } from "../components/ProductTile";
import { OrderSlip } from "../components/receipts";
import { ClientName, FulfillmentBadge, PaymentBadge } from "../components/status";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardHeader,
  ChoiceCards,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Modal,
  PageHeader,
  PageLoading,
  Segmented,
  Textarea,
} from "../components/ui";
import { useErrorMessage, useFmt, useT } from "../i18n";
import { cx } from "../lib/format";
import { useToday } from "../lib/useToday";
import { useTourPage } from "../tour/TourProvider";

const STATUS_WORDS = { unpaid: "Hindi pa bayad", partial: "May balanse", paid: "Bayad na" } as const;

export default function OrderDetail() {
  useTourPage("order-detail");
  const t = useT();
  const fmt = useFmt();
  const errorMessage = useErrorMessage();
  const { orderId } = useParams();
  const today = useToday();
  const data = useQuery(api.orders.get, orderId ? { orderId, today } : "skip");
  const products = useQuery(api.products.list);
  const setStatus = useMutation(api.orders.setFulfillmentStatus);
  const voidOrder = useMutation(api.orders.voidOrder);
  const voidPayment = useMutation(api.payments.voidPayment);
  const [printing, setPrinting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [removing, setRemoving] = useState<Doc<"payments"> | null>(null);

  if (data === undefined) return <PageLoading />;
  if (data === null) {
    return <EmptyState title={t.order.notFound} action={<LinkButton to="/orders">{t.order.backToOrders}</LinkButton>} />;
  }
  const { order, client, payments, isLate, daysLate, canEditItems, clientIsLate } = data;
  const categoryOf = new Map((products ?? []).map((p) => [p._id, p.category]));
  const balance = order.total - order.amountPaid;
  const cases = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const returnables = order.items.filter((item) => item.returnable);
  const emptiesOwed = returnables.reduce((sum, item) => sum + item.quantity - item.emptiesReturned, 0);

  async function changeStatus(status: Doc<"orders">["fulfillmentStatus"]) {
    try {
      await setStatus({ orderId: order._id, status });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title={t.orders.orderNo(order.orderNo)}
        description={`${fmt.day(order.date)} · ${fmt.time(order._creationTime)}`}
        back={{ to: "/orders", label: t.nav.orders }}
        actions={
          <>
            <Button variant="secondary" size="lg" onClick={() => setPrinting(true)} data-tour="order-print">
              <Printer className="size-6" /> {t.flow.printReceipt}
            </Button>
            {canEditItems && (
              <LinkButton to={`/orders/${order._id}/edit`} variant="secondary" size="lg" data-tour="order-edit">
                <Pencil className="size-5" /> {t.order.change}
              </LinkButton>
            )}
            {!order.voided && balance > 0 && (
              <Button variant="success" size="lg" onClick={() => setPaying(true)} data-tour="order-pay">
                <Wallet className="size-6" /> {t.home.receivePayment}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 space-y-3">
        {order.voided && (
          <Alert tone="amber" icon={Ban} title={t.order.cancelledTitle}>
            {order.voidReason}. {t.order.cancelledHint}
          </Alert>
        )}
        {isLate && (
          <Alert
            tone="red"
            icon={AlertTriangle}
            title={t.order.lateTitle(STATUS_WORDS[order.paymentStatus], daysLate)}
            action={
              <Button variant="danger" onClick={() => setPaying(true)}>
                {t.home.receivePayment}
              </Button>
            }
          >
            {t.order.lateHint(fmt.date(order.dueDate), fmt.money(balance))}
          </Alert>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card data-tour="order-items">
            <CardHeader title={t.order.items} description={t.common.cases(cases)} />
            <ul className="divide-y divide-line px-5 sm:px-6">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 py-3.5">
                  <ProductTile category={categoryOf.get(item.productId) ?? "other"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-ink">{item.name}</p>
                    <p className="text-base text-ink-3 tabular">
                      {t.common.cases(item.quantity)} × {fmt.money(item.price)}
                    </p>
                    {item.discountPerCase && (
                      <p className="text-base font-semibold text-[#146C43] tabular">
                        {t.flow.lessPerCase(fmt.money(item.discountPerCase))}
                      </p>
                    )}
                    {item.returnable && <p className="text-sm text-ink-3">{t.order.emptiesReturned(item.emptiesReturned, item.quantity)}</p>}
                  </div>
                  <p className="text-lg font-bold tabular">{fmt.money(lineAmount(item))}</p>
                </li>
              ))}
            </ul>
            {/* Whole-order discounts only exist on older orders. */}
            {order.discount && (
              <dl className="space-y-2 border-t border-line px-5 py-4 text-lg sm:px-6">
                <Row label={t.order.subtotal} value={fmt.money(order.subtotal)} />
                <Row
                  label={
                    <>
                      {t.order.discount(fmt.discount(order.discount))}
                      {order.discount.note && <span className="block text-sm text-ink-3">{order.discount.note}</span>}
                    </>
                  }
                  value={`−${fmt.money(order.discount.amount)}`}
                  className="text-[#146C43]"
                />
              </dl>
            )}
            <div className="flex items-baseline justify-between gap-3 bg-brand-soft px-5 py-4 sm:px-6">
              <span className="text-xl font-bold">{t.order.total}</span>
              <span className="text-3xl font-bold tracking-tight tabular">{fmt.money(order.total)}</span>
            </div>
            {!order.voided && (
              <dl className="space-y-2 px-5 py-4 text-lg sm:px-6">
                <Row label={t.order.paid} value={fmt.money(order.amountPaid)} />
                <Row
                  label={t.order.balance}
                  value={fmt.money(balance)}
                  className={cx("font-bold", isLate ? "text-[#B42318]" : balance > 0 ? "text-[#93370D]" : "text-[#146C43]")}
                />
              </dl>
            )}
            {returnables.length > 0 && (
              <p className="border-t border-line px-5 py-4 text-base text-ink-2 sm:px-6">
                {emptiesOwed > 0 ? t.order.emptiesOwed(emptiesOwed) : t.order.emptiesAll}
              </p>
            )}
          </Card>

          <Card data-tour="order-payments">
            <CardHeader
              title={t.order.payments}
              action={
                !order.voided && balance > 0 ? (
                  <Button variant="secondary" size="sm" onClick={() => setPaying(true)}>
                    <Wallet className="size-5" /> {t.home.receivePayment}
                  </Button>
                ) : undefined
              }
            />
            {payments.length === 0 ? (
              <p className="px-6 pb-6 text-base text-ink-3">{t.order.noPayments}</p>
            ) : (
              <ul className="divide-y divide-line px-5 pb-2 sm:px-6">
                {payments.map((payment) => (
                  <li key={payment._id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div className={cx(payment.voided && "text-gray-400 line-through")}>
                      <p className="text-lg font-semibold">
                        {fmt.method(payment.method)}
                        {payment.reference && <span className="font-normal text-ink-3"> · {payment.reference}</span>}
                      </p>
                      <p className="text-base text-ink-3">
                        {fmt.shortDate(payment.date)} · {fmt.time(payment._creationTime)}
                      </p>
                      {payment.voided && <p className="text-sm no-underline">{t.order.removed(payment.voidReason ?? "")}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cx("text-lg font-bold tabular", payment.voided && "text-gray-400 line-through")}>{fmt.money(payment.amount)}</span>
                      {!payment.voided && (
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(payment)}>
                          {t.order.remove}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="mb-3 text-base font-semibold text-ink-3">{t.order.client}</p>
            {client ? (
              <>
                <Link to={`/clients/${client._id}`} className="flex items-center gap-3">
                  <Avatar name={client.name} late={clientIsLate} />
                  <span className="min-w-0">
                    <ClientName name={client.name} isLate={clientIsLate} className="block truncate text-lg" />
                    {client.storeName && <span className="block truncate text-base text-ink-3">{client.storeName}</span>}
                  </span>
                </Link>
                <p className="mt-3 text-base text-ink-2">{t.order.termsLine(fmt.terms(client.termsDays))}</p>
                {client.phone && (
                  <a
                    href={`tel:${client.phone.replace(/\s/g, "")}`}
                    className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong text-base font-semibold text-ink hover:bg-gray-50"
                  >
                    <Phone className="size-5" /> {t.order.call} · {client.phone}
                  </a>
                )}
              </>
            ) : (
              <p className="text-base text-ink-3">—</p>
            )}
          </Card>

          <Card className="space-y-5 p-5" data-tour="order-status">
            <div>
              <p className="mb-2 text-base font-semibold text-ink-3">{t.order.paymentStatus}</p>
              <PaymentBadge status={order.paymentStatus} isLate={isLate} daysLate={daysLate} voided={order.voided} />
              {balance > 0 && !order.voided && (
                <p className={cx("mt-2 text-base", isLate ? "font-bold text-[#B42318]" : "text-ink-2")}>{t.order.dueOn(fmt.date(order.dueDate))}</p>
              )}
              {order.paidDate && order.paymentStatus === "paid" && <p className="mt-2 text-base text-ink-2">{t.order.paidOn(fmt.date(order.paidDate))}</p>}
            </div>
            {!order.voided && (
              <div>
                <p className="mb-2 text-base font-semibold text-ink-3">{order.fulfillment === "delivery" ? t.order.delivery : t.order.pickup}</p>
                <div className="mb-3">
                  <FulfillmentBadge fulfillment={order.fulfillment} status={order.fulfillmentStatus} />
                </div>
                <Segmented
                  label={order.fulfillment === "delivery" ? t.order.delivery : t.order.pickup}
                  value={order.fulfillmentStatus}
                  onChange={changeStatus}
                  options={
                    order.fulfillment === "delivery"
                      ? [
                          { value: "pending", label: t.order.markNotYet },
                          { value: "out_for_delivery", label: t.order.markOnTheWay },
                          { value: "completed", label: t.order.markDelivered },
                        ]
                      : [
                          { value: "pending", label: t.order.markNotYet },
                          { value: "completed", label: t.order.markPickedUp },
                        ]
                  }
                />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-ink-3">{t.order.details}</p>
              {!order.voided && (
                <Button variant="ghost" size="sm" onClick={() => setEditingDetails(true)}>
                  <Pencil className="size-4" /> {t.common.edit}
                </Button>
              )}
            </div>
            {order.fulfillment === "delivery" && (
              <p className="flex items-start gap-2 text-base text-ink">
                <Truck className="mt-0.5 size-5 shrink-0 text-ink-3" /> {order.deliveryAddress || t.order.noAddress}
              </p>
            )}
            <p className="mt-2 flex items-start gap-2 text-base text-ink-2">
              <MessageSquareText className="mt-0.5 size-5 shrink-0 text-ink-3" /> {order.notes || t.order.noNotes}
            </p>
          </Card>

          {!order.voided && (
            <Button variant="ghost" className="w-full text-[#B42318] hover:bg-[#FEF3F2]" onClick={() => setCancelling(true)} data-tour="order-cancel">
              <Ban className="size-5" /> {t.order.cancelOrder}
            </Button>
          )}
        </div>
      </div>

      <PrintPreview
        open={printing}
        onClose={() => setPrinting(false)}
        title={t.orders.orderNo(order.orderNo)}
        render={(settings) => <OrderSlip settings={settings} order={order} client={client} payments={payments} />}
      />
      {paying && <RecordPaymentModal onClose={() => setPaying(false)} order={order} />}
      {editingDetails && <EditDetailsModal order={order} onClose={() => setEditingDetails(false)} />}
      <ReasonModal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t.order.cancelTitle(order.orderNo)}
        confirmLabel={t.order.cancelConfirm}
        blocked={order.amountPaid > 0}
        description={
          order.amountPaid > 0 ? (
            <Alert tone="red" title={t.order.cancelHasPayments(fmt.money(order.amountPaid))} />
          ) : (
            <p>{t.order.cancelBody(cases, order.date === today)}</p>
          )
        }
        onConfirm={async (reason) => {
          await voidOrder({ orderId: order._id, reason });
          toast.success(t.order.cancelled(order.orderNo));
        }}
      />
      <ReasonModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t.order.removeTitle}
        confirmLabel={t.order.removeConfirm}
        description={removing && <p>{t.order.removeBody(fmt.money(removing.amount), fmt.method(removing.method), fmt.shortDate(removing.date))}</p>}
        onConfirm={async (reason) => {
          if (!removing) return;
          await voidPayment({ paymentId: removing._id, reason });
          toast.success(t.order.paymentRemoved);
        }}
      />
    </>
  );
}

function Row({ label, value, className }: { label: React.ReactNode; value: string; className?: string }) {
  return (
    <div className={cx("flex justify-between gap-3 text-ink-2", className)}>
      <dt>{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
  );
}

function EditDetailsModal({ order, onClose }: { order: Doc<"orders">; onClose: () => void }) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const update = useMutation(api.orders.updateDetails);
  const [fulfillment, setFulfillment] = useState(order.fulfillment);
  const [address, setAddress] = useState(order.deliveryAddress ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await update({ orderId: order._id, fulfillment, deliveryAddress: address, notes });
      toast.success(t.order.saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.order.editDetails}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <ChoiceCards
          label={t.flow.howGetIt}
          value={fulfillment}
          onChange={setFulfillment}
          options={[
            { value: "delivery", label: t.flow.deliver, icon: Truck },
            { value: "pickup", label: t.flow.pickup },
          ]}
        />
        {fulfillment === "delivery" && (
          <Field label={t.flow.deliverTo}>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        )}
        <Field label={t.flow.note}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" size="lg" loading={saving}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

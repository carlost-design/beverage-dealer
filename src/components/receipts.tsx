import { Fragment, type ReactNode } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import { useFmt, useT } from "../i18n";
import { formatPeso } from "../lib/format";
import { Receipt, ReceiptFooter, ReceiptHeader, type ReceiptSettings } from "./print";

// Receipts always show centavos, the way printed receipts do.
const amount = (centavos: number) => formatPeso(centavos).replace("₱", "");

const STATUS_WORDS: Record<Doc<"orders">["paymentStatus"], string> = {
  paid: "BAYAD NA",
  partial: "MAY BALANSE",
  unpaid: "HINDI PA BAYAD",
};

function Copies({
  settings,
  labels,
  children,
}: {
  settings: ReceiptSettings;
  labels: [string, string];
  children: (label?: string) => ReactNode;
}) {
  if (settings.receiptCopies !== 2) return <Receipt settings={settings}>{children()}</Receipt>;
  return (
    <Receipt settings={settings}>
      {children(labels[0])}
      <div className="copy-break" />
      {children(labels[1])}
    </Receipt>
  );
}

export function OrderSlip({
  settings,
  order,
  client,
  payments,
}: {
  settings: ReceiptSettings;
  order: Doc<"orders">;
  client: Doc<"clients"> | null;
  payments: Doc<"payments">[];
}) {
  const t = useT();
  const fmt = useFmt();
  const r = t.receipt;
  const cases = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const returnables = order.items.filter((item) => item.returnable);
  const emptiesOwed = returnables.reduce((sum, item) => sum + item.quantity - item.emptiesReturned, 0);
  const activePayments = payments.filter((p) => !p.voided);
  const balance = order.total - order.amountPaid;

  return (
    <Copies settings={settings} labels={[r.customerCopy, r.storeCopy]}>
      {(label) => (
        <>
          <ReceiptHeader settings={settings} title={order.fulfillment === "delivery" ? r.deliveryReceipt : r.orderSlip} />
          {label && <div className="center muted">{label}</div>}
          {order.voided && <div className="center bold big">{r.cancelled}</div>}
          <div className="row">
            <span className="bold">{r.order(order.orderNo)}</span>
            <span>{fmt.date(order.date)}</span>
          </div>
          <div className="row">
            <span>{order.fulfillment === "delivery" ? r.delivery : r.pickup}</span>
            <span>{fmt.time(order._creationTime)}</span>
          </div>
          <div className="gap" />
          <div className="bold">{client?.name ?? r.client}</div>
          {client?.storeName && <div>{client.storeName}</div>}
          {order.fulfillment === "delivery" && order.deliveryAddress && <div>{order.deliveryAddress}</div>}
          {client?.phone && <div>{client.phone}</div>}
          <div className="rule" />
          {order.items
            .filter((item) => item.quantity > 0)
            .map((item) => (
              <Fragment key={item.productId}>
                <div>{item.name}</div>
                <div className="row">
                  <span>
                    &nbsp;&nbsp;{item.quantity} x {amount(item.price)}
                  </span>
                  <span>{amount(item.price * item.quantity)}</span>
                </div>
                {item.discountPerCase && (
                  <div className="row">
                    <span>&nbsp;&nbsp;{r.lessPerCase(amount(item.discountPerCase))}</span>
                    <span>-{amount(item.discountPerCase * item.quantity)}</span>
                  </div>
                )}
              </Fragment>
            ))}
          <div className="rule" />
          <div className="row">
            <span>{r.cases}</span>
            <span>{cases}</span>
          </div>
          {order.discount && (
            <>
              <div className="row">
                <span>{r.subtotal}</span>
                <span>{amount(order.subtotal)}</span>
              </div>
              <div className="row">
                <span>{r.discount}</span>
                <span>-{amount(order.discount.amount)}</span>
              </div>
              <div className="muted">&nbsp;&nbsp;{fmt.discount(order.discount)}</div>
            </>
          )}
          {(order.depositCases || order.refundCases) && order.depositPerCase ? (
            <>
              {!order.discount && (
                <div className="row">
                  <span>{r.subtotal}</span>
                  <span>{amount(order.subtotal)}</span>
                </div>
              )}
              {order.depositCases ? (
                <div className="row">
                  <span>{r.deposit(order.depositCases, amount(order.depositPerCase))}</span>
                  <span>{amount(order.depositCases * order.depositPerCase)}</span>
                </div>
              ) : null}
              {order.refundCases ? (
                <div className="row">
                  <span>{r.refund(order.refundCases, amount(order.depositPerCase))}</span>
                  <span>-{amount(order.refundCases * order.depositPerCase)}</span>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="row bold big">
            <span>{r.total}</span>
            <span>{formatPeso(order.total)}</span>
          </div>
          {activePayments.map((payment) => (
            <div className="row" key={payment._id}>
              <span>{r.paid(fmt.method(payment.method), fmt.shortDate(payment.date))}</span>
              <span>{amount(payment.amount)}</span>
            </div>
          ))}
          {balance > 0 && (
            <div className="row bold">
              <span>{r.balance}</span>
              <span>{formatPeso(balance)}</span>
            </div>
          )}
          <div className="center bold">{STATUS_WORDS[order.paymentStatus]}</div>
          {balance > 0 && <div className="center">{r.due(fmt.date(order.dueDate))}</div>}
          {returnables.length > 0 && (
            <>
              <div className="rule" />
              <div className="bold">{r.emptiesTitle}</div>
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>{r.out}</th>
                    <th>{r.ret}</th>
                  </tr>
                </thead>
                <tbody>
                  {returnables.map((item) => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.emptiesReturned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {emptiesOwed > 0 && <div className="bold">{r.emptiesToReturn(emptiesOwed)}</div>}
            </>
          )}
          {order.notes && (
            <>
              <div className="rule" />
              <div>{r.note(order.notes)}</div>
            </>
          )}
          <div className="sign">{r.receivedBy}</div>
          <ReceiptFooter settings={settings} />
        </>
      )}
    </Copies>
  );
}

export type StatementData = {
  client: Doc<"clients">;
  openOrders: {
    _id: string;
    orderNo: number;
    date: string;
    dueDate: string;
    total: number;
    balance: number;
    isLate: boolean;
    daysLate: number;
  }[];
  balance: number;
  lateBalance: number;
  empties: { productId: string; name: string; owed: number }[];
  emptiesOwed: number;
};

export function StatementSlip({
  settings,
  data,
  today,
}: {
  settings: ReceiptSettings;
  data: StatementData;
  today: string;
}) {
  const t = useT();
  const fmt = useFmt();
  const r = t.receipt;
  const { client } = data;
  return (
    <Receipt settings={settings}>
      <ReceiptHeader settings={settings} title={r.statement} />
      <div className="center">{r.asOf(fmt.date(today))}</div>
      <div className="gap" />
      <div className="bold">{client.name}</div>
      {client.storeName && <div>{client.storeName}</div>}
      {client.address && <div>{client.address}</div>}
      <div>{r.terms(fmt.terms(client.termsDays))}</div>
      <div className="rule" />
      {data.openOrders.length === 0 && <div className="center">{r.noUnpaid}</div>}
      {data.openOrders.map((order) => (
        <Fragment key={order._id}>
          <div className="row">
            <span className="bold">#{order.orderNo}</span>
            <span>{fmt.shortDate(order.date)}</span>
          </div>
          <div className="row">
            <span>&nbsp;&nbsp;{r.lineTotal}</span>
            <span>{amount(order.total)}</span>
          </div>
          <div className="row">
            <span>&nbsp;&nbsp;{r.lineBalance}</span>
            <span>{amount(order.balance)}</span>
          </div>
          <div className="row">
            <span>&nbsp;&nbsp;{r.lineDue(fmt.shortDate(order.dueDate))}</span>
            <span>{order.isLate ? r.lateDays(order.daysLate) : ""}</span>
          </div>
        </Fragment>
      ))}
      <div className="rule" />
      <div className="row bold big">
        <span>{r.balance}</span>
        <span>{formatPeso(data.balance)}</span>
      </div>
      {data.lateBalance > 0 && (
        <div className="row bold">
          <span>{r.overdue}</span>
          <span>{formatPeso(data.lateBalance)}</span>
        </div>
      )}
      {data.emptiesOwed > 0 && (
        <>
          <div className="rule" />
          <div className="bold">{r.emptiesTitle}</div>
          {data.empties
            .filter((row) => row.owed > 0)
            .map((row) => (
              <div className="row" key={row.productId}>
                <span>{row.name}</span>
                <span>{row.owed}</span>
              </div>
            ))}
        </>
      )}
      <ReceiptFooter settings={settings} />
    </Receipt>
  );
}

export type DayReportData = {
  date: string;
  status: "open" | "closed" | "not_started";
  counted: boolean;
  rows: {
    productId: string;
    name: string;
    starting: number;
    stockIn: number;
    sold: number;
    returned: number;
    damaged: number;
    adjusted: number;
    expected: number;
    counted?: number;
    variance?: number;
  }[];
};

export function DayReportSlip({
  settings,
  day,
  sales,
  collected,
  orders,
}: {
  settings: ReceiptSettings;
  day: DayReportData;
  sales: number;
  collected: number;
  orders: number;
}) {
  const t = useT();
  const fmt = useFmt();
  const r = t.receipt;
  const status =
    day.status === "closed" ? (day.counted ? r.statusClosedCounted : r.statusClosedNotCounted) : r.statusOpen;
  const variances = day.rows.filter((row) => row.variance);
  return (
    <Receipt settings={settings}>
      <ReceiptHeader settings={settings} title={r.stockReport} />
      <div className="center">{fmt.day(day.date)}</div>
      <div className="center">{status}</div>
      <div className="rule" />
      <table>
        <thead>
          <tr>
            <th>{r.cols.cases}</th>
            <th>{r.cols.start}</th>
            <th>{r.cols.in}</th>
            <th>{r.cols.out}</th>
            <th>{r.cols.end}</th>
          </tr>
        </thead>
        <tbody>
          {day.rows.map((row) => (
            <Fragment key={row.productId}>
              <tr>
                <td colSpan={5}>{row.name}</td>
              </tr>
              <tr>
                <td />
                <td>{row.starting}</td>
                <td>{row.stockIn + row.returned + Math.max(row.adjusted, 0)}</td>
                <td>{row.sold + row.damaged + Math.max(-row.adjusted, 0)}</td>
                <td className="bold">{row.counted ?? row.expected}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      {variances.length > 0 && (
        <>
          <div className="rule" />
          <div className="bold">{r.variance}</div>
          {variances.map((row) => (
            <div className="row" key={row.productId}>
              <span>{row.name}</span>
              <span>
                {row.variance! > 0 ? "+" : ""}
                {row.variance}
              </span>
            </div>
          ))}
        </>
      )}
      <div className="rule" />
      <div className="row">
        <span>{r.ordersLine}</span>
        <span>{orders}</span>
      </div>
      <div className="row">
        <span>{r.casesSold}</span>
        <span>{day.rows.reduce((sum, row) => sum + row.sold, 0)}</span>
      </div>
      <div className="row bold">
        <span>{r.sales}</span>
        <span>{formatPeso(sales)}</span>
      </div>
      <div className="row bold">
        <span>{r.collected}</span>
        <span>{formatPeso(collected)}</span>
      </div>
      <div className="sign">{r.checkedBy}</div>
    </Receipt>
  );
}

export function TestSlip({ settings }: { settings: ReceiptSettings }) {
  const t = useT();
  const r = t.receipt;
  return (
    <Receipt settings={settings}>
      <ReceiptHeader settings={settings} title={r.test} />
      <div className="center">{r.paper(settings.paperWidth)}</div>
      <div className="row">
        <span>{r.leftEdge}</span>
        <span>{r.rightEdge}</span>
      </div>
      <div className="rule" />
      <div className="row bold big">
        <span>{r.total}</span>
        <span>{formatPeso(123456)}</span>
      </div>
      <ReceiptFooter settings={settings} />
    </Receipt>
  );
}

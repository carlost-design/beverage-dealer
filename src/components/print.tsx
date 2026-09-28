import { useQuery } from "convex/react";
import { Printer } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { api } from "../../convex/_generated/api";
import { useT } from "../i18n";
import { Button, Modal } from "./ui";

// Printing renders the receipt into #print-root (outside the app) and opens
// the browser's print window. The print CSS hides everything else.
const PrintContext = createContext<(content: ReactNode) => void>(() => {});

export function PrintProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);

  // Render the receipt synchronously, then print within the same tap:
  // Safari on iPad and iPhone only opens the print sheet from a user gesture.
  const print = useCallback((next: ReactNode) => {
    flushSync(() => setContent(next));
    window.print();
  }, []);

  const root = document.getElementById("print-root");
  return (
    <PrintContext.Provider value={print}>
      {children}
      {root && content ? createPortal(content, root) : null}
    </PrintContext.Provider>
  );
}

export function usePrint() {
  return useContext(PrintContext);
}

export type ReceiptSettings = {
  businessName: string;
  address?: string;
  phone?: string;
  receiptFooter?: string;
  paperWidth: "58mm" | "80mm";
  receiptCopies: number;
};

export function useReceiptSettings(): ReceiptSettings | undefined {
  return useQuery(api.settings.get) ?? undefined;
}

export function Receipt({ settings, children }: { settings: ReceiptSettings; children: ReactNode }) {
  return <div className={settings.paperWidth === "80mm" ? "receipt w80" : "receipt"}>{children}</div>;
}

export function ReceiptHeader({ settings, title }: { settings: ReceiptSettings; title: string }) {
  return (
    <>
      <h1>{settings.businessName}</h1>
      {settings.address && <div className="center muted">{settings.address}</div>}
      {settings.phone && <div className="center muted">{settings.phone}</div>}
      <div className="rule" />
      <div className="center bold">{title}</div>
      <div className="rule" />
    </>
  );
}

export function ReceiptFooter({ settings }: { settings: ReceiptSettings }) {
  if (!settings.receiptFooter) return null;
  return (
    <>
      <div className="rule" />
      {settings.receiptFooter.split("\n").map((line, i) => (
        <div key={i} className="center muted">
          {line}
        </div>
      ))}
    </>
  );
}

// Shows the receipt at its real width, with a big button that prints it.
export function PrintPreview({
  open,
  onClose,
  title,
  render,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  render: (settings: ReceiptSettings) => ReactNode;
}) {
  const t = useT();
  const settings = useReceiptSettings();
  const print = usePrint();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={settings ? t.receipt.previewHint(settings.paperWidth) : undefined}
      footer={
        <Button size="lg" onClick={() => settings && print(render(settings))} disabled={!settings} className="w-full sm:w-auto">
          <Printer className="size-6" /> {t.common.print}
        </Button>
      }
    >
      <div className="flex justify-center rounded-2xl bg-canvas p-5">
        <div className="shadow-card">{settings && render(settings)}</div>
      </div>
    </Modal>
  );
}

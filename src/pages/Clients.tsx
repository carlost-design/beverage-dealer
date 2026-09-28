import { useQuery } from "convex/react";
import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { ClientFormModal } from "../components/ClientFormModal";
import { ClientName } from "../components/status";
import { Avatar, Button, Card, Chip, EmptyState, PageHeader, PageLoading, SearchField, Segmented } from "../components/ui";
import { useFmt, useT } from "../i18n";
import { cx } from "../lib/format";
import { useToday } from "../lib/useToday";

type Filter = "all" | "utang" | "late" | "empties" | "archived";

export default function Clients() {
  const t = useT();
  const fmt = useFmt();
  const today = useToday();
  const clients = useQuery(api.clients.list, { today });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (["utang", "late", "empties", "archived"].includes(params.get("filter") ?? "") ? params.get("filter") : "all") as Filter;
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  if (!clients) return <PageLoading />;
  const active = clients.filter((c) => c.active);
  const counts = {
    utang: active.filter((c) => c.balance > 0).length,
    late: active.filter((c) => c.daysLate > 0).length,
    empties: active.filter((c) => c.emptiesOwed > 0).length,
  };
  const term = search.trim().toLowerCase();
  const rows = clients
    .filter((c) => (filter === "archived" ? !c.active : c.active))
    .filter((c) =>
      filter === "utang" ? c.balance > 0 : filter === "late" ? c.daysLate > 0 : filter === "empties" ? c.emptiesOwed > 0 : true,
    )
    .filter((c) => !term || `${c.name} ${c.storeName ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(term))
    .sort((a, b) => b.daysLate - a.daysLate || (filter === "utang" ? b.balance - a.balance : a.name.localeCompare(b.name)));

  return (
    <>
      <PageHeader
        title={t.clients.title}
        description={t.clients.summary(active.length, fmt.money(active.reduce((s, c) => s + c.balance, 0)))}
        actions={
          <Button size="lg" onClick={() => setAdding(true)}>
            <UserPlus className="size-6" /> {t.clients.add}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <Segmented
          label={t.clients.title}
          value={filter}
          onChange={(value) => setParams(value === "all" ? {} : { filter: value })}
          options={[
            { value: "all", label: t.clients.all },
            { value: "utang", label: `${t.clients.withUtang} (${counts.utang})` },
            { value: "late", label: `${t.clients.late} (${counts.late})` },
            { value: "empties", label: `${t.clients.owesEmpties} (${counts.empties})` },
            { value: "archived", label: t.clients.archived },
          ]}
        />
        <SearchField value={search} onChange={setSearch} placeholder={t.clients.searchPlaceholder} className="lg:max-w-md" />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={clients.length === 0 ? t.clients.emptyFirst : t.clients.noMatch}
            action={
              clients.length === 0 ? (
                <Button onClick={() => setAdding(true)}>
                  <UserPlus className="size-5" /> {t.clients.addFirst}
                </Button>
              ) : undefined
            }
          >
            {clients.length === 0 && t.clients.emptyFirstHint}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line p-2">
            {rows.map((client) => {
              const late = client.daysLate > 0;
              return (
                <li key={client._id}>
                  <Link
                    to={`/clients/${client._id}`}
                    className={cx(
                      "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-3.5 transition-colors sm:flex-nowrap",
                      late ? "bg-[#FEF3F2] hover:bg-[#FDE8E6]" : "hover:bg-gray-50",
                    )}
                  >
                    <Avatar name={client.name} late={late} />
                    <div className="min-w-0 flex-1">
                      <ClientName name={client.name} isLate={late} className="block truncate text-lg" />
                      <p className="truncate text-base text-ink-3">
                        {[client.storeName, fmt.terms(client.termsDays), client.discount && fmt.discount(client.discount)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-1">
                      {client.balance > 0 ? (
                        <span className={cx("text-xl font-bold tabular", late ? "text-[#B42318]" : "text-ink")}>{fmt.money(client.balance)}</span>
                      ) : (
                        <span className="text-base text-ink-3">{t.clients.noUtang}</span>
                      )}
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {late && (
                          <Chip tone="red" solid>
                            {t.status.late(client.daysLate)}
                          </Chip>
                        )}
                        {client.emptiesOwed > 0 && <Chip tone="blue">{t.clients.empties(client.emptiesOwed)}</Chip>}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ClientFormModal open={adding} onClose={() => setAdding(false)} onSaved={(id) => navigate(`/clients/${id}`)} />
    </>
  );
}

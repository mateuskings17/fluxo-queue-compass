import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, History, Search, Save, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { configQuery, formatMinutes, minutesBetween, TICKET_STATUS_LABEL, todayISO, type Ticket, type TicketStep } from "@/lib/queue";
import { PageHeader } from "@/components/queue/PageHeader";
import { RouteError, RouteNotFound } from "@/components/queue/RouteError";
import { TicketHistoryDialog } from "@/components/queue/TicketHistory";
import { PriorityBadge } from "@/components/queue/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Gestão de Filas" },
      { name: "description", content: "Volumes, tempos de espera e de atendimento por setor, e o histórico de cada senha." },
      { property: "og:title", content: "Relatórios — Gestão de Filas" },
      { property: "og:description", content: "Volumes, tempos de espera e de atendimento por setor." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(configQuery),
  component: Reports,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type TicketWithSteps = Ticket & { steps: TicketStep[] };

type SavedReport = {
  id: string;
  from: string;
  to: string;
  createdAt: string;
  total: number;
  completed: number;
  active: number;
  absent: number;
  cancelled: number;
  avgWait: string;
  avgService: string;
  avgTotal: string;
  sectors: { name: string; total: number; done: number; noShow: number; waiting: number }[];
  types: [string, number][];
};

const SAVED_REPORTS_KEY = "fluxo-queue-compass:saved-reports";

function loadSavedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(SAVED_REPORTS_KEY);
    return value ? (JSON.parse(value) as SavedReport[]) : [];
  } catch {
    return [];
  }
}

async function fetchRange(from: string, to: string): Promise<TicketWithSteps[]> {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  const pageSize = 1000;
  const out: TicketWithSteps[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("tickets")
      .select("*, steps:ticket_steps(*)")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as TicketWithSteps[]));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

function avg(values: (number | null)[]) {
  const v = values.filter((x): x is number => x != null && isFinite(x) && x >= 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function Reports() {
  const { data: config } = useSuspenseQuery(configQuery);
  const today = todayISO(config.settings.timezone);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);\n  const [savedReports, setSavedReports] = useState<SavedReport[]>(loadSavedReports);\n  const [saveMessage, setSaveMessage] = useState("");

  const { data: tickets = [], isFetching, error } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => fetchRange(from, to),
    placeholderData: keepPreviousData,
  });

  const stats = useMemo(() => {
    const steps = tickets.flatMap((t) => t.steps.map((s) => ({ ...s, priority: t.priority })));
    const bySector = new Map<string, typeof steps>();
    steps.forEach((s) => {
      const k = s.sector_name || "—";
      bySector.set(k, [...(bySector.get(k) ?? []), s]);
    });
    const byStation = new Map<string, typeof steps>();
    steps.filter((s) => s.status === "done").forEach((s) => {
      const k = `${s.sector_name} · ${s.station_name ?? "—"}${s.attendant_name ? ` · ${s.attendant_name}` : ""}`;
      byStation.set(k, [...(byStation.get(k) ?? []), s]);
    });
    const byType = new Map<string, number>();
    tickets.forEach((t) => byType.set(t.type_name, (byType.get(t.type_name) ?? 0) + 1));
    const hours = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, "0")}h`, senhas: 0 }));
    tickets.forEach((t) => {
      const h = hours[new Date(t.created_at).getHours()];
      if (h) h.senhas++;
    });
    const firstHour = hours.findIndex((h) => h.senhas > 0);
    const lastHour = 23 - [...hours].reverse().findIndex((h) => h.senhas > 0);

    return {
      total: tickets.length,
      completed: tickets.filter((t) => t.status === "completed").length,
      absent: tickets.filter((t) => t.status === "absent").length,
      cancelled: tickets.filter((t) => t.status === "cancelled").length,
      active: tickets.filter((t) => t.status === "active").length,
      avgWait: avg(steps.map((s) => minutesBetween(s.queued_at, s.called_at))),
      avgService: avg(steps.filter((s) => s.status === "done").map((s) => minutesBetween(s.started_at ?? s.called_at, s.finished_at))),
      avgTotal: avg(tickets.filter((t) => t.status === "completed").map((t) => minutesBetween(t.created_at, t.completed_at))),
      sectors: [...bySector.entries()].map(([name, list]) => ({
        name,
        total: list.length,
        done: list.filter((s) => s.status === "done").length,
        noShow: list.filter((s) => s.status === "no_show").length,
        waiting: list.filter((s) => ["waiting", "called", "in_service", "pending"].includes(s.status)).length,
        wait: avg(list.map((s) => minutesBetween(s.queued_at, s.called_at))),
        maxWait: Math.max(0, ...list.map((s) => minutesBetween(s.queued_at, s.called_at) ?? 0)),
        service: avg(list.filter((s) => s.status === "done").map((s) => minutesBetween(s.started_at ?? s.called_at, s.finished_at))),
      })),
      stations: [...byStation.entries()].map(([name, list]) => ({
        name, done: list.length, service: avg(list.map((s) => minutesBetween(s.started_at ?? s.called_at, s.finished_at))),
      })).sort((a, b) => b.done - a.done),
      types: [...byType.entries()].sort((a, b) => b[1] - a[1]),
      hours: firstHour < 0 ? [] : hours.slice(firstHour, lastHour + 1),
    };
  }, [tickets]);

  const filtered = tickets
    .filter((t) => !search || t.code.toLowerCase().includes(search.toLowerCase()) || (t.patient_name ?? "").toLowerCase().includes(search.toLowerCase()))
    .slice()
    .reverse();

  function persistSavedReports(next: SavedReport[]) {
    try {
      window.localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(next));
      setSavedReports(next);
      setSaveMessage("");
    } catch {
      setSaveMessage("Não foi possível salvar. O armazenamento deste navegador pode estar cheio.");
    }
  }

  function saveReport() {
    const report: SavedReport = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      from,
      to,
      createdAt: new Date().toISOString(),
      total: stats.total,
      completed: stats.completed,
      active: stats.active,
      absent: stats.absent,
      cancelled: stats.cancelled,
      avgWait: formatMinutes(stats.avgWait),
      avgService: formatMinutes(stats.avgService),
      avgTotal: formatMinutes(stats.avgTotal),
      sectors: stats.sectors.map(({ name, total, done, noShow, waiting }) => ({ name, total, done, noShow, waiting })),
      types: stats.types,
    };
    persistSavedReports([report, ...savedReports]);
  }

  function deleteReport(report: SavedReport) {
    const period = report.from === report.to ? report.from : `${report.from} até ${report.to}`;
    if (!window.confirm(`Deseja realmente excluir o relatório do período ${period}? As senhas e os atendimentos não serão apagados.`)) return;
    persistSavedReports(savedReports.filter((item) => item.id !== report.id));
  }

  function exportCsv() {
    const rows = [["senha", "tipo", "preferencial", "paciente", "status_senha", "emitida", "setor", "posicao", "atendente", "status_etapa", "entrou_fila", "chamada", "inicio", "fim", "espera_min", "atendimento_min"]];
    tickets.forEach((t) =>
      t.steps.sort((a, b) => a.seq - b.seq).forEach((s) =>
        rows.push([
          t.code, t.type_name, t.priority ? "sim" : "não", t.patient_name ?? "", TICKET_STATUS_LABEL[t.status] ?? t.status, t.created_at,
          s.sector_name, s.station_name ?? "", s.attendant_name ?? "", s.status, s.queued_at ?? "", s.called_at ?? "", s.started_at ?? "", s.finished_at ?? "",
          String(Math.round((minutesBetween(s.queued_at, s.called_at) ?? 0) * 10) / 10),
          String(Math.round((minutesBetween(s.started_at ?? s.called_at, s.finished_at) ?? 0) * 10) / 10),
        ]),
      ),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `atendimentos_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        settings={config.settings}
        title="Relatórios"
        actions={
          <>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
            <span className="text-sm text-muted-foreground">até</span>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
            <Button variant="outline" onClick={saveReport} disabled={!tickets.length || isFetching}><Save /> Salvar relatório</Button>\n            <Button variant="outline" onClick={exportCsv} disabled={!tickets.length}><Download /> CSV</Button>
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6">
        {error && <p className="rounded-xl bg-priority-soft p-4 text-sm text-priority">{(error as Error).message}</p>}
        <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 ${isFetching ? "opacity-60" : ""}`}>
          <Kpi label="Senhas emitidas" value={String(stats.total)} />
          <Kpi label="Finalizadas" value={String(stats.completed)} />
          <Kpi label="Em andamento" value={String(stats.active)} />
          <Kpi label="Ausentes / canceladas" value={`${stats.absent} / ${stats.cancelled}`} />
          <Kpi label="Espera média" value={formatMinutes(stats.avgWait)} />
          <Kpi label="Atendimento médio" value={formatMinutes(stats.avgService)} />
          <Kpi label="Permanência média" value={formatMinutes(stats.avgTotal)} />
        </div>

        {saveMessage && <p className="rounded-xl bg-priority-soft p-3 text-sm text-priority">{saveMessage}</p>}

        <Card title={`Relatórios salvos (${savedReports.length})`}>
          {savedReports.length ? (
            <div className="space-y-3">
              {savedReports.map((report) => (
                <div key={report.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {report.from === report.to ? report.from : `${report.from} até ${report.to}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Salvo em {new Date(report.createdAt).toLocaleString("pt-BR")} · {report.total} senhas · {report.completed} finalizadas
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Espera média: {report.avgWait} · Atendimento médio: {report.avgService}
                    </p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => deleteReport(report)}>
                    <Trash2 /> Excluir relatório
                  </Button>
                </div>
              ))}
            </div>
          ) : <p className="py-5 text-center text-sm text-muted-foreground">Nenhum relatório salvo. Gere um período e clique em “Salvar relatório”.</p>}
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card title="Senhas por hora">
            {stats.hours.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={30} />
                    <Tooltip cursor={{ fill: "var(--muted)" }} />
                    <Bar dataKey="senhas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <Empty />}
          </Card>
          <Card title="Por tipo de senha">
            {stats.types.length ? (
              <ul className="space-y-3">
                {stats.types.map(([name, n]) => (
                  <li key={name}>
                    <div className="flex justify-between text-sm"><span className="font-medium">{name}</span><span>{n}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(n / stats.total) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <Empty />}
          </Card>
        </div>

        <Card title="Por setor">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead><TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Atendidos</TableHead>
                <TableHead className="text-right">Ausentes</TableHead><TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">Espera média</TableHead><TableHead className="text-right">Maior espera</TableHead><TableHead className="text-right">Atendimento médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.sectors.map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-right">{s.total}</TableCell><TableCell className="text-right">{s.done}</TableCell>
                  <TableCell className="text-right">{s.noShow}</TableCell><TableCell className="text-right">{s.waiting}</TableCell>
                  <TableCell className="text-right">{formatMinutes(s.wait)}</TableCell><TableCell className="text-right">{formatMinutes(s.maxWait)}</TableCell><TableCell className="text-right">{formatMinutes(s.service)}</TableCell>
                </TableRow>
              ))}
              {stats.sectors.length === 0 && <TableRow><TableCell colSpan={8}><Empty /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>

        <Card title="Por posição e atendente">
          <Table>
            <TableHeader><TableRow><TableHead>Setor · posição · atendente</TableHead><TableHead className="text-right">Atendimentos</TableHead><TableHead className="text-right">Tempo médio</TableHead></TableRow></TableHeader>
            <TableBody>
              {stats.stations.map((s) => (
                <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell className="text-right">{s.done}</TableCell><TableCell className="text-right">{formatMinutes(s.service)}</TableCell></TableRow>
              ))}
              {stats.stations.length === 0 && <TableRow><TableCell colSpan={3}><Empty /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>

        <Card
          title="Senhas do período"
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar senha ou paciente" className="h-9 w-64 pl-8" />
            </div>
          }
        >
          <Table>
            <TableHeader><TableRow><TableHead>Senha</TableHead><TableHead>Tipo</TableHead><TableHead>Emitida</TableHead><TableHead>Percurso</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Permanência</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="ticket-code text-xl">{t.code}</TableCell>
                  <TableCell><div className="flex items-center gap-2">{t.type_name}{t.priority && <PriorityBadge />}</div></TableCell>
                  <TableCell>{new Date(t.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.steps.sort((a, b) => a.seq - b.seq).map((s) => s.sector_name).join(" → ")}</TableCell>
                  <TableCell>{TICKET_STATUS_LABEL[t.status]}</TableCell>
                  <TableCell className="text-right">{formatMinutes(minutesBetween(t.created_at, t.completed_at))}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setHistoryId(t.id)}><History /> Histórico</Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7}><Empty /></TableCell></TableRow>}
            </TableBody>
          </Table>
          {filtered.length > 300 && <p className="mt-3 text-xs text-muted-foreground">Mostrando as 300 mais recentes. Use a busca ou exporte o CSV para ver todas.</p>}
        </Card>
      </div>
      <TicketHistoryDialog ticketId={historyId} onClose={() => setHistoryId(null)} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="ticket-code mt-2 text-3xl">{value}</div>
    </div>
  );
}

function Card({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, BellRing, Check, ChevronRight, History, Play, RotateCcw, Send, UserRound, UserX, X, ListFilter, MonitorSmartphone } from "lucide-react";
import {
  callNext, callStep, cancelTicket, configQuery, finishStep, formatMinutes, formatTime, markNoShow, minutesBetween,
  requeueStep, sectorQueueQuery, sectorTodayQuery, setPatientName, startStep, ticketDetailQuery,
  type AppConfig, type Sector, type Station, type StepWithTicket,
} from "@/lib/queue";
import { useConfigRealtime, useRealtimeInvalidate } from "@/hooks/use-realtime";
import { useLocalSetting } from "@/hooks/use-local-setting";
import { useNow } from "@/hooks/use-now";
import { PageHeader } from "@/components/queue/PageHeader";
import { RouteError, RouteNotFound } from "@/components/queue/RouteError";
import { PriorityBadge, StepStatusBadge } from "@/components/queue/StatusBadge";
import { TicketHistoryDialog } from "@/components/queue/TicketHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atendimento/$sectorId")({
  head: () => ({
    meta: [
      { title: "Atendimento — Gestão de Filas" },
      { name: "description", content: "Chame, atenda e encaminhe as senhas do seu setor." },
      { property: "og:title", content: "Atendimento — Gestão de Filas" },
      { property: "og:description", content: "Chame, atenda e encaminhe as senhas do seu setor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const config = await context.queryClient.ensureQueryData(configQuery);
    if (!config.sectors.some((s) => s.id === params.sectorId)) throw notFound();
    await context.queryClient.ensureQueryData(sectorQueueQuery(params.sectorId));
  },
  component: Attendance,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function Attendance() {
  const { sectorId } = Route.useParams();
  const { data: config } = useSuspenseQuery(configQuery);
  const sector = config.sectors.find((s) => s.id === sectorId)!;
  const stations = config.stations.filter((s) => s.sector_id === sectorId && s.active);

  const [stationId, setStationId, loaded] = useLocalSetting<string>(`fila:station:${sectorId}`, "");
  const [attendant, setAttendant] = useLocalSetting<string>("fila:attendant", "");
  const [typeFilter, setTypeFilter] = useLocalSetting<string[]>(`fila:filter:${sectorId}`, []);

  useConfigRealtime();
  useRealtimeInvalidate(["ticket_steps", "tickets"], [["queue", sectorId], ["ticket"]]);

  const station = stations.find((s) => s.id === stationId);

  return (
    <div className="min-h-screen">
      <PageHeader
        settings={config.settings}
        title={sector.name}
        subtitle={station ? `${station.name}${attendant ? ` · ${attendant}` : ""}` : "Selecione sua posição de atendimento"}
        actions={
          station && (
            <>
              <Select value={stationId} onValueChange={setStationId}>
                <SelectTrigger className="h-9 w-40">
                  <MonitorSmartphone className="h-4 w-4 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={attendant}
                  onChange={(e) => setAttendant(e.target.value)}
                  placeholder="Seu nome (opcional)"
                  className="h-9 w-48 pl-8"
                />
              </div>
            </>
          )
        }
      />
      {!loaded ? null : !station ? (
        <StationPicker sector={sector} stations={stations} attendant={attendant} setAttendant={setAttendant} onPick={setStationId} />
      ) : (
        <Workspace config={config} sector={sector} station={station} attendant={attendant} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />
      )}
    </div>
  );
}

function StationPicker({ sector, stations, attendant, setAttendant, onPick }: {
  sector: Sector; stations: Station[]; attendant: string; setAttendant: (v: string) => void; onPick: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h2 className="text-3xl font-extrabold">Onde você está atendendo?</h2>
      <p className="mt-2 text-muted-foreground">Escolha o(a) {sector.station_label.toLowerCase()} para começar a chamar as senhas de {sector.name}.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {stations.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="rounded-2xl border-2 bg-card p-6 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
          >
            <MonitorSmartphone className="h-6 w-6 text-primary" />
            <div className="mt-4 text-xl font-bold">{s.name}</div>
          </button>
        ))}
        {stations.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed p-6 text-muted-foreground">
            Nenhum(a) {sector.station_label.toLowerCase()} cadastrado(a) para este setor. Cadastre na Administração.
          </p>
        )}
      </div>
      <div className="mt-8 max-w-sm">
        <label className="text-sm font-medium">Seu nome (opcional)</label>
        <Input className="mt-1" value={attendant} onChange={(e) => setAttendant(e.target.value)} placeholder="Ex.: Ana" />
        <p className="mt-1 text-xs text-muted-foreground">Usado apenas para identificar quem atendeu no histórico.</p>
      </div>
    </div>
  );
}

function sortForDisplay(steps: StepWithTicket[], mode: string) {
  return [...steps].sort((a, b) => {
    if (mode !== "fifo") {
      const pa = a.ticket?.priority ? 0 : 1;
      const pb = b.ticket?.priority ? 0 : 1;
      if (pa !== pb) return pa - pb;
    }
    return (a.queued_at ?? "").localeCompare(b.queued_at ?? "");
  });
}

function Workspace({ config, sector, station, attendant, typeFilter, setTypeFilter }: {
  config: AppConfig; sector: Sector; station: Station; attendant: string; typeFilter: string[]; setTypeFilter: (v: string[]) => void;
}) {
  const qc = useQueryClient();
  const { data: steps } = useSuspenseQuery(sectorQueueQuery(sector.id));
  const { data: today = [] } = useQuery(sectorTodayQuery(sector.id));
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);

  const activeTypes = config.ticketTypes.filter((t) => t.active);
  const matchesFilter = (s: StepWithTicket) => typeFilter.length === 0 || (s.ticket?.ticket_type_id && typeFilter.includes(s.ticket.ticket_type_id));

  const waiting = useMemo(
    () => sortForDisplay(steps.filter((s) => s.status === "waiting" && s.ticket?.status === "active" && matchesFilter(s)), sector.call_mode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, typeFilter, sector.call_mode],
  );
  const mine = steps
    .filter((s) => s.station_id === station.id && (s.status === "called" || s.status === "in_service"))
    .sort((a, b) => (b.called_at ?? "").localeCompare(a.called_at ?? ""));
  const current = mine[0];
  const others = steps.filter((s) => s.station_id !== station.id && (s.status === "called" || s.status === "in_service"));
  const absent = today.filter((s) => s.status === "no_show" && s.ticket?.status === "absent");
  const doneCount = today.filter((s) => s.status === "done").length;

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await qc.invalidateQueries({ queryKey: ["queue", sector.id] });
      await qc.invalidateQueries({ queryKey: ["ticket"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function handleCallNext() {
    setBusy(true);
    try {
      const step = await callNext(sector.id, station.id, attendant, typeFilter);
      if (!step) toast.info("Não há senhas aguardando nesta fila.");
      await qc.invalidateQueries({ queryKey: ["queue", sector.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao chamar");
    } finally {
      setBusy(false);
    }
  }

  function toggleType(id: string) {
    setTypeFilter(typeFilter.includes(id) ? typeFilter.filter((x) => x !== id) : [...typeFilter, id]);
  }

  function handleCancel(step: StepWithTicket) {
    const ticket = step.ticket;
    if (!ticket || busy) return;
    if (window.confirm(`Cancelar o atendimento da senha ${ticket.code}? A senha será retirada das filas e suas etapas pendentes serão canceladas.`)) {
      void run(() => cancelTicket(ticket.id, "cancelada no atendimento"), "Senha cancelada");
    }
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {/* Queue filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ListFilter className="h-4 w-4" /> Fila:
          </span>
          <FilterChip active={typeFilter.length === 0} onClick={() => setTypeFilter([])}>Todas</FilterChip>
          {activeTypes.map((t) => (
            <FilterChip key={t.id} active={typeFilter.includes(t.id)} onClick={() => toggleType(t.id)}>
              {t.prefix ? `${t.prefix} · ` : ""}{t.name}
            </FilterChip>
          ))}
        </div>

        {current ? (
          <CurrentCard
            step={current}
            config={config}
            sector={sector}
            busy={busy}
            now={now}
            onRecall={() => run(() => callStep(current.id, station.id, attendant), "Senha chamada novamente")}
            onStart={() => run(() => startStep(current.id, attendant))}
            onFinish={() => run(() => finishStep(current.id, [], attendant), "Etapa concluída")}
            onForward={() => setForwardOpen(true)}
            onNoShow={() => run(() => markNoShow(current.id, attendant), "Marcado como ausente")}
            onCancel={() => handleCancel(current)}
            onHistory={() => current.ticket && setHistoryId(current.ticket.id)}
          />
        ) : (
          <div className="rounded-3xl border bg-card p-8 text-center shadow-soft md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{station.name} livre</p>
            <div className="ticket-code mt-3 text-7xl text-primary">{waiting.length}</div>
            <p className="mt-1 text-muted-foreground">{waiting.length === 1 ? "senha aguardando" : "senhas aguardando"}</p>
            <Button variant="call" size="kiosk" className="mt-8" disabled={busy || waiting.length === 0} onClick={handleCallNext}>
              <BellRing /> Chamar próxima senha
            </Button>
          </div>
        )}

        {mine.length > 1 && (
          <p className="rounded-xl bg-call-soft px-4 py-2 text-sm text-call-foreground">
            Há {mine.length} senhas abertas nesta posição. Conclua a atual para ver a próxima.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Aguardando" value={waiting.length} />
          <Stat label="Atendidas hoje" value={doneCount} />
          <Stat label="Ausentes hoje" value={absent.length} />
        </div>

        {others.length > 0 && (
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Em outras posições</h3>
            <ul className="mt-3 divide-y">
              {others.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="ticket-code w-20 text-2xl">{s.ticket?.code}</span>
                  <StepStatusBadge status={s.status} />
                  <span className="text-muted-foreground">{s.station_name}{s.attendant_name ? ` · ${s.attendant_name}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="font-bold">Fila de {sector.name}</h3>
            <span className="text-sm text-muted-foreground">{waiting.length} aguardando</span>
          </div>
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {waiting.map((s, i) => (
              <li key={s.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", i === 0 && "bg-primary-soft/40")}>
                <span className="w-6 text-right text-sm font-semibold text-muted-foreground">{i + 1}</span>
                <span className="ticket-code w-24 text-3xl">{s.ticket?.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.ticket?.type_name}</span>
                    {s.ticket?.priority && <PriorityBadge />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.ticket?.patient_name ? `${s.ticket.patient_name} · ` : ""}
                    chegou {formatTime(s.queued_at)} · espera {now ? formatMinutes((now - new Date(s.queued_at ?? s.created_at).getTime()) / 60000) : "—"}
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Button size="icon" variant="ghost" title="Histórico" onClick={() => s.ticket && setHistoryId(s.ticket.id)}>
                    <History />
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || !!current} onClick={() => run(() => callStep(s.id, station.id, attendant))}>
                    <Bell /> Chamar
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy || !s.ticket} onClick={() => handleCancel(s)}>
                    <X /> Cancelar
                  </Button>
                </div>
              </li>
            ))}
            {waiting.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma senha aguardando.</li>}
          </ul>
        </section>

        {absent.length > 0 && (
          <section className="rounded-2xl border bg-card shadow-soft">
            <div className="border-b px-5 py-3 text-sm font-semibold">Não compareceram (hoje)</div>
            <ul className="divide-y">
              {absent.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="ticket-code w-24 text-2xl">{s.ticket?.code}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(s.finished_at)}</span>
                  <Button size="sm" variant="ghost" className="ml-auto" disabled={busy} onClick={() => run(() => requeueStep(s.id), "Senha devolvida à fila")}>
                    <RotateCcw /> Retornar à fila
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {current && (
        <ForwardDialog
          open={forwardOpen}
          onOpenChange={setForwardOpen}
          config={config}
          sector={sector}
          step={current}
          busy={busy}
          onConfirm={async (ids) => {
            await run(() => finishStep(current.id, ids, attendant), ids.length ? "Paciente encaminhado" : "Atendimento finalizado");
            setForwardOpen(false);
          }}
        />
      )}
      <TicketHistoryDialog ticketId={historyId} onClose={() => setHistoryId(null)} />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="ticket-code mt-1 text-4xl">{value}</div>
    </div>
  );
}

function CurrentCard({ step, config, sector, busy, now, onRecall, onStart, onFinish, onForward, onNoShow, onCancel, onHistory }: {
  step: StepWithTicket; config: AppConfig; sector: Sector; busy: boolean; now: number | null;
  onRecall: () => void; onStart: () => void; onFinish: () => void; onForward: () => void; onNoShow: () => void; onCancel: () => void; onHistory: () => void;
}) {
  const t = step.ticket;
  const { data: detail } = useQuery({ ...ticketDetailQuery(step.ticket_id) });
  const pending = (detail?.steps ?? []).filter((s) => s.status === "pending");
  const [name, setName] = useState(t?.patient_name ?? "");
  const autoNext = config.sectors.find((s) => s.id === sector.auto_next_sector_id);

  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-lift">
      <div className={cn("flex flex-wrap items-center gap-3 px-6 py-3 text-sm font-semibold", step.status === "in_service" ? "bg-call text-call-foreground" : "bg-call-soft text-call-foreground")}>
        {step.status === "in_service" ? <Play className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        {step.status === "in_service" ? "Em atendimento" : "Chamando — aguardando o paciente"}
        <span className="ml-auto font-normal">
          chamada às {formatTime(step.called_at)} · {step.call_count}x
          {step.status === "in_service" && now && step.started_at ? ` · ${formatMinutes((now - new Date(step.started_at).getTime()) / 60000)}` : ""}
        </span>
      </div>
      <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
        <div>
          <div className="ticket-code text-8xl text-primary md:text-9xl">{t?.code}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t?.type_name}</span>
            {t?.priority && <PriorityBadge />}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Emitida {formatTime(t?.created_at)} · espera {formatMinutes(minutesBetween(step.queued_at, step.called_at))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome do paciente (opcional)</label>
            <div className="mt-1 flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Identificação do paciente" />
              <Button variant="outline" disabled={!t || name === (t?.patient_name ?? "")} onClick={async () => {
                if (!t) return;
                try { await setPatientName(t.id, name); toast.success("Nome salvo"); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
              }}>
                Salvar
              </Button>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximas etapas</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
              {pending.length === 0 ? (
                <span className="text-muted-foreground">
                  {autoNext ? `Encaminhamento automático: ${autoNext.name}` : "Nenhuma — finaliza ao concluir"}
                </span>
              ) : (
                pending.map((p, i) => (
                  <span key={p.id} className="inline-flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium">{p.sector_name}</span>
                  </span>
                ))
              )}
            </div>
          </div>
          <Button variant="link" className="h-auto p-0" onClick={onHistory}>
            <History /> Ver histórico completo
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t bg-muted/40 px-6 py-4">
        <Button variant="outline" size="lg" disabled={busy} onClick={onRecall}>
          <Bell /> Chamar novamente
        </Button>
        {step.status === "called" && (
          <Button variant="default" size="lg" disabled={busy} onClick={onStart}>
            <Play /> Iniciar atendimento
          </Button>
        )}
        <Button variant="success" size="lg" disabled={busy} onClick={onFinish}>
          <Check /> {pending.length || autoNext ? "Concluir e seguir rota" : "Concluir atendimento"}
        </Button>
        <Button variant="soft" size="lg" disabled={busy} onClick={onForward}>
          <Send /> Encaminhar
        </Button>
        <div className="ml-auto flex gap-2">
          {step.status === "called" && (
            <Button variant="ghost" size="lg" disabled={busy} onClick={onNoShow}>
              <UserX /> Não compareceu
            </Button>
          )}
          <Button variant="ghost" size="lg" className="text-destructive hover:text-destructive" disabled={busy} onClick={onCancel}>
            <X /> Cancelar
          </Button>
        </div>
      </div>
    </section>
  );
}

function ForwardDialog({ open, onOpenChange, config, sector, step, busy, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; config: AppConfig; sector: Sector; step: StepWithTicket; busy: boolean;
  onConfirm: (sectorIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const targets = config.sectors.filter((s) => s.active && s.id !== sector.id);
  const rules = config.routingRules.filter((r) => r.active);
  const nameOf = (id: string) => config.sectors.find((s) => s.id === id)?.name ?? "?";

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelected([]); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Encaminhar senha {step.ticket?.code}</DialogTitle>
          <DialogDescription>
            Selecione um ou mais setores na ordem do atendimento. Ao confirmar, esta etapa é concluída e a senha entra na fila do primeiro setor.
          </DialogDescription>
        </DialogHeader>

        {rules.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rotas prontas</div>
            <div className="flex flex-wrap gap-2">
              {rules.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.sector_ids.filter((id) => id !== sector.id && targets.some((t) => t.id === id)))}
                  className="rounded-full border bg-card px-3 py-1 text-sm font-medium hover:border-primary"
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setores</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {targets.map((s) => {
              const idx = selected.indexOf(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-semibold transition-colors",
                    idx >= 0 ? "border-primary bg-primary-soft" : "hover:border-primary/40",
                  )}
                >
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm", idx >= 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                    {idx >= 0 ? idx + 1 : "+"}
                  </span>
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted px-4 py-3 text-sm">
            <span className="font-medium">Rota:</span>
            {selected.map((id, i) => (
              <span key={id} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {nameOf(id)}
              </span>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onConfirm([])} disabled={busy}>
            Finalizar sem encaminhar
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={busy || selected.length === 0}>
            <Send /> Concluir e encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ticketDetailQuery, STEP_STATUS_LABEL, TICKET_STATUS_LABEL, formatMinutes, minutesBetween } from "@/lib/queue";
import { StepStatusBadge } from "./StatusBadge";

export function TicketTimeline({ ticketId }: { ticketId: string }) {
  const { data, isLoading } = useQuery(ticketDetailQuery(ticketId));
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;
  const { ticket, steps, events } = data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="ticket-code text-5xl text-primary">{ticket.code}</span>
        <div>
          <div className="font-semibold">{ticket.type_name}</div>
          <div className="text-sm text-muted-foreground">
            {TICKET_STATUS_LABEL[ticket.status]} · emitida {new Date(ticket.created_at).toLocaleString("pt-BR")}
          </div>
          {ticket.patient_name && <div className="text-sm">Paciente: {ticket.patient_name}</div>}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Percurso</h4>
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-bold">{s.seq}</span>
              <span className="font-semibold">{s.sector_name}</span>
              <StepStatusBadge status={s.status} />
              {s.station_name && <span className="text-muted-foreground">{s.station_name}</span>}
              {s.attendant_name && <span className="text-muted-foreground">· {s.attendant_name}</span>}
              <span className="ml-auto text-xs text-muted-foreground">
                espera {formatMinutes(minutesBetween(s.queued_at, s.called_at))} · atendimento{" "}
                {formatMinutes(minutesBetween(s.started_at ?? s.called_at, s.finished_at))}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Histórico</h4>
        <ol className="relative space-y-3 border-l pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="font-medium">{e.description}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("pt-BR")}
                {e.station_name ? ` · ${e.station_name}` : ""}
                {e.attendant_name ? ` · ${e.attendant_name}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function TicketHistoryDialog({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da senha</DialogTitle>
        </DialogHeader>
        {ticketId && <TicketTimeline ticketId={ticketId} />}
      </DialogContent>
    </Dialog>
  );
}

export { STEP_STATUS_LABEL };

import { queryOptions } from "@tanstack/react-query";
import {
  callNextFn, callStepFn, cancelTicketFn, finishStepFn, getConfigFn, getRecentCallsFn, getSectorQueueFn, getSectorTodayFn,
  getTicketDetailFn, issueTicketFn, markNoShowFn, requeueStepFn, setPatientNameFn, startStepFn,
} from "./queue.functions";
import type { Tables } from "@/integrations/supabase/types";

export type Settings = Tables<"settings">;
export type Sector = Tables<"sectors">;
export type Station = Tables<"stations">;
export type TicketType = Tables<"ticket_types">;
export type RoutingRule = Tables<"routing_rules">;
export type Ticket = Tables<"tickets">;
export type TicketStep = Tables<"ticket_steps">;
export type Call = Tables<"calls">;
export type TicketEvent = Tables<"ticket_events">;
export type StepWithTicket = TicketStep & { ticket: Ticket | null };

export type AppConfig = {
  settings: Settings;
  sectors: Sector[];
  stations: Station[];
  ticketTypes: TicketType[];
  routingRules: RoutingRule[];
};

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: (): Promise<AppConfig> => getConfigFn(),
});

export const ACTIVE_STEP_STATUSES = ["waiting", "called", "in_service"] as const;

export const sectorQueueQuery = (sectorId: string) =>
  queryOptions({
    queryKey: ["queue", sectorId],
    queryFn: (): Promise<StepWithTicket[]> => getSectorQueueFn({ data: { sectorId } }),
  });

/** Steps of this sector that ended today (for the "absent" list and counters). */
export const sectorTodayQuery = (sectorId: string) =>
  queryOptions({
    queryKey: ["queue", sectorId, "today"],
    queryFn: (): Promise<StepWithTicket[]> => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      return getSectorTodayFn({ data: { sectorId, since: since.toISOString() } });
    },
  });

export const recentCallsQuery = (limit = 12, sectorId?: string) =>
  queryOptions({
    queryKey: ["calls", sectorId ?? "all", limit],
    queryFn: (): Promise<Call[]> => getRecentCallsFn({ data: { limit, sectorId } }),
  });

export const ticketDetailQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ["ticket", ticketId],
    queryFn: (): Promise<{ ticket: Ticket; steps: TicketStep[]; events: TicketEvent[] }> => getTicketDetailFn({ data: { ticketId } }),
  });

/* ---------- Actions (validated on the server; numbering and queues run as database functions) ---------- */

export async function issueTicket(typeId: string, patientName?: string) {
  return (await issueTicketFn({ data: { typeId, ...(patientName ? { patientName } : {}) } })) as Ticket;
}

export async function callNext(sectorId: string, stationId: string, attendant: string, typeIds: string[]) {
  return (await callNextFn({ data: { sectorId, stationId, attendant: attendant || undefined, typeIds } })) as TicketStep | null;
}

export async function callStep(stepId: string, stationId: string, attendant: string) {
  return callStepFn({ data: { stepId, stationId, attendant: attendant || undefined } });
}

export async function startStep(stepId: string, attendant: string) {
  return startStepFn({ data: { stepId, attendant: attendant || undefined } });
}

export async function finishStep(stepId: string, forwardSectorIds: string[], attendant: string) {
  return (await finishStepFn({ data: { stepId, forwardSectorIds, attendant: attendant || undefined } })) as Ticket;
}

export async function markNoShow(stepId: string, attendant: string) {
  return markNoShowFn({ data: { stepId, attendant: attendant || undefined } });
}

export async function requeueStep(stepId: string) {
  return requeueStepFn({ data: { stepId } });
}

export async function cancelTicket(ticketId: string, reason?: string) {
  return cancelTicketFn({ data: { ticketId, ...(reason ? { reason } : {}) } });
}

export async function setPatientName(ticketId: string, name: string) {
  await setPatientNameFn({ data: { ticketId, name } });
}

/* ---------- Pure helpers ---------- */

/** Builds a ticket code from the configured format, e.g. ("RX", 3, 7) -> "RX007". */
export function formatTicketCode(prefix: string, digits: number, num: number) {
  const n = String(num);
  return prefix + n.padStart(Math.max(digits, n.length), "0");
}

/** Next code the totem will emit for a ticket type (mirrors the database numbering rule). */
export function nextTicketCode(t: Pick<TicketType, "prefix" | "digits" | "start_number" | "current_number" | "reset_daily" | "last_reset_date">, today: string) {
  const resets = t.reset_daily && (!t.last_reset_date || t.last_reset_date < today);
  const num = resets ? t.start_number : Math.max(t.current_number + 1, t.start_number);
  return formatTicketCode(t.prefix, t.digits, num);
}

/** Spells a code for speech: "RX001" -> "R X 0 0 1". */
export function spellCode(code: string) {
  return code.replace(/\s+/g, "").split("").join(" ");
}

export function buildAnnouncement(template: string, call: Pick<Call, "code" | "call_phrase" | "sector_name" | "station_name">, spoken = true) {
  const text = template
    .replaceAll("{senha}", spoken ? spellCode(call.code) : call.code)
    .replaceAll("{setor}", call.call_phrase || call.sector_name)
    .replaceAll("{nome_setor}", call.sector_name)
    .replaceAll("{local}", call.station_name);
  return text.replace(/\s+,/g, ",").replace(/,\s*\./g, ".").replace(/\s{2,}/g, " ").trim();
}

export function minutesBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

export function formatMinutes(min: number | null | undefined) {
  if (min == null || !isFinite(min)) return "—";
  if (min < 1) return `${Math.max(0, Math.round(min * 60))}s`;
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(Math.round(min % 60)).padStart(2, "0")}`;
}

export function formatTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function todayISO(timeZone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export const STEP_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando etapa anterior",
  waiting: "Na fila",
  called: "Chamado",
  in_service: "Em atendimento",
  done: "Concluído",
  no_show: "Não compareceu",
  cancelled: "Cancelado",
};

export const TICKET_STATUS_LABEL: Record<string, string> = {
  active: "Em andamento",
  completed: "Finalizado",
  absent: "Ausente",
  cancelled: "Cancelado",
};

export const CALL_MODE_LABEL: Record<string, string> = {
  priority_first: "Preferencial sempre primeiro",
  alternate: "Intercalar preferencial e normal",
  fifo: "Ordem de chegada",
};

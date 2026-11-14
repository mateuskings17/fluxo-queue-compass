import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

/*
 * All queue reads and writes run here, on the server, with input validation.
 * The browser has no direct access to tickets, queues, calls or settings.
 * The app intentionally has no login, so these functions are the only gate.
 */

type DbError = { message: string; code?: string } | null;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Business rule messages raised by the database (RAISE EXCEPTION) are safe to show; anything else is generic. */
function check<T>(res: { data: T | null; error: DbError }): T {
  if (res.error) {
    if (res.error.code === "P0001") throw new Error(res.error.message);
    console.error("[queue]", res.error);
    throw new Error("Não foi possível concluir a operação. Tente novamente.");
  }
  return res.data as T;
}

const id = z.string().uuid();
const attendant = z.string().trim().max(80).optional();
const shortText = (max: number) => z.string().trim().max(max);

/* ------------------------------- Reads ------------------------------- */

export const getConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const [settings, sectors, stations, ticketTypes, routingRules] = await Promise.all([
    sb.from("settings").select("*").eq("id", 1).single(),
    sb.from("sectors").select("*").order("sort_order").order("name"),
    sb.from("stations").select("*").order("sort_order").order("name"),
    sb.from("ticket_types").select("*").order("sort_order").order("name"),
    sb.from("routing_rules").select("*").order("sort_order").order("name"),
  ]);
  return {
    settings: check(settings),
    sectors: check(sectors) ?? [],
    stations: check(stations) ?? [],
    ticketTypes: check(ticketTypes) ?? [],
    routingRules: check(routingRules) ?? [],
  };
});

type StepRow = Tables<"ticket_steps"> & { ticket: Tables<"tickets"> | null };

export const getSectorQueueFn = createServerFn({ method: "GET" })
  .validator(z.object({ sectorId: id }))
  .handler(async ({ data }) => {
    const sb = await db();
    const res = await sb
      .from("ticket_steps")
      .select("*, ticket:tickets(*)")
      .eq("sector_id", data.sectorId)
      .in("status", ["waiting", "called", "in_service"])
      .order("queued_at", { ascending: true });
    return (check(res) ?? []) as StepRow[];
  });

export const getSectorTodayFn = createServerFn({ method: "GET" })
  .validator(z.object({ sectorId: id, since: z.string().datetime({ offset: true }) }))
  .handler(async ({ data }) => {
    const sb = await db();
    const res = await sb
      .from("ticket_steps")
      .select("*, ticket:tickets(*)")
      .eq("sector_id", data.sectorId)
      .in("status", ["done", "no_show"])
      .gte("finished_at", data.since)
      .order("finished_at", { ascending: false })
      .limit(500);
    return (check(res) ?? []) as StepRow[];
  });

export const getRecentCallsFn = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().int().min(1).max(50), sectorId: id.optional() }))
  .handler(async ({ data }) => {
    const sb = await db();
    let query = sb.from("calls").select("*");
    if (data.sectorId) query = query.eq("sector_id", data.sectorId);
    const res = await query.order("created_at", { ascending: false }).limit(data.limit);
    return check(res) ?? [];
  });

export const getTicketDetailFn = createServerFn({ method: "GET" })
  .validator(z.object({ ticketId: id }))
  .handler(async ({ data }) => {
    const sb = await db();
    const [ticket, steps, events] = await Promise.all([
      sb.from("tickets").select("*").eq("id", data.ticketId).single(),
      sb.from("ticket_steps").select("*").eq("ticket_id", data.ticketId).order("seq"),
      sb.from("ticket_events").select("*").eq("ticket_id", data.ticketId).order("created_at"),
    ]);
    return { ticket: check(ticket), steps: check(steps) ?? [], events: check(events) ?? [] };
  });

export const getReportRangeFn = createServerFn({ method: "GET" })
  .validator(
    z
      .object({ start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) })
      .refine((v) => new Date(v.end).getTime() - new Date(v.start).getTime() <= 400 * 86400000, "Período muito longo"),
  )
  .handler(async ({ data }) => {
    const sb = await db();
    const pageSize = 1000;
    const out: (Tables<"tickets"> & { steps: Tables<"ticket_steps">[] })[] = [];
    for (let page = 0; page < 50; page++) {
      const res = await sb
        .from("tickets")
        .select("*, steps:ticket_steps(*)")
        .gte("created_at", data.start)
        .lte("created_at", data.end)
        .order("created_at", { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      const rows = check(res) ?? [];
      out.push(...(rows as typeof out));
      if (rows.length < pageSize) break;
    }
    return out;
  });

/* ---------------------------- Queue actions ---------------------------- */

export const issueTicketFn = createServerFn({ method: "POST" })
  .validator(z.object({ typeId: id, patientName: shortText(120).optional() }))
  .handler(async ({ data }) => {
    const sb = await db();
    return check(
      await sb.rpc("issue_ticket", { p_type_id: data.typeId, ...(data.patientName ? { p_patient_name: data.patientName } : {}) }),
    );
  });

export const callNextFn = createServerFn({ method: "POST" })
  .validator(z.object({ sectorId: id, stationId: id, attendant, typeIds: z.array(id).max(50) }))
  .handler(async ({ data }) => {
    const sb = await db();
    const step = check(
      await sb.rpc("call_next", {
        p_sector_id: data.sectorId,
        p_station_id: data.stationId,
        ...(data.attendant ? { p_attendant: data.attendant } : {}),
        ...(data.typeIds.length ? { p_type_ids: data.typeIds } : {}),
      }),
    ) as Tables<"ticket_steps"> | null;
    return step && step.id ? step : null;
  });

export const callStepFn = createServerFn({ method: "POST" })
  .validator(z.object({ stepId: id, stationId: id, attendant }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.rpc("call_step", { p_step_id: data.stepId, p_station_id: data.stationId, ...(data.attendant ? { p_attendant: data.attendant } : {}) }));
    return true;
  });

export const startStepFn = createServerFn({ method: "POST" })
  .validator(z.object({ stepId: id, attendant }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.rpc("start_step", { p_step_id: data.stepId, ...(data.attendant ? { p_attendant: data.attendant } : {}) }));
    return true;
  });

export const finishStepFn = createServerFn({ method: "POST" })
  .validator(z.object({ stepId: id, forwardSectorIds: z.array(id).max(20), attendant }))
  .handler(async ({ data }) => {
    const sb = await db();
    return check(
      await sb.rpc("finish_step", {
        p_step_id: data.stepId,
        ...(data.forwardSectorIds.length ? { p_forward_sector_ids: data.forwardSectorIds } : {}),
        ...(data.attendant ? { p_attendant: data.attendant } : {}),
      }),
    );
  });

export const markNoShowFn = createServerFn({ method: "POST" })
  .validator(z.object({ stepId: id, attendant }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.rpc("mark_no_show", { p_step_id: data.stepId, ...(data.attendant ? { p_attendant: data.attendant } : {}) }));
    return true;
  });

export const requeueStepFn = createServerFn({ method: "POST" })
  .validator(z.object({ stepId: id }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.rpc("requeue_step", { p_step_id: data.stepId }));
    return true;
  });

export const cancelTicketFn = createServerFn({ method: "POST" })
  .validator(z.object({ ticketId: id, reason: shortText(200).optional() }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.rpc("cancel_ticket", { p_ticket_id: data.ticketId, ...(data.reason ? { p_reason: data.reason } : {}) }));
    return true;
  });

export const setPatientNameFn = createServerFn({ method: "POST" })
  .validator(z.object({ ticketId: id, name: shortText(120) }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("tickets").update({ patient_name: data.name || null }).eq("id", data.ticketId).select("id"));
    return true;
  });

export const closeOpenTicketsFn = createServerFn({ method: "POST" }).handler(async () => {
  const sb = await db();
  return (check(await sb.rpc("close_open_tickets")) as number | null) ?? 0;
});

/* --------------------------- Administration --------------------------- */

const settingsSchema = z
  .object({
    unit_name: shortText(120).min(1),
    totem_title: shortText(120),
    totem_message: shortText(300),
    panel_title: shortText(120),
    panel_message: shortText(500),
    panel_history_count: z.number().int().min(1).max(12),
    voice_enabled: z.boolean(),
    chime_enabled: z.boolean(),
    voice_volume: z.number().min(0).max(1),
    voice_rate: z.number().min(0.5).max(1.5),
    voice_repeat: z.number().int().min(1).max(3),
    voice_template: shortText(300),
    logo_url: z
      .string()
      .max(1_500_000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Imagem inválida")
      .nullable(),
  })
  .partial()
  .strict();

export const updateSettingsFn = createServerFn({ method: "POST" })
  .validator(settingsSchema)
  .handler(async ({ data }) => {
    const sb = await db();
    const values = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as TablesUpdate<"settings">;
    check(await sb.from("settings").update({ ...values, updated_at: new Date().toISOString() }).eq("id", 1).select("id"));
    return true;
  });

const ticketTypeSchema = z
  .object({
    name: shortText(80).min(1),
    description: shortText(200),
    prefix: z.string().max(6).regex(/^[A-Z0-9]*$/, "Use apenas letras e números no prefixo"),
    digits: z.number().int().min(1).max(6),
    start_number: z.number().int().min(0).max(999999),
    priority: z.boolean(),
    target_sector_id: id.nullable(),
    reset_daily: z.boolean(),
    active: z.boolean(),
    sort_order: z.number().int().min(-1000).max(100000),
  })
  .strict();

export const createTicketTypeFn = createServerFn({ method: "POST" })
  .validator(z.object({ sort_order: z.number().int().min(0).max(100000) }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("ticket_types").insert({ name: "Novo tipo", prefix: "N", sort_order: data.sort_order }).select("id"));
    return true;
  });

export const updateTicketTypeFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, values: ticketTypeSchema }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("ticket_types").update(data.values).eq("id", data.id).select("id"));
    return true;
  });

export const resetTicketNumberingFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }) => {
    const sb = await db();
    const type = check(await sb.from("ticket_types").select("start_number").eq("id", data.id).single()) as { start_number: number } | null;
    if (!type) throw new Error("Tipo de senha não encontrado");
    check(
      await sb
        .from("ticket_types")
        .update({ current_number: Math.max(0, type.start_number - 1), last_reset_date: data.today })
        .eq("id", data.id)
        .select("id"),
    );
    return true;
  });

export const deleteTicketTypeFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("ticket_types").delete().eq("id", data.id));
    return true;
  });

export const createRoutingRuleFn = createServerFn({ method: "POST" })
  .validator(z.object({ sort_order: z.number().int().min(0).max(100000) }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("routing_rules").insert({ name: "Nova rota", sector_ids: [], sort_order: data.sort_order }).select("id"));
    return true;
  });

export const updateRoutingRuleFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, name: shortText(80).min(1), sector_ids: z.array(id).max(20), active: z.boolean() }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("routing_rules").update({ name: data.name, sector_ids: data.sector_ids, active: data.active }).eq("id", data.id).select("id"));
    return true;
  });

export const deleteRoutingRuleFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("routing_rules").delete().eq("id", data.id));
    return true;
  });

const sectorSchema = z
  .object({
    name: shortText(80).min(1),
    kind: z.enum(["reception", "service"]),
    call_phrase: shortText(120),
    station_label: shortText(40),
    sort_order: z.number().int().min(-1000).max(100000),
    active: z.boolean(),
    call_mode: z.string().max(40),
    priority_ratio: z.number().int().min(1).max(10),
    auto_next_sector_id: id.nullable(),
  })
  .partial()
  .strict();

export const createSectorFn = createServerFn({ method: "POST" })
  .validator(z.object({ sort_order: z.number().int().min(0).max(100000) }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("sectors").insert({ name: "Novo setor", call_phrase: "ao novo setor", sort_order: data.sort_order }).select("id"));
    return true;
  });

export const updateSectorFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, values: sectorSchema }))
  .handler(async ({ data }) => {
    if (data.values.auto_next_sector_id === data.id) throw new Error("Um setor não pode encaminhar para ele mesmo");
    const sb = await db();
    check(await sb.from("sectors").update(data.values as TablesUpdate<"sectors">).eq("id", data.id).select("id"));
    return true;
  });

export const deleteSectorFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("sectors").delete().eq("id", data.id));
    return true;
  });

export const createStationFn = createServerFn({ method: "POST" })
  .validator(z.object({ sector_id: id, name: shortText(60).min(1), sort_order: z.number().int().min(0).max(100000) }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("stations").insert(data).select("id"));
    return true;
  });

export const updateStationFn = createServerFn({ method: "POST" })
  .validator(z.object({ id, values: z.object({ name: shortText(60).min(1), active: z.boolean() }).partial().strict() }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("stations").update(data.values as TablesUpdate<"stations">).eq("id", data.id).select("id"));
    return true;
  });

export const deleteStationFn = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const sb = await db();
    check(await sb.from("stations").delete().eq("id", data.id));
    return true;
  });

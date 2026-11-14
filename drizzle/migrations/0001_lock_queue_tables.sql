-- Remove open anonymous access to queue data; the app now reads and writes these tables only through validated server functions.
DROP POLICY IF EXISTS "open access" ON public.settings;
DROP POLICY IF EXISTS "open access" ON public.routing_rules;
DROP POLICY IF EXISTS "open access" ON public.tickets;
DROP POLICY IF EXISTS "open access" ON public.calls;
DROP POLICY IF EXISTS "open access" ON public.ticket_events;
DROP POLICY IF EXISTS "open access" ON public.ticket_steps;

REVOKE ALL ON public.settings, public.routing_rules, public.tickets, public.calls, public.ticket_events, public.ticket_steps FROM anon, authenticated;
GRANT ALL ON public.settings, public.routing_rules, public.tickets, public.calls, public.ticket_events, public.ticket_steps TO service_role;

-- Ticket types stay readable, but can no longer be created or changed directly (e.g. flipping priority).
REVOKE INSERT, UPDATE, DELETE ON public.ticket_types FROM anon, authenticated;
GRANT ALL ON public.ticket_types TO service_role;

-- Queue operations run only from the server.
REVOKE EXECUTE ON FUNCTION public.call_next(uuid, uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.call_step(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_ticket(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_open_tickets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_step(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_ticket(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ticket_event(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_no_show(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.requeue_step(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_step(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_next(uuid, uuid, text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.call_step(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_ticket(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_open_tickets() TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_step(uuid, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_ticket(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_ticket_event(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_no_show(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_step(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_step(uuid, text) TO service_role;

-- Data-free "something changed" doorbell so screens refresh without reading tables directly.
CREATE OR REPLACE FUNCTION public.notify_queue_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(jsonb_build_object('table', TG_TABLE_NAME), 'changed', 'queue-updates', false);
  EXCEPTION WHEN others THEN
    NULL;
  END;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_queue_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.settings FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.sectors FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.stations FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.ticket_types FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.routing_rules FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.tickets FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.ticket_steps FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
CREATE TRIGGER queue_doorbell AFTER INSERT OR UPDATE OR DELETE ON public.calls FOR EACH STATEMENT EXECUTE FUNCTION public.notify_queue_change();
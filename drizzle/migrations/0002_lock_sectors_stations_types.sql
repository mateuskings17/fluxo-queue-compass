DROP POLICY IF EXISTS "open access" ON public.sectors;
DROP POLICY IF EXISTS "open access" ON public.stations;
DROP POLICY IF EXISTS "open access" ON public.ticket_types;
REVOKE ALL ON public.sectors, public.stations, public.ticket_types FROM anon, authenticated;
GRANT ALL ON public.sectors, public.stations, public.ticket_types TO service_role;
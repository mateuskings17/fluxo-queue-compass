-- Settings (single row)
CREATE TABLE public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  unit_name text NOT NULL DEFAULT 'Minha Clínica',
  logo_url text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  totem_title text NOT NULL DEFAULT 'Retire sua senha',
  totem_message text NOT NULL DEFAULT 'Toque no tipo de atendimento desejado',
  panel_title text NOT NULL DEFAULT 'Painel de chamadas',
  panel_message text NOT NULL DEFAULT 'Bem-vindo! Aguarde a chamada da sua senha no painel.',
  panel_history_count integer NOT NULL DEFAULT 6,
  voice_enabled boolean NOT NULL DEFAULT true,
  chime_enabled boolean NOT NULL DEFAULT true,
  voice_volume numeric NOT NULL DEFAULT 1,
  voice_rate numeric NOT NULL DEFAULT 0.95,
  voice_repeat integer NOT NULL DEFAULT 1,
  voice_template text NOT NULL DEFAULT 'Senha {senha}, compareça {setor}, {local}.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'service' CHECK (kind IN ('reception','service')),
  call_phrase text NOT NULL DEFAULT '',
  station_label text NOT NULL DEFAULT 'Sala',
  call_mode text NOT NULL DEFAULT 'priority_first' CHECK (call_mode IN ('priority_first','fifo','alternate')),
  priority_ratio integer NOT NULL DEFAULT 2,
  auto_next_sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  prefix text NOT NULL DEFAULT '',
  digits integer NOT NULL DEFAULT 3,
  start_number integer NOT NULL DEFAULT 1,
  current_number integer NOT NULL DEFAULT 0,
  priority boolean NOT NULL DEFAULT false,
  target_sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  reset_daily boolean NOT NULL DEFAULT true,
  last_reset_date date,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sector_ids uuid[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  number integer NOT NULL,
  ticket_type_id uuid REFERENCES public.ticket_types(id) ON DELETE SET NULL,
  type_name text NOT NULL DEFAULT '',
  priority boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','absent','cancelled')),
  patient_name text,
  current_step_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX tickets_created_idx ON public.tickets(created_at);
CREATE INDEX tickets_code_idx ON public.tickets(code);

CREATE TABLE public.ticket_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  sector_name text NOT NULL DEFAULT '',
  seq integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','waiting','called','in_service','done','no_show','cancelled')),
  station_id uuid REFERENCES public.stations(id) ON DELETE SET NULL,
  station_name text,
  attendant_name text,
  queued_at timestamptz,
  called_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  call_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_steps_sector_status_idx ON public.ticket_steps(sector_id, status);
CREATE INDEX ticket_steps_ticket_idx ON public.ticket_steps(ticket_id);

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.ticket_steps(id) ON DELETE CASCADE,
  code text NOT NULL,
  priority boolean NOT NULL DEFAULT false,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  sector_name text NOT NULL DEFAULT '',
  call_phrase text NOT NULL DEFAULT '',
  station_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calls_created_idx ON public.calls(created_at DESC);

CREATE TABLE public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event text NOT NULL,
  description text NOT NULL DEFAULT '',
  sector_name text,
  station_name text,
  attendant_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_events_ticket_idx ON public.ticket_events(ticket_id, created_at);

-- Grants (no login: the app runs openly on the clinic network)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings, public.sectors, public.stations, public.ticket_types, public.routing_rules, public.tickets, public.ticket_steps, public.calls, public.ticket_events TO anon, authenticated;
GRANT ALL ON public.settings, public.sectors, public.stations, public.ticket_types, public.routing_rules, public.tickets, public.ticket_steps, public.calls, public.ticket_events TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open access" ON public.settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.sectors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.stations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.ticket_types FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.routing_rules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.tickets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.ticket_steps FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.calls FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.ticket_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Helpers ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_ticket_event(p_ticket uuid, p_event text, p_desc text, p_sector text, p_station text, p_attendant text)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.ticket_events(ticket_id, event, description, sector_name, station_name, attendant_name)
  VALUES (p_ticket, p_event, p_desc, p_sector, p_station, nullif(trim(coalesce(p_attendant,'')), ''));
$$;

-- Issue a new ticket with automatic numbering
CREATE OR REPLACE FUNCTION public.issue_ticket(p_type_id uuid, p_patient_name text DEFAULT NULL)
RETURNS public.tickets LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  t public.ticket_types;
  tz text;
  today date;
  num integer;
  v_code text;
  tk public.tickets;
  v_sector public.sectors;
  v_step uuid;
BEGIN
  SELECT * INTO t FROM public.ticket_types WHERE id = p_type_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tipo de senha não encontrado ou inativo'; END IF;

  SELECT coalesce((SELECT timezone FROM public.settings WHERE id = 1), 'America/Sao_Paulo') INTO tz;
  today := (now() AT TIME ZONE tz)::date;

  IF t.reset_daily AND (t.last_reset_date IS NULL OR t.last_reset_date < today) THEN
    num := t.start_number;
  ELSE
    num := greatest(t.current_number + 1, t.start_number);
  END IF;

  UPDATE public.ticket_types SET current_number = num, last_reset_date = today WHERE id = t.id;
  v_code := t.prefix || lpad(num::text, greatest(t.digits, length(num::text)), '0');

  SELECT * INTO v_sector FROM public.sectors WHERE id = t.target_sector_id AND active;
  IF NOT FOUND THEN
    SELECT * INTO v_sector FROM public.sectors WHERE kind = 'reception' AND active ORDER BY sort_order LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO v_sector FROM public.sectors WHERE active ORDER BY sort_order LIMIT 1;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum setor ativo configurado'; END IF;

  INSERT INTO public.tickets(code, number, ticket_type_id, type_name, priority, patient_name)
  VALUES (v_code, num, t.id, t.name, t.priority, nullif(trim(coalesce(p_patient_name,'')), ''))
  RETURNING * INTO tk;

  INSERT INTO public.ticket_steps(ticket_id, sector_id, sector_name, seq, status, queued_at)
  VALUES (tk.id, v_sector.id, v_sector.name, 1, 'waiting', now())
  RETURNING id INTO v_step;

  UPDATE public.tickets SET current_step_id = v_step WHERE id = tk.id RETURNING * INTO tk;
  PERFORM public.log_ticket_event(tk.id, 'issued', 'Senha emitida (' || t.name || ')', v_sector.name, NULL, NULL);
  PERFORM public.log_ticket_event(tk.id, 'queued', 'Entrou na fila de ' || v_sector.name, v_sector.name, NULL, NULL);
  RETURN tk;
END;
$$;

-- Call (or recall) a specific step
CREATE OR REPLACE FUNCTION public.call_step(p_step_id uuid, p_station_id uuid, p_attendant text DEFAULT NULL)
RETURNS public.ticket_steps LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  s public.ticket_steps;
  st public.stations;
  sec public.sectors;
  tk public.tickets;
  is_recall boolean;
BEGIN
  SELECT * INTO s FROM public.ticket_steps WHERE id = p_step_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;
  SELECT * INTO st FROM public.stations WHERE id = p_station_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guichê/sala não encontrado'; END IF;
  SELECT * INTO sec FROM public.sectors WHERE id = s.sector_id;
  SELECT * INTO tk FROM public.tickets WHERE id = s.ticket_id;

  IF s.status IN ('done','cancelled','pending') THEN RAISE EXCEPTION 'Esta senha não está disponível para chamada'; END IF;
  is_recall := s.status IN ('called','in_service');

  UPDATE public.ticket_steps SET
    status = CASE WHEN status = 'in_service' THEN 'in_service' ELSE 'called' END,
    station_id = st.id,
    station_name = st.name,
    attendant_name = coalesce(nullif(trim(coalesce(p_attendant,'')), ''), attendant_name),
    called_at = CASE WHEN is_recall THEN called_at ELSE now() END,
    finished_at = NULL,
    call_count = call_count + 1
  WHERE id = s.id RETURNING * INTO s;

  IF tk.status = 'absent' THEN
    UPDATE public.tickets SET status = 'active', completed_at = NULL, current_step_id = s.id WHERE id = tk.id;
  END IF;

  INSERT INTO public.calls(ticket_id, step_id, code, priority, sector_id, sector_name, call_phrase, station_name)
  VALUES (tk.id, s.id, tk.code, tk.priority, sec.id, coalesce(sec.name, s.sector_name), coalesce(nullif(sec.call_phrase,''), coalesce(sec.name, s.sector_name)), st.name);

  PERFORM public.log_ticket_event(tk.id, CASE WHEN is_recall THEN 'recalled' ELSE 'called' END,
    CASE WHEN is_recall THEN 'Chamada repetida' ELSE 'Chamada' END || ' em ' || st.name, coalesce(sec.name, s.sector_name), st.name, p_attendant);
  RETURN s;
END;
$$;

-- Call next ticket of a sector respecting queue rules
CREATE OR REPLACE FUNCTION public.call_next(p_sector_id uuid, p_station_id uuid, p_attendant text DEFAULT NULL, p_type_ids uuid[] DEFAULT NULL)
RETURNS public.ticket_steps LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  sec public.sectors;
  v_order text := 'priority_desc';
  recent_priority integer;
  v_step uuid;
  result public.ticket_steps;
BEGIN
  SELECT * INTO sec FROM public.sectors WHERE id = p_sector_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Setor não encontrado'; END IF;

  IF sec.call_mode = 'fifo' THEN
    v_order := 'fifo';
  ELSIF sec.call_mode = 'alternate' THEN
    SELECT count(*) FILTER (WHERE x.priority) INTO recent_priority FROM (
      SELECT t.priority FROM public.ticket_steps s JOIN public.tickets t ON t.id = s.ticket_id
      WHERE s.sector_id = p_sector_id AND s.called_at IS NOT NULL
      ORDER BY s.called_at DESC LIMIT greatest(sec.priority_ratio, 1)
    ) x;
    IF recent_priority > 0 THEN v_order := 'priority_asc'; END IF;
  END IF;

  SELECT s.id INTO v_step FROM public.ticket_steps s JOIN public.tickets t ON t.id = s.ticket_id
  WHERE s.sector_id = p_sector_id AND s.status = 'waiting' AND t.status = 'active'
    AND (p_type_ids IS NULL OR cardinality(p_type_ids) = 0 OR t.ticket_type_id = ANY(p_type_ids))
  ORDER BY
    CASE v_order WHEN 'priority_desc' THEN (CASE WHEN t.priority THEN 0 ELSE 1 END)
                 WHEN 'priority_asc' THEN (CASE WHEN t.priority THEN 1 ELSE 0 END)
                 ELSE 0 END,
    s.queued_at, t.created_at
  LIMIT 1
  FOR UPDATE OF s SKIP LOCKED;

  IF v_step IS NULL THEN RETURN NULL; END IF;
  result := public.call_step(v_step, p_station_id, p_attendant);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_step(p_step_id uuid, p_attendant text DEFAULT NULL)
RETURNS public.ticket_steps LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.ticket_steps;
BEGIN
  UPDATE public.ticket_steps SET status = 'in_service', started_at = coalesce(started_at, now()),
    attendant_name = coalesce(nullif(trim(coalesce(p_attendant,'')), ''), attendant_name)
  WHERE id = p_step_id AND status IN ('called','in_service') RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'A senha precisa estar chamada para iniciar o atendimento'; END IF;
  PERFORM public.log_ticket_event(s.ticket_id, 'started', 'Atendimento iniciado', s.sector_name, s.station_name, p_attendant);
  RETURN s;
END;
$$;

-- Finish a step, optionally forwarding to more sectors, and advance the route
CREATE OR REPLACE FUNCTION public.finish_step(p_step_id uuid, p_forward_sector_ids uuid[] DEFAULT NULL, p_attendant text DEFAULT NULL)
RETURNS public.tickets LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  s public.ticket_steps;
  tk public.tickets;
  sec public.sectors;
  fwd uuid;
  fsec public.sectors;
  max_seq integer;
  nxt public.ticket_steps;
  names text := '';
BEGIN
  SELECT * INTO s FROM public.ticket_steps WHERE id = p_step_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;
  IF s.status NOT IN ('called','in_service','waiting') THEN RAISE EXCEPTION 'Esta etapa já foi encerrada'; END IF;

  UPDATE public.ticket_steps SET status = 'done', finished_at = now(),
    started_at = coalesce(started_at, called_at, now()),
    attendant_name = coalesce(nullif(trim(coalesce(p_attendant,'')), ''), attendant_name)
  WHERE id = s.id RETURNING * INTO s;
  PERFORM public.log_ticket_event(s.ticket_id, 'finished', 'Atendimento concluído em ' || s.sector_name, s.sector_name, s.station_name, p_attendant);

  SELECT * INTO sec FROM public.sectors WHERE id = s.sector_id;

  IF p_forward_sector_ids IS NOT NULL AND cardinality(p_forward_sector_ids) > 0 THEN
    SELECT coalesce(max(seq), 0) INTO max_seq FROM public.ticket_steps WHERE ticket_id = s.ticket_id;
    FOREACH fwd IN ARRAY p_forward_sector_ids LOOP
      SELECT * INTO fsec FROM public.sectors WHERE id = fwd;
      IF FOUND THEN
        max_seq := max_seq + 1;
        INSERT INTO public.ticket_steps(ticket_id, sector_id, sector_name, seq, status)
        VALUES (s.ticket_id, fsec.id, fsec.name, max_seq, 'pending');
        names := names || CASE WHEN names = '' THEN '' ELSE ', ' END || fsec.name;
      END IF;
    END LOOP;
    IF names <> '' THEN
      PERFORM public.log_ticket_event(s.ticket_id, 'forwarded', 'Encaminhado para: ' || names, s.sector_name, s.station_name, p_attendant);
    END IF;
  END IF;

  SELECT * INTO nxt FROM public.ticket_steps WHERE ticket_id = s.ticket_id AND status = 'pending' ORDER BY seq LIMIT 1;

  IF NOT FOUND AND sec.auto_next_sector_id IS NOT NULL THEN
    SELECT * INTO fsec FROM public.sectors WHERE id = sec.auto_next_sector_id AND active;
    IF FOUND AND NOT EXISTS (SELECT 1 FROM public.ticket_steps WHERE ticket_id = s.ticket_id AND sector_id = fsec.id) THEN
      SELECT coalesce(max(seq), 0) + 1 INTO max_seq FROM public.ticket_steps WHERE ticket_id = s.ticket_id;
      INSERT INTO public.ticket_steps(ticket_id, sector_id, sector_name, seq, status)
      VALUES (s.ticket_id, fsec.id, fsec.name, max_seq, 'pending') RETURNING * INTO nxt;
      PERFORM public.log_ticket_event(s.ticket_id, 'forwarded', 'Encaminhamento automático para ' || fsec.name, s.sector_name, s.station_name, NULL);
    END IF;
  END IF;

  IF nxt.id IS NOT NULL THEN
    UPDATE public.ticket_steps SET status = 'waiting', queued_at = now() WHERE id = nxt.id;
    UPDATE public.tickets SET current_step_id = nxt.id, status = 'active' WHERE id = s.ticket_id RETURNING * INTO tk;
    PERFORM public.log_ticket_event(s.ticket_id, 'queued', 'Entrou na fila de ' || nxt.sector_name, nxt.sector_name, NULL, NULL);
  ELSE
    UPDATE public.tickets SET status = 'completed', completed_at = now(), current_step_id = NULL WHERE id = s.ticket_id RETURNING * INTO tk;
    PERFORM public.log_ticket_event(s.ticket_id, 'completed', 'Atendimento finalizado', s.sector_name, s.station_name, p_attendant);
  END IF;
  RETURN tk;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_no_show(p_step_id uuid, p_attendant text DEFAULT NULL)
RETURNS public.ticket_steps LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.ticket_steps;
BEGIN
  UPDATE public.ticket_steps SET status = 'no_show', finished_at = now()
  WHERE id = p_step_id AND status IN ('called','waiting','in_service') RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não disponível'; END IF;
  UPDATE public.tickets SET status = 'absent', completed_at = now() WHERE id = s.ticket_id;
  PERFORM public.log_ticket_event(s.ticket_id, 'no_show', 'Paciente não compareceu', s.sector_name, s.station_name, p_attendant);
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_step(p_step_id uuid)
RETURNS public.ticket_steps LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.ticket_steps;
BEGIN
  UPDATE public.ticket_steps SET status = 'waiting', queued_at = now(), finished_at = NULL, station_id = NULL, station_name = NULL
  WHERE id = p_step_id AND status IN ('no_show','called') RETURNING * INTO s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não disponível'; END IF;
  UPDATE public.tickets SET status = 'active', completed_at = NULL, current_step_id = s.id WHERE id = s.ticket_id;
  PERFORM public.log_ticket_event(s.ticket_id, 'requeued', 'Retornou à fila de ' || s.sector_name, s.sector_name, NULL, NULL);
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_ticket(p_ticket_id uuid, p_reason text DEFAULT NULL)
RETURNS public.tickets LANGUAGE plpgsql SET search_path = public AS $$
DECLARE tk public.tickets;
BEGIN
  UPDATE public.ticket_steps SET status = 'cancelled', finished_at = now()
  WHERE ticket_id = p_ticket_id AND status IN ('pending','waiting','called','in_service');
  UPDATE public.tickets SET status = 'cancelled', completed_at = now(), current_step_id = NULL WHERE id = p_ticket_id RETURNING * INTO tk;
  PERFORM public.log_ticket_event(p_ticket_id, 'cancelled', 'Senha cancelada' || coalesce(': ' || nullif(p_reason,''), ''), NULL, NULL, NULL);
  RETURN tk;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_open_tickets()
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer; r record;
BEGIN
  n := 0;
  FOR r IN SELECT id FROM public.tickets WHERE status = 'active' LOOP
    PERFORM public.cancel_ticket(r.id, 'encerramento das filas');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_ticket_event(uuid,text,text,text,text,text), public.issue_ticket(uuid,text), public.call_step(uuid,uuid,text),
  public.call_next(uuid,uuid,text,uuid[]), public.start_step(uuid,text), public.finish_step(uuid,uuid[],text),
  public.mark_no_show(uuid,text), public.requeue_step(uuid), public.cancel_ticket(uuid,text), public.close_open_tickets()
  TO anon, authenticated, service_role;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings, public.sectors, public.stations, public.ticket_types, public.routing_rules, public.tickets, public.ticket_steps, public.calls;

-- Initial configuration
INSERT INTO public.settings(id) VALUES (1);

INSERT INTO public.sectors(id, name, kind, call_phrase, station_label, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Recepção', 'reception', 'à Recepção', 'Guichê', 1),
  ('11111111-0000-0000-0000-000000000002', 'Raio-X', 'service', 'ao Raio-X', 'Sala', 2),
  ('11111111-0000-0000-0000-000000000003', 'Tomografia', 'service', 'à Tomografia', 'Sala', 3),
  ('11111111-0000-0000-0000-000000000004', 'Setor de coleta', 'service', 'ao setor de coleta', 'Box', 4);

INSERT INTO public.stations(sector_id, name, sort_order) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Guichê 01', 1),
  ('11111111-0000-0000-0000-000000000001', 'Guichê 02', 2),
  ('11111111-0000-0000-0000-000000000001', 'Guichê 03', 3),
  ('11111111-0000-0000-0000-000000000002', 'Sala 01', 1),
  ('11111111-0000-0000-0000-000000000002', 'Sala 02', 2),
  ('11111111-0000-0000-0000-000000000003', 'Sala 01', 1),
  ('11111111-0000-0000-0000-000000000003', 'Sala 02', 2),
  ('11111111-0000-0000-0000-000000000004', 'Box 01', 1),
  ('11111111-0000-0000-0000-000000000004', 'Box 02', 2);

INSERT INTO public.ticket_types(name, description, prefix, digits, priority, target_sector_id, sort_order) VALUES
  ('Atendimento geral', 'Exames, agendamentos e informações', 'A', 3, false, '11111111-0000-0000-0000-000000000001', 1),
  ('Preferencial', 'Idosos 60+, gestantes, PcD e lactantes', 'P', 3, true, '11111111-0000-0000-0000-000000000001', 2),
  ('Retirada de resultados', 'Entrega de laudos e exames', 'B', 3, false, '11111111-0000-0000-0000-000000000001', 3),
  ('Coleta agendada', 'Vai direto para o setor de coleta', 'COL', 3, false, '11111111-0000-0000-0000-000000000004', 4);

INSERT INTO public.routing_rules(name, sector_ids, sort_order) VALUES
  ('Raio-X', ARRAY['11111111-0000-0000-0000-000000000002']::uuid[], 1),
  ('Tomografia', ARRAY['11111111-0000-0000-0000-000000000003']::uuid[], 2),
  ('Coleta', ARRAY['11111111-0000-0000-0000-000000000004']::uuid[], 3),
  ('Raio-X + Coleta', ARRAY['11111111-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004']::uuid[], 4),
  ('Tomografia + Coleta', ARRAY['11111111-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004']::uuid[], 5),
  ('Raio-X + Tomografia + Coleta', ARRAY['11111111-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004']::uuid[], 6);

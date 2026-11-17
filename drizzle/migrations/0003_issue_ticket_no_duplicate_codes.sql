CREATE OR REPLACE FUNCTION public.issue_ticket(p_type_id uuid, p_patient_name text DEFAULT NULL::text)
 RETURNS tickets
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  -- Never reuse a code already issued today (e.g. after a manual numbering reset).
  LOOP
    v_code := t.prefix || lpad(num::text, greatest(t.digits, length(num::text)), '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.tickets
      WHERE code = v_code AND (created_at AT TIME ZONE tz)::date = today
    );
    num := num + 1;
  END LOOP;

  UPDATE public.ticket_types SET current_number = num, last_reset_date = today WHERE id = t.id;

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
$function$;
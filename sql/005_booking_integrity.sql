-- LOCAL ARTIFACT ONLY. Apply only after review, backup and explicit authorization.
-- Audited against casas-da-vila (Postgres 17). No tariff changes or data backfill.
-- Deploy this additive migration BEFORE the new checkout/webhook.
BEGIN;

-- PUBLIC privileges are inherited: revoking only anon is insufficient.
-- Retire the old unpaid confirmation path for every application role.
REVOKE EXECUTE ON FUNCTION public.confirm_reservation_from_hold(uuid,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS hold_id uuid;
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.reservations'::regclass AND conname = 'reservations_hold_id_fkey') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_hold_id_fkey
      FOREIGN KEY (hold_id) REFERENCES public.reservation_holds(id) ON DELETE RESTRICT;
  END IF;
END;
$migration$;
-- Multiple NULLs preserve historical rows. Duplicates fail rather than deleting data.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_hold_id_key ON public.reservations(hold_id);
CREATE UNIQUE INDEX IF NOT EXISTS availability_blocks_reservation_unique
  ON public.availability_blocks(reservation_id)
  WHERE reservation_id IS NOT NULL AND block_type = 'reservation';

-- Only a boolean is exposed. SECURITY DEFINER is intentional: anon must not see
-- guests/holds, but must see their effect on availability despite deny-all RLS.
CREATE OR REPLACE FUNCTION public.is_unit_available(
  p_unit_id uuid, p_check_in date, p_check_out date
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_slug text; v_name text;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in THEN
    RETURN false;
  END IF;
  SELECT u.slug, u.name INTO v_slug, v_name FROM public.units u
    WHERE u.id = p_unit_id AND u.active;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN NOT (
    EXISTS (SELECT 1 FROM public.reservations r WHERE r.unit_slug = v_slug
      AND r.status = 'confirmed'
      AND daterange(r.checkin,r.checkout,'[)') && daterange(p_check_in,p_check_out,'[)'))
    OR EXISTS (SELECT 1 FROM public.reservas r WHERE r.casa = v_name
      AND coalesce(r.status,'nova') IN ('nova','confirmada','paga')
      AND daterange(r.checkin,r.checkout,'[)') && daterange(p_check_in,p_check_out,'[)'))
    OR EXISTS (SELECT 1 FROM public.availability_blocks b WHERE b.unit_slug = v_slug
      AND b.status = 'active'
      AND (b.reservation_id IS NULL OR EXISTS (SELECT 1 FROM public.reservations r
        WHERE r.id = b.reservation_id AND r.status = 'confirmed'))
      AND daterange(b.start_date,b.end_date,'[)') && daterange(p_check_in,p_check_out,'[)'))
    OR EXISTS (SELECT 1 FROM public.reservation_holds h WHERE h.unit_id = p_unit_id
      AND h.status = 'held' AND h.expires_at > statement_timestamp()
      AND daterange(h.check_in,h.check_out,'[)') && daterange(p_check_in,p_check_out,'[)'))
  );
END;
$function$;
ALTER FUNCTION public.is_unit_available(uuid,date,date) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_unit_available(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_unit_available(uuid,date,date) TO anon, authenticated, service_role;

-- Same public signature and commercial calculation. Unit row lock serializes
-- this path with paid confirmation. Keep transactions short: no external calls.
CREATE OR REPLACE FUNCTION public.create_reservation_hold(
  p_unit_slug text, p_guest_email text, p_guest_name text, p_guest_phone text,
  p_check_in date, p_check_out date, p_guests_count integer DEFAULT 1,
  p_special_requests text DEFAULT NULL, p_hold_minutes integer DEFAULT 15
) RETURNS public.reservation_holds LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_hold public.reservation_holds;
  v_unit public.units%rowtype;
  v_amount_total numeric(12,2);
  v_required_min_nights integer;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in THEN
    RAISE EXCEPTION 'Período inválido';
  END IF;
  IF p_guests_count IS NULL OR p_guests_count < 1 THEN
    RAISE EXCEPTION 'Quantidade de hóspedes inválida';
  END IF;
  IF p_hold_minutes IS NULL OR p_hold_minutes < 1 OR p_hold_minutes > 15 THEN
    RAISE EXCEPTION 'Duração de hold inválida';
  END IF;
  SELECT * INTO v_unit FROM public.units WHERE slug = p_unit_slug AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada ou inativa'; END IF;
  IF p_guests_count > v_unit.max_guests THEN
    RAISE EXCEPTION 'Capacidade da unidade excedida';
  END IF;
  IF NOT public.is_unit_available(v_unit.id,p_check_in,p_check_out) THEN
    RAISE EXCEPTION 'Unidade indisponível para o período selecionado';
  END IF;
  v_required_min_nights := public.get_required_min_nights(v_unit.id,p_check_in,p_check_out);
  IF p_check_out - p_check_in < v_required_min_nights THEN
    RAISE EXCEPTION 'Esta unidade exige mínimo de % noites', v_required_min_nights;
  END IF;
  v_amount_total := public.calculate_dynamic_stay_price(v_unit.id,p_check_in,p_check_out);
  IF v_amount_total IS NULL OR v_amount_total <= 0 OR v_amount_total::text = 'NaN' THEN
    RAISE EXCEPTION 'Tarifa inválida';
  END IF;
  INSERT INTO public.reservation_holds (
    unit_id,guest_email,guest_name,guest_phone,check_in,check_out,guests_count,
    amount_total,currency,status,expires_at,special_requests
  ) VALUES (
    v_unit.id,lower(trim(p_guest_email)),p_guest_name,p_guest_phone,p_check_in,p_check_out,
    p_guests_count,v_amount_total,'BRL','held',
    clock_timestamp() + make_interval(mins => p_hold_minutes),p_special_requests
  ) RETURNING * INTO v_hold;
  RETURN v_hold;
END;
$function$;
ALTER FUNCTION public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)
  FROM PUBLIC, anon, authenticated;
-- hold-handler.js currently authenticates with SUPABASE_ANON_KEY.
GRANT EXECUTE ON FUNCTION public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)
  TO anon, service_role;

-- Financial evidence must come from a VERIFIED Stripe webhook, never the browser.
-- This RPC intentionally does not contact Stripe. service_role is the trust boundary.
CREATE OR REPLACE FUNCTION public.confirm_paid_reservation_from_hold(
  p_hold_id uuid, p_stripe_session_id text, p_stripe_payment_intent text,
  p_paid_amount_cents bigint, p_currency text, p_payment_status text,
  p_booking_reference text, p_session_created_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_hold public.reservation_holds%rowtype;
  v_unit public.units%rowtype;
  v_reservation public.reservations%rowtype;
  v_unit_id uuid;
  v_cents numeric;
BEGIN
  IF p_payment_status IS DISTINCT FROM 'paid' OR p_paid_amount_cents IS NULL
    OR p_paid_amount_cents <= 0 OR p_paid_amount_cents > 2147483647
    OR p_currency IS NULL OR p_stripe_session_id IS NULL
    OR p_stripe_session_id !~ '^cs_[A-Za-z0-9_]+$'
    OR p_stripe_payment_intent IS NULL OR p_stripe_payment_intent !~ '^pi_[A-Za-z0-9_]+$'
    OR p_booking_reference IS NULL OR p_booking_reference !~ '^CDV-[A-Z0-9]+$'
    OR p_session_created_at IS NULL THEN
    RAISE EXCEPTION 'Invalid paid session';
  END IF;
  SELECT unit_id INTO v_unit_id FROM public.reservation_holds WHERE id = p_hold_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hold not found'; END IF;
  -- Consistent lock order with create_reservation_hold: UNIT then HOLD.
  SELECT * INTO v_unit FROM public.units WHERE id = v_unit_id FOR UPDATE;
  SELECT * INTO v_hold FROM public.reservation_holds WHERE id = p_hold_id FOR UPDATE;
  IF NOT FOUND OR v_hold.unit_id IS DISTINCT FROM v_unit.id THEN
    RAISE EXCEPTION 'Hold changed during confirmation';
  END IF;
  v_cents := v_hold.amount_total * 100;
  IF v_cents IS NULL OR v_cents::text = 'NaN' OR v_cents <> trunc(v_cents)
    OR v_cents <> p_paid_amount_cents OR upper(p_currency) <> v_hold.currency
    OR v_hold.currency <> 'BRL' THEN
    RAISE EXCEPTION 'Payment does not match canonical hold price';
  END IF;
  -- Stripe timestamps have second precision; tolerate only truncation of that second.
  IF p_session_created_at < date_trunc('second',v_hold.created_at)
    OR p_session_created_at >= v_hold.expires_at
    OR p_session_created_at > clock_timestamp() THEN
    RAISE EXCEPTION 'Session was not created during hold validity';
  END IF;
  SELECT * INTO v_reservation FROM public.reservations
    WHERE stripe_session_id = p_stripe_session_id;
  IF FOUND THEN
    IF v_reservation.hold_id IS DISTINCT FROM p_hold_id
      OR v_reservation.amount_total IS DISTINCT FROM p_paid_amount_cents
      OR v_reservation.currency IS DISTINCT FROM lower(p_currency)
      OR v_reservation.stripe_payment_intent IS DISTINCT FROM p_stripe_payment_intent
      OR v_reservation.booking_reference IS DISTINCT FROM p_booking_reference THEN
      RAISE EXCEPTION 'Session already belongs to a different confirmation';
    END IF;
    RETURN jsonb_build_object('duplicate',true,'reservation',to_jsonb(v_reservation),
      'nights',v_reservation.checkout-v_reservation.checkin);
  END IF;
  IF v_hold.status <> 'held' OR NOT v_unit.active
    OR EXISTS (SELECT 1 FROM public.reservations WHERE hold_id = p_hold_id) THEN
    RAISE EXCEPTION 'Hold already processed or unavailable';
  END IF;
  -- Exclude our own hold inside this transaction. If any later operation fails,
  -- this update AND the reservation/block inserts roll back together.
  UPDATE public.reservation_holds SET status = 'converted' WHERE id = p_hold_id;
  IF NOT public.is_unit_available(v_unit.id,v_hold.check_in,v_hold.check_out) THEN
    RAISE EXCEPTION 'Paid booking conflict: operator reconciliation required';
  END IF;
  -- Expired holds may confirm only if session started while held AND no competing
  -- reservation/block/live hold exists. Never steal another guest's active hold.
  INSERT INTO public.reservations (
    hold_id,booking_reference,stripe_session_id,stripe_payment_intent,status,
    unit_slug,unit_name,guest_name,guest_email,guest_phone,checkin,checkout,
    guests_count,amount_total,currency,special_requests,source
  ) VALUES (
    v_hold.id,p_booking_reference,p_stripe_session_id,p_stripe_payment_intent,'confirmed',
    v_unit.slug,v_unit.name,v_hold.guest_name,v_hold.guest_email,v_hold.guest_phone,
    v_hold.check_in,v_hold.check_out,v_hold.guests_count,p_paid_amount_cents::integer,
    lower(v_hold.currency),v_hold.special_requests,'stripe'
  ) RETURNING * INTO v_reservation;
  INSERT INTO public.availability_blocks (
    reservation_id,unit_slug,start_date,end_date,block_type,status
  ) VALUES (v_reservation.id,v_unit.slug,v_hold.check_in,v_hold.check_out,'reservation','active');
  RETURN jsonb_build_object('duplicate',false,'reservation',to_jsonb(v_reservation),
    'nights',v_hold.check_out-v_hold.check_in);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)
  TO service_role;
-- Keep existing table RLS/policies and tariff functions untouched.
COMMIT;

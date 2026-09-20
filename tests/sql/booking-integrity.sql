\set ON_ERROR_STOP on
-- DESTRUCTIVE FIXTURES: ONLY an EMPTY, DISPOSABLE LOCAL PostgreSQL 17 database.
-- Run inside a local Postgres container as postgres, using local socket auth.
-- Mount this repository read-only at /work (rollback test reads that fixed path):
--   createdb cdv_booking_integrity_test
--   psql -X -d cdv_booking_integrity_test -f tests/sql/booking-integrity.sql
-- Never point this script at Supabase. It refuses other DB names / nonempty schemas.
-- dblink exercises TWO real database connections; no Stripe/network services used.
SELECT current_database() = 'cdv_booking_integrity_test'
  AND current_user = 'postgres'
  AND current_setting('server_version_num')::integer >= 170000
  AND current_setting('server_version_num')::integer < 180000
  AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public')
  AND (inet_server_addr() IS NULL OR inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)) AS safe_fixture_db \gset
\if :safe_fixture_db
\else
  \echo 'REFUSED: requires empty local cdv_booking_integrity_test database as postgres'
  \quit 3
\endif

CREATE EXTENSION dblink;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
-- Fixture mirrors the relevant audited schema (not a replacement production schema).
CREATE TABLE public.units(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE NOT NULL,
  name text NOT NULL,active boolean NOT NULL DEFAULT true,max_guests integer NOT NULL DEFAULT 4);
CREATE TABLE public.unit_pricing_rules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid UNIQUE REFERENCES public.units(id),
  nightly_min numeric(12,2),nightly_max numeric(12,2),base_min_nights integer DEFAULT 3,peak_min_nights integer DEFAULT 7);
CREATE TABLE public.reservation_holds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid NOT NULL REFERENCES public.units(id),
  guest_name text NOT NULL,guest_email text NOT NULL,guest_phone text,check_in date NOT NULL,check_out date NOT NULL,
  guests_count integer NOT NULL DEFAULT 1,amount_total numeric(12,2) NOT NULL,currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'held',expires_at timestamptz NOT NULL,special_requests text,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK(check_out>check_in));
CREATE TABLE public.reservas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),casa text,checkin date,checkout date,
  hospedes integer,nome text,email text,telefone text,mensagem text,status text DEFAULT 'nova');
CREATE TABLE public.reservations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stripe_session_id text UNIQUE,
  stripe_payment_intent text,status text NOT NULL DEFAULT 'confirmed',unit_slug text NOT NULL,unit_name text,
  guest_name text NOT NULL,guest_email text NOT NULL,guest_phone text,checkin date NOT NULL,checkout date NOT NULL,
  guests_count integer NOT NULL DEFAULT 1,amount_total integer NOT NULL,currency text NOT NULL DEFAULT 'brl',
  special_requests text,source text DEFAULT 'stripe',created_at timestamptz NOT NULL DEFAULT now(),booking_reference text UNIQUE);
CREATE TABLE public.availability_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,unit_slug text NOT NULL,
  start_date date NOT NULL,end_date date NOT NULL,block_type text NOT NULL DEFAULT 'reservation',status text NOT NULL DEFAULT 'active');
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
ALTER TABLE public.reservation_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_holds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks FORCE ROW LEVEL SECURITY;
-- Reproduce production's forced RLS and explicit deny policies.
DO $fixture$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reservation_holds','reservations','reservas','availability_blocks'] LOOP
    EXECUTE format('CREATE POLICY deny_public_select ON public.%I FOR SELECT TO anon,authenticated USING(false)',t);
    EXECUTE format('CREATE POLICY deny_public_insert ON public.%I FOR INSERT TO anon,authenticated WITH CHECK(false)',t);
    EXECUTE format('CREATE POLICY deny_public_update ON public.%I FOR UPDATE TO anon,authenticated USING(false) WITH CHECK(false)',t);
    EXECUTE format('CREATE POLICY deny_public_delete ON public.%I FOR DELETE TO anon,authenticated USING(false)',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['units','unit_pricing_rules'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY public_read ON public.%I FOR SELECT TO anon,authenticated USING(true)',t);
    EXECUTE format('CREATE POLICY deny_public_write ON public.%I FOR ALL TO anon,authenticated USING(false) WITH CHECK(false)',t);
  END LOOP;
END $fixture$;
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER trg_reservation_holds_updated_at BEFORE UPDATE ON public.reservation_holds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE FUNCTION public.confirm_reservation_from_hold(uuid,text,text DEFAULT 'paid') RETURNS json
  LANGUAGE sql SECURITY DEFINER SET search_path='public' AS $$ SELECT '{}'::json $$;
CREATE FUNCTION public.get_required_min_nights(p_unit_id uuid,p_check_in date,p_check_out date) RETURNS integer
LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM generate_series(p_check_in::timestamp,(p_check_out-1)::timestamp,interval '1 day') d
 WHERE (extract(month from d)=12 AND extract(day from d)>=20) OR (extract(month from d)=1 AND extract(day from d)<=5))
 THEN peak_min_nights ELSE base_min_nights END FROM public.unit_pricing_rules WHERE unit_id=p_unit_id
$$;
CREATE FUNCTION public.calculate_dynamic_stay_price(p_unit_id uuid,p_check_in date,p_check_out date) RETURNS numeric
LANGUAGE sql STABLE AS $$
 SELECT round(sum(CASE WHEN (extract(month from d)=12 AND extract(day from d)>=20)
 OR (extract(month from d)=1 AND extract(day from d)<=5) THEN r.nightly_max
 ELSE round(r.nightly_min * CASE WHEN p_check_out-p_check_in>=7 THEN 0.92
 WHEN p_check_out-p_check_in>=5 THEN 0.97 ELSE 1 END,2) END),2)
 FROM public.unit_pricing_rules r CROSS JOIN generate_series(p_check_in::timestamp,(p_check_out-1)::timestamp,interval '1 day') d
 WHERE r.unit_id=p_unit_id
$$;
\ir ../../sql/005_booking_integrity.sql
-- Migration must be repeatable without changes to fixtures/data.
\ir ../../sql/005_booking_integrity.sql
CREATE FUNCTION public.test_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION public.test_raises(command text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE failed boolean := false;
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected in SQLERRM)=0 THEN RAISE; END IF;
    failed := true;
  END;
  PERFORM public.test_assert(failed,'expected exception: '||expected);
END $$;
-- Exercise the actual rollback artifact before any booking data exists.
\ir ../../sql/005_booking_integrity_rollback.sql
SELECT public.test_assert(NOT has_function_privilege('service_role','public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)','EXECUTE'),'empty rollback safely disables confirmation');
SELECT public.test_assert(has_function_privilege('anon','public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)','EXECUTE'),'empty rollback preserves hold creation');
SELECT public.test_assert(to_regclass('public.reservations_hold_id_key') IS NOT NULL,'empty rollback retains schema');
\ir ../../sql/005_booking_integrity.sql
INSERT INTO public.units(id,slug,name) VALUES ('22222222-2222-4222-8222-222222222222','test-house','Test House');
INSERT INTO public.unit_pricing_rules(unit_id,nightly_min,nightly_max)
 VALUES ('22222222-2222-4222-8222-222222222222',100,200);

-- ACLs: inherited PUBLIC must not resurrect restricted RPC access.
SELECT public.test_assert(NOT has_function_privilege('anon','public.confirm_reservation_from_hold(uuid,text,text)','EXECUTE'),'old anon denied');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.confirm_reservation_from_hold(uuid,text,text)','EXECUTE'),'old authenticated denied');
SELECT public.test_assert(NOT has_function_privilege('service_role','public.confirm_reservation_from_hold(uuid,text,text)','EXECUTE'),'old service entry retired');
SELECT public.test_assert(NOT has_function_privilege('anon','public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)','EXECUTE'),'new anon denied');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)','EXECUTE'),'new authenticated denied');
SELECT public.test_assert(has_function_privilege('service_role','public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)','EXECUTE'),'new service allowed');
SELECT public.test_assert(has_function_privilege('anon','public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)','EXECUTE'),'public booking preserved');
-- Catalog invariants and all app-role grants, including PUBLIC inheritance.
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)','EXECUTE'),'create hold authenticated denied');
SELECT public.test_assert(has_function_privilege('service_role','public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)','EXECUTE'),'create hold service allowed');
SELECT public.test_assert(NOT EXISTS(
 SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.oid IN ('public.confirm_reservation_from_hold(uuid,text,text)'::regprocedure,
 'public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)'::regprocedure,
 'public.is_unit_available(uuid,date,date)'::regprocedure,
 'public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)'::regprocedure)
 AND a.grantee=0 AND a.privilege_type='EXECUTE'),'no PUBLIC execute on affected functions');
SELECT public.test_assert((SELECT bool_and(proconfig @> ARRAY['search_path=""']) FROM pg_proc
 WHERE oid IN ('public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)'::regprocedure,
 'public.is_unit_available(uuid,date,date)'::regprocedure,
 'public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)'::regprocedure)),'empty search_path on new/replaced functions');
SELECT public.test_assert((SELECT prosecdef FROM pg_proc WHERE oid='public.create_reservation_hold(text,text,text,text,date,date,integer,text,integer)'::regprocedure),'hold intentional definer');
SELECT public.test_assert((SELECT prosecdef FROM pg_proc WHERE oid='public.is_unit_available(uuid,date,date)'::regprocedure),'availability intentional definer');
SELECT public.test_assert((SELECT NOT prosecdef FROM pg_proc WHERE oid='public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)'::regprocedure),'paid confirmation invoker');
SELECT public.test_assert((SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE oid IN
 ('public.reservation_holds'::regclass,'public.reservations'::regclass,'public.reservas'::regclass,
 'public.availability_blocks'::regclass,'public.units'::regclass,'public.unit_pricing_rules'::regclass)),'forced RLS retained');
SELECT public.test_assert((SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role'),'service role bypasses RLS as audited');
SET ROLE authenticated;
SELECT public.test_raises($q$SELECT public.confirm_reservation_from_hold(NULL,'cs_test','paid')$q$,'permission denied');
SELECT public.test_raises($q$SELECT public.confirm_paid_reservation_from_hold(NULL,'cs_test','pi_test',1,'brl','paid','CDV-TEST',now())$q$,'permission denied');
SELECT public.test_raises($q$SELECT public.create_reservation_hold('test-house','g@example.test','Guest',NULL,'2030-01-01','2030-01-08')$q$,'permission denied');
RESET ROLE;
SET ROLE anon;
SELECT public.test_raises($q$SELECT public.confirm_reservation_from_hold(NULL,'cs_test','paid')$q$,'permission denied');
SELECT public.test_assert((SELECT count(*)=0 FROM public.reservation_holds),'anon cannot read holds');
SELECT public.test_raises($q$SELECT public.confirm_paid_reservation_from_hold(NULL,'cs_test','pi_test',1,'brl','paid','CDV-TEST',now())$q$,'permission denied');
SELECT id AS hold_id FROM public.create_reservation_hold('test-house','guest@example.test','Guest',NULL,'2030-03-01','2030-03-08',2) \gset
RESET ROLE;
SELECT public.test_assert((SELECT amount_total=644 FROM public.reservation_holds WHERE id=:'hold_id'),'7 nights discount retained');
SET ROLE anon;
WITH attempted AS (UPDATE public.reservation_holds SET amount_total=1 RETURNING id)
SELECT public.test_assert((SELECT count(*)=0 FROM attempted),'anon cannot update hold price');
SELECT public.test_raises($q$INSERT INTO public.reservation_holds(unit_id,guest_name,guest_email,check_in,check_out,amount_total,expires_at)
 VALUES ('22222222-2222-4222-8222-222222222222','Fake','fake@example.test','2030-10-01','2030-10-08',1,now())$q$,'row-level security');
SELECT public.test_raises($q$SELECT public.create_reservation_hold(p_unit_slug=>'test-house',p_guest_email=>'g@example.test',p_guest_name=>'Guest',p_guest_phone=>NULL,
 p_check_in=>'2030-10-01',p_check_out=>'2030-10-08',p_amount_total=>1)$q$,'does not exist');
RESET ROLE;
SELECT public.test_assert((SELECT amount_total=644 FROM public.reservation_holds WHERE id=:'hold_id'),'canonical price unchanged after tampering');
SET ROLE authenticated;
WITH attempted AS (UPDATE public.reservation_holds SET amount_total=1 RETURNING id)
SELECT public.test_assert((SELECT count(*)=0 FROM attempted),'authenticated cannot update hold price');
SELECT public.test_assert((SELECT count(*)=0 FROM public.reservation_holds),'authenticated cannot read hold');
RESET ROLE;

SELECT public.test_assert(public.calculate_dynamic_stay_price('22222222-2222-4222-8222-222222222222','2030-03-01','2030-03-06')=485,'5 nights');
SELECT public.test_assert(public.calculate_dynamic_stay_price('22222222-2222-4222-8222-222222222222','2030-03-01','2030-03-04')=300,'3 nights');
SELECT public.test_assert(public.calculate_dynamic_stay_price('22222222-2222-4222-8222-222222222222','2030-12-18','2030-12-25')=1184,'mixed season');
SET ROLE anon;
SELECT public.test_assert(NOT public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-03-01','2030-03-08'),'anon sees hold conflict');
SELECT public.test_assert(public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-03-08','2030-03-11'),'adjacent dates');
RESET ROLE;
SELECT public.test_raises(format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,1,%L,%L,%L,now())',:'hold_id','cs_test_one','pi_test_one','brl','paid','CDV-TEST'),'canonical hold price');
SELECT public.test_raises(format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,64400,%L,%L,%L,now())',:'hold_id','cs_test_one','pi_test_one','usd','paid','CDV-TEST'),'canonical hold price');
SELECT public.test_raises(format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,64400,%L,%L,%L,now())',:'hold_id','cs_test_one','pi_test_one','brl','unpaid','CDV-TEST'),'Invalid paid session');

-- Force failure BETWEEN the reservation insert and the block insert.
CREATE FUNCTION public.test_fail_block() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced block failure'; END $$;
CREATE TRIGGER test_fail_block BEFORE INSERT ON public.availability_blocks FOR EACH ROW EXECUTE FUNCTION public.test_fail_block();
SELECT public.test_raises(format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,64400,%L,%L,%L,now())',:'hold_id','cs_test_one','pi_test_one','brl','paid','CDV-TEST'),'forced block failure');
SELECT public.test_assert((SELECT count(*)=0 FROM public.reservations),'reservation rolled back');
SELECT public.test_assert((SELECT count(*)=0 FROM public.availability_blocks),'block rolled back');
SELECT public.test_assert((SELECT status='held' FROM public.reservation_holds WHERE id=:'hold_id'),'hold conversion rolled back');
DROP TRIGGER test_fail_block ON public.availability_blocks;
SET ROLE service_role;
SELECT public.confirm_paid_reservation_from_hold(:'hold_id','cs_test_one','pi_test_one',64400,'brl','paid','CDV-TEST',now());
SELECT public.test_assert((public.confirm_paid_reservation_from_hold(:'hold_id','cs_test_one','pi_test_one',64400,'brl','paid','CDV-TEST',now())->>'duplicate')::boolean,'duplicate returns same reservation');
RESET ROLE;
SELECT public.test_assert((SELECT count(*)=1 FROM public.reservations),'one reservation');
SELECT public.test_assert((SELECT count(*)=1 FROM public.availability_blocks),'one block');
SELECT public.test_assert((SELECT status='converted' FROM public.reservation_holds WHERE id=:'hold_id'),'hold converted on successful commit');
SELECT public.test_raises(format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,64400,%L,%L,%L,now())',:'hold_id','cs_test_two','pi_test_two','brl','paid','CDV-OTHER'),'already processed');
SELECT public.test_raises($q$INSERT INTO public.reservations(hold_id,unit_slug,guest_name,guest_email,checkin,checkout,amount_total)
 SELECT hold_id,unit_slug,guest_name,guest_email,checkin,checkout,amount_total FROM public.reservations LIMIT 1$q$,'reservations_hold_id_key');
SELECT public.test_raises($q$INSERT INTO public.reservations(stripe_session_id,unit_slug,guest_name,guest_email,checkin,checkout,amount_total)
 SELECT stripe_session_id,unit_slug,guest_name,guest_email,checkin,checkout,amount_total FROM public.reservations LIMIT 1$q$,'reservations_stripe_session_id_key');
SELECT public.test_raises($q$INSERT INTO public.availability_blocks(reservation_id,unit_slug,start_date,end_date)
 SELECT reservation_id,unit_slug,start_date,end_date FROM public.availability_blocks LIMIT 1$q$,'availability_blocks_reservation_unique');
-- Direct reservation must still protect inventory even if block is absent.
DELETE FROM public.availability_blocks;
SET ROLE anon;
SELECT public.test_assert(NOT public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-03-01','2030-03-08'),'canonical reservation without block');
RESET ROLE;
UPDATE public.reservations SET status='cancelled';
SELECT public.test_assert(public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-03-01','2030-03-08'),'cancelled reservation');
INSERT INTO public.reservas(casa,checkin,checkout,status) VALUES ('Test House','2030-04-01','2030-04-08','paga');
SELECT public.test_assert(NOT public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-04-01','2030-04-08'),'legacy reservation');
INSERT INTO public.availability_blocks(unit_slug,start_date,end_date,block_type) VALUES ('test-house','2030-05-01','2030-05-08','maintenance');
SELECT public.test_assert(NOT public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-05-01','2030-05-08'),'independent block');
-- Expired hold releases inventory; session started while held may confirm if free.
SELECT id AS late_id FROM public.create_reservation_hold('test-house','guest@example.test','Guest',NULL,'2030-06-01','2030-06-08',2) \gset
UPDATE public.reservation_holds SET created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes' WHERE id=:'late_id';
SELECT public.test_assert(public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-06-01','2030-06-08'),'expired hold releases inventory');
SELECT public.test_raises(format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,64400,%L,%L,%L,now())',:'late_id','cs_late','pi_late','brl','paid','CDV-LATE'),'during hold validity');
SELECT public.confirm_paid_reservation_from_hold(:'late_id','cs_late','pi_late',64400,'brl','paid','CDV-LATE',now()-interval '10 minutes');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.reservations WHERE hold_id=:'late_id' AND status='confirmed'),'late payment without conflict confirmed');

-- Expired paid hold must NOT steal a newer guest's live hold.
SELECT id AS stale_id FROM public.create_reservation_hold('test-house','guest@example.test','Guest',NULL,'2030-07-01','2030-07-08',2) \gset
UPDATE public.reservation_holds SET created_at=now()-interval '20 minutes',expires_at=now()-interval '5 minutes' WHERE id=:'stale_id';
SELECT public.create_reservation_hold('test-house','new@example.test','New Guest',NULL,'2030-07-01','2030-07-08',2);
SELECT public.test_raises(format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,64400,%L,%L,%L,now()-interval %L)',
 :'stale_id','cs_conflict','pi_conflict','brl','paid','CDV-CONFLICT','10 minutes'),'reconciliation required');
SELECT public.test_assert((SELECT status='held' FROM public.reservation_holds WHERE id=:'stale_id'),'conflicted conversion rolled back');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM public.reservations WHERE hold_id=:'stale_id'),'no conflicting paid reservation');
SELECT public.test_raises($q$SELECT public.create_reservation_hold('test-house','guest@example.test','Guest',NULL,'2030-09-01','2030-09-08',2,NULL,16)$q$,'Duração de hold inválida');

-- TWO CONNECTIONS: overlapping hold creation must produce exactly one winner.
CREATE FUNCTION public.test_race_hold() RETURNS text LANGUAGE plpgsql AS $$
DECLARE h public.reservation_holds;
BEGIN
  h := public.create_reservation_hold('test-house','race@example.test','Race',NULL,'2030-08-01','2030-08-08',2);
  PERFORM pg_sleep(0.3);
  RETURN h.id::text;
END $$;
SELECT dblink_connect('race_a','dbname=cdv_booking_integrity_test');
SELECT dblink_connect('race_b','dbname=cdv_booking_integrity_test');
SELECT public.test_assert((SELECT pid FROM dblink('race_a','SELECT pg_backend_pid()') AS r(pid integer)) <>
 (SELECT pid FROM dblink('race_b','SELECT pg_backend_pid()') AS r(pid integer)),'two independent backend processes');
SELECT dblink_send_query('race_a','SELECT public.test_race_hold()');
SELECT dblink_send_query('race_b','SELECT public.test_race_hold()');
SELECT * FROM dblink_get_result('race_a',false) AS r(id text);
SELECT * FROM dblink_get_result('race_b',false) AS r(id text);
SELECT public.test_assert((SELECT count(*)=1 FROM public.reservation_holds WHERE check_in='2030-08-01'),'concurrent holds: exactly one winner');
SELECT public.test_assert((dblink_error_message('race_a') LIKE '%indisponível%') <> (dblink_error_message('race_b') LIKE '%indisponível%'),'concurrent holds: one rejected for conflict');
-- Drain completion messages before reusing the async connections.
SELECT * FROM dblink_get_result('race_a',false) AS r(id text);
SELECT * FROM dblink_get_result('race_b',false) AS r(id text);
SELECT id AS race_hold_id FROM public.reservation_holds WHERE check_in='2030-08-01' \gset
SELECT format('SELECT public.confirm_paid_reservation_from_hold(%L,%L,%L,64400,%L,%L,%L,now())::text',
 :'race_hold_id','cs_race','pi_race','brl','paid','CDV-RACE') AS confirmation_query \gset
SELECT dblink_send_query('race_a',:'confirmation_query');
SELECT dblink_send_query('race_b',:'confirmation_query');
SELECT * FROM dblink_get_result('race_a') AS r(result text);
SELECT * FROM dblink_get_result('race_b') AS r(result text);
SELECT public.test_assert((SELECT count(*)=1 FROM public.reservations WHERE hold_id=:'race_hold_id'),'concurrent confirmations: one reservation');
SELECT public.test_assert((SELECT count(*)=1 FROM public.availability_blocks b JOIN public.reservations r ON r.id=b.reservation_id WHERE r.hold_id=:'race_hold_id'),'concurrent confirmations: one block');
SELECT dblink_disconnect('race_a');
SELECT dblink_disconnect('race_b');
-- Read the actual rollback artifact through the read-only Docker bind mount.
-- Run it in another connection so the intentionally aborted transaction does not
-- poison the test session. No row is deleted and permissions remain unchanged.
SELECT dblink_connect('rollback_guard','dbname=cdv_booking_integrity_test');
SELECT public.test_raises($q$SELECT dblink_exec('rollback_guard',pg_read_file('/work/sql/005_booking_integrity_rollback.sql'))$q$,'Rollback refused');
SELECT dblink_disconnect('rollback_guard');
SELECT public.test_assert((SELECT count(*)=3 FROM public.reservations),'refused rollback preserved every reservation');
SELECT public.test_assert(has_function_privilege('service_role','public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)','EXECUTE'),'refused rollback preserved grants');
SELECT public.test_assert(NOT public.is_unit_available('22222222-2222-4222-8222-222222222222','2030-08-01','2030-08-08'),'refused rollback preserved availability');

\echo 'PASS: integrity, permissions, availability, atomicity and real concurrent transactions'
-- Fixtures deliberately remain in this DISPOSABLE database for failure inspection.
-- Destroy the disposable database/container, never delete data in a real project.

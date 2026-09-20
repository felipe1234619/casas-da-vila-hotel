-- SAFE STOP, NOT A RETURN TO THE VULNERABLE VERSION.
-- Local artifact; do not run in production without separate authorization.
-- Prerequisites: stop new checkouts, retain webhook deliveries for reconciliation,
-- and prepare a compatible server build which still uses canonical hold prices.
-- SQL cannot roll back application code or external payments.
BEGIN;
DO $rollback$
BEGIN
  IF EXISTS (SELECT 1 FROM public.reservations WHERE hold_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback refused: confirmed hold-linked reservations exist. Keep schema/RPC and forward-fix; no data has been removed.';
  END IF;
END;
$rollback$;
-- With no converted reservations, disable the new confirmation entrypoint only.
-- The webhook will fail/retry rather than acknowledge an unrecorded payment.
REVOKE EXECUTE ON FUNCTION public.confirm_paid_reservation_from_hold(uuid,text,text,bigint,text,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.confirm_reservation_from_hold(uuid,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
-- Deliberately retain: canonical checkout, unified availability, lock discipline,
-- public hold creation, new columns/indexes, all rows and all RLS policies.
-- Never restore the pre-005 webhook/checkout as a rollback.
-- To resume after a forward fix, reapply reviewed 005 (including its grants).
COMMIT;

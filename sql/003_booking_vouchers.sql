create table if not exists public.booking_vouchers (
  id bigserial primary key,
  booking_reference text unique not null,
  stripe_session_id text,
  hold_id uuid,
  guest_name text,
  guest_email text,
  guest_phone text,
  unit_name text,
  unit_slug text,
  checkin date,
  checkout date,
  guests_count integer,
  nights integer,
  amount_total numeric,
  payment_status text,
  locale text,
  voucher_html text,
  voucher_pdf_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_booking_vouchers_reference
  on public.booking_vouchers (booking_reference);

create index if not exists idx_booking_vouchers_session
  on public.booking_vouchers (stripe_session_id);
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil'
});

function absoluteUrl(req, path) {
  const proto =
    req.headers['x-forwarded-proto'] ||
    (req.headers.host && req.headers.host.includes('localhost') ? 'http' : 'https');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}${path}`;
}

function normalizeUnitName(unitSlug) {
  const map = {
    'casa-oca': 'Casa Oca',
    'casa-dende': 'Casa Dendê',
    'casa-dos-baloes': 'Casa dos Balões',
    'casa-grande': 'Casa Grande',
    'casa-manga': 'Casa Manga',
    'casa-rosada': 'Casa Rosada',
    'casa-branca': 'Casa Branca',
    'atelie-azul': 'Ateliê Azul'
  };

  return map[unitSlug] || unitSlug || 'Selected house';
}

function diffNights(checkin, checkout) {
  if (!checkin || !checkout) return NaN;

  const [y1, m1, d1] = String(checkin).split('-').map(Number);
  const [y2, m2, d2] = String(checkout).split('-').map(Number);

  const start = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  const ms = end.getTime() - start.getTime();

  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function buildDefaultSuccessPath({
  isEN,
  bookingReference,
  unitSlug,
  guestName,
  unitName,
  checkin,
  checkout,
  guestsCount
}) {
  const base = isEN ? '/en/success/' : '/pt/sucesso/';
  const params = new URLSearchParams();

  if (bookingReference) params.set('ref', bookingReference);
  if (guestName) params.set('guest', guestName);
  if (unitName || unitSlug) params.set('house', unitName || normalizeUnitName(unitSlug));
  if (checkin) params.set('checkin', checkin);
  if (checkout) params.set('checkout', checkout);
  if (guestsCount) params.set('guests', String(guestsCount));

  params.set('session_id', '{CHECKOUT_SESSION_ID}');

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function buildDefaultCancelPath({
  isEN,
  unitSlug,
  checkin,
  checkout,
  guestsCount
}) {
  const base = isEN ? '/en/book/' : '/pt/reservar/';
  const params = new URLSearchParams();

  if (unitSlug) params.set('unit', unitSlug);
  if (checkin) params.set('checkin', checkin);
  if (checkout) params.set('checkout', checkout);
  if (guestsCount) params.set('guests', String(guestsCount));

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

// Accept only the decimal representation returned by Postgres / current frontend.
// Never infer thousands separators, round sub-cent values, or parse currency text.
function parseAmountToCents(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  if (String(input).length > 16) return null;
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(input));
  if (!match) return null;
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  // reservations.amount_total is int4 in the audited production schema.
  return cents > 0n && cents <= 2147483647n ? Number(cents) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    const body = req.body || {};

    const holdId = body.holdId || body.hold_id || '';
    if (typeof holdId !== 'string' || !UUID.test(holdId)) {
      return res.status(400).json({ error: 'Invalid holdId' });
    }
    const { data: hold, error: holdError } = await supabase
      .from('reservation_holds')
      .select(`id, unit_id, guest_name, guest_email, guest_phone, check_in, check_out,
        guests_count, amount_total, currency, status, expires_at, special_requests,
        unit:units!reservation_holds_unit_id_fkey!inner(id, slug, name, active)`)
      .eq('id', holdId)
      .maybeSingle();
    if (holdError) throw new Error('Unable to validate reservation hold');
    if (!hold || hold.status !== 'held' || !hold.unit?.active ||
        !Number.isFinite(Date.parse(hold.expires_at)) || Date.parse(hold.expires_at) <= Date.now()) {
      return res.status(409).json({ error: 'Hold unavailable or expired' });
    }

    const requestedGuests = Number(body.guestsCount ?? body.guests_count ?? body.guests);
    const requestedEmail = String(body.guestEmail || body.guest_email || '').trim().toLowerCase();
    if ((body.unitSlug || body.unit_slug) !== hold.unit.slug ||
        (body.checkin || body.checkIn) !== hold.check_in ||
        (body.checkout || body.checkOut) !== hold.check_out ||
        !Number.isInteger(requestedGuests) || requestedGuests !== hold.guests_count ||
        requestedEmail !== hold.guest_email) {
      return res.status(409).json({ error: 'Booking details do not match hold' });
    }
    const amountTotalCents = parseAmountToCents(hold.amount_total);
    const currency = String(hold.currency || '').toLowerCase();
    if (amountTotalCents === null || currency !== 'brl') {
      return res.status(409).json({ error: 'Invalid canonical hold price or currency' });
    }
    if (parseAmountToCents(body.amountTotal ?? body.amount_total) !== amountTotalCents ||
        (body.currency !== undefined && String(body.currency).toLowerCase() !== currency)) {
      return res.status(409).json({ error: 'Price or currency does not match hold' });
    }

    const unitSlug = hold.unit.slug;
    const finalUnitName = hold.unit.name;
    const checkin = hold.check_in;
    const checkout = hold.check_out;
    const finalGuestsCount = hold.guests_count;
    const guestName = hold.guest_name;
    const guestEmail = hold.guest_email;
    const guestPhone = hold.guest_phone || '';
    const specialRequests = hold.special_requests || '';
    const nights = diffNights(checkin, checkout);
    if (!Number.isInteger(nights) || nights < 1) {
      return res.status(409).json({ error: 'Invalid hold period' });
    }
    const successPathInput = body.successPath || body.success_path || '';
    const cancelPathInput = body.cancelPath || body.cancel_path || '';
    const isEN = String(successPathInput).startsWith('/en/') ||
      String(cancelPathInput).startsWith('/en/') || req.headers.referer?.includes('/en/') || false;
    const bookingReference = `CDV-${hold.id.replaceAll('-', '').toUpperCase()}`;

    const defaultSuccessPath = buildDefaultSuccessPath({
      isEN,
      bookingReference,
      unitSlug,
      guestName,
      unitName: finalUnitName,
      checkin,
      checkout,
      guestsCount: finalGuestsCount
    });

    const defaultCancelPath = buildDefaultCancelPath({
      isEN,
      unitSlug,
      checkin,
      checkout,
      guestsCount: finalGuestsCount
    });

    const sanitizedSuccessPath = defaultSuccessPath;
    const sanitizedCancelPath = defaultCancelPath;

    const successUrl = absoluteUrl(req, sanitizedSuccessPath);
    const cancelUrl = absoluteUrl(req, sanitizedCancelPath);

    const metadata = {
      booking_reference: bookingReference,
      unit_slug: unitSlug,
      unit_name: finalUnitName,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || '',
      checkin,
      checkout,
      guests_count: String(finalGuestsCount),
      nights: String(nights),
      special_requests: specialRequests || '',
      amount_total_raw: String(hold.amount_total),
      amount_total_cents: String(amountTotalCents),
      hold_id: hold.id,
      success_path: sanitizedSuccessPath,
      locale: isEN ? 'en' : 'pt'
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: hold.id,
      customer_email: guestEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountTotalCents,
            product_data: {
              name: `Reserva • ${finalUnitName}`,
              description: `${checkin} → ${checkout} • ${nights} night(s) • ${finalGuestsCount} guest(s)`
            }
          }
        }
      ]
    }, { idempotencyKey: `cdv-checkout-v1-${hold.id}` });
try {
  const { error: trackingError } = await supabase
    .from('booking_events')
    .insert({
      event_type: 'stripe_checkout_created',
      house_slug: unitSlug,
      house_name: finalUnitName,
      checkin,
      checkout,
      nights,
      guests: finalGuestsCount,
      guests_count: finalGuestsCount,
      currency: currency.toUpperCase(),
      estimated_total: amountTotalCents / 100,
      gross_total: amountTotalCents / 100,
      stripe_session_id: session.id,
      user_email: guestEmail,
      user_name: guestName,
      user_phone: guestPhone || null,
      source: 'stripe_checkout',
      language: isEN ? 'en' : 'pt',
      metadata: {
        booking_reference: bookingReference,
        hold_id: holdId || null,
        stripe_checkout_url_created: Boolean(session.url)
      }
    });

  if (trackingError) {
    console.error(
      'Failed to track Stripe checkout creation:',
      trackingError
    );
  }
} catch (trackingException) {
  console.error(
    'Unexpected Stripe checkout tracking error:',
    trackingException
  );
}
    return res.status(200).json({
      id: session.id,
      url: session.url,
      successUrl,
      cancelUrl,
      amountTotalCents,
      bookingReference
    });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({
      error: 'Internal checkout error',
      message: err.message
    });
  }
}
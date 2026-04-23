import Stripe from 'stripe';
import crypto from 'crypto';

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
  if (!checkin || !checkout) return 1;

  const [y1, m1, d1] = String(checkin).split('-').map(Number);
  const [y2, m2, d2] = String(checkout).split('-').map(Number);

  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const ms = end.getTime() - start.getTime();

  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function sanitizePath(path, fallback) {
  if (!path || typeof path !== 'string') return fallback;
  if (!path.startsWith('/')) return fallback;
  if (path.startsWith('//')) return fallback;
  return path;
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

/**
 * Recebe preço em vários formatos comuns e devolve centavos para o Stripe.
 * Exemplos aceitos:
 * 1759
 * "1759"
 * "1759.00"
 * "1.759"
 * "1.759,00"
 * "R$ 1.759,00"
 */
function parseAmountToCents(input) {
  if (input === null || input === undefined || input === '') return 0;

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return 0;
    return Math.round(input * 100);
  }

  let raw = String(input).trim();
  if (!raw) return 0;

  raw = raw.replace(/[^\d.,-]/g, '');

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  if (hasComma && hasDot) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasDot && !hasComma) {
    const parts = raw.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      raw = raw.replace(/\./g, '');
    }
  } else if (hasComma && !hasDot) {
    raw = raw.replace(',', '.');
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) return 0;

  return Math.round(value * 100);
}

function makeBookingReference() {
  return `CDV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    const body = req.body || {};

    const unitSlug = body.unitSlug || body.unit_slug || '';
    const unitName = body.unitName || body.unit_name || '';
    const checkin = body.checkin || body.checkIn || '';
    const checkout = body.checkout || body.checkOut || '';
    const guestsCount = Number(body.guestsCount || body.guests_count || body.guests || 1);
    const guestName = body.guestName || body.guest_name || '';
    const guestEmail = body.guestEmail || body.guest_email || '';
    const guestPhone = body.guestPhone || body.guest_phone || '';
    const specialRequests = body.specialRequests || body.special_requests || '';
    const amountInput = body.amountTotal ?? body.amount_total ?? 0;
    const amountTotalCents = parseAmountToCents(amountInput);
    const currency = (body.currency || 'brl').toLowerCase();
    const holdId = body.holdId || body.hold_id || '';
    const successPathInput = body.successPath || body.success_path || '';
    const cancelPathInput = body.cancelPath || body.cancel_path || '';
    const pendingBooking = body.pendingBooking || body.pending_booking || {};

    const isEN =
      String(successPathInput).startsWith('/en/') ||
      String(cancelPathInput).startsWith('/en/') ||
      req.headers.referer?.includes('/en/') ||
      false;

    if (!unitSlug || !checkin || !checkout || !guestName || !guestEmail || !amountTotalCents) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: [
          'unitSlug',
          'checkin',
          'checkout',
          'guestName',
          'guestEmail',
          'amountTotal'
        ]
      });
    }

    if (!Number.isFinite(amountTotalCents) || amountTotalCents <= 0) {
      return res.status(400).json({ error: 'Invalid amountTotal' });
    }

    const finalUnitName = unitName || normalizeUnitName(unitSlug);
    const finalGuestsCount = Number.isFinite(guestsCount) && guestsCount > 0 ? guestsCount : 1;
    const nights = diffNights(checkin, checkout);
    const bookingReference = makeBookingReference();

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

    const sanitizedSuccessPath = sanitizePath(successPathInput, defaultSuccessPath);
    const sanitizedCancelPath = sanitizePath(cancelPathInput, defaultCancelPath);

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
      amount_total_raw: String(amountInput),
      amount_total_cents: String(amountTotalCents),
      hold_id: holdId || '',
      success_path: sanitizedSuccessPath,
      locale: isEN ? 'en' : 'pt'
    };

    if (pendingBooking && typeof pendingBooking === 'object') {
      if (pendingBooking.house) metadata.pending_house = String(pendingBooking.house).slice(0, 500);
      if (pendingBooking.checkin) metadata.pending_checkin = String(pendingBooking.checkin).slice(0, 100);
      if (pendingBooking.checkout) metadata.pending_checkout = String(pendingBooking.checkout).slice(0, 100);
      if (pendingBooking.guests) metadata.pending_guests = String(pendingBooking.guests).slice(0, 100);
      if (pendingBooking.email) metadata.pending_email = String(pendingBooking.email).slice(0, 500);
      if (pendingBooking.phone) metadata.pending_phone = String(pendingBooking.phone).slice(0, 100);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
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
    });

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
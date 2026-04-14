import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
  unitSlug,
  guestName,
  unitName,
  checkin,
  checkout,
  guestsCount
}) {
  const base = isEN ? '/en/success/' : '/pt/sucesso/';
  const params = new URLSearchParams();

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
    const amountTotal = Number(body.amountTotal || body.amount_total || 0);
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

    if (!unitSlug || !checkin || !checkout || !guestName || !guestEmail || !amountTotal) {
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

    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
      return res.status(400).json({ error: 'Invalid amountTotal' });
    }

    const finalUnitName = unitName || normalizeUnitName(unitSlug);
    const finalGuestsCount = Number.isFinite(guestsCount) && guestsCount > 0 ? guestsCount : 1;
    const nights = diffNights(checkin, checkout);

    const defaultSuccessPath = buildDefaultSuccessPath({
      isEN,
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
      unit_slug: unitSlug,
      unit_name: finalUnitName,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || '',
      checkin,
      checkout,
      guests_count: String(finalGuestsCount),
      special_requests: specialRequests || '',
      amount_total: String(amountTotal),
      hold_id: holdId || '',
      success_path: sanitizedSuccessPath
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
            unit_amount: amountTotal,
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
      cancelUrl
    });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({
      error: 'Internal checkout error',
      message: err.message
    });
  }
}
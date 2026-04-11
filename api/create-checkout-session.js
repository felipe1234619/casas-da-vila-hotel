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
    'casa-branca': 'Casa Branca'
  };

  return map[unitSlug] || unitSlug || 'Casa selecionada';
}

function diffNights(checkin, checkout) {
  const start = new Date(`${checkin}T00:00:00`);
  const end = new Date(`${checkout}T00:00:00`);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    const {
      unitSlug,
      unitName,
      checkin,
      checkout,
      guestsCount,
      guestName,
      guestEmail,
      guestPhone,
      specialRequests,
      amountTotal,
      currency,
      holdId
    } = req.body || {};

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

    const finalUnitName = unitName || normalizeUnitName(unitSlug);
    const finalGuestsCount = Number(guestsCount || 1);
    const finalAmountTotal = Number(amountTotal);
    const finalCurrency = (currency || 'brl').toLowerCase();
    const nights = diffNights(checkin, checkout);

    if (!Number.isFinite(finalAmountTotal) || finalAmountTotal <= 0) {
      return res.status(400).json({ error: 'Invalid amountTotal' });
    }

    const successUrl = absoluteUrl(
      req,
      `/pt/sucesso/?session_id={CHECKOUT_SESSION_ID}&unit=${encodeURIComponent(unitSlug)}`
    );

    const cancelUrl = absoluteUrl(
      req,
      `/pt/reservar/?unit=${encodeURIComponent(unitSlug)}&checkin=${encodeURIComponent(
        checkin
      )}&checkout=${encodeURIComponent(checkout)}`
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: guestEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      metadata: {
        unit_slug: unitSlug,
        unit_name: finalUnitName,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || '',
        checkin,
        checkout,
        guests_count: String(finalGuestsCount),
        special_requests: specialRequests || '',
        amount_total: String(finalAmountTotal),
        hold_id: holdId || ''
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: finalCurrency,
            unit_amount: finalAmountTotal,
            product_data: {
              name: `Reserva • ${finalUnitName}`,
              description: `${checkin} → ${checkout} • ${nights} noite(s) • ${finalGuestsCount} hóspede(s)`
            }
          }
        }
      ]
    });

    return res.status(200).json({
      id: session.id,
      url: session.url
    });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({
      error: 'Internal checkout error',
      message: err.message
    });
  }
}
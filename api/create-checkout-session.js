import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
function getBaseUrl(req) {
  const proto =
    req.headers['x-forwarded-proto'] ||
    (req.connection && req.connection.encrypted ? 'https' : 'http');

  const host = req.headers['x-forwarded-host'] || req.headers.host;

  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      holdId,
      unitName,
      checkIn,
      checkOut,
      guestsCount,
      amountTotal,
      guestEmail
    } = req.body || {};

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY não configurada.' });
    }

    if (!holdId || !unitName || !checkIn || !checkOut || !guestsCount || !amountTotal || !guestEmail) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes para criar o checkout.' });
    }

    const parsedAmount = Number(amountTotal);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valor total inválido.' });
    }

    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: guestEmail,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: Math.round(parsedAmount * 100),
            product_data: {
              name: `Reserva • ${unitName}`,
              description: `${checkIn} → ${checkOut} • ${guestsCount} hóspede(s)`
            }
          }
        }
      ],

      metadata: {
        hold_id: String(holdId),
        unit_name: String(unitName),
        check_in: String(checkIn),
        check_out: String(checkOut),
        guests_count: String(guestsCount)
      },

      success_url: `${baseUrl}/pt/sucesso/?hold_id=${encodeURIComponent(holdId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pt/reservar/?hold_id=${encodeURIComponent(holdId)}`
    });

    return res.status(200).json({
      url: session.url
    });
  } catch (error) {
    console.error('stripe-create-checkout-session-error', error);
    return res.status(500).json({
      error: 'Erro ao criar sessão de checkout.'
    });
  }
}
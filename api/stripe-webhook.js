import Stripe from 'stripe';

const stripe = new Stripe(process.env.mk_1TKkPsGmycrlyOxTnGATFySm);

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

async function supabaseRpc(fnName, payload) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/${fnName}`,
    {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Erro ao executar RPC ${fnName}`);
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).send('Webhook secret não configurado');
  }

  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const holdId = session?.metadata?.hold_id;

      if (!holdId) {
        console.warn('checkout.session.completed sem hold_id');
        return res.status(200).json({ received: true, ignored: true });
      }

      await supabaseRpc('confirm_reservation_from_hold', {
        p_hold_id: holdId,
        p_stripe_session_id: session.id,
        p_payment_status: session.payment_status || 'paid'
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Erro processando webhook:', err);
    return res.status(500).send('Erro interno no webhook');
  }
}
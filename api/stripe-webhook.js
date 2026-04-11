import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false
  }
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function readRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function supabaseInsert(table, payload) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${table}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Supabase insert error on ${table}: ${response.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function supabaseSelectReservationBySession(sessionId) {
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/reservations` +
    `?stripe_session_id=eq.${encodeURIComponent(sessionId)}` +
    `&select=id,stripe_session_id`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Supabase select error: ${response.status} ${JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : null;
}

async function sendBookingEmails(payload) {
  if (!process.env.RESEND_API_KEY) return;

  const body = {
    from: process.env.BOOKING_FROM_EMAIL,
    to: [payload.guest_email, process.env.BOOKING_NOTIFICATION_EMAIL],
    subject: `Reserva confirmada • ${payload.unit_name || payload.unit_slug}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>Reserva confirmada</h2>
        <p><strong>Casa:</strong> ${payload.unit_name || payload.unit_slug}</p>
        <p><strong>Hóspede:</strong> ${payload.guest_name}</p>
        <p><strong>E-mail:</strong> ${payload.guest_email}</p>
        <p><strong>Telefone:</strong> ${payload.guest_phone || '-'}</p>
        <p><strong>Check-in:</strong> ${payload.checkin}</p>
        <p><strong>Check-out:</strong> ${payload.checkout}</p>
        <p><strong>Hóspedes:</strong> ${payload.guests_count}</p>
        <p><strong>Valor:</strong> R$ ${(payload.amount_total / 100).toFixed(2).replace('.', ',')}</p>
        <p><strong>Observações:</strong> ${payload.special_requests || '-'}</p>
      </div>
    `
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.text();

  if (!response.ok) {
    throw new Error(`Resend error: ${response.status} ${data}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).send('Missing STRIPE_SECRET_KEY');
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).send('Missing Supabase environment variables');
    }

    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== 'checkout.session.completed') {
      return res.status(200).json({ received: true, ignored: event.type });
    }

    const session = event.data.object;
    const metadata = session.metadata || {};

    if (!session.id) {
      return res.status(400).send('Missing session id');
    }

    const existing = await supabaseSelectReservationBySession(session.id);
    if (existing) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const reservationPayload = {
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
      status: 'confirmed',
      unit_slug: metadata.unit_slug,
      unit_name: metadata.unit_name || null,
      guest_name: metadata.guest_name,
      guest_email: metadata.guest_email,
      guest_phone: metadata.guest_phone || null,
      checkin: metadata.checkin,
      checkout: metadata.checkout,
      guests_count: Number(metadata.guests_count || 1),
      amount_total: Number(session.amount_total || metadata.amount_total || 0),
      currency: session.currency || 'brl',
      special_requests: metadata.special_requests || null,
      source: 'stripe'
    };

    const insertedReservation = await supabaseInsert('reservations', reservationPayload);
    const reservation = Array.isArray(insertedReservation)
      ? insertedReservation[0]
      : insertedReservation;

    await supabaseInsert('availability_blocks', {
      reservation_id: reservation.id,
      unit_slug: reservationPayload.unit_slug,
      start_date: reservationPayload.checkin,
      end_date: reservationPayload.checkout,
      block_type: 'reservation',
      status: 'active'
    });

    try {
      await sendBookingEmails(reservationPayload);
    } catch (mailError) {
      console.error('Email send failed:', mailError);
    }

    return res.status(200).json({
      received: true,
      reservation_id: reservation.id
    });
  } catch (err) {
    console.error('Webhook fatal error:', err);
    return res.status(500).json({
      error: 'Internal webhook error',
      message: err.message
    });
  }
}
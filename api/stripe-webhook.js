import Stripe from 'stripe';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false
  }
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil'
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

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
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
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

async function supabaseUpsert(table, payload, onConflict) {
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/${table}` +
    `?on_conflict=${encodeURIComponent(onConflict)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates'
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
      `Supabase upsert error on ${table}: ${response.status} ${JSON.stringify(data)}`
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
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Supabase select error: ${response.status} ${JSON.stringify(data)}`);
  }

  return Array.isArray(data) ? data[0] : null;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoneyBRLFromCents(valueInCents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(valueInCents || 0) / 100);
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(d);
}

function buildRateRows(checkin, nights, amountTotalCents) {
  const total = Number(amountTotalCents || 0);
  const safeNights = Math.max(1, Number(nights || 1));
  const perNight = Math.floor(total / safeNights);

  let allocated = 0;
  const rows = [];

  for (let i = 0; i < safeNights; i++) {
    const date = new Date(`${checkin}T12:00:00`);
    date.setDate(date.getDate() + i);

    let amount = perNight;
    if (i === safeNights - 1) {
      amount = total - allocated;
    } else {
      allocated += perNight;
    }

    rows.push({
      dateLabel: new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(date),
      amount
    });
  }

  return rows;
}

function renderVoucherHtml(payload) {
  const {
    booking_reference,
    unit_name,
    guest_name,
    guest_email,
    guest_phone,
    checkin,
    checkout,
    guests_count,
    amount_total,
    payment_status
  } = payload;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${checkout}T12:00:00`).getTime() - new Date(`${checkin}T12:00:00`).getTime()) /
      86400000
    )
  );

  const rows = buildRateRows(checkin, nights, amount_total)
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.dateLabel)}</td>
        <td>Diária</td>
        <td style="text-align:right">${formatMoneyBRLFromCents(row.amount)}</td>
      </tr>
    `)
    .join('');

  const paymentLabel =
    String(payment_status || '').toLowerCase() === 'paid' ? 'Pago' : 'Pendente';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Voucher ${escapeHtml(booking_reference)} | Casas da Vila</title>
<style>
  :root{
    --bg:#f3efe8;
    --paper:#fffdf9;
    --ink:#1a1a1a;
    --muted:#6f675e;
    --line:rgba(26,26,26,.10);
    --blue:#123c8c;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink)}
  body{
    font-family:Georgia,"Times New Roman",serif;
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
    padding:30px 18px;
  }
  .sheet{
    max-width:900px;
    margin:0 auto;
    background:var(--paper);
    box-shadow:0 18px 60px rgba(0,0,0,.08);
    overflow:hidden;
  }
  .topbar{
    height:8px;
    background:linear-gradient(90deg,#49d0d3 0%,#1aa7be 22%,#174dc7 54%,#1b379e 72%,#8a2d36 100%);
  }
  .hero{
    min-height:250px;
    padding:34px 38px;
    display:flex;
    align-items:flex-end;
    background:
      linear-gradient(to bottom, rgba(8,12,18,.18), rgba(8,12,18,.48)),
      url('/assets/img/voucher/voucher-hero.jpg') center/cover no-repeat;
  }
  .brand{
    color:#fff;
    max-width:600px;
  }
  .brand-mark{
    text-transform:uppercase;
    letter-spacing:.28em;
    font-size:11px;
    margin-bottom:12px;
    opacity:.92;
  }
  .brand h1{
    margin:0;
    font-size:34px;
    line-height:1.05;
    font-weight:500;
    letter-spacing:.04em;
  }
  .brand p{
    margin:10px 0 0;
    font-size:14px;
    line-height:1.7;
    opacity:.92;
  }
  .body{
    padding:36px 38px;
  }
  .headline{
    display:flex;
    justify-content:space-between;
    gap:20px;
    align-items:end;
    padding-bottom:24px;
    border-bottom:1px solid var(--line);
    margin-bottom:28px;
  }
  .kicker{
    margin:0 0 10px;
    text-transform:uppercase;
    letter-spacing:.18em;
    font-size:11px;
    color:var(--muted);
  }
  .headline h2{
    margin:0;
    font-size:30px;
    line-height:1.08;
    font-weight:500;
  }
  .ref{
    text-align:right;
    min-width:220px;
  }
  .label{
    text-transform:uppercase;
    letter-spacing:.16em;
    font-size:10px;
    color:var(--muted);
    margin-bottom:8px;
  }
  .code{
    font-size:18px;
    font-weight:600;
    letter-spacing:.08em;
  }
  .grid{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:18px 24px;
    margin-bottom:28px;
  }
  .card{
    border:1px solid var(--line);
    padding:16px 18px;
    background:rgba(255,255,255,.72);
  }
  .value{
    font-size:17px;
    line-height:1.5;
  }
  .section{
    padding-top:26px;
    margin-top:26px;
    border-top:1px solid var(--line);
  }
  .section h3{
    margin:0 0 14px;
    font-size:22px;
    line-height:1.2;
    font-weight:500;
  }
  table{
    width:100%;
    border-collapse:collapse;
  }
  th,td{
    padding:12px 0;
    border-bottom:1px solid var(--line);
    font-size:14px;
    vertical-align:top;
  }
  th{
    text-align:left;
    font-weight:500;
    color:var(--muted);
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:10px;
  }
  .total{
    display:flex;
    justify-content:space-between;
    gap:18px;
    align-items:end;
    margin-top:18px;
  }
  .total span{
    font-size:13px;
    text-transform:uppercase;
    letter-spacing:.16em;
    color:var(--muted);
  }
  .total strong{
    font-size:32px;
    color:var(--blue);
    line-height:1;
  }
  .notes{
    font-size:15px;
    line-height:1.85;
    color:#2f2b27;
  }
  .footer{
    padding:26px 38px 34px;
    background:#f8f5ef;
    border-top:1px solid var(--line);
    color:#49433c;
    line-height:1.7;
    font-size:13px;
  }
  @media print{
    body{padding:0;background:#fff}
    .sheet{max-width:none;box-shadow:none}
  }
  @media (max-width:720px){
    .hero{padding:24px}
    .body{padding:24px}
    .footer{padding:22px 24px 28px}
    .headline{display:block}
    .ref{text-align:left;margin-top:14px}
    .grid{grid-template-columns:1fr}
    .total{display:block}
    .total strong{display:block;margin-top:10px}
    .brand h1{font-size:28px}
    .headline h2{font-size:26px}
  }
</style>
</head>
<body>
  <main class="sheet">
    <div class="topbar"></div>

    <section class="hero">
      <div class="brand">
        <div class="brand-mark">Casas da Vila</div>
        <h1>Voucher de Reserva</h1>
        <p>Hospitalidade autoral em Trancoso, com serviço discreto e atmosfera de casa privada.</p>
      </div>
    </section>

    <section class="body">
      <div class="headline">
        <div>
          <p class="kicker">Confirmação de reserva</p>
          <h2>Sua estadia está confirmada</h2>
        </div>
        <div class="ref">
          <div class="label">Booking reference</div>
          <div class="code">${escapeHtml(booking_reference)}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Hóspede</div>
          <div class="value">${escapeHtml(guest_name)}</div>
        </div>
        <div class="card">
          <div class="label">E-mail</div>
          <div class="value">${escapeHtml(guest_email)}</div>
        </div>
        <div class="card">
          <div class="label">Telefone</div>
          <div class="value">${escapeHtml(guest_phone || '—')}</div>
        </div>
        <div class="card">
          <div class="label">Casa</div>
          <div class="value">${escapeHtml(unit_name || '')}</div>
        </div>
        <div class="card">
          <div class="label">Check-in</div>
          <div class="value">${escapeHtml(formatDateBR(checkin))}</div>
        </div>
        <div class="card">
          <div class="label">Check-out</div>
          <div class="value">${escapeHtml(formatDateBR(checkout))}</div>
        </div>
        <div class="card">
          <div class="label">Hóspedes</div>
          <div class="value">${escapeHtml(String(guests_count || 1))}</div>
        </div>
        <div class="card">
          <div class="label">Pagamento</div>
          <div class="value">${escapeHtml(paymentLabel)}</div>
        </div>
      </div>

      <section class="section">
        <h3>Detalhes da hospedagem</h3>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th style="text-align:right">Valor</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="total">
          <span>Valor total da reserva</span>
          <strong>${formatMoneyBRLFromCents(amount_total)}</strong>
        </div>
      </section>

      <section class="section">
        <h3>Informações da estadia</h3>
        <div class="notes">
          Check-in a partir de 14h.<br>
          Check-out até 12h.<br>
          Café da manhã incluído.<br>
          Para orientações de chegada ou suporte antes da sua estadia, nossa equipe permanece à disposição.
        </div>
      </section>
    </section>

    <footer class="footer">
      Casas da Vila<br>
      Trancoso, Bahia — Brasil<br><br>
      +55 73 99143-5522<br>
      casasdavila@casasdavila.com
    </footer>
  </main>
</body>
</html>`;
}

async function htmlToPdfBuffer(html) {
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: chromium.headless,
    defaultViewport: {
      width: 1440,
      height: 2200,
      deviceScaleFactor: 1
    }
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: ['domcontentloaded', 'networkidle0']
    });

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '14mm',
        left: '12mm'
      }
    });
  } finally {
    await browser.close();
  }
}

async function createVoucherPdfAndStore(payload) {
  const voucherHtml = renderVoucherHtml(payload);
  const pdfBuffer = await htmlToPdfBuffer(voucherHtml);
  const pdfPath = `bookings/${payload.booking_reference}/voucher-${payload.booking_reference}.pdf`;

  const upload = await supabaseAdmin.storage
    .from('vouchers')
    .upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (upload.error) {
    throw upload.error;
  }

  await supabaseUpsert('booking_vouchers', {
    booking_reference: payload.booking_reference,
    stripe_session_id: payload.stripe_session_id,
    hold_id: payload.hold_id || null,
    guest_name: payload.guest_name,
    guest_email: payload.guest_email,
    guest_phone: payload.guest_phone || null,
    unit_name: payload.unit_name || null,
    unit_slug: payload.unit_slug || null,
    checkin: payload.checkin,
    checkout: payload.checkout,
    guests_count: payload.guests_count,
    nights: payload.nights,
    amount_total: payload.amount_total,
    payment_status: payload.payment_status,
    locale: payload.locale || 'pt',
    voucher_html: voucherHtml,
    voucher_pdf_path: pdfPath,
    updated_at: new Date().toISOString()
  }, 'booking_reference');

  return { voucherHtml, pdfPath };
}

async function sendBookingEmails(payload) {
  if (!process.env.RESEND_API_KEY) return;

  const voucherUrl = `${process.env.SITE_URL || ''}/voucher/${encodeURIComponent(payload.booking_reference)}`;

  const body = {
    from: process.env.BOOKING_FROM_EMAIL,
    to: [payload.guest_email, process.env.BOOKING_NOTIFICATION_EMAIL],
    subject: `Reserva confirmada • ${payload.unit_name || payload.unit_slug}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>Reserva confirmada</h2>
        <p><strong>Casa:</strong> ${escapeHtml(payload.unit_name || payload.unit_slug || '')}</p>
        <p><strong>Hóspede:</strong> ${escapeHtml(payload.guest_name || '')}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(payload.guest_email || '')}</p>
        <p><strong>Telefone:</strong> ${escapeHtml(payload.guest_phone || '-')}</p>
        <p><strong>Check-in:</strong> ${escapeHtml(payload.checkin || '')}</p>
        <p><strong>Check-out:</strong> ${escapeHtml(payload.checkout || '')}</p>
        <p><strong>Hóspedes:</strong> ${escapeHtml(String(payload.guests_count || 1))}</p>
        <p><strong>Valor:</strong> ${formatMoneyBRLFromCents(payload.amount_total)}</p>
        <p><strong>Observações:</strong> ${escapeHtml(payload.special_requests || '-')}</p>
        <p><strong>Voucher:</strong> <a href="${voucherUrl}">${voucherUrl}</a></p>
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

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

    const amountTotalCents =
      Number(session.amount_total || 0) ||
      Number(metadata.amount_total_cents || 0) ||
      0;

    const nights =
      Number(metadata.nights || 0) ||
      Math.max(
        1,
        Math.round(
          (new Date(`${metadata.checkout}T12:00:00`).getTime() -
            new Date(`${metadata.checkin}T12:00:00`).getTime()) / 86400000
        )
      );

    const reservationPayload = {
      booking_reference: metadata.booking_reference || null,
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
      amount_total: amountTotalCents,
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

    const voucherPayload = {
      booking_reference:
        reservationPayload.booking_reference || `CDV-${session.id.slice(-8).toUpperCase()}`,
      stripe_session_id: session.id,
      hold_id: metadata.hold_id || null,
      guest_name: reservationPayload.guest_name,
      guest_email: reservationPayload.guest_email,
      guest_phone: reservationPayload.guest_phone,
      unit_name: reservationPayload.unit_name,
      unit_slug: reservationPayload.unit_slug,
      checkin: reservationPayload.checkin,
      checkout: reservationPayload.checkout,
      guests_count: reservationPayload.guests_count,
      nights,
      amount_total: amountTotalCents,
      payment_status: session.payment_status || 'paid',
      locale: metadata.locale || 'pt',
      special_requests: reservationPayload.special_requests
    };

    try {
      await createVoucherPdfAndStore(voucherPayload);
    } catch (voucherError) {
      console.error('Voucher generation failed:', voucherError);
    }

    try {
      await sendBookingEmails(voucherPayload);
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
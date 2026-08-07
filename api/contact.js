import { createClient } from "@supabase/supabase-js";

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false
          }
        }
      )
    : null;

function clean(value, maxLength = 2000) {
  if (value === null || value === undefined) return "";

  return String(value)
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDate(value) {
  if (!value) return "—";

  try {
    const date = new Date(`${value}T12:00:00`);

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  } catch {
    return value;
  }
}

async function saveLead(payload) {
  if (!supabaseAdmin) {
    console.warn(
      "Contact: Supabase environment variables are not configured."
    );

    return {
      saved: false,
      reason: "supabase_not_configured"
    };
  }

  /*
   * Importante:
   * o formulário não deve deixar de funcionar caso a estrutura
   * atual da tabela leads tenha colunas diferentes.
   *
   * Por isso, uma falha de persistência é registrada no log,
   * mas não impede o envio da mensagem por e-mail.
   */

const stayDetails = [
  payload.message || null,
  payload.house_interest
    ? `Casa de interesse: ${payload.house_interest}`
    : null,
  payload.checkin
    ? `Check-in: ${payload.checkin}`
    : null,
  payload.checkout
    ? `Check-out: ${payload.checkout}`
    : null,
  payload.guests
    ? `Hóspedes: ${payload.guests}`
    : null,
  payload.locale
    ? `Idioma: ${payload.locale}`
    : null,
  payload.page
    ? `Página: ${payload.page}`
    : null
]
  .filter(Boolean)
  .join("\n\n");

const lead = {
  name: payload.name || null,
  email: payload.email || null,
  phone: payload.phone || null,

  interest:
    payload.house_interest ||
    payload.interest ||
    "Hospedagem",

  interest_type:
    payload.interest ||
    "hotel",

  message:
    stayDetails || null,

  status: "new",

  source: "website-contact"
};
  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert(lead)
    .select()
    .single();

  if (error) {
    console.error("Contact Supabase insert failed:", error);

    return {
      saved: false,
      reason: error.message
    };
  }

  return {
    saved: true,
    id: data?.id || null
  };
}

async function sendContactEmail(payload) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const recipient =
    process.env.CONTACT_NOTIFICATION_EMAIL ||
    process.env.BOOKING_NOTIFICATION_EMAIL;

  if (!recipient) {
    throw new Error(
      "Missing CONTACT_NOTIFICATION_EMAIL or BOOKING_NOTIFICATION_EMAIL"
    );
  }

  if (!process.env.BOOKING_FROM_EMAIL) {
    throw new Error("Missing BOOKING_FROM_EMAIL");
  }

  const locale = payload.locale === "en" ? "en" : "pt";

  const subject =
    locale === "en"
      ? `New website inquiry • ${payload.name}`
      : `Novo contato pelo site • ${payload.name}`;

  const html = `
    <div style="
      font-family:Arial,Helvetica,sans-serif;
      max-width:680px;
      margin:0 auto;
      color:#171717;
      line-height:1.65;
    ">

      <div style="
        border-bottom:1px solid #ddd;
        padding-bottom:18px;
        margin-bottom:24px;
      ">
        <div style="
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.18em;
          color:#777;
          margin-bottom:8px;
        ">
          CASAS DA VILA
        </div>

        <h2 style="
          font-weight:500;
          margin:0;
          font-size:26px;
        ">
          ${
            locale === "en"
              ? "New website inquiry"
              : "Novo contato pelo site"
          }
        </h2>
      </div>

      <p>
        <strong>Nome / Name:</strong><br>
        ${escapeHtml(payload.name || "—")}
      </p>

      <p>
        <strong>E-mail:</strong><br>
        ${escapeHtml(payload.email || "—")}
      </p>

      <p>
        <strong>Telefone / Phone:</strong><br>
        ${escapeHtml(payload.phone || "—")}
      </p>

      <p>
        <strong>Interesse / Interest:</strong><br>
        ${escapeHtml(payload.interest || "—")}
      </p>

      <p>
        <strong>Casa de interesse / House:</strong><br>
        ${escapeHtml(payload.house_interest || "—")}
      </p>

      <p>
        <strong>Check-in:</strong><br>
        ${escapeHtml(formatDate(payload.checkin))}
      </p>

      <p>
        <strong>Check-out:</strong><br>
        ${escapeHtml(formatDate(payload.checkout))}
      </p>

      <p>
        <strong>Hóspedes / Guests:</strong><br>
        ${escapeHtml(payload.guests || "—")}
      </p>

      <div style="
        margin-top:24px;
        padding:18px;
        background:#f7f5f1;
      ">
        <strong>Mensagem / Message</strong>

        <div style="
          margin-top:8px;
          white-space:pre-wrap;
        ">
          ${escapeHtml(payload.message || "—")}
        </div>
      </div>

      <p style="
        margin-top:28px;
        font-size:12px;
        color:#777;
      ">
        Página de origem:
        ${escapeHtml(payload.page || "—")}
        <br>
        Idioma:
        ${escapeHtml(payload.locale || "—")}
      </p>
    </div>
  `;

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        from: process.env.BOOKING_FROM_EMAIL,
        to: [recipient],

        /*
         * Ao responder no cliente de e-mail,
         * a resposta vai diretamente para o hóspede.
         */
        reply_to: payload.email,

        subject,
        html
      })
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Resend error: ${response.status} ${text}`
    );
  }

  return text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed"
    });
  }

  try {
    const body = req.body || {};

    /*
     * Honeypots existentes no formulário.
     * Usuários reais deixam estes campos vazios.
     */
    if (body.company || body.website) {
      return res.status(200).json({
        ok: true
      });
    }

    /*
     * Proteção simples contra submissões
     * praticamente instantâneas.
     */
    const formStartedAt = Number(body.formStartedAt || 0);

    if (
      formStartedAt > 0 &&
      Date.now() - formStartedAt < 1500
    ) {
      return res.status(200).json({
        ok: true
      });
    }

    const payload = {
      locale:
        clean(body.locale, 10).toLowerCase() === "en"
          ? "en"
          : "pt",

      page: clean(body.page, 500),

      name: clean(body.name, 160),

      email: clean(body.email, 320).toLowerCase(),

      phone: clean(body.phone, 80),

      interest: clean(body.interest, 160),

      checkin: clean(body.checkin, 30),

      checkout: clean(body.checkout, 30),

      guests: clean(body.guests, 30),

      house_interest: clean(
        body.house_interest,
        160
      ),

      message: clean(body.message, 5000)
    };

    if (!payload.name) {
      return res.status(400).json({
        ok: false,
        error: "Name is required"
      });
    }

    if (
      !payload.email ||
      !isValidEmail(payload.email)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Valid email is required"
      });
    }

    /*
     * Primeiro preservamos o lead no Supabase.
     * Uma eventual incompatibilidade de schema
     * será registrada, sem derrubar o formulário.
     */
    let databaseResult = {
      saved: false
    };

    try {
      databaseResult =
        await saveLead(payload);
    } catch (databaseError) {
      console.error(
        "Contact database error:",
        databaseError
      );
    }

    /*
     * O e-mail é a entrega operacional principal.
     */
    await sendContactEmail(payload);

    return res.status(200).json({
      ok: true,
      saved: databaseResult.saved,
      lead_id: databaseResult.id || null
    });
  } catch (error) {
    console.error(
      "Contact endpoint error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Unable to send contact request",

      message:
        process.env.NODE_ENV === "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}
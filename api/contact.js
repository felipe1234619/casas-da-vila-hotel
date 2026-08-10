import { createClient } from "@supabase/supabase-js";

/* =========================================================
   SUPABASE
========================================================= */

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

/* =========================================================
   HELPERS
========================================================= */

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

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  } catch {
    return value;
  }
}

function parseGuests(value) {
  if (!value) return null;

  const parsed = Number.parseInt(String(value), 10);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

/* =========================================================
   CONTACT NOTIFICATION EMAILS

   Hoje:
   CONTACT_NOTIFICATION_EMAILS=
   casasdavilatrancoso@hotmail.com

   Futuramente:
   CONTACT_NOTIFICATION_EMAILS=
   casasdavilatrancoso@hotmail.com,casasdavila@casasdavila.com

   Também aceita, para compatibilidade:
   CONTACT_NOTIFICATION_EMAIL
   BOOKING_NOTIFICATION_EMAIL
========================================================= */

function getNotificationEmails() {
  const candidates = [
    ...(process.env.CONTACT_NOTIFICATION_EMAILS || "")
      .split(",")
      .map((email) => email.trim()),

    process.env.CONTACT_NOTIFICATION_EMAIL || "",

    process.env.BOOKING_NOTIFICATION_EMAIL || ""
  ];

  return [
    ...new Set(
      candidates
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email && isValidEmail(email))
    )
  ];
}

/* =========================================================
   CONTACT FORM EVENT AUDIT
========================================================= */

async function saveContactEvent(
  eventType,
  payload,
  extra = {}
) {
  if (!supabaseAdmin) {
    console.warn(
      "Contact event not saved: Supabase is not configured."
    );

    return {
      saved: false,
      reason: "supabase_not_configured"
    };
  }

  const event = {
    event_type: eventType,

    locale:
      payload.locale || null,

    page_path:
      payload.page || null,

    visitor_id:
      payload.visitor_id ||
      extra.visitor_id ||
      null,

    session_id:
      payload.session_id ||
      extra.session_id ||
      null,

    name:
      payload.name || null,

    email:
      payload.email || null,

    phone:
      payload.phone || null,

    interest:
      payload.interest || null,

    house_interest:
      payload.house_interest || null,

    checkin:
      payload.checkin || null,

    checkout:
      payload.checkout || null,

    guests:
      parseGuests(payload.guests),

    error_message:
      extra.error_message || null,

    metadata:
      extra.metadata || {}
  };

  const { data, error } = await supabaseAdmin
    .from("contact_form_events")
    .insert(event)
    .select("id")
    .single();

  if (error) {
    console.error(
      `Contact event insert failed [${eventType}]:`,
      error
    );

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

/* =========================================================
   SAVE LEAD
========================================================= */

async function saveLead(payload) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase environment variables are not configured"
    );
  }

  /*
   * A tabela public.leads possui atualmente:
   *
   * id
   * name
   * email
   * phone
   * message
   * interest
   * interest_type
   * budget_range
   * timeline
   * score
   * tier
   * status
   * source
   * created_at
   *
   * Como check-in, checkout, hóspedes etc. ainda não possuem
   * colunas próprias, preservamos tudo dentro de message.
   */

  const stayDetails = [
    payload.message
      ? payload.message
      : null,

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
    name:
      payload.name || null,

    email:
      payload.email || null,

    phone:
      payload.phone || null,

    message:
      stayDetails || null,

    interest:
      payload.house_interest ||
      payload.interest ||
      "Hospedagem",

    interest_type:
      payload.interest ||
      "hotel",

    status:
      "new",

    source:
      "website-contact"
  };

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert(lead)
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Supabase lead insert failed: ${error.message}`
    );
  }

  return {
    saved: true,
    id: data?.id || null
  };
}

/* =========================================================
   EMAIL VIA RESEND
   OPTIONAL — formulário NÃO depende dele
========================================================= */

async function sendContactEmail(payload) {
  /*
   * Se o Resend não estiver configurado,
   * não existe erro fatal.
   *
   * O lead continua armazenado no Supabase.
   */

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "RESEND_API_KEY not configured. Contact email skipped."
    );

    return {
      attempted: false,
      sent: false,
      reason: "resend_not_configured"
    };
  }

  const recipients = getNotificationEmails();

  if (!recipients.length) {
    console.warn(
      "No contact notification email configured."
    );

    return {
      attempted: false,
      sent: false,
      reason: "recipient_not_configured"
    };
  }

  /*
   * CONTACT_FROM_EMAIL pode ser criado futuramente.
   *
   * Enquanto isso, reaproveitamos BOOKING_FROM_EMAIL,
   * se ele já estiver validado no Resend.
   */

  const fromEmail =
    process.env.CONTACT_FROM_EMAIL ||
    process.env.BOOKING_FROM_EMAIL;

  if (!fromEmail) {
    console.warn(
      "No authorized sender configured. Contact email skipped."
    );

    return {
      attempted: false,
      sent: false,
      reason: "sender_not_configured",
      recipients
    };
  }

  const locale =
    payload.locale === "en"
      ? "en"
      : "pt";

  const subject =
    locale === "en"
      ? `New Casas da Vila inquiry • ${payload.name}`
      : `Novo contato Casas da Vila • ${payload.name}`;

  const html = `
    <!doctype html>
    <html>
      <body style="
        margin:0;
        padding:0;
        background:#f4f1eb;
        font-family:Arial,Helvetica,sans-serif;
        color:#191919;
      ">

        <div style="
          max-width:680px;
          margin:30px auto;
          background:#ffffff;
          padding:34px;
          border:1px solid #e5e0d8;
        ">

          <div style="
            font-size:11px;
            text-transform:uppercase;
            letter-spacing:.20em;
            color:#777;
            margin-bottom:10px;
          ">
            CASAS DA VILA
          </div>

          <h1 style="
            margin:0 0 28px;
            font-family:Georgia,'Times New Roman',serif;
            font-size:28px;
            font-weight:500;
          ">
            ${
              locale === "en"
                ? "New website inquiry"
                : "Novo contato pelo site"
            }
          </h1>

          <table
            cellpadding="0"
            cellspacing="0"
            style="
              width:100%;
              border-collapse:collapse;
              font-size:15px;
              line-height:1.6;
            "
          >

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
                width:180px;
              ">
                Nome / Name
              </td>

              <td style="padding:9px 0;">
                <strong>
                  ${escapeHtml(payload.name || "—")}
                </strong>
              </td>
            </tr>

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
              ">
                E-mail
              </td>

              <td style="padding:9px 0;">
                ${escapeHtml(payload.email || "—")}
              </td>
            </tr>

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
              ">
                Telefone / Phone
              </td>

              <td style="padding:9px 0;">
                ${escapeHtml(payload.phone || "—")}
              </td>
            </tr>

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
              ">
                Interesse / Interest
              </td>

              <td style="padding:9px 0;">
                ${escapeHtml(payload.interest || "—")}
              </td>
            </tr>

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
              ">
                Casa / House
              </td>

              <td style="padding:9px 0;">
                ${escapeHtml(payload.house_interest || "—")}
              </td>
            </tr>

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
              ">
                Check-in
              </td>

              <td style="padding:9px 0;">
                ${escapeHtml(formatDate(payload.checkin))}
              </td>
            </tr>

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
              ">
                Check-out
              </td>

              <td style="padding:9px 0;">
                ${escapeHtml(formatDate(payload.checkout))}
              </td>
            </tr>

            <tr>
              <td style="
                padding:9px 0;
                color:#777;
              ">
                Hóspedes / Guests
              </td>

              <td style="padding:9px 0;">
                ${escapeHtml(payload.guests || "—")}
              </td>
            </tr>

          </table>

          <div style="
            margin-top:28px;
            padding:20px;
            background:#f8f6f2;
            border-left:3px solid #222;
          ">

            <div style="
              font-size:11px;
              letter-spacing:.15em;
              text-transform:uppercase;
              color:#777;
              margin-bottom:10px;
            ">
              Mensagem / Message
            </div>

            <div style="
              white-space:pre-wrap;
              font-size:15px;
              line-height:1.7;
            ">
              ${escapeHtml(payload.message || "—")}
            </div>

          </div>

          <div style="
            margin-top:30px;
            padding-top:18px;
            border-top:1px solid #eee;
            font-size:12px;
            line-height:1.7;
            color:#777;
          ">

            Página:
            ${escapeHtml(payload.page || "—")}
            <br>

            Idioma:
            ${escapeHtml(payload.locale || "—")}

          </div>

        </div>

      </body>
    </html>
  `;

  const body = {
    from: fromEmail,

    to: recipients,

    subject,

    html
  };

  /*
   * Quando clicarmos em "Responder",
   * o cliente de e-mail deve responder diretamente ao hóspede.
   */

  if (payload.email && isValidEmail(payload.email)) {
    body.reply_to = payload.email;
  }

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${process.env.RESEND_API_KEY}`,

        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify(body)
    }
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Resend error ${response.status}: ${responseText}`
    );
  }

  let responseData = null;

  try {
    responseData =
      responseText
        ? JSON.parse(responseText)
        : null;
  } catch {
    responseData =
      responseText || null;
  }

  return {
    attempted: true,
    sent: true,
    recipients,
    resend_id:
      responseData?.id || null
  };
}

/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed"
    });
  }

  /*
   * Mantemos uma referência para utilizar
   * também no catch principal.
   */

  let payload = null;

  try {
    const body =
      req.body || {};

    /* =====================================================
       HONEYPOT ANTISPAM
    ===================================================== */

    if (
      clean(body.company, 200) ||
      clean(body.website, 500)
    ) {
      /*
       * Bots recebem 200 para não aprenderem
       * que foram identificados.
       */

      return res.status(200).json({
        ok: true
      });
    }

    /* =====================================================
       TIME-BASED ANTISPAM
    ===================================================== */

    const formStartedAt =
      Number(body.formStartedAt || 0);

    if (
      formStartedAt > 0 &&
      Date.now() - formStartedAt < 1500
    ) {
      return res.status(200).json({
        ok: true
      });
    }

    /* =====================================================
       NORMALIZE PAYLOAD
    ===================================================== */

    payload = {
      locale:
        clean(body.locale, 10)
          .toLowerCase() === "en"
          ? "en"
          : "pt",

      page:
        clean(body.page, 500),

      name:
        clean(body.name, 160),

      email:
        clean(body.email, 320)
          .toLowerCase(),

      phone:
        clean(body.phone, 80),

      interest:
        clean(body.interest, 160),

      checkin:
        clean(body.checkin, 30),

      checkout:
        clean(body.checkout, 30),

      guests:
        clean(body.guests, 30),

      house_interest:
        clean(body.house_interest, 160),

      message:
        clean(body.message, 5000),

      /*
       * Estes dois já ficam disponíveis caso
       * passemos a enviá-los pelo frontend.
       */

      visitor_id:
        clean(body.visitor_id, 200),

      session_id:
        clean(body.session_id, 200)
    };

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!payload.name) {
      return res.status(400).json({
        ok: false,
        error:
          payload.locale === "en"
            ? "Name is required"
            : "Nome é obrigatório"
      });
    }

    if (
      !payload.email ||
      !isValidEmail(payload.email)
    ) {
      return res.status(400).json({
        ok: false,
        error:
          payload.locale === "en"
            ? "Valid email is required"
            : "Informe um e-mail válido"
      });
    }

    /* =====================================================
       AUDIT — SUBMIT
    ===================================================== */

    await saveContactEvent(
      "contact_form_submit",
      payload,
      {
        metadata: {
          received_at:
            new Date().toISOString()
        }
      }
    );

    /* =====================================================
       SAVE LEAD
    ===================================================== */

    let leadResult = null;
    let leadError = null;

    try {
      leadResult =
        await saveLead(payload);
    } catch (error) {
      leadError = error;

      console.error(
        "Contact lead save failed:",
        error
      );
    }

    /* =====================================================
       OPTIONAL EMAIL
    ===================================================== */

    let emailResult = {
      attempted: false,
      sent: false
    };

    let emailError = null;

    try {
      emailResult =
        await sendContactEmail(payload);
    } catch (error) {
      emailError = error;

      console.error(
        "Contact email failed:",
        error
      );

      /*
       * IMPORTANTE:
       * falha de Resend NÃO derruba o formulário
       * se o lead já foi preservado no Supabase.
       */
    }

    /* =====================================================
       SUCCESS CONDITION

       Basta termos preservado o lead no Supabase
       OU enviado o e-mail.

       Na arquitetura atual, o Supabase é o canal
       principal e o e-mail é complementar.
    ===================================================== */

    const leadSaved =
      Boolean(leadResult?.saved);

    const emailSent =
      Boolean(emailResult?.sent);

    if (
      !leadSaved &&
      !emailSent
    ) {
      const failureMessage =
        leadError?.message ||
        emailError?.message ||
        "Contact request could not be preserved";

      await saveContactEvent(
        "contact_form_error",
        payload,
        {
          error_message:
            failureMessage,

          metadata: {
            lead_saved: false,

            email_attempted:
              Boolean(emailResult?.attempted),

            email_sent:
              false
          }
        }
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to process contact request"
      });
    }

    /* =====================================================
       AUDIT — SUCCESS
    ===================================================== */

    await saveContactEvent(
      "contact_form_success",
      payload,
      {
        metadata: {
          lead_saved:
            leadSaved,

          lead_id:
            leadResult?.id || null,

          email_attempted:
            Boolean(emailResult?.attempted),

          email_sent:
            emailSent,

          email_recipients:
            emailResult?.recipients || [],

          resend_id:
            emailResult?.resend_id || null,

          email_error:
            emailError?.message || null
        }
      }
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      ok: true,

      saved:
        leadSaved,

      lead_id:
        leadResult?.id || null,

      email_sent:
        emailSent
    });

  } catch (error) {
    console.error(
      "Contact endpoint error:",
      error
    );

    /* =====================================================
       LAST-CHANCE ERROR AUDIT
    ===================================================== */

    try {
      if (payload) {
        await saveContactEvent(
          "contact_form_error",
          payload,
          {
            error_message:
              error?.message ||
              String(error),

            metadata: {
              fatal: true
            }
          }
        );
      }
    } catch (eventError) {
      console.error(
        "Unable to save fatal contact event:",
        eventError
      );
    }

    return res.status(500).json({
      ok: false,

      error:
        "Unable to process contact request",

      message:
        process.env.NODE_ENV === "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}
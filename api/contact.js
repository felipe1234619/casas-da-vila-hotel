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
   BASIC HELPERS
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

function parseGuests(value) {
  if (!value) return null;

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < 1 || parsed > 50) {
    return null;
  }

  return parsed;
}

function formatDate(value) {
  if (!value) return "—";

  try {
    const date = new Date(`${value}T12:00:00Z`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  } catch {
    return value;
  }
}

/* =========================================================
   DATE VALIDATION
========================================================= */

function parseISODate(value) {
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const currentYear = new Date().getUTCFullYear();

  /*
   * Evita datas absurdas como 51201-02-02
   * sem limitar excessivamente reservas futuras.
   */
  if (
    year < currentYear - 1 ||
    year > currentYear + 10 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function validateStayPeriod(checkin, checkout) {
  if (checkin && !parseISODate(checkin)) {
    return {
      ok: false,
      code: "invalid_checkin",
      error: "Invalid check-in date"
    };
  }

  if (checkout && !parseISODate(checkout)) {
    return {
      ok: false,
      code: "invalid_checkout",
      error: "Invalid check-out date"
    };
  }

  /*
   * Se apenas uma das datas foi fornecida,
   * não bloqueamos o contato.
   */
  if (!checkin || !checkout) {
    return {
      ok: true
    };
  }

  const start = parseISODate(checkin);
  const end = parseISODate(checkout);

  if (!start || !end) {
    return {
      ok: false,
      code: "invalid_dates",
      error: "Invalid stay dates"
    };
  }

  if (end <= start) {
    return {
      ok: false,
      code: "checkout_before_checkin",
      error: "Check-out must be after check-in"
    };
  }

  const nights =
    Math.round(
      (end.getTime() - start.getTime()) /
        86400000
    );

  if (nights > 180) {
    return {
      ok: false,
      code: "stay_too_long",
      error: "Stay period exceeds maximum allowed"
    };
  }

  return {
    ok: true,
    nights
  };
}

/* =========================================================
   SPAM ANALYSIS
========================================================= */

function analyzeSpam(payload) {
  const text = [
    payload.name,
    payload.email,
    payload.interest,
    payload.house_interest,
    payload.message
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const strongSignals = [
    "seo services",
    "seo service",
    "search engine optimization",
    "backlinks",
    "backlink",
    "rank your website",
    "rank your site",
    "website ranking",
    "google ranking",
    "increase traffic",
    "drive traffic",
    "drive visitors",
    "get seen online",
    "digital marketing services",
    "marketing agency",
    "lead generation",
    "generate leads",
    "web development services",
    "website development services",
    "guest post",
    "guest posting"
  ];

  const mediumSignals = [
    "keywords",
    "website traffic",
    "online visibility",
    "first page google",
    "social media marketing",
    "business promotion",
    "promote your website",
    "organic traffic"
  ];

  let score = 0;
  const reasons = [];

  for (const signal of strongSignals) {
    if (text.includes(signal)) {
      score += 40;
      reasons.push(signal);
    }
  }

  for (const signal of mediumSignals) {
    if (text.includes(signal)) {
      score += 20;
      reasons.push(signal);
    }
  }

  /*
   * Domínios/padrões comerciais conhecidos
   * acrescentam evidência, mas não bastam sozinhos.
   */

  if (
    payload.email &&
    (
      payload.email.endsWith("@jmailservice.com") ||
      payload.email.includes("marketing")
    )
  ) {
    score += 30;
    reasons.push("commercial email pattern");
  }

  /*
   * Limite conservador para evitar falso positivo.
   * O contato nunca é apagado: apenas classificado.
   */

  const finalScore =
    Math.min(score, 100);

  return {
    isSpam:
      finalScore >= 60,

    score:
      finalScore,

    reason:
      reasons.length
        ? [...new Set(reasons)].join(", ")
        : null
  };
}

/* =========================================================
   CONTACT NOTIFICATION EMAILS

   Hoje:
   CONTACT_NOTIFICATION_EMAILS=
   casasdavilatrancoso@hotmail.com

   Futuramente:
   CONTACT_NOTIFICATION_EMAILS=
   casasdavilatrancoso@hotmail.com,casasdavila@casasdavila.com

   Compatibilidade:
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
        .map((email) =>
          email.trim().toLowerCase()
        )
        .filter(
          (email) =>
            email &&
            isValidEmail(email)
        )
    )
  ];
}

/* =========================================================
   CONTACT FORM AUDIT
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
    event_type:
      eventType,

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

  const { data, error } =
    await supabaseAdmin
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

  const spam =
    analyzeSpam(payload);

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
      spam.isSpam
        ? "spam"
        : "new",

    source:
      "website-contact",

    is_spam:
      spam.isSpam,

    spam_score:
      spam.score,

    spam_reason:
      spam.reason,

    updated_at:
      new Date().toISOString()
  };

  const { data, error } =
    await supabaseAdmin
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
    id: data?.id || null,
    is_spam: spam.isSpam,
    spam_score: spam.score,
    spam_reason: spam.reason
  };
}

/* =========================================================
   EMAIL VIA RESEND

   OPCIONAL:
   formulário continua funcionando sem Resend.
========================================================= */

async function sendContactEmail(payload) {
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

  const recipients =
    getNotificationEmails();

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
              <td style="padding:9px 0;color:#777;width:180px;">
                Nome / Name
              </td>
              <td style="padding:9px 0;">
                <strong>
                  ${escapeHtml(payload.name || "—")}
                </strong>
              </td>
            </tr>

            <tr>
              <td style="padding:9px 0;color:#777;">
                E-mail
              </td>
              <td style="padding:9px 0;">
                ${escapeHtml(payload.email || "—")}
              </td>
            </tr>

            <tr>
              <td style="padding:9px 0;color:#777;">
                Telefone / Phone
              </td>
              <td style="padding:9px 0;">
                ${escapeHtml(payload.phone || "—")}
              </td>
            </tr>

            <tr>
              <td style="padding:9px 0;color:#777;">
                Interesse / Interest
              </td>
              <td style="padding:9px 0;">
                ${escapeHtml(payload.interest || "—")}
              </td>
            </tr>

            <tr>
              <td style="padding:9px 0;color:#777;">
                Casa / House
              </td>
              <td style="padding:9px 0;">
                ${escapeHtml(payload.house_interest || "—")}
              </td>
            </tr>

            <tr>
              <td style="padding:9px 0;color:#777;">
                Check-in
              </td>
              <td style="padding:9px 0;">
                ${escapeHtml(formatDate(payload.checkin))}
              </td>
            </tr>

            <tr>
              <td style="padding:9px 0;color:#777;">
                Check-out
              </td>
              <td style="padding:9px 0;">
                ${escapeHtml(formatDate(payload.checkout))}
              </td>
            </tr>

            <tr>
              <td style="padding:9px 0;color:#777;">
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

  const emailBody = {
    from:
      fromEmail,

    to:
      recipients,

    subject,

    html
  };

  if (
    payload.email &&
    isValidEmail(payload.email)
  ) {
    emailBody.reply_to =
      payload.email;
  }

  const response =
    await fetch(
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
          JSON.stringify(emailBody)
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

  let payload = null;

  try {
    const body =
      req.body || {};

    /* =====================================================
       CONTACT FORM STARTED

       Esta chamada não é um lead.
       Apenas registra que alguém começou a preencher.
    ===================================================== */

    if (
      clean(body.action, 50) ===
      "contact_form_started"
    ) {
      const startedPayload = {
        locale:
          clean(body.locale, 10)
            .toLowerCase() === "en"
            ? "en"
            : "pt",

        page:
          clean(body.page, 500),

        name: "",
        email: "",
        phone: "",
        interest: "",
        house_interest: "",
        checkin: "",
        checkout: "",
        guests: "",

        visitor_id:
          clean(body.visitor_id, 200),

        session_id:
          clean(body.session_id, 200)
      };

      await saveContactEvent(
        "contact_form_started",
        startedPayload,
        {
          metadata: {
            started_at:
              new Date().toISOString()
          }
        }
      );

      return res.status(200).json({
        ok: true
      });
    }

    /* =====================================================
       HONEYPOT ANTISPAM
    ===================================================== */

    if (
      clean(body.company, 200) ||
      clean(body.website, 500)
    ) {
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

      visitor_id:
        clean(body.visitor_id, 200),

      session_id:
        clean(body.session_id, 200)
    };

    /* =====================================================
       REQUIRED FIELDS
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
       DATE VALIDATION
    ===================================================== */

    const stayValidation =
      validateStayPeriod(
        payload.checkin,
        payload.checkout
      );

    if (!stayValidation.ok) {
      await saveContactEvent(
        "contact_form_error",
        payload,
        {
          error_message:
            stayValidation.error,

          metadata: {
            validation_error: true,
            validation_code:
              stayValidation.code || null
          }
        }
      );

      return res.status(400).json({
        ok: false,

        error:
          payload.locale === "en"
            ? "Please check your stay dates."
            : "Por favor, verifique as datas da estadia."
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
            new Date().toISOString(),

          nights:
            stayValidation.nights || null
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

       Spam é preservado no Supabase, mas não gera
       notificação por e-mail.
    ===================================================== */

    let emailResult = {
      attempted: false,
      sent: false
    };

    let emailError = null;

    if (leadResult?.is_spam) {
      emailResult = {
        attempted: false,
        sent: false,
        reason: "classified_as_spam"
      };
    } else {
      try {
        emailResult =
          await sendContactEmail(payload);
      } catch (error) {
        emailError = error;

        console.error(
          "Contact email failed:",
          error
        );
      }
    }

    /* =====================================================
       SUCCESS CONDITION

       Supabase é o canal principal.
       E-mail é complementar.
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
            lead_saved:
              false,

            email_attempted:
              Boolean(
                emailResult?.attempted
              ),

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

          is_spam:
            Boolean(
              leadResult?.is_spam
            ),

          spam_score:
            leadResult?.spam_score || 0,

          spam_reason:
            leadResult?.spam_reason || null,

          email_attempted:
            Boolean(
              emailResult?.attempted
            ),

          email_sent:
            emailSent,

          email_recipients:
            emailResult?.recipients || [],

          email_skip_reason:
            emailResult?.reason || null,

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
          ? error?.message ||
            String(error)
          : undefined
    });
  }
}
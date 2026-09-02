import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const allowedOrigins = [
  "https://casasdavila.com",
  "https://www.casasdavila.com",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501"
];

const ALLOWED_BOT_LIKELIHOODS = new Set([
  "low",
  "medium",
  "high"
]);

const ALLOWED_DEVICE_TYPES = new Set([
  "desktop",
  "mobile",
  "tablet",
  "unknown"
]);

function getRequestOrigin(req) {
  const protocol =
    req.headers["x-forwarded-proto"] ||
    (req.headers.host?.includes("localhost")
      ? "http"
      : "https");

  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host;

  return host
    ? `${protocol}://${host}`
    : "";
}

function isAllowedOrigin(req, origin) {
  if (!origin) return true;

  const isOfficialOrigin =
    allowedOrigins.includes(origin);

  const isSameOrigin =
    origin === getRequestOrigin(req);

  const isVercelPreview =
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(
      origin
    );

  return (
    isOfficialOrigin ||
    isSameOrigin ||
    isVercelPreview
  );
}

function getClientIp(req) {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded
      .split(",")[0]
      .trim();
  }

  return (
    req.headers["x-real-ip"] ||
    req.headers["cf-connecting-ip"] ||
    req.socket?.remoteAddress ||
    null
  );
}

function hashIp(ip) {
  if (!ip) return null;

  return crypto
    .createHash("sha256")
    .update(
      `${ip}:${
        process.env.IP_HASH_SALT ||
        "casas-da-vila"
      }`
    )
    .digest("hex");
}

function parseGeoNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(
    String(value).replace(",", ".")
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function safeDecode(value) {
  if (!value) return null;

  try {
    return decodeURIComponent(
      String(value)
    );
  } catch (_) {
    return String(value);
  }
}

function cleanText(
  value,
  maxLength = 500
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) return null;

  return text.slice(
    0,
    maxLength
  );
}

function cleanUrl(
  value,
  maxLength = 2000
) {
  return cleanText(
    value,
    maxLength
  );
}

function cleanBoolean(value) {
  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function cleanInteger(
  value,
  min = null,
  max = null
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (
    min !== null &&
    parsed < min
  ) {
    return min;
  }

  if (
    max !== null &&
    parsed > max
  ) {
    return max;
  }

  return parsed;
}

function cleanTimestamp(value) {
  if (!value) return null;

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return date.toISOString();
}

function sanitizeMetadata(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  try {
    const json =
      JSON.stringify(value);

    if (json.length > 10000) {
      return {
        truncated: true
      };
    }

    return value;
  } catch (_) {
    return {};
  }
}

function getServerBotAssessment(
  userAgent = ""
) {
  const ua =
    String(userAgent)
      .toLowerCase();

  let score = 0;

  const highPatterns = [
    "googlebot",
    "bingbot",
    "baiduspider",
    "yandexbot",
    "gptbot",
    "claudebot",
    "ahrefs",
    "semrush",
    "mj12bot"
  ];

  const mediumPatterns = [
    "bot",
    "crawl",
    "crawler",
    "spider",
    "scraper",
    "headless",
    "python",
    "curl",
    "wget",
    "node-fetch",
    "axios",
    "monitor",
    "uptime"
  ];

  const previewPatterns = [
    "facebookexternalhit",
    "slackbot",
    "telegrambot",
    "whatsapp",
    "preview"
  ];

  if (
    highPatterns.some(
      (pattern) =>
        ua.includes(pattern)
    )
  ) {
    score += 100;
  }

  if (
    mediumPatterns.some(
      (pattern) =>
        ua.includes(pattern)
    )
  ) {
    score += 70;
  }

  if (
    previewPatterns.some(
      (pattern) =>
        ua.includes(pattern)
    )
  ) {
    score += 50;
  }

  if (score >= 70) {
    return {
      suspected: true,
      likelihood: "high"
    };
  }

  if (score >= 30) {
    return {
      suspected: true,
      likelihood: "medium"
    };
  }

  return {
    suspected: false,
    likelihood: "low"
  };
}

function normalizeBotAssessment(
  body,
  userAgent
) {
  const server =
    getServerBotAssessment(
      userAgent
    );

  const clientLikelihood =
    ALLOWED_BOT_LIKELIHOODS.has(
      body.bot_likelihood
    )
      ? body.bot_likelihood
      : null;

  const clientSuspected =
    cleanBoolean(
      body.is_bot_suspected
    );

  const rank = {
    low: 1,
    medium: 2,
    high: 3
  };

  let likelihood =
    server.likelihood;

  if (
    clientLikelihood &&
    rank[clientLikelihood] >
      rank[likelihood]
  ) {
    likelihood =
      clientLikelihood;
  }

  const suspected =
    server.suspected ||
    clientSuspected === true ||
    likelihood !== "low";

  return {
    suspected,
    likelihood
  };
}

function sanitizeReferrerSource(
  value
) {
  const allowed = new Set([
    "direct",
    "internal",
    "google",
    "bing",
    "instagram",
    "facebook",
    "x",
    "linkedin",
    "chatgpt",
    "whatsapp",
    "external"
  ]);

  const normalized =
    cleanText(value, 50)
      ?.toLowerCase();

  return allowed.has(normalized)
    ? normalized
    : normalized
      ? "external"
      : null;
}

function sanitizeDeviceType(
  value
) {
  const normalized =
    cleanText(value, 30)
      ?.toLowerCase();

  if (
    ALLOWED_DEVICE_TYPES.has(
      normalized
    )
  ) {
    return normalized;
  }

  return "unknown";
}

export default async function handler(
  req,
  res
) {
  const origin =
    req.headers.origin || "";

  const originAllowed =
    isAllowedOrigin(
      req,
      origin
    );

  if (
    origin &&
    originAllowed
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader(
    "Vary",
    "Origin"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Credentials",
    "true"
  );

  if (
    req.method === "OPTIONS"
  ) {
    return res
      .status(204)
      .end();
  }

  if (
    req.method !== "POST"
  ) {
    return res
      .status(405)
      .json({
        error:
          "Method not allowed"
      });
  }

  if (
    origin &&
    !originAllowed
  ) {
    return res
      .status(403)
      .json({
        error:
          "Origin not allowed"
      });
  }

  try {
    const body =
      req.body || {};

    const ip =
      getClientIp(req);

    const headerUserAgent =
      req.headers[
        "user-agent"
      ] || "";

    const userAgent =
      cleanText(
        body.user_agent,
        2000
      ) ||
      cleanText(
        headerUserAgent,
        2000
      );

    const country =
      cleanText(
        req.headers[
          "x-vercel-ip-country"
        ],
        10
      ) ||
      null;

    const city =
      safeDecode(
        req.headers[
          "x-vercel-ip-city"
        ]
      );

    const region =
      safeDecode(
        req.headers[
          "x-vercel-ip-country-region"
        ]
      );

    const latitude =
      parseGeoNumber(
        req.headers[
          "x-vercel-ip-latitude"
        ] ||
        req.headers[
          "x-vercel-ip-lat"
        ] ||
        req.headers[
          "x-geo-latitude"
        ]
      );

    const longitude =
      parseGeoNumber(
        req.headers[
          "x-vercel-ip-longitude"
        ] ||
        req.headers[
          "x-vercel-ip-lon"
        ] ||
        req.headers[
          "x-geo-longitude"
        ]
      );

    const hasCoordinates =
      latitude !== null &&
      longitude !== null;

    const bot =
      normalizeBotAssessment(
        body,
        userAgent
      );

    const payload = {
      event_type:
        cleanText(
          body.event_type,
          100
        ) || "page_view",

      page_url:
        cleanUrl(
          body.page_url
        ),

      page_path:
        cleanText(
          body.page_path,
          1000
        ),

      page_title:
        cleanText(
          body.page_title,
          500
        ),

      referrer:
        cleanUrl(
          body.referrer
        ),

      referrer_source:
        sanitizeReferrerSource(
          body.referrer_source
        ),

      referrer_domain:
        cleanText(
          body.referrer_domain,
          255
        ),

      language:
        cleanText(
          body.language,
          50
        ),

      locale:
        cleanText(
          body.locale,
          50
        ),

      timezone:
        cleanText(
          body.timezone,
          100
        ),

      timezone_offset:
        cleanInteger(
          body.timezone_offset,
          -1440,
          1440
        ),

      local_time:
        cleanText(
          body.local_time,
          100
        ),

      user_agent:
        userAgent,

      screen_width:
        cleanInteger(
          body.screen_width,
          0,
          10000
        ),

      screen_height:
        cleanInteger(
          body.screen_height,
          0,
          10000
        ),

      visitor_id:
        cleanText(
          body.visitor_id,
          200
        ),

      session_id:
        cleanText(
          body.session_id,
          200
        ),

      landing_page:
        cleanText(
          body.landing_page,
          1000
        ),

      first_page_of_session:
        cleanBoolean(
          body.first_page_of_session
        ),

      is_returning_visitor:
        cleanBoolean(
          body.is_returning_visitor
        ),

      visitor_visit_number:
        cleanInteger(
          body.visitor_visit_number,
          1,
          1000000
        ),

      session_started_at:
        cleanTimestamp(
          body.session_started_at
        ),

      last_activity_at:
        cleanTimestamp(
          body.last_activity_at
        ) ||
        new Date().toISOString(),

      utm_source:
        cleanText(
          body.utm_source,
          255
        ),

      utm_medium:
        cleanText(
          body.utm_medium,
          255
        ),

      utm_campaign:
        cleanText(
          body.utm_campaign,
          500
        ),

      utm_term:
        cleanText(
          body.utm_term,
          500
        ),

      utm_content:
        cleanText(
          body.utm_content,
          500
        ),

      device_type:
        sanitizeDeviceType(
          body.device_type
        ),

      browser_name:
        cleanText(
          body.browser_name,
          100
        ),

      browser_version:
        cleanText(
          body.browser_version,
          100
        ),

      operating_system:
        cleanText(
          body.operating_system,
          100
        ),

      is_bot_suspected:
        bot.suspected,

      bot_likelihood:
        bot.likelihood,

      metadata:
        sanitizeMetadata(
          body.metadata
        ),

      country,
      city,
      region,

      latitude,
      longitude,

      geo_source:
        hasCoordinates
          ? "vercel_headers"
          : "vercel_country_city_only",

      geo_accuracy:
        hasCoordinates
          ? "approximate"
          : "country_city",

      ip_hash:
        hashIp(ip)
    };

    const {
      data,
      error
    } = await supabase
      .from("site_events")
      .insert(payload)
      .select(
        [
          "id",
          "created_at",
          "event_type",
          "visitor_id",
          "session_id",
          "landing_page",
          "first_page_of_session",
          "is_returning_visitor",
          "visitor_visit_number",
          "referrer_source",
          "device_type",
          "browser_name",
          "operating_system",
          "bot_likelihood",
          "country",
          "city"
        ].join(",")
      )
      .single();

    if (error) {
      console.error(
        "site_events insert error:",
        error
      );

      return res
        .status(400)
        .json({
          ok: false,
          error:
            error.message
        });
    }

    return res
      .status(200)
      .json({
        ok: true,
        event: data
      });
  } catch (err) {
    console.error(
      "site-event error:",
      err
    );

    return res
      .status(500)
      .json({
        ok: false,
        error:
          "Internal error"
      });
  }
}
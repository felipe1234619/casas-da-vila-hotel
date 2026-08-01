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
function getRequestOrigin(req) {
  const protocol =
    req.headers["x-forwarded-proto"] ||
    (req.headers.host?.includes("localhost") ? "http" : "https");

  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host;

  return host ? `${protocol}://${host}` : "";
}

function isAllowedOrigin(req, origin) {
  if (!origin) return true;

  return (
    allowedOrigins.includes(origin) ||
    origin === getRequestOrigin(req)
  );
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();

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
    .update(`${ip}:${process.env.IP_HASH_SALT || "casas-da-vila"}`)
    .digest("hex");
}

function isBot(userAgent = "") {
  return /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slackbot|gptbot|claudebot|bingbot|googlebot/i.test(
    userAgent
  );
}
function parseGeoNumber(value) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
export default async function handler(req, res) {
  const origin = req.headers.origin || "";
const originAllowed = isAllowedOrigin(req, origin);

if (origin && originAllowed) {
  res.setHeader("Access-Control-Allow-Origin", origin);
}

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

if (origin && !originAllowed) {
  return res.status(403).json({ error: "Origin not allowed" });
}
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const country =
      req.headers["x-vercel-ip-country"] ||
      req.headers["x-vercel-ip-country-region"] ||
      null;

    const city = req.headers["x-vercel-ip-city"]
      ? decodeURIComponent(req.headers["x-vercel-ip-city"])
      : null;

    const region = req.headers["x-vercel-ip-country-region"] || null;
const latitude = parseGeoNumber(
  req.headers["x-vercel-ip-latitude"] ||
  req.headers["x-vercel-ip-lat"] ||
  req.headers["x-geo-latitude"]
);

const longitude = parseGeoNumber(
  req.headers["x-vercel-ip-longitude"] ||
  req.headers["x-vercel-ip-lon"] ||
  req.headers["x-geo-longitude"]
);

const geoSource =
  latitude !== null && longitude !== null
    ? "vercel_headers"
    : "vercel_country_city_only";
    const body = req.body || {};

    const payload = {
      ...body,
country,
city,
region,
latitude,
longitude,
geo_source: geoSource,
geo_accuracy: latitude !== null && longitude !== null ? "approximate" : "country_city",
ip_hash: hashIp(ip),
      user_agent: body.user_agent || userAgent,
      is_bot_suspected:
        typeof body.is_bot_suspected === "boolean"
          ? body.is_bot_suspected
          : isBot(userAgent)
    };

    const { error } = await supabase.from("site_events").insert(payload);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
}
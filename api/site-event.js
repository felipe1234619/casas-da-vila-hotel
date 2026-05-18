import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const origin = req.headers.origin || "";

    const allowedOrigins = [
      "https://casasdavila.com",
      "https://www.casasdavila.com",
      "http://127.0.0.1:5500",
      "http://127.0.0.1:5501"
    ];

    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    const ip = getClientIp(req);

    const country =
      req.headers["x-vercel-ip-country"] ||
      req.headers["x-vercel-ip-country-region"] ||
      null;

    const city =
      req.headers["x-vercel-ip-city"]
        ? decodeURIComponent(req.headers["x-vercel-ip-city"])
        : null;

    const region =
      req.headers["x-vercel-ip-country-region"] || null;

    const payload = {
      ...req.body,
      country,
      city,
      region,
      ip_hash: hashIp(ip)
    };

    const { error } = await supabase
      .from("site_events")
      .insert(payload);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal error" });
  }
}
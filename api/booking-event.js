import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    const { error } = await supabase.from("booking_events").insert({
      event_type: body.event_type || null,

      page_url: body.page_url || null,
      page_path: body.page_path || null,
      referrer: body.referrer || null,
      language: body.language || null,
      timezone: body.timezone || null,
      source: body.source || "booking_frontend",

      visitor_id: body.visitor_id || null,
      session_id: body.session_id || null,

      house_slug: body.house_slug || null,
      house_name: body.house_name || null,

      checkin: body.checkin || null,
      checkout: body.checkout || null,
      nights: body.nights || null,
      guests: body.guests || null,
      guests_count: body.guests_count || body.guests || null,

      currency: body.currency || "BRL",
      estimated_total: body.estimated_total || null,

      availability_status: body.availability_status || null,
      available_units_count: body.available_units_count || null,
      available_units: body.available_units || null,
      unavailable_reason: body.unavailable_reason || null,

      stripe_session_id: body.stripe_session_id || null,
      booking_id: body.booking_id || null,

      user_email: body.user_email || null,
      user_name: body.user_name || null,
      user_phone: body.user_phone || null,

      user_agent: body.user_agent || null,
      metadata: body.metadata || {}
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
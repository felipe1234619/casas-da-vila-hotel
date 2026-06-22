import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        visitor_id: body.visitor_id || null,
        session_id: body.session_id || null,
        page_path: body.page_path || null,
        page_url: body.page_url || null,
        country: body.country || null,
        city: body.city || null,
        status: "open"
      })
      .select("*")
      .single();

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({
      ok: true,
      chat_session: data
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
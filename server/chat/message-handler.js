import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      const body = req.body || {};

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          chat_session_id: body.chat_session_id,
          sender: body.sender || "visitor",
          message: body.message,
          is_read: false
        })
        .select("*")
        .single();

      if (error) return res.status(400).json({ error: error.message });

      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", body.chat_session_id);

      return res.status(200).json({ ok: true, message: data });
    }

    if (req.method === "GET") {
      const chatSessionId = req.query.chat_session_id;

      if (!chatSessionId) {
        return res.status(400).json({ error: "Missing chat_session_id" });
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_session_id", chatSessionId)
        .order("created_at", { ascending: true });

      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({ ok: true, messages: data || [] });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
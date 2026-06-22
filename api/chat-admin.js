import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const token = req.headers["x-admin-token"];

  if (!token || token !== process.env.ADMIN_ANALYTICS_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (sessionsError) throw sessionsError;

    const sessionIds = (sessions || []).map((s) => s.id);

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("*")
      .in("chat_session_id", sessionIds.length ? sessionIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    return res.status(200).json({
      ok: true,
      sessions: sessions || [],
      messages: messages || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
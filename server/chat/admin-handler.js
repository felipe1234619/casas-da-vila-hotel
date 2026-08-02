import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false
      }
    }
  );
}

export default async function handler(req, res) {
  const token = req.headers["x-admin-token"];

  if (!token || token !== process.env.ADMIN_ANALYTICS_TOKEN) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  try {
    const supabase = getSupabaseClient();

    const {
      data: sessions,
      error: sessionsError
    } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", {
        ascending: false
      })
      .limit(50);

    if (sessionsError) {
      throw sessionsError;
    }

    const sessionIds = (sessions || []).map(
      (session) => session.id
    );

    const fallbackSessionId =
      "00000000-0000-0000-0000-000000000000";

    const {
      data: messages,
      error: messagesError
    } = await supabase
      .from("chat_messages")
      .select("*")
      .in(
        "chat_session_id",
        sessionIds.length
          ? sessionIds
          : [fallbackSessionId]
      )
      .order("created_at", {
        ascending: true
      });

    if (messagesError) {
      throw messagesError;
    }

    return res.status(200).json({
      ok: true,
      sessions: sessions || [],
      messages: messages || []
    });
  } catch (error) {
    console.error(
      "chat-admin error:",
      error
    );

    return res.status(500).json({
      error: "Internal chat admin error",
      message:
        process.env.NODE_ENV === "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}
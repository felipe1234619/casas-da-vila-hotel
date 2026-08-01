import adminHandler from "../server/chat/admin-handler.js";
import messageHandler from "../server/chat/message-handler.js";
import sessionHandler from "../server/chat/session-handler.js";
import assistantHandler from "../server/chat/assistant-handler.js";

const handlers = {
  admin: adminHandler,
  message: messageHandler,
  session: sessionHandler,
  assistant: assistantHandler
};

export default async function handler(req, res) {
  const action = String(req.query.action || "")
    .trim()
    .toLowerCase();

  const selectedHandler = handlers[action];

  if (!selectedHandler) {
    return res.status(404).json({
      ok: false,
      error: "Unknown chat action",
      available_actions: Object.keys(handlers)
    });
  }

  try {
    return await selectedHandler(req, res);
  } catch (error) {
    console.error(`Chat router error [${action}]:`, error);

    return res.status(500).json({
      ok: false,
      error: "Internal chat error",
      message:
        process.env.NODE_ENV === "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}
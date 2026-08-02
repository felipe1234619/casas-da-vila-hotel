const ACTION_ALIASES = Object.freeze({
  admin: "admin",
  message: "message",
  messages: "message",
  session: "session",
  assistant: "assistant",
  olivia: "assistant",
  chat: "assistant"
});

const HANDLER_LOADERS = Object.freeze({
  admin: () =>
    import("../server/chat/admin-handler.js"),

  message: () =>
    import("../server/chat/message-handler.js"),

  session: () =>
    import("../server/chat/session-handler.js"),

  assistant: () =>
    import("../server/chat/assistant-handler.js")
});

function normalizeAction(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ACTION_ALIASES[normalized] || normalized;
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "Unknown error");
}

function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}

async function loadHandler(action) {
  const loader = HANDLER_LOADERS[action];

  if (!loader) {
    return null;
  }

  const module = await loader();
  const handler = module?.default;

  if (typeof handler !== "function") {
    throw new TypeError(
      `Chat handler "${action}" does not export a default function.`
    );
  }

  return handler;
}

export default async function handler(req, res) {
  const action = normalizeAction(req.query?.action);

  if (!action || !HANDLER_LOADERS[action]) {
    return sendJson(res, 404, {
      ok: false,
      error: "Unknown chat action",
      action: action || null,
      available_actions: Object.keys(HANDLER_LOADERS)
    });
  }

  try {
    const selectedHandler = await loadHandler(action);

    return await selectedHandler(req, res);
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Chat router error:", {
      action,
      method: req.method,
      path: req.url,
      message,
      stack:
        error instanceof Error
          ? error.stack
          : undefined
    });

    return sendJson(res, 500, {
      ok: false,
      error: "Internal chat error",
      action,
      ...(process.env.NODE_ENV === "development"
        ? { message }
        : {})
    });
  }
}
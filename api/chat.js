const handlerLoaders = {
  admin: () => import("../server/chat/admin-handler.js"),
  message: () => import("../server/chat/message-handler.js"),
  session: () => import("../server/chat/session-handler.js"),
  assistant: () => import("../server/chat/assistant-handler.js")
};

export default async function handler(req, res) {
  const action = String(req.query.action || "")
    .trim()
    .toLowerCase();

  const loadHandler = handlerLoaders[action];

  if (!loadHandler) {
    return res.status(404).json({
      ok: false,
      error: "Unknown chat action",
      available_actions: Object.keys(handlerLoaders)
    });
  }

  try {
    const module = await loadHandler();
    const selectedHandler = module.default;

    if (typeof selectedHandler !== "function") {
      throw new TypeError(
        `Chat handler "${action}" does not export a default function`
      );
    }

    return await selectedHandler(req, res);
  } catch (error) {
    console.error(`Chat router error [${action}]:`, error);

    return res.status(500).json({
      ok: false,
      error: "Internal chat error",
      action,
      message:
        process.env.NODE_ENV === "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}
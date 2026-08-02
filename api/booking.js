const handlerLoaders = {
  availability: () =>
    import("../server/booking/availability-handler.js"),

  hold: () =>
    import("../server/booking/hold-handler.js"),

  checkout: () =>
    import("../server/booking/checkout-handler.js"),

  prebooking: () =>
    import("../server/booking/pre-booking-handler.js")
};

export default async function handler(req, res) {
  const action = String(req.query.action || "")
    .trim()
    .toLowerCase();

  const loadHandler = handlerLoaders[action];

  if (!loadHandler) {
    return res.status(404).json({
      ok: false,
      error: "Unknown booking action",
      available_actions: Object.keys(handlerLoaders)
    });
  }

  try {
    const module = await loadHandler();
    const selectedHandler = module.default;

    if (typeof selectedHandler !== "function") {
      throw new TypeError(
        `Booking handler "${action}" does not export a default function`
      );
    }

    return await selectedHandler(req, res);
  } catch (error) {
    console.error(`Booking router error [${action}]:`, error);

    return res.status(500).json({
      ok: false,
      error: "Internal booking error",
      action,
      message:
        process.env.NODE_ENV === "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}
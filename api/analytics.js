import adminAnalyticsHandler from "../server/analytics/admin-analytics.js";
import bookingEventHandler from "../server/analytics/booking-event.js";
import siteEventHandler from "../server/analytics/site-event.js";

const handlers = {
  admin: adminAnalyticsHandler,
  booking: bookingEventHandler,
  site: siteEventHandler
};

export default async function handler(req, res) {
  const action = String(req.query.action || "").trim().toLowerCase();

  const selectedHandler = handlers[action];

  if (!selectedHandler) {
    return res.status(404).json({
      ok: false,
      error: "Unknown analytics action",
      available_actions: Object.keys(handlers)
    });
  }

  try {
    return await selectedHandler(req, res);
  } catch (error) {
    console.error(`Analytics router error [${action}]:`, error);

    return res.status(500).json({
      ok: false,
      error: "Internal analytics error",
      message:
        process.env.NODE_ENV === "development"
          ? error?.message || String(error)
          : undefined
    });
  }
}
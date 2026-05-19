// ======================================================
// CASAS DA VILA — Booking Event Tracking
// Supabase + TWIPLA
// ======================================================

(function () {
  async function trackBookingEvent(eventType, data = {}) {
    try {
      const payload = {
        event_type: eventType,

        page_url: window.location.href,
        referrer: document.referrer || null,
        language: document.documentElement.lang || navigator.language || null,
        source: "booking_frontend",

        visitor_id: localStorage.getItem("cdv_visitor_id") || null,
session_id: sessionStorage.getItem("cdv_session_id") || null,
timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
language: navigator.language || null,
referrer: document.referrer || null,

        house_slug: data.house_slug || data.houseSlug || null,
        house_name: data.house_name || data.houseName || null,

        checkin: data.checkin || null,
        checkout: data.checkout || null,
        nights: data.nights ? Number(data.nights) : null,
        guests: data.guests ? Number(data.guests) : null,

        currency: data.currency || "BRL",
        estimated_total: data.estimated_total || data.estimatedTotal || null,

        availability_status:
          data.availability_status || data.availabilityStatus || null,

        stripe_session_id: data.stripe_session_id || null,
        booking_id: data.booking_id || null,

        user_email: data.user_email || data.email || null,
        user_name: data.user_name || data.name || null,
        user_phone: data.user_phone || data.phone || null,

        user_agent: navigator.userAgent || null,

        metadata: {
          ...data,
          tracked_at: new Date().toISOString()
        }
      };

await fetch("/api/site-event", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});
      console.info("Booking event tracked:", eventType, payload);
    } catch (err) {
      console.warn("Booking event tracking failed:", err);
    }
  }

  window.trackBookingEvent = trackBookingEvent;
})();
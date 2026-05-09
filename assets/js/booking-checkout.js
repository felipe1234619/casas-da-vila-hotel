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

      if (window.sb) {
        const { error } = await window.sb
          .from("booking_events")
          .insert(payload);

        if (error) {
          console.warn("Booking event Supabase error:", error.message);
        }
      }

      console.info("Booking event tracked:", eventType, payload);
    } catch (err) {
      console.warn("Booking event tracking failed:", err);
    }
  }

  window.trackBookingEvent = trackBookingEvent;
})();
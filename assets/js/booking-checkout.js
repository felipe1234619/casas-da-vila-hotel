(function () {
  function getVisitorId() {
    return (
      window.CDVAnalytics?.getVisitorId?.() ||
      localStorage.getItem("cdv_visitor_id") ||
      null
    );
  }

  function getSessionId() {
    return (
      window.CDVAnalytics?.getSessionId?.() ||
      sessionStorage.getItem("cdv_session_id") ||
      null
    );
  }

  async function trackBookingEvent(eventType, data = {}) {
    try {
      const payload = {
        event_type: eventType,

        page_url: window.location.href,
        page_path: window.location.pathname,
        referrer: document.referrer || null,

        language: navigator.language || null,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || null,

        source: "booking_frontend",

        visitor_id: data.visitor_id || getVisitorId(),
        session_id: data.session_id || getSessionId(),

        house_slug: data.house_slug || null,
        house_name: data.house_name || null,

        checkin: data.checkin || null,
        checkout: data.checkout || null,

        nights:
          data.nights !== undefined && data.nights !== null
            ? Number(data.nights)
            : null,

        guests:
          data.guests !== undefined && data.guests !== null
            ? Number(data.guests)
            : null,

        guests_count:
          data.guests_count !== undefined &&
          data.guests_count !== null
            ? Number(data.guests_count)
            : (
                data.guests !== undefined &&
                data.guests !== null
                  ? Number(data.guests)
                  : null
              ),

        currency: data.currency || "BRL",

        estimated_total:
          data.estimated_total !== undefined &&
          data.estimated_total !== null
            ? Number(data.estimated_total)
            : null,

        gross_total:
          data.gross_total !== undefined &&
          data.gross_total !== null
            ? Number(data.gross_total)
            : null,

        discount_amount:
          data.discount_amount !== undefined &&
          data.discount_amount !== null
            ? Number(data.discount_amount)
            : null,

        discount_percentage:
          data.discount_percentage !== undefined &&
          data.discount_percentage !== null
            ? Number(data.discount_percentage)
            : null,

        discount_label: data.discount_label || null,

        availability_status:
          data.availability_status || null,

        available_units_count:
          data.available_units_count !== undefined &&
          data.available_units_count !== null
            ? Number(data.available_units_count)
            : null,

        available_units:
          Array.isArray(data.available_units)
            ? data.available_units
            : null,

        unavailable_reason:
          data.unavailable_reason || null,

        user_email: data.user_email || null,
        user_name: data.user_name || null,
        user_phone: data.user_phone || null,

        user_agent: navigator.userAgent || null,

        metadata: {
          ...(data.metadata || {}),
          tracked_at: new Date().toISOString()
        }
      };

      const response = await fetch(
        "/api/analytics?action=booking",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          keepalive: true,
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        console.warn(
          "Booking analytics API error:",
          response.status,
          await response.text()
        );

        return false;
      }

      console.info(
        "Booking event tracked:",
        eventType,
        payload
      );

      return true;
    } catch (error) {
      console.warn(
        "Booking analytics failed:",
        error
      );

      return false;
    }
  }

  window.trackBookingEvent = trackBookingEvent;

  window.CDVBookingAnalytics = {
    track: trackBookingEvent
  };
})();
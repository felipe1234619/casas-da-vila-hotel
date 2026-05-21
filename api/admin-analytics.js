import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(obj, limit = 8) {
  return Object.entries(obj)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
function buildVisitorSessions(siteEvents = [], bookingEvents = []) {
  const grouped = {};

  siteEvents.forEach((event) => {
    const sessionId = event.session_id || "unknown-session";

    if (!grouped[sessionId]) {
      grouped[sessionId] = {
        session_id: sessionId,
        visitor_id: event.visitor_id || null,
        country: event.country || null,
        city: event.city || null,
        region: event.region || null,
        referrer: event.referrer || null,
        started_at: event.created_at,
        last_seen_at: event.created_at,
        pages_count: 0,
        pages: [],
        booking_events: []
      };
    }

    grouped[sessionId].pages_count += 1;

    grouped[sessionId].pages.push({
      created_at: event.created_at,
      page_path: event.page_path,
      page_title: event.page_title,
      referrer: event.referrer
    });

    if (new Date(event.created_at) < new Date(grouped[sessionId].started_at)) {
      grouped[sessionId].started_at = event.created_at;
    }

    if (new Date(event.created_at) > new Date(grouped[sessionId].last_seen_at)) {
      grouped[sessionId].last_seen_at = event.created_at;
    }
  });

  bookingEvents.forEach((event) => {
    if (!event.session_id || !grouped[event.session_id]) return;

    grouped[event.session_id].booking_events.push({
      created_at: event.created_at,
      event_type: event.event_type,
      house_name: event.house_name,
      checkin: event.checkin,
      checkout: event.checkout,
      guests: event.guests,
      estimated_total: event.estimated_total,
      availability_status: event.availability_status
    });
  });

  return Object.values(grouped)
    .map((session) => ({
      ...session,
      entry_page: session.pages[session.pages.length - 1]?.page_path || null,
      exit_page: session.pages[0]?.page_path || null,
      has_booking_intent: session.booking_events.length > 0
    }))
    .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at))
    .slice(0, 80);
}
export default async function handler(req, res) {
  const token = req.headers["x-admin-token"];

  if (!token || token !== process.env.ADMIN_ANALYTICS_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: siteEvents, error: siteError } = await supabase
      .from("site_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (siteError) throw siteError;

    const { data: bookingEvents, error: bookingError } = await supabase
      .from("booking_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (bookingError) throw bookingError;

    const cleanSiteEvents = siteEvents || [];
    const cleanBookingEvents = bookingEvents || [];

    const sessions = new Set(cleanSiteEvents.map((e) => e.session_id).filter(Boolean));
    const visitors = new Set(cleanSiteEvents.map((e) => e.visitor_id).filter(Boolean));

    const bookingSearches = cleanBookingEvents.filter(
      (e) => e.event_type === "booking_search"
    );

    return res.status(200).json({
      summary: {
        pageviews: cleanSiteEvents.length,
        sessions: sessions.size,
        visitors: visitors.size,
        booking_searches: bookingSearches.length
      },
      top_pages: topEntries(countBy(cleanSiteEvents, "page_path")),
      top_referrers: topEntries(countBy(cleanSiteEvents, "referrer")),
      top_countries: topEntries(countBy(cleanSiteEvents, "country")),
      top_cities: topEntries(countBy(cleanSiteEvents, "city")),
      top_houses: topEntries(countBy(bookingSearches, "house_name")),
recent_site_events: cleanSiteEvents.slice(0, 30),

recent_booking_events: cleanBookingEvents.slice(0, 30),
visitor_sessions: buildVisitorSessions(cleanSiteEvents, cleanBookingEvents),
booking_availability_results: cleanBookingEvents.filter(
  (e) => e.event_type === "booking_availability_result"
),

booking_summary: {
  potential_revenue: cleanBookingEvents
    .filter((e) => e.event_type === "booking_availability_result")
    .reduce((sum, e) => sum + Number(e.estimated_total || 0), 0),

  available_queries: cleanBookingEvents.filter(
    (e) =>
      e.event_type === "booking_availability_result" &&
      e.availability_status === "available"
  ).length,

  unavailable_queries: cleanBookingEvents.filter(
    (e) =>
      e.event_type === "booking_availability_result" &&
      e.availability_status === "unavailable"
  ).length
}
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
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
function buildVisitorSessions(siteEvents, bookingEvents) {
  const grouped = {};

  siteEvents.forEach((event) => {
    const key = event.session_id || event.visitor_id;
    if (!key) return;

    if (!grouped[key]) {
      grouped[key] = {
        session_id: event.session_id || null,
        visitor_id: event.visitor_id || null,
        country: event.country || "unknown",
        city: event.city || "",
        referrer: event.referrer || "Direct / unknown",
        first_seen_at: event.created_at,
        last_seen_at: event.created_at,
        pages: [],
        bookings: []
      };
    }

    grouped[key].pages.push({
      path: event.page_path || "—",
      title: event.page_title || "",
      created_at: event.created_at,
      referrer: event.referrer || ""
    });

    if (new Date(event.created_at) > new Date(grouped[key].last_seen_at)) {
      grouped[key].last_seen_at = event.created_at;
    }
  });

bookingEvents.forEach((event) => {
  let key = null;

  if (event.session_id && grouped[event.session_id]) {
    key = event.session_id;
  }

  if (!key && event.visitor_id) {
    key = Object.keys(grouped).find(
      (groupKey) => grouped[groupKey].visitor_id === event.visitor_id
    );
  }

  if (!key) return;

  grouped[key].bookings.push({
    event_type: event.event_type || null,
    checkin: event.checkin || null,
    checkout: event.checkout || null,
    house_name: event.house_name || "multi-house",
    estimated_total: event.estimated_total || 0,
    availability_status: event.availability_status || null,
    available_units_count: event.available_units_count || null,
    created_at: event.created_at
  });
});
  return Object.values(grouped)
    .map((session) => ({
      ...session,
      page_count: session.pages.length,
      booking_count: session.bookings.length,
      has_booking_intent:
        session.pages.some((p) => String(p.path).includes("reservar") || String(p.path).includes("book")) ||
        session.bookings.length > 0,
      is_returning_visitor: false
    }))
    .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
}
export default async function handler(req, res) {
  const token = req.headers["x-admin-token"];
const range = req.query.range || "today";

const now = new Date();
let startDate = new Date();
let endDate = new Date();

if (range === "today") {
  startDate.setHours(0, 0, 0, 0);
}

if (range === "yesterday") {
  startDate.setDate(now.getDate() - 1);
  startDate.setHours(0, 0, 0, 0);

  endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 1);
}

if (range === "5d") {
  startDate.setDate(now.getDate() - 5);
}

if (range === "7d") {
  startDate.setDate(now.getDate() - 7);
}

if (range === "30d") {
  startDate.setDate(now.getDate() - 30);
}
  if (!token || token !== process.env.ADMIN_ANALYTICS_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: siteEvents, error: siteError } = await supabase
      .from("site_events")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000);

    if (siteError) throw siteError;

    const { data: bookingEvents, error: bookingError } = await supabase
      .from("booking_events")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString())
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

    const availabilityResults = cleanBookingEvents.filter(
      (e) => e.event_type === "booking_availability_result"
    );
const visitorSessions = buildVisitorSessions(cleanSiteEvents, cleanBookingEvents);
    return res.status(200).json({
      summary: {
        pageviews: cleanSiteEvents.length,
        sessions: sessions.size,
        visitors: visitors.size,
        returning_visitors: 0,
        booking_searches: bookingSearches.length,
        booking_intent_rate: 0
      },

      top_pages: topEntries(countBy(cleanSiteEvents, "page_path")),
      top_referrers: topEntries(countBy(cleanSiteEvents, "referrer")),
      top_countries: topEntries(countBy(cleanSiteEvents, "country")),
      top_cities: topEntries(countBy(cleanSiteEvents, "city")),
      top_houses: topEntries(countBy(bookingSearches, "house_name")),

visitor_sessions: visitorSessions,
      alerts: [],

      recent_site_events: cleanSiteEvents.slice(0, 30),
      recent_booking_events: cleanBookingEvents.slice(0, 30),

      booking_availability_results: availabilityResults,

      booking_summary: {
        potential_revenue: availabilityResults.reduce(
          (sum, e) => sum + Number(e.estimated_total || 0),
          0
        ),
        available_queries: availabilityResults.filter(
          (e) => e.availability_status === "available"
        ).length,
        unavailable_queries: availabilityResults.filter(
          (e) => e.availability_status === "unavailable"
        ).length
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
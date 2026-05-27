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
function getEventPath(event) {
  if (event.page_path) return event.page_path;

  try {
    if (event.page_url) {
      return new URL(event.page_url).pathname;
    }
  } catch (_) {}

  return "—";
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
path: getEventPath(event),
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
house_name:
  event.house_name || event.house_slug || "multi-house-search",    estimated_total: event.estimated_total || 0,
    availability_status: event.availability_status || null,
    available_units_count: event.available_units_count || null,
    created_at: event.created_at
  });
});
  return Object.values(grouped)
.map((session) => ({
  ...session,

  page_count: session.pages.filter(
    (p) => p.path && p.path !== "-"
  ).length,

  booking_count: session.bookings.length,

  has_booking_intent:
    session.pages.some((p) =>
      String(p.path).includes("reservar")
    ) || session.bookings.length > 0,

is_returning_visitor:
  siteEvents.filter(
    (e) => e.visitor_id && e.visitor_id === session.visitor_id
  ).some((e) => e.is_returning_visitor === true),
  lead_score: calculateLeadScore(session),

  lead_label: classifyLeadScore(
    calculateLeadScore(session)
  )
}))
    .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
}
function countSearchedHouses(events = []) {
  const counts = {};

  events.forEach((event) => {

    const units =
      event.available_units ||
      event.metadata?.available_units ||
      [];

    if (!Array.isArray(units)) return;

    units.forEach((unit) => {

      const name =
        unit.house_name ||
        unit.house ||
        unit.name ||
        unit.slug ||
        unit.unit_name;

      if (!name) return;

      counts[name] = (counts[name] || 0) + 1;
    });
  });

  return counts;
}
function calculateLeadScore(session) {
  let score = 0;

  const paths = (session.pages || []).map((p) => p.path || "");
  const bookings = session.bookings || [];

  if (paths.some((p) => p.includes("/reservar") || p.includes("/book"))) {
    score += 20;
  }

  if (paths.some((p) => p.includes("/casas/") || p.includes("/houses/"))) {
    score += 15;
  }

  if (bookings.some((b) => b.event_type === "booking_search")) {
    score += 25;
  }

  if (bookings.some((b) => b.event_type === "booking_availability_result")) {
    score += 25;
  }

  if (session.page_count >= 4) {
    score += 10;
  }

  if (session.is_returning_visitor) {
    score += 10;
  }

  return Math.min(score, 100);
}

function classifyLeadScore(score) {
  if (score >= 70) return "🔥 Alta intenção";
  if (score >= 45) return "💎 Qualificado";
  if (score >= 25) return "↗ Em consideração";
  return "Exploratório";
}
function buildIntelligenceAlerts(sessions = []) {
  return sessions
    .filter((session) => Number(session.lead_score || 0) >= 45)
    .slice(0, 10)
    .map((session) => ({
      title:
        Number(session.lead_score || 0) >= 70
          ? "Alta intenção de reserva"
          : "Visitante qualificado",
      description: `${session.country || "Origem desconhecida"}${
        session.city ? " · " + session.city : ""
      } — ${session.page_count || 0} páginas, ${
        session.booking_count || 0
      } eventos de reserva.`,
      score: session.lead_score,
      created_at: session.last_seen_at
    }));
}
function buildLiveVisitors(siteEvents = []) {
  const now = Date.now();
const activeWindowMs = 90 * 1000;
  const recent = siteEvents.filter((event) => {
    if (!event.created_at) return false;
    return now - new Date(event.created_at).getTime() <= activeWindowMs;
  });

  const grouped = {};

  recent.forEach((event) => {
    const key = event.session_id || event.visitor_id || "unknown";

    if (!grouped[key]) {
      grouped[key] = {
        country: event.country || "Unknown",
        city: event.city || "",
        page_path: event.page_path || "-",
        referrer: event.referrer || "Direct / unknown",
        last_seen_at: event.created_at
      };
    }

    if (new Date(event.created_at) > new Date(grouped[key].last_seen_at)) {
      grouped[key].page_path = event.page_path || "-";
      grouped[key].last_seen_at = event.created_at;
    }
  });

  return Object.values(grouped);
}
function buildReservationFunnel(siteEvents = [], bookingEvents = []) {
  const sessions = new Set(siteEvents.map((e) => e.session_id).filter(Boolean));

  const visitedHouse = new Set(
    siteEvents
      .filter((e) => String(e.page_path || "").includes("/casas/"))
      .map((e) => e.session_id)
      .filter(Boolean)
  );

  const visitedBooking = new Set(
    siteEvents
      .filter((e) => String(e.page_path || "").includes("/reservar"))
      .map((e) => e.session_id)
      .filter(Boolean)
  );

  const searchedDates = new Set(
    bookingEvents
      .filter((e) => e.event_type === "booking_search")
      .map((e) => e.session_id)
      .filter(Boolean)
  );

  const gotAvailability = new Set(
    bookingEvents
      .filter((e) => e.event_type === "booking_availability_result")
      .map((e) => e.session_id)
      .filter(Boolean)
  );

  return {
    sessions: sessions.size,
    visited_house: visitedHouse.size,
    visited_booking: visitedBooking.size,
    searched_dates: searchedDates.size,
    got_availability: gotAvailability.size
  };
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

const pageViewEvents = cleanSiteEvents.filter(
  (e) => e.event_type === "page_view"
);

return res.status(200).json({
  summary: {
    pageviews: pageViewEvents.length,
    sessions: sessions.size,
    visitors: visitors.size,
    returning_visitors: new Set(
      cleanSiteEvents
        .filter((e) => e.is_returning_visitor === true)
        .map((e) => e.visitor_id)
        .filter(Boolean)
    ).size,
    booking_searches: bookingSearches.length,
    booking_intent_rate: 0
  },

  top_pages: topEntries(countBy(pageViewEvents, "page_path")),
  top_referrers: topEntries(countBy(pageViewEvents, "referrer")),
  top_countries: topEntries(countBy(pageViewEvents, "country")),
  top_cities: topEntries(countBy(pageViewEvents, "city")),
  top_houses: topEntries(countSearchedHouses(availabilityResults)),
visitor_sessions: visitorSessions,
hot_leads: visitorSessions
  .filter((s) => s.lead_score >= 80)
  .sort((a, b) => b.lead_score - a.lead_score)
  .slice(0, 10),
alerts: buildIntelligenceAlerts(visitorSessions),

reservation_funnel: buildReservationFunnel(
  cleanSiteEvents,
  cleanBookingEvents
),
live_visitors: buildLiveVisitors(cleanSiteEvents),
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
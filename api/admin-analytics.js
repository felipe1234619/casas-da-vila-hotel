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
        latitude: event.latitude || null,
longitude: event.longitude || null,
geo_source: event.geo_source || null,
geo_accuracy: event.geo_accuracy || null,
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
function buildIntelligenceAlerts(visitorSessions = [], pageViewEvents = []) {
  const alerts = [];

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const visitorVisits = new Map();

  pageViewEvents.forEach((event) => {
    if (!event.visitor_id || !event.created_at) return;

    const createdAt = new Date(event.created_at).getTime();
    if (!createdAt || createdAt < sevenDaysAgo) return;

    if (!visitorVisits.has(event.visitor_id)) {
      visitorVisits.set(event.visitor_id, {
        visitor_id: event.visitor_id,
        country: event.country || "Origem desconhecida",
        city: event.city || "",
        sessions: new Set(),
        pages: new Set(),
        last_seen_at: event.created_at
      });
    }

    const visitor = visitorVisits.get(event.visitor_id);

    if (event.session_id) {
      visitor.sessions.add(event.session_id);
    }

    if (event.page_path) {
      visitor.pages.add(event.page_path);
    }

    if (new Date(event.created_at) > new Date(visitor.last_seen_at)) {
      visitor.last_seen_at = event.created_at;
    }
  });

  visitorVisits.forEach((visitor) => {
    if (visitor.sessions.size >= 3) {
      alerts.push({
        type: "returning_visitor_7d",
        title: "Visitante recorrente em 7 dias",
        message: `${visitor.country}${visitor.city ? " · " + visitor.city : ""} — ${visitor.sessions.size} sessões e ${visitor.pages.size} páginas visitadas nos últimos 7 dias.`,
        score: 75,
        created_at: visitor.last_seen_at
      });
    }
  });

  visitorSessions
    .filter((session) => Number(session.lead_score || 0) >= 80)
    .slice(0, 5)
    .forEach((session) => {
      alerts.push({
        type: "high_intent",
        title: "Alta intenção detectada",
        message: `${session.country || "Origem desconhecida"}${session.city ? " · " + session.city : ""} — score ${session.lead_score}/100.`,
        score: session.lead_score,
        created_at: session.last_seen_at
      });
    });

  return alerts
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 10);
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
function getSaoPauloDateKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function getSaoPauloRange(range = "today") {
  const now = new Date();

  const todayKey = getSaoPauloDateKey(now);
  const [year, month, day] = todayKey.split("-").map(Number);

  // 00:00 em São Paulo = 03:00 UTC
  const todayStartUtc = Date.UTC(year, month - 1, day, 3, 0, 0);

  let start = todayStartUtc;
  let end = todayStartUtc + 24 * 60 * 60 * 1000;

  if (range === "yesterday") {
    start = todayStartUtc - 24 * 60 * 60 * 1000;
    end = todayStartUtc;
  }

  if (range === "5d") {
    start = todayStartUtc - 4 * 24 * 60 * 60 * 1000;
  }

  if (range === "7d") {
    start = todayStartUtc - 6 * 24 * 60 * 60 * 1000;
  }

  if (range === "30d") {
    start = todayStartUtc - 29 * 24 * 60 * 60 * 1000;
  }

  return {
    startDate: new Date(start),
    endDate: new Date(end)
  };
}
export default async function handler(req, res) {
  const token = req.headers["x-admin-token"];
const range = req.query.range || "today";

const { startDate, endDate } = getSaoPauloRange(range);
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

const pageViewEvents = cleanSiteEvents.filter(
  (e) => e.event_type === "page_view"
);

const sessions = new Set(
  pageViewEvents.map((e) => e.session_id).filter(Boolean)
);

const visitors = new Set(
  pageViewEvents.map((e) => e.visitor_id).filter(Boolean)
);

const bookingSearches = cleanBookingEvents.filter(
  (e) => e.event_type === "booking_search"
);
const visitorHistory = new Map();

cleanSiteEvents
  .filter((e) => e.event_type === "page_view" && e.visitor_id)
  .forEach((event) => {
    if (!visitorHistory.has(event.visitor_id)) {
      visitorHistory.set(event.visitor_id, {
        sessions: new Set(),
        dates: new Set()
      });
    }

    const item = visitorHistory.get(event.visitor_id);

    if (event.session_id) {
      item.sessions.add(event.session_id);
    }

    if (event.created_at) {
item.dates.add(getSaoPauloDateKey(event.created_at));
const returningVisitors = Array.from(visitorHistory.values()).filter(
  (item) => item.sessions.size > 1 || item.dates.size > 1
).length;
const visitorSessionsById = new Map();

pageViewEvents.forEach((event) => {
  if (!event.visitor_id || !event.session_id) return;

  if (!visitorSessionsById.has(event.visitor_id)) {
    visitorSessionsById.set(event.visitor_id, new Set());
  }

  visitorSessionsById.get(event.visitor_id).add(event.session_id);
});
;

const availabilityResults = cleanBookingEvents.filter(
  (e) => e.event_type === "booking_availability_result"
);

const visitorSessions = buildVisitorSessions(cleanSiteEvents, cleanBookingEvents);

return res.status(200).json({
  summary: {
    pageviews: pageViewEvents.length,
    sessions: sessions.size,
    visitors: visitors.size,
returning_visitors: returningVisitors,
    booking_searches: bookingSearches.length,
booking_intent_rate:
  sessions.size > 0
    ? Math.round((bookingSearches.length / sessions.size) * 100)
    : 0
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
alerts: buildIntelligenceAlerts(visitorSessions, pageViewEvents),
reservation_funnel: buildReservationFunnel(
  cleanSiteEvents,
  cleanBookingEvents
),
live_visitors: buildLiveVisitors(cleanSiteEvents),
recent_site_events: cleanSiteEvents.slice(0, 30),
recent_booking_events: cleanBookingEvents.slice(0, 30),
      booking_availability_results: availabilityResults,

booking_summary: {
  potential_revenue: availabilityResults.reduce((sum, e) => {
    const directTotal = Number(e.estimated_total || 0);

    if (directTotal > 0) return sum + directTotal;

    const units =
      e.available_units ||
      e.metadata?.available_units ||
      [];

    if (Array.isArray(units) && units.length) {
      return sum + units.reduce((unitSum, unit) => {
        return unitSum + Number(
          unit.estimated_total ||
          unit.total ||
          unit.price ||
          0
        );
      }, 0);
    }

    return sum;
  }, 0),

  available_queries: availabilityResults.filter((e) =>
    e.availability_status === "available" ||
    Number(e.available_units_count || 0) > 0 ||
    (Array.isArray(e.available_units) && e.available_units.length > 0) ||
    (Array.isArray(e.metadata?.available_units) && e.metadata.available_units.length > 0)
  ).length,

  unavailable_queries: availabilityResults.filter((e) =>
    e.availability_status === "unavailable" ||
    e.unavailable_reason
  ).length
}
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
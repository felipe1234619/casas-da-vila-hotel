import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getRangeStart(range) {
  const now = new Date();
  const start = new Date(now);

  if (range === "yesterday") {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(0, 0, 0, 0);

    return { start, end };
  }

  start.setHours(0, 0, 0, 0);

  if (range === "5d") start.setDate(now.getDate() - 5);
  if (range === "7d") start.setDate(now.getDate() - 7);
  if (range === "30d") start.setDate(now.getDate() - 30);

  return { start, end: now };
}

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

function calculateScore(session) {
  let score = 0;

  if (session.pages_count >= 3) score += 15;
  if (session.pages_count >= 6) score += 20;
  if (session.is_returning_visitor) score += 25;
  if (session.has_booking_intent) score += 40;

  const visitedPaths = session.pages.map((p) => p.page_path || "").join(" ");

  if (visitedPaths.includes("/reservar") || visitedPaths.includes("/book")) score += 25;
  if (visitedPaths.includes("/casas") || visitedPaths.includes("/houses")) score += 15;
  if (visitedPaths.includes("reveillon") || visitedPaths.includes("new-years")) score += 20;
  if (session.referrer && session.referrer.includes("google")) score += 10;

  return Math.min(score, 100);
}

function buildVisitorSessions(siteEvents = [], bookingEvents = []) {
  const grouped = {};
  const sessionsByVisitor = {};

  siteEvents.forEach((event) => {
    if (!event.visitor_id) return;
    sessionsByVisitor[event.visitor_id] = sessionsByVisitor[event.visitor_id] || new Set();
    if (event.session_id) sessionsByVisitor[event.visitor_id].add(event.session_id);
  });

  siteEvents.forEach((event) => {
    const sessionId = event.session_id || `unknown-${event.id || event.created_at}`;

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
    .map((session) => {
      const sortedPages = [...session.pages].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      const visitorSessionsCount = session.visitor_id
        ? sessionsByVisitor[session.visitor_id]?.size || 1
        : 1;

      const enriched = {
        ...session,
        pages: sortedPages,
        entry_page: sortedPages[0]?.page_path || null,
        exit_page: sortedPages[sortedPages.length - 1]?.page_path || null,
        has_booking_intent: session.booking_events.length > 0,
        visitor_sessions_count: visitorSessionsCount,
        is_returning_visitor: visitorSessionsCount > 1
      };

      return {
        ...enriched,
        score: calculateScore(enriched)
      };
    })
    .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at))
    .slice(0, 100);
}

function buildAlerts(visitorSessions) {
  const alerts = [];

  visitorSessions.forEach((session) => {
    if (session.score >= 80) {
      alerts.push({
        title: "Sessão de alta intenção",
        description: `${session.country || "Origem indefinida"} · ${session.pages_count} páginas · score ${session.score}.`
      });
    }

    if (session.is_returning_visitor && session.has_booking_intent) {
      alerts.push({
        title: "Visitante recorrente com intenção de reserva",
        description: `${session.country || "Origem indefinida"} retornou e realizou busca de disponibilidade.`
      });
    }

    if (session.pages_count >= 8 && !session.has_booking_intent) {
      alerts.push({
        title: "Exploração profunda sem reserva",
        description: `${session.country || "Origem indefinida"} visitou ${session.pages_count} páginas, mas não consultou disponibilidade.`
      });
    }
  });

  return alerts.slice(0, 8);
}

export default async function handler(req, res) {
  const token = req.headers["x-admin-token"];

  if (!token || token !== process.env.ADMIN_ANALYTICS_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const range = req.query.range || "today";
    const { start, end } = getRangeStart(range);

    const { data: siteEvents, error: siteError } = await supabase
      .from("site_events")
      .select("*")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(3000);

    if (siteError) throw siteError;

    const { data: bookingEvents, error: bookingError } = await supabase
      .from("booking_events")
      .select("*")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(3000);

    if (bookingError) throw bookingError;

    const cleanSiteEvents = siteEvents || [];
    const cleanBookingEvents = bookingEvents || [];

    const sessions = new Set(cleanSiteEvents.map((e) => e.session_id).filter(Boolean));
    const visitors = new Set(cleanSiteEvents.map((e) => e.visitor_id).filter(Boolean));

    const visitorSessions = buildVisitorSessions(cleanSiteEvents, cleanBookingEvents);

    const returningVisitors = visitorSessions.filter((s) => s.is_returning_visitor).length;

    const bookingSearches = cleanBookingEvents.filter(
      (e) => e.event_type === "booking_search"
    );

    const availabilityResults = cleanBookingEvents.filter(
      (e) => e.event_type === "booking_availability_result"
    );

    const bookingIntentSessions = visitorSessions.filter((s) => s.has_booking_intent).length;

    return res.status(200).json({
      range,

      summary: {
        pageviews: cleanSiteEvents.length,
        sessions: sessions.size,
        visitors: visitors.size,
        returning_visitors: returningVisitors, length,
        booking_searches: bookingSearches.length,
        booking_intent_rate: sessions.size
          ? Math.round((bookingIntentSessions / sessions.size) * 100)
          : 0
      },

      top_pages: topEntries(countBy(cleanSiteEvents, "page_path")),
      top_referrers: topEntries(countBy(cleanSiteEvents, "referrer")),
      top_countries: topEntries(countBy(cleanSiteEvents, "country")),
      top_cities: topEntries(countBy(cleanSiteEvents, "city")),
      top_houses: topEntries(countBy(bookingSearches, "house_name")),

      visitor_sessions: visitorSessions,
      alerts: buildAlerts(visitorSessions),

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
    return res.status(500).json({ error: error.message });
  }
}
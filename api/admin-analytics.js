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

    const availabilityResults = cleanBookingEvents.filter(
      (e) => e.event_type === "booking_availability_result"
    );

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

      visitor_sessions: [],
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
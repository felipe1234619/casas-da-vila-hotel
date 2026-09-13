import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/* =========================================================
   BASIC HELPERS
========================================================= */

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(obj, limit = 8) {
  return Object.entries(obj)
    .map(([label, value]) => ({
      label,
      value
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function getEventPath(event) {
  if (event.page_path) {
    return event.page_path;
  }

  try {
    if (event.page_url) {
      return new URL(event.page_url).pathname;
    }
  } catch (_) {}

  return "—";
}

function isWithinRange(dateValue, startDate, endDate) {
  if (!dateValue) return false;

  const value = new Date(dateValue).getTime();

  return (
    Number.isFinite(value) &&
    value >= startDate.getTime() &&
    value < endDate.getTime()
  );
}

/* =========================================================
   BOT / HUMAN CLASSIFICATION
========================================================= */

function isClearlyAutomated(event) {
  const likelihood = String(
    event.bot_likelihood || ""
  ).toLowerCase();

  if (likelihood === "high") {
    return true;
  }

  /*
    Compatibility with older events created before
    bot_likelihood existed.
  */
  if (
    event.is_bot_suspected === true &&
    !likelihood
  ) {
    return true;
  }

  return false;
}

function getTrafficClassification(event) {
  if (isClearlyAutomated(event)) {
    return "automated";
  }

  const likelihood = String(
    event.bot_likelihood || ""
  ).toLowerCase();

  if (likelihood === "medium") {
    return "suspected";
  }

  return "human";
}

/* =========================================================
   SÃO PAULO TIME
========================================================= */

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

  const todayKey =
    getSaoPauloDateKey(now);

  const [year, month, day] =
    todayKey.split("-").map(Number);

  /*
    São Paulo = UTC-3 em 2026.
  */
  const todayStartUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      3,
      0,
      0
    );

  let start = todayStartUtc;
  let end =
    todayStartUtc +
    24 * 60 * 60 * 1000;

  if (range === "yesterday") {
    start =
      todayStartUtc -
      24 * 60 * 60 * 1000;

    end = todayStartUtc;
  }

  if (range === "5d") {
    start =
      todayStartUtc -
      4 * 24 * 60 * 60 * 1000;
  }

  if (range === "7d") {
    start =
      todayStartUtc -
      6 * 24 * 60 * 60 * 1000;
  }

  if (range === "30d") {
    start =
      todayStartUtc -
      29 * 24 * 60 * 60 * 1000;
  }

  return {
    startDate: new Date(start),
    endDate: new Date(end)
  };
}

/* =========================================================
   FETCH VISITOR HISTORY
========================================================= */

async function fetchVisitorHistory(
  visitorIds,
  endDate
) {
  if (!visitorIds.length) {
    return [];
  }

  const results = [];

  /*
    Smaller chunks avoid an excessively large URL
    in Supabase's .in() filter.
  */
  const chunkSize = 50;

  for (
    let index = 0;
    index < visitorIds.length;
    index += chunkSize
  ) {
    const chunk = visitorIds.slice(
      index,
      index + chunkSize
    );

    const {
      data,
      error
    } = await supabase
      .from("site_events")
      .select("*")
      .in("visitor_id", chunk)
      .lt(
        "created_at",
        endDate.toISOString()
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      )
      .limit(5000);

    if (error) {
      throw error;
    }

    results.push(
      ...(data || [])
    );
  }

  return results;
}

/* =========================================================
   SESSION RECONSTRUCTION
   30-MINUTE INACTIVITY MODEL
========================================================= */

function reconstructVisitorSessions(
  historicalEvents,
  startDate,
  endDate
) {
  const byVisitor = new Map();

  historicalEvents.forEach((event) => {
    if (!event.visitor_id) {
      return;
    }

    /*
      High-confidence automated traffic does not
      participate in human session reconstruction.
    */
    if (isClearlyAutomated(event)) {
      return;
    }

    if (
      !byVisitor.has(
        event.visitor_id
      )
    ) {
      byVisitor.set(
        event.visitor_id,
        []
      );
    }

    byVisitor
      .get(event.visitor_id)
      .push(event);
  });

  const sessions = [];

  byVisitor.forEach(
    (visitorEvents, visitorId) => {
      const sorted =
        visitorEvents.sort(
          (a, b) =>
            new Date(a.created_at) -
            new Date(b.created_at)
        );

      let currentSession = null;
      let visitNumber = 0;

      sorted.forEach((event) => {
        const createdAt =
          new Date(
            event.created_at
          ).getTime();

        if (
          !Number.isFinite(createdAt)
        ) {
          return;
        }

        const previousTimestamp =
          currentSession
            ? new Date(
                currentSession
                  .last_seen_at
              ).getTime()
            : null;

        const gap =
          previousTimestamp === null
            ? null
            : createdAt -
              previousTimestamp;

        const startsNewSession =
          !currentSession ||
          gap > SESSION_TIMEOUT_MS;

        if (startsNewSession) {
          visitNumber += 1;

          currentSession = {
            calculated_session_id:
              `${visitorId}:${visitNumber}`,

            visitor_id:
              visitorId,

            visit_number:
              visitNumber,

            is_returning_visitor:
              visitNumber > 1,

            first_seen_at:
              event.created_at,

            last_seen_at:
              event.created_at,

            country:
              event.country ||
              "unknown",

            city:
              event.city || "",

            region:
              event.region || "",

            latitude:
              event.latitude ??
              null,

            longitude:
              event.longitude ??
              null,

            geo_source:
              event.geo_source ||
              null,

            geo_accuracy:
              event.geo_accuracy ||
              null,

            device_type:
              event.device_type ||
              "unknown",

            browser_name:
              event.browser_name ||
              "unknown",

            browser_version:
              event.browser_version ||
              null,

            operating_system:
              event.operating_system ||
              "unknown",

            referrer:
              event.referrer ||
              "Direct / unknown",

            referrer_source:
              event.referrer_source ||
              "direct",

            referrer_domain:
              event.referrer_domain ||
              null,

            landing_page:
              event.landing_page ||
              (
                event.event_type ===
                "page_view"
                  ? getEventPath(event)
                  : null
              ),

            original_session_ids:
              new Set(),

            events: [],
            pages: [],
            bookings: [],

            has_pageview_in_range:
              false
          };

          sessions.push(
            currentSession
          );
        }

        currentSession.events.push(
          event
        );

        currentSession.last_seen_at =
          event.created_at;

        if (event.session_id) {
          currentSession
            .original_session_ids
            .add(event.session_id);
        }

        /*
          Keep the most useful geographic/device
          values when subsequent events provide them.
        */
        if (event.country) {
          currentSession.country =
            event.country;
        }

        if (event.city) {
          currentSession.city =
            event.city;
        }

        if (event.region) {
          currentSession.region =
            event.region;
        }

        if (
          event.latitude !== null &&
          event.latitude !== undefined
        ) {
          currentSession.latitude =
            event.latitude;
        }

        if (
          event.longitude !== null &&
          event.longitude !== undefined
        ) {
          currentSession.longitude =
            event.longitude;
        }

        if (event.device_type) {
          currentSession.device_type =
            event.device_type;
        }

        if (event.browser_name) {
          currentSession.browser_name =
            event.browser_name;
        }

        if (
          event.browser_version
        ) {
          currentSession.browser_version =
            event.browser_version;
        }

        if (
          event.operating_system
        ) {
          currentSession.operating_system =
            event.operating_system;
        }

        /*
          Pages are ONLY actual page_view events.
          Engagement events no longer inflate
          page_count.
        */
        if (
          event.event_type ===
          "page_view"
        ) {
          currentSession.pages.push({
            path:
              getEventPath(event),

            title:
              event.page_title ||
              "",

            created_at:
              event.created_at,

            referrer:
              event.referrer ||
              "",

            referrer_source:
              event.referrer_source ||
              null
          });

          if (
            !currentSession
              .landing_page
          ) {
            currentSession
              .landing_page =
              getEventPath(event);
          }

          if (
            isWithinRange(
              event.created_at,
              startDate,
              endDate
            )
          ) {
            currentSession
              .has_pageview_in_range =
              true;
          }
        }
      });
    }
  );

  return sessions;
}

/* =========================================================
   BOOKING EVENTS -> CALCULATED SESSIONS
========================================================= */

function attachBookingEvents(
  sessions,
  bookingEvents
) {
  bookingEvents.forEach(
    (event) => {
      const eventTime =
        new Date(
          event.created_at
        ).getTime();

      if (
        !Number.isFinite(eventTime)
      ) {
        return;
      }

      let candidates =
        sessions.filter(
          (session) =>
            event.visitor_id &&
            session.visitor_id ===
              event.visitor_id
        );

      /*
        Fallback for legacy booking events
        where only session_id exists.
      */
      if (
        candidates.length === 0 &&
        event.session_id
      ) {
        candidates =
          sessions.filter(
            (session) =>
              session
                .original_session_ids
                .has(
                  event.session_id
                )
          );
      }

      if (
        candidates.length === 0
      ) {
        return;
      }

      let best = null;
      let bestDistance =
        Infinity;

      candidates.forEach(
        (session) => {
          const start =
            new Date(
              session.first_seen_at
            ).getTime();

          const end =
            new Date(
              session.last_seen_at
            ).getTime() +
            SESSION_TIMEOUT_MS;

          let distance = 0;

          if (eventTime < start) {
            distance =
              start - eventTime;
          } else if (
            eventTime > end
          ) {
            distance =
              eventTime - end;
          }

          if (
            distance <
            bestDistance
          ) {
            bestDistance =
              distance;
            best = session;
          }
        }
      );

      /*
        Avoid attaching a booking event to
        an unrelated session many hours away.
      */
      if (
        !best ||
        bestDistance >
          SESSION_TIMEOUT_MS
      ) {
        return;
      }

      best.bookings.push({
        event_type:
          event.event_type ||
          null,

        checkin:
          event.checkin ||
          null,

        checkout:
          event.checkout ||
          null,

        house_name:
          event.house_name ||
          event.house_slug ||
          "multi-house-search",

        estimated_total:
          event.estimated_total ||
          0,

        availability_status:
          event.availability_status ||
          null,

        available_units_count:
          event.available_units_count ||
          null,

        created_at:
          event.created_at
      });
    }
  );
}

/* =========================================================
   LEAD SCORING
========================================================= */

function calculateLeadScore(
  session
) {
  let score = 0;

  const paths =
    (session.pages || [])
      .map(
        (page) =>
          page.path || ""
      );

  const bookings =
    session.bookings || [];

  if (
    paths.some(
      (path) =>
        path.includes(
          "/reservar"
        ) ||
        path.includes(
          "/book"
        )
    )
  ) {
    score += 20;
  }

  if (
    paths.some(
      (path) =>
        path.includes(
          "/casas/"
        ) ||
        path.includes(
          "/houses/"
        )
    )
  ) {
    score += 15;
  }

  if (
    bookings.some(
      (booking) =>
        booking.event_type ===
        "booking_search"
    )
  ) {
    score += 25;
  }

  if (
    bookings.some(
      (booking) =>
        booking.event_type ===
        "booking_availability_result"
    )
  ) {
    score += 25;
  }

  if (
    session.page_count >= 4
  ) {
    score += 10;
  }

  if (
    session.is_returning_visitor
  ) {
    score += 10;
  }

  return Math.min(
    score,
    100
  );
}

function classifyLeadScore(
  score
) {
  if (score >= 70) {
    return "🔥 Alta intenção";
  }

  if (score >= 45) {
    return "💎 Qualificado";
  }

  if (score >= 25) {
    return "↗ Em consideração";
  }

  return "Exploratório";
}

/* =========================================================
   FINAL VISITOR SESSION OBJECTS
========================================================= */

function finalizeVisitorSessions(
  sessions
) {
  return sessions
    .filter(
      (session) =>
        session
          .has_pageview_in_range
    )
    .map((session) => {
      const pageCount =
        session.pages.length;

      const bookingCount =
        session.bookings.length;

      const durationSeconds =
        Math.max(
          0,
          Math.round(
            (
              new Date(
                session
                  .last_seen_at
              ).getTime() -
              new Date(
                session
                  .first_seen_at
              ).getTime()
            ) / 1000
          )
        );

      const hasBookingIntent =
        session.pages.some(
          (page) => {
            const path =
              String(
                page.path || ""
              );

            return (
              path.includes(
                "/reservar"
              ) ||
              path.includes(
                "/book"
              )
            );
          }
        ) ||
        bookingCount > 0;

      const base = {
        calculated_session_id:
          session
            .calculated_session_id,

        /*
          Kept for frontend backwards compatibility.
          It now represents our calculated session.
        */
        session_id:
          session
            .calculated_session_id,

        visitor_id:
          session.visitor_id,

        visit_number:
          session.visit_number,

        visitor_sessions_count:
          session.visit_number,

        is_returning_visitor:
          session
            .is_returning_visitor,

        country:
          session.country ||
          "unknown",

        city:
          session.city || "",

        region:
          session.region || "",

        latitude:
          session.latitude,

        longitude:
          session.longitude,

        geo_source:
          session.geo_source,

        geo_accuracy:
          session.geo_accuracy,

        device_type:
          session.device_type,

        browser_name:
          session.browser_name,

        browser_version:
          session.browser_version,

        operating_system:
          session.operating_system,

        referrer:
          session.referrer ||
          "Direct / unknown",

        referrer_source:
          session.referrer_source ||
          "direct",

        referrer_domain:
          session.referrer_domain ||
          null,

        landing_page:
          session.landing_page ||
          session.pages?.[0]?.path ||
          "—",

        first_seen_at:
          session.first_seen_at,

        last_seen_at:
          session.last_seen_at,

        duration_seconds:
          durationSeconds,

        pages:
          session.pages,

        page_count:
          pageCount,

        bookings:
          session.bookings,

        booking_count:
          bookingCount,

        has_booking_intent:
          hasBookingIntent,

        visitor_events_count:
          session.events.length,

        traffic_class:
          "human"
      };

      const score =
        calculateLeadScore(
          base
        );

      return {
        ...base,

        lead_score:
          score,

        lead_label:
          classifyLeadScore(
            score
          )
      };
    })
    .sort(
      (a, b) =>
        new Date(
          b.last_seen_at
        ) -
        new Date(
          a.last_seen_at
        )
    );
}

/* =========================================================
   SEARCHED HOUSES
========================================================= */

function countSearchedHouses(
  events = []
) {
  const counts = {};

  events.forEach(
    (event) => {
      const units =
        event.available_units ||
        event.metadata
          ?.available_units ||
        [];

      if (
        !Array.isArray(units)
      ) {
        return;
      }

      units.forEach(
        (unit) => {
          const name =
            unit.house_name ||
            unit.house ||
            unit.name ||
            unit.slug ||
            unit.unit_name;

          if (!name) {
            return;
          }

          counts[name] =
            (
              counts[name] ||
              0
            ) + 1;
        }
      );
    }
  );

  return counts;
}

/* =========================================================
   INTELLIGENCE ALERTS
========================================================= */

function buildIntelligenceAlerts(
  visitorSessions = []
) {
  const alerts = [];

  const sevenDaysAgo =
    Date.now() -
    7 *
      24 *
      60 *
      60 *
      1000;

  const recentByVisitor =
    new Map();

  visitorSessions.forEach(
    (session) => {
      if (
        !session.visitor_id ||
        !session.last_seen_at
      ) {
        return;
      }

      const lastSeen =
        new Date(
          session.last_seen_at
        ).getTime();

      if (
        !lastSeen ||
        lastSeen <
          sevenDaysAgo
      ) {
        return;
      }

      if (
        !recentByVisitor.has(
          session.visitor_id
        )
      ) {
        recentByVisitor.set(
          session.visitor_id,
          {
            country:
              session.country ||
              "Origem desconhecida",

            city:
              session.city ||
              "",

            sessions: 0,

            pages:
              new Set(),

            last_seen_at:
              session.last_seen_at
          }
        );
      }

      const visitor =
        recentByVisitor.get(
          session.visitor_id
        );

      visitor.sessions += 1;

      (
        session.pages || []
      ).forEach(
        (page) => {
          if (page.path) {
            visitor.pages.add(
              page.path
            );
          }
        }
      );

      if (
        new Date(
          session.last_seen_at
        ) >
        new Date(
          visitor.last_seen_at
        )
      ) {
        visitor.last_seen_at =
          session.last_seen_at;
      }
    }
  );

  recentByVisitor.forEach(
    (visitor) => {
      if (
        visitor.sessions >= 3
      ) {
        alerts.push({
          type:
            "returning_visitor_7d",

          title:
            "Visitante recorrente em 7 dias",

          message:
            `${visitor.country}` +
            `${
              visitor.city
                ? " · " +
                  visitor.city
                : ""
            } — ` +
            `${visitor.sessions} sessões e ` +
            `${visitor.pages.size} páginas visitadas nos últimos 7 dias.`,

          score: 75,

          created_at:
            visitor.last_seen_at
        });
      }
    }
  );

  visitorSessions
    .filter(
      (session) =>
        Number(
          session.lead_score ||
            0
        ) >= 80
    )
    .slice(0, 5)
    .forEach(
      (session) => {
        alerts.push({
          type:
            "high_intent",

          title:
            "Alta intenção detectada",

          message:
            `${
              session.country ||
              "Origem desconhecida"
            }` +
            `${
              session.city
                ? " · " +
                  session.city
                : ""
            } — score ` +
            `${session.lead_score}/100.`,

          score:
            session.lead_score,

          created_at:
            session.last_seen_at
        });
      }
    );

  return alerts
    .sort(
      (a, b) =>
        new Date(
          b.created_at || 0
        ) -
        new Date(
          a.created_at || 0
        )
    )
    .slice(0, 10);
}

/* =========================================================
   LIVE VISITORS
========================================================= */

function buildLiveVisitors(
  siteEvents = []
) {
  const now = Date.now();

  const activeWindowMs =
    90 * 1000;

  const recent =
    siteEvents.filter(
      (event) => {
        if (
          !event.created_at ||
          isClearlyAutomated(
            event
          )
        ) {
          return false;
        }

        return (
          now -
            new Date(
              event.created_at
            ).getTime() <=
          activeWindowMs
        );
      }
    );

  const grouped = {};

  recent.forEach(
    (event) => {
      const key =
        event.visitor_id ||
        event.session_id ||
        "unknown";

      if (!grouped[key]) {
        grouped[key] = {
          visitor_id:
            event.visitor_id ||
            null,

          country:
            event.country ||
            "Unknown",

          city:
            event.city || "",

          page_path:
            event.page_path ||
            "-",

          referrer:
            event.referrer ||
            "Direct / unknown",

          referrer_source:
            event.referrer_source ||
            "direct",

          device_type:
            event.device_type ||
            "unknown",

          browser_name:
            event.browser_name ||
            "unknown",

          operating_system:
            event.operating_system ||
            "unknown",

          last_seen_at:
            event.created_at
        };
      }

      if (
        new Date(
          event.created_at
        ) >
        new Date(
          grouped[key]
            .last_seen_at
        )
      ) {
        grouped[key]
          .page_path =
          event.page_path ||
          "-";

        grouped[key]
          .last_seen_at =
          event.created_at;
      }
    }
  );

  return Object.values(
    grouped
  );
}

/* =========================================================
   RESERVATION FUNNEL
========================================================= */

function buildReservationFunnel(
  visitorSessions = []
) {
  return {
    sessions:
      visitorSessions.length,

    visited_house:
      visitorSessions.filter(
        (session) =>
          session.pages.some(
            (page) => {
              const path =
                String(
                  page.path ||
                  ""
                );

              return (
                path.includes(
                  "/casas/"
                ) ||
                path.includes(
                  "/houses/"
                )
              );
            }
          )
      ).length,

    visited_booking:
      visitorSessions.filter(
        (session) =>
          session.pages.some(
            (page) => {
              const path =
                String(
                  page.path ||
                  ""
                );

              return (
                path.includes(
                  "/reservar"
                ) ||
                path.includes(
                  "/book"
                )
              );
            }
          )
      ).length,

    searched_dates:
      visitorSessions.filter(
        (session) =>
          session.bookings.some(
            (booking) =>
              booking.event_type ===
              "booking_search"
          )
      ).length,

    got_availability:
      visitorSessions.filter(
        (session) =>
          session.bookings.some(
            (booking) =>
              booking.event_type ===
              "booking_availability_result"
          )
      ).length
  };
}

/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
  const token =
    req.headers[
      "x-admin-token"
    ];

  const range =
    req.query.range ||
    "today";

  const {
    startDate,
    endDate
  } =
    getSaoPauloRange(
      range
    );

  if (
    !token ||
    token !==
      process.env
        .ADMIN_ANALYTICS_TOKEN
  ) {
    return res
      .status(401)
      .json({
        error:
          "Unauthorized"
      });
  }

  try {
    /* =============================================
       EVENTS INSIDE SELECTED RANGE
    ============================================= */

    const {
      data: siteEvents,
      error: siteError
    } = await supabase
      .from("site_events")
      .select("*")
      .gte(
        "created_at",
        startDate.toISOString()
      )
      .lt(
        "created_at",
        endDate.toISOString()
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(2000);

    if (siteError) {
      throw siteError;
    }

    const {
      data: bookingEvents,
      error: bookingError
    } = await supabase
      .from("booking_events")
      .select("*")
      .gte(
        "created_at",
        startDate.toISOString()
      )
      .lt(
        "created_at",
        endDate.toISOString()
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(2000);

    if (bookingError) {
      throw bookingError;
    }

    const cleanSiteEvents =
      siteEvents || [];

    const cleanBookingEvents =
      bookingEvents || [];

    /* =============================================
       RANGE PAGEVIEWS
    ============================================= */

    const allPageViewEvents =
      cleanSiteEvents.filter(
        (event) =>
          event.event_type ===
          "page_view"
      );

    const humanPageViewEvents =
      allPageViewEvents.filter(
        (event) =>
          !isClearlyAutomated(
            event
          )
      );

    const automatedPageViewEvents =
      allPageViewEvents.filter(
        isClearlyAutomated
      );

    const suspectedPageViewEvents =
      humanPageViewEvents.filter(
        (event) =>
          getTrafficClassification(
            event
          ) === "suspected"
      );

    /* =============================================
       VISITOR IDS SEEN IN RANGE
    ============================================= */

    const rangeVisitorIds =
      Array.from(
        new Set(
          humanPageViewEvents
            .map(
              (event) =>
                event.visitor_id
            )
            .filter(Boolean)
        )
      );

    /* =============================================
       FULL HISTORY FOR THOSE VISITORS
    ============================================= */

    const historicalEvents =
      await fetchVisitorHistory(
        rangeVisitorIds,
        endDate
      );

    const reconstructedSessions =
      reconstructVisitorSessions(
        historicalEvents,
        startDate,
        endDate
      );

    /*
      Booking events are attached after sessions
      have been reconstructed.
    */
    attachBookingEvents(
      reconstructedSessions,
      cleanBookingEvents
    );

    const visitorSessions =
      finalizeVisitorSessions(
        reconstructedSessions
      );

    /* =============================================
       HUMAN KPIs
    ============================================= */

    const visitors =
      new Set(
        humanPageViewEvents
          .map(
            (event) =>
              event.visitor_id
          )
          .filter(Boolean)
      );

    const returningVisitorIds =
      new Set(
        visitorSessions
          .filter(
            (session) =>
              session
                .is_returning_visitor
          )
          .map(
            (session) =>
              session.visitor_id
          )
          .filter(Boolean)
      );

    const bookingSearches =
      cleanBookingEvents.filter(
        (event) =>
          event.event_type ===
          "booking_search"
      );

    const availabilityResults =
      cleanBookingEvents.filter(
        (event) =>
          event.event_type ===
          "booking_availability_result"
      );

    /* =============================================
       AUTOMATED TRAFFIC KPIs
    ============================================= */

    const automatedVisitors =
      new Set(
        automatedPageViewEvents
          .map(
            (event) =>
              event.visitor_id
          )
          .filter(Boolean)
      );

    const automatedSessions =
      new Set(
        automatedPageViewEvents
          .map(
            (event) =>
              event.session_id
          )
          .filter(Boolean)
      );

    const suspectedVisitors =
      new Set(
        suspectedPageViewEvents
          .map(
            (event) =>
              event.visitor_id
          )
          .filter(Boolean)
      );

    /* =============================================
       RESPONSE
    ============================================= */

    return res
      .status(200)
      .json({
        summary: {
          /*
            HUMAN / ANALYTICAL KPIs
          */
          pageviews:
            humanPageViewEvents.length,

          sessions:
            visitorSessions.length,

          visitors:
            visitors.size,

          returning_visitors:
            returningVisitorIds.size,

          new_visitors:
            Math.max(
              0,
              visitors.size -
                returningVisitorIds.size
            ),

          booking_searches:
            bookingSearches.length,

          booking_intent_rate:
            visitorSessions.length >
            0
              ? Math.round(
                  (
                    bookingSearches.length /
                    visitorSessions.length
                  ) * 100
                )
              : 0,

          /*
            TRAFFIC QUALITY
          */
          automated_pageviews:
            automatedPageViewEvents.length,

          automated_sessions:
            automatedSessions.size,

          automated_visitors:
            automatedVisitors.size,

          suspected_pageviews:
            suspectedPageViewEvents.length,

          suspected_visitors:
            suspectedVisitors.size,

          total_raw_pageviews:
            allPageViewEvents.length
        },

        /*
          Human traffic only.
        */
        top_pages:
          topEntries(
            countBy(
              humanPageViewEvents,
              "page_path"
            )
          ),

        top_referrers:
          topEntries(
            countBy(
              humanPageViewEvents,
              "referrer_source"
            )
          ),

        top_countries:
          topEntries(
            countBy(
              humanPageViewEvents,
              "country"
            )
          ),

        top_cities:
          topEntries(
            countBy(
              humanPageViewEvents,
              "city"
            )
          ),

        top_houses:
          topEntries(
            countSearchedHouses(
              availabilityResults
            )
          ),

        visitor_sessions:
          visitorSessions,

        hot_leads:
          visitorSessions
            .filter(
              (session) =>
                session.lead_score >=
                80
            )
            .sort(
              (a, b) =>
                b.lead_score -
                a.lead_score
            )
            .slice(0, 10),

        alerts:
          buildIntelligenceAlerts(
            visitorSessions
          ),

        reservation_funnel:
          buildReservationFunnel(
            visitorSessions
          ),

        live_visitors:
          buildLiveVisitors(
            cleanSiteEvents
          ),

        /*
          Existing fields preserved for
          backwards compatibility.
        */
        recent_site_events:
          cleanSiteEvents.slice(
            0,
            30
          ),

        recent_booking_events:
          cleanBookingEvents.slice(
            0,
            30
          ),

        booking_availability_results:
          availabilityResults,

        /*
          New diagnostic block.
          This allows the frontend to show
          "automated traffic filtered".
        */
        traffic_quality: {
          human_pageviews:
            humanPageViewEvents.length,

          automated_pageviews:
            automatedPageViewEvents.length,

          suspected_pageviews:
            suspectedPageViewEvents.length,

          raw_pageviews:
            allPageViewEvents.length,

          automated_percentage:
            allPageViewEvents.length >
            0
              ? Math.round(
                  (
                    automatedPageViewEvents.length /
                    allPageViewEvents.length
                  ) * 100
                )
              : 0
        },

        booking_summary: {
          gross_revenue:
            availabilityResults.reduce(
              (
                sum,
                event
              ) => {
                const directGross =
                  Number(
                    event.gross_total ||
                      event.gross_amount ||
                      event.metadata
                        ?.gross_total ||
                      event.metadata
                        ?.gross_amount ||
                      0
                  );

                if (
                  directGross > 0
                ) {
                  return (
                    sum +
                    directGross
                  );
                }

                const units =
                  event.available_units ||
                  event.metadata
                    ?.available_units ||
                  [];

                if (
                  Array.isArray(
                    units
                  ) &&
                  units.length
                ) {
                  return (
                    sum +
                    units.reduce(
                      (
                        unitSum,
                        unit
                      ) => {
                        return (
                          unitSum +
                          Number(
                            unit.gross_total ||
                              unit.gross_amount ||
                              unit.estimated_total ||
                              unit.total ||
                              unit.price ||
                              0
                          )
                        );
                      },
                      0
                    )
                  );
                }

                return sum;
              },
              0
            ),

          discounts_granted:
            availabilityResults.reduce(
              (
                sum,
                event
              ) => {
                const directDiscount =
                  Number(
                    event.discount_amount ||
                      event.metadata
                        ?.discount_amount ||
                      0
                  );

                if (
                  directDiscount > 0
                ) {
                  return (
                    sum +
                    directDiscount
                  );
                }

                const units =
                  event.available_units ||
                  event.metadata
                    ?.available_units ||
                  [];

                if (
                  Array.isArray(
                    units
                  ) &&
                  units.length
                ) {
                  return (
                    sum +
                    units.reduce(
                      (
                        unitSum,
                        unit
                      ) => {
                        return (
                          unitSum +
                          Number(
                            unit.discount_amount ||
                              unit.discount ||
                              0
                          )
                        );
                      },
                      0
                    )
                  );
                }

                return sum;
              },
              0
            ),

          potential_revenue:
            availabilityResults.reduce(
              (
                sum,
                event
              ) => {
                const directNet =
                  Number(
                    event.final_total ||
                      event.final_amount ||
                      event.estimated_total ||
                      event.metadata
                        ?.final_total ||
                      event.metadata
                        ?.final_amount ||
                      event.metadata
                        ?.estimated_total ||
                      0
                  );

                if (
                  directNet > 0
                ) {
                  return (
                    sum +
                    directNet
                  );
                }

                const units =
                  event.available_units ||
                  event.metadata
                    ?.available_units ||
                  [];

                if (
                  Array.isArray(
                    units
                  ) &&
                  units.length
                ) {
                  return (
                    sum +
                    units.reduce(
                      (
                        unitSum,
                        unit
                      ) => {
                        return (
                          unitSum +
                          Number(
                            unit.final_total ||
                              unit.final_amount ||
                              unit.estimated_total ||
                              unit.total ||
                              unit.price ||
                              0
                          )
                        );
                      },
                      0
                    )
                  );
                }

                return sum;
              },
              0
            ),

          available_queries:
            availabilityResults.filter(
              (event) =>
                event.availability_status ===
                  "available" ||
                Number(
                  event.available_units_count ||
                    0
                ) > 0 ||
                (
                  Array.isArray(
                    event.available_units
                  ) &&
                  event.available_units
                    .length > 0
                ) ||
                (
                  Array.isArray(
                    event.metadata
                      ?.available_units
                  ) &&
                  event.metadata
                    .available_units
                    .length > 0
                )
            ).length,

          unavailable_queries:
            availabilityResults.filter(
              (event) =>
                event.availability_status ===
                  "unavailable" ||
                event.unavailable_reason
            ).length
        }
      });
  } catch (error) {
    console.error(
      "admin-analytics error:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.message
      });
  }
}
(function () {
  const API_ENDPOINT = "/api/site-event";

  const KEYS = {
    visitorId: "cdv_visitor_id",
    firstSeenAt: "cdv_first_seen_at",
    lastSeenAt: "cdv_last_seen_at",
    visitCount: "cdv_visit_count",
    sessionId: "cdv_session_id",
    sessionStartedAt: "cdv_session_started_at",
    lastActivityAt: "cdv_last_activity_at",
    lastSessionDate: "cdv_last_session_date"
  };

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const HEARTBEAT_INTERVAL_MS = 25 * 1000;

  let memoryStore = {};
  let heartbeatTimer = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function createId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function canUseLocalStorage() {
    try {
      const key = "__cdv_storage_test__";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  const storageOk = canUseLocalStorage();

  function getCookie(name) {
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)")
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value, days = 365) {
    const maxAge = days * 24 * 60 * 60;

    document.cookie =
      `${name}=${encodeURIComponent(value)}; ` +
      `Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;
  }

  function getItem(key) {
    if (storageOk) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }

    const cookieValue = getCookie(key);
    if (cookieValue) return cookieValue;

    return memoryStore[key] || null;
  }

  function setItem(key, value) {
    memoryStore[key] = value;

    if (storageOk) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    }

    setCookie(key, value);
  }

  function getOrCreateId(key) {
    let value = getItem(key);

    if (!value) {
      value = createId();
      setItem(key, value);
    }

    return value;
  }

  function isLikelyBot() {
    const ua = (navigator.userAgent || "").toLowerCase();

    const botPatterns = [
      "bot",
      "crawler",
      "spider",
      "scraper",
      "headless",
      "python",
      "curl",
      "wget",
      "node-fetch",
      "axios",
      "monitor",
      "uptime",
      "preview",
      "facebookexternalhit",
      "whatsapp",
      "telegram",
      "slackbot",
      "slurp",
      "bingpreview",
      "yandex",
      "semrush",
      "ahrefs",
      "mj12bot",
      "googlebot",
      "gptbot",
      "claudebot",
      "baiduspider"
    ];

    const isBotUA = botPatterns.some((pattern) => ua.includes(pattern));

    const isHeadless =
      navigator.webdriver === true ||
      !navigator.languages ||
      navigator.languages.length === 0;

    const isFakeScreen =
      window.innerWidth < 300 ||
      window.innerHeight < 300;

    return isBotUA || isHeadless || isFakeScreen;
  }

  function getVisitor() {
    let visitorId = getOrCreateId(KEYS.visitorId);
    let firstSeenAt = getItem(KEYS.firstSeenAt);
    let visitCount = Number(getItem(KEYS.visitCount) || 0);

    if (!firstSeenAt) {
      firstSeenAt = nowIso();
      setItem(KEYS.firstSeenAt, firstSeenAt);
    }

    setItem(KEYS.lastSeenAt, nowIso());

    return {
      visitor_id: visitorId,
      first_seen_at: firstSeenAt,
      visit_count: visitCount
    };
  }

  function shouldCreateNewSession() {
    const sessionId = getItem(KEYS.sessionId);
    const lastActivityAt = getItem(KEYS.lastActivityAt);
    const lastSessionDate = getItem(KEYS.lastSessionDate);

    if (!sessionId || !lastActivityAt) return true;

    const inactiveMs = Date.now() - new Date(lastActivityAt).getTime();

    if (inactiveMs > SESSION_TIMEOUT_MS) return true;

    if (lastSessionDate && lastSessionDate !== todayKey()) return true;

    return false;
  }

  function getSession() {
    let sessionId = getItem(KEYS.sessionId);
    let sessionStartedAt = getItem(KEYS.sessionStartedAt);
    let visitCount = Number(getItem(KEYS.visitCount) || 0);

    const newSession = shouldCreateNewSession();

    if (newSession) {
      sessionId = createId();
      sessionStartedAt = nowIso();
      visitCount += 1;

      setItem(KEYS.sessionId, sessionId);
      setItem(KEYS.sessionStartedAt, sessionStartedAt);
      setItem(KEYS.visitCount, String(visitCount));
      setItem(KEYS.lastSessionDate, todayKey());
    }

    setItem(KEYS.lastActivityAt, nowIso());

    return {
      session_id: sessionId,
      session_started_at: sessionStartedAt,
      visit_count: visitCount,
      is_new_session: newSession,
      is_returning_visitor: visitCount > 1
    };
  }

  function markActivity() {
    setItem(KEYS.lastActivityAt, nowIso());
  }

  function buildPayload(eventType = "page_view", metadata = {}) {
    const visitor = getVisitor();
    const session = getSession();
    const botSuspected = isLikelyBot();

    return {
      event_type: eventType,

      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title || null,
      referrer: document.referrer || null,

      language: navigator.language || null,
      locale: document.documentElement.lang || null,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      timezone_offset: new Date().getTimezoneOffset(),
      local_time: new Date().toString(),

      user_agent: navigator.userAgent || null,
      screen_width: window.innerWidth || null,
      screen_height: window.innerHeight || null,

      visitor_id: visitor.visitor_id,
      session_id: session.session_id,
      first_seen_at: visitor.first_seen_at,
      visit_count: session.visit_count,

      session_started_at: session.session_started_at,
      last_activity_at: nowIso(),

      is_returning_visitor: session.is_returning_visitor,
      is_bot_suspected: botSuspected,

      metadata: {
        ...metadata,
        tracked_at: nowIso()
      }
    };
  }

  async function sendPayload(payload, options = {}) {
    try {
      const body = JSON.stringify(payload);

      if (options.beacon && navigator.sendBeacon) {
        const blob = new Blob([body], {
          type: "application/json"
        });

        navigator.sendBeacon(API_ENDPOINT, blob);
        return;
      }

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body,
        keepalive: true
      });

      if (!response.ok) {
        console.warn("Site analytics API error:", await response.text());
      }

      console.info("Site event tracked:", payload);
    } catch (err) {
      console.warn("Site analytics failed:", err);
    }
  }

  async function trackSiteEvent(eventType = "page_view", metadata = {}, options = {}) {
    const payload = buildPayload(eventType, metadata);

    if (eventType === "page_view" && payload.is_bot_suspected) {
      console.warn("Bot pageview blocked");
      return;
    }

    await sendPayload(payload, options);
  }

  window.trackSiteEvent = trackSiteEvent;

  ["mousemove", "scroll", "keydown", "touchstart", "click"].forEach((event) => {
    window.addEventListener(event, markActivity, { passive: true });
  });

  function startHeartbeat() {
    if (heartbeatTimer) return;

    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        trackSiteEvent("heartbeat", {
          visibility: document.visibilityState
        });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  document.addEventListener("visibilitychange", () => {
    markActivity();

    if (document.visibilityState === "hidden") {
      trackSiteEvent(
        "session_pause",
        { reason: "visibility_hidden" },
        { beacon: true }
      );
    }

    if (document.visibilityState === "visible") {
      trackSiteEvent("session_resume", {
        reason: "visibility_visible"
      });
    }
  });

  window.addEventListener("pagehide", () => {
    trackSiteEvent(
      "session_end",
      { reason: "pagehide" },
      { beacon: true }
    );
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      trackSiteEvent("page_view", {
        source: "site-analytics.js"
      });
      startHeartbeat();
    });
  } else {
    trackSiteEvent("page_view", {
      source: "site-analytics.js"
    });
    startHeartbeat();
  }
})();
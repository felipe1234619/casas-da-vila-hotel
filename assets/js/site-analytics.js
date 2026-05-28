(function () {
  function getOrCreateId(key, storage) {
    let value = storage.getItem(key);

    if (!value) {
      value = crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2);

      storage.setItem(key, value);
    }

    return value;
  }

  function isLikelyBot() {
    const ua = (navigator.userAgent || "").toLowerCase();

    const botPatterns = [
      "bot", "crawler", "spider", "scraper", "headless",
      "python", "curl", "wget", "node-fetch", "axios",
      "monitor", "uptime", "preview", "facebookexternalhit",
      "whatsapp", "slurp", "bingpreview", "yandex",
      "semrush", "ahrefs", "mj12bot", "googlebot", "baiduspider"
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

  function getVisitorId() {
    return getOrCreateId("cdv_visitor_id", localStorage);
  }

  function getSessionId() {
    return getOrCreateId("cdv_session_id", sessionStorage);
  }

  async function trackSiteEvent(eventType = "page_view", metadata = {}) {
    try {
      const botSuspected = isLikelyBot();

      if (eventType === "page_view" && botSuspected) {
        console.warn("Bot pageview blocked");
        return;
      }

      const payload = {
        event_type: eventType,

        page_url: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title || null,
        referrer: document.referrer || null,

        language: navigator.language || null,
        locale: document.documentElement.lang || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,

        user_agent: navigator.userAgent || null,
        screen_width: window.innerWidth || null,
        screen_height: window.innerHeight || null,

        visitor_id: getVisitorId(),
        session_id: getSessionId(),
visit_count: Number(localStorage.getItem("cdv_visit_count") || 0) + 1,
is_returning_visitor: Number(localStorage.getItem("cdv_visit_count") || 0) >= 1,
        is_bot_suspected: botSuspected,

        metadata: {
          ...metadata,
          tracked_at: new Date().toISOString()
        }
      };
localStorage.setItem(
  "cdv_visit_count",
  String(payload.visit_count)
);
      const response = await fetch("/api/site-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn("Site analytics API error:", await response.text());
      }

      console.info("Site event tracked:", payload);
    } catch (err) {
      console.warn("Site analytics failed:", err);
    }
  }

  window.trackSiteEvent = trackSiteEvent;

  window.CDVAnalytics = {
    track: trackSiteEvent,
    getVisitorId,
    getSessionId
  };

function startHeartbeat() {
  setInterval(() => {
    trackSiteEvent("heartbeat", {
      source: "live_heartbeat"
    });
  }, 30000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    trackSiteEvent("page_view");
    startHeartbeat();
  });
} else {
  trackSiteEvent("page_view");
  startHeartbeat();
}})();
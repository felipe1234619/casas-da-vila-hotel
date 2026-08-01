(function () {
  function getOrCreateId(key, storage) {
    let value = storage.getItem(key);

    if (!value) {
      value =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) + Math.random().toString(16).slice(2);

      storage.setItem(key, value);
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
      "slurp",
      "bingpreview",
      "yandex",
      "semrush",
      "ahrefs",
      "mj12bot",
      "googlebot",
      "baiduspider"
    ];

    const isBotUA = botPatterns.some((pattern) => ua.includes(pattern));

    const isHeadless =
      navigator.webdriver === true ||
      !navigator.languages ||
      navigator.languages.length === 0;

    const isFakeScreen =
      window.innerWidth < 300 || window.innerHeight < 300;

    return isBotUA || isHeadless || isFakeScreen;
  }

  function getVisitorId() {
    return getOrCreateId("cdv_visitor_id", localStorage);
  }

  function getSessionId() {
    return getOrCreateId("cdv_session_id", sessionStorage);
  }

  function getProposalMetadata() {
    const root = document.querySelector("[data-proposal-root]");

    if (!root) {
      return {};
    }

    return {
      page_type: root.dataset.pageType || null,
      proposal_slug: root.dataset.proposalSlug || null,
      guest_name: root.dataset.guestName || null,
      stay_title: root.dataset.stayTitle || null,
      stay_period: root.dataset.stayPeriod || null,
      total_value_gbp: Number(root.dataset.totalValue || 0) || null,
      deposit_value_gbp: Number(root.dataset.depositValue || 0) || null,
      guest_count: Number(root.dataset.guestCount || 0) || null,
      villa_count: Number(root.dataset.villaCount || 0) || null,
      stay_nights: Number(root.dataset.stayNights || 0) || null
    };
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
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || null,

        user_agent: navigator.userAgent || null,
        screen_width: window.innerWidth || null,
        screen_height: window.innerHeight || null,

        visitor_id: getVisitorId(),
        session_id: getSessionId(),

        is_bot_suspected: botSuspected,

        metadata: {
          ...getProposalMetadata(),
          ...metadata,
          tracked_at: new Date().toISOString()
        }
      };

      const response = await fetch("/api/site-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        keepalive: true,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn(
          "Site analytics API error:",
          response.status,
          await response.text()
        );
      }

      console.info("Site event tracked:", payload);
    } catch (err) {
      console.warn("Site analytics failed:", err);
    }
  }

  function setupClickTracking() {
    document.addEventListener("click", function (event) {
      const target = event.target.closest("[data-analytics-event]");

      if (!target) {
        return;
      }

      trackSiteEvent(target.dataset.analyticsEvent, {
        element_label:
          target.dataset.analyticsLabel ||
          target.textContent?.trim() ||
          null,
        destination: target.getAttribute("href") || null
      });
    });
  }

  function setupSectionTracking() {
    const sections = document.querySelectorAll(
      "[data-analytics-section]"
    );

    if (!sections.length || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.45) {
            return;
          }

          const section = entry.target;
          const sectionName = section.dataset.analyticsSection;

          if (!sectionName) {
            return;
          }

          const key =
            "cdv_section_viewed_" +
            window.location.pathname +
            "_" +
            sectionName;

          if (sessionStorage.getItem(key)) {
            observer.unobserve(section);
            return;
          }

          sessionStorage.setItem(key, "true");

          trackSiteEvent("proposal_section_viewed", {
            section: sectionName
          });

          observer.unobserve(section);
        });
      },
      {
        threshold: [0.45]
      }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  function setupEngagementTracking() {
    const startedAt = Date.now();
    let lastTrackedSeconds = 0;

    window.setInterval(function () {
      if (document.visibilityState !== "visible") {
        return;
      }

      const seconds = Math.floor((Date.now() - startedAt) / 1000);

      if (seconds - lastTrackedSeconds < 30) {
        return;
      }

      lastTrackedSeconds = seconds;

      trackSiteEvent("proposal_engagement", {
        engaged_seconds: seconds
      });
    }, 30000);
  }

  function initializeAnalytics() {
    trackSiteEvent("page_view");
    setupClickTracking();
    setupSectionTracking();
    setupEngagementTracking();
  }

  window.trackSiteEvent = trackSiteEvent;

  window.CDVAnalytics = {
    track: trackSiteEvent,
    getVisitorId,
    getSessionId
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeAnalytics
    );
  } else {
    initializeAnalytics();
  }
})();
(function () {
  const STORAGE = {
    visitorId: "cdv_visitor_id",
    visitCount: "cdv_visit_count",
    sessionId: "cdv_session_id",
    sessionInitialized: "cdv_session_initialized",
    sessionLandingPage: "cdv_session_landing_page",
    sessionStartedAt: "cdv_session_started_at",
    sessionUtm: "cdv_session_utm"
  };

  function createId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function getOrCreateId(key, storage) {
    let value = storage.getItem(key);

    if (!value) {
      value = createId();
      storage.setItem(key, value);
    }

    return value;
  }

  function getVisitorId() {
    return getOrCreateId(STORAGE.visitorId, localStorage);
  }

  function getSessionId() {
    return getOrCreateId(STORAGE.sessionId, sessionStorage);
  }

  function initializeSession() {
    const alreadyInitialized =
      sessionStorage.getItem(STORAGE.sessionInitialized) === "true";

    if (alreadyInitialized) {
      return {
        isNewSession: false,
        visitNumber: Number(
          localStorage.getItem(STORAGE.visitCount) || 1
        )
      };
    }

    const previousVisits = Number(
      localStorage.getItem(STORAGE.visitCount) || 0
    );

    const visitNumber = previousVisits + 1;

    localStorage.setItem(
      STORAGE.visitCount,
      String(visitNumber)
    );

    sessionStorage.setItem(
      STORAGE.sessionInitialized,
      "true"
    );

    sessionStorage.setItem(
      STORAGE.sessionLandingPage,
      window.location.pathname
    );

    sessionStorage.setItem(
      STORAGE.sessionStartedAt,
      new Date().toISOString()
    );

    return {
      isNewSession: true,
      visitNumber
    };
  }

  const sessionState = initializeSession();

  function getVisitNumber() {
    return Number(
      localStorage.getItem(STORAGE.visitCount) || 1
    );
  }

  function isReturningVisitor() {
    return getVisitNumber() > 1;
  }

  function getLandingPage() {
    return (
      sessionStorage.getItem(
        STORAGE.sessionLandingPage
      ) || window.location.pathname
    );
  }

  function getSessionStartedAt() {
    return (
      sessionStorage.getItem(
        STORAGE.sessionStartedAt
      ) || new Date().toISOString()
    );
  }

  function isFirstPageOfSession() {
    return (
      sessionState.isNewSession === true &&
      window.location.pathname === getLandingPage()
    );
  }

  function getCurrentUtm() {
    const params = new URLSearchParams(
      window.location.search
    );

    const utm = {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_term: params.get("utm_term"),
      utm_content: params.get("utm_content")
    };

    const hasUtm = Object.values(utm).some(Boolean);

    if (hasUtm) {
      sessionStorage.setItem(
        STORAGE.sessionUtm,
        JSON.stringify(utm)
      );

      return utm;
    }

    try {
      const stored = sessionStorage.getItem(
        STORAGE.sessionUtm
      );

      return stored
        ? JSON.parse(stored)
        : {
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            utm_term: null,
            utm_content: null
          };
    } catch (_) {
      return {
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_term: null,
        utm_content: null
      };
    }
  }

  function getReferrerData() {
    const raw = document.referrer || "";

    if (!raw) {
      return {
        referrer: null,
        referrer_source: "direct",
        referrer_domain: null
      };
    }

    try {
      const url = new URL(raw);
      const host = url.hostname
        .toLowerCase()
        .replace(/^www\./, "");

      if (
        host === window.location.hostname.replace(/^www\./, "")
      ) {
        return {
          referrer: raw,
          referrer_source: "internal",
          referrer_domain: host
        };
      }

      let source = "external";

      if (
        host.includes("google.")
      ) {
        source = "google";
      } else if (
        host.includes("bing.com")
      ) {
        source = "bing";
      } else if (
        host.includes("instagram.com") ||
        host.includes("l.instagram.com")
      ) {
        source = "instagram";
      } else if (
        host.includes("facebook.com") ||
        host.includes("fb.com") ||
        host.includes("l.facebook.com")
      ) {
        source = "facebook";
      } else if (
        host.includes("t.co") ||
        host.includes("twitter.com") ||
        host.includes("x.com")
      ) {
        source = "x";
      } else if (
        host.includes("linkedin.com")
      ) {
        source = "linkedin";
      } else if (
        host.includes("chatgpt.com") ||
        host.includes("openai.com")
      ) {
        source = "chatgpt";
      } else if (
        host.includes("whatsapp.com")
      ) {
        source = "whatsapp";
      }

      return {
        referrer: raw,
        referrer_source: source,
        referrer_domain: host
      };
    } catch (_) {
      return {
        referrer: raw,
        referrer_source: "external",
        referrer_domain: null
      };
    }
  }

  function getDeviceData() {
    const ua = navigator.userAgent || "";

    let deviceType = "desktop";
    let browserName = "unknown";
    let browserVersion = null;
    let operatingSystem = "unknown";

    if (/ipad|tablet/i.test(ua)) {
      deviceType = "tablet";
    } else if (
      /iphone|ipod|android.*mobile|mobile/i.test(ua)
    ) {
      deviceType = "mobile";
    }

    if (/edg\/([\d.]+)/i.test(ua)) {
      browserName = "Edge";
      browserVersion =
        ua.match(/edg\/([\d.]+)/i)?.[1] || null;
    } else if (/opr\/([\d.]+)/i.test(ua)) {
      browserName = "Opera";
      browserVersion =
        ua.match(/opr\/([\d.]+)/i)?.[1] || null;
    } else if (
      /chrome\/([\d.]+)/i.test(ua) &&
      !/edg\//i.test(ua)
    ) {
      browserName = "Chrome";
      browserVersion =
        ua.match(/chrome\/([\d.]+)/i)?.[1] || null;
    } else if (/firefox\/([\d.]+)/i.test(ua)) {
      browserName = "Firefox";
      browserVersion =
        ua.match(/firefox\/([\d.]+)/i)?.[1] || null;
    } else if (
      /safari\/([\d.]+)/i.test(ua) &&
      /version\/([\d.]+)/i.test(ua)
    ) {
      browserName = "Safari";
      browserVersion =
        ua.match(/version\/([\d.]+)/i)?.[1] || null;
    }

    if (/iphone|ipad|ipod/i.test(ua)) {
      operatingSystem = "iOS";
    } else if (/android/i.test(ua)) {
      operatingSystem = "Android";
    } else if (/windows nt/i.test(ua)) {
      operatingSystem = "Windows";
    } else if (/mac os x/i.test(ua)) {
      operatingSystem = "macOS";
    } else if (/linux/i.test(ua)) {
      operatingSystem = "Linux";
    }

    return {
      device_type: deviceType,
      browser_name: browserName,
      browser_version: browserVersion,
      operating_system: operatingSystem
    };
  }

  function getBotAssessment() {
    const ua = (
      navigator.userAgent || ""
    ).toLowerCase();

    let score = 0;

    const strongBotPatterns = [
      "googlebot",
      "bingbot",
      "baiduspider",
      "yandexbot",
      "gptbot",
      "claudebot",
      "semrush",
      "ahrefs",
      "mj12bot"
    ];

    const automationPatterns = [
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
      "uptime"
    ];

    const previewPatterns = [
      "facebookexternalhit",
      "bingpreview",
      "preview",
      "slackbot",
      "telegrambot"
    ];

    if (
      strongBotPatterns.some((p) =>
        ua.includes(p)
      )
    ) {
      score += 100;
    }

    if (
      automationPatterns.some((p) =>
        ua.includes(p)
      )
    ) {
      score += 70;
    }

    if (
      previewPatterns.some((p) =>
        ua.includes(p)
      )
    ) {
      score += 50;
    }

    if (navigator.webdriver === true) {
      score += 60;
    }

    if (
      !navigator.languages ||
      navigator.languages.length === 0
    ) {
      score += 30;
    }

    if (
      window.innerWidth < 300 ||
      window.innerHeight < 300
    ) {
      score += 30;
    }

    let likelihood = "low";

    if (score >= 70) {
      likelihood = "high";
    } else if (score >= 30) {
      likelihood = "medium";
    }

    return {
      suspected: likelihood !== "low",
      likelihood
    };
  }

  function getProposalMetadata() {
    const root = document.querySelector(
      "[data-proposal-root]"
    );

    if (!root) {
      return {};
    }

    return {
      page_type:
        root.dataset.pageType || null,
      proposal_slug:
        root.dataset.proposalSlug || null,
      guest_name:
        root.dataset.guestName || null,
      stay_title:
        root.dataset.stayTitle || null,
      stay_period:
        root.dataset.stayPeriod || null,
      total_value_gbp:
        Number(root.dataset.totalValue || 0) ||
        null,
      deposit_value_gbp:
        Number(root.dataset.depositValue || 0) ||
        null,
      guest_count:
        Number(root.dataset.guestCount || 0) ||
        null,
      villa_count:
        Number(root.dataset.villaCount || 0) ||
        null,
      stay_nights:
        Number(root.dataset.stayNights || 0) ||
        null
    };
  }

  async function trackSiteEvent(
    eventType = "page_view",
    metadata = {}
  ) {
    try {
      const bot = getBotAssessment();
      const referrer = getReferrerData();
      const utm = getCurrentUtm();
      const device = getDeviceData();

      const payload = {
        event_type: eventType,

        page_url: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title || null,

        referrer: referrer.referrer,
        referrer_source:
          referrer.referrer_source,
        referrer_domain:
          referrer.referrer_domain,

        language:
          navigator.language || null,
        locale:
          document.documentElement.lang || null,

        timezone:
          Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone || null,

        timezone_offset:
          new Date().getTimezoneOffset(),

        local_time:
          new Date().toISOString(),

        user_agent:
          navigator.userAgent || null,

        screen_width:
          window.innerWidth || null,

        screen_height:
          window.innerHeight || null,

        visitor_id: getVisitorId(),
        session_id: getSessionId(),

        landing_page: getLandingPage(),
        first_page_of_session:
          isFirstPageOfSession(),

        is_returning_visitor:
          isReturningVisitor(),

        visitor_visit_number:
          getVisitNumber(),

        session_started_at:
          getSessionStartedAt(),

        last_activity_at:
          new Date().toISOString(),

        ...utm,
        ...device,

        is_bot_suspected:
          bot.suspected,

        bot_likelihood:
          bot.likelihood,

        metadata: {
          ...getProposalMetadata(),
          ...metadata,
          tracked_at:
            new Date().toISOString()
        }
      };

      const response = await fetch(
        "/api/site-event",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          keepalive: true,
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        console.warn(
          "Site analytics API error:",
          response.status,
          await response.text()
        );
      }
    } catch (err) {
      console.warn(
        "Site analytics failed:",
        err
      );
    }
  }

  function setupClickTracking() {
    document.addEventListener(
      "click",
      function (event) {
        const target =
          event.target.closest(
            "[data-analytics-event]"
          );

        if (!target) {
          return;
        }

        trackSiteEvent(
          target.dataset.analyticsEvent,
          {
            element_label:
              target.dataset.analyticsLabel ||
              target.textContent?.trim() ||
              null,

            destination:
              target.getAttribute("href") ||
              null
          }
        );
      }
    );
  }

  function setupSectionTracking() {
    const sections =
      document.querySelectorAll(
        "[data-analytics-section]"
      );

    if (
      !sections.length ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const observer =
      new IntersectionObserver(
        function (entries) {
          entries.forEach(
            function (entry) {
              if (
                !entry.isIntersecting ||
                entry.intersectionRatio < 0.45
              ) {
                return;
              }

              const section =
                entry.target;

              const sectionName =
                section.dataset
                  .analyticsSection;

              if (!sectionName) {
                return;
              }

              const key =
                "cdv_section_viewed_" +
                window.location.pathname +
                "_" +
                sectionName;

              if (
                sessionStorage.getItem(key)
              ) {
                observer.unobserve(
                  section
                );
                return;
              }

              sessionStorage.setItem(
                key,
                "true"
              );

              trackSiteEvent(
                "proposal_section_viewed",
                {
                  section: sectionName
                }
              );

              observer.unobserve(
                section
              );
            }
          );
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
      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      const seconds = Math.floor(
        (Date.now() - startedAt) / 1000
      );

      if (
        seconds - lastTrackedSeconds <
        30
      ) {
        return;
      }

      lastTrackedSeconds = seconds;

      trackSiteEvent(
        "proposal_engagement",
        {
          engaged_seconds: seconds
        }
      );
    }, 30000);
  }

  function initializeAnalytics() {
    trackSiteEvent("page_view");
    setupClickTracking();
    setupSectionTracking();
    setupEngagementTracking();
  }

  window.trackSiteEvent =
    trackSiteEvent;

  window.CDVAnalytics = {
    track: trackSiteEvent,
    getVisitorId,
    getSessionId,
    getVisitNumber,
    isReturningVisitor,
    getLandingPage
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeAnalytics
    );
  } else {
    initializeAnalytics();
  }
})();
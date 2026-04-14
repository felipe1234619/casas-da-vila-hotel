(function () {
  const HOUSE_ALIASES = {
    casa_rosada: "casa_rosada",
    rosada: "casa_rosada",

    atelier_azul: "atelier_azul",
    atelie_azul: "atelier_azul",
    "ateliê_azul": "atelier_azul",
    azul: "atelier_azul",

    casa_grande: "casa_grande",
    grande: "casa_grande",

    casa_dende: "casa_dende",
    dende: "casa_dende",
    dendê: "casa_dende",

    casa_oca: "casa_oca",
    oca: "casa_oca",

    casa_branca: "casa_branca",
    branca: "casa_branca",

    casa_manga: "casa_manga",
    manga: "casa_manga",

    casa_baloes: "casa_baloes",
    "casa_dos_baloes": "casa_baloes",
    "casa_dos_balões": "casa_baloes",
    baloes: "casa_baloes",
    balões: "casa_baloes"
  };

  const RATE_RULES = [
    {
      name: "reveillon",
      from: "2026-12-15",
      to: "2027-01-06",
      minNights: 7,
      prices: {
        casa_rosada: 3980,
        atelier_azul: 3750,
        casa_grande: 9980,
        casa_dende: 7580,
        casa_oca: 3750,
        casa_branca: 3880,
        casa_manga: 3880,
        casa_baloes: 4550
      }
    },
    {
      name: "standard_2026",
      from: "2026-01-01",
      to: "2026-12-14",
      prices: {
        casa_rosada: 1980,
        atelier_azul: 1650,
        casa_grande: 4250,
        casa_dende: 3550,
        casa_oca: 1759,
        casa_branca: 1850,
        casa_manga: 1850,
        casa_baloes: 2250
      },
      minStay: {
        casa_rosada: 3,
        atelier_azul: 3,
        casa_grande: 3,
        casa_dende: 5,
        casa_oca: 5,
        casa_branca: 5,
        casa_manga: 5,
        casa_baloes: 5
      }
    },
    {
      name: "standard_2027",
      from: "2027-01-07",
      to: "2027-12-15",
      prices: {
        casa_rosada: 1980,
        atelier_azul: 1650,
        casa_grande: 4250,
        casa_dende: 3550,
        casa_oca: 1759,
        casa_branca: 1850,
        casa_manga: 1850,
        casa_baloes: 2250
      },
      minStay: {
        casa_rosada: 3,
        atelier_azul: 3,
        casa_grande: 3,
        casa_dende: 5,
        casa_oca: 5,
        casa_branca: 5,
        casa_manga: 5,
        casa_baloes: 5
      }
    }
  ];

  const BLOCKED_DATES = [
    {
      house: "casa_grande",
      from: "2026-07-12",
      to: "2026-07-14"
    },
    {
      house: "casa_rosada",
      from: "2026-07-08",
      to: "2026-07-11"
    }
  ];

  function normalizeHouse(raw) {
    if (!raw) return "";
    const key = String(raw)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
    return HOUSE_ALIASES[key] || key;
  }

  function parseDateLocal(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function diffNights(checkin, checkout) {
    const ci = parseDateLocal(checkin);
    const co = parseDateLocal(checkout);
    if (!ci || !co) return 0;
    return Math.round((co - ci) / 86400000);
  }

  function overlaps(checkin, checkout, from, to) {
    const ci = parseDateLocal(checkin);
    const co = parseDateLocal(checkout);
    const f = parseDateLocal(from);
    const t = parseDateLocal(to);
    if (!ci || !co || !f || !t) return false;
    return ci < t && co > f;
  }

  function findRule(checkin) {
    const ci = parseDateLocal(checkin);
    if (!ci) return null;

    return RATE_RULES.find((rule) => {
      const from = parseDateLocal(rule.from);
      const to = parseDateLocal(rule.to);
      return ci >= from && ci <= to;
    }) || null;
  }

  function isBlocked(house, checkin, checkout) {
    const normalizedHouse = normalizeHouse(house);

    return BLOCKED_DATES.some((b) => {
      return normalizeHouse(b.house) === normalizedHouse &&
        overlaps(checkin, checkout, b.from, b.to);
    });
  }

  function getBookingConfig({ house, checkin, checkout }) {
    const normalizedHouse = normalizeHouse(house);
    const nights = diffNights(checkin, checkout);

    if (!normalizedHouse || !checkin || !checkout || nights <= 0) {
      return {
        ok: false,
        reason: "invalid_dates",
        house: normalizedHouse,
        nights: 0
      };
    }

    const rule = findRule(checkin);
    if (!rule) {
      return {
        ok: false,
        reason: "period_not_configured",
        house: normalizedHouse,
        nights
      };
    }

    const price = rule.prices[normalizedHouse];
    if (!price) {
      return {
        ok: false,
        reason: "house_not_configured",
        house: normalizedHouse,
        nights
      };
    }

    const minNights = rule.minNights || (rule.minStay ? rule.minStay[normalizedHouse] : 1);
    const blocked = isBlocked(normalizedHouse, checkin, checkout);
    const meetsMinStay = nights >= minNights;

    return {
      ok: meetsMinStay && !blocked,
      reason: blocked ? "blocked" : (!meetsMinStay ? "min_stay" : "ok"),
      season: rule.name,
      house: normalizedHouse,
      checkin,
      checkout,
      nights,
      minNights,
      price,
      total: price * nights,
      blocked
    };
  }

  function formatCurrency(value, locale) {
    const safeLocale = locale || "pt-BR";
    const currency = safeLocale === "en-US" ? "USD" : "BRL";
    return new Intl.NumberFormat(safeLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  function getMessages(locale) {
    const isEN = locale === "en";

    return {
      minStay: isEN ? "Minimum stay" : "Estadia mínima",
      nights: isEN ? "nights" : "diárias",
      unavailable: isEN ? "Unavailable for selected dates" : "Indisponível nas datas selecionadas",
      seasonal: isEN ? "Holiday package" : "Pacote Réveillon",
      standard: isEN ? "Standard rate" : "Tarifa standard",
      total: isEN ? "Estimated total" : "Total estimado",
      reserve: isEN ? "Book now" : "Reservar agora",
      adjust: isEN ? "Adjust dates" : "Ajustar datas",
      from: isEN ? "From" : "A partir de",
      perNight: isEN ? "/ night" : "/ diária"
    };
  }

  function updateCard(card, config, locale) {
    const t = getMessages(locale);

    const priceEl = card.querySelector("[data-price]");
    const minStayEl = card.querySelector("[data-min-stay]");
    const statusEl = card.querySelector("[data-status]");
    const totalEl = card.querySelector("[data-total]");
    const buttonEl = card.querySelector("[data-book-link]");

    if (priceEl && config.price) {
      priceEl.textContent = `${t.from} ${formatCurrency(config.price, locale === "en" ? "en-US" : "pt-BR")} ${t.perNight}`;
    }

    if (minStayEl && config.minNights) {
      minStayEl.textContent = `${t.minStay}: ${config.minNights} ${t.nights}`;
    }

    if (totalEl && config.total) {
      totalEl.textContent = `${t.total}: ${formatCurrency(config.total, locale === "en" ? "en-US" : "pt-BR")}`;
    }

    if (statusEl) {
      if (config.reason === "blocked") {
        statusEl.textContent = t.unavailable;
      } else if (config.season === "reveillon") {
        statusEl.textContent = t.seasonal;
      } else {
        statusEl.textContent = t.standard;
      }
    }

    if (buttonEl) {
      if (!config.ok) {
        buttonEl.setAttribute("aria-disabled", "true");
        buttonEl.classList.add("is-disabled");
        buttonEl.textContent = config.reason === "blocked" ? t.unavailable : t.adjust;
        buttonEl.removeAttribute("href");
      } else {
        buttonEl.removeAttribute("aria-disabled");
        buttonEl.classList.remove("is-disabled");
      }
    }
  }

  function buildBookingUrl(basePath, house, checkin, checkout, guests) {
    const url = new URL(basePath, window.location.origin);
    if (house) url.searchParams.set("house", house);
    if (checkin) url.searchParams.set("checkin", checkin);
    if (checkout) url.searchParams.set("checkout", checkout);
    if (guests) url.searchParams.set("guests", guests);
    return url.pathname + url.search;
  }

  function refreshBookingCards(options) {
    const {
      locale = "pt",
      checkinSelector = "#checkin",
      checkoutSelector = "#checkout",
      guestsSelector = "#guests",
      cardSelector = "[data-house-card]",
      bookBasePath = "/pt/reservar/"
    } = options || {};

    const checkin = document.querySelector(checkinSelector)?.value || "";
    const checkout = document.querySelector(checkoutSelector)?.value || "";
    const guests = document.querySelector(guestsSelector)?.value || "";

    const cards = Array.from(document.querySelectorAll(cardSelector));
    if (!cards.length) return;

    cards.forEach((card) => {
      const rawHouse = card.getAttribute("data-house") || "";
      const house = normalizeHouse(rawHouse);
      if (!house) return;

      const config = getBookingConfig({ house, checkin, checkout });

      if (config.price) {
        updateCard(card, config, locale);
      }

      const buttonEl = card.querySelector("[data-book-link]");
      if (buttonEl && config.ok) {
        buttonEl.textContent = getMessages(locale).reserve;
        buttonEl.href = buildBookingUrl(bookBasePath, house, checkin, checkout, guests);
      }
    });
  }

  function bindBookingEngine(options) {
    const {
      checkinSelector = "#checkin",
      checkoutSelector = "#checkout",
      guestsSelector = "#guests"
    } = options || {};

    const checkinEl = document.querySelector(checkinSelector);
    const checkoutEl = document.querySelector(checkoutSelector);
    const guestsEl = document.querySelector(guestsSelector);

    const handler = () => refreshBookingCards(options);

    [checkinEl, checkoutEl, guestsEl].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", handler);
      el.addEventListener("input", handler);
    });

    refreshBookingCards(options);
  }

  window.BookingRules = {
    RATE_RULES,
    BLOCKED_DATES,
    normalizeHouse,
    getBookingConfig,
    isBlocked,
    refreshBookingCards,
    bindBookingEngine,
    buildBookingUrl,
    formatCurrency,
    formatYMD
  };
})();
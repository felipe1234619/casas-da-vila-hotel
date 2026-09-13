const $ = (id) => document.getElementById(id);

let currentRange = "today";
let dashboardData = null;
let previousLiveVisitorCount = 0;

let visitorsMapInstance = null;
let visitorsMapLayer = null;

const SESSION_LIMIT = 40;

/* =========================================================
   STORAGE / BASIC HELPERS
========================================================= */

function saveToken(token) {
  localStorage.setItem("cdv_admin_analytics_token", token);
}

function getToken() {
  return localStorage.getItem("cdv_admin_analytics_token") || "";
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch (_) {
    return "—";
  }
}

function formatSessionTime(value) {
  return formatDate(value);
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0));

  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  if (minutes < 60) {
    return secs ? `${minutes}m ${secs}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countryFlag(countryCode) {
  const code = String(countryCode || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{2}$/.test(code)) return "🌐";

  return code
    .split("")
    .map((char) =>
      String.fromCodePoint(127397 + char.charCodeAt())
    )
    .join("");
}

function normalizeSource(value) {
  const source = String(value || "direct")
    .trim()
    .toLowerCase();

  const labels = {
    direct: "Direct",
    internal: "Internal",
    google: "Google",
    bing: "Bing",
    instagram: "Instagram",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    whatsapp: "WhatsApp",
    chatgpt: "ChatGPT",
    x: "X",
    external: "External"
  };

  return labels[source] || value || "Direct";
}

function deviceSummary(session) {
  const parts = [
    session.device_type,
    session.browser_name,
    session.operating_system
  ]
    .filter(Boolean)
    .filter((value) => value !== "unknown");

  return parts.length
    ? parts.join(" · ")
    : "Dispositivo não identificado";
}

function renderList(id, items) {
  const el = $(id);

  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `<p class="empty">Sem dados ainda.</p>`;
    return;
  }

  el.innerHTML = items
    .map((item) => {
      const label = item.label || "unknown";

      const flag =
        id === "topCountries"
          ? `${countryFlag(label)} `
          : "";

      return `
        <div class="listRow">
          <strong>${flag}${escapeHtml(label)}</strong>
          <span>${Number(item.value || 0)}</span>
        </div>
      `;
    })
    .join("");
}

/* =========================================================
   VISITOR STATUS / SCORE
========================================================= */

function visitorStatus(session) {
  const visitNumber = Number(
    session.visit_number || 1
  );

  if (
    session.is_returning_visitor ||
    visitNumber > 1
  ) {
    return `Recorrente · ${visitNumber}ª visita`;
  }

  return "Novo visitante";
}

function getLeadScore(session) {
  const backendScore = Number(
    session.lead_score
  );

  if (Number.isFinite(backendScore)) {
    return Math.max(
      0,
      Math.min(100, backendScore)
    );
  }

  let score = 0;

  if (
    Number(session.page_count || 0) >= 3
  ) {
    score += 20;
  }

  if (session.has_booking_intent) {
    score += 30;
  }

  if (
    (session.bookings || []).length > 0
  ) {
    score += 25;
  }

  const visitedHouse =
    (session.pages || []).some((page) => {
      const path = String(
        page.path || ""
      );

      return (
        path.includes("/casas/") ||
        path.includes("/houses/")
      );
    });

  if (visitedHouse) {
    score += 15;
  }

  if (session.is_returning_visitor) {
    score += 10;
  }

  const source = String(
    session.referrer_source ||
    session.referrer ||
    ""
  );

  if (
    /google|instagram|chatgpt|youtube/i.test(
      source
    )
  ) {
    score += 10;
  }

  return Math.min(score, 100);
}

function scoreLabel(score) {
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
   TRAFFIC QUALITY
========================================================= */

function ensureTrafficQualityPanel() {
  let panel = $("trafficQualityPanel");

  if (panel) return panel;

  const anchor =
    $("visitorSessions") ||
    $("recentEvents") ||
    $("lastUpdated");

  if (!anchor) return null;

  panel = document.createElement("section");

  panel.id = "trafficQualityPanel";
  panel.className = "trafficQualityPanel";

  if (anchor.parentNode) {
    anchor.parentNode.insertBefore(
      panel,
      anchor
    );
  }

  return panel;
}

function renderTrafficQuality(data) {
  const panel =
    ensureTrafficQualityPanel();

  if (!panel) return;

  const summary =
    data?.summary || {};

  const quality =
    data?.traffic_quality || {};

  const human =
    quality.human_pageviews ??
    summary.pageviews ??
    0;

  const automated =
    quality.automated_pageviews ??
    summary.automated_pageviews ??
    0;

  const suspected =
    quality.suspected_pageviews ??
    summary.suspected_pageviews ??
    0;

  const raw =
    quality.raw_pageviews ??
    summary.total_raw_pageviews ??
    Number(human) +
      Number(automated);

  const percentage =
    quality.automated_percentage ??
    (
      Number(raw) > 0
        ? Math.round(
            (
              Number(automated) /
              Number(raw)
            ) * 100
          )
        : 0
    );

  panel.innerHTML = `
    <div class="trafficQualityHeader">
      <strong>Qualidade do tráfego</strong>

      <span>
        ${percentage}% do tráfego bruto foi filtrado como automatizado
      </span>
    </div>

    <div class="trafficQualityGrid">
      <div>
        <span>Humano</span>
        <strong>${Number(human)}</strong>
      </div>

      <div>
        <span>Automatizado filtrado</span>
        <strong>${Number(automated)}</strong>
      </div>

      <div>
        <span>Suspeito</span>
        <strong>${Number(suspected)}</strong>
      </div>

      <div>
        <span>Bruto</span>
        <strong>${Number(raw)}</strong>
      </div>
    </div>
  `;
}

/* =========================================================
   ALERTS / EVENT LISTS
========================================================= */

function renderBookings(items) {
  const el = $("recentBookings");

  if (!el) return;

  const rows =
    (items || [])
      .filter(
        (item) =>
          item.event_type ===
          "booking_search"
      )
      .slice(0, 16);

  if (!rows.length) {
    el.innerHTML = `
      <p class="empty">
        Nenhuma busca registrada ainda.
      </p>
    `;

    return;
  }

  el.innerHTML = rows
    .map(
      (item) => `
        <div class="tableRow">
          <strong>
            ${formatDate(item.created_at)}
          </strong>

          <span>
            ${escapeHtml(
              item.house_name ||
              "multi-house"
            )}
          </span>

          <span>
            ${escapeHtml(
              item.checkin || "—"
            )}
            →
            ${escapeHtml(
              item.checkout || "—"
            )}
          </span>

          <span>
            ${escapeHtml(
              item.country ||
              item.city ||
              item.timezone ||
              "origem indefinida"
            )}
          </span>
        </div>
      `
    )
    .join("");
}

function renderSiteEvents(items) {
  const el = $("recentEvents");

  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `
      <p class="empty">
        Nenhum acesso registrado ainda.
      </p>
    `;

    return;
  }

  el.innerHTML = items
    .slice(0, 18)
    .map((item) => {
      const bot =
        item.bot_likelihood === "high"
          ? " · BOT"
          : item.bot_likelihood === "medium"
            ? " · suspeito"
            : "";

      return `
        <div class="tableRow">
          <strong>
            ${formatDate(item.created_at)}
          </strong>

          <span>
            ${escapeHtml(
              item.page_path || "—"
            )}
          </span>

          <span>
            ${escapeHtml(
              item.country ||
              item.city ||
              item.timezone ||
              "origem indefinida"
            )}
            ${escapeHtml(bot)}
          </span>

          <span>
            ${escapeHtml(
              item.referrer_source ||
              item.referrer ||
              "direct / unknown"
            )}
          </span>
        </div>
      `;
    })
    .join("");
}

function renderBookingIntelligence(
  items
) {
  const el = $("bookingIntelligence");

  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `
      <p class="empty">
        Nenhuma consulta econômica registrada ainda.
      </p>
    `;

    return;
  }

  el.innerHTML = items
    .slice(0, 20)
    .map(
      (item) => `
        <div class="tableRow">
          <strong>
            ${formatDate(item.created_at)}
          </strong>

          <span>
            ${escapeHtml(
              item.checkin || "—"
            )}
            →
            ${escapeHtml(
              item.checkout || "—"
            )}
          </span>

          <span>
            ${item.available_units_count || 0}
            casas ·
            ${escapeHtml(
              item.availability_status ||
              "—"
            )}
          </span>

          <span>
            ${formatMoney(
              item.estimated_total
            )}
          </span>
        </div>
      `
    )
    .join("");
}

function renderAlerts(alerts) {
  const el = $("intelligenceAlerts");

  if (!el) return;

  if (!alerts || !alerts.length) {
    el.innerHTML = `
      <p class="empty">
        Nenhum alerta relevante no período.
      </p>
    `;

    return;
  }

  el.innerHTML = alerts
    .map(
      (item) => `
        <div class="alertRow">
          <strong>
            ${escapeHtml(
              item.title ||
              "Alerta"
            )}
          </strong>

          <span>
            ${escapeHtml(
              item.message ||
              item.description ||
              ""
            )}
          </span>
        </div>
      `
    )
    .join("");
}
async function loadDashboard() {
  const token =
    $("adminToken")?.value?.trim() ||
    getToken();

  if (!token) {
    alert("Informe o token de acesso.");
    return;
  }

  saveToken(token);

  try {
    const response = await fetch(
      `/api/admin-analytics?range=${encodeURIComponent(
        currentRange
      )}`,
      {
        headers: {
          "x-admin-token": token
        }
      }
    );

    if (!response.ok) {
      alert(
        "Acesso negado ou erro ao carregar dashboard."
      );
      return;
    }

    dashboardData =
      await response.json();

    const summary =
      dashboardData.summary || {};

    if ($("pageviews")) {
      $("pageviews").textContent =
        summary.pageviews ?? "0";
    }

    if ($("sessions")) {
      $("sessions").textContent =
        summary.sessions ?? "0";
    }

    if ($("visitors")) {
      $("visitors").textContent =
        summary.visitors ?? "0";
    }

    if ($("returningVisitors")) {
      $("returningVisitors").textContent =
        summary.returning_visitors ??
        "0";
    }

    if ($("bookingSearches")) {
      $("bookingSearches").textContent =
        summary.booking_searches ??
        "0";
    }

    if ($("bookingIntentRate")) {
      $("bookingIntentRate").textContent =
        `${
          summary.booking_intent_rate ??
          0
        }%`;
    }

    if ($("countriesReached")) {
      $("countriesReached").textContent =
        dashboardData.top_countries
          ?.length || 0;
    }

    if ($("citiesReached")) {
      $("citiesReached").textContent =
        dashboardData.top_cities
          ?.length || 0;
    }

    if ($("grossRevenue")) {
      $("grossRevenue").textContent =
        formatMoney(
          dashboardData
            .booking_summary
            ?.gross_revenue || 0
        );
    }

    if ($("discountsGranted")) {
      $("discountsGranted").textContent =
        formatMoney(
          dashboardData
            .booking_summary
            ?.discounts_granted ||
            0
        );
    }

    if ($("potentialRevenue")) {
      $("potentialRevenue").textContent =
        formatMoney(
          dashboardData
            .booking_summary
            ?.potential_revenue ||
            0
        );
    }

    if ($("availableQueries")) {
      $("availableQueries").textContent =
        dashboardData
          .booking_summary
          ?.available_queries ||
        0;
    }

    if ($("unavailableQueries")) {
      $("unavailableQueries").textContent =
        dashboardData
          .booking_summary
          ?.unavailable_queries ||
        0;
    }

    renderTrafficQuality(
      dashboardData
    );

    renderList(
      "topPages",
      dashboardData.top_pages
    );

    renderList(
      "topReferrers",
      dashboardData.top_referrers
    );

    renderList(
      "topCountries",
      dashboardData.top_countries
    );

    renderList(
      "topCities",
      dashboardData.top_cities
    );

    renderList(
      "topHouses",
      dashboardData.top_houses
    );

    renderAlerts(
      dashboardData.alerts
    );

    renderBookings(
      dashboardData
        .recent_booking_events
    );

    renderSiteEvents(
      dashboardData
        .recent_site_events
    );

    renderBookingIntelligence(
      dashboardData
        .booking_availability_results
    );

    renderReservationFunnel(
      dashboardData
        .reservation_funnel
    );

    renderHotLeads(
      dashboardData.hot_leads ||
      []
    );

    renderLiveVisitorToast(
      dashboardData
        .live_visitors ||
      []
    );

    renderLiveVisitorsPanel(
      dashboardData
        .live_visitors ||
      []
    );

    renderVisitorSessions(
      dashboardData
        .visitor_sessions ||
      []
    );

    renderVisitorsMap(
      dashboardData
        .visitor_sessions ||
      []
    );

    if ($("lastUpdated")) {
      $("lastUpdated").textContent =
        `● atualizado ${
          new Date().toLocaleTimeString(
            "pt-BR",
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          )
        }`;
    }
  } catch (error) {
    console.error(
      "Dashboard load failed:",
      error
    );

    alert(
      "Erro ao carregar os dados do dashboard."
    );
  }
}

/* =========================================================
   VISITOR SESSIONS
========================================================= */

function renderVisitorSessions(
  sessions = []
) {
  const container =
    $("visitorSessions");

  if (!container) return;

  const search =
    $("sessionSearch")
      ?.value
      ?.trim()
      ?.toLowerCase() ||
    "";

  const filteredSessions =
    sessions.filter(
      (session) => {
        if (!search) {
          return true;
        }

        const haystack = [
          session.country,
          session.city,
          session.region,
          session.referrer,
          session.referrer_source,
          session.referrer_domain,
          session.device_type,
          session.browser_name,
          session.operating_system,
          session.landing_page,
          visitorStatus(session),

          ...(
            session.pages ||
            []
          ).map(
            (page) =>
              page.path
          )
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(
          search
        );
      }
    );

  if (
    !filteredSessions.length
  ) {
    container.innerHTML = `
      <div class="emptyState">
        Nenhuma sessão encontrada para o filtro atual.
      </div>
    `;

    return;
  }

  container.innerHTML =
    filteredSessions
      .slice(
        0,
        SESSION_LIMIT
      )
      .map(
        (session) => {
          const score =
            getLeadScore(
              session
            );

          const status =
            visitorStatus(
              session
            );

          const sessionId =
            session
              .calculated_session_id ||
            session.session_id ||
            session.visitor_id ||
            "";

          const source =
            normalizeSource(
              session.referrer_source ||
              session.referrer
            );

          const location = [
            session.country ||
              "Unknown",

            session.city || ""
          ]
            .filter(Boolean)
            .join(" · ");

          const pagesHtml =
            (
              session.pages ||
              []
            )
              .map(
                (page) => `
                  <div class="timelineItem">
                    <span>
                      ${
                        formatSessionTime(
                          page.created_at
                        )
                      }
                    </span>

                    <strong>
                      ${
                        escapeHtml(
                          page.path ||
                          "—"
                        )
                      }
                    </strong>
                  </div>
                `
              )
              .join("");

          const bookingsHtml =
            (
              session.bookings ||
              []
            ).length
              ? (
                  session.bookings ||
                  []
                )
                  .map(
                    (
                      booking
                    ) => `
                      <div class="timelineItem">
                        <span>
                          ${
                            formatSessionTime(
                              booking.created_at
                            )
                          }
                        </span>

                        <strong>
                          ${
                            escapeHtml(
                              booking.checkin ||
                              "—"
                            )
                          }
                          →
                          ${
                            escapeHtml(
                              booking.checkout ||
                              "—"
                            )
                          }
                        </strong>

                        <small>
                          ${
                            escapeHtml(
                              booking.house_name ||
                              "multi-house"
                            )
                          }
                        </small>
                      </div>
                    `
                  )
                  .join("")
              : `
                  <p class="emptyState">
                    Nenhuma busca de reserva nesta sessão.
                  </p>
                `;

          return `
            <div
              class="visitorSessionCard"
              data-session-id="${
                escapeHtml(
                  sessionId
                )
              }"
              data-visitor-id="${
                escapeHtml(
                  session.visitor_id ||
                  ""
                )
              }"
            >
              <button
                class="visitorSessionButton"
                type="button"
              >
                <div class="visitorSessionTop">
                  <div>
                    <strong>
                      ${
                        countryFlag(
                          session.country
                        )
                      }
                      ${
                        escapeHtml(
                          location
                        )
                      }
                    </strong>

                    <small>
                      ${
                        escapeHtml(
                          source
                        )
                      }
                      ·
                      ${
                        escapeHtml(
                          deviceSummary(
                            session
                          )
                        )
                      }
                    </small>
                  </div>

                  <div class="sessionBadges">
                    <span>
                      ${
                        Number(
                          session.page_count ||
                          0
                        )
                      }
                      páginas
                    </span>

                    <span>
                      ${
                        session.has_booking_intent
                          ? "Reserva"
                          : "Explorando"
                      }
                    </span>

                    ${
                      session.is_returning_visitor
                        ? `
                          <span class="returningBadge">
                            🔁 ${
                              escapeHtml(
                                status
                              )
                            }
                          </span>
                        `
                        : `
                          <span class="newVisitorBadge">
                            Novo
                          </span>
                        `
                    }

                    <span class="scoreBadge">
                      ${
                        score
                      }/100
                      ·
                      ${
                        escapeHtml(
                          session.lead_label ||
                          scoreLabel(
                            score
                          )
                        )
                      }
                    </span>
                  </div>
                </div>
              </button>

              <div class="visitorSessionDetails">
                <div class="sessionOverview">
                  <div>
                    <small>
                      Landing page
                    </small>

                    <strong>
                      ${
                        escapeHtml(
                          session.landing_page ||
                          "—"
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Origem
                    </small>

                    <strong>
                      ${
                        escapeHtml(
                          source
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Dispositivo
                    </small>

                    <strong>
                      ${
                        escapeHtml(
                          deviceSummary(
                            session
                          )
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Duração
                    </small>

                    <strong>
                      ${
                        escapeHtml(
                          formatDuration(
                            session.duration_seconds
                          )
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Visitante
                    </small>

                    <strong>
                      ${
                        escapeHtml(
                          status
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Visitor ID
                    </small>

                    <strong>
                      ${
                        escapeHtml(
                          session.visitor_id
                            ? session.visitor_id.slice(
                                0,
                                12
                              )
                            : "—"
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Primeira atividade
                    </small>

                    <strong>
                      ${
                        formatDate(
                          session.first_seen_at
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Última atividade
                    </small>

                    <strong>
                      ${
                        formatDate(
                          session.last_seen_at
                        )
                      }
                    </strong>
                  </div>
                </div>

                <div class="sessionTimeline">
                  <h3>
                    Timeline da sessão
                  </h3>

                  ${
                    pagesHtml ||
                    `
                      <p class="emptyState">
                        Nenhuma página registrada.
                      </p>
                    `
                  }
                </div>

                <div class="sessionTimeline">
                  <h3>
                    Buscas de reserva
                  </h3>

                  ${bookingsHtml}
                </div>
              </div>
            </div>
          `;
        }
      )
      .join("");

  container
    .querySelectorAll(
      ".visitorSessionButton"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            button
              .closest(
                ".visitorSessionCard"
              )
              ?.classList.toggle(
                "isOpen"
              );
          }
        );
      }
    );
}

/* =========================================================
   RESERVATION FUNNEL
========================================================= */

function renderReservationFunnel(
  funnel
) {
  const el =
    $("reservationFunnel");

  if (!el || !funnel) {
    return;
  }

  const items = [
    [
      "Sessões",
      funnel.sessions
    ],

    [
      "Visitou casa",
      funnel.visited_house
    ],

    [
      "Foi para reservar",
      funnel.visited_booking
    ],

    [
      "Buscou datas",
      funnel.searched_dates
    ],

    [
      "Recebeu disponibilidade",
      funnel.got_availability
    ]
  ];

  el.innerHTML =
    items
      .map(
        (
          [
            label,
            value
          ]
        ) => `
          <div class="funnelStep">
            <span>
              ${label}
            </span>

            <strong>
              ${
                Number(
                  value ||
                  0
                )
              }
            </strong>
          </div>
        `
      )
      .join("");
}

/* =========================================================
   LIVE VISITORS
========================================================= */

function renderLiveVisitorToast(
  visitors = []
) {
  const el =
    $("liveVisitorToast");

  if (!el) return;

  const count =
    visitors.length ||
    0;

  if (
    count >
      previousLiveVisitorCount &&
    count > 0
  ) {
    const visitor =
      visitors[0];

    el.innerHTML = `
      <strong>
        Visitante ativo agora
      </strong>

      <span>
        ${
          escapeHtml(
            visitor.country ||
            "Origem desconhecida"
          )
        }

        ${
          visitor.city
            ? " · " +
              escapeHtml(
                visitor.city
              )
            : ""
        }

        ${
          visitor.page_path
            ? " · " +
              escapeHtml(
                visitor.page_path
              )
            : ""
        }
      </span>
    `;

    el.classList.add(
      "isVisible"
    );

    setTimeout(
      () => {
        el.classList.remove(
          "isVisible"
        );
      },
      7000
    );
  }

  previousLiveVisitorCount =
    count;
}

function renderLiveVisitorsPanel(
  visitors = []
) {
  const countEl =
    $("liveVisitorsCount");

  const listEl =
    $("liveVisitorsList");

  if (countEl) {
    countEl.textContent =
      visitors.length ||
      0;
  }

  if (!listEl) return;

  if (!visitors.length) {
    listEl.innerHTML = `
      <p class="empty">
        Nenhum visitante ativo agora.
      </p>
    `;

    return;
  }

  listEl.innerHTML =
    visitors
      .map(
        (visitor) => `
          <div class="liveVisitorRow">
            <strong>
              ${
                escapeHtml(
                  visitor.country ||
                  "Origem desconhecida"
                )
              }

              ${
                visitor.city
                  ? " · " +
                    escapeHtml(
                      visitor.city
                    )
                  : ""
              }
            </strong>

            <span>
              ${
                escapeHtml(
                  visitor.page_path ||
                  "—"
                )
              }
            </span>

            <small>
              ${
                escapeHtml(
                  deviceSummary(
                    visitor
                  )
                )
              }
              · última atividade:
              ${
                formatDate(
                  visitor.last_seen_at
                )
              }
            </small>
          </div>
        `
      )
      .join("");
}

/* =========================================================
   HOT LEADS
========================================================= */

function renderHotLeads(
  leads = []
) {
  const el =
    $("hotLeads");

  if (!el) return;

  if (!leads.length) {
    el.innerHTML = `
      <div class="emptyState">
        Nenhum lead qualificado no período.
      </div>
    `;

    return;
  }

  el.innerHTML = `
    <div class="hotLeadTable">
      ${
        leads
          .map(
            (lead) => {
              const lastPage =
                lead.pages?.[
                  lead.pages.length -
                  1
                ]?.path ||
                "—";

              const searchedHouse =
                lead.bookings?.[
                  0
                ]?.house_name ||
                "multi-house-search";

              return `
                <div class="hotLeadRow">
                  <div class="hotLeadScore">
                    ${
                      Number(
                        lead.lead_score ||
                        0
                      )
                    }
                  </div>

                  <div class="hotLeadInfo">
                    <strong>
                      ${
                        escapeHtml(
                          lead.city ||
                          "Unknown city"
                        )
                      }
                      ·
                      ${
                        escapeHtml(
                          lead.country ||
                          "--"
                        )
                      }
                    </strong>

                    <span>
                      ${
                        escapeHtml(
                          lastPage
                        )
                      }
                    </span>
                  </div>

                  <div class="hotLeadMeta">
                    <small>
                      ${
                        escapeHtml(
                          searchedHouse
                        )
                      }
                    </small>

                    <small>
                      ${
                        escapeHtml(
                          lead.lead_label ||
                          "Intent"
                        )
                      }
                    </small>

                    ${
                      lead.is_returning_visitor
                        ? `
                          <small>
                            🔁 ${
                              escapeHtml(
                                visitorStatus(
                                  lead
                                )
                              )
                            }
                          </small>
                        `
                        : ""
                    }
                  </div>
                </div>
              `;
            }
          )
          .join("")
      }
    </div>
  `;
}

/* =========================================================
   MAP
========================================================= */

function geographicKey(
  session
) {
  const lat =
    Number(
      session.latitude
    );

  const lng =
    Number(
      session.longitude
    );

  const city =
    String(
      session.city ||
      ""
    )
      .trim()
      .toLowerCase();

  const country =
    String(
      session.country ||
      ""
    )
      .trim()
      .toLowerCase();

  const roundedLat =
    Number.isFinite(lat)
      ? lat.toFixed(2)
      : "";

  const roundedLng =
    Number.isFinite(lng)
      ? lng.toFixed(2)
      : "";

  return (
    `${country}|` +
    `${city}|` +
    `${roundedLat}|` +
    `${roundedLng}`
  );
}

function buildMapClusters(
  sessions = []
) {
  const clusters =
    new Map();

  sessions.forEach(
    (session) => {
      const lat =
        Number(
          session.latitude
        );

      const lng =
        Number(
          session.longitude
        );

      if (
        !Number.isFinite(
          lat
        ) ||
        !Number.isFinite(
          lng
        )
      ) {
        return;
      }

      const key =
        geographicKey(
          session
        );

      if (
        !clusters.has(
          key
        )
      ) {
        clusters.set(
          key,
          {
            latitude:
              lat,

            longitude:
              lng,

            country:
              session.country ||
              "Origem desconhecida",

            city:
              session.city ||
              "",

            sessions:
              []
          }
        );
      }

      clusters
        .get(key)
        .sessions
        .push(
          session
        );
    }
  );

  return Array.from(
    clusters.values()
  );
}

function renderVisitorsMap(
  sessions = []
) {
  const el =
    $("visitorsMap");

  if (
    !el ||
    typeof L ===
      "undefined"
  ) {
    return;
  }

  if (
    !visitorsMapInstance
  ) {
    visitorsMapInstance =
      L.map(
        "visitorsMap",
        {
          scrollWheelZoom:
            false
        }
      ).setView(
        [20, 0],
        2
      );

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          "© OpenStreetMap"
      }
    ).addTo(
      visitorsMapInstance
    );

    visitorsMapLayer =
      L.layerGroup()
        .addTo(
          visitorsMapInstance
        );
  }

  visitorsMapLayer
    .clearLayers();

  const clusters =
    buildMapClusters(
      sessions
    );

  if (
    !clusters.length
  ) {
    setTimeout(
      () =>
        visitorsMapInstance
          .invalidateSize(),
      200
    );

    return;
  }

  clusters.forEach(
    (cluster) => {
      const uniqueVisitors =
        new Set(
          cluster.sessions
            .map(
              (
                session
              ) =>
                session.visitor_id
            )
            .filter(Boolean)
        );

      const returningCount =
        cluster.sessions.filter(
          (session) =>
            session
              .is_returning_visitor
        ).length;

      const sessionRows =
        cluster.sessions
          .slice(
            0,
            10
          )
          .map(
            (
              session
            ) => {
              const sessionId =
                session
                  .calculated_session_id ||
                session.session_id ||
                session.visitor_id ||
                "";

              const score =
                getLeadScore(
                  session
                );

              return `
                <div class="mapVisitorItem">
                  <strong>
                    ${
                      escapeHtml(
                        visitorStatus(
                          session
                        )
                      )
                    }
                  </strong>

                  <span>
                    ${
                      escapeHtml(
                        deviceSummary(
                          session
                        )
                      )
                    }
                  </span>

                  <span>
                    ${
                      escapeHtml(
                        normalizeSource(
                          session.referrer_source ||
                          session.referrer
                        )
                      )
                    }
                    ·
                    ${
                      Number(
                        session.page_count ||
                        0
                      )
                    }
                    páginas
                    ·
                    ${score}/100
                  </span>

                  <button
                    type="button"
                    onclick="focusVisitorSession('${
                      escapeHtml(
                        sessionId
                      )
                    }')"
                  >
                    Ver sessão
                  </button>
                </div>
              `;
            }
          )
          .join("");

      const popup = `
        <div class="mapPopup">
          <strong>
            ${
              countryFlag(
                cluster.country
              )
            }

            ${
              escapeHtml(
                cluster.country
              )
            }

            ${
              cluster.city
                ? " · " +
                  escapeHtml(
                    cluster.city
                  )
                : ""
            }
          </strong>

          <span>
            ${
              uniqueVisitors.size
            }
            visitante${
              uniqueVisitors.size ===
              1
                ? ""
                : "s"
            }

            ·
            ${
              cluster.sessions
                .length
            }
            sessão${
              cluster.sessions
                .length ===
              1
                ? ""
                : "ões"
            }

            ·
            ${
              returningCount
            }
            recorrente${
              returningCount ===
              1
                ? ""
                : "s"
            }
          </span>

          <div class="mapVisitorList">
            ${sessionRows}
          </div>
        </div>
      `;

      const marker =
        L.marker(
          [
            cluster.latitude,
            cluster.longitude
          ]
        )
          .addTo(
            visitorsMapLayer
          )
          .bindPopup(
            popup,
            {
              maxWidth:
                360
            }
          );

      if (
        cluster.sessions
          .length > 1
      ) {
        marker.bindTooltip(
          `${
            cluster.sessions
              .length
          } sessões`,
          {
            direction:
              "top",

            opacity:
              0.9
          }
        );
      }
    }
  );

  const bounds =
    L.latLngBounds(
      clusters.map(
        (
          cluster
        ) => [
          cluster.latitude,
          cluster.longitude
        ]
      )
    );

  visitorsMapInstance
    .fitBounds(
      bounds,
      {
        padding:
          [32, 32],

        maxZoom:
          6
      }
    );

  setTimeout(
    () =>
      visitorsMapInstance
        .invalidateSize(),
    200
  );
}

/* =========================================================
   SESSION FOCUS
========================================================= */

window.focusVisitorSession =
  function (
    sessionId
  ) {
    if (!sessionId) {
      return;
    }

    const selectorValue =
      typeof CSS !==
        "undefined" &&
      CSS.escape
        ? CSS.escape(
            sessionId
          )
        : String(
            sessionId
          ).replace(
            /"/g,
            '\\"'
          );

    const card =
      document.querySelector(
        `.visitorSessionCard[data-session-id="${selectorValue}"]`
      );

    if (!card) {
      return;
    }

    card.scrollIntoView(
      {
        behavior:
          "smooth",

        block:
          "center"
      }
    );

    card.classList.add(
      "isOpen",
      "isHighlighted"
    );

    setTimeout(
      () => {
        card.classList.remove(
          "isHighlighted"
        );
      },
      2500
    );
  };

/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    if (
      $("adminToken")
    ) {
      $("adminToken").value =
        getToken();
    }

    $("loadDashboard")
      ?.addEventListener(
        "click",
        loadDashboard
      );

    document
      .querySelectorAll(
        "[data-range]"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              document
                .querySelectorAll(
                  "[data-range]"
                )
                .forEach(
                  (
                    item
                  ) =>
                    item.classList.remove(
                      "isActive"
                    )
                );

              button.classList.add(
                "isActive"
              );

              currentRange =
                button.dataset
                  .range ||
                "today";

              loadDashboard();
            }
          );
        }
      );

    $("sessionSearch")
      ?.addEventListener(
        "input",
        () => {
          renderVisitorSessions(
            dashboardData
              ?.visitor_sessions ||
            []
          );
        }
      );
  }
);

setInterval(
  () => {
    if (
      getToken()
    ) {
      loadDashboard();
    }
  },
  30000
);
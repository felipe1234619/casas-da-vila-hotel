const $ = (id) => document.getElementById(id);

let currentRange = "today";
let dashboardData = null;

function saveToken(token) {
  localStorage.setItem("cdv_admin_analytics_token", token);
}

function getToken() {
  return localStorage.getItem("cdv_admin_analytics_token") || "";
}

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
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
  const code = String(countryCode || "").trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(code)) return "🌐";

  return code
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt()))
    .join("");
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
      const flag = id === "topCountries" ? `${countryFlag(label)} ` : "";

      return `
        <div class="listRow">
          <strong>${flag}${escapeHtml(label)}</strong>
          <span>${item.value}</span>
        </div>
      `;
    })
    .join("");
}
function visitorStatus(session) {
  if (session.is_returning_visitor) return "Visitante recorrente";
  return "Novo visitante";
}

function scoreLabel(score) {
  if (score >= 80) return "🔥 Alta intenção";
  if (score >= 55) return "💎 Qualificado";
  if (score >= 30) return "↗ Em consideração";
  return "Exploratório";
}

function getLeadScore(session) {
  let score = 0;

  if (session.page_count >= 3) score += 20;
  if (session.has_booking_intent) score += 30;
  if ((session.bookings || []).length > 0) score += 25;

  const visitedHouse = (session.pages || []).some((p) =>
    String(p.path || "").includes("/casas/") ||
    String(p.path || "").includes("/houses/")
  );

  if (visitedHouse) score += 15;

  const cameFromQualifiedSource = String(session.referrer || "").match(
    /google|instagram|chatgpt|youtube/i
  );

  if (cameFromQualifiedSource) score += 10;

  return Math.min(score, 100);
}

function formatSessionTime(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
function renderBookings(items) {
  const el = $("recentBookings");
  if (!el) return;

  const rows = (items || [])
    .filter((item) => item.event_type === "booking_search")
    .slice(0, 16);

  if (!rows.length) {
    el.innerHTML = `<p class="empty">Nenhuma busca registrada ainda.</p>`;
    return;
  }

  el.innerHTML = rows
    .map(
      (item) => `
        <div class="tableRow">
          <strong>${formatDate(item.created_at)}</strong>
          <span>${escapeHtml(item.house_name || "multi-house")}</span>
          <span>${escapeHtml(item.checkin || "—")} → ${escapeHtml(item.checkout || "—")}</span>
          <span>${escapeHtml(item.country || item.city || item.timezone || "origem indefinida")}</span>
        </div>
      `
    )
    .join("");
}

function renderSiteEvents(items) {
  const el = $("recentEvents");
  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `<p class="empty">Nenhum acesso registrado ainda.</p>`;
    return;
  }

  el.innerHTML = items
    .slice(0, 18)
    .map(
      (item) => `
        <div class="tableRow">
          <strong>${formatDate(item.created_at)}</strong>
          <span>${escapeHtml(item.page_path || "—")}</span>
          <span>${escapeHtml(item.country || item.city || item.timezone || "origem indefinida")}</span>
          <span>${escapeHtml(item.referrer || "direct / unknown")}</span>
        </div>
      `
    )
    .join("");
}

function renderBookingIntelligence(items) {
  const el = $("bookingIntelligence");
  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `<p class="empty">Nenhuma consulta econômica registrada ainda.</p>`;
    return;
  }

  el.innerHTML = items
    .slice(0, 20)
    .map(
      (item) => `
        <div class="tableRow">
          <strong>${formatDate(item.created_at)}</strong>
          <span>${escapeHtml(item.checkin || "—")} → ${escapeHtml(item.checkout || "—")}</span>
          <span>${item.available_units_count || 0} casas · ${escapeHtml(item.availability_status || "—")}</span>
          <span>${formatMoney(item.estimated_total)}</span>
        </div>
      `
    )
    .join("");
}

function renderAlerts(alerts) {
  const el = $("intelligenceAlerts");
  if (!el) return;

  if (!alerts || !alerts.length) {
    el.innerHTML = `<p class="empty">Nenhum alerta relevante no período.</p>`;
    return;
  }

  el.innerHTML = alerts
    .map(
      (item) => `
        <div class="alertRow">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.description)}</span>
        </div>
      `
    )
    .join("");
}

async function loadDashboard() {
  const token = $("adminToken").value.trim();

  if (!token) {
    alert("Informe o token de acesso.");
    return;
  }

  saveToken(token);

  const response = await fetch(`/api/admin-analytics?range=${currentRange}`, {
    headers: {
      "x-admin-token": token
    }
  });

  if (!response.ok) {
    alert("Acesso negado ou erro ao carregar dashboard.");
    return;
  }

  dashboardData = await response.json();
renderVisitorSessions(
  dashboardData.visitor_sessions || []
);
  $("pageviews").textContent = dashboardData.summary?.pageviews ?? "0";
  $("sessions").textContent = dashboardData.summary?.sessions ?? "0";
  $("visitors").textContent = dashboardData.summary?.visitors ?? "0";
  if ($("countriesReached")) {
  $("countriesReached").textContent = dashboardData.top_countries?.length || 0;
}

if ($("citiesReached")) {
  $("citiesReached").textContent = dashboardData.top_cities?.length || 0;
}
  $("returningVisitors").textContent = dashboardData.summary?.returning_visitors ?? "0";
  $("bookingSearches").textContent = dashboardData.summary?.booking_searches ?? "0";
  $("bookingIntentRate").textContent = `${dashboardData.summary?.booking_intent_rate ?? 0}%`;

if ($("grossRevenue")) {
  $("grossRevenue").textContent = formatMoney(
    dashboardData.booking_summary?.gross_revenue || 0
  );
}

if ($("discountsGranted")) {
  $("discountsGranted").textContent = formatMoney(
    dashboardData.booking_summary?.discounts_granted || 0
  );
}

$("potentialRevenue").textContent = formatMoney(
  dashboardData.booking_summary?.potential_revenue || 0
);
  $("availableQueries").textContent =
    dashboardData.booking_summary?.available_queries || 0;

if ($("unavailableQueries")) {
  $("unavailableQueries").textContent =
    dashboardData.booking_summary?.unavailable_queries || 0;
}
  renderList("topPages", dashboardData.top_pages);
  renderList("topReferrers", dashboardData.top_referrers);
  renderList("topCountries", dashboardData.top_countries);
  renderList("topCities", dashboardData.top_cities);
  renderList("topHouses", dashboardData.top_houses);

  renderAlerts(dashboardData.alerts);
  renderBookings(dashboardData.recent_booking_events);
  renderSiteEvents(dashboardData.recent_site_events);
  renderBookingIntelligence(dashboardData.booking_availability_results);
  renderReservationFunnel(dashboardData.reservation_funnel);
  renderHotLeads(dashboardData.hot_leads || []);
  renderLiveVisitorToast(dashboardData.live_visitors || []);
  renderLiveVisitorsPanel(dashboardData.live_visitors || []);
  renderVisitorSessions(dashboardData.visitor_sessions);
  renderVisitorsMap(dashboardData.visitor_sessions || []);

  $("lastUpdated").textContent = `● atualizado ${new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

document.addEventListener("DOMContentLoaded", () => {
  $("adminToken").value = getToken();

  $("loadDashboard").addEventListener("click", loadDashboard);

  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-range]").forEach((b) =>
        b.classList.remove("isActive")
      );

      button.classList.add("isActive");
      currentRange = button.dataset.range;
      loadDashboard();
    });
  });

  $("sessionSearch")?.addEventListener("input", () => {
    renderVisitorSessions(dashboardData?.visitor_sessions || []);
  });
});
setInterval(() => {
  if (getToken()) {
    loadDashboard();
  }
}, 30000);
function renderVisitorSessions(sessions) {
  const container = document.getElementById("visitorSessions");
  if (!container) return;

  const search = $("sessionSearch")?.value?.trim()?.toLowerCase() || "";

  const filteredSessions = sessions.filter((session) => {
    if (!search) return true;

    const haystack = [
      session.country,
      session.city,
      session.referrer,
      ...(session.pages || []).map((p) => p.path)
    ].join(" ").toLowerCase();

    return haystack.includes(search);
  });

  if (!filteredSessions.length) {
    container.innerHTML = `
      <div class="emptyState">
        Nenhuma sessão encontrada para o filtro atual.
      </div>
    `;
    return;
  }

  container.innerHTML = filteredSessions
    .slice(0, 30)
    .map((session, index) => {
      const score = getLeadScore(session);

      const intentLabel =
        score >= 80 ? "🔥 High intent" :
        score >= 55 ? "💎 Qualificado" :
        score >= 30 ? "↗ Em consideração" :
        "Exploratório";

      return `
<div class="visitorSessionCard" data-session-id="${escapeHtml(session.session_id || session.visitor_id || "")}">          <button class="visitorSessionButton" type="button" data-session="${index}">
            <div class="visitorSessionTop">
              <div>
                <strong>${session.country || "Unknown"}${session.city ? ` · ${session.city}` : ""}</strong>
                <small>${session.referrer || "Direct / unknown"}</small>
              </div>

              <div class="sessionBadges">
                <span>${session.page_count || 0} páginas</span>
                <span>${session.has_booking_intent ? "Reserva" : "Explorando"}</span>
                <span class="scoreBadge">${score}/100 · ${intentLabel}</span>
              </div>
            </div>
          </button>

          <div class="visitorSessionDetails">
            <div class="sessionTimeline">
              <h3>Timeline da sessão</h3>
              ${(session.pages || []).map((p) => `
                <div class="timelineItem">
                  <span>${formatSessionTime(p.created_at)}</span>
                  <strong>${p.path || "—"}</strong>
                </div>
              `).join("")}
            </div>

            <div class="sessionTimeline">
              <h3>Buscas de reserva</h3>
              ${
                (session.bookings || []).length
                  ? session.bookings.map((b) => `
                    <div class="timelineItem">
                      <span>${formatSessionTime(b.created_at)}</span>
                      <strong>${b.checkin || "—"} → ${b.checkout || "—"}</strong>
                      <small>${b.house_name || "multi-house"}</small>
                    </div>
                  `).join("")
                  : `<p class="emptyState">Nenhuma busca de reserva nesta sessão.</p>`
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  document.querySelectorAll(".visitorSessionButton").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".visitorSessionCard").classList.toggle("isOpen");
    });
  });
}
function renderReservationFunnel(funnel) {
  const el = $("reservationFunnel");
  if (!el || !funnel) return;

  const items = [
    ["Sessões", funnel.sessions],
    ["Visitou casa", funnel.visited_house],
    ["Foi para reservar", funnel.visited_booking],
    ["Buscou datas", funnel.searched_dates],
    ["Recebeu disponibilidade", funnel.got_availability]
  ];

  el.innerHTML = items
    .map(([label, value]) => `
      <div class="funnelStep">
        <span>${label}</span>
        <strong>${value || 0}</strong>
      </div>
    `)
    .join("");
}
let previousLiveVisitorCount = 0;

function renderLiveVisitorToast(visitors = []) {
  const el = $("liveVisitorToast");
  if (!el) return;

  const count = visitors.length || 0;

  if (count > previousLiveVisitorCount && count > 0) {
    const visitor = visitors[0];

    el.innerHTML = `
      <strong>Visitante ativo agora</strong>
      <span>
        ${(visitor.country || "Origem desconhecida")}
        ${visitor.city ? " · " + visitor.city : ""}
        ${visitor.page_path ? " · " + visitor.page_path : ""}
      </span>
    `;

    el.classList.add("isVisible");

    setTimeout(() => {
      el.classList.remove("isVisible");
    }, 7000);
  }

  previousLiveVisitorCount = count;
}
function renderHotLeads(leads = []) {
  const el = $("hotLeads");
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
      ${leads
        .map((lead) => {
          const lastPage =
            lead.pages?.[lead.pages.length - 1]?.path || "-";

          const searchedHouse =
            lead.bookings?.[0]?.house_name || "multi-house-search";

          return `
            <div class="hotLeadRow">
              <div class="hotLeadScore">
                ${lead.lead_score}
              </div>

              <div class="hotLeadInfo">
                <strong>${lead.city || "Unknown city"} · ${lead.country || "--"}</strong>

                <span>
                  ${lastPage}
                </span>
              </div>

              <div class="hotLeadMeta">
                <small>${searchedHouse}</small>
                <small>${lead.lead_label || "Intent"}</small>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}
function renderLiveVisitorsPanel(visitors = []) {
  const countEl = $("liveVisitorsCount");
  const listEl = $("liveVisitorsList");

  if (countEl) {
    countEl.textContent = visitors.length || 0;
  }

  if (!listEl) return;

  if (!visitors.length) {
    listEl.innerHTML = `<p class="empty">Nenhum visitante ativo agora.</p>`;
    return;
  }

  listEl.innerHTML = visitors
    .map(
      (visitor) => `
        <div class="liveVisitorRow">
          <strong>${escapeHtml(visitor.country || "Origem desconhecida")}${
            visitor.city ? " · " + escapeHtml(visitor.city) : ""
          }</strong>
          <span>${escapeHtml(visitor.page_path || "—")}</span>
          <small>última atividade: ${formatDate(visitor.last_seen_at)}</small>
        </div>
      `
    )
    .join("");
}
function renderLiveVisitorsPanel(visitors = []) {
  const countEl = $("liveVisitorsCount");
  const listEl = $("liveVisitorsList");

  if (countEl) {
    countEl.textContent = visitors.length || 0;
  }

  if (!listEl) return;

  if (!visitors.length) {
    listEl.innerHTML =
      '<p class="empty">Nenhum visitante ativo agora.</p>';
    return;
  }

  listEl.innerHTML = visitors
    .map(
      (visitor) => `
        <div class="liveVisitorRow">
          <strong>
            ${escapeHtml(visitor.country || "Origem desconhecida")}
            ${visitor.city ? " · " + escapeHtml(visitor.city) : ""}
          </strong>

          <span>
            ${escapeHtml(visitor.page_path || "—")}
          </span>

          <small>
            última atividade:
            ${formatDate(visitor.last_seen_at)}
          </small>
        </div>
      `
    )
    .join("");
}
let visitorsMapInstance = null;
let visitorsMapLayer = null;

function renderVisitorsMap(sessions = []) {
  const el = $("visitorsMap");
  if (!el || typeof L === "undefined") return;

  if (!visitorsMapInstance) {
    visitorsMapInstance = L.map("visitorsMap", {
      scrollWheelZoom: false
    }).setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(visitorsMapInstance);

    visitorsMapLayer = L.layerGroup().addTo(visitorsMapInstance);
  }

  visitorsMapLayer.clearLayers();

  const validSessions = sessions.filter(
    (session) =>
      session.latitude !== null &&
      session.longitude !== null &&
      !Number.isNaN(Number(session.latitude)) &&
      !Number.isNaN(Number(session.longitude))
  );

  if (!validSessions.length) {
    setTimeout(() => visitorsMapInstance.invalidateSize(), 200);
    return;
  }

  validSessions.forEach((session) => {
    const lat = Number(session.latitude);
    const lng = Number(session.longitude);
    const sessionId = session.session_id || session.visitor_id || "";

    const pages = (session.pages || [])
      .slice(0, 8)
      .map((p) => {
        const path = escapeHtml(p.path || "—");
        const href = p.path && p.path.startsWith("/") ? p.path : "#";

        return `
          <li>
            <a href="${href}" target="_blank" rel="noopener">${path}</a>
            <small>${formatDate(p.created_at)}</small>
          </li>
        `;
      })
      .join("");

    const popup = `
      <div class="mapPopup">
        <strong>${escapeHtml(session.country || "Origem desconhecida")}${
          session.city ? " · " + escapeHtml(session.city) : ""
        }</strong>

        <span>${escapeHtml(session.referrer || "Direct / unknown")}</span>

        <button type="button" onclick="focusVisitorSession('${escapeHtml(sessionId)}')">
          Ver sessão no dashboard
        </button>

        <details>
          <summary>Páginas visitadas (${session.page_count || 0})</summary>
          <ul>${pages || "<li>Sem páginas registradas</li>"}</ul>
        </details>
      </div>
    `;

    L.marker([lat, lng]).addTo(visitorsMapLayer).bindPopup(popup);
  });

  const bounds = L.latLngBounds(
    validSessions.map((session) => [
      Number(session.latitude),
      Number(session.longitude)
    ])
  );

  visitorsMapInstance.fitBounds(bounds, {
    padding: [32, 32],
    maxZoom: 6
  });

  setTimeout(() => visitorsMapInstance.invalidateSize(), 200);
}

window.focusVisitorSession = function (sessionId) {
  const card = document.querySelector(
    `.visitorSessionCard[data-session-id="${CSS.escape(sessionId)}"]`
  );

  if (!card) return;

  card.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  card.classList.add("isOpen", "isHighlighted");

  setTimeout(() => {
    card.classList.remove("isHighlighted");
  }, 2500);
};
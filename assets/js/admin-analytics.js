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

function renderList(id, items) {
  const el = $(id);
  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `<p class="empty">Sem dados ainda.</p>`;
    return;
  }

  el.innerHTML = items
    .map(
      (item) => `
        <div class="listRow">
          <strong>${escapeHtml(item.label || "unknown")}</strong>
          <span>${item.value}</span>
        </div>
      `
    )
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

function renderVisitorSessions(sessions) {
  const container = document.getElementById("visitorSessions");

  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = `
      <div class="emptyState">
        Nenhuma sessão encontrada para o filtro atual.
      </div>
    `;
    return;
  }

  container.innerHTML = sessions
    .slice(0, 30)
    .map((session, index) => {
      const score = getLeadScore(session);
      const intentLabel = score >= 70 ? "High intent" : score >= 40 ? "Warm visitor" : "Low intent";

      return `
        <div class="visitorSessionCard" data-session-index="${index}">
          <button class="visitorSessionButton" type="button">
            <div>
              <strong>${session.country || "Unknown"}${session.city ? " · " + session.city : ""}</strong>
              <small>${session.referrer || "Direct / unknown"}</small>
            </div>

            <div class="sessionBadges">
              <span>${session.page_count || 0} páginas</span>
              <span>${session.has_booking_intent ? "Com intenção" : "Sem reserva"}</span>
              <span class="scoreBadge">${score}/100 · ${intentLabel}</span>
            </div>
          </button>

          <div class="visitorSessionDetails">
            <div class="sessionTimeline">
              <h3>Páginas visitadas</h3>
              ${(session.pages || [])
                .map(
                  (p) => `
                    <div class="timelineItem">
                      <span>${formatSessionTime(p.created_at)}</span>
                      <strong>${p.path || "—"}</strong>
                    </div>
                  `
                )
                .join("")}
            </div>

            <div class="sessionTimeline">
              <h3>Buscas de reserva</h3>
              ${
                (session.bookings || []).length
                  ? session.bookings
                      .map(
                        (b) => `
                          <div class="timelineItem">
                            <span>${formatSessionTime(b.created_at)}</span>
                            <strong>${b.checkin || "—"} → ${b.checkout || "—"}</strong>
                            <small>${b.house_name || "multi-house"} · ${b.availability_status || "—"}</small>
                          </div>
                        `
                      )
                      .join("")
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
  $("returningVisitors").textContent = dashboardData.summary?.returning_visitors ?? "0";
  $("bookingSearches").textContent = dashboardData.summary?.booking_searches ?? "0";
  $("bookingIntentRate").textContent = `${dashboardData.summary?.booking_intent_rate ?? 0}%`;

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
  renderVisitorSessions(dashboardData.visitor_sessions);

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
function renderVisitorSessions(sessions) {
  const container = document.getElementById("visitorSessions");

  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = `
      <div class="emptyState">
        Nenhuma sessão encontrada para o filtro atual.
      </div>
    `;
    return;
  }

  container.innerHTML = sessions
    .slice(0, 20)
    .map((session) => {
      return `
        <div class="visitorSessionCard">

          <div class="visitorSessionTop">
            <div>
              <strong>${session.country || "Unknown"}</strong>
              ${session.city ? `· ${session.city}` : ""}
            </div>

            <div>
              ${session.page_count} páginas
            </div>
          </div>

          <div class="visitorSessionPaths">
            ${session.pages
              .slice(0, 5)
              .map((p) => `<span>${p.path}</span>`)
              .join("")}
          </div>

          <div class="visitorSessionMeta">

            <span>
              Origem:
              ${session.referrer || "Direct"}
            </span>

            <span>
              Reserva:
              ${session.has_booking_intent ? "Sim" : "Não"}
            </span>

          </div>

        </div>
      `;
    })
    .join("");
}
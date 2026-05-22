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

function renderVisitorSessions(items) {
  const el = $("visitorSessions");
  if (!el) return;

  const term = ($("sessionSearch")?.value || "").toLowerCase().trim();

  let rows = items || [];

  if (term) {
    rows = rows.filter((session) => {
      const searchable = [
        session.country,
        session.city,
        session.region,
        session.referrer,
        session.entry_page,
        session.exit_page,
        ...(session.pages || []).map((p) => p.page_path),
        ...(session.booking_events || []).map((b) => b.checkin + " " + b.checkout + " " + b.house_name)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }

  if (!rows.length) {
    el.innerHTML = `<p class="empty">Nenhuma sessão encontrada para o filtro atual.</p>`;
    return;
  }

  el.innerHTML = rows
    .slice(0, 80)
    .map((session, index) => {
      const location =
        [session.country, session.city].filter(Boolean).join(", ") ||
        "Origem indefinida";

      const referrer = session.referrer || "Direct / unknown";
      const score = Number(session.score || 0);

      const pages = (session.pages || [])
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map((page, pageIndex) => `
          <div class="timelineItem">
            <span class="timelineDot">${pageIndex + 1}</span>
            <div>
              <span>${formatDate(page.created_at)}</span>
              <strong>${escapeHtml(page.page_path || "—")}</strong>
              <em>${escapeHtml(page.page_title || "")}</em>
            </div>
          </div>
        `)
        .join("");

      const bookings = (session.booking_events || [])
        .map((booking) => `
          <div class="sessionBooking">
            <span>${formatDate(booking.created_at)}</span>
            <strong>${escapeHtml(booking.checkin || "—")} → ${escapeHtml(booking.checkout || "—")}</strong>
            <em>
              ${escapeHtml(booking.house_name || "multi-house")}
              · ${formatMoney(booking.estimated_total)}
              · ${escapeHtml(booking.availability_status || "status indefinido")}
            </em>
          </div>
        `)
        .join("");

      return `
        <article class="sessionCard ${session.has_booking_intent ? "hasIntent" : ""}">
          <button class="sessionHeader" type="button" data-session-toggle="${index}">
            <div class="sessionIdentity">
              <strong>${escapeHtml(location)}</strong>
              <span>${escapeHtml(referrer)}</span>
            </div>

            <div class="sessionMeta">
              <span>${session.pages_count || 0} páginas</span>
              <span>${visitorStatus(session)}</span>
              <span>${scoreLabel(score)} · ${score}</span>
              <span>${formatDate(session.last_seen_at)}</span>
            </div>
          </button>

          <div class="sessionDetails" data-session-details="${index}">
            <div class="sessionSummary">
              <div><span>Entrada</span><strong>${escapeHtml(session.entry_page || "—")}</strong></div>
              <div><span>Saída</span><strong>${escapeHtml(session.exit_page || "—")}</strong></div>
              <div><span>Sessões do visitante</span><strong>${session.visitor_sessions_count || 1}</strong></div>
              <div><span>Buscas</span><strong>${(session.booking_events || []).length}</strong></div>
            </div>

            <div class="sessionColumns">
              <div>
                <h3>Páginas visitadas</h3>
                <div class="timeline">
                  ${pages || `<p class="empty">Sem páginas.</p>`}
                </div>
              </div>

              <div>
                <h3>Buscas de reserva</h3>
                ${bookings || `<p class="empty">Nenhuma busca nessa sessão.</p>`}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-session-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-session-toggle");
      const details = document.querySelector(`[data-session-details="${id}"]`);
      if (details) details.classList.toggle("isOpen");
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
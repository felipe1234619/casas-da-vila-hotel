const $ = (id) => document.getElementById(id);

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
          <strong>${item.label || "unknown"}</strong>
          <span>${item.value}</span>
        </div>
      `
    )
    .join("");
}

function renderBookings(items) {
  const el = $("recentBookings");

  if (!el) return;

  if (!items || !items.length) {
    el.innerHTML = `<p class="empty">Nenhuma busca registrada ainda.</p>`;
    return;
  }

  const rows = items
    .filter((item) => item.event_type === "booking_search")
    .slice(0, 12);

  if (!rows.length) {
    el.innerHTML = `<p class="empty">Nenhuma busca registrada ainda.</p>`;
    return;
  }

  el.innerHTML = rows
    .map(
      (item) => `
        <div class="tableRow">
          <strong>${formatDate(item.created_at)}</strong>
          <span>${item.house_name || "multi-house"}</span>
          <span>${item.checkin || "—"} → ${item.checkout || "—"}</span>
          <span>${item.country || item.timezone || "origem indefinida"}</span>
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
    .slice(0, 14)
    .map(
      (item) => `
        <div class="tableRow">
          <strong>${formatDate(item.created_at)}</strong>
          <span>${item.page_path || "—"}</span>
          <span>${item.country || item.city || item.timezone || "origem indefinida"}</span>
          <span>${item.referrer || "direct / unknown"}</span>
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
          <span>${item.checkin || "—"} → ${item.checkout || "—"}</span>
          <span>${item.available_units_count || 0} casas · ${item.availability_status || "—"}</span>
          <span>${formatMoney(item.estimated_total)}</span>
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

  const response = await fetch("/api/admin-analytics", {
    headers: {
      "x-admin-token": token
    }
  });

  if (!response.ok) {
    alert("Acesso negado ou erro ao carregar dashboard.");
    return;
  }

  const data = await response.json();

  $("pageviews").textContent = data.summary?.pageviews ?? "0";
  $("sessions").textContent = data.summary?.sessions ?? "0";
  $("visitors").textContent = data.summary?.visitors ?? "0";
  $("bookingSearches").textContent = data.summary?.booking_searches ?? "0";

  if ($("potentialRevenue")) {
    $("potentialRevenue").textContent = formatMoney(
      data.booking_summary?.potential_revenue || 0
    );
  }

  if ($("availableQueries")) {
    $("availableQueries").textContent =
      data.booking_summary?.available_queries || 0;
  }

  if ($("unavailableQueries")) {
    $("unavailableQueries").textContent =
      data.booking_summary?.unavailable_queries || 0;
  }

  renderList("topPages", data.top_pages);
  renderList("topReferrers", data.top_referrers);
  renderList("topCountries", data.top_countries);
  renderList("topCities", data.top_cities);
  renderList("topHouses", data.top_houses);

  renderBookings(data.recent_booking_events);
  renderSiteEvents(data.recent_site_events);
  renderBookingIntelligence(data.booking_availability_results);
}

document.addEventListener("DOMContentLoaded", () => {
  $("adminToken").value = getToken();
  $("loadDashboard").addEventListener("click", loadDashboard);
});
(function () {
  const $ = (id) => document.getElementById(id);

  let currentToken = "";
  let lastMessageCount = 0;
  let poller = null;

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async function loadChats(silent = false) {
    currentToken = $("adminToken").value.trim();

    if (!currentToken) return;

    const res = await fetch("/api/chat-admin", {
      headers: { "x-admin-token": currentToken }
    });

    const data = await res.json();

    if (!res.ok) {
      $("chatSessions").innerHTML =
        `<p class="empty">Erro: ${escapeHtml(data.error)}</p>`;
      return;
    }

    const messages = data.messages || [];

    if (lastMessageCount && messages.length > lastMessageCount && !silent) {
      document.title = "🔔 Novo chat — Casas da Vila";
    }

    lastMessageCount = messages.length;

    renderChats(data.sessions || [], messages);

    if ($("chatStatus")) {
      $("chatStatus").textContent =
        `● atualizado ${new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })}`;
    }
  }

  function renderChats(sessions, messages) {
    const container = $("chatSessions");

    if (!sessions.length) {
      container.innerHTML =
        `<p class="empty">Nenhuma conversa encontrada.</p>`;
      return;
    }

    container.innerHTML = sessions.map((session) => {
      const sessionMessages = messages.filter(
        (m) => m.chat_session_id === session.id
      );

      const lastMessage = sessionMessages[sessionMessages.length - 1];

      const unreadVisitorMessages = sessionMessages.filter(
        (m) => m.sender === "visitor" && !m.is_read
      ).length;

      return `
        <div class="visitorSessionCard ${unreadVisitorMessages ? "hasUnreadChat" : ""}">
          <div class="visitorSessionTop">
            <div>
              <strong>
                ${escapeHtml(session.country || "Origem desconhecida")}
                ${session.city ? " · " + escapeHtml(session.city) : ""}
              </strong>
              <small>${escapeHtml(session.page_path || "")}</small>
            </div>

            <div class="sessionBadges">
              ${
                unreadVisitorMessages
                  ? `<span class="returningBadge">🔔 ${unreadVisitorMessages} nova(s)</span>`
                  : `<span class="newVisitorBadge">Sem novas</span>`
              }
              <span class="scoreBadge">${escapeHtml(session.status || "open")}</span>
            </div>
          </div>

          ${
            lastMessage
              ? `<p class="panelLead">
                   Última mensagem: ${formatTime(lastMessage.created_at)}
                 </p>`
              : ""
          }

          <div class="sessionTimeline">
            ${sessionMessages.map((m) => `
              <div class="timelineItem">
                <strong>${m.sender === "admin" ? "Casas da Vila" : "Visitante"}</strong>
                <span>${escapeHtml(m.message)}</span>
                <small>${formatTime(m.created_at)}</small>
              </div>
            `).join("")}
          </div>

          <form class="chatReplyForm" data-chat-session-id="${session.id}">
            <input type="text" placeholder="Responder ao visitante..." required />
            <button type="submit">Enviar</button>
          </form>
        </div>
      `;
    }).join("");

    document.querySelectorAll(".chatReplyForm").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const input = form.querySelector("input");
        const message = input.value.trim();
        const chatSessionId = form.getAttribute("data-chat-session-id");

        if (!message) return;

        input.value = "";

        await fetch("/api/chat-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_session_id: chatSessionId,
            sender: "admin",
            message
          })
        });

        await loadChats(true);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const savedToken = localStorage.getItem("casas_admin_token");
    if (savedToken) $("adminToken").value = savedToken;

    $("adminToken").addEventListener("change", () => {
      localStorage.setItem("casas_admin_token", $("adminToken").value.trim());
    });

    $("loadChats").addEventListener("click", async () => {
      localStorage.setItem("casas_admin_token", $("adminToken").value.trim());

      await loadChats(true);

      clearInterval(poller);
      poller = setInterval(() => loadChats(false), 5000);
    });
  });
})();
(function () {
  const CHAT_KEY = "casas_live_chat_session_id";

  function getVisitorId() {
    return (
      localStorage.getItem("casas_visitor_id") ||
      localStorage.getItem("visitor_id") ||
      null
    );
  }

  function getSessionId() {
    return (
      sessionStorage.getItem("casas_session_id") ||
      sessionStorage.getItem("session_id") ||
      null
    );
  }

  function getChatLanguage() {
    if (window.location.pathname.startsWith("/en/")) return "en";
    return "pt";
  }

  function getChatTexts() {
    const lang = getChatLanguage();

    if (lang === "en") {
      return {
        title: "Casas da Vila",
        intro:
          "Hello! I can help with availability, house recommendations, rates or planning your stay in Trancoso.",
        placeholder: "Type your message...",
        send: "Send",
        welcome:
          "Hello and welcome to Casas da Vila. I’ll be happy to help you find the best house and dates for your stay in Trancoso."
      };
    }

    return {
      title: "Casas da Vila",
      intro:
        "Olá! Posso ajudar com datas, disponibilidade, escolha da casa ideal ou planejamento da sua estadia em Trancoso.",
      placeholder: "Escreva sua mensagem...",
      send: "Enviar",
      welcome:
        "Olá e seja bem-vindo ao Casas da Vila. Terei prazer em ajudá-lo a encontrar a melhor casa e as melhores datas para sua estadia em Trancoso."
    };
  }

  function createWidget() {
    const t = getChatTexts();

    const root = document.createElement("div");
    root.className = "casasLiveChat";
    root.innerHTML = `
      <button class="chatBubble" type="button">💬</button>

      <div class="chatPanel" aria-hidden="true">
        <div class="chatHeader">
          <strong>${t.title}</strong>
          <button class="chatClose" type="button">×</button>
        </div>

        <div class="chatIntro">
          ${t.intro}
        </div>

        <div class="chatMessages"></div>

        <form class="chatForm">
          <input class="chatInput" type="text" placeholder="${t.placeholder}" required />
          <button type="submit">${t.send}</button>
        </form>
      </div>
    `;

    document.body.appendChild(root);
    return root;
  }

  async function createSession() {
    const existing = localStorage.getItem(CHAT_KEY);
    if (existing) return existing;

    const res = await fetch("/api/chat-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        page_path: window.location.pathname,
        page_url: window.location.href,
        language: getChatLanguage()
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Chat session failed");

    localStorage.setItem(CHAT_KEY, data.chat_session.id);
    return data.chat_session.id;
  }

  async function sendMessage(chatSessionId, message, sender = "visitor") {
    const res = await fetch("/api/chat-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_session_id: chatSessionId,
        sender,
        message
      })
    });

    return res.json();
  }

  async function loadMessages(chatSessionId, messagesEl) {
    const res = await fetch(`/api/chat-message?chat_session_id=${chatSessionId}`);
    const data = await res.json();

    if (!data.ok) return;

    messagesEl.innerHTML = (data.messages || [])
      .map((m) => `
        <div class="chatMsg ${m.sender === "admin" ? "admin" : "visitor"}">
          ${escapeHtml(m.message)}
        </div>
      `)
      .join("");

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function ensureWelcomeMessage(chatSessionId, messagesEl) {
    const res = await fetch(`/api/chat-message?chat_session_id=${chatSessionId}`);
    const data = await res.json();

    if (!data.ok) return;

    const hasAdminMessage = (data.messages || []).some(
      (m) => m.sender === "admin"
    );

    if (!hasAdminMessage) {
      await sendMessage(chatSessionId, getChatTexts().welcome, "admin");
      await loadMessages(chatSessionId, messagesEl);
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .casasLiveChat {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 9999;
        font-family: inherit;
      }

      .chatBubble {
        width: 58px;
        height: 58px;
        border-radius: 999px;
        border: 0;
        background: #1f3d35;
        color: #fff;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 12px 30px rgba(0,0,0,.25);
      }

      .chatPanel {
        display: none;
        width: 330px;
        max-width: calc(100vw - 32px);
        background: #fff;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 18px 50px rgba(0,0,0,.28);
        margin-bottom: 12px;
        border: 1px solid rgba(0,0,0,.08);
      }

      .chatPanel.isOpen {
        display: block;
      }

      .chatHeader {
        padding: 14px 16px;
        background: #1f3d35;
        color: #fff;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .chatClose {
        background: transparent;
        color: #fff;
        border: 0;
        font-size: 24px;
        cursor: pointer;
      }

      .chatIntro {
        padding: 14px 16px;
        font-size: 14px;
        line-height: 1.45;
        background: #f6f2ea;
      }

      .chatMessages {
        height: 230px;
        overflow: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .chatMsg {
        padding: 9px 11px;
        border-radius: 14px;
        max-width: 82%;
        font-size: 14px;
        line-height: 1.35;
      }

      .chatMsg.visitor {
        align-self: flex-end;
        background: #1f3d35;
        color: #fff;
      }

      .chatMsg.admin {
        align-self: flex-start;
        background: #eee7dc;
        color: #1e1e1e;
      }

      .chatForm {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid rgba(0,0,0,.08);
      }

      .chatInput {
        flex: 1;
        border: 1px solid rgba(0,0,0,.18);
        border-radius: 999px;
        padding: 10px 12px;
      }

      .chatForm button {
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        background: #1f3d35;
        color: #fff;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();

    const root = createWidget();
    const bubble = root.querySelector(".chatBubble");
    const panel = root.querySelector(".chatPanel");
    const close = root.querySelector(".chatClose");
    const form = root.querySelector(".chatForm");
    const input = root.querySelector(".chatInput");
    const messagesEl = root.querySelector(".chatMessages");

    let chatSessionId = localStorage.getItem(CHAT_KEY);
    let poller = null;

    async function openChat() {
      panel.classList.add("isOpen");
      panel.setAttribute("aria-hidden", "false");

      chatSessionId = await createSession();

      await loadMessages(chatSessionId, messagesEl);
      await ensureWelcomeMessage(chatSessionId, messagesEl);

      clearInterval(poller);
      poller = setInterval(() => {
        loadMessages(chatSessionId, messagesEl);
      }, 5000);
    }

    function closeChat() {
      panel.classList.remove("isOpen");
      panel.setAttribute("aria-hidden", "true");
      clearInterval(poller);
    }

    bubble.addEventListener("click", openChat);
    close.addEventListener("click", closeChat);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const message = input.value.trim();
      if (!message) return;

      input.value = "";

      chatSessionId = await createSession();
      await sendMessage(chatSessionId, message, "visitor");
      await loadMessages(chatSessionId, messagesEl);
    });
  });
})();
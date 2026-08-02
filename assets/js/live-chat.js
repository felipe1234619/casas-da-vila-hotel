(function () {
  const CHAT_KEY =
    "casas_live_chat_session_id";

  const MAX_HISTORY_MESSAGES = 8;
  const POLLING_INTERVAL_MS = 5000;

  function getVisitorId() {
    return (
      localStorage.getItem(
        "casas_visitor_id"
      ) ||
      localStorage.getItem(
        "visitor_id"
      ) ||
      null
    );
  }

  function getSiteSessionId() {
    return (
      sessionStorage.getItem(
        "casas_session_id"
      ) ||
      sessionStorage.getItem(
        "session_id"
      ) ||
      null
    );
  }

  function getChatLanguage() {
    const pathname =
      window.location.pathname;

    if (
      pathname.startsWith("/en/")
    ) {
      return "en";
    }

    return "pt";
  }

  function getChatTexts() {
    const language =
      getChatLanguage();

    if (language === "en") {
      return {
        title: "Olivia",
        subtitle:
          "Private Villa Concierge",

        intro:
          "Hello. I can assist with villa selection, dates, rates and planning your stay in Trancoso.",

        placeholder:
          "Type your message...",

        send: "Send",

        sending: "Sending...",

        typing:
          "Olivia is typing...",

        welcome:
          "Hello and welcome to Casas da Vila. I will be delighted to assist you with your stay in Trancoso.",

        unavailable:
          "I am unable to complete this response at the moment. Our reservations team will be delighted to assist you via WhatsApp: +55 73 99143-5522.",

        sessionError:
          "We could not start the conversation. Please try again or contact our reservations team via WhatsApp.",

        retry: "Please try again."
      };
    }

    return {
      title: "Olivia",
      subtitle:
        "Private Villa Concierge",

      intro:
        "Olá. Posso ajudar com a escolha da villa, datas, tarifas e o planejamento da sua estadia em Trancoso.",

      placeholder:
        "Escreva sua mensagem...",

      send: "Enviar",

      sending: "Enviando...",

      typing:
        "Olivia está digitando...",

      welcome:
        "Olá e seja bem-vindo ao Casas da Vila. Será um prazer ajudar com a sua estadia em Trancoso.",

      unavailable:
        "Não consegui concluir esta resposta neste momento. Nossa equipe de reservas terá prazer em ajudar pelo WhatsApp: +55 73 99143-5522.",

      sessionError:
        "Não foi possível iniciar a conversa. Tente novamente ou fale com nossa equipe de reservas pelo WhatsApp.",

      retry: "Por favor, tente novamente."
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll(
        "'",
        "&#039;"
      );
  }

  function createWidget() {
    const texts =
      getChatTexts();

    const root =
      document.createElement("div");

    root.className =
      "casasLiveChat";

    root.innerHTML = `
      <button
        class="chatBubble"
        type="button"
        aria-label="Abrir concierge"
        aria-expanded="false"
      >
        <span aria-hidden="true">💬</span>
        <small class="chatBubbleBadge">1</small>
      </button>

      <div
        class="chatPanel"
        aria-hidden="true"
        role="dialog"
        aria-label="${escapeHtml(
          texts.title
        )}"
      >
        <div class="chatHeader">
          <div class="chatHeaderIdentity">
            <strong>
              ${escapeHtml(
                texts.title
              )}
            </strong>

            <small>
              ${escapeHtml(
                texts.subtitle
              )}
            </small>
          </div>

          <button
            class="chatClose"
            type="button"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div class="chatIntro">
          ${escapeHtml(
            texts.intro
          )}
        </div>

        <div
          class="chatMessages"
          aria-live="polite"
        ></div>

        <div
          class="chatTyping"
          aria-live="polite"
          hidden
        >
          <span></span>
          <span></span>
          <span></span>

          <small>
            ${escapeHtml(
              texts.typing
            )}
          </small>
        </div>

        <form class="chatForm">
          <input
            class="chatInput"
            type="text"
            maxlength="2000"
            autocomplete="off"
            placeholder="${escapeHtml(
              texts.placeholder
            )}"
            required
          />

          <button
            class="chatSend"
            type="submit"
          >
            ${escapeHtml(
              texts.send
            )}
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(
      root
    );

    return root;
  }

  async function parseJsonResponse(
    response
  ) {
    const data =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `HTTP ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  async function createSession() {
    const existingSessionId =
      localStorage.getItem(
        CHAT_KEY
      );

    if (existingSessionId) {
      return existingSessionId;
    }

    const response =
      await fetch(
        "/api/chat-session",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            visitor_id:
              getVisitorId(),

            session_id:
              getSiteSessionId(),

            page_path:
              window.location.pathname,

            page_url:
              window.location.href,

            language:
              getChatLanguage()
          })
        }
      );

    const data =
      await parseJsonResponse(
        response
      );

    const chatSessionId =
      data?.chat_session?.id;

    if (!chatSessionId) {
      throw new Error(
        "Chat session ID missing"
      );
    }

    localStorage.setItem(
      CHAT_KEY,
      chatSessionId
    );

    return chatSessionId;
  }

  async function saveMessage(
    chatSessionId,
    message,
    sender
  ) {
    const response =
      await fetch(
        "/api/chat-message",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            chat_session_id:
              chatSessionId,

            sender,

            message
          })
        }
      );

    return parseJsonResponse(
      response
    );
  }

  async function fetchMessages(
    chatSessionId
  ) {
    const response =
      await fetch(
        `/api/chat-message?chat_session_id=${encodeURIComponent(
          chatSessionId
        )}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

    const data =
      await parseJsonResponse(
        response
      );

    return Array.isArray(
      data.messages
    )
      ? data.messages
      : [];
  }

  function getMessageClass(
    sender
  ) {
    return sender === "visitor"
      ? "visitor"
      : "admin";
  }

  function renderMessages(
    messages,
    messagesElement
  ) {
    messagesElement.innerHTML =
      messages
        .map((item) => {
          const message =
            escapeHtml(
              item.message
            );

          const cssClass =
            getMessageClass(
              item.sender
            );

          const label =
            item.sender ===
            "visitor"
              ? ""
              : `<small class="chatMsgAuthor">Olivia</small>`;

          return `
            <div class="chatMsg ${cssClass}">
              ${label}
              <span>${message}</span>
            </div>
          `;
        })
        .join("");

    messagesElement.scrollTop =
      messagesElement.scrollHeight;
  }

  async function loadMessages(
    chatSessionId,
    messagesElement
  ) {
    try {
      const messages =
        await fetchMessages(
          chatSessionId
        );

      renderMessages(
        messages,
        messagesElement
      );

      return messages;
    } catch (error) {
      console.warn(
        "Unable to load chat messages:",
        error
      );

      return [];
    }
  }

  function appendTemporaryMessage({
    messagesElement,
    message,
    sender,
    temporaryId
  }) {
    const wrapper =
      document.createElement("div");

    wrapper.className =
      `chatMsg ${getMessageClass(
        sender
      )}`;

    if (temporaryId) {
      wrapper.dataset.temporaryId =
        temporaryId;
    }

    if (sender !== "visitor") {
      const author =
        document.createElement(
          "small"
        );

      author.className =
        "chatMsgAuthor";

      author.textContent =
        "Olivia";

      wrapper.appendChild(
        author
      );
    }

    const content =
      document.createElement("span");

    content.textContent =
      message;

    wrapper.appendChild(
      content
    );

    messagesElement.appendChild(
      wrapper
    );

    messagesElement.scrollTop =
      messagesElement.scrollHeight;

    return wrapper;
  }

  async function ensureWelcomeMessage(
    chatSessionId,
    messagesElement
  ) {
    const messages =
      await loadMessages(
        chatSessionId,
        messagesElement
      );

    const hasConciergeMessage =
      messages.some(
        (item) =>
          item.sender ===
            "admin" ||
          item.sender ===
            "assistant"
      );

    if (hasConciergeMessage) {
      return messages;
    }

    await saveMessage(
      chatSessionId,
      getChatTexts().welcome,
      "admin"
    );

    return loadMessages(
      chatSessionId,
      messagesElement
    );
  }

  function buildOliviaHistory(
    messages
  ) {
    return messages
      .filter(
        (item) =>
          item &&
          typeof item.message ===
            "string" &&
          item.message.trim()
      )
      .slice(
        -MAX_HISTORY_MESSAGES
      )
      .map((item) => ({
        role:
          item.sender ===
          "visitor"
            ? "user"
            : "assistant",

        content:
          item.message
            .trim()
            .slice(0, 2000)
      }));
  }

  async function requestOlivia({
    chatSessionId,
    message,
    history
  }) {
    const response =
      await fetch(
        "/api/olivia-chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            sessionId:
              chatSessionId,

            session_id:
              chatSessionId,

            message,

            history,

            agent: "olivia",

            operational_context: {
              source:
                "live_chat",

              page_path:
                window.location
                  .pathname,

              page_url:
                window.location
                  .href,

              language:
                getChatLanguage()
            }
          })
        }
      );

    const data =
      await parseJsonResponse(
        response
      );

    const answer =
      data?.response ||
      data?.message;

    if (
      typeof answer !== "string" ||
      !answer.trim()
    ) {
      throw new Error(
        "Olivia returned an empty response"
      );
    }

    return {
      answer:
        answer.trim(),

      intent:
        data.intent || null,

      routing:
        data.routing || null,

      model:
        data.model || null
    };
  }

  function setTyping(
    typingElement,
    isTyping
  ) {
    typingElement.hidden =
      !isTyping;
  }

  function setFormBusy({
    form,
    input,
    button,
    isBusy
  }) {
    const texts =
      getChatTexts();

    input.disabled =
      isBusy;

    button.disabled =
      isBusy;

    form.classList.toggle(
      "isBusy",
      isBusy
    );

    button.textContent =
      isBusy
        ? texts.sending
        : texts.send;
  }

  function trackChatEvent(
    eventType,
    metadata = {}
  ) {
    try {
      if (
        typeof window
          .trackSiteEvent ===
        "function"
      ) {
        window.trackSiteEvent(
          eventType,
          {
            component:
              "olivia_live_chat",

            language:
              getChatLanguage(),

            ...metadata
          }
        );
      }
    } catch (error) {
      console.warn(
        "Chat analytics failed:",
        error
      );
    }
  }

  function injectStyles() {
    const style =
      document.createElement(
        "style"
      );

    style.textContent = `
      .casasLiveChat {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 9999;
        font-family: inherit;
      }

      .chatBubble {
        position: relative;
        width: 58px;
        height: 58px;
        border-radius: 999px;
        border: 0;
        background: #1f3d35;
        color: #fff;
        font-size: 24px;
        cursor: pointer;
        box-shadow:
          0 12px 30px
          rgba(0, 0, 0, .25);
      }

      .chatBubbleBadge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        background: #c94f32;
        color: #fff;
        font-size: 12px;
        display: grid;
        place-items: center;
        font-weight: 700;
      }

      .chatPanel {
        display: none;
        width: 350px;
        max-width:
          calc(100vw - 32px);
        background: #fff;
        border-radius: 18px;
        overflow: hidden;
        box-shadow:
          0 18px 50px
          rgba(0, 0, 0, .28);
        margin-bottom: 12px;
        border:
          1px solid
          rgba(0, 0, 0, .08);
      }

      .chatPanel.isOpen {
        display: block;
      }

      .chatHeader {
        padding: 14px 16px;
        background: #1f3d35;
        color: #fff;
        display: flex;
        justify-content:
          space-between;
        align-items: center;
      }

      .chatHeaderIdentity {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .chatHeaderIdentity small {
        font-size: 11px;
        opacity: .78;
        font-weight: 400;
      }

      .chatClose {
        background: transparent;
        color: #fff;
        border: 0;
        font-size: 24px;
        cursor: pointer;
      }

      .chatIntro {
        padding: 13px 16px;
        font-size: 13px;
        line-height: 1.45;
        background: #f6f2ea;
        color: #3c3a36;
      }

      .chatMessages {
        height: 260px;
        overflow: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        scroll-behavior: smooth;
      }

      .chatMsg {
        padding: 9px 11px;
        border-radius: 14px;
        max-width: 84%;
        font-size: 14px;
        line-height: 1.42;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .chatMsg.visitor {
        align-self: flex-end;
        background: #1f3d35;
        color: #fff;
        border-bottom-right-radius:
          5px;
      }

      .chatMsg.admin {
        align-self: flex-start;
        background: #eee7dc;
        color: #1e1e1e;
        border-bottom-left-radius:
          5px;
      }

      .chatMsgAuthor {
        display: block;
        font-size: 10px;
        font-weight: 700;
        color: #566d64;
      }

      .chatTyping {
        padding: 0 16px 10px;
        align-items: center;
        gap: 4px;
        color: #6a655d;
      }

      .chatTyping:not([hidden]) {
        display: flex;
      }

      .chatTyping span {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #778d84;
        animation:
          casasTyping 1.2s
          infinite ease-in-out;
      }

      .chatTyping span:nth-child(2) {
        animation-delay: .15s;
      }

      .chatTyping span:nth-child(3) {
        animation-delay: .3s;
      }

      .chatTyping small {
        margin-left: 5px;
      }

      @keyframes casasTyping {
        0%, 60%, 100% {
          transform:
            translateY(0);
          opacity: .45;
        }

        30% {
          transform:
            translateY(-4px);
          opacity: 1;
        }
      }

      .chatForm {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top:
          1px solid
          rgba(0, 0, 0, .08);
      }

      .chatInput {
        flex: 1;
        min-width: 0;
        border:
          1px solid
          rgba(0, 0, 0, .18);
        border-radius: 999px;
        padding: 10px 12px;
        font: inherit;
      }

      .chatInput:focus {
        outline:
          2px solid
          rgba(31, 61, 53, .18);
        border-color: #1f3d35;
      }

      .chatForm button {
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        background: #1f3d35;
        color: #fff;
        cursor: pointer;
      }

      .chatForm button:disabled,
      .chatInput:disabled {
        cursor: wait;
        opacity: .65;
      }

      @media (
        max-width: 520px
      ) {
        .casasLiveChat {
          right: 14px;
          bottom: 14px;
        }

        .chatPanel {
          width:
            calc(100vw - 28px);
        }

        .chatMessages {
          height:
            min(
              48vh,
              340px
            );
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      injectStyles();

      const root =
        createWidget();

      const bubble =
        root.querySelector(
          ".chatBubble"
        );

      const badge =
        root.querySelector(
          ".chatBubbleBadge"
        );

      const panel =
        root.querySelector(
          ".chatPanel"
        );

      const close =
        root.querySelector(
          ".chatClose"
        );

      const form =
        root.querySelector(
          ".chatForm"
        );

      const input =
        root.querySelector(
          ".chatInput"
        );

      const sendButton =
        root.querySelector(
          ".chatSend"
        );

      const messagesElement =
        root.querySelector(
          ".chatMessages"
        );

      const typingElement =
        root.querySelector(
          ".chatTyping"
        );

      let chatSessionId =
        localStorage.getItem(
          CHAT_KEY
        );

      let poller = null;
      let requestInProgress =
        false;

      async function refreshMessages() {
        if (
          !chatSessionId ||
          requestInProgress
        ) {
          return [];
        }

        return loadMessages(
          chatSessionId,
          messagesElement
        );
      }

      async function openChat() {
        panel.classList.add(
          "isOpen"
        );

        panel.setAttribute(
          "aria-hidden",
          "false"
        );

        bubble.setAttribute(
          "aria-expanded",
          "true"
        );

        badge.hidden = true;

        try {
          chatSessionId =
            await createSession();

          await ensureWelcomeMessage(
            chatSessionId,
            messagesElement
          );

          clearInterval(poller);

          poller = setInterval(
            refreshMessages,
            POLLING_INTERVAL_MS
          );

          input.focus();

          trackChatEvent(
            "chat_opened",
            {
              chat_session_id:
                chatSessionId
            }
          );
        } catch (error) {
          console.error(
            "Unable to open chat:",
            error
          );

          appendTemporaryMessage({
            messagesElement,
            message:
              getChatTexts()
                .sessionError,
            sender: "admin",
            temporaryId:
              "session-error"
          });
        }
      }

      function closeChat() {
        panel.classList.remove(
          "isOpen"
        );

        panel.setAttribute(
          "aria-hidden",
          "true"
        );

        bubble.setAttribute(
          "aria-expanded",
          "false"
        );

        clearInterval(poller);
      }

      bubble.addEventListener(
        "click",
        openChat
      );

      close.addEventListener(
        "click",
        closeChat
      );

      form.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();

          if (
            requestInProgress
          ) {
            return;
          }

          const message =
            input.value.trim();

          if (!message) {
            return;
          }

          requestInProgress =
            true;

          setFormBusy({
            form,
            input,
            button: sendButton,
            isBusy: true
          });

          input.value = "";

          appendTemporaryMessage({
            messagesElement,
            message,
            sender: "visitor",
            temporaryId:
              "visitor-pending"
          });

          try {
            chatSessionId =
              await createSession();

            await saveMessage(
              chatSessionId,
              message,
              "visitor"
            );

            const storedMessages =
              await fetchMessages(
                chatSessionId
              );

            renderMessages(
              storedMessages,
              messagesElement
            );

            setTyping(
              typingElement,
              true
            );

            const history =
              buildOliviaHistory(
                storedMessages.slice(
                  0,
                  -1
                )
              );

            const olivia =
              await requestOlivia({
                chatSessionId,
                message,
                history
              });

            await saveMessage(
              chatSessionId,
              olivia.answer,
              "admin"
            );

            await loadMessages(
              chatSessionId,
              messagesElement
            );

            trackChatEvent(
              "olivia_response",
              {
                chat_session_id:
                  chatSessionId,

                intent:
                  olivia.intent,

                model:
                  olivia.model,

                routing:
                  olivia.routing
              }
            );
          } catch (error) {
            console.error(
              "Olivia chat failed:",
              error
            );

            const fallback =
              getChatTexts()
                .unavailable;

            try {
              if (
                chatSessionId
              ) {
                await saveMessage(
                  chatSessionId,
                  fallback,
                  "admin"
                );

                await loadMessages(
                  chatSessionId,
                  messagesElement
                );
              } else {
                appendTemporaryMessage({
                  messagesElement,
                  message:
                    fallback,
                  sender: "admin",
                  temporaryId:
                    "olivia-error"
                });
              }
            } catch (
              persistenceError
            ) {
              console.warn(
                "Unable to persist chat fallback:",
                persistenceError
              );

              appendTemporaryMessage({
                messagesElement,
                message:
                  fallback,
                sender: "admin",
                temporaryId:
                  "olivia-error"
              });
            }

            trackChatEvent(
              "olivia_error",
              {
                chat_session_id:
                  chatSessionId,

                error:
                  error?.message ||
                  String(error)
              }
            );
          } finally {
            setTyping(
              typingElement,
              false
            );

            requestInProgress =
              false;

            setFormBusy({
              form,
              input,
              button: sendButton,
              isBusy: false
            });

            input.focus();
          }
        }
      );
    }
  );
})();
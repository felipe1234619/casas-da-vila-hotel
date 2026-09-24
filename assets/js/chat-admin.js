(function () {
  const $ = id => document.getElementById(id);
  let poller;
  let loading = false;
  const drafts = new Map();
  const pendingReplies = new Map();
  const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const time = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
  async function api(body) {
    const response = await fetch('/api/chat-admin', {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': $('adminToken').value.trim() },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha no atendimento');
    return data;
  }
  function errorNotice(error) { $('chatStatus').textContent = `Falha: ${error.message}`; }
  async function loadChats() {
    if (loading || !$('adminToken').value.trim()) return;
    loading = true;
    try {
      const data = await api();
      $('chatStatus').textContent = `● atualizado ${new Date().toLocaleTimeString('pt-BR')}`;
      render(data);
    } catch (error) { errorNotice(error); }
    finally { loading = false; }
  }
  function render({ sessions = [], messages = [], alerts = [] }) {
    // Keep the actual form node (focus, caret, listeners and pending
    // request) while replacing only surrounding conversation content.
    const forms = new Map([...document.querySelectorAll('.chatReplyForm')].map(form => [form.dataset.chat, form]));
    const active = document.activeElement;
    const selection = active?.matches('.chatReplyForm input') ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = [window.scrollX, window.scrollY];
    $('chatSessions').innerHTML = sessions.length ? sessions.map(session => {
      const rows = messages.filter(m => m.chat_session_id === session.id);
      const pending = alerts.filter(a => a.chat_session_id === session.id && a.state !== 'sent');
      const unread = rows.filter(m => m.sender === 'visitor' && !m.is_read).length;
      const state = { bot: 'Olivia', requested: 'PRIORIDADE — atendimento solicitado', human_active: 'Atendimento humano' }[session.handoff_state] || 'Legado';
      return `<div class="visitorSessionCard">
        <div class="visitorSessionTop"><strong>${escapeHtml(state)}${unread ? ` · ${unread} nova(s)` : ''}</strong><small>${escapeHtml(session.page_path)}</small></div>
        <p>Visitante: ${escapeHtml(session.visitor_id || 'não registrado')}<br>Sessão: ${escapeHtml(session.session_id || 'não registrada')}</p>
        <small>Conversa: ${escapeHtml(session.id)} · Primeira mensagem: ${time(session.first_visitor_message_at || rows.find(m => m.sender === 'visitor')?.created_at)}</small>
        ${pending.length ? `<p role="status">Alertas pendentes: ${pending.map(a => `${escapeHtml(a.kind)} (${escapeHtml(a.state)})`).join(', ')}. “needs_review” exige conferência no Resend antes de qualquer reenvio.</p><button type="button" data-chat="${session.id}" data-action="retry_alerts">Tentar alertas pendentes</button>` : ''}
        <div class="sessionTimeline">${rows.map(m => `<div class="timelineItem"><strong>${m.sender === 'visitor' ? 'Visitante' : m.sender === 'assistant' ? 'Olivia' : m.request_id ? 'Equipe Casas da Vila' : 'Concierge / legado'}</strong><span>${escapeHtml(m.message)}</span><small>${time(m.created_at)}</small></div>`).join('')}</div>
        <button type="button" data-chat="${session.id}" data-action="claim">Assumir atendimento</button>
        <button type="button" data-chat="${session.id}" data-action="resume_bot">Devolver à Olivia</button>
        <form class="chatReplyForm" data-chat="${session.id}"><input type="text" maxlength="4000" value="${escapeHtml(drafts.get(session.id) || '')}" placeholder="Responder como equipe Casas da Vila" aria-label="Resposta da equipe" required><button type="submit">Enviar e assumir</button></form>
      </div>`;
    }).join('') : '<p class="empty">Nenhuma conversa com mensagem de visitante encontrada.</p>';
    document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const data = await api({ action: button.dataset.action, chat_session_id: button.dataset.chat });
        await loadChats();
        if (data.alerts?.pending) $('chatStatus').textContent = 'Alerta mantido na fila. Verifique configuração/conectividade de e-mail.';
      } catch (error) { errorNotice(error); }
      finally { button.disabled = false; }
    }));
    document.querySelectorAll('.chatReplyForm').forEach(form => {
      const existing = forms.get(form.dataset.chat);
      if (existing) { form.replaceWith(existing); return; }
      form.querySelector('input').addEventListener('input', event => drafts.set(form.dataset.chat, event.target.value));
      form.addEventListener('submit', async event => {
      event.preventDefault();
      if (form.dataset.busy) return;
      const input = form.querySelector('input');
      const message = input.value.trim();
      if (!message) return;
      let pending = pendingReplies.get(form.dataset.chat);
      if (pending?.message !== message) { pending = { id: crypto.randomUUID(), message }; pendingReplies.set(form.dataset.chat, pending); }
      form.dataset.busy = 'true';
      form.querySelector('button').disabled = true;
      let sent = false;
      try {
        await api({ action: 'reply', chat_session_id: form.dataset.chat, request_id: pending.id, message });
        drafts.delete(form.dataset.chat); pendingReplies.delete(form.dataset.chat);
        input.value = ''; input.blur(); sent = true;
      } catch (error) { errorNotice(error); }
      finally { delete form.dataset.busy; form.querySelector('button').disabled = false; }
      if (sent) await loadChats();
      });
    });
    if (selection && active.isConnected) {
      active.focus({ preventScroll: true });
      active.setSelectionRange(...selection);
      window.scrollTo(...scroll);
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    // Keep the existing admin access convention; never put the token in requests' URLs.
    $('adminToken').value = localStorage.getItem('casas_admin_token') || '';
    $('loadChats').addEventListener('click', async () => {
      localStorage.setItem('casas_admin_token', $('adminToken').value.trim());
      await loadChats();
      clearInterval(poller); poller = setInterval(loadChats, 5000);
    });
  });
})();

import { randomUUID } from 'node:crypto';

export function alertConfig(env = process.env) {
  const to = (env.CHAT_NOTIFICATION_EMAILS || env.CHAT_NOTIFICATION_EMAIL || env.BOOKING_NOTIFICATION_EMAIL ||
    env.CONTACT_NOTIFICATION_EMAILS || env.CONTACT_NOTIFICATION_EMAIL || '').split(',').map(x => x.trim()).filter(Boolean);
  const from = env.CHAT_FROM_EMAIL || env.CONTACT_FROM_EMAIL || env.BOOKING_FROM_EMAIL;
  return { to: [...new Set(to)], from, key: env.RESEND_API_KEY };
}
function redact(value, key) {
  return String(value).split(key).join('[REDACTED]')
    .replace(/Bearer\s+[^\s"<>]+/gi, 'Bearer [REDACTED]')
    .replace(/\bre_[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 8192);
}
export async function dispatchAlerts(client, chatId = null) {
  // Await the immediate attempt: serverless termination must not discard queued work.
  let query = client.from('chat_alerts').select('*').in('state', ['pending', 'sending']).order('created_at').order('kind').limit(20);
  if (chatId) query = query.eq('chat_session_id', chatId);
  const { data: alerts, error } = await query;
  if (error) throw error;
  const config = alertConfig();
  if (!config.key || !config.from || !config.to.length) return { pending: true, reason: 'email_configuration_missing' };
  let attempted = 0, accepted = 0, failed = 0;
  for (const candidate of alerts || []) {
    const lease = randomUUID();
    const { data: alert, error: claimError } = await client.rpc('chat_claim_alert', { p_id: candidate.id, p_lease: lease });
    if (claimError) throw claimError;
    if (!alert) continue;
    let providerId = null;
    let sendError = null;
    let status = null, responseBody = null;
    const diagnostic = (kind, detail = '') => JSON.stringify({
      kind, status,
      // Provider bodies are restricted to the server-side outbox, never the visitor response.
      responseBody: responseBody === null ? null : redact(responseBody, config.key),
      detail: redact(detail, config.key)
    });
    attempted++;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `cdv-chat-${alert.id}` },
        body: JSON.stringify({ from: config.from, to: config.to,
          subject: alert.kind === 'human_handoff' ? '[PRIORIDADE] Live Chat — atendimento humano solicitado' : 'Live Chat — primeira mensagem do visitante',
          text: `${alert.kind === 'human_handoff' ? 'Atendimento humano prioritário solicitado.' : 'Uma conversa real foi iniciada.'}\n\nConversa: ${alert.chat_session_id}\nVisitante: ${alert.payload.visitor_id}\nSessão: ${alert.payload.session_id}\nPágina: ${alert.payload.page_path || '—'}\n\n${alert.payload.message}\n\nAtenda no painel administrativo Live Chat do site. Não responda a este alerta para falar com o visitante.` })
      });
      status = response.status;
      responseBody = await response.text();
      let result;
      try { result = JSON.parse(responseBody); } catch { /* distinguish malformed JSON below */ }
      if (!response.ok) sendError = diagnostic('provider_http_error');
      else if (!result) sendError = diagnostic('invalid_json_response');
      else if (typeof result.id !== 'string' || !result.id.trim()) sendError = diagnostic('missing_message_id');
      else providerId = result.id;
    } catch (error) {
      sendError = diagnostic(status === null ? 'transport_error' : 'response_read_error', error?.message || 'unknown');
    }
    if (providerId) accepted++; else failed++;
    const { error: finishError } = await client.rpc('chat_finish_alert', {
      p_id: alert.id, p_lease: lease, p_provider_id: providerId, p_error: sendError
    });
    if (finishError) throw finishError;
  }
  // Acceptance is not delivery. Failed sends remain pending with diagnostic evidence.
  return { attempted: attempted > 0, accepted, failed, pending: failed > 0 };
}
export async function tryAlerts(client, chatId) {
  try { return await dispatchAlerts(client, chatId); }
  catch { return { pending: true, reason: 'email_queue_retry_required' }; }
}

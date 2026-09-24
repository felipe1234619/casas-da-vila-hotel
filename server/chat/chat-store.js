import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
export function fail(status, message) { return Object.assign(new Error(message), { status }); }
export function uuid(value) { return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value); }
export function tokenHash(req) {
  const token = req.headers?.['x-chat-token'];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) throw fail(401, 'Chat credential required');
  return createHash('sha256').update(token).digest('hex');
}
export function requireAdmin(req) {
  const actual = req.headers?.['x-admin-token'];
  const expected = process.env.ADMIN_ANALYTICS_TOKEN;
  if (!expected || typeof actual !== 'string' || Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw fail(401, 'Unauthorized');
}
export async function ownedChat(client, req, id) {
  if (!uuid(id)) throw fail(400, 'Invalid chat ID');
  const hash = tokenHash(req);
  const { data, error } = await client.from('chat_sessions').select('id,handoff_state,visitor_id,session_id')
    .eq('id', id).eq('access_token_hash', hash).maybeSingle();
  if (error) throw error;
  if (!data) throw fail(403, 'Chat access denied');
  return data;
}
export function messageText(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 4000) throw fail(400, 'Message must contain 1–4000 characters');
  return value.trim();
}
export function isHumanRequest(message) {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const person = '(?:humano|humana|atendente|gerente|responsavel|manager|human assistance|human agent|human|real person|someone|representative|pessoa|alguem|equipe|operacoes|reservas|reservations|staff|team|person|operations)';
  if (/(?:nao (?:quero|preciso)|do not want|don't want|no need).{0,50}(?:falar|speak|talk|humano|human)/.test(text)) return false;
  return new RegExp('(?:falar|conversar|contato|chamar|chame|quero|preciso|prefiro|passe|transfer|talk|speak|contact|connect|reach|put me through|call|want|need).{0,65}\\b' + person + '\\b').test(text) ||
    new RegExp('^' + person + '(?: de reservas| team)?[,]?(?: por favor| please)?[.!?\\s]*$').test(text);

}
export function safeSession(row) {
  const { access_token_hash, ...safe } = row;
  return safe;
}
export function respondError(res, error) {
  // Do not expose provider responses, credentials or conversation contents in logs/errors.
  return res.status(error.status || 500).json({ error: error.status ? error.message : 'Chat temporarily unavailable' });
}
export async function recordMessage(client, { chatId, requestId, sender, message, handoff = false, replyTo = null }) {
  if (!uuid(requestId)) throw fail(400, 'Message request ID required');
  const { data, error } = await client.rpc('chat_record_message', { p_chat_id: chatId, p_request_id: requestId,
    p_sender: sender, p_message: messageText(message), p_handoff: handoff, p_reply_to: replyTo });
  if (error) throw error;
  return data;
}

// Advance by the number actually returned, not the requested page size: the
// Data API may impose a smaller cap. Empty page is the only completion signal.
export async function allMessages(client, filter) {
  const rows = new Map();
  let offset = 0;
  for (;;) {
    const { data, error } = await filter(client.from('chat_messages').select('*'))
      .order('created_at').order('id').range(offset, offset + 199);
    if (error) throw error; // Never return a silently truncated conversation.
    if (!data?.length) break;
    for (const row of data) rows.set(row.id, row);
    offset += data.length;
  }
  return [...rows.values()];
}

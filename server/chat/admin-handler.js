import { db, allMessages, requireAdmin, uuid, fail, safeSession, recordMessage, respondError } from './chat-store.js';
import { tryAlerts } from './alerts.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    requireAdmin(req);
    const client = db();
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!uuid(body.chat_session_id)) throw fail(400, 'Invalid chat ID');
      if (body.action === 'reply') {
        const result = await recordMessage(client, { chatId: body.chat_session_id, requestId: body.request_id, sender: 'admin', message: body.message });
        return res.status(200).json({ ok: true, ...result });
      }
      if (body.action === 'retry_alerts') return res.status(200).json({ ok: true, alerts: await tryAlerts(client, body.chat_session_id) });
      if (!['claim', 'resume_bot'].includes(body.action)) throw fail(400, 'Invalid action');
      const { error } = await client.rpc('chat_set_handoff', { p_chat_id: body.chat_session_id, p_state: body.action === 'claim' ? 'human_active' : 'bot' });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const { data: sessions, error } = await client.from('chat_sessions').select('*').order('updated_at', { ascending: false }).limit(100);
    if (error) throw error;
    const ids = sessions.map(s => s.id);
    if (!ids.length) return res.status(200).json({ ok: true, sessions: [], messages: [], alerts: [] });
    const [messages, alerts] = await Promise.all([
      allMessages(client, query => query.in('chat_session_id', ids)),
      client.from('chat_alerts').select('id,chat_session_id,kind,state,attempts,sent_at,last_error').in('chat_session_id', ids)
    ]);
    if (alerts.error) throw alerts.error;
    // Include legacy conversations only when a visitor actually wrote; never backfill alerts.
    const real = sessions.filter(s => s.first_visitor_message_at || messages.some(m => m.chat_session_id === s.id && m.sender === 'visitor'));
    real.sort((a,b) => Number(b.handoff_state === 'requested') - Number(a.handoff_state === 'requested'));
    return res.status(200).json({ ok: true, sessions: real.map(safeSession), messages: messages.filter(m => real.some(s => s.id === m.chat_session_id)), alerts: alerts.data });
  } catch (error) { return respondError(res, error); }
}

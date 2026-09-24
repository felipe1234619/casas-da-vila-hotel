import { db, allMessages, ownedChat, messageText, isHumanRequest, recordMessage, respondError, fail } from './chat-store.js';
import { tryAlerts } from './alerts.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const client = db();
    const id = req.method === 'GET' ? req.query?.chat_session_id : body.chat_session_id;
    const chat = await ownedChat(client, req, id);
    if (req.method === 'GET') {
      const data = await allMessages(client, query => query.eq('chat_session_id', id));
      return res.status(200).json({ ok: true, messages: data, handoff_state: chat.handoff_state });
    }
    if (body.sender && body.sender !== 'visitor') throw fail(403, 'Only visitor messages accepted here');
    const message = messageText(body.message);
    const result = await recordMessage(client, { chatId: id, requestId: body.request_id, sender: 'visitor', message, handoff: isHumanRequest(message) });
    const alerts = await tryAlerts(client, id);
    return res.status(200).json({ ok: true, ...result, alerts });
  } catch (error) { return respondError(res, error); }
}

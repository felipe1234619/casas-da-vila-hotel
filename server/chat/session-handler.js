import { db, tokenHash, fail, safeSession, respondError } from './chat-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    for (const field of ['visitor_id', 'session_id']) {
      if (typeof body[field] !== 'string' || !/^[\w-]{1,128}$/.test(body[field])) throw fail(400, 'Visitor and session identity required');
    }
    const client = db();
    const hash = tokenHash(req);
    const fields = { access_token_hash: hash, visitor_id: body.visitor_id, session_id: body.session_id,
      identity_source: body.identity_source === 'analytics' ? 'analytics' : 'chat',
      page_path: typeof body.page_path === 'string' ? body.page_path.slice(0, 500) : null,
      // Avoid persisting query strings which may contain private URL parameters.
      page_url: null, status: 'open' };
    const { data, error } = await client.from('chat_sessions').insert(fields).select('*').single();
    if (!error) return res.status(200).json({ ok: true, chat_session: safeSession(data) });
    if (error.code !== '23505') throw error;
    const existing = await client.from('chat_sessions').select('*').eq('access_token_hash', hash).single();
    if (existing.error) throw existing.error;
    if (existing.data.visitor_id !== body.visitor_id || existing.data.session_id !== body.session_id) throw fail(409, 'Session identity changed');
    return res.status(200).json({ ok: true, chat_session: safeSession(existing.data) });
  } catch (error) { return respondError(res, error); }
}

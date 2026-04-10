export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      unitSlug,
      guestEmail,
      guestName,
      guestPhone,
      checkIn,
      checkOut,
      guestsCount,
      specialRequests
    } = req.body || {};

    if (!unitSlug || !guestEmail || !guestName || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/create_reservation_hold`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_unit_slug: unitSlug,
          p_guest_email: guestEmail,
          p_guest_name: guestName,
          p_guest_phone: guestPhone || null,
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_guests_count: Number(guestsCount || 1),
          p_special_requests: specialRequests || null,
          p_hold_minutes: 15
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Falha ao criar hold.'
      });
    }

    return res.status(200).json({ hold: data });
  } catch (error) {
    console.error('create-hold-error', error);
    return res.status(500).json({ error: 'Erro interno ao criar hold.' });
  }
}
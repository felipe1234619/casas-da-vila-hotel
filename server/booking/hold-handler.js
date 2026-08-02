export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({
        error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY'
      });
    }

    const body = req.body || {};

    const unitSlug = body.unitSlug || body.unit_slug || '';
    const guestEmail = body.guestEmail || body.guest_email || '';
    const guestName = body.guestName || body.guest_name || '';
    const guestPhone = body.guestPhone || body.guest_phone || '';
    const checkIn = body.checkIn || body.checkin || '';
    const checkOut = body.checkOut || body.checkout || '';
    const guestsCount = Number(body.guestsCount || body.guests_count || body.guests || 1);
    const specialRequests = body.specialRequests || body.special_requests || '';

    if (!unitSlug || !guestEmail || !guestName || !checkIn || !checkOut) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['unitSlug', 'guestEmail', 'guestName', 'checkIn', 'checkOut']
      });
    }

    if (!Number.isFinite(guestsCount) || guestsCount < 1) {
      return res.status(400).json({
        error: 'Invalid guestsCount'
      });
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
          p_guests_count: guestsCount,
          p_special_requests: specialRequests || null,
          p_hold_minutes: 15
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error_description ||
          data?.error ||
          'Failed to create reservation hold.'
      });
    }

    return res.status(200).json({
      hold: data
    });
  } catch (error) {
    console.error('create-hold-error', error);
    return res.status(500).json({
      error: 'Internal error while creating reservation hold.',
      message: error.message
    });
  }
}
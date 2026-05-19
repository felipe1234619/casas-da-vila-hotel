export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      });
    }

    const body = req.body || {};

    const checkIn = body.checkIn || body.checkin || '';
    const checkOut = body.checkOut || body.checkout || '';
    const guestsCount = Number(
      body.guestsCount || body.guests_count || body.guests || 1
    );

    const isValidDate = (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        error: 'Check-in and check-out are required.'
      });
    }

    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({
        error: 'Invalid dates. Use YYYY-MM-DD.'
      });
    }

    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({
        error: 'Invalid stay period.'
      });
    }

    if (!Number.isFinite(guestsCount) || guestsCount < 1) {
      return res.status(400).json({
        error: 'Invalid number of guests.'
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/list_available_units_with_price`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_guests_count: guestsCount
        })
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.message ||
          data?.error_description ||
          data?.error ||
          'Failed to check availability.'
      });
    }

    return res.status(200).json({
      items: Array.isArray(data) ? data : []
    });
  } catch (error) {
    console.error('availability-error', error);

    return res.status(500).json({
      error: 'Internal error while checking availability.',
      message: error?.message || String(error)
    });
  }
}
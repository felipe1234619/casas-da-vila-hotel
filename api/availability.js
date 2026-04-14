export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { checkIn, checkOut, guestsCount } = req.body || {};

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        error: 'Check-in e check-out são obrigatórios.'
      });
    }

    // Validação simples do padrão YYYY-MM-DD
    const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({
        error: 'Datas inválidas. Use o formato YYYY-MM-DD.'
      });
    }

    const safeGuestsCount = Number(guestsCount || 1);

    if (!Number.isFinite(safeGuestsCount) || safeGuestsCount < 1) {
      return res.status(400).json({
        error: 'Quantidade de hóspedes inválida.'
      });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/list_available_units_with_price`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_guests_count: safeGuestsCount
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
          'Falha ao consultar disponibilidade.'
      });
    }

    return res.status(200).json({
      items: Array.isArray(data) ? data : []
    });
  } catch (error) {
    console.error('availability-error', error);
    return res.status(500).json({
      error: 'Erro interno ao consultar disponibilidade.'
    });
  }
}
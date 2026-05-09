import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ref = String(req.query.ref || '').trim();
    const download = String(req.query.download || '') === '1';

    if (!ref) {
      return res.status(400).json({ error: 'Missing ref' });
    }

    const { data, error } = await supabase
      .from('booking_vouchers')
      .select('*')
      .eq('booking_reference', ref)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    let signedUrl = null;

    if (data.voucher_pdf_path) {
      const signed = await supabase.storage
        .from('vouchers')
        .createSignedUrl(data.voucher_pdf_path, 60 * 30);

      if (!signed.error) {
        signedUrl = signed.data.signedUrl;
      }
    }

    if (download) {
      if (!signedUrl) {
        return res.status(404).json({ error: 'Voucher PDF not found' });
      }

      return res.redirect(302, signedUrl);
    }

    return res.status(200).json({
      ok: true,
      booking_reference: data.booking_reference,
      voucher_html: data.voucher_html,
      pdf_url: signedUrl,
      download_url: signedUrl
        ? `/api/voucher-by-ref?ref=${encodeURIComponent(ref)}&download=1`
        : null
    });
  } catch (error) {
    console.error('voucher-by-ref error:', error);
    return res.status(500).json({
      error: 'Internal voucher error',
      message: error.message
    });
  }
}
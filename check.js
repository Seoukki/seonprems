// api/check.js — Check QRIS payment status & update Supabase order
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, order_id, email, product, duration } = req.query;

  if (!id) return res.status(400).json({ status: false, message: 'Transaction ID diperlukan' });

  const API_KEY = process.env.NEOXR_API_KEY;
  if (!API_KEY) return res.status(500).json({ status: false, message: 'API Key tidak dikonfigurasi' });

  try {
    // ── Check payment status at neoxr.eu ──────────────────────────
    const neoxrRes = await fetch(
      `https://api.neoxr.eu/api/qris/status?id=${encodeURIComponent(id)}`,
      {
        method : 'GET',
        headers: { 'x-api-key': API_KEY },
      }
    );

    if (!neoxrRes.ok) {
      const errText = await neoxrRes.text();
      return res.status(502).json({ status: false, message: `neoxr.eu error: ${errText}` });
    }

    const neoxrData = await neoxrRes.json();
    const isPaid    = neoxrData.data?.status === 'paid' || neoxrData.data?.paid === true;

    // ── Update order in Supabase when paid ───────────────────────
    if (isPaid && order_id) {
      const SB_URL = process.env.SUPABASE_URL;
      const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
      if (SB_URL && SB_KEY) {
        try {
          await fetch(`${SB_URL}/rest/v1/orders?id=eq.${order_id}`, {
            method : 'PATCH',
            headers: {
              'apikey'       : SB_KEY,
              'Authorization': `Bearer ${SB_KEY}`,
              'Content-Type' : 'application/json',
            },
            body: JSON.stringify({
              status : 'paid',
              paid_at: new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error('Supabase update error:', err.message);
        }
      }
    }

    return res.status(200).json({
      status: true,
      paid  : isPaid,
      data  : neoxrData.data || {},
    });

  } catch (err) {
    console.error('Check payment error:', err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

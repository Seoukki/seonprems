// api/qris.js — Create QRIS payment via api.neoxr.eu
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'Method not allowed' });

  const { amount, product, duration, email, whatsapp, quantity } = req.body || {};

  if (!amount || isNaN(amount) || Number(amount) < 1000) {
    return res.status(400).json({ status: false, message: 'Amount tidak valid (minimum Rp1.000)' });
  }
  if (!email) {
    return res.status(400).json({ status: false, message: 'Email wajib diisi' });
  }

  const API_KEY  = process.env.NEOXR_API_KEY;
  const USERNAME = process.env.NEOXR_USERNAME || 'seon';

  if (!API_KEY) {
    return res.status(500).json({ status: false, message: 'API Key belum dikonfigurasi di server' });
  }

  try {
    // ── Call api.neoxr.eu to generate QRIS ──────────────────────
    const neoxrRes = await fetch('https://api.neoxr.eu/api/qris', {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key'  : API_KEY,
      },
      body: JSON.stringify({
        amount  : Number(amount),
        username: USERNAME,
      }),
    });

    if (!neoxrRes.ok) {
      const errText = await neoxrRes.text();
      return res.status(502).json({ status: false, message: `neoxr.eu error: ${errText}` });
    }

    const neoxrData = await neoxrRes.json();

    if (!neoxrData.status) {
      return res.status(400).json({ status: false, message: neoxrData.message || 'Gagal membuat QRIS' });
    }

    // ── Save pending order to Supabase ────────────────────────────
    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

    let orderId = null;
    if (SB_URL && SB_KEY) {
      try {
        const sbRes = await fetch(`${SB_URL}/rest/v1/orders`, {
          method : 'POST',
          headers: {
            'apikey'       : SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type' : 'application/json',
            'Prefer'       : 'return=representation',
          },
          body: JSON.stringify({
            product_name   : product || 'Unknown',
            duration       : duration || '—',
            quantity       : Number(quantity) || 1,
            email          : email,
            whatsapp       : whatsapp || null,
            amount         : Number(amount),
            status         : 'pending',
            transaction_id : neoxrData.data?.id || null,
          }),
        });
        if (sbRes.ok) {
          const sbData = await sbRes.json();
          orderId = sbData?.[0]?.id || null;
        }
      } catch (sbErr) {
        // non-fatal: log but don't fail the QRIS creation
        console.error('Supabase order insert error:', sbErr.message);
      }
    }

    return res.status(200).json({
      status: true,
      data  : {
        ...neoxrData.data,
        order_id: orderId,
      },
    });

  } catch (err) {
    console.error('QRIS API error:', err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

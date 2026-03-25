// api/admin.js — Secure admin data operations (requires admin password)
const fetch = require('node-fetch');

const ALLOWED_TABLES = ['products', 'categories', 'orders', 'testimonials', 'faqs', 'contacts', 'settings'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  const adminPass = req.headers['x-admin-password'];
  if (!adminPass || adminPass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ status: false, message: 'Unauthorized' });
  }

  const { table, id, query } = req.query;
  if (!table || !ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ status: false, message: 'Tabel tidak valid' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) {
    return res.status(500).json({ status: false, message: 'Supabase belum dikonfigurasi' });
  }

  const headers = {
    'apikey'       : SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type' : 'application/json',
    'Prefer'       : 'return=representation',
  };

  let endpoint = `${SB_URL}/rest/v1/${table}`;
  if (id)    endpoint += `?id=eq.${id}`;
  if (query && !id) endpoint += `?${query}`;

  try {
    const sbRes = await fetch(endpoint, {
      method : req.method,
      headers,
      body   : ['POST', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });

    const text = await sbRes.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    return res.status(sbRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

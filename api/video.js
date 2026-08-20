export default async function handler(req, res) {
  if (!['POST','GET'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on Vercel.' });
  try {
    if (req.method === 'GET') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'Video id is required.' });
      const r = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
      const data = await r.json();
      return res.status(r.status).json(data);
    }
    const body = req.body || {};
    const r = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Video request failed.' });
  }
}

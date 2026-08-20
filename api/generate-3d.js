// EduLabs AI Science Lab - Image to 3D API
// Connects to an optional self-hosted TripoSR worker.
// If no worker is available, the frontend can use demo mode.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  const endpoint = process.env.TRIPOSR_ENDPOINT;

  if (!endpoint) {
    return res.status(503).json({
      available: false,
      mode: 'demo',
      error: 'AI 3D worker is offline',
      message: 'Connect a local TripoSR worker with TRIPOSR_ENDPOINT.'
    });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'] || 'application/octet-stream'
      },
      body: req
    });

    const data = await response.json();

    return res.status(response.status).json({
      available: true,
      ...data
    });
  } catch (error) {
    return res.status(503).json({
      available: false,
      mode: 'demo',
      error: 'AI worker unreachable',
      details: error.message
    });
  }
}

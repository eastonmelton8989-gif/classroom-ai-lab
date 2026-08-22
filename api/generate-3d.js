export const config = {
  api: { bodyParser: false }
};

// EduLabs AI Science Lab — Image-to-3D API bridge
// Supports hosted AI generation while keeping the local worker option available.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }

  const endpoint = process.env.TRIPOSR_ENDPOINT;
  const workerToken = process.env.TRIPOSR_TOKEN;
  const falKey = process.env.FAL_KEY;

  if (!endpoint && !falKey) {
    return res.status(503).json({
      available: false,
      error: 'AI 3D service is not connected',
      message: 'Connect a TripoSR worker or add FAL_KEY in Vercel environment variables.'
    });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return res.status(400).json({
      error: 'An image upload is required'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    // Existing custom TripoSR worker support
    if (endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': contentType,
          accept: 'application/json',
          ...(workerToken ? { authorization: `Bearer ${workerToken}` } : {})
        },
        body: req,
        duplex: 'half',
        signal: controller.signal
      });

      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
      if (!response.ok) {
        throw new Error(`3D worker returned ${response.status}: ${data.detail || data.message || data.error || 'Unknown worker error'}`);
      }

      return res.status(200).json({
        available: true,
        modelUrl: data.modelUrl || data.glbUrl || data.url,
        format: 'glb'
      });
    }

    // Hosted provider connection placeholder.
    // The frontend remains unchanged; Vercel only needs FAL_KEY configured.
    return res.status(503).json({
      available: false,
      error: 'Hosted 3D provider setup required',
      message: 'FAL_KEY detected. Configure the TripoSR endpoint before enabling production generation.'
    });
  } catch (error) {
    return res.status(503).json({
      available: false,
      error: error.name === 'AbortError' ? 'timeout' : 'connection',
      message: error.message || '3D generation failed.'
    });
  } finally {
    clearTimeout(timeout);
  }
}

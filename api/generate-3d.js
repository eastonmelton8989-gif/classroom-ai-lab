// EduLabs AI Science Lab — Image-to-3D API bridge
// Supports hosted AI generation while keeping the local worker option available.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }

  const endpoint = process.env.TRIPOSR_ENDPOINT;
  const workerToken = process.env.TRIPOSR_TOKEN;
  const falKey = process.env.FAL_KEY;
  console.log('[generate-3d] request started', { hasImage: Boolean(req.body?.imageBase64), hasEndpoint: Boolean(endpoint) });

  if (!endpoint && !falKey) {
    return res.status(503).json({
      available: false,
      error: 'AI 3D service is not connected',
      message: 'Connect a TripoSR worker or add FAL_KEY in Vercel environment variables.'
    });
  }

  const imageBase64 = req.body?.imageBase64;
  if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
    return res.status(400).json({
      error: 'An image upload is required'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    // Existing custom TripoSR worker support
    if (endpoint) {
      console.log('[generate-3d] sending image to local worker');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(workerToken ? { authorization: `Bearer ${workerToken}` } : {})
        },
        body: JSON.stringify({ imageBase64 }),
        signal: controller.signal
      });

      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
      console.log('[generate-3d] worker responded', { status: response.status });
      if (!response.ok) {
        const detail = String(data.detail || data.message || data.error || 'Unknown worker error').slice(0, 300);
        console.error('[generate-3d] worker error', { status: response.status, detail });
        throw new Error(`3D worker returned ${response.status}: ${detail}`);
      }

      const modelUrl = data.modelUrl || data.glbUrl || data.url;
      if (!modelUrl) {
        console.error('[generate-3d] worker returned no model URL');
        throw new Error('3D worker returned no GLB model URL.');
      }
      console.log('[generate-3d] model URL received');
      return res.status(200).json({
        available: true,
        modelUrl: `/api/model-proxy?url=${encodeURIComponent(modelUrl)}`,
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
    console.error('[generate-3d] request failed', { name: error.name, message: error.message });
    return res.status(503).json({
      available: false,
      error: error.name === 'AbortError' ? 'timeout' : 'connection',
      message: error.message || '3D generation failed.'
    });
  } finally {
    clearTimeout(timeout);
  }
}

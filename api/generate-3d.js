// EduLabs AI Science Lab — Image-to-3D API bridge
// Vercel stays lightweight; the actual TripoSR inference runs in the configured worker.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }

  const endpoint = process.env.TRIPOSR_ENDPOINT;
  if (!endpoint) {
    return res.status(503).json({
      available: false,
      stage: 'configuration',
      error: 'AI 3D service is not connected',
      message: 'Add TRIPOSR_ENDPOINT in Vercel environment variables to connect the TripoSR worker.'
    });
  }

  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')) {
    return res.status(400).json({
      available: false,
      stage: 'upload',
      error: 'An image upload is required',
      message: 'Please upload a PNG, JPG, or WEBP image.'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const headers = {
      'content-type': contentType,
      'accept': 'application/json',
      'x-edulabs-subject': req.headers['x-edulabs-subject'] || 'general',
      'x-edulabs-topic': req.headers['x-edulabs-topic'] || ''
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: req,
      duplex: 'half',
      signal: controller.signal
    });

    clearTimeout(timeout);

    const workerContentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { modelUrl: text.trim() };
    }

    if (!response.ok) {
      return res.status(502).json({
        available: false,
        stage: 'worker',
        error: data?.error || '3D worker failed',
        message: data?.message || `The 3D worker returned ${response.status}.`
      });
    }

    const modelUrl = data.modelUrl || data.glbUrl || data.outputUrl || data.url || data.model?.url;
    if (!modelUrl) {
      return res.status(502).json({
        available: false,
        stage: 'result',
        error: '3D worker returned no model URL',
        message: 'The image was received, but the worker did not return a usable GLB model.'
      });
    }

    return res.status(200).json({
      available: true,
      modelUrl,
      format: 'glb',
      workerContentType,
      subject: req.headers['x-edulabs-subject'] || 'general'
    });
  } catch (error) {
    clearTimeout(timeout);
    console.error('EduLabs 3D worker error:', error);
    return res.status(503).json({
      available: false,
      stage: error.name === 'AbortError' ? 'timeout' : 'connection',
      error: error.name === 'AbortError' ? 'AI 3D worker timeout' : 'AI 3D worker unreachable',
      message: error.name === 'AbortError' ? 'The 3D worker took too long to respond.' : 'The 3D service could not be reached. Please try again.'
    });
  }
}

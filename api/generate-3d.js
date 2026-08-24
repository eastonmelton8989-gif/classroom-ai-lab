// EduLabs AI Science Lab — asynchronous image-to-3D bridge.
// The local TripoSR computer runs long jobs; this route starts and checks them
// in short requests so hosting time limits never cut generation off.
export const config = { maxDuration: 60 };

async function trustedReferenceDataUrl(value, signal) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'upload.wikimedia.org') {
    throw new Error('The selected reference image is not from an approved source.');
  }
  const response = await fetch(url, { signal });
  const type = String(response.headers.get('content-type') || '').toLowerCase().split(';')[0];
  const length = Number(response.headers.get('content-length') || 0);
  if (!response.ok || !type.startsWith('image/') || length > 7 * 1024 * 1024) {
    throw new Error('The selected reference image could not be prepared.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 7 * 1024 * 1024) throw new Error('The selected reference image is too large.');
  return `data:${type};base64,${bytes.toString('base64')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }

  const endpoint = process.env.TRIPOSR_ENDPOINT;
  const workerToken = process.env.TRIPOSR_TOKEN;
  if (!endpoint) {
    return res.status(503).json({ message: 'The 3D generator is not connected right now.' });
  }

  const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
  const headers = {
    accept: 'application/json',
    ...(workerToken ? { authorization: `Bearer ${workerToken}` } : {})
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    if (jobId) {
      if (!/^[a-f0-9]{32}$/i.test(jobId)) return res.status(400).json({ message: 'Invalid 3D job ID.' });
      const statusUrl = new URL(endpoint);
      statusUrl.pathname = statusUrl.pathname.replace(/\/$/, '') + '/' + jobId;
      statusUrl.search = '';
      console.log('[generate-3d] checking job', { jobId });
      const response = await fetch(statusUrl, { headers, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.message || `3D worker returned ${response.status}`);
      if (data.status === 'complete' && data.modelUrl) {
        return res.status(200).json({
          jobId,
          status: 'complete',
          modelUrl: `/api/model-proxy?url=${encodeURIComponent(data.modelUrl)}`
        });
      }
      return res.status(200).json({
        jobId,
        status: data.status || 'running',
        detail: data.detail || 'Building your 3D model.'
      });
    }

    const imageBase64 = req.body?.imageBase64;
    if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/')) {
      return res.status(400).json({ message: 'An image upload is required.' });
    }

    const referenceImageUrl = typeof req.body?.referenceImageUrl === 'string' ? req.body.referenceImageUrl : '';
    let sourceImage = imageBase64;
    let referenceUsed = false;
    if (referenceImageUrl) {
      try {
        sourceImage = await trustedReferenceDataUrl(referenceImageUrl, controller.signal);
        referenceUsed = true;
      } catch (error) {
        // The student's upload is always a safe fallback if a remote source
        // becomes unavailable or does not meet the image safety checks.
        console.warn('[generate-3d] reference unavailable; using student upload', { message: error.message });
      }
    }

    console.log('[generate-3d] starting local job', { hasImage: true, referenceUsed });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ imageBase64: sourceImage }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.message || `3D worker returned ${response.status}`);
    if (!data.jobId) throw new Error('The 3D generator did not return a job ID.');
    console.log('[generate-3d] job queued', { jobId: data.jobId, referenceUsed });
    return res.status(202).json({
      jobId: data.jobId,
      status: data.status || 'queued',
      referenceUsed,
      referenceTitle: referenceUsed ? String(req.body?.referenceTitle || '').slice(0, 160) : null
    });
  } catch (error) {
    console.error('[generate-3d] request failed', { name: error.name, message: error.message });
    return res.status(503).json({
      message: error.name === 'AbortError'
        ? 'The 3D generator did not respond in time. Please try again.'
        : (error.message || '3D generation failed.')
    });
  } finally {
    clearTimeout(timeout);
  }
}

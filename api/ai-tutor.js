// EduLabs AI tutor bridge: forwards student questions to the owner's local Ollama worker.
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }

  const endpoint = process.env.TRIPOSR_ENDPOINT;
  console.log('[ai-tutor] request started', { hasImage: Boolean(req.body?.imageBase64) });
  const workerToken = process.env.TRIPOSR_TOKEN;
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const imageBase64 = req.body?.imageBase64;

  if (!endpoint) {
    return res.status(503).json({ message: 'The school AI is not connected right now.' });
  }
  if (!prompt) return res.status(400).json({ message: 'Please enter a question.' });
  if (prompt.length > 4000) return res.status(400).json({ message: 'That question is too long.' });
  if (imageBase64 && (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/'))) {
    return res.status(400).json({ message: 'The attached image could not be read.' });
  }

  const workerUrl = new URL(endpoint);
  workerUrl.pathname = '/ai';
  workerUrl.search = '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(workerToken ? { authorization: `Bearer ${workerToken}` } : {})
      },
      body: JSON.stringify({ prompt, ...(imageBase64 ? { imageBase64 } : {}) }),
      signal: controller.signal
    });
    console.log('[ai-tutor] worker responded', { status: response.status });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { detail: raw }; }
    if (!response.ok) {
      const gatewayError = [502, 503, 504].includes(response.status);
      console.error('[ai-tutor] worker error', { status: response.status, detail: data.detail || data.message || 'no detail' });
      return res.status(gatewayError || response.status === 401 ? 503 : response.status).json({
        message: gatewayError
          ? 'The school AI is starting up or taking too long. Please try again in 20 seconds.'
          : (data.detail || data.message || 'The school AI could not answer right now.')
      });
    }
    console.log('[ai-tutor] request completed');
    return res.status(200).json({ answer: data.answer });
  } catch (error) {
    console.error('[ai-tutor] request failed', { name: error.name, message: error.message });
    return res.status(503).json({
      message: error.name === 'AbortError'
        ? 'The school AI took too long. Please try again.'
        : 'The school AI is offline. Make sure the owner computer is on and the AI server is running.'
    });
  } finally {
    clearTimeout(timeout);
  }
}

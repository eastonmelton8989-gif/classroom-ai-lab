export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on Vercel.' });
  try {
    const { image, subject = 'general', topic = '' } = req.body || {};
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'A diagram image is required.' });
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [{ role: 'user', content: [
          { type: 'input_text', text: `Analyze this science diagram for an educational video. Subject: ${subject}. Topic: ${topic || 'not specified'}. Identify the major objects, labels, relationships, process direction, and the most important scientific idea. Return a concise production description for a video generator. Do not invent labels that are not visible.` },
          { type: 'input_image', image_url: image, detail: 'high' }
        ] }]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Diagram analysis failed.' });
    return res.status(200).json({ analysis: data.output_text || '' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Diagram analysis failed.' });
  }
}

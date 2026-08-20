// EduLabs AI Science Lab - Image to 3D API
//
// This endpoint connects the website to a self-hosted open-source
// image-to-3D worker. Set TRIPOSR_ENDPOINT in Vercel environment variables.
// The worker should accept multipart form data with an image and return:
// { modelUrl: "https://.../model.glb" }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST required' });
  }

  if (!process.env.TRIPOSR_ENDPOINT) {
    return res.status(503).json({
      error: '3D AI worker is not connected yet',
      setup: 'Add TRIPOSR_ENDPOINT to your Vercel environment variables.'
    });
  }

  try {
    const response = await fetch(process.env.TRIPOSR_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'] || ''
      },
      body: req
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({
      error: '3D generation failed',
      details: error.message
    });
  }
}

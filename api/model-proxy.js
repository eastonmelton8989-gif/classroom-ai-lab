export default async function handler(req, res) {
  const value = typeof req.query.url === 'string' ? req.query.url : '';
  const configuredEndpoint = process.env.TRIPOSR_ENDPOINT;

  if (!value || !configuredEndpoint) {
    return res.status(400).json({ error: 'A configured model URL is required.' });
  }

  let modelUrl;
  let workerUrl;
  try {
    modelUrl = new URL(value);
    workerUrl = new URL(configuredEndpoint);
  } catch {
    return res.status(400).json({ error: 'Invalid model URL.' });
  }

  const isLocalGeneratedModel = modelUrl.origin === workerUrl.origin && modelUrl.pathname.startsWith('/models/');
  const isSmithsonianOpenModel = modelUrl.origin === 'https://3d-api.si.edu' && modelUrl.pathname.startsWith('/content/document/');
  if (!isLocalGeneratedModel && !isSmithsonianOpenModel) {
    return res.status(403).json({ error: 'This model URL is not allowed.' });
  }

  try {
    const response = await fetch(modelUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'The generated model is unavailable.' });
    }

    const model = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Length', model.length);
    res.setHeader('Cache-Control', isSmithsonianOpenModel ? 'public, s-maxage=86400' : 'no-store');
    return res.status(200).send(model);
  } catch {
    return res.status(502).json({ error: 'Could not retrieve the generated model.' });
  }
}

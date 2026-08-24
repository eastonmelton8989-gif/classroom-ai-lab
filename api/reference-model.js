// Finds openly reusable Smithsonian GLB models for a precise science topic.
export default async function handler(req, res) {
  const query = String(req.query?.q || '').trim();
  if (!query || query.length > 120) return res.status(400).json({ message: 'Enter a short science topic first.' });

  const url = new URL('https://3d-api.si.edu/api/v1.0/content/file/search');
  url.search = new URLSearchParams({
    q: query,
    file_type: 'glb',
    gltf_orientation_compliant: 'true',
    rows: '4'
  }).toString();

  try {
    const response = await fetch(url, { headers: { 'user-agent': 'EduLabsAI-school-3d-search/1.0' } });
    if (!response.ok) throw new Error('Model search is unavailable.');
    const data = await response.json();
    const model = (data.rows || []).map(row => ({
      title: String(row.title || ''),
      modelUrl: row.content?.uri,
      sourceId: String(row.url || '')
    })).find(item => typeof item.modelUrl === 'string' && item.modelUrl.startsWith('https://3d-api.si.edu/'));
    if (!model) return res.status(200).json({ model: null });
    return res.status(200).json({
      model: {
        title: model.title,
        modelUrl: model.modelUrl,
        sourceUrl: model.sourceId ? 'https://3d-api.si.edu/voyager/' + encodeURIComponent(model.sourceId) : 'https://3d.si.edu/',
        license: 'Smithsonian Open Access'
      }
    });
  } catch (error) {
    console.error('[reference-model] search failed', { message: error.message });
    return res.status(503).json({ message: 'Reference model search is unavailable.' });
  }
}

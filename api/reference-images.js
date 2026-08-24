// Free, credited science reference-image search using Wikimedia Commons.
export default async function handler(req, res) {
  const query = String(req.query?.q || '').trim();
  if (!query || query.length > 120) {
    return res.status(400).json({ message: 'Enter a short science topic first.' });
  }

  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '640',
    format: 'json',
    formatversion: '2'
  }).toString();

  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'EduLabsAI-school-reference-search/1.0' }
    });
    if (!response.ok) throw new Error('Reference search is unavailable.');
    const data = await response.json();
    const items = (data.query?.pages || [])
      .map(page => {
        const info = page.imageinfo?.[0] || {};
        const meta = info.extmetadata || {};
        const imageUrl = info.thumburl || info.url;
        if (!imageUrl || !/^https:\/\/upload\.wikimedia\.org\//.test(imageUrl)) return null;
        return {
          title: String(page.title || '').replace(/^File:/, ''),
          imageUrl,
          sourceUrl: info.descriptionurl || 'https://commons.wikimedia.org/',
          license: meta.LicenseShortName?.value || 'See source'
        };
      })
      .filter(Boolean)
      .slice(0, 4);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ items });
  } catch (error) {
    console.error('[reference-images] search failed', { message: error.message });
    return res.status(503).json({ message: 'Reference images are unavailable right now.' });
  }
}

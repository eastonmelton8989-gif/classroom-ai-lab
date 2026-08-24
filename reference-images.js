(() => {
  const button = document.getElementById('findReferences');
  const topic = document.getElementById('topic');
  const subject = document.getElementById('subject');
  const grid = document.getElementById('referenceGrid');
  const status = document.getElementById('referenceStatus');
  if (!button || !grid || !status) return;

  function setStatus(message) { status.textContent = message; }

  function query() {
    return topic?.value.trim() || subject?.options?.[subject.selectedIndex]?.text || '';
  }

  function showItems(items) {
    grid.replaceChildren();
    items.forEach(item => {
      const link = document.createElement('a');
      link.className = 'reference-card';
      link.href = item.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = 'Open the credited Wikimedia Commons source';
      const image = document.createElement('img');
      image.src = item.imageUrl;
      image.alt = 'Reference image: ' + item.title;
      image.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = item.title + ' · ' + item.license;
      link.append(image, label);
      grid.append(link);
    });
  }

  button.addEventListener('click', async () => {
    const text = query();
    if (!text) {
      setStatus('Type a science topic above first.');
      return;
    }
    button.disabled = true;
    grid.replaceChildren();
    setStatus('Finding free, credited reference images…');
    try {
      const response = await fetch('/api/reference-images?q=' + encodeURIComponent(text));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Reference search is unavailable.');
      if (!data.items?.length) {
        setStatus('No reusable reference images were found. Try a more specific topic.');
        return;
      }
      window.eduLabsReferenceContext = data.items.map(item => item.title).join(', ');
      showItems(data.items);
      setStatus('Showing reusable references from Wikimedia Commons. Open any picture to see its source and license.');
    } catch (error) {
      setStatus(error.message || 'Reference search is unavailable right now.');
    } finally {
      button.disabled = false;
    }
  });
})();

(() => {
  const style = document.createElement('style');
  style.textContent = `.octopus-launch{position:fixed;right:22px;bottom:22px;z-index:50;border:0;border-radius:999px;padding:13px 17px;background:#7c3aed;color:#fff;font:700 15px system-ui;box-shadow:0 12px 30px #0008;cursor:pointer}.octopus-panel{position:fixed;right:22px;bottom:78px;z-index:51;width:min(390px,calc(100vw - 32px));border:1px solid #5b21b6;border-radius:18px;background:#07152f;color:#eff6ff;box-shadow:0 20px 55px #000b;padding:16px}.octopus-panel[hidden]{display:none}.octopus-top{display:flex;justify-content:space-between;align-items:center;gap:12px}.octopus-top b{font-size:18px}.octopus-close{border:0;background:transparent;color:#c4b5fd;font-size:22px;cursor:pointer}.octopus-answer{min-height:76px;max-height:230px;overflow-y:auto;overscroll-behavior:contain;margin:12px 0;padding:12px;border-radius:11px;background:#0f2145;color:#dbeafe;white-space:pre-wrap;line-height:1.45;scrollbar-width:thin;scrollbar-color:#a78bfa #0b1d42}.octopus-answer::-webkit-scrollbar{width:10px}.octopus-answer::-webkit-scrollbar-track{background:#0b1d42;border-radius:999px}.octopus-answer::-webkit-scrollbar-thumb{background:#a78bfa;border-radius:999px;border:2px solid #0b1d42}.octopus-form{display:flex;gap:8px}.octopus-form input{min-width:0;flex:1;border:1px solid #365889;border-radius:10px;padding:10px;background:#020817;color:#fff}.octopus-form button{border:0;border-radius:10px;padding:10px 12px;background:#7c3aed;color:#fff;font-weight:700;cursor:pointer}.octopus-form button:disabled{opacity:.65;cursor:wait}.octopus-prompts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.octopus-prompts button{border:1px solid #365889;border-radius:999px;padding:6px 9px;background:#0b1d42;color:#cbd5e1;font-size:12px;cursor:pointer}`;
  document.head.append(style);
  const root = document.createElement('div');
  root.innerHTML = `<button class="octopus-launch" type="button" aria-expanded="false" aria-controls="octopusPanel">🐙 Ask Octopus</button><section class="octopus-panel" id="octopusPanel" hidden aria-label="Octopus science helper"><div class="octopus-top"><b>🐙 Octopus Helper</b><button class="octopus-close" type="button" aria-label="Close Octopus Helper">×</button></div><div class="octopus-answer" aria-live="polite">Hi! I can look at your uploaded science image and answer questions about it.</div><form class="octopus-form"><input aria-label="Ask Octopus a question" placeholder="Ask about this lesson or picture…"><button>Ask</button></form><div class="octopus-prompts"><button type="button" data-q="Explain this image simply.">Explain image</button><button type="button" data-q="What are the most important parts to notice?">Important parts</button><button type="button" data-q="Quiz me with one question about this lesson.">Quiz me</button></div></section>`;
  document.body.append(root);
  const launch = root.querySelector('.octopus-launch'), panel = root.querySelector('.octopus-panel'), close = root.querySelector('.octopus-close'), form = root.querySelector('form'), input = root.querySelector('input'), answer = root.querySelector('.octopus-answer'), submit = form.querySelector('button');

  function context() {
    const subject = document.getElementById('subject');
    const topic = document.getElementById('topic');
    return {
      subject: subject?.options?.[subject.selectedIndex]?.text || 'science',
      topic: topic?.value?.trim() || '',
      imageBase64: window.eduLabsLessonImage || null
    };
  }
  async function ask(question) {
    const c = context();
    const prompt = `A student is studying ${c.topic || c.subject}. ${question} Give a helpful, accurate answer in plain language. If an image is attached, use it as evidence and do not claim to see details that are not visible.`;
    answer.textContent = 'Octopus is thinking…';
    submit.disabled = true;
    try {
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, ...(c.imageBase64 ? { imageBase64: c.imageBase64 } : {}) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Octopus could not answer right now.');
      answer.textContent = data.answer || 'I could not make an answer from that yet.';
    } catch (error) {
      answer.textContent = error.message || 'Octopus is unavailable right now.';
    } finally {
      submit.disabled = false;
    }
  }
  function open() { panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); input.focus(); }
  function hide() { panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); launch.focus(); }
  launch.addEventListener('click', () => panel.hidden ? open() : hide());
  close.addEventListener('click', hide);
  form.addEventListener('submit', event => { event.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; ask(q); });
  root.querySelectorAll('[data-q]').forEach(button => button.addEventListener('click', () => ask(button.dataset.q)));
})();
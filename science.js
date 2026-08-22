(() => {
  const canvas = document.getElementById('lessonCanvas');
  const file = document.getElementById('file');
  const drop = document.getElementById('drop');
  const subject = document.getElementById('subject');
  const topic = document.getElementById('topic');
  const play = document.getElementById('lessonPlay');
  const back = document.getElementById('lessonBack');
  const forward = document.getElementById('lessonForward');
  const seek = document.getElementById('lessonSeek');
  const time = document.getElementById('lessonTime');
  const caption = document.getElementById('lessonCaption');
  if (!canvas || !file || !play || !seek) return;

  let image = null, sourceUrl = null, isPlaying = false, position = 0, lastFrame = 0, frame = 0;
  const duration = 60;
  const lessonBanks = {
    general: ['Introduce the science diagram and the question it explores.', 'Identify the important objects, labels, arrows, and relationships.', 'Focus on the first major part and explain its job.', 'Trace the process or relationship shown in the diagram.', 'Connect the parts and explain how the system works.', 'Review the whole system and its key scientific idea.'],
    biology: ['Introduce this biological system and its purpose.', 'Identify the major structures, organisms, tissues, or cells.', 'Explain how each important structure contributes.', 'Trace the biological pathway or process.', 'Connect structure to function and outcome.', 'Review how the biological system works.'],
    chemistry: ['Introduce the chemical system and its conditions.', 'Identify atoms, molecules, bonds, labels, and equipment.', 'Explain the starting substances and their arrangement.', 'Trace the reaction or chemical transformation.', 'Explain what changed and what was produced.', 'Review the chemistry from start to finish.'],
    physics: ['Introduce the physical system and quantity being demonstrated.', 'Identify objects, forces, fields, waves, and components.', 'Explain the starting state and important variables.', 'Trace motion, energy, force, or signal flow.', 'Connect changes to the governing physical principle.', 'Review the system and summarize the physics.']
  };
  function steps() {
    const bank = lessonBanks[subject?.value] || lessonBanks.general;
    const output = [...bank];
    if (topic?.value?.trim()) output[0] = 'Introduce ' + topic.value.trim() + ' and orient the viewer to the diagram.';
    return output;
  }
  function format(seconds) {
    const value = Math.max(0, Math.min(duration, seconds));
    return Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(), scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    return { w: rect.width, h: rect.height, scale };
  }
  function draw() {
    const { w, h, scale } = resize();
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#020817'; ctx.fillRect(0, 0, w, h);
    if (!image) return;
    const progress = position / duration, lessonSteps = steps();
    const imageScale = Math.min((w - 48) / image.width, (h - 165) / image.height);
    const iw = image.width * imageScale, ih = image.height * imageScale;
    ctx.save();
    ctx.translate(w / 2, h / 2 - 45);
    ctx.scale(1 + Math.sin(position * .7) * .015, 1 + Math.sin(position * .7) * .015);
    ctx.translate(-iw / 2, -ih / 2);
    ctx.shadowColor = 'rgba(56,189,248,.4)'; ctx.shadowBlur = 26; ctx.drawImage(image, 0, 0, iw, ih); ctx.restore();
    ctx.fillStyle = 'rgba(2,8,23,.94)'; ctx.fillRect(0, h - 125, w, 125);
    const index = Math.min(lessonSteps.length - 1, Math.floor(progress * lessonSteps.length));
    const label = subject?.options?.[subject.selectedIndex]?.text || 'General Science';
    ctx.fillStyle = '#7dd3fc'; ctx.font = '700 14px Arial'; ctx.fillText(label + ' · Animated lesson', 24, h - 92);
    ctx.fillStyle = '#fff'; ctx.font = '700 20px Arial'; ctx.fillText('Step ' + (index + 1) + '/' + lessonSteps.length, 24, h - 60);
    ctx.font = '500 16px Arial'; ctx.fillText(lessonSteps[index].slice(0, 90), 150, h - 60);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(24, h - 27, w - 48, 7);
    ctx.fillStyle = '#38bdf8'; ctx.fillRect(24, h - 27, (w - 48) * progress, 7);
    caption.textContent = lessonSteps[index];
  }
  function updateUi() {
    seek.value = Math.round(position / duration * 1000);
    time.textContent = format(position) + ' / ' + format(duration);
    play.textContent = isPlaying ? '❚❚ Pause' : '▶ Play';
    play.setAttribute('aria-label', isPlaying ? 'Pause lesson' : 'Play lesson');
  }
  function render() { draw(); updateUi(); }
  function tick(now) {
    if (!isPlaying) return;
    if (lastFrame) position += (now - lastFrame) / 1000;
    lastFrame = now;
    if (position >= duration) { position = duration; isPlaying = false; lastFrame = 0; }
    render();
    if (isPlaying) frame = requestAnimationFrame(tick);
  }
  function setPlaying(value) {
    if (!image) { caption.textContent = 'Upload a science image before starting the lesson.'; return; }
    if (position >= duration) position = 0;
    isPlaying = value; lastFrame = 0;
    if (isPlaying) { cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); }
    render();
  }
  function loadImage(selected) {
    if (!selected || !selected.type.startsWith('image/')) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(selected);
    image = new Image();
    image.onload = () => { position = 0; isPlaying = false; caption.textContent = 'Lesson ready. Press Play or drag the progress bar to explore.'; render(); };
    image.src = sourceUrl;
  }
  file.addEventListener('change', event => loadImage(event.target.files[0]));
  drop?.addEventListener('drop', event => { const selected = event.dataTransfer?.files?.[0]; if (selected) loadImage(selected); });
  play.addEventListener('click', () => setPlaying(!isPlaying));
  back.addEventListener('click', () => { position = Math.max(0, position - 10); render(); });
  forward.addEventListener('click', () => { position = Math.min(duration, position + 10); render(); });
  seek.addEventListener('input', () => { position = Number(seek.value) / 1000 * duration; render(); });
  window.addEventListener('resize', render);
  render();
})();
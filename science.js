(() => {
  const canvas = document.getElementById('lessonCanvas');
  const file = document.getElementById('file');
  const drop = document.getElementById('drop');
  const subject = document.getElementById('subject');
  const topic = document.getElementById('topic');
  const parts = document.getElementById('parts');
  const play = document.getElementById('lessonPlay');
  const back = document.getElementById('lessonBack');
  const forward = document.getElementById('lessonForward');
  const seek = document.getElementById('lessonSeek');
  const time = document.getElementById('lessonTime');
  const caption = document.getElementById('lessonCaption');
  if (!canvas || !file || !play || !seek) return;

  let image = null, sourceUrl = null, isPlaying = false, position = 0, lastFrame = 0, frame = 0, announcedStep = -1;
  const duration = 60;
  const lessonBanks = {
    general: ['Introduce the science diagram and the question it explores.', 'Identify the important objects, labels, arrows, and relationships.', 'Focus on the first major part and explain its job.', 'Trace the process or relationship shown in the diagram.', 'Connect the parts and explain how the system works.', 'Review the whole system and its key scientific idea.'],
    biology: ['Introduce this biological system and its purpose.', 'Identify the major structures, organisms, tissues, or cells.', 'Explain how each important structure contributes.', 'Trace the biological pathway or process.', 'Connect structure to function and outcome.', 'Review how the biological system works.'],
    chemistry: ['Introduce the chemical system and its conditions.', 'Identify atoms, molecules, bonds, labels, and equipment.', 'Explain the starting substances and their arrangement.', 'Trace the reaction or chemical transformation.', 'Explain what changed and what was produced.', 'Review the chemistry from start to finish.'],
    physics: ['Introduce the physical system and quantity being demonstrated.', 'Identify objects, forces, fields, waves, and components.', 'Explain the starting state and important variables.', 'Trace motion, energy, force, or signal flow.', 'Connect changes to the governing physical principle.', 'Review the system and summarize the physics.']
  };
  const partFacts = {
    nucleus: 'The nucleus acts like the cell’s information center. It stores genetic instructions and helps direct many of the cell’s everyday activities.',
    membrane: 'The cell membrane is a selective boundary. It helps control what enters and leaves the cell, protecting the cell while allowing needed materials through.',
    mitochondria: 'Mitochondria release usable energy from food molecules. Cells with high energy needs often contain many mitochondria.',
    chloroplast: 'Chloroplasts capture light energy. In plant cells, they use that energy to help make sugars through photosynthesis.',
    ribosome: 'Ribosomes assemble proteins. Proteins are used to build structures, carry messages, and support many chemical reactions.',
    cell wall: 'The cell wall gives a plant cell extra strength and shape. It sits outside the cell membrane.',
    atom: 'An atom has a tiny dense nucleus surrounded by electrons. The number and arrangement of its particles help determine its properties.',
    heart: 'The heart is a muscular pump. Its chambers and valves work together to keep blood moving in one direction.'
  };
  function steps() {
    const bank = lessonBanks[subject?.value] || lessonBanks.general;
    const focus = topic?.value?.trim() || cSubject();
    const output = bank.map((line, index) => {
      const openings = ['Let’s begin by getting oriented.', 'Now slow down and look carefully.', 'Here is the important part.', 'Next, follow the change or movement.', 'Now connect the evidence.', 'To finish, bring the whole idea together.'];
      return openings[index] + ' ' + line + ' Think about how this relates to ' + focus + '.';
    });
    output[0] = 'Welcome. We are exploring ' + focus + '. Start with the largest shapes and labels. Before memorizing names, notice how the parts are arranged and what appears to move, change, or connect.';
    const namedParts = (parts?.value || '').split(',').map(value => value.trim()).filter(Boolean);
    if (namedParts.length) {
      namedParts.slice(0, 4).forEach((part, index) => {
        const fact = partFacts[part.toLowerCase()] || ('Locate ' + part + '. Notice its position, shape, and connections to nearby structures. Those clues help explain its job in ' + focus + '.');
        output[Math.min(index + 1, output.length - 2)] = 'Let’s focus on ' + part + '. ' + fact + ' In the model, rotate and zoom in so you can see how it relates to the surrounding parts.';
      });
    }
    output[output.length - 1] = 'Let’s review ' + focus + '. The key is not just naming the parts. Explain how each part contributes to the larger system or process, then use the model to check that story one more time.';
    return output;
  }
  function cSubject() { return subject?.options?.[subject.selectedIndex]?.text || 'this science system'; }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(voice => /^en-US/i.test(voice.lang) && /natural|aria|jenny|zira|samantha/i.test(voice.name))
      || voices.find(voice => /^en/i.test(voice.lang));
    if (preferred) message.voice = preferred;
    message.rate = 0.84;
    message.pitch = 0.96;
    window.speechSynthesis.speak(message);
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
    if (isPlaying && index !== announcedStep) {
      announcedStep = index;
      speak(lessonSteps[index]);
    }
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
    if (!isPlaying) window.speechSynthesis?.cancel();
    if (isPlaying) { cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); }
    render();
  }
  function loadImage(selected) {
    if (!selected || !selected.type.startsWith('image/')) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(selected);
    image = new Image();
    image.onload = () => { position = 0; isPlaying = false; announcedStep = -1; caption.textContent = 'Lesson ready. Press Play or drag the progress bar to explore.'; render(); };
    image.src = sourceUrl;
  }
  function selectImage(selected) {
    if (!selected || !selected.type.startsWith('image/')) {
      caption.textContent = 'Please choose a PNG, JPG, WEBP, or another image file.';
      return;
    }
    loadImage(selected);
  }
  file.addEventListener('change', event => selectImage(event.target.files[0]));
  drop?.addEventListener('click', () => file.click());
  drop?.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('active'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('active'));
  drop?.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('active'); selectImage(event.dataTransfer?.files?.[0]); });
  play.addEventListener('click', () => setPlaying(!isPlaying));
  back.addEventListener('click', () => { position = Math.max(0, position - 10); render(); });
  forward.addEventListener('click', () => { position = Math.min(duration, position + 10); render(); });
  seek.addEventListener('input', () => { position = Number(seek.value) / 1000 * duration; render(); });
  window.addEventListener('resize', render);
  render();
})();
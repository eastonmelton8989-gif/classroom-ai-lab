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
  const zoomIn = document.getElementById('imageZoomIn');
  const zoomOut = document.getElementById('imageZoomOut');
  const zoomReset = document.getElementById('imageZoomReset');
  const zoomReadout = document.getElementById('imageZoomReadout');
  const lessonLoading = document.getElementById('lessonLoading');
  const lessonLoadingFill = document.getElementById('lessonLoadingFill');
  const lessonLoadingTitle = document.getElementById('lessonLoadingTitle');
  const lessonLoadingPercent = document.getElementById('lessonLoadingPercent');
  const lessonLoadingDetail = document.getElementById('lessonLoadingDetail');
  const imageSelected = document.getElementById('imageSelected');
  const lessonPlayer = document.querySelector('.lesson-player');
  if (!canvas || !file || !play || !seek) return;

  let image = null, sourceUrl = null, isPlaying = false, position = 0, lastFrame = 0, frame = 0, announcedStep = -1;
  let zoom = 1, panX = 0, panY = 0, dragging = false, pointerX = 0, pointerY = 0;
  let analysis = null, analysisInProgress = false, classifier = null, aiLesson = null, imageDataPromise = null;
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
    'cell wall': 'The cell wall gives a plant cell extra strength and shape. It sits outside the cell membrane.',
    atom: 'An atom has a tiny dense nucleus surrounded by electrons. The number and arrangement of its particles help determine its properties.',
    heart: 'The heart is a muscular pump. Its chambers and valves work together to keep blood moving in one direction.'
  };

  function cSubject() { return subject?.options?.[subject.selectedIndex]?.text || 'this science system'; }
  function setLessonLoading(value, title, detail) {
    lessonLoading?.classList.add('show');
    if (lessonLoadingFill) lessonLoadingFill.style.width = Math.max(0, Math.min(100, value)) + '%';
    if (lessonLoadingPercent) lessonLoadingPercent.textContent = Math.round(value) + '%';
    if (lessonLoadingTitle) lessonLoadingTitle.textContent = title;
    if (lessonLoadingDetail) lessonLoadingDetail.textContent = detail;
  }
  function imageClue() {
    if (analysisInProgress) return 'I am still looking at the uploaded picture, so give me one moment before pressing Play.';
    if (!analysis?.labels?.length) return 'I can see the uploaded picture. If you tell me the topic or key parts, I can make the explanation even more specific.';
    return 'My image scan notices ' + analysis.labels.join(', ') + '. I will use that visual clue alongside your science topic, but you should always compare it with the labels in the picture.';
  }
  function steps() {
    const bank = lessonBanks[subject?.value] || lessonBanks.general;
    const focus = topic?.value?.trim() || cSubject();
    if (Array.isArray(aiLesson) && aiLesson.length) return aiLesson;
    const output = bank.map((line, index) => {
      const openings = ['Let’s begin by getting oriented.', 'Now, let’s slow down and look closely.', 'This is the part worth pausing on.', 'Next, watch how the action moves through the picture.', 'Here is where the pieces start to connect.', 'Let’s bring the idea together.'];
      return openings[index] + ' ' + line + ' Keep ' + focus + ' in mind as you look at the image.';
    });
    output[0] = 'Hey, welcome in. We are looking at ' + focus + '. ' + imageClue() + ' Start with the biggest shapes, arrows, and labels. Do not rush to memorize names yet; first notice what is connected to what.';
    const namedParts = (parts?.value || '').split(',').map(value => value.trim()).filter(Boolean);
    if (namedParts.length) {
      namedParts.slice(0, 4).forEach((part, index) => {
        const fact = partFacts[part.toLowerCase()] || ('Find ' + part + ' in the picture. Look at its shape, where it sits, and what it touches. Those details are usually the best clue to its role in ' + focus + '.');
        output[Math.min(index + 1, output.length - 2)] = 'Let’s zoom in on ' + part + '. ' + fact + ' Take a second to connect that explanation to what you can actually see around it.';
      });
    }
    output[output.length - 1] = 'Here is the takeaway for ' + focus + ': the point is not only to name each part. The important part is explaining how the parts work together. Use the zoom controls to revisit anything that was hard to see, and replay a section whenever you need it.';
    return output;
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const gentleVoice = voices
      .filter(voice => /^en/i.test(voice.lang))
      .sort((a, b) => {
        const score = voice => /natural|neural|online|aria|jenny|sonia|libby|samantha|zira|ava/i.test(voice.name) ? 1 : 0;
        return score(b) - score(a);
      })[0];
    if (gentleVoice) message.voice = gentleVoice;
    message.rate = 0.80;
    message.pitch = 0.92;
    message.volume = 0.78;
    window.speechSynthesis.speak(message);
  }
  function normalizeAiLesson(answer) {
    const raw = String(answer || '').trim();
    if (!raw) return null;
    const candidates = [raw, raw.match(/\[[\s\S]*\]/)?.[0]].filter(Boolean);
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate.replace(/^\`\`\`json\s*|\s*\`\`\`$/gi, ''));
        const items = Array.isArray(parsed) ? parsed : (parsed.lesson || parsed.segments || parsed.steps);
        if (Array.isArray(items)) {
          const cleaned = items.map(item => typeof item === 'string' ? item : (item.text || item.explanation || item.content || '')).map(item => String(item).trim()).filter(Boolean);
          if (cleaned.length >= 3) return cleaned.slice(0, 5);
        }
      } catch (_) { /* Plain-language answers are handled below. */ }
    }
    const lines = raw.split(/\n+/).map(line => line.replace(/^\s*(?:\d+[.)]|[-•])\s*/, '').trim()).filter(line => line.length > 18);
    if (lines.length >= 3) return lines.slice(0, 5);
    const sentences = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(value => value.trim()).filter(Boolean) || [];
    if (sentences.length < 3) return null;
    const groups = Array.from({ length: Math.min(5, sentences.length) }, () => []);
    sentences.forEach((sentence, index) => groups[Math.min(groups.length - 1, Math.floor(index * groups.length / sentences.length))].push(sentence));
    return groups.map(group => group.join(' ')).filter(Boolean);
  }
  async function analyzeImage() {
    if (!sourceUrl || analysisInProgress) return;
    analysisInProgress = true;
    analysis = null;
    aiLesson = null;
    setLessonLoading(45, 'Analyzing picture…', 'The school AI is studying your image and building a lesson.');
    caption.textContent = 'The school AI is studying your image…';
    render();
    const focus = topic?.value?.trim() || cSubject();
    const typedParts = (parts?.value || '').trim();
    const placedLabels = Array.isArray(window.eduLabsModelLabels) ? window.eduLabsModelLabels.join(', ') : '';
    const namedParts = [typedParts, placedLabels].filter(Boolean).join(', ') || 'any important visible parts';
    const referenceContext = String(window.eduLabsReferenceContext || '').slice(0, 500);
    const imageBase64 = await imageDataPromise;
    try {
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          prompt: 'Study this science image for a student learning ' + focus + '. '
            + 'Focus on ' + namedParts + '. Create exactly 5 detailed, friendly lesson segments. '
            + 'Read visible labels carefully; if a word is blurred or too small to read, say that it is unclear instead of guessing. '
            + 'Each segment must explain what is visibly present and its scientific meaning. Never invent labels that cannot be seen. '
            + (referenceContext ? 'The student also chose reusable reference pictures titled: ' + referenceContext + '. Mention them only as comparison material, never as proof of hidden details in the uploaded image. ' : '')
            + 'Reply as a JSON array of five strings when possible, but a numbered five-part answer is also acceptable.'
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'The school AI could not read the image.');
      aiLesson = normalizeAiLesson(data.answer);
      if (!aiLesson || aiLesson.length < 3) throw new Error('The school AI returned an incomplete lesson.');
      analysis = { labels: ['a custom image-based lesson'] };
      setLessonLoading(100, 'Lesson ready!', 'The AI finished analyzing your picture. Press Play to begin.');
      caption.textContent = 'Image analyzed. Your custom lesson is ready — press Play.';
    } catch (localError) {
      console.warn('Local school AI unavailable, using browser image scan:', localError);
      setLessonLoading(60, 'Finishing picture scan…', 'Using the built-in fallback image scan.');
      try {
        const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        classifier ||= await transformers.pipeline('image-classification', 'Xenova/vit-base-patch16-224');
        const results = await classifier(sourceUrl, { topk: 3 });
        const labels = results.map(item => String(item.label || '').replace(/_/g, ' ')).filter(Boolean);
        analysis = { labels };
        setLessonLoading(100, 'Lesson ready!', 'Picture scan finished. Press Play to hear the explanation.');
        caption.textContent = labels.length ? 'Image analyzed: I noticed ' + labels.join(', ') + '. Press Play for the detailed lesson.' : 'Image scan finished. Press Play for the detailed lesson.';
      } catch (error) {
        console.warn('Image analysis unavailable:', error);
        setLessonLoading(100, 'Lesson ready!', 'Your picture is loaded. Add a topic or key parts for a more specific explanation.');
        caption.textContent = 'Your picture is ready. Add a topic or key parts for a more specific explanation.';
      }
    } finally {
      analysisInProgress = false;
      render();
    }
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
  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' '); let line = '', lines = [];
    words.forEach(word => {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
    });
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  }
  function draw() {
    const { w, h, scale } = resize();
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#020817'; ctx.fillRect(0, 0, w, h);
    if (!image) return;
    const progress = position / duration, lessonSteps = steps();
    const baseScale = Math.min((w - 48) / image.width, (h - 165) / image.height);
    const imageScale = baseScale * zoom;
    const iw = image.width * imageScale, ih = image.height * imageScale;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h - 125); ctx.clip();
    ctx.translate(w / 2 + panX, h / 2 - 45 + panY);
    ctx.scale(1 + Math.sin(position * .7) * .008, 1 + Math.sin(position * .7) * .008);
    ctx.translate(-iw / 2, -ih / 2);
    ctx.shadowColor = 'rgba(56,189,248,.4)'; ctx.shadowBlur = 26; ctx.drawImage(image, 0, 0, iw, ih); ctx.restore();
    ctx.fillStyle = 'rgba(2,8,23,.94)'; ctx.fillRect(0, h - 125, w, 125);
    const index = Math.min(lessonSteps.length - 1, Math.floor(progress * lessonSteps.length));
    const label = subject?.options?.[subject.selectedIndex]?.text || 'General Science';
    ctx.fillStyle = '#7dd3fc'; ctx.font = '700 14px Arial'; ctx.fillText(label + ' · Image-guided lesson', 24, h - 92);
    ctx.fillStyle = '#fff'; ctx.font = '700 19px Arial'; ctx.fillText('Step ' + (index + 1) + '/' + lessonSteps.length, 24, h - 63);
    ctx.font = '500 15px Arial'; drawWrappedText(ctx, lessonSteps[index], 150, h - 75, w - 174, 20);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(24, h - 27, w - 48, 7);
    ctx.fillStyle = '#38bdf8'; ctx.fillRect(24, h - 27, (w - 48) * progress, 7);
    caption.textContent = lessonSteps[index];
    if (zoomReadout) zoomReadout.textContent = Math.round(zoom * 100) + '%';
    if (isPlaying && index !== announcedStep) { announcedStep = index; speak(lessonSteps[index]); }
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
  function resetZoom() { zoom = 1; panX = 0; panY = 0; render(); }
  function adjustZoom(change) { zoom = Math.max(.75, Math.min(3, +(zoom + change).toFixed(2))); render(); }
  function loadImage(selected) {
    if (!selected || !selected.type.startsWith('image/')) return;
    if (imageSelected) imageSelected.textContent = 'Picture selected: ' + selected.name + '. Loading your animated lesson now…';
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    imageDataPromise = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { window.eduLabsLessonImage = reader.result; resolve(reader.result); };
      reader.onerror = () => reject(new Error('The image could not be read.'));
      reader.readAsDataURL(selected);
    });
    sourceUrl = URL.createObjectURL(selected);
    image = new Image();
    image.onload = () => {
      position = 0; isPlaying = false; announcedStep = -1; resetZoom();
      setLessonLoading(20, 'Picture received!', 'Preparing the animated lesson from your image…');
      caption.textContent = 'Picture loaded. The free AI is now looking at it.';
      if (imageSelected) imageSelected.textContent = 'Picture loaded: ' + selected.name + '. The animated lesson is ready below.';
      render();
      lessonPlayer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      analyzeImage();
    };
    image.src = sourceUrl;
  }
  async function enhanceImage(selected) {
    if (!window.createImageBitmap) return selected;
    const bitmap = await createImageBitmap(selected);
    const longest = Math.max(bitmap.width, bitmap.height);
    // Improve visibility for small or hazy classroom images. This can sharpen
    // edges and contrast, but cannot recreate text that was never captured.
    const scale = Math.min(2, Math.max(1, 1600 / longest));
    const enhanced = document.createElement('canvas');
    enhanced.width = Math.round(bitmap.width * scale);
    enhanced.height = Math.round(bitmap.height * scale);
    const context = enhanced.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.filter = 'contrast(1.2) brightness(1.04) saturate(1.08)';
    context.drawImage(bitmap, 0, 0, enhanced.width, enhanced.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => enhanced.toBlob(resolve, 'image/jpeg', 0.94));
    return blob ? new File([blob], selected.name.replace(/\.[^.]+$/, '') + '-enhanced.jpg', { type: 'image/jpeg' }) : selected;
  }
  async function selectImage(selected) {
    if (!selected || !selected.type.startsWith('image/')) { caption.textContent = 'Please choose a PNG, JPG, WEBP, or another image file.'; return; }
    try {
      setLessonLoading(5, 'Enhancing picture…', 'Improving contrast and clarity before the AI analyzes it.');
      if (imageSelected) imageSelected.textContent = 'Picture selected: ' + selected.name + '. Improving visibility…';
      loadImage(await enhanceImage(selected));
    } catch (error) {
      console.warn('Image enhancement unavailable:', error);
      loadImage(selected);
    }
  }
  const pickSelectedImage = event => selectImage(event.target.files?.[0]);
  file.addEventListener('change', pickSelectedImage);
  file.addEventListener('input', pickSelectedImage);
  drop?.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('active'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('active'));
  drop?.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('active'); selectImage(event.dataTransfer?.files?.[0]); });
  play.addEventListener('click', () => setPlaying(!isPlaying));
  back.addEventListener('click', () => { position = Math.max(0, position - 10); render(); });
  forward.addEventListener('click', () => { position = Math.min(duration, position + 10); render(); });
  seek.addEventListener('input', () => { position = Number(seek.value) / 1000 * duration; render(); });
  zoomIn?.addEventListener('click', () => adjustZoom(.25));
  zoomOut?.addEventListener('click', () => adjustZoom(-.25));
  zoomReset?.addEventListener('click', resetZoom);
  canvas.addEventListener('wheel', event => { if (!image) return; event.preventDefault(); adjustZoom(event.deltaY < 0 ? .12 : -.12); }, { passive: false });
  canvas.addEventListener('pointerdown', event => { if (!image) return; dragging = true; pointerX = event.clientX; pointerY = event.clientY; canvas.setPointerCapture?.(event.pointerId); canvas.classList.add('dragging'); });
  canvas.addEventListener('pointermove', event => { if (!dragging) return; panX += event.clientX - pointerX; panY += event.clientY - pointerY; pointerX = event.clientX; pointerY = event.clientY; render(); });
  const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', render);
  window.refreshScienceLessonFromLabels = function() {
    if (!image || analysisInProgress) return false;
    position = 0;
    announcedStep = -1;
    analyzeImage();
    return true;
  };
  render();
})();
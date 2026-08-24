// EduLabs AI Science Lab — 3D generation controller
let generatedModelUrl = null;

const threeButton = document.getElementById('generate3d');
const downloadButton = document.getElementById('download3d');
const status = document.getElementById('status');
const fileInput = document.getElementById('file');
const subjectInput = document.getElementById('subject');
const topicInput = document.getElementById('topic');
const threeStatus = document.getElementById('threeStatus');
const modelProgress = document.getElementById('modelProgress');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressTitle = document.getElementById('progressTitle');
const progressDetail = document.getElementById('progressDetail');

function setStep(step) {
  if (!threeStatus) return;
  const order = ['prepare', 'generate', 'fix', 'ready'];
  const index = order.indexOf(step);
  threeStatus.querySelectorAll('[data-step]').forEach(el => {
    const i = order.indexOf(el.dataset.step);
    el.classList.toggle('active', i === index);
    el.classList.toggle('done', i < index || step === 'ready' && i < order.length - 1);
  });
}

function setProgress(percent, title, detail, busy = true) {
  if (!modelProgress) return;
  modelProgress.classList.add('visible');
  if (progressBar) {
    progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressBar.classList.toggle('busy', busy && percent < 100);
  }
  if (progressPercent) progressPercent.textContent = `${Math.round(percent)}%`;
  if (progressTitle) progressTitle.textContent = title;
  if (progressDetail) progressDetail.textContent = detail;
}

async function removeReadableDiagramText(canvas) {
  try {
    const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
    const worker = await createWorker('eng');
    const result = await worker.recognize(canvas);
    await worker.terminate();
    const words = (result.data?.words || []).filter(word => Number(word.confidence) >= 65 && String(word.text || '').trim().length >= 2);
    const context = canvas.getContext('2d');
    words.forEach(word => {
      const box = word.bbox;
      const pad = Math.max(5, Math.round(Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.22));
      // Clear detected label text in the generator copy only. The original
      // picture remains unchanged for the animated lesson and students.
      context.clearRect(Math.max(0, box.x0 - pad), Math.max(0, box.y0 - pad), Math.min(canvas.width, box.x1 + pad) - Math.max(0, box.x0 - pad), Math.min(canvas.height, box.y1 + pad) - Math.max(0, box.y0 - pad));
    });
    return words.length;
  } catch (error) {
    console.warn('Diagram text cleanup unavailable:', error);
    return 0;
  }
}

async function readImageAsDataUrl(file) {
  // Normalize the 3D-generator copy while keeping the student's original image
  // untouched for the animated lesson.
  if (!window.createImageBitmap) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The image could not be read.'));
      reader.onload = () => resolve({ dataUrl: reader.result, removedLabels: 0 });
      reader.readAsDataURL(file);
    });
  }

  const bitmap = await createImageBitmap(file);
  const longestSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 1600 / longestSide);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.filter = 'contrast(1.16) saturate(1.08) brightness(1.03)';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  setProgress(18, 'Cleaning diagram labels…', 'Removing readable text from the copy used for 3D generation.');
  const removedLabels = await removeReadableDiagramText(canvas);
  return { dataUrl: canvas.toDataURL('image/png'), removedLabels };
}

function hideProgress() {
  modelProgress?.classList.remove('visible');
  progressBar?.classList.remove('busy');
}

function friendlyError(error) {
  const message = String(error?.message || error || 'Unknown error');
  if (/worker|endpoint|unavailable|503|502/i.test(message)) {
    return 'The 3D service is not connected right now. The image is still safe and unchanged. Please try again later.';
  }
  if (/model|glb|loader|format/i.test(message)) {
    return 'The 3D model could not be prepared from this image. Try a clear image with one main object.';
  }
  return 'We could not create the 3D model from that image. Try a clearer image with one main object.';
}

async function waitFor3DJob(jobId) {
  const deadline = Date.now() + 9 * 60 * 1000;
  let attempts = 0;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    attempts += 1;
    const response = await fetch('/api/generate-3d', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const update = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(update.message || 'The 3D generator stopped while building the model.');
    if (update.status === 'complete' && update.modelUrl) return update;
    if (update.status === 'failed') throw new Error(update.detail || 'The 3D generator could not finish this image.');
    const percent = Math.min(74, 28 + attempts * 2);
    setProgress(percent, 'Creating your 3D model…', update.detail || 'The generator is still working. Please keep this page open.');
    status.textContent = update.detail || 'Creating your 3D model…';
  }
  throw new Error('The 3D model is taking unusually long. Please try a smaller image with one main object.');
}

async function generateReal3D() {
  const file = fileInput?.files?.[0];
  if (!file) {
    status.textContent = 'Choose a science image first.';
    setStep('prepare');
    hideProgress();
    return;
  }

  if (!file.type.startsWith('image/')) {
    status.textContent = 'Please choose an image file.';
    hideProgress();
    return;
  }

  threeButton.disabled = true;
  threeButton.classList.add('generate-busy');
  const originalButtonText = threeButton.dataset.originalText || threeButton.textContent;
  threeButton.dataset.originalText = originalButtonText;
  threeButton.textContent = 'Creating 3D Model…';
  if (downloadButton) downloadButton.hidden = true;

  setStep('prepare');
  setProgress(8, 'Preparing image…', 'Checking your image and sending it to the 3D generator.');
  status.textContent = 'Preparing your science image…';

  try {
    const preparedImage = await readImageAsDataUrl(file);
    const imageBase64 = preparedImage.dataUrl;
    const labelDetail = preparedImage.removedLabels
      ? `Removed ${preparedImage.removedLabels} readable diagram label${preparedImage.removedLabels === 1 ? '' : 's'} from the 3D-generator copy.`
      : 'No readable diagram labels were found to remove.';

    setStep('generate');
    setProgress(25, 'Creating your 3D model…', labelDetail);
    status.textContent = 'Creating your 3D model… This can take a little while.';

    // The browser cannot know the worker's exact percentage, so this is an
    // honest stage-based progress indicator rather than pretending to have
    // server-side progress telemetry.
    const progressTimer = setInterval(() => {
      const current = parseInt(progressPercent?.textContent || '25', 10) || 25;
      if (current < 68) {
        const next = Math.min(68, current + 1);
        setProgress(next, 'Creating your 3D model…', 'AI reconstruction is still running. Please keep this page open.');
      }
    }, 1200);

    let response;
    try {
      response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          imageName: file.name,
          subject: subjectInput?.value || 'general',
          topic: topicInput?.value?.trim() || ''
        })
      });
    } finally {
      clearInterval(progressTimer);
    }

    let result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || `3D service returned ${response.status}`);
    if (result.jobId) {
      status.textContent = 'Your 3D model job started. This can take a few minutes.';
      setProgress(28, 'Creating your 3D model…', 'The generator is working in the background. You can keep this page open.');
      result = await waitFor3DJob(result.jobId);
    }

    const modelUrl = result.modelUrl || result.glbUrl || result.outputUrl || result.url || result.model?.url;
    if (!modelUrl) throw new Error(result.error || 'The 3D service returned no model file.');

    generatedModelUrl = modelUrl;
    setStep('fix');
    setProgress(78, 'Setting up your 3D model…', 'Centering, scaling, and orienting the model for the viewer.');
    status.textContent = 'Centering and orienting the 3D model…';

    window.loadScienceModel(modelUrl);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('The model took too long to load.')), 30000);
      const done = () => { clearTimeout(timeout); window.removeEventListener('science-model-rendered', done); window.removeEventListener('science-model-error', failed); resolve(); };
      const failed = event => { clearTimeout(timeout); window.removeEventListener('science-model-rendered', done); window.removeEventListener('science-model-error', failed); reject(event.detail || new Error('3D viewer failed')); };
      window.addEventListener('science-model-rendered', done, { once: true });
      window.addEventListener('science-model-error', failed, { once: true });
    });

    setStep('ready');
    setProgress(100, '3D model ready!', 'Your model is loaded. Drag to rotate and scroll to zoom.', false);
    if (downloadButton) {
      downloadButton.href = modelUrl;
      downloadButton.hidden = false;
    }
    status.textContent = 'Your 3D science model is ready. Drag it to rotate and scroll to zoom.';
  } catch (error) {
    console.error('EduLabs 3D generation failed:', error);
    setStep('prepare');
    setProgress(0, '3D generation stopped', friendlyError(error), false);
    status.textContent = friendlyError(error);
  } finally {
    threeButton.disabled = false;
    threeButton.classList.remove('generate-busy');
    threeButton.textContent = originalButtonText;
  }
}

threeButton?.addEventListener('click', generateReal3D);

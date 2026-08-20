// EduLabs AI Science Lab — 3D generation controller
let generatedModelUrl = null;

const threeButton = document.getElementById('generate3d');
const downloadButton = document.getElementById('download3d');
const status = document.getElementById('status');
const fileInput = document.getElementById('file');
const subjectInput = document.getElementById('subject');
const topicInput = document.getElementById('topic');
const threeStatus = document.getElementById('threeStatus');

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

async function generateReal3D() {
  const file = fileInput?.files?.[0];
  if (!file) {
    status.textContent = 'Choose a science image first.';
    setStep('prepare');
    return;
  }

  if (!file.type.startsWith('image/')) {
    status.textContent = 'Please choose an image file.';
    return;
  }

  threeButton.disabled = true;
  if (downloadButton) downloadButton.hidden = true;
  setStep('prepare');
  status.textContent = 'Preparing your science image…';

  try {
    // The server/worker performs the model-specific image preparation.
    const data = new FormData();
    data.append('image', file, file.name);
    data.append('subject', subjectInput?.value || 'general');
    data.append('topic', topicInput?.value?.trim() || '');

    setStep('generate');
    status.textContent = 'Creating your 3D model… This can take a little while.';

    const response = await fetch('/api/generate-3d', {
      method: 'POST',
      body: data,
      headers: {
        'x-edulabs-subject': subjectInput?.value || 'general',
        'x-edulabs-topic': topicInput?.value?.trim() || ''
      }
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || `3D service returned ${response.status}`);

    const modelUrl = result.modelUrl || result.glbUrl || result.outputUrl || result.url || result.model?.url;
    if (!modelUrl) throw new Error(result.error || 'The 3D service returned no model file.');

    generatedModelUrl = modelUrl;
    setStep('fix');
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
    if (downloadButton) {
      downloadButton.href = modelUrl;
      downloadButton.hidden = false;
    }
    status.textContent = 'Your 3D science model is ready. Drag it to rotate and scroll to zoom.';
  } catch (error) {
    console.error('EduLabs 3D generation failed:', error);
    setStep('prepare');
    status.textContent = friendlyError(error);
  } finally {
    threeButton.disabled = false;
  }
}

threeButton?.addEventListener('click', generateReal3D);

/*
 EduLabs AI - AI 3D Generator

 This module adds the Science Lab 3D generation layer.
 It is designed to connect an uploaded science diagram to a free image-to-3D
 model service (for example a self-hosted TripoSR/Hunyuan3D compatible endpoint).
 The browser UI can call window.generateScienceModel(imageFile).
*/

window.generateScienceModel = async function(imageFile) {
  if (!imageFile) throw new Error('No diagram supplied');

  const form = new FormData();
  form.append('image', imageFile);

  const response = await fetch('/api/generate-3d', {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    throw new Error('3D generator unavailable');
  }

  return await response.json();
};

window.loadScienceModel = function(modelUrl) {
  const event = new CustomEvent('science-model-ready', {
    detail: { modelUrl }
  });
  window.dispatchEvent(event);
};

// EduLabs AI Science Lab 3D Viewer
// Loads generated .glb files into the page using Three.js.

window.loadScienceGLB = function(modelUrl, elementId = 'science-3d-viewer') {
  const container = document.getElementById(elementId);
  if (!container) throw new Error('3D viewer container missing');

  const modelEvent = new CustomEvent('science-model-ready', {
    detail: { modelUrl, container }
  });

  window.dispatchEvent(modelEvent);
};

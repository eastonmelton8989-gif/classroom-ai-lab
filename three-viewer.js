// EduLabs AI Science Lab — real GLB viewer
// Uses Three.js + GLTFLoader loaded by science.html.

let scienceViewer = null;

function getViewerCanvas() {
  return document.getElementById('canvas');
}

function disposeObject(object) {
  object.traverse(node => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        Object.keys(material).forEach(key => {
          const value = material[key];
          if (value && value.isTexture) value.dispose();
        });
        material.dispose?.();
      });
    }
  });
}

function orientAndFrame(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  // Most image-to-3D workers use Y-up. If the returned mesh is clearly
  // lying on its side, rotate it so its largest vertical-looking dimension
  // becomes Y. This fixes common Z-up/sideways exports without requiring
  // students to understand 3D coordinate systems.
  const maxHorizontal = Math.max(size.x, size.z);
  if (size.y < maxHorizontal * 0.65) {
    if (size.x >= size.z) model.rotation.z = Math.PI / 2;
    else model.rotation.x = -Math.PI / 2;
  }

  const orientedBox = new THREE.Box3().setFromObject(model);
  const center = orientedBox.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const finalSize = orientedBox.getSize(new THREE.Vector3());
  const maxSize = Math.max(finalSize.x, finalSize.y, finalSize.z) || 1;
  const scale = 2.8 / maxSize;
  model.scale.multiplyScalar(scale);
  model.position.y = -0.15;
}

function createViewer() {
  if (scienceViewer) return scienceViewer;

  const canvas = getViewerCanvas();
  if (!canvas || !window.THREE) throw new Error('3D viewer is not ready');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  renderer.setClearColor(0x020817, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
  camera.position.set(3.2, 2.2, 4.5);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(4, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x93c5fd, 1.2);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  const grid = new THREE.GridHelper(6, 24, 0x334155, 0x1e293b);
  grid.position.y = -1.55;
  scene.add(grid);

  let model = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let autoRotate = true;
  let armedLabel = '';
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const labels = new THREE.Group();
  scene.add(labels);

  function clearLabels() {
    window.eduLabsModelLabels = [];
    while (labels.children.length) {
      const item = labels.children.pop();
      item.geometry?.dispose?.();
      item.material?.map?.dispose?.();
      item.material?.dispose?.();
    }
  }

  function makeLabelSprite(text) {
    const labelCanvas = document.createElement('canvas');
    const context = labelCanvas.getContext('2d');
    context.font = '700 32px Arial';
    const width = Math.min(460, Math.max(150, Math.ceil(context.measureText(text).width + 56)));
    labelCanvas.width = width;
    labelCanvas.height = 66;
    context.font = '700 32px Arial';
    context.fillStyle = '#07152f';
    context.strokeStyle = '#7dd3fc';
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect?.(3, 3, width - 6, 60, 14);
    if (!context.roundRect) context.rect(3, 3, width - 6, 60);
    context.fill();
    context.stroke();
    context.fillStyle = '#ffffff';
    context.textBaseline = 'middle';
    context.fillText(text, 26, 33);
    const texture = new THREE.CanvasTexture(labelCanvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(width / 190, 0.35, 1);
    return sprite;
  }

  function placeLabel(event) {
    if (!armedLabel || !model) return false;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(model, true)[0];
    if (!hit) return false;
    const point = hit.point.clone();
    const normal = hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld).normalize() || new THREE.Vector3(0, 1, 0);
    const anchor = point.clone().addScaledVector(normal, 0.42);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([point, anchor]),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, depthTest: false })
    );
    const sprite = makeLabelSprite(armedLabel);
    sprite.position.copy(anchor).add(new THREE.Vector3(0.12, 0.16, 0));
    labels.add(line, sprite);
    window.eduLabsModelLabels = [...new Set([...(window.eduLabsModelLabels || []), armedLabel])];
    armedLabel = '';
    window.dispatchEvent(new CustomEvent('science-model-label-placed'));
    return true;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  canvas.addEventListener('pointerdown', event => {
    dragging = true;
    autoRotate = false;
    startX = lastX = event.clientX;
    startY = lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointerup', event => {
    const wasClick = Math.hypot(event.clientX - startX, event.clientY - startY) < 7;
    dragging = false;
    if (wasClick && placeLabel(event)) canvas.style.cursor = 'grab';
  });
  canvas.addEventListener('pointerleave', () => { dragging = false; });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || !model) return;
    model.rotation.y += (event.clientX - lastX) * 0.008;
    model.rotation.x += (event.clientY - lastY) * 0.004;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    camera.position.multiplyScalar(event.deltaY > 0 ? 1.08 : 0.93);
    camera.position.clampLength(1.8, 12);
  }, { passive: false });

  function animate() {
    requestAnimationFrame(animate);
    resize();
    if (model && autoRotate && !dragging) model.rotation.y += 0.004;
    renderer.render(scene, camera);
  }
  animate();

  scienceViewer = {
    load(url) {
      if (!window.THREE.GLTFLoader) throw new Error('GLB loader is not ready');
      const loader = new THREE.GLTFLoader();
      loader.load(url, gltf => {
        if (model) {
          scene.remove(model);
          disposeObject(model);
        }
        model = gltf.scene;
        clearLabels();
        orientAndFrame(model);
        scene.add(model);
        autoRotate = true;
        window.dispatchEvent(new CustomEvent('science-model-rendered'));
      }, undefined, error => {
        console.error(error);
        window.dispatchEvent(new CustomEvent('science-model-error', { detail: error }));
      });
    },
    armLabel(text) {
      if (!model || !String(text || '').trim()) return false;
      armedLabel = String(text).trim().slice(0, 42);
      canvas.style.cursor = 'crosshair';
      return true;
    },
    clearLabels
  };

  return scienceViewer;
}

window.loadScienceModel = function(modelUrl) {
  return createViewer().load(modelUrl);
};
window.loadScienceGLB = window.loadScienceModel;
window.armScienceModelLabel = function(text) {
  return createViewer().armLabel(text);
};
window.clearScienceModelLabels = function() {
  createViewer().clearLabels();
};

const modelLabelText = document.getElementById('modelLabelText');
const modelLabelStatus = document.getElementById('modelLabelStatus');
document.getElementById('placeModelLabel')?.addEventListener('click', () => {
  if (!window.armScienceModelLabel(modelLabelText?.value)) {
    if (modelLabelStatus) modelLabelStatus.textContent = 'Create the 3D model first, then add a label.';
    return;
  }
  if (modelLabelStatus) modelLabelStatus.textContent = 'Now click the exact part of the 3D model where this label belongs.';
});
document.getElementById('useModelLabels')?.addEventListener('click', () => {
  const labels = window.eduLabsModelLabels || [];
  if (!labels.length) {
    if (modelLabelStatus) modelLabelStatus.textContent = 'Place at least one label on the model first.';
    return;
  }
  if (window.refreshScienceLessonFromLabels?.()) {
    if (modelLabelStatus) modelLabelStatus.textContent = 'The animated lesson is updating to explain: ' + labels.join(', ') + '.';
  }
});
document.getElementById('clearModelLabels')?.addEventListener('click', () => {
  window.clearScienceModelLabels();
  if (modelLabelStatus) modelLabelStatus.textContent = 'Labels cleared. Add another label, then click the matching model part.';
});
window.addEventListener('science-model-label-placed', () => {
  if (modelLabelText) modelLabelText.value = '';
  if (modelLabelStatus) modelLabelStatus.textContent = 'Label placed on the model. Add another label whenever you need one.';
});

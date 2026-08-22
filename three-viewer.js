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
  let autoRotate = true;

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
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
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
        orientAndFrame(model);
        scene.add(model);
        autoRotate = true;
        window.dispatchEvent(new CustomEvent('science-model-rendered'));
      }, undefined, error => {
        console.error(error);
        window.dispatchEvent(new CustomEvent('science-model-error', { detail: error }));
      });
    }
  };

  return scienceViewer;
}

window.loadScienceModel = function(modelUrl) {
  return createViewer().load(modelUrl);
};
window.loadScienceGLB = window.loadScienceModel;

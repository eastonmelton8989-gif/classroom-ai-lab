const canvas = document.getElementById('canvas');
const file = document.getElementById('file');
const drop = document.getElementById('drop');
const subject = document.getElementById('subject');
const topic = document.getElementById('topic');
const stepsSelect = document.getElementById('steps');
const generate = document.getElementById('generate');
const status = document.getElementById('status');
const result = document.getElementById('result');

let img = null;
let sourceUrl = null;
let depthEstimator = null;
let renderer = null;
let scene = null;
let camera = null;
let mesh = null;
let texture = null;
let depthData = null;
let lessonSteps = [];
let lessonDuration = 0;
let generationToken = 0;

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const DEPTH_MODEL = 'onnx-community/depth-anything-v2-small';

const banks = {
  general: ['Orient the viewer to the diagram and its main question','Identify the major objects, regions, labels, arrows, and connections','Zoom into the first important part and explain what it represents','Trace the process, movement, relationship, or sequence shown','Connect the parts and explain how the complete system behaves','Review the diagram from beginning to end and state the key scientific idea'],
  biology: ['Orient the viewer to the biological system and its purpose','Identify the major structures, organisms, tissues, or cell regions','Zoom into each important structure and explain its role','Trace the biological pathway or process in the direction shown','Connect structure and function to the resulting biological outcome','Review the whole system and summarize the biological mechanism'],
  chemistry: ['Orient the viewer to the chemical system and conditions','Identify atoms, molecules, ions, bonds, apparatus, labels, and arrows','Zoom into the starting substances and explain their arrangement','Trace the reaction, transfer, bonding, or transformation','Show the resulting substances and explain what changed','Review the reaction from start to finish and summarize the chemistry'],
  physics: ['Orient the viewer to the physical system and the quantity being demonstrated','Identify objects, components, forces, fields, waves, signals, and labels','Focus on the initial state and the important variables','Trace motion, energy, force, field, wave, or signal flow','Connect the changes to the final state and governing relationship','Review the system and state the physical principle shown'],
  earth: ['Orient the viewer to the Earth system and its scale','Identify layers, landforms, reservoirs, materials, and cycle components','Focus on the starting region or material','Trace movement, transfer, weathering, circulation, or change','Connect the local process to the larger Earth system','Review the cycle or pattern and summarize the Earth-science idea'],
  astronomy: ['Orient the viewer to the astronomical system and its scale','Identify the objects, regions, labels, and relative positions','Focus on the most important object or region','Trace motion, interaction, formation, or evolution','Connect the objects to the larger astronomical process','Review the system and summarize the key astronomical idea'],
  environment: ['Orient the viewer to the ecosystem or environmental system','Identify organisms, resources, conditions, flows, and surroundings','Focus on the first important interaction','Trace energy, matter, population, or environmental impact','Connect the interaction to broader consequences','Review the relationship and summarize the environmental idea'],
  anatomy: ['Orient the viewer to the body system and its function','Identify the major anatomical structures and labels','Focus on each structure and explain its role','Trace the pathway or physiological process shown','Connect the structures to the system-level function','Review the pathway and summarize how the body system works']
};

function choose(f) {
  if (!f || !f.type.startsWith('image/')) return;
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(f);
  img = new Image();
  img.onload = () => {
    status.textContent = 'Diagram loaded. Generate 3D to reconstruct its visible depth locally.';
    showSourcePreview();
  };
  img.src = sourceUrl;
}

file.onchange = e => choose(e.target.files[0]);
drop.onclick = () => file.click();
drop.ondragover = e => { e.preventDefault(); drop.classList.add('active'); };
drop.ondragleave = () => drop.classList.remove('active');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('active'); choose(e.dataTransfer.files[0]); };

function fitCanvas(c) {
  const r = canvas.getBoundingClientRect();
  const d = Math.min(devicePixelRatio || 1, 2);
  c.width = Math.max(1, Math.round(r.width * d));
  c.height = Math.max(1, Math.round(r.height * d));
  return { w: r.width, h: r.height, d };
}

function showSourcePreview() {
  if (renderer) renderer.setAnimationLoop(null);
  const c = canvas.getContext('2d');
  const { w, h, d } = fitCanvas(canvas);
  c.setTransform(d, 0, 0, d, 0, 0);
  c.fillStyle = '#020817'; c.fillRect(0, 0, w, h);
  const s = Math.min((w - 50) / img.width, (h - 70) / img.height);
  const iw = img.width * s, ih = img.height * s;
  c.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

async function loadAI() {
  if (depthEstimator) return depthEstimator;
  status.textContent = 'Loading the local 3D depth model. First use can take a few minutes…';
  const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
  const device = navigator.gpu ? 'webgpu' : 'wasm';
  depthEstimator = await mod.pipeline('depth-estimation', DEPTH_MODEL, { device });
  return depthEstimator;
}

function imageToDataURL() {
  const c = document.createElement('canvas');
  const max = 768;
  const s = Math.min(1, max / img.width, max / img.height);
  c.width = Math.max(1, Math.round(img.width * s));
  c.height = Math.max(1, Math.round(img.height * s));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .92);
}

async function makeDepth() {
  const pipe = await loadAI();
  status.textContent = 'Analyzing the uploaded image and estimating its 3D depth locally…';
  const out = await pipe(imageToDataURL());
  const d = out.depth;
  const w = d.width || d.size?.[0];
  const h = d.height || d.size?.[1];
  let raw;
  if (d.data) raw = d.data;
  else if (d.toTensor) raw = (await d.toTensor()).data;
  else throw new Error('The depth model returned an unsupported format.');
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    const v = Number(raw[i]);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  depthData = {
    w, h,
    values: Float32Array.from(raw, v => (Number(v) - min) / Math.max(max - min, 1e-6))
  };
  return depthData;
}

async function build3D() {
  const THREE = await import(THREE_URL);
  await makeDepth();

  if (renderer) {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.forceContextLoss?.();
  }

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020817);
  camera = new THREE.PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, .01, 100);
  camera.position.set(0, 0, 5.4);

  scene.add(new THREE.AmbientLight(0xffffff, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-3, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ee7ff, 2.5); rim.position.set(4, -2, -4); scene.add(rim);

  texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const W = 128;
  const H = Math.max(72, Math.round(W * depthData.h / depthData.w));
  const aspect = depthData.w / depthData.h;
  const geo = new THREE.PlaneGeometry(6, 6 / aspect, W - 1, H - 1);
  const pos = geo.attributes.position;
  const vals = depthData.values;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.min(depthData.w - 1, Math.floor(x / (W - 1) * (depthData.w - 1)));
      const sy = Math.min(depthData.h - 1, Math.floor(y / (H - 1) * (depthData.h - 1)));
      const z = vals[sy * depthData.w + sx];
      pos.setZ(y * W + x, (z - .5) * 1.45);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: .72,
    metalness: .02,
    side: THREE.DoubleSide
  });
  mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);

  status.textContent = '3D reconstruction ready. The original diagram is now a depth-mapped 3D surface.';
  return THREE;
}

function lessonFor() {
  const base = banks[subject.value] || banks.general;
  const requested = stepsSelect.value === 'auto' ? null : Number(stepsSelect.value);
  const topicText = topic.value.trim();
  let n = requested || Math.max(6, Math.min(14, Math.ceil((topicText.length || 30) / 10)));
  const steps = [];
  for (let i = 0; i < n; i++) {
    steps.push(base[i % base.length]);
  }
  if (topicText) steps[0] = `Introduce ${topicText} and orient the viewer to the diagram`;
  return steps;
}

function durationFor(count, topicText) {
  const complexity = Math.max(1, Math.min(3, Math.ceil((topicText || '').length / 30)));
  return Math.max(60, Math.min(420, count * (11 + complexity * 2)));
}

function drawOverlay(ctx, w, h, elapsed) {
  if (!lessonSteps.length) return;
  const progress = Math.min(0.999, elapsed / lessonDuration);
  const stepIndex = Math.min(lessonSteps.length - 1, Math.floor(progress * lessonSteps.length));
  const stepProgress = (progress * lessonSteps.length) % 1;
  ctx.save();
  ctx.fillStyle = 'rgba(2,8,23,.88)';
  ctx.fillRect(0, h - 132, w, 132);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '700 14px Arial';
  ctx.fillText(`${subject.options[subject.selectedIndex].text} · ${topic.value.trim() || 'Science diagram'}`, 24, h - 102);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 21px Arial';
  const text = lessonSteps[stepIndex];
  ctx.fillText(`Step ${stepIndex + 1}/${lessonSteps.length}`, 24, h - 70);
  ctx.font = '500 18px Arial';
  ctx.fillText(text.slice(0, 105), 180, h - 70);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(24, h - 36, w - 48, 6);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(24, h - 36, (w - 48) * progress, 6);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 13px Arial';
  ctx.fillText(`Step progress ${Math.round(stepProgress * 100)}% · ${Math.round(progress * 100)}% complete`, 24, h - 14);
  ctx.restore();
}

function renderScene(elapsed) {
  if (!renderer || !scene || !camera) return;
  const p = lessonDuration ? Math.min(1, elapsed / lessonDuration) : 0;
  const phase = p * Math.PI * 2;
  camera.position.x = Math.sin(phase * .72) * (.15 + p * .5);
  camera.position.y = Math.sin(phase * .43) * .16;
  camera.position.z = 5.35 - Math.sin(p * Math.PI) * .75;
  camera.lookAt(0, 0, 0);
  if (mesh) {
    mesh.rotation.y = Math.sin(phase * .5) * .06;
    mesh.rotation.x = Math.sin(p * Math.PI) * .04;
    mesh.position.z = Math.sin(p * Math.PI) * .08;
  }
  renderer.render(scene, camera);
}

async function recordWalkthrough() {
  const THREE = await build3D();
  lessonSteps = lessonFor();
  lessonDuration = durationFor(lessonSteps.length, topic.value.trim());
  const token = ++generationToken;
  const fps = 30;
  const recordCanvas = document.createElement('canvas');
  const scale = Math.min(devicePixelRatio || 1, 2);
  recordCanvas.width = Math.round(canvas.clientWidth * scale);
  recordCanvas.height = Math.round(canvas.clientHeight * scale);
  const ctx = recordCanvas.getContext('2d');
  const stream = recordCanvas.captureStream(fps);
  const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x => MediaRecorder.isTypeSupported(x)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 7000000 } : { videoBitsPerSecond: 7000000 });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);

  return new Promise((resolve, reject) => {
    rec.onerror = e => reject(e.error || new Error('Video recording failed'));
    rec.onstop = () => {
      if (token !== generationToken) return;
      const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
      resolve(blob);
    };
    const started = performance.now();
    rec.start(250);
    renderer.setAnimationLoop(() => {
      const elapsed = (performance.now() - started) / 1000;
      renderScene(elapsed);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,recordCanvas.width,recordCanvas.height);
      ctx.drawImage(canvas, 0, 0, recordCanvas.width, recordCanvas.height);
      ctx.setTransform(scale,0,0,scale,0,0);
      drawOverlay(ctx, canvas.clientWidth, canvas.clientHeight, elapsed);
      if (elapsed >= lessonDuration) {
        renderer.setAnimationLoop(null);
        rec.stop();
      }
    });
  });
}

async function generateVideo() {
  if (!img) { status.textContent = 'Please upload a science diagram first.'; return; }
  if (!('MediaRecorder' in window) || !canvas.captureStream) { status.textContent = 'This browser cannot create local video. Try current Chrome or Edge.'; return; }
  generate.disabled = true;
  result.innerHTML = '';
  try {
    lessonSteps = lessonFor();
    lessonDuration = durationFor(lessonSteps.length, topic.value.trim());
    status.textContent = `Reconstructing the diagram in 3D, then recording a ${lessonDuration}-second walkthrough…`;
    const blob = await recordWalkthrough();
    const url = URL.createObjectURL(blob);
    result.innerHTML = `<video class="video" controls playsinline src="${url}"></video><a class="btn green" style="margin-top:12px" href="${url}" download="science3d-explanation.webm">Download 3D explanation video</a>`;
    status.textContent = `Done — ${lessonDuration} seconds generated from your uploaded diagram. The 3D reconstruction and recording happened on this device.`;
  } catch (e) {
    console.error(e);
    status.textContent = `3D generation failed: ${e?.message || e}. Try Chrome/Edge with hardware acceleration enabled.`;
  } finally {
    generate.disabled = false;
  }
}

generate.onclick = generateVideo;
window.addEventListener('resize', () => {
  if (renderer && camera) {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  } else if (img) showSourcePreview();
});

if (!img) showSourcePreview();

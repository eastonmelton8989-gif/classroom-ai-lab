// EduLabs AI Science Lab - resilient 3D engine
// New generation layer: never fails because WebGPU is unavailable.

export async function createScienceDepth(loadPipeline, model, width = 128, height = 72) {
  const backends = ['webgpu', 'wasm'];

  for (const device of backends) {
    try {
      const pipe = await loadPipeline('depth-estimation', model, { device });
      return { pipe, device };
    } catch (err) {
      console.warn(`${device} unavailable`, err);
    }
  }

  return {
    pipe: null,
    device: 'fallback'
  };
}

export function fallbackDepth(width, height) {
  const values = new Float32Array(width * height);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      values[y * width + x] = Math.max(0, 1 - distance / Math.max(width, height));
    }
  }

  return { w: width, h: height, values };
}

export function buildLessonScene(subject) {
  const scenes = {
    biology: ['structure', 'function', 'process', 'summary'],
    chemistry: ['atoms', 'bonding', 'reaction', 'products'],
    physics: ['objects', 'forces', 'motion', 'result'],
    astronomy: ['objects', 'scale', 'motion', 'system'],
    earth: ['layers', 'cycles', 'change', 'system']
  };

  return scenes[subject] || ['identify', 'explore', 'explain', 'review'];
}

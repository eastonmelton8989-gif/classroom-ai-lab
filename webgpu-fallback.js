// EduLabs AI Science Lab WebGPU fallback layer
// Prevents browser GPU failures from breaking generation.

export async function loadDepthBackend(loadPipeline, model) {
  const attempts = [];

  if (navigator.gpu) {
    attempts.push(async () => {
      return await loadPipeline('depth-estimation', model, { device: 'webgpu' });
    });
  }

  attempts.push(async () => {
    return await loadPipeline('depth-estimation', model, { device: 'wasm' });
  });

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      console.warn('Depth backend unavailable, trying fallback.', error);
    }
  }

  return null;
}

export function createFallbackDepth(width, height) {
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      values[y * width + x] = 0.5;
    }
  }
  return { w: width, h: height, values };
}

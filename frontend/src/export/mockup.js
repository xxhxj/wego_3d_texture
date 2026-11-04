import { downloadBlob, longEdgeSize } from './common.js';

const LONG_EDGE = { '2k': 2048, '4k': 3840, '8k': 7680 };
const SIZE_TABLE = {
  '16:9': { '2k': [1920, 1080], '4k': [3840, 2160], '8k': [7680, 4320] },
  '9:16': { '2k': [1080, 1920], '4k': [2160, 3840], '8k': [4320, 7680] },
  '4:3': { '2k': [1600, 1200], '4k': [4000, 3000], '8k': [7680, 5760] },
  '3:4': { '2k': [1200, 1600], '4k': [3000, 4000], '8k': [5760, 7680] },
  '1:1': { '2k': [1920, 1920], '4k': [4000, 4000], '8k': [7680, 7680] },
};

export async function exportMockup({
  renderer,
  scene,
  camera,
  viewWidth,
  viewHeight,
  setShadowVisible,
  format,
  resolution,
  ratio = '1:1',
  withShadow,
}) {
  const table = SIZE_TABLE[ratio];
  let width;
  let height;
  if (table?.[resolution]) {
    [width, height] = table[resolution];
  } else {
    const [rw, rh] = String(ratio).split(':').map(Number);
    const aspect = rw > 0 && rh > 0 ? rw / rh : viewWidth / Math.max(1, viewHeight);
    const requested = LONG_EDGE[resolution] || 2048;
    const fallback = longEdgeSize(requested, aspect);
    width = fallback.width;
    height = fallback.height;
  }

  const maxEdge = renderer.capabilities.maxTextureSize || 4096;
  const scale = Math.min(1, maxEdge / width, maxEdge / height);
  const size = {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
  const pixelRatio = renderer.getPixelRatio();
  const previousShadow = setShadowVisible(withShadow);

  try {
    renderer.setPixelRatio(1);
    const out = document.createElement('canvas');
    out.width = size.width;
    out.height = size.height;
    const ctx = out.getContext('2d');
    const gradient = ctx.createRadialGradient(
      out.width * 0.5,
      out.height * 0.42,
      out.width * 0.08,
      out.width * 0.5,
      out.height * 0.5,
      out.width * 0.72,
    );
    gradient.addColorStop(0, '#f4f4f4');
    gradient.addColorStop(1, '#d0d0d0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, out.width, out.height);

    // 8K 等超高分辨率超过部分显卡的视口上限，分块渲染后拼回完整画面。
    const gl = renderer.getContext();
    const viewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const maxDim = Number(viewportDims?.[0] || 4096);
    const tileLimit = Math.max(1024, Math.min(4096, maxDim));
    const tilesX = Math.max(1, Math.ceil(size.width / tileLimit));
    const tilesY = Math.max(1, Math.ceil(size.height / tileLimit));
    const tileWidth = Math.ceil(size.width / tilesX);
    const tileHeight = Math.ceil(size.height / tilesY);
    camera.aspect = size.width / size.height;
    for (let row = 0; row < tilesY; row += 1) {
      for (let col = 0; col < tilesX; col += 1) {
        const width = Math.min(tileWidth, size.width - col * tileWidth);
        const height = Math.min(tileHeight, size.height - row * tileHeight);
        renderer.setSize(width, height, false);
        camera.setViewOffset(size.width, size.height, col * tileWidth, row * tileHeight, width, height);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        ctx.drawImage(renderer.domElement, 0, 0, width, height, col * tileWidth, row * tileHeight, width, height);
      }
    }
    camera.clearViewOffset();

    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve) => out.toBlob(resolve, mime, 0.92));
    downloadBlob(blob, `样机-${resolution}-${String(ratio).replace(':', 'x')}.${format === 'jpg' ? 'jpg' : 'png'}`);
    return scale < 1 ? `显卡上限是 ${maxEdge}px，已按 ${size.width}×${size.height} 导出。` : '样机已导出。';
  } finally {
    setShadowVisible(previousShadow);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(viewWidth, viewHeight, false);
    camera.clearViewOffset();
    camera.aspect = viewWidth / Math.max(1, viewHeight);
    camera.updateProjectionMatrix();
  }
}

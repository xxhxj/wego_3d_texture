import { downloadBlob, longEdgeSize } from './common.js';

const LONG_EDGE = { '2k': 2048, '4k': 3840, '8k': 7680 };

export async function exportMockup({
  renderer,
  scene,
  camera,
  viewWidth,
  viewHeight,
  setShadowVisible,
  format,
  resolution,
  withShadow,
}) {
  const aspect = viewWidth / Math.max(1, viewHeight);
  const maxEdge = renderer.capabilities.maxTextureSize || 4096;
  const requested = LONG_EDGE[resolution] || 2048;
  const edge = Math.min(requested, maxEdge);
  const size = longEdgeSize(edge, aspect);
  const pixelRatio = renderer.getPixelRatio();
  const previousShadow = setShadowVisible(withShadow);

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size.width, size.height, false);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    const src = renderer.domElement;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
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
    ctx.drawImage(src, 0, 0);

    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve) => out.toBlob(resolve, mime, 0.92));
    downloadBlob(blob, `样机-${resolution}.${format === 'jpg' ? 'jpg' : 'png'}`);
    return edge < requested ? `显卡上限是 ${edge}px，已按这个尺寸导出。` : '样机已导出。';
  } finally {
    setShadowVisible(previousShadow);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(viewWidth, viewHeight, false);
    camera.aspect = viewWidth / Math.max(1, viewHeight);
    camera.updateProjectionMatrix();
  }
}

import * as THREE from 'three';
import { downloadBlob, longEdgeSize } from './common.js';

const LONG_EDGE = { '720': 1280, '1080': 1920, '2k': 2560 };

export const VIDEO_STYLES = [
  { id: 'front', name: '正面微转', seconds: 3 },
  { id: 'side', name: '侧面展示', seconds: 3 },
  { id: 'orbit', name: '半圈环绕', seconds: 4 },
  { id: 'turn', name: '整圈环绕', seconds: 5 },
  { id: 'fold', name: '展开闭合', seconds: 4 },
  { id: 'slow', name: '慢速环绕', seconds: 8 },
];

function pickMime(format) {
  const lists = {
    mp4: ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'],
    mov: ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'],
  };
  const found = (lists[format] || lists.mp4).find((type) => MediaRecorder.isTypeSupported(type));
  return found || '';
}

function extensionFor(mime, format) {
  if (mime.includes('mp4') && format === 'mov') return 'mov';
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

export function recordTurntable({
  renderer,
  scene,
  camera,
  controls,
  viewWidth,
  viewHeight,
  getRadius,
  getTargetY,
  getFold,
  setFold,
  setFrameHook,
  style,
  format,
  resolution,
  fast,
}) {
  const mime = pickMime(format);
  if (!mime || !renderer.domElement.captureStream) {
    return Promise.reject(new Error('当前浏览器不能录制视频。'));
  }
  const preset = VIDEO_STYLES.find((item) => item.id === style) || VIDEO_STYLES[0];
  const seconds = preset.seconds;
  const edge = Math.min(LONG_EDGE[resolution] || 1280, renderer.capabilities.maxTextureSize || 4096);
  const aspect = viewWidth / Math.max(1, viewHeight);
  const size = longEdgeSize(edge, aspect);
  const pixelRatio = renderer.getPixelRatio();
  const saved = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    fold: getFold(),
  };
  const radius = getRadius();
  const target = new THREE.Vector3(0, getTargetY(), 0);
  const fps = fast ? 12 : 30;

  function restoreNow() {
    setFrameHook(null);
    camera.position.copy(saved.position);
    controls.target.copy(saved.target);
    controls.enabled = true;
    controls.update();
    setFold(saved.fold);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(viewWidth, viewHeight, false);
    camera.aspect = viewWidth / Math.max(1, viewHeight);
    camera.updateProjectionMatrix();
  }

  renderer.setPixelRatio(1);
  renderer.setSize(size.width, size.height, false);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderer.setClearColor(0xd7d7d7, 1);
  controls.enabled = false;

  const stream = renderer.domElement.captureStream(fps);
  let recorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: fast ? 2_500_000 : 8_000_000 });
  } catch (error) {
    restoreNow();
    return Promise.reject(error instanceof Error ? error : new Error('视频录制失败。'));
  }
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  return new Promise((resolve, reject) => {
    const started = performance.now();
    let stopped = false;
    let settled = false;
    recorder.onerror = () => {
      if (settled) return;
      settled = true;
      restoreNow();
      reject(new Error('视频录制失败。'));
    };
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: mime });
      const ext = extensionFor(mime, format);
      downloadBlob(blob, `样机-${preset.name}.${ext}`);
      restoreNow();
      const note = ext === format ? `${preset.name}视频已导出。` : `当前浏览器不支持 ${format.toUpperCase()}，已导出 ${ext.toUpperCase()}。`;
      resolve(note);
    };
    try {
      recorder.start();
    } catch (error) {
      settled = true;
      restoreNow();
      reject(error instanceof Error ? error : new Error('视频录制失败。'));
      return;
    }

    setFrameHook(() => {
      const t = Math.min(1, (performance.now() - started) / (seconds * 1000));
      applyPose(t);
      if (t >= 1 && !stopped) {
        stopped = true;
        setFrameHook(null);
        recorder.stop();
      }
    });

    function applyPose(t) {
      const eased = t;
      if (preset.id === 'fold') {
        const fold = eased < 0.45 ? 1 - eased / 0.45 : (eased - 0.45) / 0.55;
        setFold(fold);
        camera.position.set(radius * 0.95, radius * 0.62, radius * 1.25);
      } else if (preset.id === 'front') {
        const ang = -0.35 + eased * 0.7;
        camera.position.set(Math.sin(ang) * radius, radius * 0.48, Math.cos(ang) * radius);
        setFold(1);
      } else if (preset.id === 'side') {
        const ang = 0.9 + eased * 0.8;
        camera.position.set(Math.sin(ang) * radius * 1.05, radius * 0.42, Math.cos(ang) * radius);
        setFold(1);
      } else {
        const turns = preset.id === 'slow' || preset.id === 'turn' ? 1 : 0.5;
        const ang = -0.5 + eased * Math.PI * 2 * turns;
        const lift = preset.id === 'slow' ? 0.7 : 0.5;
        camera.position.set(Math.sin(ang) * radius * 1.15, radius * lift, Math.cos(ang) * radius * 1.15);
        setFold(1);
      }
      camera.lookAt(target);
      controls.target.copy(target);
    }
  });
}

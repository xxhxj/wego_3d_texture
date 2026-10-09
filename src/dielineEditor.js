import { drawCoverImage, strokeNet } from './net.js';

const LABELS = {
  front: '正面',
  back: '背面',
  left: '左侧',
  right: '右侧',
  top: '顶面',
  bottom: '底面',
  label: '瓶贴',
  cap: '瓶盖',
  lid: '顶盖',
  wall: '杯身',
  gusset: '侧边',
};

const HANDLE = 6;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 展开面编辑器。刀版始终适配画布，图案可拖动、拖角缩放。
 * 滚轮缩放刀版视图，Alt 或中键拖拽平移视图。
 */
export function createDielineEditor(canvas, { onChange, onCommit }) {
  const view = { zoom: 1, panX: 0, panY: 0, scale: 1, ox: 0, oy: 0 };
  let layout = null;
  let image = null;
  let placement = null;
  let paper = '#f4f0e8';
  let faceImages = {};
  let drag = null;

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointermove', updateCursor);

  function setState(next) {
    layout = next.layout;
    image = next.image;
    placement = next.placement;
    paper = next.paper;
    faceImages = next.faceImages || {};
    render();
  }

  function resetView() {
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
    render();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    render();
  }

  function layoutView() {
    const pad = 36;
    const fit = Math.min(
      (canvas.width - pad * 2) / layout.totalW,
      (canvas.height - pad * 2) / layout.totalH,
    );
    view.scale = fit * view.zoom;
    view.ox = (canvas.width - layout.totalW * view.scale) / 2 + view.panX;
    view.oy = (canvas.height - layout.totalH * view.scale) / 2 + view.panY;
  }

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function screenToNet(clientX, clientY) {
    const p = clientToCanvas(clientX, clientY);
    return {
      x: (p.x - view.ox) / view.scale,
      y: (p.y - view.oy) / view.scale,
    };
  }

  function netToScreen(x, y) {
    return { x: view.ox + x * view.scale, y: view.oy + y * view.scale };
  }

  function imageRect() {
    if (!image || !placement) return null;
    return { x: placement.x, y: placement.y, w: placement.w, h: placement.h };
  }

  function handles() {
    const rect = imageRect();
    if (!rect) return [];
    const midX = rect.x + rect.w / 2;
    const midY = rect.y + rect.h / 2;
    return [
      { id: 'nw', x: rect.x, y: rect.y },
      { id: 'ne', x: rect.x + rect.w, y: rect.y },
      { id: 'sw', x: rect.x, y: rect.y + rect.h },
      { id: 'se', x: rect.x + rect.w, y: rect.y + rect.h },
      { id: 'n', x: midX, y: rect.y },
      { id: 's', x: midX, y: rect.y + rect.h },
      { id: 'w', x: rect.x, y: midY },
      { id: 'e', x: rect.x + rect.w, y: midY },
    ];
  }

  function hitHandle(clientX, clientY) {
    const p = clientToCanvas(clientX, clientY);
    for (const handle of handles()) {
      const s = netToScreen(handle.x, handle.y);
      if (Math.abs(p.x - s.x) <= HANDLE + 4 && Math.abs(p.y - s.y) <= HANDLE + 4) return handle.id;
    }
    return null;
  }

  function hitImage(clientX, clientY) {
    const rect = imageRect();
    if (!rect) return false;
    const p = screenToNet(clientX, clientY);
    return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  }

  function onPointerDown(event) {
    if (!layout) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is optional */
    }
    const net = screenToNet(event.clientX, event.clientY);
    if (event.button === 1 || event.altKey) {
      drag = { mode: 'pan', x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY };
      return;
    }
    if (event.button !== 0) return;
    const handle = hitHandle(event.clientX, event.clientY);
    if (handle && placement) {
      drag = { mode: 'scale', handle, rect: { ...imageRect() } };
      return;
    }
    if (hitImage(event.clientX, event.clientY)) {
      drag = { mode: 'move', net, placement: { ...placement } };
      return;
    }
    drag = { mode: 'pan', x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY };
  }

  function onPointerMove(event) {
    if (!drag || !layout) return;
    if (drag.mode === 'pan') {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      view.panX = drag.panX + (event.clientX - drag.x) * sx;
      view.panY = drag.panY + (event.clientY - drag.y) * sy;
      render();
      return;
    }
    if (!placement || !image) return;
    const net = screenToNet(event.clientX, event.clientY);
    if (drag.mode === 'move') {
      placement = {
        ...drag.placement,
        x: drag.placement.x + (net.x - drag.net.x),
        y: drag.placement.y + (net.y - drag.net.y),
      };
    } else if (drag.mode === 'scale') {
      placement = resizeFromPointer(net, drag.rect, drag.handle);
    }
    render();
    onChange?.(placement);
  }

  function resizeFromPointer(net, start, handle) {
    const minW = layout.totalW * 0.05;
    const minH = layout.totalH * 0.05;
    const maxW = layout.totalW * 8;
    const maxH = layout.totalH * 8;
    const right = start.x + start.w;
    const bottom = start.y + start.h;
    let { x, y, w, h } = start;

    if (handle.includes('e')) w = clamp(net.x - start.x, minW, maxW);
    if (handle.includes('w')) {
      x = clamp(net.x, right - maxW, right - minW);
      w = right - x;
    }
    if (handle.includes('s')) h = clamp(net.y - start.y, minH, maxH);
    if (handle.includes('n')) {
      y = clamp(net.y, bottom - maxH, bottom - minH);
      h = bottom - y;
    }
    return { x, y, w, h };
  }

  function onPointerUp() {
    if (!drag) return;
    const changed = drag.mode === 'move' || drag.mode === 'scale';
    drag = null;
    if (changed) onCommit?.(placement);
    updateCursor();
  }

  function onWheel(event) {
    if (!layout) return;
    event.preventDefault();
    const before = screenToNet(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    view.zoom = Math.min(6, Math.max(0.35, view.zoom * factor));
    layoutView();
    const after = netToScreen(before.x, before.y);
    const cursor = clientToCanvas(event.clientX, event.clientY);
    view.panX += cursor.x - after.x;
    view.panY += cursor.y - after.y;
    render();
  }

  function updateCursor(event) {
    if (!event || drag) return;
    const handle = hitHandle(event.clientX, event.clientY);
    if (handle === 'n' || handle === 's') canvas.style.cursor = 'ns-resize';
    else if (handle === 'e' || handle === 'w') canvas.style.cursor = 'ew-resize';
    else if (handle === 'nw' || handle === 'se') canvas.style.cursor = 'nwse-resize';
    else if (handle === 'ne' || handle === 'sw') canvas.style.cursor = 'nesw-resize';
    else if (hitImage(event.clientX, event.clientY)) canvas.style.cursor = 'move';
    else canvas.style.cursor = 'grab';
  }

  function render() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f3f1ee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!layout) return;
    layoutView();

    const keys = Object.keys(layout.panels);
    for (const key of keys) {
      const panel = layout.panels[key];
      const s = netToScreen(panel.x, panel.y);
      ctx.fillStyle = paper;
      ctx.fillRect(s.x, s.y, panel.w * view.scale, panel.h * view.scale);
    }

    if (image && placement) {
      const rect = imageRect();
      const origin = netToScreen(rect.x, rect.y);
      const dw = rect.w * view.scale;
      const dh = rect.h * view.scale;
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.drawImage(image, origin.x, origin.y, dw, dh);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      for (const key of keys) {
        const panel = layout.panels[key];
        const s = netToScreen(panel.x, panel.y);
        ctx.rect(s.x, s.y, panel.w * view.scale, panel.h * view.scale);
      }
      ctx.clip();
      ctx.drawImage(image, origin.x, origin.y, dw, dh);
      ctx.restore();
    }

    for (const key of keys) {
      const face = faceImages[key];
      if (!face) continue;
      const panel = layout.panels[key];
      const s = netToScreen(panel.x, panel.y);
      drawCoverImage(ctx, face, s.x, s.y, panel.w * view.scale, panel.h * view.scale);
    }

    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    strokeNet(ctx, layout, view.scale);
    ctx.restore();

    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.fillStyle = 'rgba(36, 36, 42, 0.78)';
    for (const key of keys) {
      const panel = layout.panels[key];
      if (panel.w * view.scale < 42 || panel.h * view.scale < 28) continue;
      const s = netToScreen(panel.x, panel.y);
      ctx.strokeText(LABELS[key], s.x + 6, s.y + 5);
      ctx.fillText(LABELS[key], s.x + 6, s.y + 5);
    }

    const rect = imageRect();
    if (rect) {
      const origin = netToScreen(rect.x, rect.y);
      ctx.save();
      ctx.strokeStyle = '#6f4bff';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(origin.x, origin.y, rect.w * view.scale, rect.h * view.scale);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3c7dff';
      ctx.lineWidth = 1.5;
      for (const handle of handles()) {
        const s = netToScreen(handle.x, handle.y);
        ctx.fillRect(s.x - HANDLE, s.y - HANDLE, HANDLE * 2, HANDLE * 2);
        ctx.strokeRect(s.x - HANDLE, s.y - HANDLE, HANDLE * 2, HANDLE * 2);
      }
      ctx.restore();
    }
  }

  return { setState, resize, resetView };
}

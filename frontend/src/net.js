/** 十字刀版：左、正、右、背横排，上、下接在正面。单位与传入尺寸一致。 */
export function netLayout(width, height, depth) {
  return {
    totalW: depth + width + depth + width,
    totalH: depth + height + depth,
    panels: {
      top: { x: depth, y: 0, w: width, h: depth },
      left: { x: 0, y: depth, w: depth, h: height },
      front: { x: depth, y: depth, w: width, h: height },
      right: { x: depth + width, y: depth, w: depth, h: height },
      back: { x: depth + width + depth, y: depth, w: width, h: height },
      bottom: { x: depth, y: depth + height, w: width, h: depth },
    },
  };
}

export const PANEL_KEYS = ['front', 'back', 'left', 'right', 'top', 'bottom'];

function clipDraw(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh) {
  const x1 = sx;
  const y1 = sy;
  const x2 = sx + sw;
  const y2 = sy + sh;
  const cx1 = Math.max(x1, 0);
  const cy1 = Math.max(y1, 0);
  const cx2 = Math.min(x2, image.width);
  const cy2 = Math.min(y2, image.height);
  if (cx2 <= cx1 || cy2 <= cy1) return;
  const destX = dx + ((cx1 - x1) / sw) * dw;
  const destY = dy + ((cy1 - y1) / sh) * dh;
  const destW = ((cx2 - cx1) / sw) * dw;
  const destH = ((cy2 - cy1) / sh) * dh;
  ctx.drawImage(image, cx1, cy1, cx2 - cx1, cy2 - cy1, destX, destY, destW, destH);
}

/** 整张图按原比例放进刀版并居中，不裁切。宽高可以之后单独拉开。 */
export function containPlacement(image, layout) {
  const mmPerPx = Math.min(layout.totalW / image.width, layout.totalH / image.height);
  const w = image.width * mmPerPx;
  const h = image.height * mmPerPx;
  return {
    x: (layout.totalW - w) / 2,
    y: (layout.totalH - h) / 2,
    w,
    h,
  };
}

/** 宽高分别拉到和刀版一样大，铺满整个展开面。 */
export function fillPlacement(layout) {
  return { x: 0, y: 0, w: layout.totalW, h: layout.totalH };
}

export function placementPercents(layout, placement) {
  return {
    x: Math.round((placement.w / layout.totalW) * 100),
    y: Math.round((placement.h / layout.totalH) * 100),
  };
}

/** 以图案中心为锚点，分别改宽度、高度。100% 表示该边和刀版一样长。 */
export function placementFromPercents(layout, placement, percentX, percentY) {
  const w = layout.totalW * (percentX / 100);
  const h = layout.totalH * (percentY / 100);
  const cx = placement.x + placement.w / 2;
  const cy = placement.y + placement.h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** 按展开面上的图案位置裁出单个盒面。 */
export function drawCoverImage(ctx, image, x, y, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

export function paintPanelCanvas(image, layout, key, placement, paperColor, ppmCap = 10, faceImage = null) {
  const panel = layout.panels[key];
  const longEdge = Math.max(panel.w, panel.h);
  const ppm = Math.min(ppmCap, 1800 / longEdge);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(panel.w * ppm));
  canvas.height = Math.max(2, Math.round(panel.h * ppm));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = paperColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (faceImage) {
    drawCoverImage(ctx, faceImage, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  if (!image || !placement) {
    paintPaperGrain(ctx, paperColor);
    return canvas;
  }

  const sx = ((panel.x - placement.x) / placement.w) * image.width;
  const sy = ((panel.y - placement.y) / placement.h) * image.height;
  const sw = (panel.w / placement.w) * image.width;
  const sh = (panel.h / placement.h) * image.height;
  clipDraw(ctx, image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function paintPaperGrain(ctx, color) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 1400; i += 1) {
    const v = 180 + Math.random() * 60;
    ctx.fillStyle = `rgba(${v},${v - 6},${v - 12},0.18)`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
  }
}

function isBoxNet(layout) {
  const { panels } = layout;
  return Boolean(panels.front && panels.back && panels.left && panels.right && panels.top && panels.bottom);
}

export function dielineGeometry(layout) {
  if (!isBoxNet(layout)) {
    const loops = Object.values(layout.panels).map((panel) => [
      [panel.x, panel.y],
      [panel.x + panel.w, panel.y],
      [panel.x + panel.w, panel.y + panel.h],
      [panel.x, panel.y + panel.h],
    ]);
    return { cut: loops[0] || [], loops, folds: [] };
  }
  const { panels } = layout;
  const width = panels.front.w;
  const height = panels.front.h;
  const x0 = panels.left.x;
  const x1 = panels.front.x;
  const x4 = panels.back.x + panels.back.w;
  const y0 = panels.top.y;
  const y1 = panels.front.y;
  const y2 = panels.bottom.y;
  const y3 = panels.bottom.y + panels.bottom.h;
  return {
    cut: [
      [x1, y0],
      [x1 + width, y0],
      [x1 + width, y1],
      [x4, y1],
      [x4, y2],
      [x1 + width, y2],
      [x1 + width, y3],
      [x1, y3],
      [x1, y2],
      [x0, y2],
      [x0, y1],
      [x1, y1],
    ],
    folds: [
      [panels.front.x, panels.front.y, panels.front.x + panels.front.w, panels.front.y],
      [panels.front.x, panels.bottom.y, panels.front.x + panels.front.w, panels.bottom.y],
      [panels.front.x, panels.front.y, panels.front.x, panels.front.y + panels.front.h],
      [panels.right.x, panels.front.y, panels.right.x, panels.front.y + panels.front.h],
      [panels.back.x, panels.front.y, panels.back.x, panels.front.y + panels.front.h],
    ],
    loops: null,
  };
}

export function strokeNet(ctx, layout, pixelScale = 1) {
  if (!isBoxNet(layout)) {
    const unit = 1 / pixelScale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.strokeStyle = '#3c7dff';
    ctx.lineWidth = 1.6 * unit;
    for (const panel of Object.values(layout.panels)) {
      ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    }
    return;
  }
  const { cut, folds } = dielineGeometry(layout);
  const unit = 1 / pixelScale;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.strokeStyle = '#3c7dff';
  ctx.lineWidth = 1.6 * unit;
  ctx.beginPath();
  cut.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([5 * unit, 4 * unit]);
  ctx.strokeStyle = '#7aa7ff';
  ctx.lineWidth = 1.1 * unit;
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of folds) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** 生成一张和刀版同比例的示例包装图，方便直接看到贴图如何绕到侧面。 */
export function makeSampleArtwork(width, height, depth) {
  const layout = netLayout(width, height, depth);
  const ppm = 5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.totalW * ppm);
  canvas.height = Math.round(layout.totalH * ppm);
  const ctx = canvas.getContext('2d');
  ctx.scale(ppm, ppm);

  const sky = ctx.createLinearGradient(0, 0, layout.totalW, layout.totalH);
  sky.addColorStop(0, '#f7f1e6');
  sky.addColorStop(0.45, '#f3d7c4');
  sky.addColorStop(1, '#e7eef8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, layout.totalW, layout.totalH);

  const front = layout.panels.front;
  const beltY = front.y + front.h * 0.58;
  const beltH = Math.min(18, front.h * 0.12);
  ctx.fillStyle = '#6f4bff';
  ctx.fillRect(0, beltY, layout.totalW, beltH);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, beltY + beltH, layout.totalW, 3.2);

  const top = layout.panels.top;
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.arc(top.x + top.w * 0.5, top.y + top.h * 0.55, Math.min(top.w, top.h) * 0.28, 0, Math.PI * 2);
  ctx.fill();

  const bottom = layout.panels.bottom;
  ctx.fillStyle = '#ef6f4d';
  ctx.fillRect(bottom.x + 8, bottom.y + bottom.h * 0.35, bottom.w - 16, bottom.h * 0.28);

  ctx.fillStyle = '#1d1a17';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.min(front.w, front.h) * 0.16}px "Microsoft YaHei", sans-serif`;
  ctx.fillText('样机预览', front.x + front.w / 2, front.y + front.h * 0.38);
  ctx.font = `500 ${Math.min(front.w, front.h) * 0.055}px "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = '#5c564e';
  ctx.fillText('拖拽旋转查看盒面', front.x + front.w / 2, front.y + front.h * 0.5);

  const right = layout.panels.right;
  ctx.fillStyle = '#1d1a17';
  ctx.font = `600 ${Math.min(right.w, right.h) * 0.16}px "Microsoft YaHei", sans-serif`;
  ctx.fillText('侧面', right.x + right.w / 2, right.y + right.h * 0.36);

  const back = layout.panels.back;
  ctx.fillStyle = '#24324a';
  ctx.font = `700 ${Math.min(back.w, back.h) * 0.14}px "Microsoft YaHei", sans-serif`;
  ctx.fillText('背面', back.x + back.w / 2, back.y + back.h * 0.4);

  const edgeX = front.x + front.w;
  const edgeY = front.y + front.h * 0.28;
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(edgeX, edgeY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(edgeX, edgeY, 6, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

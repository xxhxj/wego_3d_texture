import { cmyk, PDFDocument, rgb } from 'pdf-lib';
import { dielineGeometry, drawCoverImage } from '../net.js';
import { downloadBlob } from './common.js';

const MM = 72 / 25.4;

export function renderDielineCanvas({ layout, image, placement, includeArt, faceImages }) {
  const ppm = Math.min(6, 3600 / Math.max(layout.totalW, layout.totalH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(layout.totalW * ppm));
  canvas.height = Math.max(2, Math.round(layout.totalH * ppm));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (includeArt && image && placement) {
    ctx.save();
    ctx.beginPath();
    for (const panel of Object.values(layout.panels)) {
      ctx.rect(panel.x * ppm, panel.y * ppm, panel.w * ppm, panel.h * ppm);
    }
    ctx.clip();
    ctx.drawImage(
      image,
      placement.x * ppm,
      placement.y * ppm,
      placement.w * ppm,
      placement.h * ppm,
    );
    ctx.restore();
  }
  if (includeArt && faceImages) {
    for (const key of Object.keys(layout.panels)) {
      const face = faceImages[key];
      if (!face) continue;
      const panel = layout.panels[key];
      drawCoverImage(ctx, face, panel.x * ppm, panel.y * ppm, panel.w * ppm, panel.h * ppm);
    }
  }
  return canvas;
}

function lineColors(mode) {
  if (mode === 'cmyk') {
    return {
      cut: cmyk(0, 1, 0, 0),
      fold: cmyk(1, 0, 0, 0),
    };
  }
  return {
    cut: rgb(0.82, 0.05, 0.28),
    fold: rgb(0.1, 0.35, 0.95),
  };
}

function drawDashed(page, x1, y1, x2, y2, color) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const dash = 8;
  const gap = 5;
  const step = dash + gap;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  for (let traveled = 0; traveled < length; traveled += step) {
    const end = Math.min(length, traveled + dash);
    page.drawLine({
      start: { x: x1 + ux * traveled, y: y1 + uy * traveled },
      end: { x: x1 + ux * end, y: y1 + uy * end },
      thickness: 0.6,
      color,
    });
  }
}

export async function exportDieline({
  layout,
  image,
  placement,
  kind,
  colorMode,
  format,
  faceImages,
}) {
  const marginMm = 8;
  const pageWidth = (layout.totalW + marginMm * 2) * MM;
  const pageHeight = (layout.totalH + marginMm * 2) * MM;
  const pdf = await PDFDocument.create();
  pdf.setTitle(kind === 'design' ? '包装设计文件' : '刀线文件');
  pdf.setCreator('包装样机');
  const page = pdf.addPage([pageWidth, pageHeight]);
  const colors = lineColors(colorMode);

  if (kind === 'design') {
    const canvas = renderDielineCanvas({ layout, image, placement, includeArt: true, faceImages });
    const png = await canvasToBytes(canvas);
    const embedded = await pdf.embedPng(png);
    page.drawImage(embedded, {
      x: marginMm * MM,
      y: marginMm * MM,
      width: layout.totalW * MM,
      height: layout.totalH * MM,
    });
  } else {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(1, 1, 1),
    });
  }

  const toPdf = (xMm, yMm) => ({
    x: (marginMm + xMm) * MM,
    y: pageHeight - (marginMm + yMm) * MM,
  });
  const { cut, loops, folds } = dielineGeometry(layout);
  for (const loop of loops || [cut]) {
    for (let index = 0; index < loop.length; index += 1) {
      const a = toPdf(...loop[index]);
      const b = toPdf(...loop[(index + 1) % loop.length]);
      page.drawLine({ start: a, end: b, thickness: 0.8, color: colors.cut });
    }
  }
  for (const [x1, y1, x2, y2] of folds) {
    const a = toPdf(x1, y1);
    const b = toPdf(x2, y2);
    drawDashed(page, a.x, a.y, b.x, b.y, colors.fold);
  }

  const bytes = await pdf.save();
  const extension = format === 'ai' ? 'ai' : 'pdf';
  const label = kind === 'design' ? '设计文件' : '刀线文件';
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${label}-${colorMode}.${extension}`);
  return format === 'ai' ? '已导出 AI 刀版，可用 Illustrator 直接打开。' : '刀版 PDF 已导出。';
}

function canvasToBytes(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

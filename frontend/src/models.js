import { netLayout } from './net.js';

export const FACE_NAMES = {
  front: '正面',
  back: '背面',
  left: '左侧面',
  right: '右侧面',
  top: '顶面',
  bottom: '底面',
  label: '瓶贴',
  cap: '瓶盖',
  lid: '顶盖',
  wall: '杯身',
  gusset: '侧边',
};

export function layoutFor(model) {
  const kind = model.kind || 'box';
  if (kind === 'box') return netLayout(model.w, model.h, model.d);
  if (kind === 'pouch') {
    return {
      totalW: model.w * 2 + model.d * 2,
      totalH: model.h + model.d,
      panels: {
        front: { x: 0, y: model.d, w: model.w, h: model.h },
        left: { x: model.w, y: model.d, w: model.d, h: model.h },
        back: { x: model.w + model.d, y: model.d, w: model.w, h: model.h },
        right: { x: model.w * 2 + model.d, y: model.d, w: model.d, h: model.h },
        bottom: { x: 0, y: 0, w: model.w, h: model.d },
      },
    };
  }
  const circumference = Math.PI * model.d;
  const labelH = kind === 'cup' ? model.h : model.h * 0.68;
  const cap = model.d * (kind === 'can' ? 0.7 : 0.55);
  const labelKey = kind === 'cup' ? 'wall' : 'label';
  const panels = {
    [labelKey]: { x: 0, y: 0, w: circumference, h: labelH },
  };
  if (kind !== 'cup') {
    panels[kind === 'can' ? 'lid' : 'cap'] = {
      x: Math.max(0, (circumference - cap) / 2),
      y: labelH,
      w: cap,
      h: cap,
    };
  }
  return {
    totalW: Math.max(circumference, kind === 'cup' ? 0 : cap),
    totalH: labelH + (kind === 'cup' ? 0 : cap),
    panels,
  };
}

function mix(hex, amount) {
  const value = hex.replace('#', '');
  const channel = (index) => {
    const base = parseInt(value.slice(index, index + 2), 16);
    return Math.max(0, Math.min(255, base + amount));
  };
  const next = [channel(0), channel(2), channel(4)].map((part) => part.toString(16).padStart(2, '0'));
  return `#${next.join('')}`;
}

function drawBoxThumb(ctx, model, width, height) {
  const max = Math.max(model.w + model.d * 0.55, model.h + model.d * 0.35);
  const scale = (Math.min(width, height) * 0.62) / max;
  const frontW = model.w * scale;
  const frontH = model.h * scale;
  const side = model.d * scale * 0.5;
  const lift = model.d * scale * 0.28;
  const originX = width * 0.46 - side * 0.35;
  const originY = height * 0.72;
  const lid = model.fold < 0.9 ? (1 - model.fold) * Math.min(28, frontH * 0.45) : 0;

  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#cfc9c0';
  ctx.fillStyle = mix(model.tint, 14);
  ctx.beginPath();
  ctx.moveTo(originX, originY - frontH);
  ctx.lineTo(originX + side, originY - frontH - lift - lid);
  ctx.lineTo(originX + frontW + side, originY - frontH - lift - lid);
  ctx.lineTo(originX + frontW, originY - frontH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = model.tint;
  ctx.beginPath();
  ctx.rect(originX, originY - frontH, frontW, frontH);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = mix(model.tint, -18);
  ctx.beginPath();
  ctx.moveTo(originX + frontW, originY - frontH);
  ctx.lineTo(originX + frontW + side, originY - frontH - lift);
  ctx.lineTo(originX + frontW + side, originY - lift);
  ctx.lineTo(originX + frontW, originY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawRoundThumb(ctx, model, width, height) {
  const kind = model.kind;
  const max = Math.max(model.d, model.h);
  const scale = (Math.min(width, height) * 0.7) / max;
  const radius = (model.d * scale) / 2;
  const bodyH = model.h * scale * (kind === 'cup' ? 0.82 : kind === 'can' ? 0.86 : 0.62);
  const cx = width * 0.5;
  const base = height * 0.78;
  ctx.fillStyle = model.tint;
  ctx.strokeStyle = '#cfc9c0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, base - bodyH, radius, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(cx - radius, base - bodyH, radius * 2, bodyH);
  ctx.beginPath();
  ctx.ellipse(cx, base, radius, radius * 0.28, 0, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - radius, base - bodyH);
  ctx.lineTo(cx - radius, base);
  ctx.moveTo(cx + radius, base - bodyH);
  ctx.lineTo(cx + radius, base);
  ctx.stroke();
  if (kind !== 'cup') {
    const neck = radius * (model.profile === 'jar' ? 0.72 : model.profile === 'slim' ? 0.36 : 0.46);
    const neckH = model.h * scale * 0.16;
    ctx.fillStyle = mix(model.tint, -8);
    ctx.fillRect(cx - neck, base - bodyH - neckH, neck * 2, neckH);
    ctx.strokeRect(cx - neck, base - bodyH - neckH, neck * 2, neckH);
    ctx.fillStyle = kind === 'can' ? '#d9dce3' : '#f7f4ee';
    ctx.fillRect(cx - neck - 3, base - bodyH - neckH - 10, (neck + 3) * 2, 10);
    ctx.strokeRect(cx - neck - 3, base - bodyH - neckH - 10, (neck + 3) * 2, 10);
  }
}

function drawPouchThumb(ctx, model, width, height) {
  const scale = (Math.min(width, height) * 0.62) / Math.max(model.w, model.h);
  const bagW = model.w * scale;
  const bagH = model.h * scale;
  const x = (width - bagW) / 2;
  const y = height * 0.78 - bagH;
  ctx.fillStyle = model.tint;
  ctx.strokeStyle = '#cfc9c0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x + bagW - 8, y);
  ctx.lineTo(x + bagW, y + bagH);
  ctx.lineTo(x, y + bagH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (model.handle) {
    ctx.beginPath();
    ctx.arc(width / 2, y + 2, bagW * 0.16, Math.PI, 0);
    ctx.stroke();
  }
}

export function drawModelThumb(canvas, model) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f3f3f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const kind = model.kind || 'box';
  if (kind === 'bottle' || kind === 'can' || kind === 'cup') drawRoundThumb(ctx, model, canvas.width, canvas.height);
  else if (kind === 'pouch') drawPouchThumb(ctx, model, canvas.width, canvas.height);
  else drawBoxThumb(ctx, model, canvas.width, canvas.height);
}

export function makeLabelArtwork(layout, title) {
  const ppm = 4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(layout.totalW * ppm));
  canvas.height = Math.max(2, Math.round(layout.totalH * ppm));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f8fb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#6f4bff';
  ctx.fillRect(0, canvas.height * 0.62, canvas.width, Math.max(8, canvas.height * 0.1));
  ctx.fillStyle = '#1d1a17';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(16, canvas.width * 0.07)}px "Microsoft YaHei", sans-serif`;
  ctx.fillText(title, canvas.width / 2, canvas.height * 0.36);
  return canvas;
}

import { netLayout } from './net.js';

export const CATEGORIES = [
  { id: 'box', name: '盒子' },
  { id: 'bottle', name: '瓶子' },
  { id: 'food', name: '食品包装' },
  { id: 'bag', name: '袋子' },
];

export const MODELS = [
  { id: 'tall', category: 'box', name: '立式盒', w: 120, d: 60, h: 160, fold: 1, tint: '#f7f4ee' },
  { id: 'cube', category: 'box', name: '正方盒', w: 140, d: 140, h: 140, fold: 1, tint: '#ffffff' },
  { id: 'kraft', category: 'box', name: '牛皮方盒', w: 130, d: 130, h: 130, fold: 1, tint: '#c6a36a', paper: 'kraft' },
  { id: 'grey', category: 'box', name: '灰板盒', w: 150, d: 110, h: 90, fold: 1, tint: '#d7d7d7', paper: 'grey' },
  { id: 'flat', category: 'box', name: '扁平盒', w: 240, d: 180, h: 48, fold: 1, tint: '#f4ecdc' },
  { id: 'lid', category: 'box', name: '翻盖盒', w: 180, d: 140, h: 70, fold: 0.62, tint: '#efe8ff' },
  { id: 'mailer', category: 'box', name: '邮寄盒', w: 260, d: 180, h: 40, fold: 0.42, tint: '#f6efe4' },
  { id: 'tube', category: 'box', name: '长条盒', w: 70, d: 45, h: 240, fold: 1, tint: '#f6f1e7' },

  { id: 'bottle', category: 'bottle', kind: 'bottle', name: '圆瓶', w: 70, d: 70, h: 220, fold: 1, tint: '#e7f2f6', profile: 'standard' },
  { id: 'slim', category: 'bottle', kind: 'bottle', name: '细颈瓶', w: 52, d: 52, h: 280, fold: 1, tint: '#d9ebf2', profile: 'slim' },
  { id: 'jar', category: 'bottle', kind: 'bottle', name: '广口瓶', w: 96, d: 96, h: 150, fold: 0.72, tint: '#f3f7f4', profile: 'jar' },
  { id: 'vial', category: 'bottle', kind: 'bottle', name: '小药瓶', w: 42, d: 42, h: 110, fold: 1, tint: '#eef6f8', profile: 'slim' },

  { id: 'can', category: 'food', kind: 'can', name: '易拉罐', w: 66, d: 66, h: 123, fold: 1, tint: '#e6e8ee' },
  { id: 'cup', category: 'food', kind: 'cup', name: '纸杯', w: 90, d: 80, h: 120, fold: 1, tint: '#fff7ef' },
  { id: 'lunch', category: 'food', kind: 'box', name: '餐盒', w: 190, d: 140, h: 55, fold: 0.58, tint: '#fff4e8' },
  { id: 'pizza', category: 'food', kind: 'box', name: '披萨盒', w: 240, d: 240, h: 36, fold: 0.5, tint: '#f8efe4', paper: 'kraft' },

  { id: 'shopper', category: 'bag', kind: 'pouch', name: '手提袋', w: 180, d: 80, h: 220, fold: 0.82, tint: '#f4ecdc', paper: 'kraft', handle: true },
  { id: 'paper-bag', category: 'bag', kind: 'pouch', name: '纸袋', w: 140, d: 70, h: 200, fold: 1, tint: '#f7f1e6', paper: 'kraft' },
  { id: 'stand', category: 'bag', kind: 'pouch', name: '自立袋', w: 120, d: 60, h: 180, fold: 0.7, tint: '#efe8ff' },
  { id: 'mailer-bag', category: 'bag', kind: 'pouch', name: '快递袋', w: 260, d: 28, h: 340, fold: 1, tint: '#f3f3f5', paper: 'grey' },
];

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

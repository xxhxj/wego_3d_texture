const THEMES = [
  { brand: 'NORTH', line: 'DAILY GOODS', bg: '#f7f3ec', ink: '#1c1c1f', accent: '#1f4b3a' },
  { brand: 'LUMEN', line: 'SOFT LIGHT', bg: '#f4f1ff', ink: '#241c3a', accent: '#6f4bff' },
  { brand: 'HARBOR', line: 'SEA SALT', bg: '#f2f7f8', ink: '#163038', accent: '#2c6e86' },
  { brand: 'KILN', line: 'SLOW ROAST', bg: '#f6efe4', ink: '#3a2918', accent: '#a8642c' },
  { brand: 'PETAL', line: 'IN BLOOM', bg: '#fff4f7', ink: '#5a3140', accent: '#d56b8a' },
  { brand: 'FOLIO', line: 'PAPER MAIL', bg: '#f6f4ef', ink: '#211c17', accent: '#111111' },
  { brand: 'CINDER', line: 'WARM CRAFT', bg: '#f8f1e8', ink: '#3a2416', accent: '#c4512c' },
  { brand: 'MIST', line: 'CLEAR WATER', bg: '#f3f6fb', ink: '#243044', accent: '#5d7594' },
];

function themeFor(id) {
  let index = 0;
  for (const char of id) index = (index + char.charCodeAt(0)) % THEMES.length;
  return THEMES[index];
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char]));
}

function netLayout(width, height, depth) {
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

function labelLayout(model) {
  const kind = model.kind || 'box';
  if (kind === 'box') return netLayout(model.w, model.h, model.d);
  if (kind === 'pouch') {
    return {
      totalW: model.w * 2 + model.d * 2,
      totalH: model.h + model.d,
      panels: {
        front: { x: 0, y: model.d, w: model.w, h: model.h },
        back: { x: model.w + model.d, y: model.d, w: model.w, h: model.h },
      },
    };
  }
  const circumference = Math.PI * model.d;
  const labelH = kind === 'cup' ? model.h : model.h * 0.68;
  return {
    totalW: circumference,
    totalH: labelH + (kind === 'cup' ? 0 : model.d * 0.55),
    panels: {
      front: { x: 0, y: 0, w: circumference, h: labelH },
    },
  };
}

function panelArt(panel, theme, title, primary) {
  const name = escapeXml(title);
  const brand = escapeXml(theme.brand);
  const line = escapeXml(theme.line);
  if (!primary) {
    return `<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" fill="${theme.accent}"/>
      <text x="${panel.x + panel.w / 2}" y="${panel.y + panel.h / 2}" text-anchor="middle" fill="#ffffff" font-size="${Math.max(8, Math.min(panel.w, panel.h) * 0.16)}" font-family="Arial, Microsoft YaHei, sans-serif">${brand}</text>`;
  }
  const bar = Math.max(10, panel.h * 0.16);
  return `<rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" fill="${theme.bg}"/>
    <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${bar}" fill="${theme.accent}"/>
    <text x="${panel.x + 8}" y="${panel.y + bar * 0.68}" fill="#ffffff" font-size="${Math.max(8, bar * 0.46)}" font-family="Arial, sans-serif">${brand}</text>
    <text x="${panel.x + panel.w / 2}" y="${panel.y + panel.h * 0.48}" text-anchor="middle" fill="${theme.ink}" font-size="${Math.max(12, Math.min(panel.w, panel.h) * 0.14)}" font-family="Arial, Microsoft YaHei, sans-serif" font-weight="700">${line}</text>
    <text x="${panel.x + panel.w / 2}" y="${panel.y + panel.h * 0.64}" text-anchor="middle" fill="${theme.ink}" opacity="0.72" font-size="${Math.max(8, Math.min(panel.w, panel.h) * 0.07)}" font-family="Microsoft YaHei, sans-serif">${name}</text>
    <rect x="${panel.x}" y="${panel.y + panel.h - bar * 0.7}" width="${panel.w}" height="${bar * 0.7}" fill="${theme.accent}"/>`;
}

export function artSvg(model) {
  const theme = themeFor(model.id);
  const layout = labelLayout(model);
  const ppm = layout.totalW > 900 ? 2 : 4;
  const width = Math.round(layout.totalW * ppm);
  const height = Math.round(layout.totalH * ppm);
  const scale = (panel) => ({
    x: +(panel.x * ppm).toFixed(2),
    y: +(panel.y * ppm).toFixed(2),
    w: +(panel.w * ppm).toFixed(2),
    h: +(panel.h * ppm).toFixed(2),
  });
  const parts = Object.entries(layout.panels).map(([key, panel]) => (
    panelArt(scale(panel), theme, model.name, key === 'front' || key === 'back')
  ));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${theme.bg}"/>
  ${parts.join('\n  ')}
</svg>`;
}

function coverBox(theme, name) {
  const title = escapeXml(name);
  return `<polygon points="318,78 392,48 392,318 318,348" fill="${theme.accent}" opacity="0.55"/>
    <polygon points="86,78 318,78 392,48 160,48" fill="#ffffff" opacity="0.55"/>
    <rect x="86" y="78" width="232" height="270" rx="2" fill="${theme.bg}"/>
    <rect x="86" y="78" width="232" height="62" fill="${theme.accent}"/>
    <text x="104" y="118" fill="#ffffff" font-size="28" font-family="Arial, sans-serif">${escapeXml(theme.brand)}</text>
    <text x="202" y="210" text-anchor="middle" fill="${theme.ink}" font-size="26" font-family="Arial, sans-serif">${escapeXml(theme.line)}</text>
    <text x="202" y="248" text-anchor="middle" fill="${theme.ink}" font-size="18" font-family="Microsoft YaHei, sans-serif">${title}</text>
    <rect x="86" y="286" width="232" height="62" fill="${theme.accent}"/>`;
}

function coverRound(theme, name) {
  return `<ellipse cx="240" cy="86" rx="78" ry="18" fill="#ffffff"/>
    <path d="M162 86 h156 v250 a78 24 0 0 1 -156 0 z" fill="${theme.bg}" stroke="#e4dfd8"/>
    <rect x="162" y="168" width="156" height="110" fill="${theme.accent}"/>
    <text x="240" y="214" text-anchor="middle" fill="#ffffff" font-size="26" font-family="Arial, sans-serif">${escapeXml(theme.brand)}</text>
    <text x="240" y="248" text-anchor="middle" fill="#ffffff" font-size="16" font-family="Microsoft YaHei, sans-serif">${escapeXml(name)}</text>
    <rect x="206" y="58" width="68" height="30" rx="8" fill="#f4f4f6" stroke="#e4dfd8"/>`;
}

function coverBag(theme, name) {
  return `<path d="M118 96 h244 l-24 270 h-196 z" fill="${theme.bg}" stroke="#e4dfd8"/>
    <path d="M118 96 h244 l-28 52 h-188 z" fill="${theme.accent}"/>
    <text x="240" y="130" text-anchor="middle" fill="#ffffff" font-size="24" font-family="Arial, sans-serif">${escapeXml(theme.brand)}</text>
    <text x="240" y="230" text-anchor="middle" fill="${theme.ink}" font-size="28" font-family="Arial, sans-serif">${escapeXml(theme.line)}</text>
    <text x="240" y="268" text-anchor="middle" fill="${theme.ink}" font-size="18" font-family="Microsoft YaHei, sans-serif">${escapeXml(name)}</text>
    <rect x="142" y="300" width="196" height="36" fill="${theme.accent}"/>`;
}

export function coverSvg(model) {
  const theme = themeFor(model.id);
  const kind = model.kind || 'box';
  const shape = kind === 'bottle' || kind === 'can' || kind === 'cup'
    ? coverRound(theme, model.name)
    : kind === 'pouch'
      ? coverBag(theme, model.name)
      : coverBox(theme, model.name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
  <rect width="480" height="480" fill="#efefef"/>
  <ellipse cx="240" cy="372" rx="128" ry="18" fill="#dedee2"/>
  ${shape}
</svg>`;
}

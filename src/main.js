import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { renderDielineCanvas, exportDieline } from './export/dieline.js';
import { exportViewerHtml } from './export/html.js';
import { exportMockup } from './export/mockup.js';
import { recordTurntable, VIDEO_STYLES } from './export/video.js';
import { createDielineEditor } from './dielineEditor.js';
import { createShape } from './shapes.js';
import { CATEGORIES, drawModelThumb, FACE_NAMES, layoutFor, makeLabelArtwork, MODELS } from './models.js';
import {
  containPlacement,
  fillPlacement,
  makeSampleArtwork,
  paintPanelCanvas,
  placementFromPercents,
  placementPercents,
} from './net.js';

const MM = 0.01;

const PAPERS = {
  white: { edge: '#f4f0e8', inside: '#f6f1e7' },
  kraft: { edge: '#c6a36a', inside: '#e4c89a' },
  grey: { edge: '#d7d7d7', inside: '#efefef' },
};

const state = {
  w: 120,
  h: 160,
  d: 60,
  fold: 1,
  paper: 'white',
  inside: '#f6f1e7',
  image: null,
  imageName: '示例包装图',
  placement: null,
  modelId: 'tall',
  kind: 'box',
  faceImages: {},
  pickedFace: null,
};

const stage = document.querySelector('#stage');
const preview = document.querySelector('#preview');
const fileName = document.querySelector('#file-name');
const foldInput = document.querySelector('#fold');
const artScaleX = document.querySelector('#art-scale-x');
const artScaleY = document.querySelector('#art-scale-y');
const artScaleXLabel = document.querySelector('#art-scale-x-label');
const artScaleYLabel = document.querySelector('#art-scale-y-label');

const editor = createDielineEditor(preview, {
  onChange: (placement) => {
    state.placement = placement;
    syncScaleLabel();
    scheduleTextures(4);
  },
  onCommit: () => scheduleTextures(10),
});

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.classList.add('view');
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.95;
controls.minPolarAngle = 0.08;
controls.autoRotateSpeed = 1.4;

const hemi = new THREE.HemisphereLight(0xffffff, 0xc8c8c8, 0.7);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(3.2, 6.5, 4.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.2;
key.shadow.camera.far = 24;
key.shadow.bias = -0.00015;
key.shadow.normalBias = 0.02;
scene.add(key);
scene.add(key.target);
const fill = new THREE.DirectionalLight(0xdde7ff, 0.55);
fill.position.set(-4.5, 2.4, 2);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xfff4e8, 0.35);
rim.position.set(-1, 3.5, -5);
scene.add(rim);

const shadowTex = makeShadowTexture();
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
);
blob.rotation.x = -Math.PI / 2;
blob.renderOrder = -1;
scene.add(blob);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.ShadowMaterial({ opacity: 0.16 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

let box = null;
let framing = true;

function worldSize() {
  return {
    width: state.w * MM,
    height: state.h * MM,
    depth: state.d * MM,
    thickness: 1.4 * MM,
  };
}

function currentModel() {
  return MODELS.find((item) => item.id === state.modelId) || {
    id: state.modelId,
    kind: state.kind || 'box',
    w: state.w,
    h: state.h,
    d: state.d,
    fold: state.fold,
    name: '包装',
  };
}

function currentLayout() {
  const model = currentModel();
  return layoutFor({ ...model, w: state.w, h: state.h, d: state.d });
}

function syncScaleLabel() {
  if (!state.image || !state.placement) {
    artScaleX.value = '100';
    artScaleY.value = '100';
    artScaleXLabel.textContent = '100%';
    artScaleYLabel.textContent = '100%';
    return;
  }
  const percents = placementPercents(currentLayout(), state.placement);
  artScaleX.value = String(Math.min(400, Math.max(15, percents.x)));
  artScaleY.value = String(Math.min(400, Math.max(15, percents.y)));
  artScaleXLabel.textContent = `${percents.x}%`;
  artScaleYLabel.textContent = `${percents.y}%`;
}

function syncEditor() {
  editor.setState({
    layout: currentLayout(),
    image: state.image,
    placement: state.placement,
    paper: PAPERS[state.paper].edge,
    faceImages: state.faceImages,
  });
  syncScaleLabel();
}

function makeTextures(ppmCap = 10) {
  const layout = currentLayout();
  const paper = PAPERS[state.paper].edge;
  const textures = {};
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  for (const key of Object.keys(layout.panels)) {
    const canvas = paintPanelCanvas(
      state.image,
      layout,
      key,
      state.placement,
      paper,
      ppmCap,
      state.faceImages[key],
    );
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    textures[key] = tex;
  }
  return textures;
}

let textureJob = 0;
function scheduleTextures(ppmCap) {
  textureJob = ppmCap;
  if (scheduleTextures.queued) return;
  scheduleTextures.queued = true;
  requestAnimationFrame(() => {
    scheduleTextures.queued = false;
    const cap = textureJob;
    if (!box) {
      rebuildBox();
      return;
    }
    box.setTextures(makeTextures(cap));
  });
}

function rebuildBox() {
  if (box) box.dispose();
  const size = worldSize();
  box = createShape(currentModel(), {
    ...size,
    textures: makeTextures(),
    edgeColor: PAPERS[state.paper].edge,
    insideColor: state.inside,
  });
  scene.add(box.root);
  applyFold();
  if (framing) frameCamera();
}

function applyFold() {
  if (!box) return;
  const scale = box.setFold(state.fold);
  const size = worldSize();
  const kind = currentModel().kind || 'box';
  const lowest = kind === 'box'
    ? (size.height / 2 + size.thickness / 2 + (1 - state.fold) * size.depth) * scale
    : size.height / 2;
  ground.position.y = -lowest - 0.004;
  blob.position.y = ground.position.y + 0.002;
  const footprint = Math.max(size.width, size.depth) * (1.15 + (1 - state.fold) * 0.85);
  blob.scale.set(footprint * 2.4, footprint * 2.4, 1);
  const shadowReach = Math.max(size.width, size.height, size.depth) * 3.2;
  key.shadow.camera.left = -shadowReach;
  key.shadow.camera.right = shadowReach;
  key.shadow.camera.top = shadowReach;
  key.shadow.camera.bottom = -shadowReach;
  key.shadow.camera.updateProjectionMatrix();
  key.target.position.set(0, 0, 0);
  key.target.updateMatrixWorld();
}

function frameCamera() {
  const size = worldSize();
  const radius = Math.max(size.width, size.height, size.depth) * 1.55;
  camera.position.set(radius * 0.95, radius * 0.72, radius * 1.35);
  controls.target.set(0, size.height * 0.02, 0);
  controls.minDistance = radius * 0.45;
  controls.maxDistance = radius * 5;
  controls.update();
}

function resize() {
  const width = stage.clientWidth || 1;
  const height = stage.clientHeight || 1;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setImage(image, name) {
  state.image = image;
  state.imageName = name;
  state.placement = image ? containPlacement(image, currentLayout()) : null;
  if (!image) state.faceImages = {};
  fileName.textContent = image ? `当前：${name}` : '当前：白卡盒（未贴图）';
  syncEditor();
  rebuildBox();
}

function setFaceImage(key, image) {
  if (image) state.faceImages[key] = image;
  else delete state.faceImages[key];
  const count = Object.keys(state.faceImages).length;
  if (count) fileName.textContent = `已单独贴图 ${count} 个面`;
  syncEditor();
  scheduleTextures(10);
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    setImage(img, file.name);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    fileName.textContent = '这张图片无法读取，请换一张 JPG 或 PNG。';
  };
  img.src = url;
}

function sampleForCurrent() {
  const model = currentModel();
  if ((model.kind || 'box') === 'box') return makeSampleArtwork(state.w, state.h, state.d);
  return makeLabelArtwork(currentLayout(), model.name || '包装');
}

function useSample() {
  setImage(sampleForCurrent(), '示例包装图');
}

function applyPaper(paper) {
  if (!paper || !PAPERS[paper]) return;
  state.paper = paper;
  state.inside = PAPERS[paper].inside;
  document.querySelector('#inside').value = state.inside;
  document.querySelectorAll('[data-paper]').forEach((item) => {
    item.classList.toggle('active', item.dataset.paper === paper);
  });
}

let frameHook = null;
let shadowOn = true;

function setShadowVisible(visible) {
  const previous = shadowOn;
  shadowOn = visible;
  ground.visible = visible;
  blob.visible = visible;
  return previous;
}

function choiceValue(name) {
  return document.querySelector(`[data-choice="${name}"] .active`)?.dataset.value;
}

function setStatus(message) {
  document.querySelector('#export-status').textContent = message || '';
}

function refreshExportPreview() {
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
  document.querySelector('#export-preview').src = out.toDataURL('image/jpeg', 0.7);
  const preview = document.querySelector('#export-dieline-preview');
  const source = renderDielineCanvas({
    layout: currentLayout(),
    image: state.image,
    placement: state.placement,
    includeArt: choiceValue('dieline-kind') !== 'cut',
    faceImages: state.faceImages,
  });
  preview.width = source.width;
  preview.height = source.height;
  preview.getContext('2d').drawImage(source, 0, 0);
}

function openExport() {
  document.querySelector('#export-dialog').hidden = false;
  refreshExportPreview();
  setStatus('');
}

function closeExport() {
  document.querySelector('#export-dialog').hidden = true;
}

function showExportPanel(name) {
  document.querySelectorAll('[data-export-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.exportTab === name);
  });
  document.querySelectorAll('[data-export-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.exportPanel !== name;
  });
  const dieline = name === 'dieline';
  document.querySelector('#export-preview').hidden = dieline;
  document.querySelector('#export-dieline-preview').hidden = !dieline;
  document.querySelector('.export-options').scrollTop = 0;
  if (dieline) refreshExportPreview();
}

async function runExport(button, task) {
  button.disabled = true;
  setStatus('正在导出…');
  try {
    setStatus(await task());
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '导出失败。');
  } finally {
    button.disabled = false;
  }
}

function zoom(factor) {
  const offset = camera.position.clone().sub(controls.target);
  const next = offset.length() * factor;
  const clamped = THREE.MathUtils.clamp(next, controls.minDistance, controls.maxDistance);
  offset.setLength(clamped);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

function readSizes() {
  const read = (id, fallback) => {
    const value = Number(document.querySelector(id).value);
    return Number.isFinite(value) ? value : fallback;
  };
  state.w = THREE.MathUtils.clamp(read('#size-w', state.w), 30, 600);
  state.d = THREE.MathUtils.clamp(read('#size-d', state.d), 20, 600);
  state.h = THREE.MathUtils.clamp(read('#size-h', state.h), 30, 800);
}

document.querySelector('#file').addEventListener('change', (event) => {
  const [file] = event.target.files || [];
  loadFile(file);
  event.target.value = '';
});

const zone = document.querySelector('#upload-zone');
zone.addEventListener('dragover', (event) => {
  event.preventDefault();
  zone.classList.add('dragover');
});
zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
zone.addEventListener('drop', (event) => {
  event.preventDefault();
  zone.classList.remove('dragover');
  const [file] = event.dataTransfer.files || [];
  loadFile(file);
});

stage.addEventListener('dragover', (event) => event.preventDefault());
stage.addEventListener('drop', (event) => {
  event.preventDefault();
  const [file] = event.dataTransfer.files || [];
  loadFile(file);
});

document.querySelector('#sample').addEventListener('click', () => useSample());
document.querySelector('#clear').addEventListener('click', () => setImage(null, '白卡盒（未贴图）'));
document.querySelector('#export-top').addEventListener('click', openExport);
document.querySelector('#export-bottom').addEventListener('click', openExport);
document.querySelector('#export-close').addEventListener('click', closeExport);
document.querySelectorAll('[data-close-export]').forEach((node) => {
  node.addEventListener('click', closeExport);
});
document.querySelectorAll('[data-export-tab]').forEach((button) => {
  button.addEventListener('click', () => showExportPanel(button.dataset.exportTab));
});
document.querySelectorAll('.choice').forEach((group) => {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !group.contains(button)) return;
    group.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
    if (group.dataset.choice === 'dieline-kind') refreshExportPreview();
  });
});

const videoStyles = document.querySelector('#video-styles');
for (const style of VIDEO_STYLES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `video-style${style.id === 'orbit' ? ' active' : ''}`;
  button.dataset.style = style.id;
  button.innerHTML = `<b>${style.name}</b><i>${style.seconds}s</i>`;
  button.addEventListener('click', () => {
    videoStyles.querySelectorAll('.video-style').forEach((item) => {
      item.classList.toggle('active', item === button);
    });
  });
  videoStyles.append(button);
}

document.querySelector('#export-mockup').addEventListener('click', (event) => {
  runExport(event.currentTarget, () => exportMockup({
    renderer,
    scene,
    camera,
    viewWidth: stage.clientWidth,
    viewHeight: stage.clientHeight,
    setShadowVisible,
    format: choiceValue('mockup-format'),
    resolution: choiceValue('mockup-size'),
    withShadow: document.querySelector('#export-shadow').checked,
  }));
});

document.querySelector('#export-dieline').addEventListener('click', (event) => {
  runExport(event.currentTarget, () => exportDieline({
    layout: currentLayout(),
    image: state.image,
    placement: state.placement,
    kind: choiceValue('dieline-kind'),
    colorMode: choiceValue('dieline-color'),
    format: choiceValue('dieline-format'),
    faceImages: state.faceImages,
  }));
});

document.querySelector('#export-video').addEventListener('click', (event) => {
  const note = document.querySelector('#export-video-note');
  note.hidden = false;
  runExport(event.currentTarget, () => recordTurntable({
    renderer,
    camera,
    controls,
    viewWidth: stage.clientWidth,
    viewHeight: stage.clientHeight,
    getRadius: () => Math.max(state.w, state.h, state.d) * MM * 1.55,
    getTargetY: () => state.h * MM * 0.02,
    getFold: () => state.fold,
    setFold: (value) => {
      state.fold = value;
      foldInput.value = String(Math.round(value * 100));
      applyFold();
    },
    setFrameHook: (hook) => {
      frameHook = hook;
    },
    style: videoStyles.querySelector('.video-style.active')?.dataset.style || 'orbit',
    format: choiceValue('video-format'),
    resolution: choiceValue('video-size'),
    fast: document.querySelector('#export-fast').checked,
  })).finally(() => {
    note.hidden = true;
  });
});

document.querySelector('#export-html').addEventListener('click', (event) => {
  runExport(event.currentTarget, async () => {
    const faces = {};
    const layout = currentLayout();
    for (const key of Object.keys(layout.panels)) {
      const canvas = paintPanelCanvas(
        state.image,
        layout,
        key,
        state.placement,
        PAPERS[state.paper].edge,
        6,
        state.faceImages[key],
      );
      faces[key] = canvas.toDataURL('image/jpeg', 0.86);
    }
    const fallback = faces.front || faces.label || faces.wall || faces.back;
    for (const key of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      if (!faces[key] && fallback) faces[key] = fallback;
    }
    const html = exportViewerHtml({
      width: state.w,
      height: state.h,
      depth: state.d,
      faces,
    });
    const code = document.querySelector('#export-html-code');
    code.hidden = false;
    code.value = html;
    document.querySelector('#export-copy').hidden = false;
    return 'HTML 已下载，也可以在下面复制代码。';
  });
});

document.querySelector('#export-copy').addEventListener('click', async () => {
  const code = document.querySelector('#export-html-code').value;
  try {
    await navigator.clipboard.writeText(code);
    setStatus('代码已复制。');
  } catch {
    setStatus('复制失败，请在文本框里手动复制。');
  }
});
document.querySelector('#zoom-in').addEventListener('click', () => zoom(0.86));
document.querySelector('#zoom-out').addEventListener('click', () => zoom(1.16));
document.querySelector('#reset').addEventListener('click', () => frameCamera());

const spinBtn = document.querySelector('#spin');
spinBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  spinBtn.classList.toggle('active', controls.autoRotate);
});

foldInput.addEventListener('input', () => {
  state.fold = Number(foldInput.value) / 100;
  applyFold();
});

function onAxisScale() {
  if (!state.image || !state.placement) return;
  const percentX = Number(artScaleX.value);
  const percentY = Number(artScaleY.value);
  state.placement = placementFromPercents(currentLayout(), state.placement, percentX, percentY);
  artScaleXLabel.textContent = `${percentX}%`;
  artScaleYLabel.textContent = `${percentY}%`;
  syncEditor();
  scheduleTextures(4);
}
artScaleX.addEventListener('input', onAxisScale);
artScaleY.addEventListener('input', onAxisScale);
artScaleX.addEventListener('change', () => scheduleTextures(10));
artScaleY.addEventListener('change', () => scheduleTextures(10));

document.querySelector('#art-fill').addEventListener('click', () => {
  if (!state.image) return;
  state.placement = fillPlacement(currentLayout());
  syncEditor();
  scheduleTextures(10);
});
document.querySelector('#art-reset').addEventListener('click', () => {
  if (!state.image) return;
  state.placement = containPlacement(state.image, currentLayout());
  syncEditor();
  scheduleTextures(10);
});
document.querySelector('#view-reset').addEventListener('click', () => editor.resetView());

document.querySelectorAll('[data-paper]').forEach((button) => {
  button.addEventListener('click', () => {
    state.paper = button.dataset.paper;
    state.inside = PAPERS[state.paper].inside;
    document.querySelector('#inside').value = state.inside;
    document.querySelectorAll('[data-paper]').forEach((item) => {
      item.classList.toggle('active', item === button);
    });
    syncEditor();
    rebuildBox();
  });
});

document.querySelector('#inside').addEventListener('input', (event) => {
  state.inside = event.target.value;
  rebuildBox();
});

let sizeTimer = 0;
function onSizeInput() {
  window.clearTimeout(sizeTimer);
  sizeTimer = window.setTimeout(() => {
    const prev = `${state.w}-${state.h}-${state.d}`;
    readSizes();
    if (prev === `${state.w}-${state.h}-${state.d}`) return;
    const match = MODELS.find((item) => (item.kind || 'box') === state.kind && item.w === state.w && item.d === state.d && item.h === state.h);
    state.modelId = match ? match.id : '';
    markModel();
    if (state.imageName === '示例包装图' && state.image) {
      state.image = sampleForCurrent();
    }
    state.placement = state.image ? containPlacement(state.image, currentLayout()) : null;
    framing = true;
    syncEditor();
    rebuildBox();
  }, 180);
}
document.querySelectorAll('#size-w, #size-h, #size-d').forEach((input) => {
  input.addEventListener('input', onSizeInput);
});

function showPage(page) {
  document.body.dataset.page = page;
  document.querySelectorAll('.rail-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  document.querySelector('[data-page-panel="edit"]').hidden = page !== 'edit';
  document.querySelector('[data-page-panel="mockup"]').hidden = page !== 'mockup';
  hideFaceMenu();
  requestAnimationFrame(() => {
    resize();
    editor.resize();
  });
}

function applyModel(model) {
  const nextKind = model.kind || 'box';
  if (nextKind !== state.kind) state.faceImages = {};
  state.kind = nextKind;
  state.modelId = model.id;
  state.w = model.w;
  state.d = model.d;
  state.h = model.h;
  state.fold = model.fold;
  document.querySelector('#size-w').value = String(model.w);
  document.querySelector('#size-d').value = String(model.d);
  document.querySelector('#size-h').value = String(model.h);
  foldInput.value = String(Math.round(model.fold * 100));
  applyPaper(model.paper || 'white');
  if (state.imageName === '示例包装图' && state.image) {
    state.image = sampleForCurrent();
  }
  state.placement = state.image ? containPlacement(state.image, currentLayout()) : null;
  framing = true;
  markModel();
  syncEditor();
  rebuildBox();
  hideFaceMenu();
}

const modelGrid = document.querySelector('#model-grid');
const modelCats = document.querySelector('#model-cats');
const modelHeading = document.querySelector('#model-heading');
let activeCategory = 'box';

function markModel() {
  modelGrid.querySelectorAll('.model-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.model === state.modelId);
  });
}

function renderModels() {
  const category = CATEGORIES.find((item) => item.id === activeCategory) || CATEGORIES[0];
  modelHeading.textContent = category.name;
  modelCats.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.category === category.id);
  });
  modelGrid.replaceChildren();
  for (const model of MODELS.filter((item) => item.category === category.id)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model-card';
    button.dataset.model = model.id;
    const thumb = document.createElement('canvas');
    thumb.width = 240;
    thumb.height = 160;
    drawModelThumb(thumb, model);
    const name = document.createElement('b');
    name.textContent = model.name;
    const size = document.createElement('small');
    size.textContent = `${model.w} × ${model.d} × ${model.h} mm`;
    button.append(thumb, name, size);
    button.addEventListener('click', () => applyModel(model));
    modelGrid.append(button);
  }
  markModel();
}

for (const category of CATEGORIES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.category = category.id;
  button.textContent = category.name;
  button.addEventListener('click', () => {
    activeCategory = category.id;
    renderModels();
  });
  modelCats.append(button);
}
renderModels();

document.querySelectorAll('.rail-btn').forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.page));
});

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hoverColor = new THREE.Color('#6f4bff');
const idleColor = new THREE.Color('#000000');
let press = null;

function paintFaceHighlight(key) {
  if (!box) return;
  for (const [name, mesh] of Object.entries(box.meshes)) {
    const material = Array.isArray(mesh.material) ? mesh.material[4] : mesh.material;
    if (!material?.emissive) continue;
    const active = name === key;
    material.emissive.copy(active ? hoverColor : idleColor);
    material.emissiveIntensity = active ? 0.22 : 0;
  }
}

function panelAt(event) {
  if (!box) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(Object.values(box.meshes), false);
  return hits[0]?.object.userData.panel || null;
}

function hideFaceMenu() {
  document.querySelector('#face-menu').hidden = true;
  state.pickedFace = null;
  paintFaceHighlight(null);
}

function showFaceMenu(event, key) {
  state.pickedFace = key;
  paintFaceHighlight(key);
  const menu = document.querySelector('#face-menu');
  document.querySelector('#face-menu-title').textContent = FACE_NAMES[key] || key;
  document.querySelector('#face-clear').disabled = !state.faceImages[key];
  menu.hidden = false;
  const width = 148;
  const height = 118;
  const left = Math.min(event.clientX + 12, window.innerWidth - width - 8);
  const top = Math.min(event.clientY + 12, window.innerHeight - height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || frameHook) return;
  press = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!press || press.id !== event.pointerId) return;
  const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
  press = null;
  if (moved > 6 || frameHook) return;
  const key = panelAt(event);
  if (!key) {
    hideFaceMenu();
    return;
  }
  showFaceMenu(event, key);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) hideFaceMenu();
  if (press || frameHook || state.pickedFace) return;
  const key = panelAt(event);
  renderer.domElement.style.cursor = key ? 'pointer' : 'grab';
  paintFaceHighlight(key);
});

document.querySelector('#face-upload').addEventListener('click', () => {
  if (state.pickedFace) document.querySelector('#face-file').click();
});
document.querySelector('#face-file').addEventListener('change', (event) => {
  const [file] = event.target.files || [];
  const key = state.pickedFace;
  event.target.value = '';
  if (!file || !key || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    setFaceImage(key, image);
    hideFaceMenu();
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
});
document.querySelector('#face-clear').addEventListener('click', () => {
  if (!state.pickedFace) return;
  setFaceImage(state.pickedFace, null);
  hideFaceMenu();
});
document.addEventListener('pointerdown', (event) => {
  const menu = document.querySelector('#face-menu');
  if (menu.hidden || menu.contains(event.target) || event.target === renderer.domElement) return;
  hideFaceMenu();
});

window.addEventListener('resize', () => {
  resize();
  editor.resize();
});

function makeShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 18, 128, 128, 122);
  g.addColorStop(0, 'rgba(0,0,0,0.38)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function animate() {
  requestAnimationFrame(animate);
  if (frameHook) frameHook();
  else controls.update();
  renderer.render(scene, camera);
}

resize();
editor.resize();
useSample();
const previewObserver = new ResizeObserver(() => editor.resize());
previewObserver.observe(preview.parentElement);
animate();

import { buildViewerHtml } from './export/html.js';

const params = new URLSearchParams(location.search);
const token = params.get('filter_url');

const modal = document.querySelector('#share-modal');
const errorBox = document.querySelector('#share-error');
const stage = document.querySelector('#share-stage');
const fallback = document.querySelector('#share-fallback');
const viewer = document.querySelector('#share-viewer');
const brand = document.querySelector('#share-brand');
const watermark = document.querySelector('#share-watermark');
const note = document.querySelector('#share-note');
const linkInput = document.querySelector('#share-link');
const stopButton = document.querySelector('#share-stop');
const copyButton = document.querySelector('#share-copy');
const status = document.querySelector('#share-status');
const background = document.querySelector('#share-bg');

function showError(message) {
  modal.hidden = true;
  errorBox.hidden = false;
  if (message) errorBox.querySelector('p').textContent = message;
}

function setupTabs() {
  const tabs = [...document.querySelectorAll('.share-tab')];
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.toggle('active', item === tab));
      const name = tab.dataset.tab;
      note.hidden = name === 'mockup' || name === 'share';
      if (!note.hidden) note.textContent = '该分享只包含样机预览。';
    });
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    status.textContent = '链接已复制';
  } catch {
    linkInput.focus();
    linkInput.select();
    status.textContent = '请手动复制链接';
  }
}

async function loadShare() {
  if (!token) {
    showError('链接里缺少 filter_url 参数。');
    return;
  }

  let response;
  try {
    response = await fetch(`/api/shares/${encodeURIComponent(token)}`, { cache: 'no-store' });
  } catch {
    showError('网络异常，请稍后再试。');
    return;
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    showError(data.message || '分享不存在或已停止。');
    return;
  }

  const body = await response.json();
  const data = body.data || body;
  document.title = `${data.title || '样机'} · 包装样机`;

  linkInput.value = location.href;
  document.querySelector('#share-remove-logo').checked = Boolean(data.removeLogo);
  document.querySelector('#share-remove-watermark').checked = Boolean(data.removeWatermark);
  brand.hidden = Boolean(data.removeLogo);
  watermark.hidden = Boolean(data.removeWatermark);

  if (data.previewUrl) {
    fallback.src = data.previewUrl;
    background.style.backgroundImage = `linear-gradient(135deg, rgba(244,244,244,.55), rgba(215,215,215,.55)), url("${data.previewUrl}")`;
  } else {
    fallback.remove();
  }

  if (data.faces && data.kind === 'box') {
    viewer.srcdoc = buildViewerHtml({
      width: data.width,
      height: data.height,
      depth: data.depth,
      faces: data.faces,
      background: 'transparent',
    });
  } else {
    viewer.hidden = true;
  }

  stopButton.addEventListener('click', () => {
    status.textContent = '停止分享请在分享者的导出弹窗中操作。';
  });
  copyButton.addEventListener('click', copyLink);
  setupTabs();
}

window.addEventListener('message', (event) => {
  if (event.data?.type !== 'wego-viewer-ready') return;
  stage.classList.add('ready');
});

loadShare();

import { downloadBlob } from './common.js';

export function buildViewerHtml({ width, height, depth, faces }) {
  const payload = JSON.stringify({ width, height, depth, faces }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>包装样机</title>
  <style>
    html, body { margin: 0; height: 100%; background: #d9d9d9; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
    canvas { width: 100%; height: 100%; display: block; }
    .bar { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; background: #fff; border-radius: 12px; padding: 8px 12px; box-shadow: 0 8px 24px rgba(0,0,0,.12); font-size: 13px; color: #666; }
    input { width: 160px; }
  </style>
</head>
<body>
  <script type="application/json" id="design">${payload}</script>
  <div class="bar"><span>展开</span><input id="fold" type="range" min="0" max="100" value="100" /><span>闭合</span></div>
  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js" } }
  </script>
  <script type="module">
    import * as THREE from "three";
    const design = JSON.parse(document.getElementById("design").textContent);
    const MM = 0.01;
    const w = design.width * MM, h = design.height * MM, d = design.depth * MM, t = 1.4 * MM;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8c8c8, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(3, 6, 4);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    const radius = Math.max(w, h, d) * 1.7;
    camera.position.set(radius * 0.95, radius * 0.7, radius * 1.3);
    const target = new THREE.Vector3(0, 0, 0);
    let dragging = false, lastX = 0, lastY = 0, yaw = 0.6, pitch = 0.45, dist = radius * 1.8;
    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener("pointerup", () => { dragging = false; });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.008;
      pitch = Math.max(0.15, Math.min(1.35, pitch + (e.clientY - lastY) * 0.008));
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); dist = Math.max(radius * 0.6, Math.min(radius * 5, dist * (e.deltaY > 0 ? 1.08 : 0.92))); }, { passive: false });

    function tex(url) {
      const texture = new THREE.TextureLoader().load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }
    function mat(url) {
      return new THREE.MeshStandardMaterial({ map: tex(url), roughness: 0.82, metalness: 0 });
    }
    function panel(width, height, url) {
      const geo = new THREE.BoxGeometry(width, height, t);
      const edge = new THREE.MeshStandardMaterial({ color: "#f4f0e8", roughness: 0.9 });
      const inside = new THREE.MeshStandardMaterial({ color: "#f6f1e7", roughness: 0.94 });
      const outside = mat(url);
      return new THREE.Mesh(geo, [edge, edge, edge, edge, outside, inside]);
    }
    const root = new THREE.Group();
    const content = new THREE.Group();
    const front = new THREE.Group();
    root.add(content); content.add(front);
    front.add(panel(w, h, design.faces.front));
    const leftH = new THREE.Group(); leftH.position.x = -w / 2; front.add(leftH);
    const left = panel(d, h, design.faces.left); left.position.x = -d / 2; leftH.add(left);
    const rightH = new THREE.Group(); rightH.position.x = w / 2; front.add(rightH);
    const right = panel(d, h, design.faces.right); right.position.x = d / 2; rightH.add(right);
    const backH = new THREE.Group(); backH.position.x = d; rightH.add(backH);
    const back = panel(w, h, design.faces.back); back.position.x = w / 2; backH.add(back);
    const topH = new THREE.Group(); topH.position.y = h / 2; front.add(topH);
    const top = panel(w, d, design.faces.top); top.position.y = d / 2; topH.add(top);
    const bottomH = new THREE.Group(); bottomH.position.y = -h / 2; front.add(bottomH);
    const bottom = panel(w, d, design.faces.bottom); bottom.position.y = -d / 2; bottomH.add(bottom);
    scene.add(root);
    function setFold(amount) {
      const a = amount * Math.PI / 2;
      leftH.rotation.y = -a; rightH.rotation.y = a; backH.rotation.y = a;
      topH.rotation.x = -a; bottomH.rotation.x = a;
      const closed = Math.max(w, h, d);
      const flat = Math.max(w * 2 + d * 2, h + d * 2);
      const s = closed / flat + (1 - closed / flat) * amount;
      content.scale.setScalar(s);
      content.position.set((1 - amount) * (-w / 2) * s, 0, amount * (d / 2) * s);
    }
    setFold(1);
    document.getElementById("fold").addEventListener("input", (e) => setFold(Number(e.target.value) / 100));
    function resize() {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    }
    addEventListener("resize", resize);
    resize();
    function frame() {
      camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(target);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    frame();
  </script>
</body>
</html>`;
}

export function exportViewerHtml(spec) {
  const html = buildViewerHtml(spec);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), '包装样机.html');
  return html;
}

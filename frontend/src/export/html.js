import { downloadBlob } from './common.js';

export function buildViewerHtml({ width, height, depth, faces, background = '#d9d9d9' }) {
  const payload = JSON.stringify({ width, height, depth, faces }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>包装样机</title>
  <style>
    html, body { margin: 0; height: 100%; background: ${background}; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
    canvas { width: 100%; height: 100%; display: block; }
    .bar { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; background: #fff; border-radius: 12px; padding: 8px 12px; box-shadow: 0 8px 24px rgba(0,0,0,.12); font-size: 13px; color: #666; }
    input { width: 160px; }
  </style>
</head>
<body>
  <script type="application/json" id="design">${payload}</script>
  <div class="bar"><span>展开</span><input id="fold" type="range" min="0" max="100" value="100" /><span>闭合</span></div>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
      }
    }
  </script>
  <script type="module">
    import * as THREE from "three";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";
    const design = JSON.parse(document.getElementById("design").textContent);
    const MM = 0.01;
    const w = design.width * MM, h = design.height * MM, d = design.depth * MM, t = 1.4 * MM;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.38));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8c8c8, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 6, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde7ff, 0.5);
    fill.position.set(-4, 2, 2);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    const radius = Math.max(w, h, d) * 1.7;
    camera.position.set(radius * 0.95, radius * 0.7, radius * 1.3);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, h * 0.02, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = radius * 0.55;
    controls.maxDistance = radius * 5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controls.update();
    renderer.domElement.addEventListener("pointerdown", () => { controls.autoRotate = false; });
    setTimeout(() => { controls.autoRotate = false; }, 2600);

    let textureLoaded = 0;
    let textureFailed = 0;
    const textureTotal = 6;
    let announced = false;

    function announceReady() {
      if (announced) return;
      announced = true;
      renderer.render(scene, camera);
      if (window.parent === window) return;
      try {
        window.parent.postMessage({ type: "wego-viewer-ready" }, "*");
      } catch {
        // 跨域父页面不可用时忽略。
      }
    }
    function maybeReady() {
      if (textureLoaded + textureFailed >= textureTotal) announceReady();
    }

    function mat(url) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xf4f0e8,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      if (!url) {
        textureFailed += 1;
        maybeReady();
        return material;
      }
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
          textureLoaded += 1;
          maybeReady();
        },
        undefined,
        () => {
          textureFailed += 1;
          maybeReady();
        },
      );
      return material;
    }
    function panel(width, height, url) {
      const geo = new THREE.BoxGeometry(width, height, t);
      const edge = new THREE.MeshStandardMaterial({ color: "#f4f0e8", roughness: 0.9 });
      const outside = mat(url);
      return new THREE.Mesh(geo, [edge, edge, edge, edge, outside, outside]);
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

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const shadowContext = shadowCanvas.getContext("2d");
    const shadowGradient = shadowContext.createRadialGradient(128, 128, 8, 128, 128, 124);
    shadowGradient.addColorStop(0, "rgba(0,0,0,0.26)");
    shadowGradient.addColorStop(1, "rgba(0,0,0,0)");
    shadowContext.fillStyle = shadowGradient;
    shadowContext.fillRect(0, 0, 256, 256);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shadowCanvas),
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 3.2, d * 3.2), shadowMaterial);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -h / 2 - 0.006;
    scene.add(shadowMesh);

    let foldTarget = 1;
    let foldCurrent = 1;
    function applyFold(amount) {
      const a = amount * Math.PI / 2;
      leftH.rotation.y = -a; rightH.rotation.y = a; backH.rotation.y = a;
      topH.rotation.x = -a; bottomH.rotation.x = a;
      const s = 0.7 + 0.3 * amount;
      content.scale.setScalar(s);
      content.position.set((1 - amount) * (-w / 2) * s, 0, amount * (d / 2) * s);
      shadowMaterial.opacity = amount;
      shadowMesh.visible = amount > 0.04;
      renderer.render(scene, camera);
    }
    applyFold(1);
    document.getElementById("fold").addEventListener("input", (e) => {
      controls.autoRotate = false;
      foldTarget = Number(e.target.value) / 100;
    });
    function resize() {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
    }
    addEventListener("resize", resize);
    resize();
    function frame() {
      const delta = foldTarget - foldCurrent;
      if (Math.abs(delta) > 0.0005) {
        foldCurrent += delta * 0.18;
        applyFold(foldCurrent);
      }
      controls.update();
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

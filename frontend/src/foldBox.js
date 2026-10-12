import * as THREE from 'three';

const PANEL_SIZE = {
  front: (w, h) => [w, h],
  back: (w, h) => [w, h],
  left: (_w, h, d) => [d, h],
  right: (_w, h, d) => [d, h],
  top: (w, _h, d) => [w, d],
  bottom: (w, _h, d) => [w, d],
};

function makePanelGeometry(width, height, thickness) {
  const geo = new THREE.BoxGeometry(width, height, thickness);
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    if (normal.getZ(i) > 0.5) {
      const u = pos.getX(i) / width + 0.5;
      const v = pos.getY(i) / height + 0.5;
      uv.setXY(i, u, v);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function makeMaterials(texture, edgeColor, insideColor) {
  const edge = new THREE.MeshStandardMaterial({
    color: edgeColor,
    roughness: 0.9,
    metalness: 0,
  });
  const inside = new THREE.MeshStandardMaterial({
    color: insideColor,
    roughness: 0.94,
    metalness: 0,
  });
  const outside = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.22,
  });
  return [edge, edge, edge, edge, outside, inside];
}

/**
 * 以正面为根的折叠盒。fold = 0 完全展开，fold = 1 闭合成立方体。
 * 铰链方向按“印刷面朝外、向盒内折”计算。
 */
export function createFoldableBox({
  width,
  height,
  depth,
  thickness,
  textures,
  edgeColor,
  insideColor,
}) {
  const root = new THREE.Group();
  const content = new THREE.Group();
  root.add(content);
  const front = new THREE.Group();
  content.add(front);

  const meshes = {};
  const geometries = [];
  const materials = new Set();

  function addPanel(key, parent, widthMm, heightMm) {
    const geo = makePanelGeometry(widthMm, heightMm, thickness);
    geometries.push(geo);
    const mats = makeMaterials(textures[key], edgeColor, insideColor);
    mats.forEach((mat) => materials.add(mat));
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.userData.panel = key;
    parent.add(mesh);
    meshes[key] = mesh;
    return mesh;
  }

  addPanel('front', front, ...PANEL_SIZE.front(width, height, depth));

  const leftHinge = new THREE.Group();
  leftHinge.position.set(-width / 2, 0, 0);
  front.add(leftHinge);
  const leftMesh = addPanel('left', leftHinge, ...PANEL_SIZE.left(width, height, depth));
  leftMesh.position.set(-depth / 2, 0, 0);

  const rightHinge = new THREE.Group();
  rightHinge.position.set(width / 2, 0, 0);
  front.add(rightHinge);
  const rightMesh = addPanel('right', rightHinge, ...PANEL_SIZE.right(width, height, depth));
  rightMesh.position.set(depth / 2, 0, 0);

  const backHinge = new THREE.Group();
  backHinge.position.set(depth, 0, 0);
  rightHinge.add(backHinge);
  const backMesh = addPanel('back', backHinge, ...PANEL_SIZE.back(width, height, depth));
  backMesh.position.set(width / 2, 0, 0);

  const topHinge = new THREE.Group();
  topHinge.position.set(0, height / 2, 0);
  front.add(topHinge);
  const topMesh = addPanel('top', topHinge, ...PANEL_SIZE.top(width, height, depth));
  topMesh.position.set(0, depth / 2, 0);

  const bottomHinge = new THREE.Group();
  bottomHinge.position.set(0, -height / 2, 0);
  front.add(bottomHinge);
  const bottomMesh = addPanel('bottom', bottomHinge, ...PANEL_SIZE.bottom(width, height, depth));
  bottomMesh.position.set(0, -depth / 2, 0);

  function setFold(amount) {
    const fold = THREE.MathUtils.clamp(amount, 0, 1);
    const angle = fold * (Math.PI / 2);
    leftHinge.rotation.y = -angle;
    rightHinge.rotation.y = angle;
    backHinge.rotation.y = angle;
    topHinge.rotation.x = -angle;
    bottomHinge.rotation.x = angle;

    const closedMax = Math.max(width, height, depth);
    const flatMax = Math.max(width * 2 + depth * 2, height + depth * 2);
    const scale = THREE.MathUtils.lerp(closedMax / flatMax, 1, fold);
    content.scale.setScalar(scale);
    content.position.set((1 - fold) * (-width / 2) * scale, 0, fold * (depth / 2) * scale);
    return scale;
  }

  function setTextures(nextTextures) {
    for (const key of Object.keys(meshes)) {
      const outside = meshes[key].material[4];
      const previous = outside.map;
      outside.map = nextTextures[key];
      outside.needsUpdate = true;
      if (previous && previous !== nextTextures[key]) previous.dispose();
    }
  }

  function dispose() {
    geometries.forEach((geo) => geo.dispose());
    materials.forEach((mat) => {
      if (mat.map) mat.map.dispose();
      mat.dispose();
    });
    root.removeFromParent();
  }

  return { root, setFold, setTextures, dispose, meshes };
}

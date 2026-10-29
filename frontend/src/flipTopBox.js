import * as THREE from 'three';

/**
 * 翻盖插口盒：正面为根，左右后墙、底面与普通盒相同；
 * 盖子铰在后墙顶边，盖前再接插舌，左右墙顶有防尘翼。
 * fold = 0 展开，fold = 1 闭合。
 */
function makePanelGeometry(width, height, thickness) {
  const geo = new THREE.BoxGeometry(width, height, thickness);
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    if (normal.getZ(i) > 0.5) {
      uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height + 0.5);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** 插舌 / 防尘翼：顶端收窄，近似刀版圆角翼片。 */
function makeWingGeometry(width, height, tipScale, thickness) {
  const geo = new THREE.BoxGeometry(width, height, thickness, 1, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * tipScale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const normal = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    if (normal.getZ(i) > 0.5) {
      uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height + 0.5);
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
    map: texture || null,
    color: texture ? '#ffffff' : edgeColor,
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.22,
  });
  return [edge, edge, edge, edge, outside, inside];
}

export function createFlipTopBox({
  width,
  height,
  depth,
  thickness,
  textures,
  edgeColor,
  insideColor,
}) {
  const tuckH = Math.min(depth * 0.52, height * 0.9);
  const dustH = Math.min(depth * 0.4, width * 0.26);
  const root = new THREE.Group();
  const content = new THREE.Group();
  root.add(content);
  const front = new THREE.Group();
  content.add(front);

  const meshes = {};
  const geometries = [];
  const materials = new Set();

  function addPanel(key, parent, panelW, panelH, wing = null) {
    const geo = wing
      ? makeWingGeometry(panelW, panelH, wing, thickness)
      : makePanelGeometry(panelW, panelH, thickness);
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

  addPanel('front', front, width, height);

  const leftHinge = new THREE.Group();
  leftHinge.position.set(-width / 2, 0, 0);
  front.add(leftHinge);
  const leftMesh = addPanel('left', leftHinge, depth, height);
  leftMesh.position.set(-depth / 2, 0, 0);

  const rightHinge = new THREE.Group();
  rightHinge.position.set(width / 2, 0, 0);
  front.add(rightHinge);
  const rightMesh = addPanel('right', rightHinge, depth, height);
  rightMesh.position.set(depth / 2, 0, 0);

  const backHinge = new THREE.Group();
  backHinge.position.set(depth, 0, 0);
  rightHinge.add(backHinge);
  const backMesh = addPanel('back', backHinge, width, height);
  backMesh.position.set(width / 2, 0, 0);

  const bottomHinge = new THREE.Group();
  bottomHinge.position.set(0, -height / 2, 0);
  front.add(bottomHinge);
  const bottomMesh = addPanel('bottom', bottomHinge, width, depth);
  bottomMesh.position.set(0, -depth / 2, 0);

  // 盖铰在后墙顶边（相对 backMesh 中心上移 height/2）
  const lidHinge = new THREE.Group();
  lidHinge.position.set(width / 2, height / 2, 0);
  backHinge.add(lidHinge);
  const lidMesh = addPanel('top', lidHinge, width, depth);
  lidMesh.position.set(0, depth / 2, 0);

  const tuckHinge = new THREE.Group();
  tuckHinge.position.set(0, depth, 0);
  lidHinge.add(tuckHinge);
  const tuckMesh = addPanel('tuck', tuckHinge, width * 0.9, tuckH, 0.7);
  tuckMesh.position.set(0, tuckH / 2, 0);

  const leftDustHinge = new THREE.Group();
  leftDustHinge.position.set(-depth / 2, height / 2, 0);
  leftHinge.add(leftDustHinge);
  const leftDust = addPanel('leftDust', leftDustHinge, depth * 0.88, dustH, 0.5);
  leftDust.position.set(0, dustH / 2, 0);

  const rightDustHinge = new THREE.Group();
  rightDustHinge.position.set(depth / 2, height / 2, 0);
  rightHinge.add(rightDustHinge);
  const rightDust = addPanel('rightDust', rightDustHinge, depth * 0.88, dustH, 0.5);
  rightDust.position.set(0, dustH / 2, 0);

  function setFold(amount) {
    const fold = THREE.MathUtils.clamp(amount, 0, 1);
    const angle = fold * (Math.PI / 2);
    leftHinge.rotation.y = -angle;
    rightHinge.rotation.y = angle;
    backHinge.rotation.y = angle;
    bottomHinge.rotation.x = angle;
    // 盖从展开（与背板共面）折到水平闭合
    lidHinge.rotation.x = -angle;
    tuckHinge.rotation.x = -angle * 0.95;
    leftDustHinge.rotation.x = -angle;
    rightDustHinge.rotation.x = -angle;

    const closedMax = Math.max(width, height, depth);
    const flatMax = Math.max(width * 2 + depth * 2, height + depth * 2 + tuckH);
    const scale = THREE.MathUtils.lerp(closedMax / flatMax, 1, fold);
    content.scale.setScalar(scale);
    content.position.set((1 - fold) * (-width / 2) * scale, 0, fold * (depth / 2) * scale);
    return scale;
  }

  function setTextures(nextTextures) {
    for (const key of Object.keys(meshes)) {
      const outside = meshes[key].material[4];
      const previous = outside.map;
      if (!nextTextures[key]) continue;
      outside.map = nextTextures[key];
      outside.color.set('#ffffff');
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

  return { root, setFold, setTextures, dispose, meshes, style: 'flipTop' };
}

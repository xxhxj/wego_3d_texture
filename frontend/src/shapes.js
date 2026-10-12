import * as THREE from 'three';
import { createFoldableBox } from './foldBox.js';

function outsideMaterial(texture, color, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({
    map: texture || null,
    color,
    roughness,
    metalness: 0.02,
  });
}

function bindTextures(meshes) {
  function setTextures(nextTextures) {
    for (const key of Object.keys(meshes)) {
      const mesh = meshes[key];
      const material = Array.isArray(mesh.material) ? mesh.material[4] : mesh.material;
      if (!material || !nextTextures[key]) continue;
      const previous = material.map;
      material.map = nextTextures[key];
      material.needsUpdate = true;
      if (previous && previous !== nextTextures[key]) previous.dispose();
    }
  }
  return setTextures;
}

function disposeGroup(root, geometries, materials) {
  geometries.forEach((geo) => geo.dispose());
  materials.forEach((mat) => {
    if (mat.map) mat.map.dispose();
    mat.dispose();
  });
  root.removeFromParent();
}

function createRound({
  height,
  diameter,
  textures,
  edgeColor,
  bodyColor,
  capColor,
  profile,
  kind,
}) {
  const root = new THREE.Group();
  const geometries = [];
  const materials = [];
  const meshes = {};
  const radius = diameter / 2;
  const neckScale = profile === 'jar' ? 0.78 : profile === 'slim' ? 0.34 : 0.42;
  const bodyShare = kind === 'cup' ? 1 : kind === 'can' ? 0.92 : profile === 'jar' ? 0.78 : 0.68;
  const bodyH = height * bodyShare;
  const neckH = kind === 'cup' || kind === 'can' ? 0 : height * (profile === 'jar' ? 0.1 : 0.18);
  const capH = kind === 'cup' ? 0 : kind === 'can' ? height - bodyH : height - bodyH - neckH;
  const topRadius = kind === 'cup' ? radius * 1.15 : radius;
  const bottomRadius = kind === 'cup' ? radius * 0.72 : radius;

  const bodyGeo = new THREE.CylinderGeometry(topRadius, bottomRadius, bodyH, 48, 1, true);
  geometries.push(bodyGeo);
  const bodyMat = outsideMaterial(textures.label || textures.wall, bodyColor, kind === 'can' ? 0.35 : 0.55);
  materials.push(bodyMat);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.position.y = -height / 2 + bodyH / 2;
  body.userData.panel = kind === 'cup' ? 'wall' : 'label';
  root.add(body);
  meshes[body.userData.panel] = body;

  const bottomGeo = new THREE.CircleGeometry(bottomRadius * 0.98, 32);
  geometries.push(bottomGeo);
  const bottomMat = outsideMaterial(null, bodyColor, 0.6);
  materials.push(bottomMat);
  const bottom = new THREE.Mesh(bottomGeo, bottomMat);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -height / 2 + 0.001;
  root.add(bottom);

  let cap = null;
  if (capH > 0.001) {
    if (neckH > 0.001) {
      const neckGeo = new THREE.CylinderGeometry(radius * neckScale, radius * neckScale * 1.05, neckH, 32);
      geometries.push(neckGeo);
      const neckMat = outsideMaterial(null, bodyColor, 0.22);
      materials.push(neckMat);
      const neck = new THREE.Mesh(neckGeo, neckMat);
      neck.position.y = -height / 2 + bodyH + neckH / 2;
      root.add(neck);
    }

    const capRadius = kind === 'can' ? radius : radius * (neckScale + 0.06);
    const capGeo = new THREE.CylinderGeometry(capRadius, capRadius, capH, 32);
    geometries.push(capGeo);
    const capMat = outsideMaterial(textures.cap || textures.lid, capColor, 0.4);
    materials.push(capMat);
    cap = new THREE.Mesh(capGeo, capMat);
    cap.castShadow = true;
    cap.userData.panel = kind === 'can' ? 'lid' : 'cap';
    meshes[cap.userData.panel] = cap;
    const capAnchor = new THREE.Group();
    capAnchor.position.y = -height / 2 + bodyH + neckH;
    cap.position.y = capH / 2;
    capAnchor.add(cap);
    root.add(capAnchor);

    if (kind === 'can') {
      const lidGeo = new THREE.CircleGeometry(radius * 0.92, 32);
      geometries.push(lidGeo);
      const lid = new THREE.Mesh(lidGeo, capMat);
      lid.rotation.x = -Math.PI / 2;
      lid.position.y = capH / 2 + 0.0001;
      capAnchor.add(lid);
    }
  }

  function setFold(amount) {
    const fold = THREE.MathUtils.clamp(amount, 0, 1);
    if (cap) {
      const lift = (1 - fold) * height * 0.28;
      cap.parent.position.y = -height / 2 + bodyH + neckH + lift;
    }
    return 1;
  }

  return {
    root,
    meshes,
    setFold,
    setTextures: bindTextures(meshes),
    dispose: () => disposeGroup(root, geometries, materials),
  };
}

function createPouch({ width, height, depth, textures, edgeColor, handle }) {
  const root = new THREE.Group();
  const geometries = [];
  const materials = [];
  const meshes = {};

  function addPlane(key, planeWidth, planeHeight, texture) {
    const geo = new THREE.PlaneGeometry(planeWidth, planeHeight);
    geometries.push(geo);
    const mat = outsideMaterial(texture, edgeColor, 0.84);
    materials.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.userData.panel = key;
    meshes[key] = mesh;
    return mesh;
  }

  const frontHinge = new THREE.Group();
  frontHinge.position.y = height / 2;
  const front = addPlane('front', width, height, textures.front);
  front.position.set(0, -height / 2, depth / 2);
  frontHinge.add(front);
  root.add(frontHinge);

  const backHinge = new THREE.Group();
  backHinge.position.y = height / 2;
  const back = addPlane('back', width, height, textures.back);
  back.position.set(0, -height / 2, -depth / 2);
  back.rotation.y = Math.PI;
  backHinge.add(back);
  root.add(backHinge);

  const left = addPlane('left', depth, height, textures.left);
  left.position.set(-width / 2, 0, 0);
  left.rotation.y = -Math.PI / 2;
  root.add(left);

  const right = addPlane('right', depth, height, textures.right);
  right.position.set(width / 2, 0, 0);
  right.rotation.y = Math.PI / 2;
  root.add(right);

  const bottom = addPlane('bottom', width, depth, textures.bottom);
  bottom.position.y = -height / 2;
  bottom.rotation.x = -Math.PI / 2;
  root.add(bottom);

  if (handle) {
    const gripGeo = new THREE.TorusGeometry(width * 0.16, Math.max(width * 0.012, 0.004), 8, 24, Math.PI);
    geometries.push(gripGeo);
    const gripMat = outsideMaterial(null, '#c8b49a', 0.7);
    materials.push(gripMat);
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.rotation.x = Math.PI;
    grip.position.y = height / 2 + width * 0.02;
    root.add(grip);
  }

  function setFold(amount) {
    const fold = THREE.MathUtils.clamp(amount, 0, 1);
    const angle = (1 - fold) * 0.55;
    frontHinge.rotation.x = -angle;
    backHinge.rotation.x = angle;
    return 1;
  }

  return {
    root,
    meshes,
    setFold,
    setTextures: bindTextures(meshes),
    dispose: () => disposeGroup(root, geometries, materials),
  };
}

export function createShape(model, options) {
  const kind = model.kind || 'box';
  if (kind === 'bottle' || kind === 'can' || kind === 'cup') {
    return createRound({
      height: options.height,
      diameter: options.depth,
      textures: options.textures,
      edgeColor: options.edgeColor,
      bodyColor: options.edgeColor,
      capColor: kind === 'can' ? '#d5d8de' : '#f2efe8',
      profile: model.profile,
      kind,
    });
  }
  if (kind === 'pouch') {
    return createPouch({
      width: options.width,
      height: options.height,
      depth: options.depth,
      textures: options.textures,
      edgeColor: options.edgeColor,
      handle: model.handle,
    });
  }
  return createFoldableBox({
    width: options.width,
    height: options.height,
    depth: options.depth,
    thickness: options.thickness,
    textures: options.textures,
    edgeColor: options.edgeColor,
    insideColor: options.insideColor,
  });
}

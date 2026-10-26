import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function prepare(scene, target) {
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  scene.userData.baseSize = size;
  scene.userData.baseCenter = center;
  scene.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material) material.side = THREE.DoubleSide;
    }
  });
  applySize(scene, target);
  return { x: size.x, y: size.y, z: size.z };
}

function applySize(scene, target) {
  const size = scene.userData.baseSize;
  const center = scene.userData.baseCenter;
  scene.scale.set(
    target.width / Math.max(size.x, 1e-6),
    target.height / Math.max(size.y, 1e-6),
    target.depth / Math.max(size.z, 1e-6),
  );
  scene.position.set(
    -center.x * scene.scale.x,
    -center.y * scene.scale.y,
    -center.z * scene.scale.z,
  );
}

function disposeObject(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
  root.removeFromParent();
}

function wrap(scene, rawSize) {
  const root = new THREE.Group();
  root.add(scene);
  return {
    root,
    rawSize,
    foldable: false,
    sourceKey: '',
    setFold: () => 1,
    setSize: (target) => applySize(scene, target),
    setTextures: () => {},
    dispose: () => disposeObject(root),
  };
}

export function loadMeshShape(url, headers, target) {
  const loader = new GLTFLoader();
  if (headers && Object.keys(headers).length) loader.setRequestHeader(headers);
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      resolve(wrap(gltf.scene, prepare(gltf.scene, target)));
    }, undefined, reject);
  });
}

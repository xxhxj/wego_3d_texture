import fs from 'node:fs';
import path from 'node:path';

function addFace(positions, normals, colors, indices, corners, normal, color) {
  const start = positions.length / 3;
  for (const corner of corners) {
    positions.push(...corner);
    normals.push(...normal);
    colors.push(...color);
  }
  indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function box(positions, normals, colors, indices, min, max, color) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  addFace(positions, normals, colors, indices, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], color);
  addFace(positions, normals, colors, indices, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], color);
  addFace(positions, normals, colors, indices, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], color);
  addFace(positions, normals, colors, indices, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], color);
  addFace(positions, normals, colors, indices, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], color);
  addFace(positions, normals, colors, indices, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], color);
}

const positions = [];
const normals = [];
const colors = [];
const indices = [];
const paper = [0.97, 0.95, 0.91];
const purple = [0.48, 0.38, 1];
box(positions, normals, colors, indices, [-0.5, -0.5, -0.35], [0.5, 0.5, 0.35], paper);
box(positions, normals, colors, indices, [-0.5, -0.18, 0.37], [0.5, -0.02, 0.44], purple);

const positionBytes = Buffer.from(new Float32Array(positions).buffer);
const normalBytes = Buffer.from(new Float32Array(normals).buffer);
const colorBytes = Buffer.from(new Float32Array(colors).buffer);
const indexBytes = Buffer.from(new Uint16Array(indices).buffer);
const bin = Buffer.concat([positionBytes, normalBytes, colorBytes, indexBytes]);
const vertexCount = positions.length / 3;

const json = {
  asset: { version: '2.0', generator: 'wego-sample' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: '样例盒' }],
  meshes: [{
    primitives: [{
      attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
      indices: 3,
      material: 0,
    }],
  }],
  materials: [{
    name: 'card',
    doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.6 },
  }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: [-0.5, -0.5, -0.35], max: [0.5, 0.5, 0.44] },
    { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC3' },
    { bufferView: 3, componentType: 5123, count: indices.length, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positionBytes.length },
    { buffer: 0, byteOffset: positionBytes.length, byteLength: normalBytes.length },
    { buffer: 0, byteOffset: positionBytes.length + normalBytes.length, byteLength: colorBytes.length },
    { buffer: 0, byteOffset: positionBytes.length + normalBytes.length + colorBytes.length, byteLength: indexBytes.length },
  ],
  buffers: [{ byteLength: bin.length }],
};

let jsonText = JSON.stringify(json);
while (jsonText.length % 4 !== 0) jsonText += ' ';
const jsonChunk = Buffer.from(jsonText);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
const target = path.resolve('samples/样例盒.glb');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, glb);
console.log(`${target} ${glb.length} bytes`);

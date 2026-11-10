/* Merge a group's static child meshes by material to cut draw calls (important on phones). */
import * as THREE from 'three';

const ATTRS = [['position', 3], ['normal', 3], ['uv', 2]];

function flipWinding(g) {
  for (const [name, size] of ATTRS) {
    const a = g.attributes[name];
    if (!a) continue;
    const arr = a.array;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < size; k++) {
        const i1 = (t + 1) * size + k, i2 = (t + 2) * size + k;
        const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
      }
    }
  }
}

function concat(geos) {
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [name, size] of ATTRS) {
    const arr = new Float32Array(count * size);
    let off = 0;
    for (const g of geos) {
      const a = g.attributes[name];
      if (a) arr.set(a.array, off);
      off += g.attributes.position.count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Replaces direct mesh children that share a material with one merged mesh.
 *  Meshes flagged userData.noMerge are left alone. Returns the merged meshes. */
export function mergeByMaterial(parent) {
  const buckets = new Map();
  for (const child of [...parent.children]) {
    if (!child.isMesh || child.isInstancedMesh || child.userData.noMerge) continue;
    if (!buckets.has(child.material)) buckets.set(child.material, []);
    buckets.get(child.material).push(child);
  }
  const made = [];
  for (const [mat, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const key of Object.keys(g.attributes)) if (!ATTRS.some(([n]) => n === key)) g.deleteAttribute(key);
      g.applyMatrix4(m.matrix);
      if (m.matrix.determinant() < 0) flipWinding(g);
      return g;
    });
    const merged = new THREE.Mesh(concat(geos), mat);
    geos.forEach((g) => g.dispose());
    merged.castShadow = meshes.some((m) => m.castShadow);
    merged.receiveShadow = meshes.some((m) => m.receiveShadow);
    merged.renderOrder = meshes[0].renderOrder;
    for (const m of meshes) parent.remove(m);
    parent.add(merged);
    made.push(merged);
  }
  return made;
}

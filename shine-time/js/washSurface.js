/* Wash layers on a car: evenly spaced surface points carry dust/grime/foam/water/wax values,
 * rendered as instanced decals whose edges erode as the value drops. */
import * as THREE from 'three';
import { clamp, rand, pointInPoly, TAU } from './util.js';

const DECAL_VERT = /* glsl */ `
attribute float aValue;
attribute float aSeed;
attribute vec3 aTint;
uniform vec3 uLightDir;
uniform float uAmbient;
varying vec2 vUv;
varying float vValue;
varying float vSeed;
varying vec3 vTint;
varying float vShade;
void main() {
  vUv = uv;
  vValue = aValue;
  vSeed = aSeed;
  vTint = aTint;
  mat4 m = modelMatrix * instanceMatrix;
  vec3 n = normalize(mat3(m) * vec3(0.0, 0.0, 1.0));
  vShade = uAmbient + (1.0 - uAmbient) * max(dot(n, normalize(uLightDir)), 0.0);
  vec3 p = position * (aValue > 0.004 ? 1.0 : 0.0);
  gl_Position = projectionMatrix * viewMatrix * m * vec4(p, 1.0);
}`;

const DECAL_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uTime;
uniform float uHint;
uniform float uTwinkle;
uniform float uErode;
uniform float uClear;
uniform float uFlow;
varying vec2 vUv;
varying float vValue;
varying float vSeed;
varying vec3 vTint;
varying float vShade;
void main() {
  if (vValue < 0.004) discard;
  float k = floor(fract(vSeed * 4.37) * 4.0);
  vec2 cell = vec2(mod(k, 2.0), floor(k * 0.5));
  // running water scrolls down the panel; gradients from the unwrapped UV avoid a seam at the wrap
  vec2 uv = vUv;
  if (uFlow > 0.5) uv.y = fract(vUv.y + uTime * (0.45 + 0.5 * fract(vSeed * 7.13)));
  vec4 t = textureGrad(uMap, (uv + cell) * 0.5, dFdx(vUv * 0.5), dFdy(vUv * 0.5));
  float thr = 1.0 - vValue;
  // erosion layers: the value eats into the texture's height map; glow layers just fade
  float a = uErode > 0.5 ? smoothstep(thr, thr + 0.16, t.a) : t.a * smoothstep(0.0, 0.35, vValue);
  a *= uOpacity;
  a *= mix(1.0, 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * 2.7 + vSeed * 40.0), 3.0), uTwinkle);
  if (uFlow > 0.5) a *= smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  vec3 col;
  if (uClear > 0.5) {
    // clear water: R = highlight, G = opacity. Mostly see-through, dark rim, bright glint.
    a *= t.g;
    col = mix(vec3(0.05, 0.09, 0.13) * vShade, vec3(0.78 + 0.3 * vShade), t.r);
  } else {
    col = t.rgb * vTint * vShade;
  }
  if (a < 0.01) discard;
  float pulse = uHint * (0.55 + 0.45 * sin(uTime * 5.0 + vSeed * 6.2831));
  col = mix(col, vec3(1.0, 0.86, 0.35), pulse * 0.55);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Grime draws above foam on purpose so the spots you still have to scrub stay visible.
const VIS = {
  dust:  { tex: 'dust',    size: [0.26, 0.36], offset: 0.006, opacity: 0.34, order: 1, erode: true },
  water: { tex: 'water',   size: [0.15, 0.21], offset: 0.010, opacity: 1.0,  order: 2, erode: true, upright: true, clear: true },
  flow:  { tex: 'flow',    size: [0.22, 0.3],  offset: 0.012, opacity: 0.85,  order: 2, upright: true, clear: true, flow: true },
  foam:  { tex: 'foam',    size: [0.22, 0.3],  offset: 0.016, opacity: 0.98, order: 3, erode: true },
  grime: { tex: 'grime',   size: [0.14, 0.21], offset: 0.021, opacity: 0.96, order: 4, erode: true },
  wax:   { tex: 'sparkle', size: [0.09, 0.17], offset: 0.025, opacity: 1.0,  order: 5, additive: true, twinkle: 1 },
  hint:  { tex: 'ring',    size: [0.2, 0.24],  offset: 0.03,  opacity: 0.9,  order: 6, additive: true },
};

const materials = {};
let textures = null;

export function initWashMaterials(tex) {
  textures = tex;
  for (const [name, v] of Object.entries(VIS)) {
    materials[name] = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex[v.tex] },
        uOpacity: { value: v.opacity },
        uTime: { value: 0 },
        uHint: { value: 0 },
        uTwinkle: { value: v.twinkle || 0 },
        uErode: { value: v.erode ? 1 : 0 },
        uClear: { value: v.clear ? 1 : 0 },
        uFlow: { value: v.flow ? 1 : 0 },
        uLightDir: { value: new THREE.Vector3(0.35, 1, 0.45).normalize() },
        uAmbient: { value: 0.62 },
      },
      vertexShader: DECAL_VERT,
      fragmentShader: DECAL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: v.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
  }
}

export function tickWashMaterials(time, hints) {
  for (const [name, m] of Object.entries(materials)) {
    m.uniforms.uTime.value = time;
    m.uniforms.uHint.value = (hints && hints[name]) || 0;
  }
}

const SPACING = 0.075;
const _Z = new THREE.Vector3(0, 0, 1);
const _UP = new THREE.Vector3();
const _X = new THREE.Vector3();
const _B = new THREE.Matrix4();

export class WashSurface {
  /** cfg: { dirt (1 = normal, 1.5 = muddy), grime (bool), grimeCount } */
  constructor(car, cfg) {
    this.car = car;
    this.cfg = cfg;
    this._sample();
    const N = this.N;
    this.L = {
      dust: new Float32Array(N), grime: new Float32Array(N), foam: new Float32Array(N),
      water: new Float32Array(N), wax: new Float32Array(N), tire: new Float32Array(car.tirePoints.count),
      flow: new Float32Array(N), // running water right where the hose hits; fades by itself
    };
    this.flowActive = 0;
    this.wetLevel = 0;
    this.dripAcc = 0;
    // low points on the sides and bumpers, where water drips off
    this.dripIdx = [];
    for (let i = 0; i < N; i++) if (this.pos[i * 3 + 1] < 0.62 && this.nrm[i * 3 + 1] < 0.35) this.dripIdx.push(i);
    this.grimeInit = new Float32Array(N);
    this.grimeTint = new Float32Array(N * 3).fill(1);
    this.dustMax = 1.6 * (cfg.dirt || 1);
    this._initDust(cfg.dirt || 1);
    if (cfg.grime) this._initGrime(cfg.grimeCount || 6);

    this.group = new THREE.Group();
    car.group.add(this.group);
    this.decals = {};
    this._buildDecals();
    this.auto = [];
    this.dirty = new Set(Object.keys(this.L));
    this.step = null;
    this.startSum = 0;
    this.hintLevel = 0;
    this.hintTimer = 0;
    this._updateVisuals();
  }

  /* ---------- point sampling (dart throwing for even spacing) ---------- */
  _sample() {
    const car = this.car;
    const tris = [];
    const cum = [];
    let total = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
    for (const { geo, vol } of car.washGeos) {
      const pos = geo.attributes.position;
      const idx = geo.index;
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < triCount; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
        ab.subVectors(b, a); ac.subVectors(c, a);
        n.crossVectors(ab, ac);
        const area = n.length() / 2;
        if (area < 1e-7) continue;
        n.normalize();
        if (n.y < -0.45) continue; // underside
        tris.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, n.x, n.y, n.z, vol]);
        total += area;
        cum.push(total);
      }
    }
    const candidates = Math.min(26000, Math.ceil((total / (SPACING * SPACING)) * 3.2));
    this.area = total;
    const cell = SPACING;
    const grid = new Map();
    const key = (ix, iy, iz) => (ix + 512) * 1048576 + (iy + 512) * 1024 + (iz + 512);
    const P = [], NN = [];
    const s2 = SPACING * SPACING;
    for (let k = 0; k < candidates; k++) {
      const r = Math.random() * total;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      const T = tris[lo];
      let u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const w = 1 - u - v;
      const px = T[0] * w + T[3] * u + T[6] * v;
      const py = T[1] * w + T[4] * u + T[7] * v;
      const pz = T[2] * w + T[5] * u + T[8] * v;
      if (py < 0.13) continue;
      if (this._hidden(px, py, pz, T[12])) continue;
      const ix = Math.floor(px / cell), iy = Math.floor(py / cell), iz = Math.floor(pz / cell);
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) for (let dz = -1; dz <= 1 && ok; dz++) {
        const list = grid.get(key(ix + dx, iy + dy, iz + dz));
        if (!list) continue;
        for (const j of list) {
          const ex = P[j * 3] - px, ey = P[j * 3 + 1] - py, ez = P[j * 3 + 2] - pz;
          if (ex * ex + ey * ey + ez * ez < s2) { ok = false; break; }
        }
      }
      if (!ok) continue;
      const id = P.length / 3;
      P.push(px, py, pz);
      NN.push(T[9], T[10], T[11]);
      const kk = key(ix, iy, iz);
      if (!grid.has(kk)) grid.set(kk, []);
      grid.get(kk).push(id);
    }
    this.N = P.length / 3;
    this.pos = new Float32Array(P);
    this.nrm = new Float32Array(NN);
  }

  _hidden(x, y, z, vol) {
    const car = this.car;
    for (let v = 0; v < car.volumes.length; v++) {
      if (v === vol) continue;
      const V = car.volumes[v];
      if (Math.abs(z) < V.halfW - 0.008 && pointInPoly(V.poly, x, y)) return true;
    }
    if (Math.abs(z) < car.halfWidth - 0.02) {
      for (const wz of car.wheelZones) {
        if (Math.hypot(x - wz.x, y - wz.y) < wz.r) return true;
      }
    }
    return false;
  }

  _initDust(dirt) {
    const { pos, N } = this;
    const h = this.car.height;
    for (let i = 0; i < N; i++) {
      const y = pos[i * 3 + 1];
      const low = 1 - clamp(y / h, 0, 1);
      this.L.dust[i] = dirt * (0.85 + 0.75 * low * low) * rand(0.85, 1.1);
    }
  }

  _initGrime(count) {
    const { pos, nrm, N } = this;
    const halfLen = this.car.length / 2;
    const types = [
      { id: 'mud', w: 45, hp: 2.4, r: [0.2, 0.32], tint: [1, 1, 1], ok: (i) => pos[i * 3 + 1] < 0.6 },
      { id: 'bugs', w: 25, hp: 3.0, r: [0.16, 0.26], tint: [0.45, 0.38, 0.3], ok: (i) => nrm[i * 3] > 0.45 || pos[i * 3] > halfLen - 0.6 },
      { id: 'bird', w: 20, hp: 2.0, r: [0.11, 0.17], tint: [2.7, 3.55, 5.2], ok: (i) => nrm[i * 3 + 1] > 0.7 },
      { id: 'tar', w: 10, hp: 3.6, r: [0.09, 0.13], tint: [0.25, 0.25, 0.27], ok: (i) => pos[i * 3 + 1] < 0.55 },
    ];
    const totalW = types.reduce((s, t) => s + t.w, 0);
    let made = 0, guard = 0;
    while (made < count && guard++ < 400) {
      let r = Math.random() * totalW, type = types[0];
      for (const t of types) { r -= t.w; if (r <= 0) { type = t; break; } }
      const c = Math.floor(Math.random() * N);
      if (!type.ok(c)) continue;
      const rad = rand(type.r[0], type.r[1]);
      const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
      const cnx = nrm[c * 3], cny = nrm[c * 3 + 1], cnz = nrm[c * 3 + 2];
      for (let i = 0; i < N; i++) {
        const dx = pos[i * 3] - cx, dy = pos[i * 3 + 1] - cy, dz = pos[i * 3 + 2] - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > rad * rad) continue;
        if (nrm[i * 3] * cnx + nrm[i * 3 + 1] * cny + nrm[i * 3 + 2] * cnz < 0.3) continue;
        const v = type.hp * (1 - 0.3 * (d2 / (rad * rad)));
        if (v > this.L.grime[i]) {
          this.L.grime[i] = v;
          this.grimeInit[i] = v;
          this.grimeTint.set(type.tint, i * 3);
        }
      }
      made++;
    }
  }

  /* ---------- decals ---------- */
  _buildDecals() {
    const N = this.N;
    const all = [...Array(N).keys()];
    this.decals.dust = this._makeDecal('dust', all, () => { const t = rand(0.95, 1.05); return [t, t, t]; });
    this.decals.grime = this._makeDecal('grime', all.filter((i) => this.L.grime[i] > 0), (i) => [this.grimeTint[i * 3], this.grimeTint[i * 3 + 1], this.grimeTint[i * 3 + 2]]);
    this.decals.water = this._makeDecal('water', all.filter((i) => i % 3 !== 2), () => [1, 1, 1]);
    this.decals.flow = this._makeDecal('flow', all.filter((i) => i % 2 === 0), () => [1, 1, 1]);
    const soap = [[1, 1, 1], [1, 0.95, 0.98], [0.95, 0.98, 1]];
    this.decals.foam = this._makeDecal('foam', all, (i) => soap[i % 3]);
    this.decals.wax = this._makeDecal('wax', all.filter((i) => i % 4 === 0), () => [1, 1, 1]);
    this.hintIdx = all.filter((i) => i % 5 === 1);
    this.decals.hint = this._makeDecal('hint', this.hintIdx, () => [1, 1, 1]);
    // rings over each tyre for the tyre step
    const tp = this.car.tirePoints;
    const tireRingIdx = [];
    const wheelCenters = this.car.wheels.map((w) => [w.x, w.y, w.z + w.side * 0.03, w.side]);
    this.tireHint = this._makeDecal('hint', tireRingIdx, null, wheelCenters);
    this.tp = tp;
  }

  _makeDecal(name, indices, tintFn, explicit = null) {
    const count = explicit ? explicit.length : indices.length;
    if (!count) return null;
    const vis = VIS[name];
    const geo = new THREE.PlaneGeometry(1, 1);
    const aValue = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    aValue.setUsage(THREE.DynamicDrawUsage);
    const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    const aTint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    geo.setAttribute('aValue', aValue);
    geo.setAttribute('aSeed', aSeed);
    geo.setAttribute('aTint', aTint);
    const mesh = new THREE.InstancedMesh(geo, materials[name], count);
    mesh.frustumCulled = false;
    mesh.renderOrder = vis.order;
    mesh.raycast = () => {};
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qz = new THREE.Quaternion();
    const p = new THREE.Vector3(), n = new THREE.Vector3(), s = new THREE.Vector3();
    for (let j = 0; j < count; j++) {
      let sz = rand(vis.size[0], vis.size[1]);
      if (explicit) {
        const [x, y, z, side] = explicit[j];
        n.set(0, 0, side);
        p.set(x, y, z);
        sz = 0.75;
      } else {
        const i = indices[j];
        n.set(this.nrm[i * 3], this.nrm[i * 3 + 1], this.nrm[i * 3 + 2]);
        p.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).addScaledVector(n, vis.offset + (j % 4) * 0.0008);
        if (tintFn) aTint.array.set(tintFn(i), j * 3);
      }
      const up = vis.upright ? _UP.set(0, 1, 0).addScaledVector(n, -n.y) : null;
      if (up && up.lengthSq() > 0.04) {
        // keep the texture's top pointing up the panel (droplet glints on top)
        up.normalize();
        _X.crossVectors(up, n);
        _B.makeBasis(_X, up, n);
        q.setFromRotationMatrix(_B);
      } else {
        q.setFromUnitVectors(_Z, n);
        qz.setFromAxisAngle(_Z, rand(TAU));
        q.multiply(qz);
      }
      m4.compose(p, q, s.set(sz, sz, sz));
      mesh.setMatrixAt(j, m4);
      aSeed.array[j] = Math.random();
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    return { mesh, indices, aValue, count };
  }

  _norm(name, i) {
    const v = this.L[name][i];
    if (name === 'dust') return clamp(v / this.dustMax, 0, 1);
    if (name === 'grime') return this.grimeInit[i] > 0 ? clamp(v / this.grimeInit[i], 0, 1) : 0;
    return clamp(v, 0, 1);
  }

  _updateVisuals() {
    for (const name of this.dirty) {
      const d = this.decals[name];
      if (!d) continue;
      const out = d.aValue.array;
      for (let j = 0; j < d.count; j++) out[j] = this._norm(name, d.indices[j]);
      d.aValue.needsUpdate = true;
    }
    if (this.dirty.has('tire') || this.dirty.has('dust')) this._updateTires();
    if (this.dirty.has('dust') || this.dirty.has('wax') || this.dirty.has('water') || this.dirty.has('flow')) this._updatePaint();
    this.dirty.clear();
  }

  /** Dusty paint looks flat; clean paint is glossy; waxed paint is a mirror. */
  _updatePaint() {
    const p = this.car.paint;
    const dust = this.dustRatio();
    let wax = 0, water = 0, wet = 0;
    const w = this.L.wax, wa = this.L.water, fl = this.L.flow;
    for (let i = 0; i < this.N; i++) {
      wax += Math.min(1, w[i]);
      water += Math.min(1, wa[i]);
      wet += Math.min(1, Math.max(wa[i], fl[i]));
    }
    const n = Math.max(1, this.N);
    wax /= n;
    this.wetLevel = water / n;
    wet /= n;
    // wet paint looks deeper and glossier
    p.roughness = clamp(0.3 + dust * 0.32 - wax * 0.2 - wet * 0.16, 0.05, 0.8);
    p.clearcoat = clamp(0.55 - dust * 0.45 + wax * 0.45 + wet * 0.35, 0, 1);
    p.clearcoatRoughness = clamp(0.16 + dust * 0.3 - wax * 0.12 - wet * 0.1, 0.02, 0.6);
    p.envMapIntensity = 1.1 + wax * 0.6;
  }

  _updateTires() {
    const car = this.car;
    const per = this.tp.perWheel;
    const dustLeft = this.dustRatio();
    for (let w = 0; w < car.wheels.length; w++) {
      let s = 0;
      for (let k = 0; k < per; k++) s += Math.min(1, this.L.tire[w * per + k]);
      const shine = s / per;
      const m = car.tireMats[w];
      const clean = 1 - dustLeft;
      m.color.setRGB(0.36 - 0.27 * clean, 0.3 - 0.22 * clean, 0.25 - 0.17 * clean, THREE.SRGBColorSpace);
      m.color.lerp(new THREE.Color(0x060607), shine);
      m.roughness = 0.95 - 0.7 * shine;
      m.metalness = 0.1 * shine;
    }
  }

  dustRatio() {
    let s = 0;
    const d = this.L.dust;
    for (let i = 0; i < this.N; i++) s += d[i];
    return clamp(s / (this.N * this.dustMax * 0.6), 0, 1);
  }

  /* ---------- brush ---------- */
  /** Apply a circular brush in car-local space. dir: unit vector pointing into the surface.
   *  Returns the total amount changed. */
  brush(layer, cx, cy, cz, dx, dy, dz, radius, amount, mode, minFacing = -0.2) {
    const isTire = layer === 'tire';
    const P = isTire ? this.tp.pos : this.pos;
    const Nn = isTire ? this.tp.nrm : this.nrm;
    const count = isTire ? this.tp.count : this.N;
    const arr = this.L[layer];
    const r2 = radius * radius;
    let changed = 0;
    for (let i = 0; i < count; i++) {
      const ex = P[i * 3] - cx, ey = P[i * 3 + 1] - cy, ez = P[i * 3 + 2] - cz;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > r2) continue;
      const facing = -(Nn[i * 3] * dx + Nn[i * 3 + 1] * dy + Nn[i * 3 + 2] * dz);
      if (facing < minFacing) continue;
      const f = clamp(1.35 * (1 - d2 / r2), 0, 1);
      const v = arr[i];
      if (mode === 'remove') {
        if (v <= 0) continue;
        const nv = Math.max(0, v - amount * f);
        arr[i] = nv;
        changed += v - nv;
      } else {
        if (v >= 1) continue;
        const nv = Math.min(1, v + amount * f);
        arr[i] = nv;
        changed += nv - v;
      }
    }
    if (changed > 0) {
      this.dirty.add(layer);
      if (layer === 'flow') this.flowActive = 3;
    }
    return changed;
  }

  /* ---------- steps & progress ---------- */
  sumOf(layer) {
    const a = this.L[layer];
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i];
    return s;
  }

  beginStep(step) {
    this.step = step;
    this.startSum = this.sumOf(step.layer);
  }

  progress() {
    const st = this.step;
    if (!st) return 0;
    if (st.mode === 'remove') {
      if (this.startSum <= 1e-6) return 1;
      return clamp(1 - this.sumOf(st.layer) / this.startSum, 0, 1);
    }
    const a = this.L[st.layer];
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.min(1, a[i]);
    return s / a.length;
  }

  /** Smoothly push a whole layer to a value (used when a step completes). */
  settle(layer, target, speed = 5) {
    this.auto = this.auto.filter((a) => a.layer !== layer);
    this.auto.push({ layer, target, speed, t: 0 });
  }

  isRemaining(layer, mode, i) {
    const v = this.L[layer][i];
    if (mode === 'remove') return layer === 'grime' ? v > 0.12 : v > 0.06;
    return v < 0.85;
  }

  /** Indices of points still needing work (sampled for helper bots). */
  randomRemaining(layer, mode, tries = 14) {
    const count = layer === 'tire' ? this.tp.count : this.N;
    const out = [];
    for (let k = 0; k < tries * 6 && out.length < tries; k++) {
      const i = Math.floor(Math.random() * count);
      if (this.isRemaining(layer, mode, i)) out.push(i);
    }
    return out;
  }

  pointOf(layer, i, outP, outN) {
    const P = layer === 'tire' ? this.tp.pos : this.pos;
    const Nn = layer === 'tire' ? this.tp.nrm : this.nrm;
    outP.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    if (outN) outN.set(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]);
  }

  /** How much of the remaining work faces toward / away from a car-local camera position. */
  facingStats(layer, mode, camLocal) {
    const isTire = layer === 'tire';
    const P = isTire ? this.tp.pos : this.pos;
    const Nn = isTire ? this.tp.nrm : this.nrm;
    const count = isTire ? this.tp.count : this.N;
    let toward = 0, away = 0, sideSum = 0;
    for (let i = 0; i < count; i++) {
      if (!this.isRemaining(layer, mode, i)) continue;
      const vx = camLocal.x - P[i * 3], vy = camLocal.y - P[i * 3 + 1], vz = camLocal.z - P[i * 3 + 2];
      const dot = Nn[i * 3] * vx + Nn[i * 3 + 1] * vy + Nn[i * 3 + 2] * vz;
      if (dot > 0) toward++;
      else { away++; sideSum += Math.atan2(P[i * 3 + 2], P[i * 3]); }
    }
    return { toward, away, avgAngle: away ? sideSum / away : 0 };
  }

  /** Car-local spots where a drop falls off this frame: from running water, and slowly while the car is wet. */
  sampleDrips(dt) {
    const out = [];
    const idx = this.dripIdx;
    if (!idx.length) return out;
    this.dripAcc = Math.min(3, this.dripAcc + ((this.flowActive > 0 ? 24 : 0) + this.wetLevel * 12) * dt);
    for (let tries = 0; this.dripAcc >= 1 && tries < 16; tries++) {
      const i = idx[Math.floor(Math.random() * idx.length)];
      if (this.L.flow[i] < 0.15 && this.L.water[i] < 0.5) continue;
      this.dripAcc -= 1;
      const P = this.pos, Nn = this.nrm;
      out.push([P[i * 3] + Nn[i * 3] * 0.015, P[i * 3 + 1] - 0.01, P[i * 3 + 2] + Nn[i * 3 + 2] * 0.015]);
    }
    return out;
  }

  update(dt) {
    if (this.flowActive > 0) {
      this.flowActive -= dt;
      const f = this.L.flow, k = this.flowActive > 0 ? Math.exp(-dt / 0.9) : 0; // last tick clears what's left
      for (let i = 0; i < f.length; i++) if (f[i] > 0) f[i] = f[i] < 0.01 ? 0 : f[i] * k;
      this.dirty.add('flow');
    }
    for (const a of this.auto) {
      a.t += dt;
      const arr = this.L[a.layer];
      const k = 1 - Math.exp(-a.speed * dt);
      for (let i = 0; i < arr.length; i++) {
        if (a.layer === 'grime' && a.target > 0 && this.grimeInit[i] <= 0) continue;
        arr[i] += (a.target - arr[i]) * k;
        if (Math.abs(arr[i] - a.target) < 0.01) arr[i] = a.target;
      }
      this.dirty.add(a.layer);
    }
    this.auto = this.auto.filter((a) => a.t < 1.6);

    // hint rings on remaining spots
    this.hintTimer -= dt;
    if (this.hintTimer <= 0 && this.decals.hint) {
      this.hintTimer = 0.25;
      const st = this.step;
      const out = this.decals.hint.aValue.array;
      const show = st && st.layer !== 'tire' && this.hintLevel > 0;
      for (let j = 0; j < this.hintIdx.length; j++) {
        out[j] = show && this.isRemaining(st.layer, st.mode, this.hintIdx[j]) ? 1 : 0;
      }
      this.decals.hint.aValue.needsUpdate = true;
      if (this.tireHint) {
        const per = this.tp.perWheel;
        const t = this.tireHint.aValue.array;
        for (let w = 0; w < this.tireHint.count; w++) {
          let s = 0;
          for (let k = 0; k < per; k++) s += Math.min(1, this.L.tire[w * per + k]);
          t[w] = st && st.layer === 'tire' && s / per < 0.9 ? 1 : 0;
        }
        this.tireHint.aValue.needsUpdate = true;
      }
    }
    if (materials.hint) materials.hint.uniforms.uOpacity.value = 0.25 + 0.65 * this.hintLevel;
    if (this.dirty.size) this._updateVisuals();
  }

  dispose() {
    for (const d of Object.values(this.decals)) if (d) d.mesh.geometry.dispose();
    if (this.tireHint) this.tireHint.mesh.geometry.dispose();
    this.group.removeFromParent();
  }
}

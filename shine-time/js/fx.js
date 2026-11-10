/* Effects: point particles (mist, foam, bubbles, sparkles), motion-stretched water droplets,
 * animated spray jets, and ripples where water lands on the floor. CPU-simulated, GPU-drawn. */
import * as THREE from 'three';
import { rand, TAU } from './util.js';

/* ------------------------------------------------------------------ round point sprites */
const VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
attribute float aShape;
uniform float uScale;
varying vec4 vColor;
varying float vShape;
void main() {
  vColor = aColor;
  vShape = aShape;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), 1.0, 256.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying vec4 vColor;
varying float vShape;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a;
  if (vShape < 0.5) {
    a = smoothstep(1.0, 0.2, d);
  } else if (vShape < 1.5) {
    float rim = smoothstep(1.0, 0.82, d) * smoothstep(0.45, 0.9, d);
    float hl = smoothstep(0.32, 0.0, length(c + vec2(0.18, 0.18)) * 2.0);
    a = rim * 0.9 + hl * 0.9 + 0.12;
  } else {
    float x = abs(c.x) * 2.0, y = abs(c.y) * 2.0;
    a = max(exp(-x * 9.0) * (1.0 - y), exp(-y * 9.0) * (1.0 - x)) + smoothstep(0.5, 0.0, d);
  }
  gl_FragColor = vec4(vColor.rgb, vColor.a * clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class ParticleSystem {
  constructor(max, additive) {
    this.max = max;
    this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.shape = new Float32Array(max);
    const mk = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', mk(this.pos, 3));
    g.setAttribute('aColor', mk(this.col, 4));
    g.setAttribute('aSize', mk(this.size, 1));
    g.setAttribute('aShape', mk(this.shape, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  spawn(p) {
    if (this.list.length >= this.max) return null;
    p.life = 0;
    this.list.push(p);
    return p;
  }

  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life += dt;
      if (p.life >= p.max) {
        if (p.die) p.die(p);
        L[i] = L[L.length - 1];
        L.pop();
        i--;
        continue;
      }
      p.vy -= (p.grav || 0) * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.01) { p.y = 0.01; p.vy *= -0.25; p.vx *= 0.6; p.vz *= 0.6; }
      const t = p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 4] = p.r; this.col[n * 4 + 1] = p.g; this.col[n * 4 + 2] = p.b;
      this.col[n * 4 + 3] = p.a * (p.fadeIn ? Math.min(1, t * 6) : 1) * (1 - Math.pow(t, p.fade || 2));
      this.size[n] = p.s0 + (p.s1 - p.s0) * t;
      this.shape[n] = p.shape || 0;
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'aColor', 'aSize', 'aShape']) this.geo.attributes[k].needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ motion-stretched droplets
 * Each particle is a camera-facing capsule from its position back along its velocity,
 * so fast water reads as streaks and slow drips as round beads. */
const STREAK_VERT = /* glsl */ `
attribute vec3 aVel;
attribute vec2 aCorner;
attribute float aWidth;
attribute vec4 aColor;
varying vec4 vColor;
varying vec2 vC;
varying float vLen;
void main() {
  vec4 hv = modelViewMatrix * vec4(position, 1.0);
  vec4 tv = modelViewMatrix * vec4(position - aVel, 1.0);
  vec3 axis = hv.xyz - tv.xyz;
  float len = length(axis);
  vec3 dir = len > 1e-6 ? axis / len : vec3(0.0, 1.0, 0.0);
  vec3 side = cross(dir, normalize(-(hv.xyz + tv.xyz) * 0.5));
  float sl = length(side);
  side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
  float w = max(aWidth * 0.5, 1e-4);
  vec3 a = tv.xyz - dir * w;
  vec3 b = hv.xyz + dir * w;
  vec3 p = mix(a, b, aCorner.y) + side * (aCorner.x * w);
  vColor = aColor;
  vLen = (len + 2.0 * w) / w;          // capsule length in half-widths
  vC = vec2(aCorner.x, aCorner.y * vLen);
  gl_Position = projectionMatrix * vec4(p, 1.0);
}`;

const STREAK_FRAG = /* glsl */ `
varying vec4 vColor;
varying vec2 vC;
varying float vLen;
void main() {
  float s = vC.y - clamp(vC.y, 1.0, vLen - 1.0);
  float d = length(vec2(vC.x, s));
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.45, d);
  float along = vC.y / vLen;                       // 0 tail .. 1 head
  a *= mix(0.3, 1.0, along);
  vec3 col = vColor.rgb + vec3(0.35) * smoothstep(0.6, 0.0, abs(vC.x + 0.25)) * along;
  gl_FragColor = vec4(col, vColor.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class StreakSystem {
  constructor(max) {
    this.max = max;
    this.list = [];
    const V = max * 4;
    this.pos = new Float32Array(V * 3);
    this.vel = new Float32Array(V * 3);
    this.wid = new Float32Array(V);
    this.col = new Float32Array(V * 4);
    const corner = new Float32Array(V * 2);
    const index = new Uint16Array(max * 6);
    const C = [-1, 0, 1, 0, -1, 1, 1, 1];
    for (let i = 0; i < max; i++) {
      corner.set(C, i * 8);
      index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    const mk = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', mk(this.pos, 3));
    g.setAttribute('aVel', mk(this.vel, 3));
    g.setAttribute('aWidth', mk(this.wid, 1));
    g.setAttribute('aColor', mk(this.col, 4));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
  }

  spawn(p) {
    if (this.list.length >= this.max) return null;
    p.life = 0;
    this.list.push(p);
    return p;
  }

  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life += dt;
      p.vy -= (p.grav || 0) * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const landed = p.y <= 0.012;
      if (p.life >= p.max || landed) {
        if (landed && p.onGround) p.onGround(p);
        else if (p.die) p.die(p);
        L[i] = L[L.length - 1];
        L.pop();
        i--;
        continue;
      }
      const t = p.life / p.max;
      const a = p.a * (1 - Math.pow(t, p.fade || 3));
      const w = p.s0 + (p.s1 - p.s0) * t;
      const st = p.stretch || 0.03;
      for (let v = 0; v < 4; v++) {
        const j = n * 4 + v;
        this.pos[j * 3] = p.x; this.pos[j * 3 + 1] = p.y; this.pos[j * 3 + 2] = p.z;
        this.vel[j * 3] = p.vx * st; this.vel[j * 3 + 1] = p.vy * st; this.vel[j * 3 + 2] = p.vz * st;
        this.wid[j] = w;
        this.col[j * 4] = p.r; this.col[j * 4 + 1] = p.g; this.col[j * 4 + 2] = p.b; this.col[j * 4 + 3] = a;
      }
      n++;
    }
    this.geo.setDrawRange(0, n * 6);
    for (const k of ['position', 'aVel', 'aWidth', 'aColor']) this.geo.attributes[k].needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ spray jets
 * A tapered tube from the nozzle to where the spray lands, with streaky noise racing along it. */
const JET_VERT = /* glsl */ `
uniform float uLen;
uniform float uR0;
uniform float uR1;
uniform float uTime;
uniform float uWobble;
varying vec2 vUv;
varying float vY;
varying vec3 vN;
varying vec3 vView;
void main() {
  float y = position.y + 0.5;
  float r = mix(uR0, uR1, pow(y, 0.8));
  vec3 p = vec3(position.x * r, y * uLen, position.z * r);
  p.x += sin(uTime * 37.0 + y * 9.0) * uWobble * y;
  p.z += cos(uTime * 29.0 + y * 7.0) * uWobble * y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vUv = uv;
  vY = y;
  vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z));
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const JET_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uSpeed;
uniform float uStreaks;
varying vec2 vUv;
varying float vY;
varying vec3 vN;
varying vec3 vView;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// value noise that wraps around the tube (period uStreaks in x)
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, uStreaks), x1 = mod(i.x + 1.0, uStreaks);
  float a = hash(vec2(x0, i.y)), b = hash(vec2(x1, i.y));
  float c = hash(vec2(x0, i.y + 1.0)), d = hash(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
  float fres = 1.0 - abs(dot(normalize(vN), normalize(vView)));
  vec2 q = vec2(vUv.x * uStreaks, vY * 7.0 - uTime * uSpeed);
  float n = vnoise(q) * 0.6 + vnoise(q * vec2(1.0, 2.7) + 13.0) * 0.4;
  float body = 0.3 + 0.7 * smoothstep(0.3, 0.8, n);
  float a = uOpacity * body * (0.35 + 0.65 * fres);
  a *= smoothstep(0.0, 0.05, vY);
  a *= 1.0 - 0.75 * smoothstep(0.7, 1.0, vY);
  vec3 col = uColor * (0.8 + 0.5 * fres) + vec3(0.3) * smoothstep(0.65, 0.95, n);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const JET_KINDS = {
  hose: { color: '#d6f1ff', opacity: 0.7, r0: 0.01, r1: 0.085, speed: 26, streaks: 9, wobble: 0.006 },
  foam: { color: '#ffffff', opacity: 0.9, r0: 0.03, r1: 0.16, speed: 9, streaks: 5, wobble: 0.012 },
  tire: { color: '#c3cdd2', opacity: 0.22, r0: 0.008, r1: 0.06, speed: 14, streaks: 7, wobble: 0.004 },
};

class Jets {
  constructor(scene, count = 3) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 14, 10, true);
    this.items = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uLen: { value: 1 }, uR0: { value: 0.01 }, uR1: { value: 0.08 }, uTime: { value: 0 }, uWobble: { value: 0 },
          uColor: { value: new THREE.Color() }, uOpacity: { value: 0.6 }, uSpeed: { value: 20 }, uStreaks: { value: 9 },
        },
        vertexShader: JET_VERT, fragmentShader: JET_FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 12;
      mesh.visible = false;
      scene.add(mesh);
      this.items.push(mesh);
    }
    this.used = 0;
    this.time = 0;
    this._up = new THREE.Vector3(0, 1, 0);
    this._d = new THREE.Vector3();
  }

  show(kind, from, to, power = 1) {
    const d = this._d.subVectors(to, from);
    const len = d.length();
    if (this.used >= this.items.length || len < 1e-3) return;
    const k = JET_KINDS[kind];
    const m = this.items[this.used++];
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(this._up, d.divideScalar(len));
    const u = m.material.uniforms;
    u.uLen.value = len;
    u.uR0.value = k.r0;
    u.uR1.value = k.r1 * (0.8 + 0.2 * power);
    u.uColor.value.set(k.color);
    u.uOpacity.value = k.opacity;
    u.uSpeed.value = k.speed;
    u.uStreaks.value = k.streaks;
    u.uWobble.value = k.wobble;
    m.visible = true;
  }

  update(dt) {
    this.time += dt;
    this.items.forEach((m, i) => {
      m.visible = i < this.used;
      m.material.uniforms.uTime.value = this.time;
    });
    this.used = 0;
  }
}

/* ------------------------------------------------------------------ floor ripples */
const RIPPLE_VERT = /* glsl */ `
attribute float aBirth;
varying vec2 vUv;
varying float vBirth;
void main() {
  vUv = uv;
  vBirth = aBirth;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const RIPPLE_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vBirth;
void main() {
  float age = (uTime - vBirth) / 0.9;
  if (age < 0.0 || age > 1.0) discard;
  float d = length(vUv - 0.5) * 2.0;
  float r = 0.15 + age * 0.85;
  float ring = exp(-pow((d - r) / 0.06, 2.0)) + 0.5 * exp(-pow((d - r * 0.6) / 0.05, 2.0));
  float a = ring * (1.0 - age) * 0.4;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.85, 0.95, 1.0), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class Ripples {
  constructor(scene, max = 48) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.birth = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(-10), 1);
    geo.setAttribute('aBirth', this.birth);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, vertexShader: RIPPLE_VERT, fragmentShader: RIPPLE_FRAG,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.max = max;
    this.next = 0;
    this.time = 0;
    this.budget = 0;
    this._m = new THREE.Matrix4();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, zero);
    scene.add(this.mesh);
  }

  spawn(x, z, size = 0.35) {
    if (this.budget <= 0) return;
    this.budget -= 1;
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this._m.makeScale(size, 1, size).setPosition(x, 0.008, z);
    this.mesh.setMatrixAt(i, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.birth.array[i] = this.time;
    this.birth.needsUpdate = true;
  }

  update(dt) {
    this.time += dt;
    this.budget = Math.min(4, this.budget + dt * 30); // at most ~30 new ripples a second
    this.mat.uniforms.uTime.value = this.time;
  }
}

/* ------------------------------------------------------------------ public API */
const tmpC = new THREE.Color();
function lin(hex) {
  tmpC.set(hex);
  return [tmpC.r, tmpC.g, tmpC.b];
}
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();

export class Fx {
  constructor(scene) {
    this.soft = new ParticleSystem(1800, false);
    this.glow = new ParticleSystem(700, true);
    this.drops = new StreakSystem(1100);
    this.jets = new Jets(scene, 3);
    this.ripples = new Ripples(scene);
    scene.add(this.soft.points, this.glow.points, this.drops.mesh);
    this.acc = {};
    /** Called with (x, z, amount) when water lands on the floor. Set by main to wet the floor. */
    this.onFloorWater = null;
    this.C = {
      water: lin('#cfeeff'), mist: lin('#ffffff'), foam: lin('#ffffff'), bubble: lin('#e9f8ff'),
      tire: lin('#9aa7ad'), spark: lin('#fff2c4'), air: lin('#ffffff'), gold: lin('#ffd54f'), aqua: lin('#51e4d1'),
    };
    this._landWater = (p) => {
      this.ripples.spawn(p.x, p.z, rand(0.22, 0.42));
      if (this.onFloorWater) this.onFloorWater(p.x, p.z, 0.0012);
    };
  }

  setScale(viewportHeightPx, fovDeg) {
    const s = viewportHeightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.soft.mat.uniforms.uScale.value = s;
    this.glow.mat.uniforms.uScale.value = s;
  }

  _rate(key, rate, dt) {
    const v = (this.acc[key] || 0) + rate * dt;
    const n = Math.floor(v);
    this.acc[key] = v - n;
    return n;
  }

  /** Continuous spray from a nozzle tip to a surface point. kind: hose | foam | tire | air */
  stream(kind, from, to, normal, dt, power = 1) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz) || 0.001;
    const ux = dx / dist, uy = dy / dist, uz = dz / dist;
    if (kind !== 'air') this.jets.show(kind, from, to, power);

    if (kind === 'hose') {
      // droplets racing along the jet
      const C = this.C.water;
      const n = this._rate('hoseDrop', 110 * power, dt);
      for (let i = 0; i < n; i++) {
        const sp = rand(11, 15);
        this.drops.spawn({
          x: from.x, y: from.y, z: from.z,
          vx: ux * sp + rand(-0.5, 0.5), vy: uy * sp + rand(-0.5, 0.5), vz: uz * sp + rand(-0.5, 0.5),
          max: (dist / sp) * rand(0.85, 1), s0: 0.012, s1: 0.02, r: C[0], g: C[1], b: C[2], a: 0.75, stretch: 0.022, fade: 6,
        });
      }
      this.splash(to, normal, this._rate('hoseSplash', 150 * power, dt), { x: ux, y: uy, z: uz });
      if (Math.random() < dt * 22 * power) this.mist(to, normal);
      return;
    }

    const cfg = {
      foam: { rate: 120, speed: 7, spread: 1.4, s: [0.06, 0.12], col: this.C.foam, a: 0.95, shape: 1 },
      tire: { rate: 140, speed: 6, spread: 0.7, s: [0.012, 0.025], col: this.C.tire, a: 0.55, shape: 0 },
      air: { rate: 90, speed: 12, spread: 1.6, s: [0.04, 0.09], col: this.C.air, a: 0.16, shape: 0 },
    }[kind];
    const n = this._rate(kind, cfg.rate * power, dt);
    for (let i = 0; i < n; i++) {
      const sp = cfg.speed * rand(0.85, 1.15);
      const life = (dist / sp) * rand(0.92, 1.05);
      const C = cfg.col;
      this.soft.spawn({
        x: from.x + rand(-0.01, 0.01), y: from.y + rand(-0.01, 0.01), z: from.z + rand(-0.01, 0.01),
        vx: ux * sp + rand(-cfg.spread, cfg.spread) * 0.4, vy: uy * sp + rand(-cfg.spread, cfg.spread) * 0.4, vz: uz * sp + rand(-cfg.spread, cfg.spread) * 0.4,
        max: life, s0: cfg.s[0], s1: cfg.s[1], r: C[0], g: C[1], b: C[2], a: cfg.a, shape: cfg.shape, fade: 6,
      });
    }
  }

  /** Spray bouncing off a surface: fast droplets fanning out along it, then falling. */
  splash(at, normal, n = 3, incoming = null) {
    const C = this.C.water;
    for (let i = 0; i < n; i++) {
      // random direction in the surface plane, plus some bounce off it
      const t = _t1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
      t.addScaledVector(normal, -t.dot(normal)).normalize();
      const along = rand(1.2, 3.4), out = rand(0.6, 2.2);
      const v = _t2.copy(t).multiplyScalar(along).addScaledVector(normal, out);
      if (incoming) v.addScaledVector(incoming, rand(0.3, 1.2)).addScaledVector(normal, -Math.min(0, v.dot(normal)) * 1.1);
      this.drops.spawn({
        x: at.x + normal.x * 0.02, y: at.y + normal.y * 0.02, z: at.z + normal.z * 0.02,
        vx: v.x, vy: v.y + rand(0, 0.8), vz: v.z,
        grav: 9.8, drag: 0.6, max: rand(0.35, 0.9), s0: rand(0.012, 0.02), s1: 0.01,
        r: C[0], g: C[1], b: C[2], a: 0.7, stretch: 0.03, fade: 3, onGround: this._landWater,
      });
    }
  }

  mist(at, normal) {
    const C = this.C.mist;
    this.soft.spawn({
      x: at.x + normal.x * 0.06, y: at.y + normal.y * 0.06, z: at.z + normal.z * 0.06,
      vx: normal.x * 0.5 + rand(-0.35, 0.35), vy: rand(0, 0.45), vz: normal.z * 0.5 + rand(-0.35, 0.35),
      drag: 1.6, max: rand(0.6, 1.1), s0: 0.14, s1: 0.5, r: C[0], g: C[1], b: C[2], a: 0.2, fade: 1.5, fadeIn: true,
    });
  }

  bubbles(at, normal, dt, rate = 40) {
    const n = this._rate('bub', rate, dt);
    const C = this.C.bubble;
    for (let i = 0; i < n; i++) {
      this.soft.spawn({
        x: at.x + rand(-0.12, 0.12), y: at.y + rand(-0.06, 0.08), z: at.z + rand(-0.12, 0.12),
        vx: normal.x * 0.25 + rand(-0.15, 0.15), vy: rand(0.15, 0.45), vz: normal.z * 0.25 + rand(-0.15, 0.15),
        drag: 0.8, max: rand(0.7, 1.4), s0: rand(0.025, 0.05), s1: rand(0.05, 0.075), r: C[0], g: C[1], b: C[2], a: 0.85, shape: 1, fade: 4, fadeIn: true,
      });
    }
  }

  /** Water flung off by a towel or blown off by a blower. */
  drips(at, normal, dt) {
    const n = this._rate('drip', 22, dt);
    const C = this.C.water;
    for (let i = 0; i < n; i++) {
      this.drops.spawn({
        x: at.x + rand(-0.15, 0.15), y: at.y, z: at.z + rand(-0.15, 0.15),
        vx: normal.x * rand(0.5, 1.6), vy: rand(0.2, 1.1), vz: normal.z * rand(0.5, 1.6),
        grav: 9.8, max: rand(0.5, 1.1), s0: 0.018, s1: 0.014, r: C[0], g: C[1], b: C[2], a: 0.75,
        stretch: 0.03, onGround: this._landWater,
      });
    }
  }

  /** A single drop falling off the car (world position). */
  drip(x, y, z) {
    const C = this.C.water;
    this.drops.spawn({
      x, y, z, vx: rand(-0.05, 0.05), vy: rand(-0.4, 0), vz: rand(-0.05, 0.05),
      grav: 9.8, max: 2, s0: rand(0.014, 0.022), s1: 0.016, r: C[0], g: C[1], b: C[2], a: 0.8,
      stretch: 0.025, fade: 8, onGround: this._landWater,
    });
  }

  sparkles(at, dt, rate = 30, spread = 0.2, gold = false) {
    const n = this._rate('spk' + (gold ? 'g' : ''), rate, dt);
    const C = gold ? this.C.gold : this.C.spark;
    for (let i = 0; i < n; i++) {
      this.glow.spawn({
        x: at.x + rand(-spread, spread), y: at.y + rand(-spread, spread) * 0.6, z: at.z + rand(-spread, spread),
        vx: rand(-0.1, 0.1), vy: rand(0.05, 0.3), vz: rand(-0.1, 0.1),
        max: rand(0.4, 0.9), s0: rand(0.05, 0.1), s1: 0.01, r: C[0], g: C[1], b: C[2], a: 1, shape: 2, fade: 1.5,
      });
    }
  }

  burst(center, size, count = 120) {
    for (let i = 0; i < count; i++) {
      const a = rand(TAU), r = rand(0.2, 1);
      const C = Math.random() < 0.3 ? this.C.aqua : this.C.spark;
      this.glow.spawn({
        x: center.x + Math.cos(a) * size.x * 0.5 * r, y: center.y + rand(0, size.y), z: center.z + Math.sin(a) * size.z * 0.5 * r,
        vx: rand(-0.4, 0.4), vy: rand(0.2, 1.2), vz: rand(-0.4, 0.4), drag: 1.2,
        max: rand(0.6, 1.4), s0: rand(0.08, 0.16), s1: 0.01, r: C[0], g: C[1], b: C[2], a: 1, shape: 2, fade: 1.2,
      });
    }
  }

  update(dt) {
    this.soft.update(dt);
    this.glow.update(dt);
    this.drops.update(dt);
    this.jets.update(dt);
    this.ripples.update(dt);
  }
}

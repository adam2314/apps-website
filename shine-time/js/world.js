/* The wash bay, its surroundings, lighting and time-of-day. */
import * as THREE from 'three';
import { clamp, lerp, rand } from './util.js';
import { makeConcrete, makeBayFloor, makeTiles, makeGrate, makeSignTexture, makeTextTexture, makeVendingFront, makePoster, makePuddleMask } from './textures.js';
import { worldText } from './i18n.js';
import { mergeByMaterial } from './merge.js';

export const BAY = { x: 8, z: 5.5, h: 4.5, doorZ: 1.9, doorH: 3.2 };

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...o });

function plane(w, h, mat) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}
function box(sx, sy, sz, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
}

function buildEnvScene() {
  const env = new THREE.Scene();
  const room = box(24, 12, 24, new THREE.MeshBasicMaterial({ color: 0x5d6d76, side: THREE.BackSide }));
  room.position.y = 5;
  env.add(room);
  const floor = box(24, 0.1, 24, new THREE.MeshBasicMaterial({ color: 0x2c3438 }));
  floor.position.y = -0.95;
  env.add(floor);
  const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(9) });
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.93, 0.82).multiplyScalar(5) });
  const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.95, 1).multiplyScalar(4) });
  for (let i = -1; i <= 1; i++) {
    const p = box(14, 0.1, 1.1, bright);
    p.position.set(0, 10.8, i * 4);
    env.add(p);
  }
  const s1 = box(0.1, 4, 9, warm); s1.position.set(-11.8, 4, 0); env.add(s1);
  const s2 = box(0.1, 4, 9, cool); s2.position.set(11.8, 4, 0); env.add(s2);
  const s3 = box(9, 3, 0.1, cool); s3.position.set(0, 5, -11.8); env.add(s3);
  const s4 = box(9, 3, 0.1, warm); s4.position.set(0, 5, 11.8); env.add(s4);
  return env;
}

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FRAG = `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGround; varying vec3 vDir;
void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.6)) : mix(uHorizon, uGround, pow(-h, 0.4));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// key frames of the day: [minutes, top, horizon, sunColor, sunIntensity]
const SKY_KEYS = [
  [6 * 60, '#2b3a6b', '#f7a072', '#ffb27a', 0.6],
  [9 * 60, '#4aa3df', '#ffe1b8', '#fff1d6', 1.0],
  [12 * 60, '#2f8fdc', '#c7ecff', '#ffffff', 1.15],
  [16 * 60, '#3d7fc6', '#ffd6a5', '#ffe2b0', 1.0],
  [18 * 60, '#433d7c', '#ff8f6b', '#ff9e6b', 0.7],
  [20 * 60, '#0f1638', '#3c3970', '#8fa4ff', 0.35],
];

export class World {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.quality = quality;
    this.groups = { back: new THREE.Group(), front: new THREE.Group(), left: new THREE.Group(), right: new THREE.Group(), ceiling: new THREE.Group() };
    for (const g of Object.values(this.groups)) scene.add(g);
    this.upgradeProps = {};
    this.t = 0;

    // environment reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = buildEnvScene();
    this.envRT = pmrem.fromScene(envScene, 0.035);
    scene.environment = this.envRT.texture;
    pmrem.dispose();

    this._sky();
    this._lights();
    this._bay();
    this._props();
    this._outside();
    for (const g of Object.values(this.groups)) mergeByMaterial(g);
    this.setTime(9 * 60);
  }

  _sky() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color('#4b5a52') } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), this.skyMat);
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog(0xc7ecff, 35, 110);
  }

  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xe6f6ff, 0x3a464e, 0.85);
    s.add(this.hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 10, 6);
    if (this.quality.shadows) {
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      const c = key.shadow.camera;
      c.left = -6; c.right = 6; c.top = 6; c.bottom = -6; c.near = 1; c.far = 30;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
    }
    s.add(key);
    this.key = key;
    const fill = new THREE.DirectionalLight(0xcfe8ff, 0.55);
    fill.position.set(-6, 5, -4);
    s.add(fill);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.0);
    this.sun.position.set(-30, 25, 10);
    s.add(this.sun);
  }

  _bay() {
    const { x: X, z: Z, h: H, doorZ: DZ, doorH: DH } = BAY;
    const g = this.groups;
    // floor
    const floorTex = makeBayFloor();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(2, 1.4);
    const floor = plane(2 * X, 2 * Z, std('#ffffff', { map: floorTex, roughness: 0.32, metalness: 0.15, envMapIntensity: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // lane lines and grates
    const yellow = std('#ffc928', { roughness: 0.5 });
    for (const z of [-1.55, 1.55]) {
      const l = plane(2 * X - 0.4, 0.08, yellow);
      l.rotation.x = -Math.PI / 2;
      l.position.set(0, 0.003, z);
      this.scene.add(l);
    }
    const grateTex = makeGrate();
    for (const z of [-2.6, 2.6]) {
      const gr = plane(9, 0.28, std('#ffffff', { map: grateTex, roughness: 0.6, metalness: 0.4 }));
      gr.rotation.x = -Math.PI / 2;
      gr.position.set(0, 0.004, z);
      this.scene.add(gr);
    }
    // puddles: a glossy dark film whose wet area grows with this.wet (deep spots first) and drains over time
    this.wet = 0;
    this.puddleWet = { value: 0 };
    const puddleMat = new THREE.MeshStandardMaterial({
      color: '#0c1a22', roughness: 0.04, metalness: 0, envMapIntensity: 1.7, alphaMap: makePuddleMask(),
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    puddleMat.onBeforeCompile = (sh) => {
      sh.uniforms.uWet = this.puddleWet;
      sh.fragmentShader = `uniform float uWet;\n${sh.fragmentShader}`.replace('#include <alphamap_fragment>', `
        float wetMask = texture2D( alphaMap, vAlphaMapUv ).g;
        float puddle = smoothstep( 1.0 - uWet, 1.0 - uWet + 0.16, wetMask );
        float damp = smoothstep( 0.0, 0.35, uWet ) * smoothstep( 0.04, 0.3, wetMask ) * 0.32;
        diffuseColor.a *= max( puddle * 0.82, damp );`);
    };
    const puddles = plane(11, 6.6, puddleMat);
    puddles.rotation.x = -Math.PI / 2;
    puddles.position.y = 0.005;
    this.scene.add(puddles);

    // contact shadow under the car
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sctx = sc.getContext('2d');
    const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    this.blobTex = new THREE.CanvasTexture(sc);

    // walls (single-sided, facing inward, so the camera can see in from outside)
    const tiles = makeTiles([2 * X / 1.6, H / 1.6]);
    const wallMat = std('#ffffff', { map: tiles, roughness: 0.35, envMapIntensity: 0.6 });
    const back = plane(2 * X, H, wallMat);
    back.position.set(0, H / 2, -Z);
    g.back.add(back);
    const front = plane(2 * X, H, wallMat);
    front.position.set(0, H / 2, Z);
    front.rotation.y = Math.PI;
    g.front.add(front);
    const stripeMat = std('#51e4d1', { roughness: 0.4, emissive: '#1b6f66', emissiveIntensity: 0.3 });
    const baseMat = std('#1d2a31', { roughness: 0.6 });
    for (const [grp, z, ry] of [[g.back, -Z + 0.01, 0], [g.front, Z - 0.01, Math.PI]]) {
      const st = plane(2 * X, 0.22, stripeMat);
      st.position.set(0, 1.25, z);
      st.rotation.y = ry;
      grp.add(st);
      const bs = plane(2 * X, 0.3, baseMat);
      bs.position.set(0, 0.15, z);
      bs.rotation.y = ry;
      grp.add(bs);
    }
    // end walls with door openings
    const sideW = Z - DZ;
    const endMat = std('#ffffff', { map: makeTiles([sideW / 1.6, H / 1.6]), roughness: 0.35 });
    const headMat = std('#ffffff', { map: makeTiles([2 * DZ / 1.6, (H - DH) / 1.6]), roughness: 0.35 });
    for (const [grp, x, ry] of [[g.left, -X, Math.PI / 2], [g.right, X, -Math.PI / 2]]) {
      for (const zc of [-(DZ + sideW / 2), DZ + sideW / 2]) {
        const p = plane(sideW, H, endMat);
        p.position.set(x, H / 2, zc);
        p.rotation.y = ry;
        grp.add(p);
      }
      const hdr = plane(2 * DZ, H - DH, headMat);
      hdr.position.set(x, DH + (H - DH) / 2, 0);
      hdr.rotation.y = ry;
      grp.add(hdr);
      // door frame
      const frameMat = std('#263238', { roughness: 0.4, metalness: 0.5 });
      const inward = x < 0 ? 0.06 : -0.06;
      for (const zc of [-DZ, DZ]) {
        const f = box(0.12, DH, 0.12, frameMat);
        f.position.set(x + inward, DH / 2, zc);
        grp.add(f);
      }
      const top = box(0.12, 0.12, 2 * DZ + 0.12, frameMat);
      top.position.set(x + inward, DH, 0);
      grp.add(top);
      // hanging strip curtain stubs
      const curtainMat = new THREE.MeshStandardMaterial({ color: '#bfe9f2', transparent: true, opacity: 0.35, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
      for (let i = 0; i < 9; i++) {
        const c = plane(0.36, 0.5, curtainMat);
        c.position.set(x + inward * 1.5, DH - 0.3, -DZ + 0.22 + i * 0.43);
        c.rotation.y = Math.PI / 2;
        grp.add(c);
      }
      // sign above door
      const label = x < 0 ? worldText().enter : worldText().exit;
      const sign = plane(1.4, 0.35, new THREE.MeshBasicMaterial({ map: makeTextTexture(label, { bg: x < 0 ? '#2e7d32' : '#c62828', fg: '#ffffff', w: 256, h: 64 }) }));
      sign.position.set(x + inward * 1.2, DH + 0.45, 0);
      sign.rotation.y = ry;
      grp.add(sign);
    }
    // ceiling
    const ceil = plane(2 * X, 2 * Z, std('#d9e3e8', { roughness: 0.8 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    g.ceiling.add(ceil);
    const panelMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.4 });
    for (const z of [-2.2, 2.2]) {
      for (let i = -2; i <= 2; i++) {
        const p = box(1.8, 0.05, 0.4, panelMat);
        p.position.set(i * 3.1, H - 0.03, z);
        g.ceiling.add(p);
      }
    }
    // gantry rails
    const steel = std('#90a4ae', { metalness: 0.8, roughness: 0.35 });
    for (const z of [-1.3, 1.3]) {
      const r = box(2 * X - 0.3, 0.14, 0.14, steel);
      r.position.set(0, H - 0.45, z);
      g.ceiling.add(r);
    }
    const trolley = box(0.4, 0.3, 2.9, std('#ffb300', { metalness: 0.3 }));
    trolley.position.set(-2.5, H - 0.6, 0);
    g.ceiling.add(trolley);
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), std('#263238'));
    hang.position.set(-2.5, H - 1.3, 0.9);
    g.ceiling.add(hang);
  }

  _props() {
    const g = this.groups;
    const { x: X, z: Z } = BAY;
    // main sign
    const sign = plane(4.2, 1.05, new THREE.MeshBasicMaterial({ map: makeSignTexture(worldText().sign) }));
    sign.position.set(0, 3.45, -Z + 0.03);
    g.back.add(sign);
    // shelf with bottles
    const shelfMat = std('#455a64', { metalness: 0.4 });
    const bottleMats = ['#e91e63', '#29b6f6', '#ffca28', '#66bb6a', '#ab47bc', '#ff7043'].map((c) => std(c, { roughness: 0.3 }));
    for (const y of [1.6, 2.1]) {
      const sh = box(1.8, 0.05, 0.35, shelfMat);
      sh.position.set(4.6, y, -Z + 0.2);
      g.back.add(sh);
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, rand(0.24, 0.32), 12), bottleMats[(i + (y > 2 ? 3 : 0)) % 6]);
        b.position.set(3.85 + i * 0.3, y + 0.15, -Z + 0.2);
        g.back.add(b);
      }
    }
    // hose reel
    const reel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 12, 32), std('#263238'));
    reel.position.set(-4.8, 2.0, -Z + 0.18);
    g.back.add(reel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 32), std('#ffb300'));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(-4.8, 2.0, -Z + 0.1);
    g.back.add(hub);
    // tyre stack + cones + bucket on the front side
    const tyreMat = std('#1b1d1f', { roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 10, 24), tyreMat);
      t.rotation.x = Math.PI / 2;
      t.position.set(-6.4, 0.12 + i * 0.24, Z - 0.6);
      g.front.add(t);
    }
    const coneMat = std('#ff6d00');
    for (const [x, z] of [[6.5, Z - 0.6], [6.9, Z - 1.1], [-6.6, -Z + 0.7]]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 16), coneMat);
      c.position.set(x, 0.25, z);
      (z > 0 ? g.front : g.back).add(c);
    }
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 16, 1, true), std('#1e88e5', { side: THREE.DoubleSide }));
    bucket.position.set(5.2, 0.17, Z - 0.6);
    g.front.add(bucket);

    // upgrade props (hidden until purchased)
    const vend = new THREE.Group();
    const vbody = box(0.9, 1.9, 0.75, std('#c62828', { roughness: 0.4 }));
    vbody.position.y = 0.95;
    vend.add(vbody);
    const vfront = plane(0.86, 1.86, new THREE.MeshStandardMaterial({ map: makeVendingFront(worldText().snacks), emissive: '#ffffff', emissiveMap: makeVendingFront(worldText().snacks), emissiveIntensity: 0.35 }));
    vfront.position.set(0, 0.95, 0.38);
    vend.add(vfront);
    vend.position.set(-2.6, 0, -Z + 0.45);
    g.back.add(vend);
    this.upgradeProps.vending = vend;

    const lounge = new THREE.Group();
    const sofaMat = std('#00897b', { roughness: 0.85 });
    const seat = box(2.2, 0.45, 0.85, sofaMat); seat.position.y = 0.25; lounge.add(seat);
    const backr = box(2.2, 0.6, 0.22, sofaMat); backr.position.set(0, 0.7, 0.35); lounge.add(backr);
    for (const sx of [-1.15, 1.15]) { const arm = box(0.2, 0.6, 0.85, sofaMat); arm.position.set(sx, 0.4, 0); lounge.add(arm); }
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 20), std('#8d6e63'));
    table.position.set(0, 0.42, -0.85); lounge.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), std('#5d4037'));
    leg.position.set(0, 0.2, -0.85); lounge.add(leg);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 12), std('#efebe9'));
    pot.position.set(1.7, 0.2, 0.1); lounge.add(pot);
    const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), std('#43a047', { flatShading: true }));
    plant.position.set(1.7, 0.75, 0.1); lounge.add(plant);
    lounge.position.set(2.4, 0, Z - 0.75);
    g.front.add(lounge);
    this.upgradeProps.lounge = lounge;

    const posters = [];
    const pData = worldText().posters.map(([title, sub], i) => [title, sub, ['#ec407a', '#7e57c2', '#ff7043'][i]]);
    pData.forEach(([t, s, c], i) => {
      const p = plane(0.9, 1.26, new THREE.MeshStandardMaterial({ map: makePoster(t, s, c), roughness: 0.6 }));
      const onBack = i !== 1;
      p.position.set(onBack ? (i === 0 ? -6.8 : 2.0) : -4.2, 2.3, onBack ? -Z + 0.02 : Z - 0.02);
      if (!onBack) p.rotation.y = Math.PI;
      (onBack ? g.back : g.front).add(p);
      posters.push(p);
    });
    this.upgradeProps.posters = posters;

    const dock = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 24), std('#37474f', { metalness: 0.6 }));
    dock.add(pad);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: '#51e4d1' }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.045;
    dock.add(glow);
    dock.position.set(-3.4, 2.1, -Z + 0.45);
    const bracket = box(0.1, 0.1, 0.45, std('#37474f'));
    bracket.position.set(0, -0.05, -0.2);
    dock.add(bracket);
    g.back.add(dock);
    this.upgradeProps.dock = dock;

    // blob shadow mesh used under cars
    this.blobMat = new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false });
  }

  makeBlob(len, wid) {
    const m = plane(len + 1.2, wid + 1.0, this.blobMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.006;
    m.renderOrder = 1;
    return m;
  }

  _outside() {
    const conc = makeConcrete([24, 24]);
    const ground = plane(240, 240, std('#7d868a', { map: conc, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // Everything outside stays beyond CLEAR metres so it never sits between the orbit camera and the car.
    const CLEAR = 27;
    const ringPos = (min, max) => {
      const a = rand(Math.PI * 2), r = rand(min, max);
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    // all static outdoor pieces go in one group and get merged by material (~140 meshes -> ~12 draw calls)
    const out = new THREE.Group();
    this.scene.add(out);
    // road
    const road = plane(240, 8, std('#2f3437', { roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.005, -CLEAR - 4);
    out.add(road);
    const dash = std('#f5f5f5');
    for (let x = -110; x < 110; x += 6) {
      const d = plane(2.5, 0.15, dash);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0, -CLEAR - 4);
      out.add(d);
    }
    // buildings
    const bmats = ['#b0bec5', '#ffccbc', '#c5e1a5', '#b3e5fc', '#d1c4e9', '#ffe0b2'].map((c) => std(c, { roughness: 0.9 }));
    const winMat = std('#37474f', { roughness: 0.2, metalness: 0.5 });
    for (let i = 0; i < 20; i++) {
      const w = rand(6, 12), h = rand(5, 16), d = rand(6, 10);
      const b = box(w, h, d, bmats[i % bmats.length]);
      let [x, z] = ringPos(CLEAR + 12, 75);
      if (Math.abs(z + CLEAR + 4) < 9) z -= 14;
      b.position.set(x, h / 2, z);
      b.rotation.y = Math.atan2(x, z);
      out.add(b);
      const wb = box(w * 0.9, 0.6, d + 0.05, winMat);
      wb.position.set(x, h * 0.6, z);
      wb.rotation.y = b.rotation.y;
      out.add(wb);
    }
    // trees
    const trunk = std('#6d4c41');
    const leaf = std('#4caf50', { flatShading: true, roughness: 0.9 });
    for (let i = 0; i < 30; i++) {
      let [x, z] = ringPos(CLEAR, 60);
      if (Math.abs(z + CLEAR + 4) < 5) z -= 8;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), trunk);
      tr.position.set(x, 0.7, z);
      const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.9, 1.4), 0), leaf);
      cr.position.set(x, 2, z);
      out.add(tr, cr);
    }
    mergeByMaterial(out);
  }

  setUpgrades(up) {
    this.upgradeProps.vending.visible = (up.vending || 0) > 0;
    this.upgradeProps.lounge.visible = (up.lounge || 0) > 0;
    this.upgradeProps.posters.forEach((p, i) => { p.visible = (up.ads || 0) > i; });
    this.upgradeProps.dock.visible = (up.bot || 0) > 0;
  }

  setTime(minutes) {
    const K = SKY_KEYS;
    let a = K[0], b = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++) {
      if (minutes >= K[i][0] && minutes <= K[i + 1][0]) { a = K[i]; b = K[i + 1]; break; }
    }
    if (minutes > K[K.length - 1][0]) a = b = K[K.length - 1];
    const t = a === b ? 0 : clamp((minutes - a[0]) / (b[0] - a[0]), 0, 1);
    const top = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t);
    const hor = new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), t);
    this.skyMat.uniforms.uTop.value.copy(top);
    this.skyMat.uniforms.uHorizon.value.copy(hor);
    this.scene.fog.color.copy(hor);
    const sunCol = new THREE.Color(a[3]).lerp(new THREE.Color(b[3]), t);
    this.sun.color.copy(sunCol);
    this.sun.intensity = lerp(a[4], b[4], t) * 0.8;
    const ang = ((minutes - 6 * 60) / (14 * 60)) * Math.PI;
    this.sun.position.set(Math.cos(ang) * -40, Math.max(6, Math.sin(ang) * 40), 12);
    this.hemi.color.copy(new THREE.Color('#e6f6ff').lerp(sunCol, 0.25));
  }

  /** Hide props on walls that sit between the camera and the car. */
  updateOcclusion(cam) {
    const { x: X, z: Z, h: H } = BAY;
    const g = this.groups;
    g.back.visible = cam.z > -Z + 0.2;
    g.front.visible = cam.z < Z - 0.2;
    g.left.visible = cam.x > -X + 0.2;
    g.right.visible = cam.x < X - 0.2;
    g.ceiling.visible = cam.y < H - 0.3;
  }

  /** Water landing on the floor (amount ~0.001 per drop). */
  addWater(amount) {
    this.wet = Math.min(1, this.wet + amount);
  }

  update(dt) {
    this.t += dt;
    this.wet = Math.max(0, this.wet - dt * 0.012); // drains in about a minute
    this.puddleWet.value = this.wet * 0.82;
    if (this.upgradeProps.dock.visible) this.upgradeProps.dock.children[1].material.color.setHSL(0.47, 0.7, 0.5 + Math.sin(this.t * 3) * 0.15);
  }
}

/* Procedural 3D cars built by extruding the 2D side profiles in data.js. */
import * as THREE from 'three';
import { CAR_TYPES } from './data.js';
import { roundPoly, clipPolyY, polyXAt, polyBounds, shade } from './util.js';
import { mergeByMaterial } from './merge.js';

export const U = 1 / 170; // profile units -> metres (an 800-unit sedan is ~4.7 m)

const CABIN_X = { sedan: [190, 592], hatch: [0, 512], suv: [0, 656], pickup: [362, 656], van: [0, 746], coupe: [140, 590] };
const REAR_GLASS_UPRIGHT = { suv: [[22, 66], [10, 112]], van: [[22, 40], [10, 104]], pickup: [[374, 76], [369, 128]] };

const LOWER_BEVEL = 0.05, LOWER_BT = 0.06;
const CAB_BEVEL = 0.06, CAB_BT = 0.07;

let M = null;
function sharedMaterials() {
  if (M) return M;
  M = {
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1219, roughness: 0.12, metalness: 0.3, envMapIntensity: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.55, metalness: 0.2 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6edf0, roughness: 0.15, metalness: 1 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc7d0d6, roughness: 0.28, metalness: 0.9 }),
    hub: new THREE.MeshStandardMaterial({ color: 0x4f5a63, roughness: 0.4, metalness: 0.8 }),
    well: new THREE.MeshBasicMaterial({ color: 0x040506 }),
    head: new THREE.MeshStandardMaterial({ color: 0xfff7dc, emissive: 0xfff0c2, emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.1 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xc62828, emissive: 0xb71c1c, emissiveIntensity: 0.6, roughness: 0.2 }),
    bed: new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.92 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xf2f4f5, roughness: 0.5 }),
  };
  return M;
}

/* ---------- 2D helpers ---------- */
function withArches(def) {
  const pts = def.body.map((p) => [...p]);
  const by = (pts[0][1] + pts[pts.length - 1][1]) / 2;
  const wheels = [...def.wheels].sort((a, b) => b[0] - a[0]);
  for (const [wx, wy, wr] of wheels) {
    const ar = wr + 13;
    const dy = by - wy;
    if (dy >= ar) continue;
    const a0 = Math.atan2(dy, Math.sqrt(ar * ar - dy * dy));
    const sweep = Math.PI + 2 * a0;
    const n = 16;
    for (let k = 0; k <= n; k++) {
      const t = a0 - (k / n) * sweep;
      pts.push([wx + ar * Math.cos(t), wy + ar * Math.sin(t), 0]);
    }
  }
  return pts;
}

function clipPolyX(pts, lineX, keepGreater) {
  const inside = (p) => (keepGreater ? p[0] >= lineX : p[0] <= lineX);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i], prev = pts[(i - 1 + pts.length) % pts.length];
    const ci = inside(cur), pi = inside(prev);
    if (ci !== pi) {
      const t = (lineX - prev[0]) / (cur[0] - prev[0]);
      out.push([lineX, prev[1] + (cur[1] - prev[1]) * t, 0]);
    }
    if (ci) out.push(cur);
  }
  return out;
}

/* ---------- geometry builders ---------- */
function makeShape(pts3, defR) {
  const shape = new THREE.Shape();
  roundPoly(shape, pts3, defR);
  return shape;
}

function extrudeBody(pts3, width, bt, bs) {
  const shape = makeShape(pts3, 12 * U);
  const depth = Math.max(0.01, width - 2 * bt);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 3, curveSegments: 5 });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function addBothSides(group, geo, mat, z) {
  const a = new THREE.Mesh(geo, mat);
  a.position.z = z;
  const b = new THREE.Mesh(geo, mat);
  b.position.z = -z;
  b.scale.z = -1;
  group.add(a, b);
  return [a, b];
}

function boxAt(group, mat, sx, sy, sz, x, y, z, rotZ = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.rotation.z = rotZ;
  group.add(m);
  return m;
}

/** Glass quad lying on a sloped cabin segment, pushed out by `push` along its outward normal. */
function slopeGlass(group, mat, a3, b3, centroid, halfWidth, push) {
  const dx = b3[0] - a3[0], dy = b3[1] - a3[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.05) return;
  let ux = dx / len, uy = dy / len;
  let nx = uy, ny = -ux;
  const mx = (a3[0] + b3[0]) / 2, my = (a3[1] + b3[1]) / 2;
  if ((mx - centroid[0]) * nx + (my - centroid[1]) * ny < 0) { ux = -ux; uy = -uy; nx = -nx; ny = -ny; }
  const geo = new THREE.PlaneGeometry(len * 0.84, halfWidth * 2);
  const mesh = new THREE.Mesh(geo, mat);
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, uy, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, ny, 0));
  mesh.quaternion.setFromRotationMatrix(basis);
  mesh.position.set(mx + nx * push, my + ny * push, 0);
  group.add(mesh);
}

function makeTireGeometry(R, w) {
  const r0 = R * 0.6, c = Math.min(w * 0.3, R * 0.16);
  const pts = [];
  const add = (x, y) => pts.push(new THREE.Vector2(x, y));
  add(r0, -w / 2);
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2); add(R - c + Math.cos(a) * c, -w / 2 + c + Math.sin(a) * c); }
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); add(R - c + Math.cos(a) * c, w / 2 - c + Math.sin(a) * c); }
  add(r0, w / 2);
  const geo = new THREE.LatheGeometry(pts, 30);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/* ---------- main builder ---------- */
export function buildCar(typeKey, color, opts = {}) {
  const def = CAR_TYPES[typeKey];
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.name = 'car';
  const halfLen = def.len / 2;
  const toX = (x) => (x - halfLen) * U;
  const toY = (y) => (300 - y) * U;
  const to3 = (p) => [toX(p[0]), toY(p[1]), p[2] !== undefined ? p[2] * U : 12 * U];
  const W = def.width, hw = W / 2;
  const cw = W * def.cabin, chw = cw / 2;

  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.3, roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.16, envMapIntensity: 1.1 });
  const dark = new THREE.MeshStandardMaterial({ color: shade(color, -0.6), roughness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: opts.accent || '#ffffff', roughness: 0.4 });

  // --- body shells ---
  const outline = withArches(def);
  const lower2D = clipPolyY(outline, def.belt, 'below');
  const [cx0, cx1] = CABIN_X[typeKey];
  let cabin2D = clipPolyY(def.body, def.belt + 6, 'above');
  cabin2D = clipPolyX(cabin2D, cx0, true);
  cabin2D = clipPolyX(cabin2D, cx1, false);

  const lower3 = lower2D.map(to3), cabin3 = cabin2D.map(to3);
  const lowerGeo = extrudeBody(lower3, W, LOWER_BT, LOWER_BEVEL);
  const cabinGeo = extrudeBody(cabin3, cw, CAB_BT, CAB_BEVEL);
  const lowerMesh = new THREE.Mesh(lowerGeo, paint);
  const cabinMesh = new THREE.Mesh(cabinGeo, paint);
  group.add(lowerMesh, cabinMesh);

  const raycastTargets = [lowerMesh, cabinMesh];
  const cabB = polyBounds(cabin3);
  const cabCentroid = [(cabB.x0 + cabB.x1) / 2, (cabB.y0 + cabB.y1) / 2];

  // --- glass ---
  for (const win of def.windows) {
    const geo = new THREE.ShapeGeometry(makeShape(win.map((p) => [toX(p[0]), toY(p[1]), 10 * U]), 10 * U), 4);
    addBothSides(group, geo, mats.glass, chw + 0.002);
  }
  const glassHalf = chw - CAB_BT - 0.05;
  if (def.windshield) slopeGlass(group, mats.glass, to3(def.windshield[0]), to3(def.windshield[1]), cabCentroid, glassHalf, CAB_BEVEL + 0.006);
  const rg = def.rearGlass || REAR_GLASS_UPRIGHT[typeKey];
  if (rg) slopeGlass(group, mats.glass, to3(rg[0]), to3(rg[1]), cabCentroid, glassHalf, CAB_BEVEL + 0.012);

  // --- lights ---
  const lightShape = (poly) => {
    const clipped = clipPolyY(poly.map((p) => [p[0], p[1], 4]), def.belt + 2, 'below');
    return new THREE.ShapeGeometry(makeShape(clipped.map(to3), 4 * U), 3);
  };
  addBothSides(group, lightShape(def.head), mats.head, hw + 0.002);
  addBothSides(group, lightShape(def.tail), mats.tail, hw + 0.002);

  const hb = polyBounds(def.head), tb = polyBounds(def.tail);
  const headY = (hb.y0 + hb.y1) / 2, tailY = (tb.y0 + tb.y1) / 2;
  const frontX = toX(polyXAt(outline, headY, 'max')) + LOWER_BEVEL - 0.02;
  const rearX = toX(polyXAt(outline, tailY, 'min')) - LOWER_BEVEL + 0.02;
  const lz = hw - LOWER_BT - 0.24;
  for (const s of [1, -1]) {
    boxAt(group, mats.head, 0.05, hb.h * U * 0.8, 0.34, frontX, toY(headY), s * lz);
    boxAt(group, mats.tail, 0.05, tb.h * U * 0.8, 0.3, rearX, toY(tailY), s * (lz + 0.02));
  }
  // grille + plates
  boxAt(group, mats.trim, 0.04, hb.h * U * 0.7, W * 0.36, frontX - 0.005, toY(headY) - 0.02, 0);
  const plateYf = Math.min(toY(headY) - 0.16, toY(248) + 0.02);
  boxAt(group, mats.plate, 0.02, 0.1, 0.34, toX(polyXAt(outline, 300 - plateYf / U, 'max')) + LOWER_BEVEL - 0.005, plateYf, 0);
  const plateYr = Math.min(toY(tailY) - 0.14, toY(244) + 0.02);
  boxAt(group, mats.plate, 0.02, 0.1, 0.34, toX(polyXAt(outline, 300 - plateYr / U, 'min')) - LOWER_BEVEL + 0.005, plateYr, 0);

  // --- trim: door seams, handles, mirrors, skirts ---
  for (const line of def.doors) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = to3(line[i]), b = to3(line[i + 1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (const s of [1, -1]) boxAt(group, dark, len, 0.008, 0.004, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, s * (hw + 0.001), ang);
    }
  }
  for (const h of def.handles) for (const s of [1, -1]) boxAt(group, mats.chrome, 0.13, 0.028, 0.02, toX(h[0]), toY(h[1]), s * (hw + 0.006));
  for (const s of [1, -1]) {
    const mx = toX(def.mirror[0]), my = toY(def.mirror[1]);
    const m = boxAt(group, mats.trim, 0.1, 0.075, 0.1, mx, my + 0.03, s * (hw + 0.06));
    raycastTargets.push(m);
    boxAt(group, paint, 0.012, 0.065, 0.09, mx + 0.05, my + 0.03, s * (hw + 0.06));
    boxAt(group, mats.trim, 0.04, 0.03, 0.08, mx - 0.02, my - 0.01, s * (hw + 0.015));
  }
  const wsorted = [...def.wheels].sort((a, b) => a[0] - b[0]);
  const skirtX0 = toX(wsorted[0][0] + wsorted[0][2] + 16), skirtX1 = toX(wsorted[1][0] - wsorted[1][2] - 16);
  const bottomY = toY((def.body[0][1] + def.body[def.body.length - 1][1]) / 2);
  for (const s of [1, -1]) boxAt(group, mats.trim, skirtX1 - skirtX0, 0.05, 0.02, (skirtX0 + skirtX1) / 2, bottomY + 0.03, s * (hw + 0.004));

  // --- wheels ---
  const wheels = [];
  const tireMats = [];
  const tireGeoCache = {};
  for (const [wx, wy, wr] of def.wheels) {
    const R = wr * U, tw = 0.25;
    const key = R.toFixed(3);
    if (!tireGeoCache[key]) tireGeoCache[key] = makeTireGeometry(R, tw);
    const well = new THREE.Mesh(new THREE.CylinderGeometry((wr + 13) * U - LOWER_BEVEL - 0.006, (wr + 13) * U - LOWER_BEVEL - 0.006, W - 0.5, 20), mats.well);
    well.rotation.x = Math.PI / 2;
    well.position.set(toX(wx), toY(wy), 0);
    group.add(well);
    for (const s of [1, -1]) {
      const tmat = new THREE.MeshStandardMaterial({ color: 0x5a4c40, roughness: 0.95, metalness: 0 });
      tireMats.push(tmat);
      const wg = new THREE.Group();
      wg.position.set(toX(wx), toY(wy), s * (hw - tw / 2 - 0.02));
      if (s < 0) wg.scale.z = -1;
      const spin = new THREE.Group();
      wg.add(spin);
      const tire = new THREE.Mesh(tireGeoCache[key], tmat);
      spin.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.6, 0.03, 26), mats.rim);
      rim.rotation.x = Math.PI / 2;
      rim.position.z = tw / 2 - 0.03;
      spin.add(rim);
      const spokes = 5;
      for (let i = 0; i < spokes; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(R * 0.5, R * 0.12, 0.03), mats.chrome);
        const a = (i / spokes) * Math.PI * 2;
        sp.position.set(Math.cos(a) * R * 0.27, Math.sin(a) * R * 0.27, tw / 2 - 0.005);
        sp.rotation.z = a;
        spin.add(sp);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.14, R * 0.14, 0.05, 14), mats.hub);
      hub.rotation.x = Math.PI / 2;
      hub.position.z = tw / 2;
      spin.add(hub);
      group.add(wg);
      wheels.push({ spin, R, x: toX(wx), y: toY(wy), z: s * (hw - 0.02), side: s, mat: tmat });
      raycastTargets.push(tire);
    }
  }

  // --- extras ---
  const roofTop = toY(polyBounds(def.body).y0) + CAB_BEVEL;
  const roofPts = def.body.filter((p) => p[1] < polyBounds(def.body).y0 + 6);
  const roofMid = toX((Math.min(...roofPts.map((p) => p[0])) + Math.max(...roofPts.map((p) => p[0]))) / 2);
  if (opts.taxi) {
    boxAt(group, new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffc107, emissiveIntensity: 0.4 }), 0.5, 0.14, 0.26, roofMid, roofTop + 0.07, 0);
    boxAt(group, mats.trim, 0.52, 0.03, 0.28, roofMid, roofTop + 0.015, 0);
  }
  if (def.extras.includes('roofrack')) {
    const rl = (Math.max(...roofPts.map((p) => p[0])) - Math.min(...roofPts.map((p) => p[0]))) * U * 0.85;
    for (const s of [1, -1]) {
      boxAt(group, mats.trim, rl, 0.035, 0.04, roofMid, roofTop + 0.07, s * (chw - 0.14));
      for (const e of [-1, 1]) boxAt(group, mats.trim, 0.05, 0.07, 0.04, roofMid + (e * rl) / 2.2, roofTop + 0.035, s * (chw - 0.14));
    }
  }
  if (def.extras.includes('spoiler')) {
    const sx = toX(70), sy = toY(166);
    const wing = boxAt(group, paint, 0.36, 0.03, W * 0.8, sx, sy + 0.12, 0);
    raycastTargets.push(wing);
    for (const s of [1, -1]) boxAt(group, mats.trim, 0.06, 0.12, 0.04, sx + 0.04, sy + 0.06, s * W * 0.3);
  }
  if (def.extras.includes('bed')) {
    const x0 = toX(26), x1 = toX(354);
    boxAt(group, mats.bed, x1 - x0, 0.012, W - 2 * LOWER_BT - 0.14, (x0 + x1) / 2, toY(142) + LOWER_BEVEL + 0.004, 0);
  }
  if (def.extras.includes('stripe') && opts.stripe) {
    let band = clipPolyY(outline, 178, 'below');
    band = clipPolyY(band, 200, 'above');
    const geo = new THREE.ShapeGeometry(makeShape(band.map((p) => [toX(p[0]), toY(p[1]), 0]), 0), 2);
    addBothSides(group, geo, accent, hw + 0.0015);
  }

  // tyre sidewall points for the Tire Shine step (car-local)
  const TP = 40;
  const tirePos = new Float32Array(wheels.length * TP * 3);
  const tireNrm = new Float32Array(wheels.length * TP * 3);
  const tireWheel = new Uint8Array(wheels.length * TP);
  wheels.forEach((w, wi) => {
    for (let k = 0; k < TP; k++) {
      const a = (k / TP) * Math.PI * 2 + (k % 2) * 0.08;
      const rr = w.R * (k % 2 ? 0.72 : 0.9);
      const i = wi * TP + k;
      tirePos[i * 3] = w.x + Math.cos(a) * rr;
      tirePos[i * 3 + 1] = w.y + Math.sin(a) * rr;
      tirePos[i * 3 + 2] = w.side * (hw - 0.02);
      tireNrm[i * 3 + 2] = w.side;
      tireWheel[i] = wi;
    }
  });

  const length = def.len * U + 2 * LOWER_BEVEL;
  const height = roofTop;

  // ~80 meshes -> ~27 draw calls. The original shell geometries stay referenced for surface sampling.
  void raycastTargets;
  for (const w of wheels) mergeByMaterial(w.spin);
  mergeByMaterial(group);

  const car = {
    typeKey, def, color, group, paint, wheels, tireMats,
    raycastTargets: [group],
    length, height, width: W,
    washGeos: [{ geo: lowerGeo, vol: 0 }, { geo: cabinGeo, vol: 1 }],
    volumes: [{ poly: lower3, halfW: hw }, { poly: cabin3, halfW: chw }],
    wheelZones: def.wheels.map(([wx, wy, wr]) => ({ x: toX(wx), y: toY(wy), r: (wr + 13) * U + 0.03 })),
    halfWidth: hw,
    tirePoints: { pos: tirePos, nrm: tireNrm, wheel: tireWheel, count: wheels.length * TP, perWheel: TP },
    spinWheels(dist) {
      for (const w of wheels) w.spin.rotation.z -= dist / w.R;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry && !Object.values(tireGeoCache).includes(o.geometry)) o.geometry.dispose();
      });
      Object.values(tireGeoCache).forEach((g) => g.dispose());
      lowerGeo.dispose();
      cabinGeo.dispose();
      paint.dispose(); dark.dispose(); accent.dispose();
      tireMats.forEach((m) => m.dispose());
    },
  };
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return car;
}

/* ---------- 2D side-view icon for the queue / summary ---------- */
export function drawCarIcon(ctx, typeKey, color, w, h) {
  const def = CAR_TYPES[typeKey];
  const s = Math.min(w / (def.len + 20), h / 280);
  ctx.save();
  ctx.translate((w - def.len * s) / 2, h - 8 - 300 * s);
  ctx.scale(s, s);
  ctx.beginPath();
  roundPoly(ctx, def.body, 14);
  const g = ctx.createLinearGradient(0, 40, 0, 270);
  g.addColorStop(0, shade(color, 0.35));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = shade(color, -0.55);
  ctx.stroke();
  ctx.fillStyle = '#1b2a36';
  for (const win of def.windows) {
    ctx.beginPath();
    roundPoly(ctx, win, 8);
    ctx.fill();
  }
  for (const [wx, wy, wr] of def.wheels) {
    ctx.fillStyle = '#15181b';
    ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c7d0d6';
    ctx.beginPath(); ctx.arc(wx, wy, wr * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

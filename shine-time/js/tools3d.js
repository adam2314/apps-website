/* 3D tool models that follow the pointer, plus the helper drone. */
import * as THREE from 'three';
import { clamp, damp } from './util.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...o });

function cyl(r1, r2, h, mat, seg = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
}
function box(x, y, z, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat);
}

/* Spray tools: tip at origin, spraying along local +Z, body extends toward -Z. */
function makeGun({ body = '#ffb300', lance = 0.55, foam = false }) {
  const g = new THREE.Group();
  const metal = std('#cfd8dc', { metalness: 0.9, roughness: 0.25 });
  const bodyMat = std(body);
  const dark = std('#263238');
  const l = cyl(0.012, 0.012, lance, metal, 10);
  l.rotation.x = Math.PI / 2;
  l.position.z = -lance / 2;
  g.add(l);
  const tip = cyl(foam ? 0.035 : 0.016, 0.022, 0.05, foam ? std('#90a4ae', { metalness: 0.6 }) : std('#ffd54f'), 12);
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.02;
  g.add(tip);
  const b = box(0.06, 0.08, 0.2, bodyMat);
  b.position.z = -lance - 0.08;
  g.add(b);
  const grip = box(0.045, 0.15, 0.055, dark);
  grip.position.set(0, -0.1, -lance - 0.13);
  grip.rotation.x = -0.25;
  g.add(grip);
  const trig = box(0.015, 0.05, 0.02, std('#e53935'));
  trig.position.set(0, -0.06, -lance - 0.06);
  g.add(trig);
  const hose = cyl(0.016, 0.016, 0.5, dark, 8);
  hose.position.set(0, -0.38, -lance - 0.2);
  hose.rotation.x = 0.35;
  g.add(hose);
  if (foam) {
    const bottle = cyl(0.065, 0.065, 0.18, new THREE.MeshPhysicalMaterial({ color: '#fce4ec', roughness: 0.2, transmission: 0, transparent: true, opacity: 0.85 }), 18);
    bottle.position.set(0, 0.12, -lance - 0.04);
    g.add(bottle);
    const cap = cyl(0.05, 0.05, 0.03, std('#b0bec5', { metalness: 0.7 }));
    cap.position.set(0, 0.03, -lance - 0.04);
    g.add(cap);
  }
  return g;
}

function makeSprayBottle() {
  const g = new THREE.Group();
  const bottle = cyl(0.05, 0.055, 0.2, std('#212121', { roughness: 0.3 }), 16);
  bottle.position.set(0, -0.14, -0.08);
  g.add(bottle);
  const label = cyl(0.056, 0.056, 0.08, std('#ffd54f'), 16);
  label.position.copy(bottle.position);
  g.add(label);
  const head = box(0.05, 0.06, 0.1, std('#e53935'));
  head.position.set(0, -0.02, -0.06);
  g.add(head);
  const nozzle = cyl(0.01, 0.014, 0.03, std('#fafafa'), 8);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -0.005;
  g.add(nozzle);
  const trig = box(0.02, 0.06, 0.02, std('#e53935'));
  trig.position.set(0, -0.07, -0.03);
  g.add(trig);
  return g;
}

function makeBlower(turbo) {
  const g = new THREE.Group();
  const mat = std(turbo ? '#7c4dff' : '#ff7043');
  const noz = cyl(0.05, 0.03, 0.22, std('#37474f'), 16);
  noz.rotation.x = -Math.PI / 2;
  noz.position.z = -0.11;
  g.add(noz);
  const body = box(0.16, 0.18, 0.26, mat);
  body.position.z = -0.34;
  g.add(body);
  const handle = box(0.04, 0.05, 0.2, std('#263238'));
  handle.position.set(0, 0.12, -0.34);
  g.add(handle);
  const vent = cyl(0.07, 0.07, 0.02, std('#263238'), 16);
  vent.rotation.x = Math.PI / 2;
  vent.position.z = -0.48;
  g.add(vent);
  return g;
}

/* Rub tools: contact face at local y = 0, pointing along -Y into the surface. */
function makeSponge() {
  const g = new THREE.Group();
  const sp = box(0.2, 0.07, 0.13, std('#ffd54f', { roughness: 0.9 }));
  sp.position.y = 0.035;
  g.add(sp);
  const scrub = box(0.2, 0.02, 0.13, std('#43a047', { roughness: 1 }));
  scrub.position.y = 0.08;
  g.add(scrub);
  return g;
}

function makeTowel(color) {
  const g = new THREE.Group();
  const t = box(0.26, 0.03, 0.2, std(color, { roughness: 1 }));
  t.position.y = 0.015;
  g.add(t);
  const fold = box(0.26, 0.03, 0.1, std(color, { roughness: 1 }));
  fold.position.set(0, 0.045, -0.05);
  g.add(fold);
  const stitch = box(0.262, 0.004, 0.01, std('#ffffff'));
  stitch.position.set(0, 0.031, 0.09);
  g.add(stitch);
  return g;
}

function makePolisher() {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  const pad = cyl(0.13, 0.13, 0.04, std('#fafafa', { roughness: 1 }), 24);
  pad.position.y = 0.02;
  spin.add(pad);
  const ring = cyl(0.11, 0.11, 0.02, std('#e53935'), 24);
  ring.position.y = 0.05;
  spin.add(ring);
  g.add(spin);
  const motor = cyl(0.06, 0.07, 0.16, std('#ffca28'), 16);
  motor.position.y = 0.14;
  g.add(motor);
  const handle = box(0.3, 0.035, 0.035, std('#263238'));
  handle.position.y = 0.2;
  g.add(handle);
  g.userData.spin = spin;
  return g;
}

export class ToolRig {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.models = {
      hose: makeGun({ body: '#ffb300' }),
      foam: makeGun({ body: '#ec407a', foam: true }),
      tire: makeSprayBottle(),
      blower: makeBlower(false),
      turbo: makeBlower(true),
      sponge: makeSponge(),
      towel: makeTowel('#29b6f6'),
      plush: makeTowel('#26a69a'),
      wax: makePolisher(),
    };
    for (const m of Object.values(this.models)) {
      m.visible = false;
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.group.add(m);
    }
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.93, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
    );
    this.ring.renderOrder = 9;
    this.ring.visible = false;
    scene.add(this.ring);
    this.current = null;
    this.wobble = 0;
    this.tipWorld = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
  }

  modelKey(toolId, stats) {
    return toolId === 'dryer' ? stats.variant : toolId;
  }

  hide() {
    if (this.current) this.current.visible = false;
    this.current = null;
    this.ring.visible = false;
  }

  /** Place the tool for a hit. Returns the spray tip position (world) for spray tools. */
  place(toolId, stats, hit, normal, camera, active, moving, dt, okTool) {
    const key = this.modelKey(toolId, stats);
    const model = this.models[key];
    if (this.current !== model) {
      if (this.current) this.current.visible = false;
      this.current = model;
    }
    model.visible = true;
    // brush ring
    this.ring.visible = true;
    this.ring.position.copy(hit).addScaledVector(normal, 0.02);
    this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.ring.scale.setScalar(stats.radius);
    this.ring.material.color.set(okTool ? (active ? 0x51e4d1 : 0xffffff) : 0xff6b6b);
    this.ring.material.opacity = active ? 0.6 : 0.4;

    if (stats.kind === 'spray') {
      const camPos = camera.position;
      const right = this._v.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const toCam = camPos.clone().sub(hit).normalize();
      const reach = key === 'tire' ? 0.42 : key === 'blower' || key === 'turbo' ? 0.55 : 0.85;
      const tip = hit.clone().addScaledVector(toCam, reach).addScaledVector(right, reach * 0.3).addScaledVector(up, -reach * 0.18);
      model.position.lerp(tip, model.userData.placed ? clamp(dt * 25, 0, 1) : 1);
      model.userData.placed = true;
      model.lookAt(hit);
      if (active) model.position.addScaledVector(toCam, Math.sin(performance.now() / 30) * 0.003);
      this.tipWorld.copy(model.position);
    } else {
      this.wobble += dt * (moving ? 14 : 3);
      const pressed = active ? 0 : 0.05;
      model.position.copy(hit).addScaledVector(normal, pressed + 0.004);
      this._q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      model.quaternion.copy(this._q);
      model.rotateY(Math.sin(this.wobble) * (moving ? 0.25 : 0.06) + 0.4);
      if (model.userData.spin) model.userData.spin.rotation.y += dt * (active ? 40 : 4);
      this.tipWorld.copy(hit);
    }
    return this.tipWorld;
  }
}

/* ---------- helper drone ---------- */
export class HelperBot {
  constructor(scene) {
    const g = new THREE.Group();
    const white = new THREE.MeshPhysicalMaterial({ color: '#f5f7f8', roughness: 0.25, clearcoat: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), white);
    body.scale.y = 0.75;
    g.add(body);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#0b2530', emissive: '#51e4d1', emissiveIntensity: 0.9 }));
    visor.position.set(0.06, 0.01, 0);
    visor.rotation.y = Math.PI / 2;
    visor.scale.set(1, 0.55, 0.6);
    g.add(visor);
    this.rotors = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = box(0.2, 0.02, 0.03, std('#90a4ae'));
      arm.position.set(Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15);
      arm.rotation.y = -a;
      g.add(arm);
      const rotor = box(0.2, 0.006, 0.025, new THREE.MeshStandardMaterial({ color: '#cfd8dc', transparent: true, opacity: 0.7 }));
      rotor.position.set(Math.cos(a) * 0.25, 0.07, Math.sin(a) * 0.25);
      g.add(rotor);
      this.rotors.push(rotor);
    }
    const nozzle = cyl(0.02, 0.03, 0.12, std('#ffb300'), 10);
    nozzle.position.y = -0.14;
    g.add(nozzle);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.visible = false;
    scene.add(g);
    this.group = g;
    this.pos = new THREE.Vector3(0, 2.5, 2);
    this.target = null;
    this.targetN = new THREE.Vector3();
    this.retarget = 0;
    this.t = 0;
    this.home = new THREE.Vector3(-3.4, 2.4, -3.6);
  }

  update(dt, working, carGroup) {
    this.t += dt;
    for (let i = 0; i < 4; i++) this.rotors[i].rotation.y += dt * 40 * (i % 2 ? 1 : -1);
    let goal;
    if (working && this.target) {
      goal = this.target.clone().addScaledVector(this.targetN, 0.55);
      goal.y += 0.15;
    } else {
      goal = this.home.clone();
    }
    goal.y += Math.sin(this.t * 3) * 0.04;
    this.pos.x = damp(this.pos.x, goal.x, 4, dt);
    this.pos.y = damp(this.pos.y, goal.y, 4, dt);
    this.pos.z = damp(this.pos.z, goal.z, 4, dt);
    this.group.position.copy(this.pos);
    if (working && this.target) {
      this.group.lookAt(this.target.x, this.pos.y, this.target.z);
      this.group.rotateY(-Math.PI / 2);
    }
    this.group.rotation.z = Math.sin(this.t * 2) * 0.08;
  }
}

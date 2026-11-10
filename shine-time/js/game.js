/* Game state & rules: days, customers, the wash flow, economy, upgrades, saving. */
import * as THREE from 'three';
import { CONFIG, SERVICES, STEPS, UPGRADES, RANKS, CAR_TYPES, CAR_COLORS, toolStats, toolUnlocked, serviceUnlocked, TOOL_ORDER } from './data.js';
import { t, toolLabel, stepName, customerNames, customerSays } from './i18n.js';
import { clamp, rand, pick, chance, weightedPick, easeInOutCubic, easeInCubic, easeOutCubic, damp, fmtMoney } from './util.js';
import { buildCar, drawCarIcon } from './carModel.js';
import { WashSurface } from './washSurface.js';
import { Sound } from './audio.js';

const QUEUE_X0 = -11.6, QUEUE_GAP = 6.1, SPAWN_X = -46;
const _drip = new THREE.Vector3();

function defaultSave() {
  return {
    v: 1, money: 60, day: 1, lifetime: 0, up: {}, ratings: [3, 3, 4],
    stats: { cars: 0, bestDay: 0, fiveStars: 0 },
    settings: { sound: true, vibrate: true, quality: 'auto', lang: 'he' },
    tutorialDone: false,
  };
}

export function loadSettingsOnly() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (raw) return { ...defaultSave().settings, ...(JSON.parse(raw).settings || {}) };
  } catch (e) { /* ignore */ }
  return defaultSave().settings;
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, world, fx, tools, bot, camRig, camera
    this.raycaster = new THREE.Raycaster();
    this.state = 'title';
    this.paused = false;
    this.queue = [];
    this.leaving = [];
    this.bay = null;
    this.tool = 'hose';
    this.hints = {};
    this.time = 0;
    this.nextId = 1;
    this.lastBrush = null;
    this.warnCooldown = 0;
    this.sideHint = null;
    this.load();
    this.world.setUpgrades(this.save.up);
    Sound.setEnabled(this.save.settings.sound);
    this._demoCar();
  }

  /* ---------- persistence ---------- */
  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(CONFIG.saveKey)); } catch (e) { data = null; }
    const def = defaultSave();
    this.hasSave = !!(data && data.v === 1);
    this.save = this.hasSave ? { ...def, ...data, up: { ...data.up }, stats: { ...def.stats, ...data.stats }, settings: { ...def.settings, ...data.settings } } : def;
  }

  persist() {
    try { localStorage.setItem(CONFIG.saveKey, JSON.stringify(this.save)); this.hasSave = true; } catch (e) { /* storage full or blocked */ }
  }

  resetSave() {
    const settings = this.save.settings;
    this.save = defaultSave();
    this.save.settings = settings;
    this.persist();
    this.world.setUpgrades(this.save.up);
  }

  get up() { return this.save.up; }
  get money() { return this.save.money; }
  get rep() {
    const r = this.save.ratings;
    return r.reduce((a, b) => a + b, 0) / r.length;
  }
  get rank() {
    let r = RANKS[0];
    for (const k of RANKS) if (this.save.lifetime >= k.at) r = k;
    return r;
  }
  get nextRank() { return RANKS.find((k) => k.at > this.save.lifetime) || null; }
  get dayGoal() { return 90 + this.save.day * 45; }

  vibrate(p) {
    try { if (this.save.settings.vibrate && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* unsupported */ }
  }

  /* ---------- title-screen demo ---------- */
  _demoCar() {
    const type = pick(Object.keys(CAR_TYPES));
    const car = buildCar(type, pick(CAR_COLORS), { stripe: true, accent: '#51e4d1' });
    car.surface = new WashSurface(car, { dirt: 1, grime: true, grimeCount: 6 });
    this.scene.add(car.group);
    this.demo = car;
    this.demoBlob = this.world.makeBlob(car.length, car.width);
    this.scene.add(this.demoBlob);
    this.camRig.setCar(car);
    this.camRig.autoSpin = 0.12;
  }

  _clearDemo() {
    if (!this.demo) return;
    this.demo.surface.dispose();
    this.scene.remove(this.demo.group);
    this.demo.dispose();
    this.scene.remove(this.demoBlob);
    this.demo = null;
  }

  /* ---------- day flow ---------- */
  newGame() {
    this.resetSave();
    this.startDay();
  }

  startDay() {
    this._clearDemo();
    this._clearCars();
    this.state = 'playing';
    this.paused = false;
    this.clock = CONFIG.dayStart;
    this.spawnTimer = 1.5;
    this.dayStats = { washed: 0, lost: 0, missed: 0, revenue: 0, tips: 0, snacks: 0, supplies: 0, stars: [], streakBest: 0 };
    this.streak = 0;
    this.world.setTime(this.clock);
    this.world.setUpgrades(this.up);
    this.camRig.autoSpin = 0;
    this.camRig.reset();
    this.tool = 'hose';
    this.ui.onDayStart();
    if (!this.save.tutorialDone) this.ui.showTutorial();
  }

  _clearCars() {
    for (const c of [...this.queue, ...this.leaving]) this._disposeCustomerCar(c);
    if (this.bay) this._disposeCustomerCar(this.bay.cust);
    this.queue = [];
    this.leaving = [];
    this.bay = null;
  }

  _disposeCustomerCar(c) {
    if (!c || !c.car) return;
    if (c.car.surface) c.car.surface.dispose();
    this.scene.remove(c.car.group);
    if (c.blob) this.scene.remove(c.blob);
    c.car.dispose();
    c.car = null;
  }

  endDay() {
    this.state = 'summary';
    const s = this.dayStats;
    const goalMet = s.revenue >= this.dayGoal;
    s.goal = this.dayGoal;
    s.goalMet = goalMet;
    s.bonus = goalMet ? 20 + this.save.day * 10 : 0;
    s.supplies = Math.round(s.washed * (2 + this.save.day * 0.15));
    this.save.money += s.bonus - s.supplies;
    this.save.lifetime += s.bonus;
    s.net = s.revenue + s.tips + s.snacks + s.bonus - s.supplies;
    s.avgStars = s.stars.length ? s.stars.reduce((a, b) => a + b, 0) / s.stars.length : 0;
    this.save.stats.bestDay = Math.max(this.save.stats.bestDay, s.net);
    s.day = this.save.day;
    this.save.day += 1;
    this.persist();
    this.tools.hide();
    Sound.setLoops({});
    this.ui.showSummary(s);
  }

  /* ---------- customers ---------- */
  _arrivalInterval() {
    const repF = 0.6 + this.rep * 0.14;
    const adsF = 1 + 0.2 * (this.up.ads || 0);
    const dayF = 1 + Math.min(this.save.day - 1, 12) * 0.08;
    return (CONFIG.baseArrival / (repF * adsF * dayF)) * rand(0.75, 1.25);
  }

  makeCustomer() {
    const up = this.up;
    const unlocked = SERVICES.filter((s) => serviceUnlocked(s, up));
    const base = { quick: 3, full: 5, shine: 3.2, showroom: 2.2 };
    const svc = weightedPick(unlocked, (s) => base[s.id] * (s.id === 'shine' || s.id === 'showroom' ? 0.5 + this.rep * 0.18 : 1));
    const typeKey = weightedPick(Object.keys(CAR_TYPES), (k) => CAR_TYPES[k].weight);
    const vip = this.save.day >= 3 && chance(0.08);
    const muddy = !vip && svc.grime && chance(0.14);
    const taxi = !vip && typeKey === 'sedan' && chance(0.15);
    const color = vip ? '#c9a227' : taxi ? '#fbc02d' : pick(CAR_COLORS);
    const price = Math.round(svc.price * (1 + 0.12 * (up.products || 0)) * (vip ? 1.8 : 1) + (muddy ? 8 : 0));
    const patience = CONFIG.basePatience * (1 + 0.25 * (up.lounge || 0)) * (vip ? 0.7 : 1) * rand(0.9, 1.15);
    const thumb = document.createElement('canvas');
    thumb.width = 120; thumb.height = 52;
    drawCarIcon(thumb.getContext('2d'), typeKey, color, 120, 52);
    return {
      id: this.nextId++, name: pick(customerNames()), svc, typeKey, color, taxi, vip, muddy, price, patience,
      mood: 1, waited: 0, thumb: thumb.toDataURL(), x: SPAWN_X, z: 0, heading: 0, car: null, speed: 0,
    };
  }

  spawnCustomer() {
    if (this.queue.length >= CONFIG.queueMax) {
      this.dayStats.missed++;
      this.ui.toast(t('toast.lineFull'), 'warn');
      return;
    }
    const c = this.makeCustomer();
    const car = buildCar(c.typeKey, c.color, { taxi: c.taxi, stripe: chance(0.6), accent: pick(['#ffffff', '#51e4d1', '#ffca28', '#ef5350']) });
    car.surface = new WashSurface(car, { dirt: c.muddy ? 1.45 : 1, grime: c.svc.grime, grimeCount: c.muddy ? randIntSafe(10, 14) : randIntSafe(5, 8) });
    car.group.position.set(c.x, 0, 0);
    c.car = car;
    c.blob = this.world.makeBlob(car.length, car.width);
    this.scene.add(car.group, c.blob);
    this.queue.push(c);
    Sound.arrive();
    this.ui.onQueueChanged();
  }

  _customerLeaves(c) {
    this.queue = this.queue.filter((q) => q !== c);
    this.dayStats.lost++;
    this.save.ratings.push(1);
    if (this.save.ratings.length > 20) this.save.ratings.shift();
    this.streak = 0;
    c.leaveT = 0;
    c.leaveFrom = c.car.group.position.clone();
    this.leaving.push(c);
    Sound.sad();
    this.ui.toast(t('toast.left', { name: c.name }), 'bad');
    this.ui.onQueueChanged();
  }

  /* ---------- bay ---------- */
  _pullNextIntoBay() {
    const c = this.queue.shift();
    if (!c) return;
    this.bay = { cust: c, state: 'enter', t: 0, fromX: c.car.group.position.x, stepIdx: 0, time: 0, stepTime: 0 };
    Sound.engine(2.2);
    this.ui.onQueueChanged();
    this.ui.onBayChanged();
  }

  currentStep() {
    if (!this.bay || this.bay.state !== 'wash') return null;
    return STEPS[this.bay.cust.svc.steps[this.bay.stepIdx]];
  }

  canWash() {
    return !!this.currentStep() && !this.paused && (this.state === 'playing' || this.state === 'closing');
  }

  selectTool(id) {
    if (!toolUnlocked(id, this.up)) return;
    if (this.tool !== id) Sound.click();
    this.tool = id;
    this.lastBrush = null;
    this.ui.onToolChanged();
  }

  hitTest(ndc) {
    if (!this.bay || !this.bay.cust.car) return null;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.bay.cust.car.raycastTargets, true);
    if (!hits.length) return null;
    const h = hits[0];
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    if (n.dot(this.raycaster.ray.direction) > 0) n.negate();
    return { point: h.point.clone(), normal: n, dir: this.raycaster.ray.direction.clone() };
  }

  _startWash() {
    const b = this.bay;
    b.state = 'wash';
    b.stepIdx = 0;
    b.time = 0;
    b.stepTime = 0;
    b.cust.mood = Math.min(1, b.cust.mood + 0.1);
    b.par = b.cust.svc.steps.reduce((s, id) => s + STEPS[id].par, 0);
    const step = this.currentStep();
    b.cust.car.surface.beginStep(step);
    if (this.up.belt) this.tool = step.tool;
    this.ui.onBayChanged();
  }

  _completeStep() {
    const b = this.bay;
    const step = this.currentStep();
    const surf = b.cust.car.surface;
    surf.settle(step.layer, step.mode === 'remove' ? 0 : 1);
    if (step.id === 'prerinse' || step.id === 'rinse') surf.settle('water', 1, 3);
    Sound.step();
    this.vibrate(25);
    this.ui.stepDone(step);
    b.stepIdx++;
    b.stepTime = 0;
    this.lastBrush = null;
    surf.hintLevel = 0;
    if (b.stepIdx >= b.cust.svc.steps.length) {
      this._finishCar();
    } else {
      const next = this.currentStep();
      surf.beginStep(next);
      if (this.up.belt) this.tool = next.tool;
      this.ui.onBayChanged();
    }
  }

  _starsFor(mood) {
    return mood >= 0.8 ? 5 : mood >= 0.6 ? 4 : mood >= 0.4 ? 3 : mood >= 0.2 ? 2 : 1;
  }

  _finishCar() {
    const b = this.bay;
    const c = b.cust;
    b.state = 'done';
    b.t = 0;
    this.tools.hide();
    const stars = this._starsFor(c.mood);
    if (stars === 5) this.streak++;
    else this.streak = 0;
    const tipRate = [0, 0, 0, 0.05, 0.15, 0.3][stars];
    const streakMult = 1 + 0.1 * Math.min(this.streak, 10);
    const tip = Math.round(c.price * tipRate * streakMult);
    const snack = 3 * (this.up.vending || 0);
    const total = c.price + tip + snack;
    this.save.money += total;
    this.save.lifetime += total;
    this.save.stats.cars++;
    if (stars === 5) this.save.stats.fiveStars++;
    this.save.ratings.push(stars);
    if (this.save.ratings.length > 20) this.save.ratings.shift();
    const d = this.dayStats;
    d.washed++;
    d.revenue += c.price;
    d.tips += tip;
    d.snacks += snack;
    d.stars.push(stars);
    d.streakBest = Math.max(d.streakBest, this.streak);
    const say = pick(customerSays(stars >= 5 ? 'good' : stars >= 3 ? 'ok' : 'bad'));
    const p = c.car.group.position;
    this.fx.burst(new THREE.Vector3(p.x, 0.2, p.z), new THREE.Vector3(c.car.length, c.car.height, c.car.width), 160);
    Sound.done();
    setTimeout(() => Sound.cash(), 350);
    this.vibrate([30, 40, 30]);
    this.ui.showPayout({ name: c.name, stars, price: c.price, tip, snack, streak: this.streak, say, vip: c.vip });
    this.ui.onBayChanged();
  }

  /* ---------- per-frame ---------- */
  update(dt) {
    this.time += dt;
    this.warnCooldown -= dt;
    if (this.state === 'title' || this.state === 'summary') {
      this.tools.hide();
      this.bot.update(dt, false);
      this.bot.group.visible = false;
      if (this.demo) this.demo.surface.update(dt);
      return;
    }
    if (this.paused) {
      Sound.setLoops({});
      return;
    }

    // clock & spawning
    this.clock += dt * ((CONFIG.dayEnd - CONFIG.dayStart) / CONFIG.daySeconds);
    if (this.state === 'playing' && this.clock >= CONFIG.dayEnd) {
      this.state = 'closing';
      this.ui.toast(t('toast.closing'), 'info');
    }
    this.world.setTime(Math.min(this.clock, 20 * 60));
    if (this.state === 'playing') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnCustomer();
        this.spawnTimer = this._arrivalInterval();
      }
    }

    // queue: patience and positions
    for (let i = 0; i < this.queue.length; i++) {
      const c = this.queue[i];
      c.waited += dt;
      c.mood -= dt / c.patience;
      const targetX = QUEUE_X0 - i * QUEUE_GAP;
      this._driveToward(c, targetX, dt);
      if (c.mood <= 0) { this._customerLeaves(c); i--; }
    }
    for (const c of this.leaving) this._animateLeaving(c, dt);
    this.leaving = this.leaving.filter((c) => {
      if (c.leaveT > 4.5) { this._disposeCustomerCar(c); return false; }
      return true;
    });

    if (!this.bay && this.queue.length && (this.state === 'playing' || this.state === 'closing')) this._pullNextIntoBay();
    if (this.bay) this._updateBay(dt);
    else {
      this.tools.hide();
      Sound.setLoops({});
      this.bot.update(dt, false);
      this.bot.group.visible = (this.up.bot || 0) > 0;
    }

    if (this.state === 'closing' && !this.bay && !this.queue.length && !this.leaving.length) this.endDay();
  }

  _driveToward(c, targetX, dt) {
    const g = c.car.group;
    const dx = targetX - g.position.x;
    const want = clamp(dx * 1.2, -2, 9);
    c.speed = damp(c.speed, Math.abs(dx) < 0.02 ? 0 : want, 3, dt);
    const step = c.speed * dt;
    g.position.x += step;
    c.car.spinWheels(step);
    c.blob.position.set(g.position.x, 0.006, g.position.z);
  }

  _animateLeaving(c, dt) {
    c.leaveT += dt;
    const g = c.car.group;
    const t = c.leaveT;
    const turn = clamp(t / 1.2, 0, 1);
    g.rotation.y = easeInOutCubic(turn) * (Math.PI / 2);
    const sp = 1.5 + t * 3;
    g.position.x += Math.cos(g.rotation.y) * sp * dt;
    g.position.z -= Math.sin(g.rotation.y) * sp * dt;
    c.car.spinWheels(sp * dt);
    c.blob.position.set(g.position.x, 0.006, g.position.z);
    c.blob.rotation.z = g.rotation.y;
  }

  _updateBay(dt) {
    const b = this.bay;
    const c = b.cust;
    const car = c.car;
    const g = car.group;
    car.surface.update(dt);
    for (const d of car.surface.sampleDrips(dt)) {
      const w = g.localToWorld(_drip.set(d[0], d[1], d[2]));
      this.fx.drip(w.x, w.y, w.z);
    }
    b.t += dt;

    if (b.state === 'enter') {
      const dur = 2.6;
      const k = clamp(b.t / dur, 0, 1);
      const x = b.fromX + (0 - b.fromX) * easeInOutCubic(k);
      car.spinWheels(x - g.position.x);
      g.position.x = x;
      c.blob.position.set(x, 0.006, 0);
      this.tools.hide();
      if (k >= 1) this._startWash();
    } else if (b.state === 'wash') {
      b.time += dt;
      b.stepTime += dt;
      const overPar = b.time > b.par;
      c.mood = Math.max(0.02, c.mood - dt / (c.patience * (overPar ? 0.9 : 6)));
      this._washFrame(dt);
    } else if (b.state === 'done') {
      this.tools.hide();
      Sound.setLoops({});
      this.fx.sparkles(new THREE.Vector3(g.position.x + rand(-2, 2), rand(0.4, 1.4), rand(-1, 1)), dt, 30, 0.6, true);
      if (b.t > 1.8) { b.state = 'exit'; b.t = 0; Sound.engine(2); }
    } else if (b.state === 'exit') {
      const x = easeInCubic(clamp(b.t / 2.6, 0, 1)) * 34;
      car.spinWheels(x - g.position.x);
      g.position.x = x;
      c.blob.position.set(x, 0.006, 0);
      if (b.t > 2.6) {
        this._disposeCustomerCar(c);
        this.bay = null;
        this.ui.onBayChanged();
      }
    }
    // bot
    const working = b.state === 'wash' && (this.up.bot || 0) > 0;
    this.bot.group.visible = (this.up.bot || 0) > 0;
    if (working) this._botWork(dt);
    this.bot.update(dt, working && !!this.bot.target);
  }

  _washFrame(dt) {
    const b = this.bay;
    const surf = b.cust.car.surface;
    const step = this.currentStep();
    const input = this.input;
    const stats = toolStats(this.tool, this.up);
    const okTool = this.tool === step.tool;
    const loops = {};
    let hit = null;
    const pointerActive = input.mode === 'wash';
    if (pointerActive || input.hover) hit = this.hitTest(input.ndc);

    if (hit) {
      const tip = this.tools.place(this.tool, stats, hit.point, hit.normal, this.camera, pointerActive, input.moving, dt, okTool);
      if (pointerActive) {
        if (okTool) {
          const moved = this._brush(step, stats, hit, dt);
          this._toolFx(step, stats, hit, tip, dt, moved, loops);
        } else if (this.warnCooldown <= 0) {
          this.warnCooldown = 1.6;
          this.ui.toast(t('toast.wrongTool', { tool: toolLabel(step.tool, this.up), step: stepName(step), n: TOOL_ORDER.indexOf(step.tool) + 1 }), 'warn');
          this.ui.pulseTool(step.tool);
          Sound.error();
        }
      } else {
        this.lastBrush = null;
      }
    } else {
      this.tools.hide();
      this.lastBrush = null;
    }
    Sound.setLoops(loops);

    // hints: glow remaining spots once most of the step is done (or after a while)
    const prog = surf.progress();
    b.progress = prog;
    const wantHint = prog > 0.72 || b.stepTime > 18;
    surf.hintLevel = damp(surf.hintLevel, wantHint ? 1 : 0, 3, dt);
    this.hints = { dust: 0, grime: 0, water: 0, foam: 0 };
    if (wantHint && step.mode === 'remove') this.hints[step.layer] = surf.hintLevel * 0.8;
    this.sideHint = null;
    if (wantHint) {
      const camLocal = b.cust.car.group.worldToLocal(this.camera.position.clone());
      const fs = surf.facingStats(step.layer, step.mode, camLocal);
      if (fs.away > fs.toward * 1.5 && fs.away > 3) this.sideHint = 'other side';
    }
    if (prog >= CONFIG.stepDone) this._completeStep();
  }

  _brush(step, stats, hit, dt) {
    const surf = this.bay.cust.car.surface;
    const g = this.bay.cust.car.group;
    const local = g.worldToLocal(hit.point.clone());
    const dir = stats.kind === 'spray' ? hit.dir : hit.normal.clone().negate();
    const prev = this.lastBrush;
    let segLen = 0, segs = 1;
    if (prev && prev.distanceTo(local) < 1.1) {
      segLen = prev.distanceTo(local);
      segs = Math.max(1, Math.ceil(segLen / (stats.radius * 0.35)));
    }
    const p = new THREE.Vector3();
    for (let s = 1; s <= segs; s++) {
      if (prev && segLen > 0) p.lerpVectors(prev, local, s / segs);
      else p.copy(local);
      const amount = stats.kind === 'spray' ? (stats.power * dt) / segs : stats.power * (segLen / segs) + (stats.idle * dt) / segs;
      surf.brush(step.layer, p.x, p.y, p.z, dir.x, dir.y, dir.z, stats.radius, amount, step.mode, stats.kind === 'rub' ? 0.25 : -0.2);
      if (step.tool === 'hose') {
        surf.brush('water', p.x, p.y, p.z, dir.x, dir.y, dir.z, stats.radius, amount * 1.5, 'apply', -0.2);
        this._wetPanel(surf, p, dir, stats.radius, amount);
      }
    }
    this.lastBrush = local;
    return segLen;
  }

  /** Running water: a sheet where the spray lands, plus a trail running down below it. */
  _wetPanel(surf, p, dir, radius, amount) {
    surf.brush('flow', p.x, p.y, p.z, dir.x, dir.y, dir.z, radius * 1.1, amount * 3, 'apply', -0.3);
    surf.brush('flow', p.x, p.y - radius * 1.3, p.z, dir.x, dir.y, dir.z, radius * 1.15, amount * 2, 'apply', -0.3);
  }

  _toolFx(step, stats, hit, tip, dt, moved, loops) {
    const fx = this.fx;
    const speed = moved / Math.max(dt, 0.001);
    switch (this.tool) {
      case 'hose': fx.stream('hose', tip, hit.point, hit.normal, dt); loops.spray = 1; break;
      case 'foam': fx.stream('foam', tip, hit.point, hit.normal, dt); loops.foam = 1; break;
      case 'tire': fx.stream('tire', tip, hit.point, hit.normal, dt); loops.mist = 1; break;
      case 'sponge': fx.bubbles(hit.point, hit.normal, dt, 15 + clamp(speed * 20, 0, 70)); loops.scrub = clamp(0.2 + speed * 0.5, 0, 1); break;
      case 'dryer':
        if (stats.blower) { fx.stream('air', tip, hit.point, hit.normal, dt); fx.drips(hit.point, hit.normal, dt); loops.blow = 1; }
        else { if (speed > 0.5) fx.drips(hit.point, hit.normal, dt * 0.5); loops.towel = clamp(0.15 + speed * 0.5, 0, 1); }
        break;
      case 'wax': fx.sparkles(hit.point, dt, 25 + speed * 15, 0.18); loops.motor = 1; break;
    }
  }

  _botWork(dt) {
    const bot = this.bot;
    const step = this.currentStep();
    const surf = this.bay.cust.car.surface;
    const g = this.bay.cust.car.group;
    const lvl = this.up.bot || 0;
    const eff = [0, 0.32, 0.5, 0.75][lvl];
    bot.retarget -= dt;
    const stillDirty = bot.targetIdx !== undefined && bot.targetLayer === step.layer && surf.isRemaining(step.layer, step.mode, bot.targetIdx);
    if (!bot.target || bot.retarget <= 0 || !stillDirty) {
      const cands = surf.randomRemaining(step.layer, step.mode, 12);
      bot.target = null;
      if (cands.length) {
        const local = g.worldToLocal(bot.pos.clone());
        const pp = new THREE.Vector3(), nn = new THREE.Vector3();
        let best = null, bestD = Infinity;
        for (const i of cands) {
          surf.pointOf(step.layer, i, pp);
          const d = pp.distanceToSquared(local);
          if (d < bestD) { bestD = d; best = i; }
        }
        surf.pointOf(step.layer, best, pp, nn);
        bot.target = g.localToWorld(pp.clone());
        bot.targetN = nn.clone();
        bot.targetIdx = best;
        bot.targetLayer = step.layer;
        bot.retarget = 1.4;
      }
    }
    if (!bot.target) return;
    const goal = bot.target.clone().addScaledVector(bot.targetN, 0.55);
    if (bot.pos.distanceTo(goal) > 0.6) return;
    const stats = toolStats(step.tool, this.up);
    const local = g.worldToLocal(bot.target.clone());
    const wob = this.time * 6;
    local.x += Math.cos(wob) * 0.08;
    local.y += Math.sin(wob) * 0.05;
    const amount = stats.kind === 'spray' ? stats.power * eff * dt : stats.power * eff * 1.2 * dt;
    const dir = bot.targetN.clone().negate();
    surf.brush(step.layer, local.x, local.y, local.z, dir.x, dir.y, dir.z, stats.radius * 0.8, amount, step.mode, 0);
    if (step.tool === 'hose') {
      surf.brush('water', local.x, local.y, local.z, dir.x, dir.y, dir.z, stats.radius * 0.8, amount * 1.5, 'apply', 0);
      this._wetPanel(surf, local, dir, stats.radius * 0.8, amount);
    }
    const from = bot.group.position.clone().add(new THREE.Vector3(0, -0.18, 0));
    if (stats.kind === 'spray') {
      const kind = step.tool === 'foam' ? 'foam' : step.tool === 'tire' ? 'tire' : step.tool === 'dryer' ? 'air' : 'hose';
      this.fx.stream(kind, from, bot.target, bot.targetN, dt * 0.5);
    } else if (step.tool === 'sponge') this.fx.bubbles(bot.target, bot.targetN, dt, 20);
    else if (step.tool === 'wax') this.fx.sparkles(bot.target, dt, 15, 0.15);
  }

  /* ---------- shop ---------- */
  upgradeState(u) {
    const lvl = this.up[u.id] || 0;
    const max = u.costs.length;
    const cost = lvl < max ? u.costs[lvl] : null;
    const locked = u.requires && !(this.up[u.requires] > 0);
    return { lvl, max, cost, locked, affordable: cost !== null && this.money >= cost };
  }

  buy(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const st = this.upgradeState(u);
    if (st.cost === null || st.locked) return false;
    if (this.money < st.cost) { Sound.error(); return false; }
    this.save.money -= st.cost;
    this.up[id] = st.lvl + 1;
    this.world.setUpgrades(this.up);
    this.persist();
    Sound.buy();
    this.vibrate(20);
    return true;
  }
}

function randIntSafe(a, b) {
  return Math.floor(rand(a, b + 1));
}

export { fmtMoney };

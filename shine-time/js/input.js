/* Orbit camera + pointer/touch/keyboard input. */
import * as THREE from 'three';
import { clamp, damp } from './util.js';
import { TOOL_ORDER } from './data.js';
import { Sound } from './audio.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0.72, 0);
    this.theta = 0.42;
    this.phi = 0.3;
    this.zoom = 1;
    this.fit = 7;
    this.cur = { theta: this.theta, phi: this.phi, dist: 7 };
    this.autoSpin = 0;
    this.carLen = 4.8;
    this.carH = 1.5;
    this.viewport = { w: 1, h: 1, top: 0, bottom: 0 };
  }

  setCar(car) {
    this.carLen = car.length;
    this.carH = car.height;
    this._refit();
  }

  reset() {
    this.theta = 0.42;
    this.phi = 0.3;
    this.zoom = 1;
  }

  setViewport(w, h, top, bottom) {
    this.viewport = { w, h, top, bottom };
    const cam = this.camera;
    cam.aspect = w / h;
    const shift = (top - bottom) / 2;
    if (Math.abs(shift) > 1) cam.setViewOffset(w, h, 0, -shift, w, h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this._refit();
  }

  _refit() {
    const { w, h, top, bottom } = this.viewport;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const availH = Math.max(0.35, (h - top - bottom) / h);
    const tanV = Math.tan(vfov / 2) * availH;
    const tanH = Math.tan(vfov / 2) * (w / h);
    const dW = (Math.max(4.8, this.carLen) * 0.5 + 0.6) / tanH;
    const dH = (this.carH * 0.5 + 0.9) / tanV;
    this.fit = clamp(Math.max(dW, dH), 4.6, 15);
  }

  rotate(dTheta, dPhi) {
    this.theta += dTheta;
    this.phi = clamp(this.phi + dPhi, 0.04, 1.3);
  }

  zoomBy(f) {
    this.zoom = clamp(this.zoom * f, 0.5, Math.max(1, 17 / this.fit));
  }

  snap(deltaTheta) {
    const step = Math.PI / 4;
    this.theta = Math.round((this.theta + deltaTheta) / step) * step;
  }

  update(dt) {
    if (this.autoSpin) this.theta += this.autoSpin * dt;
    const c = this.cur;
    c.theta = damp(c.theta, this.theta, 8, dt);
    c.phi = damp(c.phi, this.phi, 8, dt);
    c.dist = damp(c.dist, clamp(this.fit * this.zoom, 3.6, 17), 6, dt);
    const cp = Math.cos(c.phi);
    this.camera.position.set(
      this.target.x + Math.sin(c.theta) * cp * c.dist,
      Math.max(0.35, this.target.y + Math.sin(c.phi) * c.dist),
      this.target.z + Math.cos(c.theta) * cp * c.dist,
    );
    this.camera.lookAt(this.target);
  }
}

export class Input {
  constructor(canvas, game, rig) {
    this.canvas = canvas;
    this.game = game;
    this.rig = rig;
    this.pointers = new Map();
    this.mode = null;
    this.ndc = new THREE.Vector2();
    this.hover = false;
    this.moving = false;
    this.lastMoveT = 0;
    this.pinch = null;

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this._up(e));
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.rig.zoomBy(Math.exp(clamp(e.deltaY, -200, 200) * 0.0012));
    }, { passive: false });
    window.addEventListener('keydown', (e) => this._key(e));
    // stop iOS double-tap zoom / gestures on the canvas
    canvas.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  _setNdc(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  _down(e) {
    Sound.unlock();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (this.pointers.size >= 2) {
      this.mode = 'pinch';
      this.pinch = this._pinchState();
      return;
    }
    this._setNdc(e);
    this.hover = e.pointerType === 'mouse';
    if (e.button === 1 || e.button === 2) {
      this.mode = 'orbit';
      return;
    }
    const hit = this.game.canWash() ? this.game.hitTest(this.ndc) : null;
    this.mode = hit ? 'wash' : 'orbit';
    this.game.lastBrush = null;
  }

  _pinchState() {
    const pts = [...this.pointers.values()];
    const a = pts[0], b = pts[1];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (e.pointerType === 'mouse') this.hover = true;
    if (!p) {
      if (e.pointerType === 'mouse') this._setNdc(e);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.mode === 'pinch' && this.pointers.size >= 2) {
      const s = this._pinchState();
      if (this.pinch && s.d > 10) {
        this.rig.zoomBy(this.pinch.d / s.d);
        this.rig.rotate(-(s.mx - this.pinch.mx) * 0.008, (s.my - this.pinch.my) * 0.006);
      }
      this.pinch = s;
      return;
    }
    if (this.mode === 'orbit') {
      const k = e.pointerType === 'mouse' ? 0.006 : 0.007;
      this.rig.rotate(-dx * k, dy * k * 0.8);
      return;
    }
    if (this.mode === 'wash') {
      this._setNdc(e);
      if (Math.abs(dx) + Math.abs(dy) > 0) {
        this.moving = true;
        this.lastMoveT = performance.now();
      }
    }
  }

  _up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.mode = null;
      this.pinch = null;
      this.game.lastBrush = null;
      if (e.pointerType !== 'mouse') this.hover = false;
    } else if (this.mode === 'pinch') {
      this.mode = 'orbit';
    }
  }

  update() {
    if (this.moving && performance.now() - this.lastMoveT > 90) this.moving = false;
  }

  _key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const g = this.game;
    const ui = g.ui;
    // Letters and digits by physical key, so shortcuts also work with a Hebrew keyboard layout.
    const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase()
      : /^(Digit|Numpad)\d$/.test(e.code) ? e.code.slice(-1)
      : e.key;
    if (key === 'Escape' || key === 'p') {
      ui.handleEscape();
      e.preventDefault();
      return;
    }
    if (key === 'm') { ui.toggleSound(); return; }
    if (ui.modalOpen()) {
      if (key === 'Enter') ui.handleEnter();
      return;
    }
    const idx = '123456'.indexOf(key);
    if (idx >= 0 && key.length === 1) { g.selectTool(TOOL_ORDER[idx]); return; }
    switch (key) {
      case 'q': case 'ArrowLeft': this.rig.snap(-Math.PI / 4); e.preventDefault(); break;
      case 'e': case 'ArrowRight': this.rig.snap(Math.PI / 4); e.preventDefault(); break;
      case 'ArrowUp': case 'w': this.rig.rotate(0, 0.15); e.preventDefault(); break;
      case 'ArrowDown': case 's': this.rig.rotate(0, -0.15); e.preventDefault(); break;
      case '+': case '=': this.rig.zoomBy(0.9); break;
      case '-': case '_': this.rig.zoomBy(1.1); break;
      case ' ': this.rig.phi = this.rig.phi > 0.8 ? 0.3 : 1.15; e.preventDefault(); break;
    }
  }
}

/* Procedurally generated textures (no image assets needed). */
import * as THREE from 'three';
import { fbm, noise2, clamp, rand, roundPoly } from './util.js';
import { isRTL } from './i18n.js';

/** Font stack for text painted into textures (Hebrew uses the bundled Fredoka, which has niqqud). */
const FONT_STACK = () => (isRTL() ? '"Fredoka", "Segoe UI", system-ui, sans-serif' : '"Segoe UI", system-ui, sans-serif');
const textDir = (ctx) => { ctx.direction = isRTL() ? 'rtl' : 'ltr'; };

/* ---------- decal atlases: 2x2 variants, RGB = colour, A = "height" used for erosion ---------- */
/* Built as a raw DataTexture (not a canvas) so colour survives in low-alpha texels:
 * the decal shader uses alpha as an erosion height, not as plain opacity. */
function makeAtlas(size, setup, shadeFn, { linear = false } = {}) {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * half, oy = Math.floor(cell / 2) * half;
    const seed = cell * 31 + 7;
    const st = setup ? setup(seed) : null;
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        // v runs top-down like a canvas; row 0 of the data is the bottom of the texture
        const u = (x + 0.5) / half, v = 1 - (y + 0.5) / half;
        const c = shadeFn(u, v, seed, st);
        const i = ((oy + y) * size + ox + x) * 4;
        data[i] = clamp(c[0], 0, 255); data[i + 1] = clamp(c[1], 0, 255); data[i + 2] = clamp(c[2], 0, 255);
        data[i + 3] = clamp(c[3], 0, 1) * 255;
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; // linear = data, not colour
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}

const radial = (u, v) => Math.hypot(u - 0.5, v - 0.5) * 2; // 0 centre .. 1 edge

function bubbleSetup(count, rMin, rMax) {
  return (seed) => {
    const list = [];
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < count; i++) {
      const r = rMin + rnd() * (rMax - rMin);
      const a = rnd() * Math.PI * 2, dist = rnd() * (0.42 - r);
      list.push({ x: 0.5 + Math.cos(a) * dist, y: 0.5 + Math.sin(a) * dist, r, h: 0.35 + rnd() * 0.65 });
    }
    return list;
  };
}

export function makeDecalTextures() {
  const dust = makeAtlas(256, null, (u, v, seed) => {
    const d = radial(u, v);
    const n = fbm(u * 3, v * 3, seed, 4);
    const h = clamp((1 - d * d) * 1.15 + (n - 0.5) * 0.7 - 0.02, 0, 1);
    const b = 0.86 + fbm(u * 12 + 3, v * 12, seed + 5, 3) * 0.28;
    return [146 * b, 118 * b, 84 * b, h];
  });

  const grime = makeAtlas(256, null, (u, v, seed) => {
    const d = radial(u, v);
    const n = fbm(u * 5, v * 5, seed, 4);
    const speck = noise2(u * 40, v * 40, seed + 9) > 0.82 ? 0.25 : 0;
    const h = clamp((1 - d) * 1.7 + (n - 0.5) * 1.3 - 0.15 + speck * (1 - d), 0, 1);
    const b = 0.7 + fbm(u * 12, v * 12, seed + 3, 3) * 0.6;
    return [92 * b, 64 * b, 40 * b, h];
  });

  const foam = makeAtlas(256, bubbleSetup(16, 0.06, 0.16), (u, v, seed, bubbles) => {
    let best = 0, local = 1, hx = 0;
    for (const bb of bubbles) {
      const dd = Math.hypot(u - bb.x, v - bb.y) / bb.r;
      if (dd < 1) {
        const val = Math.sqrt(1 - dd * dd);
        if (val > best) {
          best = val; local = dd;
          hx = Math.hypot(u - (bb.x - bb.r * 0.35), v - (bb.y - bb.r * 0.35)) < bb.r * 0.22 ? 1 : 0;
        }
      }
    }
    const body = clamp(1 - radial(u, v) * 1.15, 0, 1);
    const h = clamp(Math.max(best * 0.95, body * 0.55) + (fbm(u * 6, v * 6, seed) - 0.5) * 0.3, 0, 1);
    const edge = Math.pow(local, 3);
    const r = 255 - edge * 40, g = 255 - edge * 28, b = 255 - edge * 8;
    return hx ? [255, 255, 255, h] : [r, g, b, h];
  });

  // Water uses a "clear" encoding read by the decal shader: R = highlight, G = opacity, A = erosion height.
  // Beads are mostly see-through with a darker rim, a sharp glint on top and a soft caustic at the bottom.
  const water = makeAtlas(256, bubbleSetup(11, 0.03, 0.095), (u, v, seed, drops) => {
    for (const dr of drops) {
      const dx = u - dr.x, dy = (v - dr.y) * 0.9;
      const dd = Math.hypot(dx, dy) / dr.r;
      if (dd < 1) {
        const g = Math.hypot(u - (dr.x - dr.r * 0.3), v - (dr.y - dr.r * 0.36)) / (dr.r * 0.24);
        const glint = clamp((1 - g) * 2, 0, 1);
        const caustic = Math.exp(-Math.pow((dd - 0.7) / 0.13, 2)) * clamp((dy / dr.r) * 1.8, 0, 1);
        const hl = Math.max(glint, caustic * 0.55);
        const op = Math.max(0.08 + 0.36 * clamp((dd - 0.6) / 0.4, 0, 1), glint, caustic * 0.55);
        return [hl * 255, op * 255, 0, dr.h];
      }
    }
    return [0, 0, 0, 0];
  }, { linear: true });

  // Running water: wavy rivulets with beads, tiling vertically so the shader can scroll it down the panel.
  const flow = makeAtlas(256, (seed) => {
    let st = seed;
    const rnd = () => { st = (st * 16807) % 2147483647; return st / 2147483647; };
    const list = [];
    for (let i = 0; i < 6; i++) {
      list.push({
        x: 0.14 + (i / 5) * 0.72 + (rnd() - 0.5) * 0.08, w: 0.012 + rnd() * 0.016,
        a: 0.01 + rnd() * 0.03, f1: 1 + Math.floor(rnd() * 2), p1: rnd(), f2: 2 + Math.floor(rnd() * 2), p2: rnd(),
        beads: [rnd(), rnd()].slice(0, 1 + Math.floor(rnd() * 2)),
      });
    }
    return list;
  }, (u, v, seed, rivs) => {
    let A = 0.32, OP = 0.1, HL = 0;
    for (const r of rivs) {
      const xc = r.x + r.a * Math.sin(2 * Math.PI * (r.f1 * v + r.p1)) + r.a * 0.5 * Math.sin(2 * Math.PI * (r.f2 * v + r.p2));
      let bead = 0;
      for (const b of r.beads) {
        const dv = Math.abs((((v - b + 0.5) % 1) + 1) % 1 - 0.5);
        bead = Math.max(bead, Math.exp(-Math.pow(dv / 0.04, 2)));
      }
      const d = (u - xc) / (r.w * (1 + 1.4 * bead));
      if (Math.abs(d) < 1) {
        A = 1;
        OP = Math.max(OP, 0.2 + 0.3 * Math.abs(d) + 0.2 * bead);
        HL = Math.max(HL, clamp(1 - Math.abs(d + 0.45) / 0.3, 0, 1) * (0.55 + 0.35 * bead));
      }
    }
    A *= clamp(u / 0.18, 0, 1) * clamp((1 - u) / 0.18, 0, 1);
    return [HL * 255, OP * 255, 0, A];
  }, { linear: true });

  const sparkle = makeAtlas(128, null, (u, v) => {
    const dx = Math.abs(u - 0.5), dy = Math.abs(v - 0.5);
    const d = Math.hypot(dx, dy) * 2;
    const core = Math.pow(clamp(1 - d * 1.6, 0, 1), 2);
    const rays = (Math.exp(-dx * 26) * clamp(1 - dy * 2.2, 0, 1) + Math.exp(-dy * 26) * clamp(1 - dx * 2.2, 0, 1)) * 0.9;
    const glow = clamp(1 - d, 0, 1) * 0.25;
    return [255, 246, 214, clamp(core + rays + glow, 0, 1)];
  });

  const ring = makeAtlas(128, null, (u, v) => {
    const d = radial(u, v);
    const h = Math.exp(-Math.pow((d - 0.68) / 0.1, 2)) + clamp(0.5 - d, 0, 1) * 0.5;
    return [255, 214, 90, clamp(h, 0, 1)];
  });

  return { dust, grime, foam, water, flow, sparkle, ring };
}

/* ---------- floor puddles: G = how early a spot gets wet (deep spots first), fading out away from the car ---------- */
export function makePuddleMask() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const e = Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5);
      const fall = clamp((1 - e) / 0.45, 0, 1);
      const n = fbm(u * 5, v * 5, 41, 4) * 0.75 + fbm(u * 17, v * 17, 7, 2) * 0.25;
      const m = clamp((n - 0.28) * 2.3, 0, 1) * fall;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = m * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/* ---------- particle sprite ---------- */
export function makeSoftDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* ---------- environment surfaces ---------- */
function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

export function makeConcrete(repeat) {
  return canvasTex(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fbm(x / 64, y / 64, 3, 5) * 0.6 + noise2(x / 3, y / 3, 11) * 0.4;
        const v = 92 + n * 46;
        const i = (y * w + x) * 4;
        img.data[i] = v * 0.96; img.data[i + 1] = v; img.data[i + 2] = v * 1.04; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
      ctx.beginPath();
      ctx.ellipse(rand(w), rand(h), rand(20, 70), rand(10, 40), rand(3), 0, Math.PI * 2);
      ctx.fill();
    }
  }, { repeat });
}

export function makeBayFloor() {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fbm(x / 90, y / 90, 21, 4) * 0.7 + noise2(x / 2.5, y / 2.5, 5) * 0.3;
        const i = (y * w + x) * 4;
        img.data[i] = 46 + n * 22; img.data[i + 1] = 58 + n * 24; img.data[i + 2] = 66 + n * 26; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // tile seams
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / 8, 0); ctx.lineTo((i * w) / 8, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 8); ctx.lineTo(w, (i * h) / 8); ctx.stroke();
    }
  });
}

export function makeTiles(repeat, base = '#dfeef2', alt = '#cfe4ea') {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#9fb6bd';
    ctx.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 5 === 0 ? alt : base;
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
        const g = ctx.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = g;
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
    }
  }, { repeat });
}

export function makeGrate() {
  return canvasTex(512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#20282c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6e7b80';
    for (let x = 6; x < w; x += 14) ctx.fillRect(x, 6, 7, h - 12);
    ctx.strokeStyle = '#8a979c';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });
}

export function makeSignTexture([title, sub]) {
  return canvasTex(1024, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0d3446');
    g.addColorStop(1, '#071c2a');
    ctx.fillStyle = g;
    ctx.beginPath();
    roundPoly(ctx, [[0, 0], [w, 0], [w, h], [0, h]], 40);
    ctx.fill();
    ctx.strokeStyle = '#51e4d1';
    ctx.lineWidth = 10;
    ctx.beginPath();
    roundPoly(ctx, [[14, 14], [w - 14, 14], [w - 14, h - 14], [14, h - 14]], 30);
    ctx.stroke();
    textDir(ctx);
    ctx.fillStyle = '#effaff';
    ctx.font = `700 ${isRTL() ? 104 : 120}px ${FONT_STACK()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#51e4d1';
    ctx.shadowBlur = 24;
    ctx.fillText(title, w / 2, h / 2 - 14, w - 80);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#51e4d1';
    ctx.font = `700 ${isRTL() ? 46 : 40}px ${FONT_STACK()}`;
    ctx.fillText(sub, w / 2, h / 2 + 72, w - 80);
  });
}

export function makeTextTexture(text, { w = 256, h = 64, bg = '#ffd54f', fg = '#212121', font = `700 40px ${FONT_STACK()}`, radius = 12 } = {}) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.beginPath();
    roundPoly(ctx, [[0, 0], [w, 0], [w, h], [0, h]], radius);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = font;
    textDir(ctx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2, w - 16);
  });
}

export function makeVendingFront(label) {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#10161a';
    ctx.fillRect(18, 40, 160, 330);
    const colors = ['#ffca28', '#42a5f5', '#66bb6a', '#ef5350', '#ab47bc', '#ff7043'];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = colors[(r + c) % colors.length];
        ctx.fillRect(28 + c * 38, 52 + r * 52, 28, 38);
      }
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(22, 92 + r * 52, 152, 4);
    }
    ctx.fillStyle = '#263238';
    ctx.fillRect(190, 120, 50, 90);
    ctx.fillStyle = '#80deea';
    ctx.fillRect(196, 128, 38, 22);
    ctx.fillStyle = '#10161a';
    ctx.fillRect(30, 400, 140, 60);
    ctx.fillStyle = '#fff';
    ctx.font = `700 30px ${FONT_STACK()}`;
    textDir(ctx);
    ctx.textAlign = 'center';
    ctx.fillText(label, 98, 30, 170);
  });
}

export function makePoster(title, sub, color) {
  return canvasTex(256, 360, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(rand(w), rand(h), rand(20, 60), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    textDir(ctx);
    ctx.textAlign = 'center';
    ctx.font = `700 ${isRTL() ? 44 : 40}px ${FONT_STACK()}`;
    const words = title.split(' ');
    words.forEach((wd, i) => ctx.fillText(wd, w / 2, 90 + i * (isRTL() ? 54 : 46), w - 20));
    ctx.font = `700 ${isRTL() ? 26 : 22}px ${FONT_STACK()}`;
    ctx.fillText(sub, w / 2, h - 50, w - 20);
  });
}

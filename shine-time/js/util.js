/* Shared helpers: math, random, colour, 2D geometry. */
import { getLang } from './i18n.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function weightedPick(items, weightOf) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function fmtMoney(n) {
  const v = Math.round(n);
  const abs = Math.abs(v).toLocaleString('en-US');
  // Hebrew: shekels, wrapped in a left-to-right isolate so "-₪12" keeps its order inside RTL text.
  if (getLang() === 'he') return `⁦${v < 0 ? '-' : ''}₪${abs}⁩`;
  return (v < 0 ? '-$' : '$') + abs;
}

export function fmtClock(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (getLang() === 'he') return `${h}:${String(m).padStart(2, '0')}`; // 24-hour clock
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/* ---------- colour ---------- */
export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
/** amt > 0 mixes toward white, amt < 0 toward black */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- 2D geometry ---------- */

/** Rounded-corner polygon onto any path-like target (CanvasRenderingContext2D or THREE.Shape).
 *  A point may carry its own corner radius as a 3rd value. */
export function roundPoly(path, pts, defR = 12) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const r = p1[2] !== undefined ? p1[2] : defR;
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const r1 = Math.min(r, d1 / 2), r2 = Math.min(r, d2 / 2);
    const ax = p1[0] + ((p0[0] - p1[0]) * r1) / d1, ay = p1[1] + ((p0[1] - p1[1]) * r1) / d1;
    const bx = p1[0] + ((p2[0] - p1[0]) * r2) / d2, by = p1[1] + ((p2[1] - p1[1]) * r2) / d2;
    if (r1 < 1e-5 && r2 < 1e-5) {
      if (i === 0) path.moveTo(p1[0], p1[1]);
      else path.lineTo(p1[0], p1[1]);
      continue;
    }
    if (i === 0) path.moveTo(ax, ay);
    else path.lineTo(ax, ay);
    path.quadraticCurveTo(p1[0], p1[1], bx, by);
  }
  if (path.closePath) path.closePath();
}

/** Sutherland–Hodgman clip of a polygon against a horizontal line.
 *  keep = 'below' keeps points with y >= lineY (y-down coordinates), 'above' keeps y <= lineY. */
export function clipPolyY(pts, lineY, keep) {
  const inside = (p) => (keep === 'below' ? p[1] >= lineY : p[1] <= lineY);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i], prev = pts[(i - 1 + pts.length) % pts.length];
    const ci = inside(cur), pi = inside(prev);
    if (ci !== pi) {
      const t = (lineY - prev[1]) / (cur[1] - prev[1]);
      out.push([prev[0] + (cur[0] - prev[0]) * t, lineY, 0]);
    }
    if (ci) out.push(cur);
  }
  return out;
}

export function pointInPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Extreme x of a polygon along a horizontal scanline (side: 'max' | 'min'). */
export function polyXAt(pts, y, side = 'max') {
  let best = side === 'max' ? -Infinity : Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if ((a[1] <= y && b[1] >= y) || (b[1] <= y && a[1] >= y)) {
      const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]);
      const x = a[0] + (b[0] - a[0]) * t;
      best = side === 'max' ? Math.max(best, x) : Math.min(best, x);
    }
  }
  return best;
}

export function polyBounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/* ---------- value noise (for procedural textures) ---------- */
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, seed = 0, oct = 4) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise2(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

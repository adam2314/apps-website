/* Level generation and solver. No DOM access, so it also runs in Node for tests. */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function normalizeCells(cells) {
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
function shapeVariants(base) {
  const out = [], seen = new Set();
  let cur = base;
  for (let f = 0; f < 2; f++) {
    for (let r = 0; r < 4; r++) {
      cur = cur.map(([x, y]) => [-y, x]);
      const n = normalizeCells(cur), k = JSON.stringify(n);
      if (!seen.has(k)) { seen.add(k); out.push(n); }
    }
    cur = cur.map(([x, y]) => [-x, y]);
  }
  return out;
}

// Shape families: tier = first difficulty tier where they appear
const FAMILIES = [
  { cells: [[0, 0]], tier: 0, weight: 2.2 },                          // single
  { cells: [[0, 0], [1, 0]], tier: 0, weight: 4 },                    // domino
  { cells: [[0, 0], [1, 0], [2, 0]], tier: 1, weight: 2.4 },          // I3
  { cells: [[0, 0], [1, 0], [0, 1]], tier: 1, weight: 3 },            // small L
  { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], tier: 1, weight: 1.4 },  // square
  { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], tier: 2, weight: 1.4 },  // T
  { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], tier: 2, weight: 1.8 },  // L
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], tier: 2, weight: 1 },    // S
];
const POOLS = [0, 1, 2].map(tier => {
  const pool = [];
  for (const f of FAMILIES) if (f.tier <= tier) {
    const vs = shapeVariants(f.cells);
    for (const v of vs) pool.push({
      cells: v,
      w: Math.max(...v.map(c => c[0])) + 1,
      h: Math.max(...v.map(c => c[1])) + 1,
      weight: f.weight / vs.length,
    });
  }
  return pool;
});

// Hand-tuned difficulty ramp. After the table runs out, levels continue forever.
const LEVEL_TABLE = [
  //  W  H col fill tier minR maxR maxFirst dir  ice  obst extraGate
  [4, 4, 2, .40, 0, 1, 2, 1.0, 0, 0, 0, 0],       // 1
  [4, 5, 2, .45, 0, 1, 2, 1.0, 0, 0, 0, 0],       // 2
  [5, 5, 3, .48, 0, 2, 3, .80, 0, 0, 0, 0],       // 3
  [5, 5, 3, .52, 1, 2, 3, .70, 0, 0, 0, 0],       // 4
  [5, 6, 3, .55, 1, 2, 4, .60, 0, 0, 0, 0],       // 5
  [5, 6, 4, .56, 1, 3, 99, .55, 0, 0, 0, 0],      // 6
  [6, 6, 4, .58, 1, 3, 99, .50, 0, 0, 1, 0],      // 7
  [6, 6, 4, .60, 2, 3, 99, .50, 0, 0, 0, .2],     // 8
  [6, 7, 4, .60, 2, 3, 99, .50, .25, 0, 0, .2],   // 9  arrows appear
  [6, 7, 5, .62, 2, 3, 99, .45, .2, 0, 1, .2],    // 10
  [6, 7, 4, .60, 2, 3, 99, .50, 0, .2, 0, .2],    // 11 ice appears
  [6, 8, 5, .62, 2, 4, 99, .45, .2, .12, 1, .3],  // 12
  [7, 8, 5, .64, 2, 4, 99, .40, .2, 0, 2, .3],    // 13
  [7, 8, 5, .64, 2, 4, 99, .40, .1, .18, 0, .3],  // 14
  [7, 8, 6, .66, 2, 4, 99, .40, .25, .1, 2, .3],  // 15
  [7, 9, 6, .66, 2, 4, 99, .35, .25, .15, 2, .4], // 16
];

function levelParams(n) {
  let r;
  if (n <= LEVEL_TABLE.length) r = LEVEL_TABLE[n - 1];
  else {
    const k = n - LEVEL_TABLE.length;
    const sizes = [[7, 9], [7, 8], [6, 9], [8, 8], [7, 9], [6, 8]];
    const [W, H] = sizes[k % sizes.length];
    r = [W, H, 5 + (k % 3), Math.min(.7, .64 + (k % 4) * .02), 2, 4 + (k % 3 === 2 ? 1 : 0), 99, .35, .25, .12, k % 4, .4];
  }
  const [W, H, colors, fill, tier, minRounds, maxRounds, maxFirst, dir, ice, obst, extraGate] = r;
  return { W, H, colors, fill, tier, minRounds, maxRounds, maxFirst, dir, ice, obst, extraGate };
}

function makeGrid(L, blocks) {
  const g = new Int16Array(L.W * L.H).fill(-1);
  for (const [x, y] of L.obstacles) g[y * L.W + x] = -2;
  for (const b of blocks) for (const [cx, cy] of b.cells) g[(b.y + cy) * L.W + b.x + cx] = b.id;
  return g;
}
function fitsAt(L, grid, b, x, y) {
  for (const [cx, cy] of b.cells) {
    const X = x + cx, Y = y + cy;
    if (X < 0 || Y < 0 || X >= L.W || Y >= L.H) return false;
    const v = grid[Y * L.W + X];
    if (v !== -1 && v !== b.id) return false;
  }
  return true;
}
function sideOf(dx, dy) { return dy < 0 ? 'top' : dy > 0 ? 'bottom' : dx < 0 ? 'left' : 'right'; }

// Can block b, sitting at (x,y), slide straight out through a matching gate in direction (dx,dy)?
function exitGate(L, grid, b, x, y, dx, dy) {
  if ((b.axis === 'h' && dy) || (b.axis === 'v' && dx)) return null;
  const side = sideOf(dx, dy);
  outer: for (const g of L.gates) {
    if (g.side !== side || g.color !== b.color) continue;
    for (const [cx, cy] of b.cells) {
      const X = x + cx, Y = y + cy, along = dy ? X : Y;
      if (along < g.start || along >= g.start + g.len) continue outer;
      for (let px = X + dx, py = Y + dy; px >= 0 && py >= 0 && px < L.W && py < L.H; px += dx, py += dy) {
        const v = grid[py * L.W + px];
        if (v !== -1 && v !== b.id) continue outer;
      }
    }
    return g;
  }
  return null;
}

function moveDirs(b) {
  return b.axis === 'h' ? [[1, 0], [-1, 0]] : b.axis === 'v' ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
}

// BFS over positions of one block (others fixed): can it reach an exit?
function canReachExit(L, grid, b) {
  const W = L.W, seen = new Uint8Array(L.W * L.H);
  const q = [[b.x, b.y]];
  seen[b.y * W + b.x] = 1;
  const dirs = moveDirs(b);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of dirs) {
      if (exitGate(L, grid, b, x, y, dx, dy)) return true;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H || seen[ny * W + nx]) continue;
      if (!fitsAt(L, grid, b, nx, ny)) continue;
      seen[ny * W + nx] = 1;
      q.push([nx, ny]);
    }
  }
  return false;
}

// Greedy solver. Removing a block only frees space and thaws ice, so if this
// clears the board the level is solvable. A frozen block (ice > blocks exited
// so far) cannot move at all.
function analyze(L) {
  let blocks = L.blocks.slice();
  let rounds = 0, first = -1, exited = 0;
  while (blocks.length) {
    const grid = makeGrid(L, blocks);
    const out = new Set();
    for (const b of blocks) if ((b.ice || 0) <= exited && canReachExit(L, grid, b)) out.add(b.id);
    if (!out.size) return { solvable: false, rounds, first };
    if (first < 0) first = out.size;
    blocks = blocks.filter(b => !out.has(b.id));
    exited += out.size;
    rounds++;
  }
  return { solvable: true, rounds, first };
}

function tryGen(p, rng) {
  const { W, H } = p;
  const ri = n => Math.floor(rng() * n);
  const pal = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = pal.length - 1; i > 0; i--) { const j = ri(i + 1); [pal[i], pal[j]] = [pal[j], pal[i]]; }
  const colors = pal.slice(0, p.colors);

  // Gates
  const gateColors = colors.slice();
  for (const c of colors) if (rng() < p.extraGate) gateColors.push(c);
  const gates = [];
  const SIDES = ['top', 'bottom', 'left', 'right'];
  for (const c of gateColors) {
    let placed = false;
    for (let t = 0; t < 60 && !placed; t++) {
      const side = SIDES[ri(4)];
      const sl = side === 'top' || side === 'bottom' ? W : H;
      const len = Math.min(sl - 1, [1, 2, 2, 3, 3][ri(5)]);
      const start = ri(sl - len + 1);
      if (gates.some(g => g.side === side && start < g.start + g.len + 1 && g.start < start + len + 1)) continue;
      gates.push({ side, start, len, color: c });
      placed = true;
    }
    if (!placed) return null;
  }

  // Obstacles
  const grid = new Int16Array(W * H).fill(-1);
  const obstacles = [];
  for (let i = 0; i < p.obst; i++) {
    const x = ri(W), y = ri(H);
    if (grid[y * W + x] === -1) { grid[y * W + x] = -2; obstacles.push([x, y]); }
  }

  // Blocks, placed one by one; a placement that makes the board unsolvable is undone.
  const pool = POOLS[p.tier];
  const totalW = pool.reduce((s, s2) => s + s2.weight, 0);
  const pick = () => { let r = rng() * totalW; for (const s of pool) { r -= s.weight; if (r <= 0) return s; } return pool[pool.length - 1]; };
  const target = Math.round((W * H - obstacles.length) * p.fill);
  const blocks = [];
  const partial = { W, H, gates, obstacles, blocks };
  let covered = 0;
  for (let t = 0; t < 400 && covered < target; t++) {
    const color = blocks.length < colors.length ? colors[blocks.length] : colors[ri(colors.length)];
    const shape = pick();
    if (covered + shape.cells.length > target + 1) continue;
    const axis = rng() < p.dir ? (rng() < .5 ? 'h' : 'v') : null;
    const fits = gates.some(g => g.color === color && (
      g.side === 'top' || g.side === 'bottom' ? shape.w <= g.len && axis !== 'h' : shape.h <= g.len && axis !== 'v'));
    if (!fits) continue;
    const spots = [];
    for (let y = 0; y <= H - shape.h; y++) for (let x = 0; x <= W - shape.w; x++)
      if (shape.cells.every(([cx, cy]) => grid[(y + cy) * W + x + cx] === -1)) spots.push([x, y]);
    if (!spots.length) continue;
    const [x, y] = spots[ri(spots.length)];
    const id = blocks.length;
    blocks.push({ id, cells: shape.cells, w: shape.w, h: shape.h, color, x, y, axis, ice: 0 });
    if (!analyze(partial).solvable) { blocks.pop(); continue; }
    for (const [cx, cy] of shape.cells) grid[(y + cy) * W + x + cx] = id;
    covered += shape.cells.length;
  }
  if (covered < target * 0.9) return null;
  if (colors.some(c => !blocks.some(b => b.color === c))) return null;

  // Ice: frozen until N other blocks have left. Only kept if the board stays solvable.
  if (p.ice > 0 && blocks.length > 2) {
    for (const b of blocks) {
      if (rng() >= p.ice) continue;
      b.ice = 1 + ri(Math.min(3, blocks.length - 1));
      if (!analyze(partial).solvable) b.ice = 0;
    }
  }
  return partial;
}

function genLevel(n) {
  const base = levelParams(n);
  const rng = mulberry32(((n * 2654435761) ^ 0x9e3779b9) >>> 0);
  const finish = (L, r) => {
    L.rounds = r.rounds;
    const iced = L.blocks.filter(b => b.ice).length;
    L.time = Math.ceil((20 + L.blocks.length * 4.5 + r.rounds * 5 + iced * 3) / 5) * 5;
    return L;
  };
  let best = null, bestScore = -Infinity;
  for (let pass = 0; pass < 4; pass++) {
    const p = { ...base,
      fill: base.fill - pass * .06,
      minRounds: Math.max(1, base.minRounds - pass),
      maxFirst: base.maxFirst + pass * .15 };
    for (let a = 0; a < 350; a++) {
      const L = tryGen(p, rng);
      if (!L) continue;
      const r = analyze(L);
      if (!r.solvable || r.rounds > p.maxRounds) continue;
      const frac = r.first / L.blocks.length;
      // a level whose params include arrows / ice should actually show them
      const hasMechanics = (!p.dir || L.blocks.some(b => b.axis)) && (!p.ice || L.blocks.some(b => b.ice));
      if (r.rounds >= p.minRounds && frac <= p.maxFirst && hasMechanics) return finish(L, r);
      const score = r.rounds * 2 - frac * 3 + L.blocks.length * .05;
      if (score > bestScore) { bestScore = score; best = { L, r }; }
    }
    if (best) return finish(best.L, best.r);
  }
  // Last resort: a sparse easy board
  for (;;) {
    const L = tryGen({ ...base, fill: .3, tier: 0, obst: 0, dir: 0, ice: 0, extraGate: 0 }, rng);
    if (!L) continue;
    const r = analyze(L);
    if (r.solvable) return finish(L, r);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { genLevel, analyze, levelParams, makeGrid, fitsAt, exitGate, moveDirs, LEVEL_TABLE };
}

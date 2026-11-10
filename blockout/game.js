/* Game: rendering, input and UI. Depends on levels.js. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('c'), ctx = canvas.getContext('2d'), stage = $('stage');
  const FONT = 'Rubik, "Noto Sans Hebrew", "Segoe UI", Arial, sans-serif';

  const COLORS = [
    { base: '#ff4f64', dark: '#c22a43', light: '#ffa0ac', name: 'אָדֹם' },
    { base: '#ff9b2f', dark: '#c96a0c', light: '#ffc98a', name: 'כָּתֹם' },
    { base: '#ffd43b', dark: '#c99d07', light: '#fff0a6', name: 'צָהֹב' },
    { base: '#3fd06f', dark: '#22994b', light: '#9ff0b8', name: 'יָרֹק' },
    { base: '#2fc6ea', dark: '#1590b0', light: '#9ee9f8', name: 'תְּכֵלֶת' },
    { base: '#4b78ff', dark: '#2b4fc9', light: '#a8bfff', name: 'כָּחֹל' },
    { base: '#a85cff', dark: '#7434d1', light: '#d6b0ff', name: 'סָגֹל' },
    { base: '#ff72cf', dark: '#c9409f', light: '#ffbbe9', name: 'וָרֹד' },
  ];

  // All player-facing text: short sentences with full nikud for beginning readers.
  const T = {
    level: n => `שָׁלָב ${n}`,
    tips: [
      'גּוֹרְרִים כָּל קֻבִּיָּה לַשַּׁעַר בְּאוֹתוֹ צֶבַע',
      'הַשַּׁעַר צָרִיךְ לִהְיוֹת רָחָב כְּמוֹ הַקֻּבִּיָּה',
      'יֵשׁ קֻבִּיּוֹת בַּדֶּרֶךְ? מוֹצִיאִים אוֹתָן קֹדֶם',
      'הָעֵינַיִם שֶׁל הַקֻּבִּיָּה מַבִּיטוֹת אֶל הַשַּׁעַר',
    ],
    arrows: 'קֻבִּיָּה עִם חִצִּים זָזָה רַק לְפִי הַחִצִּים',
    ice: 'עַל הַקֶּרַח יֵשׁ מִסְפָּר. כָּל קֻבִּיָּה שֶׁיּוֹצֵאת — הַמִּסְפָּר יוֹרֵד',
    left: n => n === 1 ? 'נִשְׁאֲרָה קֻבִּיָּה אַחַת' : `נִשְׁאֲרוּ ${n} קֻבִּיּוֹת`,
    frozen: 'קְפוּאָה!',
    winTitle: 'כָּל הַכָּבוֹד!',
    winText: n => `שָׁלָב ${n} הוּשְׁלַם`,
    winStats: (m, t) => `${m === 1 ? 'מַהֲלָךְ אֶחָד' : m + ' מַהֲלָכִים'} · נִשְׁאַר זְמַן ${t}`,
    next: 'לַשָּׁלָב הַבָּא',
    replay: 'לְשַׂחֵק שׁוּב',
    loseTitle: 'נִגְמַר הַזְּמַן!',
    loseText: n => `${T.left(n)}. נְנַסֶּה שׁוּב?`,
    retry: 'מְנַסִּים שׁוּב',
    pick: 'לִבְחֹר שָׁלָב אַחֵר',
  };

  const WALL_U = 0.42;   // wall thickness in cells
  const EXIT_TIME = 0.42;

  const load = (k, d) => { try { const v = localStorage.getItem('blockout.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem('blockout.' + k, JSON.stringify(v)); } catch (e) {} };

  let maxLevel = Math.max(1, load('max', load('level', 1)) | 0);
  const urlLevel = parseInt(new URLSearchParams(location.search).get('level'), 10);
  let levelNum = urlLevel > 0 ? urlLevel : Math.min(maxLevel, Math.max(1, load('level', 1) | 0));
  const stars = load('stars', {}) || {};
  const seen = load('seen', {}) || {};
  let muted = !!load('muted', false);

  let L, W, H, blocks = [], grid, drag = null, state = 'play';
  let timeLeft = 0, timeTotal = 1, started = false, moves = 0, exitedCount = 0, lastStars = 0;
  let exiting = [], particles = [], texts = [];
  let dpr = 1, cs = 40, wall = 16, ox = 0, oy = 0, bw = 0, bh = 0, viewW = 0, viewH = 0;
  let lastT = performance.now(), now = 0, shake = 0;

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const iceLeft = b => Math.max(0, (b.ice || 0) - exitedCount);
  const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillRR(x, y, w, h, r, style) { ctx.fillStyle = style; ctx.beginPath(); rr(x, y, w, h, r); ctx.fill(); }

  // ---------- audio ----------
  let actx = null;
  function ensureAudio() {
    if (muted) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  function tone(freq, dur, type = 'sine', vol = .12, slideTo = 0, delay = 0) {
    if (muted || !actx) return;
    try {
      const t = actx.currentTime + delay;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  const sfx = {
    pick: () => tone(520, .07, 'triangle', .06, 700),
    step: () => tone(260 + Math.random() * 40, .035, 'triangle', .035),
    bump: () => tone(140, .06, 'square', .025),
    frozen: () => { tone(1400, .05, 'square', .03); tone(1100, .05, 'square', .03, 0, .06); },
    thaw: () => [1200, 1500, 1900].forEach((f, i) => tone(f, .12, 'triangle', .05, 0, i * .05)),
    exit: () => { tone(420, .22, 'sine', .14, 1100); tone(840, .16, 'triangle', .05, 1600, .05); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'triangle', .12, 0, i * .1)),
    lose: () => tone(330, .6, 'sawtooth', .06, 110),
  };
  const ICON_SOUND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
  const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
  const ICON_SPEAK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
  function renderSoundBtn() { $('soundBtn').innerHTML = muted ? ICON_SOUND_OFF : ICON_SOUND_ON; }

  // ---------- read aloud (only if the device has a Hebrew voice) ----------
  let heVoice = null;
  function pickVoice() {
    try { heVoice = speechSynthesis.getVoices().find(v => /^(he|iw)\b/i.test(v.lang)) || null; }
    catch (e) { heVoice = null; }
    document.body.classList.toggle('can-speak', !!heVoice);
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { speechSynthesis.onvoiceschanged = pickVoice; }
  }
  function speak(text) {
    if (!heVoice || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = heVoice; u.lang = heVoice.lang; u.rate = .85;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  for (const id of ['sayHint', 'sayIntro', 'sayResult']) $(id).innerHTML = ICON_SPEAK;
  $('sayHint').onclick = () => speak($('hint').textContent);
  $('sayIntro').onclick = () => speak([...$('introSteps').querySelectorAll('span')].map(s => s.textContent).join(' '));
  $('sayResult').onclick = () => speak(`${$('ovTitle').textContent}. ${$('ovText').textContent}`);

  // ---------- level ----------
  function startLevel(n) {
    levelNum = n;
    maxLevel = Math.max(maxLevel, n);
    save('level', n); save('max', maxLevel);
    L = genLevel(n);
    W = L.W; H = L.H;
    blocks = L.blocks.map(b => ({ ...b, vx: b.x, vy: b.y, lift: 0, wiggle: 0, blinkAt: now + 1 + Math.random() * 4, blinkEnd: 0 }));
    grid = makeGrid(L, blocks);
    drag = null; exiting = []; particles = []; texts = [];
    state = 'play'; started = false; moves = 0; exitedCount = 0;
    timeTotal = timeLeft = L.time;
    $('lvl').textContent = T.level(n);
    closeAllPanels();
    updateHint();
    layout();
    updateTimerUI();
  }

  function hintText() {
    if (levelNum <= T.tips.length) return T.tips[levelNum - 1];
    if (L.blocks.some(b => b.ice) && !seen.ice) return T.ice;
    if (L.blocks.some(b => b.axis) && !seen.arrows) return T.arrows;
    return blocks.length ? T.left(blocks.length) : '';
  }
  function updateHint() { $('hint').textContent = hintText(); }

  function layout() {
    const r = stage.getBoundingClientRect();
    viewW = r.width; viewH = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    if (!L) return;
    const pad = 14;
    cs = Math.floor(Math.min((viewW - pad * 2) / (W + WALL_U * 2), (viewH - pad * 2) / (H + WALL_U * 2), 76));
    wall = cs * WALL_U;
    bw = W * cs; bh = H * cs;
    ox = Math.round((viewW - bw) / 2);
    oy = Math.round((viewH - bh) / 2);
  }

  // ---------- movement ----------
  function setCells(b, v) { for (const [cx, cy] of b.cells) grid[(b.y + cy) * W + b.x + cx] = v; }

  function stepResult(b, dx, dy) {
    if (iceLeft(b) || (b.axis === 'h' && dy) || (b.axis === 'v' && dx)) return { kind: 'blocked' };
    const nx = b.x + dx, ny = b.y + dy;
    for (const [cx, cy] of b.cells) {
      const X = nx + cx, Y = ny + cy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) {
        const g = exitGate(L, grid, b, b.x, b.y, dx, dy);
        return g ? { kind: 'exit', gate: g } : { kind: 'blocked' };
      }
    }
    return fitsAt(L, grid, b, nx, ny) ? { kind: 'free' } : { kind: 'blocked' };
  }

  function moveBlock(b, dx, dy) {
    setCells(b, -1);
    b.x += dx; b.y += dy;
    setCells(b, b.id);
    started = true;
    sfx.step();
  }

  function burst(x, y, n, colorFn, speed, push = [0, 0]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (.4 + Math.random() * .6);
      particles.push({
        x, y, vx: Math.cos(a) * s + push[0], vy: Math.sin(a) * s + push[1],
        life: .5 + Math.random() * .4, max: .9, size: .08 + Math.random() * .1, color: colorFn(),
      });
    }
  }

  function exitBlock(b, g, dx, dy) {
    setCells(b, -1);
    blocks.splice(blocks.indexOf(b), 1);
    started = true;
    exitedCount++;
    const ext = dx ? b.w : b.h;
    exiting.push({ b, sx: b.vx, sy: b.vy, dx, dy, dist: ext + WALL_U + 0.6, t: 0 });

    const col = COLORS[b.color];
    const along = g.start + g.len / 2;
    const gx = dy ? along : (dx < 0 ? -WALL_U / 2 : W + WALL_U / 2);
    const gy = dx ? along : (dy < 0 ? -WALL_U / 2 : H + WALL_U / 2);
    burst(gx, gy, 22, () => Math.random() < .3 ? '#fff' : col.base, 7, [dx * 5, dy * 5]);

    // The color's name pops up next to its gate, for reading practice
    const tx = dy ? clamp(along, 1.3, W - 1.3) : (dx < 0 ? 1.4 : W - 1.4);
    const ty = dx ? clamp(along, .8, H - .8) : (dy < 0 ? .9 : H - .9);
    texts.push({ x: tx, y: ty, str: col.name, stroke: col.dark, t: 0, life: 1.3 });

    // Thaw any block whose ice count just reached zero
    for (const o of blocks) if (o.ice && o.ice === exitedCount) {
      for (const [cx, cy] of o.cells) burst(o.x + cx + .5, o.y + cy + .5, 6, () => Math.random() < .5 ? '#fff' : '#bfe9ff', 4);
      sfx.thaw();
    }

    sfx.exit();
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
    updateHint();
  }

  // The block follows the finger one cell at a time, only along the direction
  // the finger is mostly moving. It never slides sideways on its own, and it
  // leaves only through a gate it is lined up with, when the player pushes it in.
  const STEP = .5;        // finger lead (in cells) that moves the block one cell
  const TURN_STEP = .75;  // ...when switching to the other axis, so a drifting finger doesn't steer
  const SLACK = .1;       // finger lead kept after the block is stopped

  // How far the finger is ahead of the block, in cells
  function lead(d) {
    const b = d.b;
    return [b.axis === 'v' ? 0 : d.px + d.ax - b.x, b.axis === 'h' ? 0 : d.py + d.ay - b.y];
  }

  function updateDrag() {
    const d = drag, b = d.b;
    for (let i = 0; i < 40; i++) {
      const [ex, ey] = lead(d);
      const axis = Math.abs(ex) >= Math.abs(ey) ? 'x' : 'y';
      const e = axis === 'x' ? ex : ey;
      if (Math.abs(e) < (d.axis && d.axis !== axis ? TURN_STEP : STEP)) break;
      const sx = axis === 'x' ? Math.sign(e) : 0, sy = axis === 'y' ? Math.sign(e) : 0;
      d.axis = axis;
      const r = stepResult(b, sx, sy);
      if (r.kind === 'free') { moveBlock(b, sx, sy); d.moved = true; continue; }
      if (r.kind === 'exit') { d.moved = true; exitBlock(b, r.gate, sx, sy); finishDrag(); return; }
      // Stopped by a wall or a block: drop the finger's extra push, so it can't
      // build up and move the block later without the player meaning it.
      if (axis === 'x') d.ax -= ex - sx * SLACK; else d.ay -= ey - sy * SLACK;
      const key = `${b.x},${b.y},${sx},${sy}`;
      if (d.bumpKey !== key) { d.bumpKey = key; sfx.bump(); }
    }
    // Partial offset toward the pointer for a fluid feel
    const [ex, ey] = lead(d);
    d.offX = 0; d.offY = 0;
    if (Math.abs(ex) >= Math.abs(ey)) {
      if (ex) d.offX = stepResult(b, Math.sign(ex), 0).kind !== 'blocked' ? clamp(ex, -.45, .45) : clamp(ex, -.07, .07);
    } else if (ey) {
      d.offY = stepResult(b, 0, Math.sign(ey)).kind !== 'blocked' ? clamp(ey, -.45, .45) : clamp(ey, -.07, .07);
    }
  }

  function finishDrag() {
    if (!drag) return;
    if (drag.moved) moves++;
    drag = null;
  }

  // ---------- input ----------
  function toCell(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left - ox) / cs, (e.clientY - r.top - oy) / cs];
  }
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'play' || drag || anyPanel()) return;
    ensureAudio();
    const [px, py] = toCell(e);
    const cx = Math.floor(px), cy = Math.floor(py);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return;
    const id = grid[cy * W + cx];
    if (id < 0) return;
    const b = blocks.find(b => b.id === id);
    if (!b) return;
    e.preventDefault();
    if (iceLeft(b)) {
      b.wiggle = 1;
      if (!texts.some(t => t.frozenOf === b && t.t < .6)) {
        texts.push({ x: clamp(b.x + b.w / 2, 1.2, W - 1.2), y: b.y + b.h / 2, str: T.frozen, stroke: '#2a7fb8', t: 0, life: 1.1, frozenOf: b });
      }
      sfx.frozen();
      return;
    }
    drag = { b, pid: e.pointerId, ax: b.x - px, ay: b.y - py, px, py, axis: null, offX: 0, offY: 0, moved: false, bumpKey: '' };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    sfx.pick();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid || state !== 'play') return;
    [drag.px, drag.py] = toCell(e);
    updateDrag();
  });
  const endPointer = e => { if (drag && e.pointerId === drag.pid) finishDrag(); };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  $('restartBtn').onclick = () => { ensureAudio(); startLevel(levelNum); };
  $('soundBtn').onclick = () => { muted = !muted; save('muted', muted); renderSoundBtn(); ensureAudio(); };
  $('lvlBtn').onclick = () => openLevels();
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('levels').classList.contains('show')) closeLevels();
    else if ((e.key === 'r' || e.key === 'R') && !anyPanel()) startLevel(levelNum);
    else if (e.key === 'Enter' && $('ov').classList.contains('show')) $('ovBtn').click();
  });
  window.addEventListener('resize', layout);

  // ---------- panels ----------
  const PANELS = ['intro', 'ov', 'levels'];
  const anyPanel = () => PANELS.some(p => $(p).classList.contains('show'));
  function openPanel(id) {
    finishDrag();
    PANELS.forEach(p => $(p).classList.toggle('show', p === id));
  }
  function closeAllPanels() { PANELS.forEach(p => $(p).classList.remove('show')); }
  // After closing a menu, a finished level shows its result card again
  function resumeGame() {
    closeAllPanels();
    if (state === 'won') showResult('win');
    else if (state === 'lost') showResult('lose');
  }

  $('introBtn').onclick = () => { ensureAudio(); save('introSeen', true); resumeGame(); };
  $('howBtn').onclick = () => openPanel('intro');
  $('lvClose').onclick = () => closeLevels();
  function closeLevels() { resumeGame(); }

  const LOCK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';
  function openLevels() {
    const box = $('lvGrid');
    box.innerHTML = '';
    const total = Math.max(60, Math.ceil((maxLevel + 10) / 5) * 5);
    for (let i = 1; i <= total; i++) {
      const b = document.createElement('button');
      const locked = i > maxLevel;
      b.className = 'lv' + (locked ? ' locked' : '') + (i === levelNum ? ' cur' : '');
      b.disabled = locked;
      if (locked) b.innerHTML = `${LOCK}<span>${i}</span>`;
      else {
        const s = stars[i] || 0;
        b.innerHTML = `<span>${i}</span><span class="st">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span>`;
        b.onclick = () => { ensureAudio(); startLevel(i); };
      }
      box.appendChild(b);
    }
    openPanel('levels');
    const cur = box.querySelector('.cur');
    if (cur) box.scrollTop = Math.max(0, cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2);
  }

  // ---------- win / lose ----------
  const STAR = on => `<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" fill="${on ? '#ffc93c' : '#e3def5'}" stroke="${on ? '#e8a612' : '#d2cbea'}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  function showResult(kind) {
    if (kind === 'win') {
      $('ovStars').innerHTML = STAR(lastStars >= 1) + STAR(lastStars >= 2) + STAR(lastStars >= 3);
      $('ovTitle').textContent = T.winTitle;
      $('ovText').textContent = T.winText(levelNum);
      $('ovStats').textContent = T.winStats(moves, fmtTime(timeLeft));
      $('ovBtn').textContent = T.next;
      $('ovBtn').className = 'btn';
      $('ovBtn').onclick = () => startLevel(levelNum + 1);
      $('ovLink').textContent = T.replay;
      $('ovLink').onclick = () => startLevel(levelNum);
    } else {
      $('ovStars').innerHTML = '';
      $('ovTitle').textContent = T.loseTitle;
      $('ovText').textContent = T.loseText(blocks.length);
      $('ovStats').textContent = '';
      $('ovBtn').textContent = T.retry;
      $('ovBtn').className = 'btn alt';
      $('ovBtn').onclick = () => startLevel(levelNum);
      $('ovLink').textContent = T.pick;
      $('ovLink').onclick = () => openLevels();
    }
    openPanel('ov');
  }

  function win() {
    state = 'won';
    const f = timeLeft / timeTotal;
    lastStars = f > .5 ? 3 : f > .25 ? 2 : 1;
    if ((stars[levelNum] || 0) < lastStars) { stars[levelNum] = lastStars; save('stars', stars); }
    if (L.blocks.some(b => b.ice)) seen.ice = true;
    if (L.blocks.some(b => b.axis)) seen.arrows = true;
    save('seen', seen);
    maxLevel = Math.max(maxLevel, levelNum + 1);
    save('max', maxLevel);
    save('level', levelNum + 1);
    sfx.win();
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * W, y: -1 - Math.random() * 2,
        vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4,
        life: 1.6 + Math.random(), max: 2.6, size: .1 + Math.random() * .12,
        color: COLORS[(Math.random() * COLORS.length) | 0].base, confetti: true, rot: Math.random() * 6,
      });
    }
    const lvl = levelNum;
    setTimeout(() => { if (state === 'won' && levelNum === lvl && !anyPanel()) showResult('win'); }, 650);
  }
  function lose() {
    state = 'lost';
    finishDrag();
    shake = .4;
    sfx.lose();
    const lvl = levelNum;
    setTimeout(() => { if (state === 'lost' && levelNum === lvl && !anyPanel()) showResult('lose'); }, 500);
  }

  let lastShownSec = -1;
  function updateTimerUI() {
    const f = clamp(timeLeft / timeTotal, 0, 1);
    $('barFill').style.transform = `scaleX(${f})`;
    $('bar').classList.toggle('low', f < .25);
    const s = Math.ceil(timeLeft);
    if (s !== lastShownSec) { lastShownSec = s; $('time').textContent = fmtTime(s); }
  }

  // ---------- update ----------
  function update(dt) {
    const k = 1 - Math.exp(-dt * 24);
    for (const b of blocks) {
      const isDrag = drag && drag.b === b;
      const tx = b.x + (isDrag ? drag.offX : 0), ty = b.y + (isDrag ? drag.offY : 0);
      b.vx += (tx - b.vx) * k;
      b.vy += (ty - b.vy) * k;
      b.lift += ((isDrag ? 1 : 0) - b.lift) * (1 - Math.exp(-dt * 18));
      b.wiggle = Math.max(0, b.wiggle - dt * 2.5);
      if (now > b.blinkAt) { b.blinkEnd = now + .13; b.blinkAt = now + 2 + Math.random() * 4; }
    }
    for (const e of exiting) e.t += dt;
    exiting = exiting.filter(e => e.t < EXIT_TIME);
    for (const t of texts) t.t += dt;
    texts = texts.filter(t => t.t < t.life);
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.confetti) { p.vy += 4 * dt; p.vx *= .99; p.rot += dt * 6; }
      else { p.vx *= .92; p.vy *= .92; }
    }
    particles = particles.filter(p => p.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt);

    if (state === 'play' && !anyPanel()) {
      if (started && blocks.length) {
        timeLeft -= dt;
        if (timeLeft <= 0) { timeLeft = 0; lose(); }
      }
      if (!blocks.length && !exiting.length) win();
    }
    updateTimerUI();
  }

  // ---------- drawing ----------
  function shapePath(cells, px, py, ins, r) {
    const has = (x, y) => cells.some(c => c[0] === x && c[1] === y);
    ctx.beginPath();
    for (const [x, y] of cells) {
      const X = px + x * cs, Y = py + y * cs;
      rr(X + ins, Y + ins, cs - 2 * ins, cs - 2 * ins, r);
      const R = has(x + 1, y), D = has(x, y + 1);
      if (R) ctx.rect(X + cs / 2, Y + ins, cs, cs - 2 * ins);
      if (D) ctx.rect(X + ins, Y + cs / 2, cs - 2 * ins, cs);
      if (R && D && has(x + 1, y + 1)) ctx.rect(X + cs / 2, Y + cs / 2, cs, cs);
    }
  }

  function tri(cx, cy, s, dir) {
    ctx.beginPath();
    if (dir === 'l') { ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s * .6, cy - s); ctx.lineTo(cx + s * .6, cy + s); }
    if (dir === 'r') { ctx.moveTo(cx + s, cy); ctx.lineTo(cx - s * .6, cy - s); ctx.lineTo(cx - s * .6, cy + s); }
    if (dir === 'u') { ctx.moveTo(cx, cy - s); ctx.lineTo(cx - s, cy + s * .6); ctx.lineTo(cx + s, cy + s * .6); }
    if (dir === 'd') { ctx.moveTo(cx, cy + s); ctx.lineTo(cx - s, cy - s * .6); ctx.lineTo(cx + s, cy - s * .6); }
    ctx.closePath();
    ctx.fill();
  }

  function gateCenter(g) {
    const m = g.start + g.len / 2;
    return g.side === 'top' ? [m, -.6] : g.side === 'bottom' ? [m, H + .6] : g.side === 'left' ? [-.6, m] : [W + .6, m];
  }

  function drawBlock(b, x, y, lift, ice) {
    const col = COLORS[b.color];
    const has = (cx, cy) => b.cells.some(c => c[0] === cx && c[1] === cy);
    const ins = cs * .05, r = cs * .22, depth = cs * .09;
    const px = ox + x * cs + (b.wiggle ? Math.sin(now * 45) * b.wiggle * cs * .08 : 0);
    const py0 = oy + y * cs;
    const py = py0 - cs * .07 * lift;

    if (lift > .01) {
      ctx.fillStyle = `rgba(10,5,40,${.3 * lift})`;
      shapePath(b.cells, px + cs * .03, py0 + depth + cs * .08 * lift, ins, r);
      ctx.fill();
    }
    ctx.fillStyle = col.dark;
    shapePath(b.cells, px, py + depth, ins, r); ctx.fill();
    ctx.fillStyle = col.base;
    shapePath(b.cells, px, py, ins, r); ctx.fill();

    // bevel plate
    const g = ctx.createLinearGradient(0, py, 0, py + b.h * cs);
    g.addColorStop(0, hexA(col.light, .75));
    g.addColorStop(Math.min(.9, .55 / b.h + .1), hexA(col.light, 0));
    ctx.fillStyle = g;
    shapePath(b.cells, px, py, cs * .14, cs * .14); ctx.fill();

    // shine on top cells
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (const [cx, cy] of b.cells) {
      if (has(cx, cy - 1)) continue;
      ctx.beginPath();
      ctx.ellipse(px + cx * cs + cs * .24, py + cy * cs + cs * .2, cs * .07, cs * .045, -.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // direction arrows
    if (b.axis) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      const s = cs * .085;
      for (const [cx, cy] of b.cells) {
        const X = px + cx * cs, Y = py + cy * cs;
        if (b.axis === 'h') {
          if (!has(cx - 1, cy)) tri(X + cs * .15, Y + cs * .55, s, 'l');
          if (!has(cx + 1, cy)) tri(X + cs * .85, Y + cs * .55, s, 'r');
        } else {
          if (!has(cx, cy - 1)) tri(X + cs * .5, Y + cs * .14, s, 'u');
          if (!has(cx, cy + 1)) tri(X + cs * .5, Y + cs * .86, s, 'd');
        }
      }
    }

    // face on the first cell; eyes look toward the nearest matching gate
    const [ax, ay] = b.cells[0];
    const bx = x + ax + .5, by = y + ay + .5;
    let best = null, bd = Infinity;
    for (const gt of L.gates) if (gt.color === b.color) {
      const [gx, gy] = gateCenter(gt);
      const dd = (gx - bx) ** 2 + (gy - by) ** 2;
      if (dd < bd) { bd = dd; best = [gx - bx, gy - by]; }
    }
    let lx = 0, ly = 0;
    if (best) { const m = Math.hypot(best[0], best[1]) || 1; lx = best[0] / m; ly = best[1] / m; }
    const ecx = px + (ax + .5) * cs, ecy = py + (ay + .5) * cs;
    const blink = now < b.blinkEnd || ice > 0;
    for (const s of [-1, 1]) {
      const ex = ecx + s * cs * .155;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, ecy, cs * .1, blink ? cs * .022 : cs * .118, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#1d1640';
        ctx.beginPath();
        ctx.arc(ex + lx * cs * .04, ecy + ly * cs * .05, cs * .058, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + lx * cs * .04 - cs * .02, ecy + ly * cs * .05 - cs * .022, cs * .018, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ice cover with a countdown
    if (ice > 0) {
      ctx.fillStyle = 'rgba(222,244,255,.66)';
      shapePath(b.cells, px, py, ins, r); ctx.fill();
      ctx.strokeStyle = 'rgba(150,210,245,.95)';
      ctx.lineWidth = Math.max(2, cs * .045);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = Math.max(1.5, cs * .035);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [cx, cy] of b.cells) {
        const X = px + cx * cs, Y = py + cy * cs;
        ctx.moveTo(X + cs * .18, Y + cs * .66); ctx.lineTo(X + cs * .36, Y + cs * .84);
        ctx.moveTo(X + cs * .64, Y + cs * .16); ctx.lineTo(X + cs * .84, Y + cs * .36);
      }
      ctx.stroke();
      const nx = ecx, ny = ecy;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(nx, ny, cs * .25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7cc8f0'; ctx.lineWidth = Math.max(2, cs * .04); ctx.stroke();
      ctx.fillStyle = '#1e6fa8';
      ctx.font = `800 ${Math.round(cs * .34)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(ice), nx, ny + cs * .02);
    }
  }

  function drawObstacle(x, y) {
    const X = ox + x * cs, Y = oy + y * cs, ins = cs * .05, d = cs * .09;
    fillRR(X + ins, Y + ins + d, cs - 2 * ins, cs - 2 * ins, cs * .16, '#3b3963');
    fillRR(X + ins, Y + ins, cs - 2 * ins, cs - 2 * ins, cs * .16, '#7e7ca6');
    fillRR(X + cs * .16, Y + cs * .14, cs * .68, cs * .62, cs * .1, '#8f8db7');
    ctx.strokeStyle = 'rgba(40,38,80,.45)';
    ctx.lineWidth = Math.max(1.5, cs * .045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X + cs * .3, Y + cs * .3); ctx.lineTo(X + cs * .7, Y + cs * .66);
    ctx.moveTo(X + cs * .7, Y + cs * .3); ctx.lineTo(X + cs * .3, Y + cs * .66);
    ctx.stroke();
  }

  function gateRect(g) {
    const m = cs * .06;
    if (g.side === 'top') return [ox + g.start * cs + m, oy - wall, g.len * cs - 2 * m, wall];
    if (g.side === 'bottom') return [ox + g.start * cs + m, oy + bh, g.len * cs - 2 * m, wall];
    if (g.side === 'left') return [ox - wall, oy + g.start * cs + m, wall, g.len * cs - 2 * m];
    return [ox + bw, oy + g.start * cs + m, wall, g.len * cs - 2 * m];
  }

  const SIDE_DIR = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

  // Is the dragged block lined up with gate g, with nothing in the way out?
  function linedUp(g) {
    const b = drag.b, [dx, dy] = SIDE_DIR[g.side];
    return exitGate(L, grid, b, b.x, b.y, dx, dy) === g;
  }

  function drawGate(g) {
    const col = COLORS[g.color];
    const [x, y, w, h] = gateRect(g);
    // Same color: soft steady glow. Lined up and clear: pulse, ready to push in.
    const active = drag && drag.b.color === g.color;
    const ready = active && linedUp(g);
    const pulse = ready ? .5 + .5 * Math.sin(now * 9) : active ? .3 : 0;

    const gl = cs * (.16 + .1 * pulse);
    ctx.fillStyle = hexA(col.base, .22 + .25 * pulse);
    ctx.beginPath();
    if (g.side === 'top') rr(x, oy, w, gl, gl * .4);
    if (g.side === 'bottom') rr(x, oy + bh - gl, w, gl, gl * .4);
    if (g.side === 'left') rr(ox, y, gl, h, gl * .4);
    if (g.side === 'right') rr(ox + bw - gl, y, gl, h, gl * .4);
    ctx.fill();

    ctx.save();
    if (active) { ctx.shadowColor = col.base; ctx.shadowBlur = ready ? 10 + 14 * pulse : 7; }
    fillRR(x, y, w, h, wall * .32, col.base);
    ctx.restore();
    fillRR(x + 2, y + 2, w - 4, h - 4, wall * .26, hexA(col.light, .35));

    ctx.strokeStyle = col.dark;
    ctx.lineWidth = Math.max(2, cs * .06);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const s = wall * .26;
    const shift = ready ? Math.sin(now * 9) * s * .25 : 0;
    ctx.beginPath();
    for (let i = 0; i < g.len; i++) {
      if (g.side === 'top' || g.side === 'bottom') {
        const cx = ox + (g.start + i + .5) * cs, cy = y + h / 2;
        const d = g.side === 'top' ? -1 : 1, c2 = cy + d * shift;
        ctx.moveTo(cx - s * 1.3, c2 - d * s * .55); ctx.lineTo(cx, c2 + d * s * .55); ctx.lineTo(cx + s * 1.3, c2 - d * s * .55);
      } else {
        const cy = oy + (g.start + i + .5) * cs, cx = x + w / 2;
        const d = g.side === 'left' ? -1 : 1, c2 = cx + d * shift;
        ctx.moveTo(c2 - d * s * .55, cy - s * 1.3); ctx.lineTo(c2 + d * s * .55, cy); ctx.lineTo(c2 - d * s * .55, cy + s * 1.3);
      }
    }
    ctx.stroke();
  }

  function drawTexts() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    try { ctx.direction = 'rtl'; } catch (e) {}
    for (const t of texts) {
      const k = t.t / t.life;
      const a = k < .12 ? k / .12 : 1 - Math.max(0, (k - .6) / .4);
      const size = Math.max(20, cs * .52) * (k < .12 ? .7 + k / .12 * .3 : 1);
      const X = ox + t.x * cs, Y = oy + (t.y - k * .7) * cs;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `800 ${Math.round(size)}px ${FONT}`;
      ctx.lineWidth = size * .24;
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.str, X, Y);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.str, X, Y);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    if (!L) return;
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(now * 70) * shake * 14, 0);

    // frame
    const fx = ox - wall, fy = oy - wall, fw = bw + wall * 2, fh = bh + wall * 2, fr = wall * 1.1;
    fillRR(fx, fy + cs * .14, fw, fh, fr, 'rgba(20,10,60,.35)');
    fillRR(fx, fy + cs * .08, fw, fh, fr, '#231b63');
    fillRR(fx, fy, fw, fh, fr, '#3a2f8f');
    fillRR(fx + 3, fy + 3, fw - 6, fh - 6, fr * .85, '#33288a');

    // board + tiles
    fillRR(ox, oy, bw, bh, cs * .14, '#1b1452');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      fillRR(ox + x * cs + 2, oy + y * cs + 2, cs - 4, cs - 4, cs * .16, (x + y) % 2 ? '#241b62' : '#211959');
    }

    for (const g of L.gates) drawGate(g);
    for (const [x, y] of L.obstacles) drawObstacle(x, y);

    const order = blocks.slice().sort((a, b) => a.lift - b.lift || a.vy - b.vy);
    for (const b of order) drawBlock(b, b.vx, b.vy, b.lift, iceLeft(b));

    // exiting blocks slide into the gate and are clipped at the outer frame
    if (exiting.length) {
      ctx.save();
      ctx.beginPath(); rr(fx, fy, fw, fh, fr); ctx.clip();
      for (const e of exiting) {
        const t = e.t / EXIT_TIME, ease = t * t;
        drawBlock(e.b, e.sx + e.dx * e.dist * ease, e.sy + e.dy * e.dist * ease, 1 - t, 0);
      }
      ctx.restore();
    }

    for (const p of particles) {
      const a = clamp(p.life / p.max * 1.6, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const X = ox + p.x * cs, Y = oy + p.y * cs, s = p.size * cs;
      if (p.confetti) {
        ctx.save(); ctx.translate(X, Y); ctx.rotate(p.rot);
        ctx.fillRect(-s / 2, -s / 4, s, s / 2);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(X, Y, s * (.5 + a * .5), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    drawTexts();
    ctx.restore();
  }

  function frame(t) {
    const dt = Math.min(.05, (t - lastT) / 1000);
    lastT = t; now = t / 1000;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  renderSoundBtn();
  startLevel(levelNum);
  if (!load('introSeen', false)) openPanel('intro');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout).catch(() => {});
  requestAnimationFrame(frame);
})();

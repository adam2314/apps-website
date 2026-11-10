/* Boot: renderer, scene, systems and the frame loop. */
import * as THREE from 'three';
import { World } from './world.js';
import { Fx } from './fx.js';
import { ToolRig, HelperBot } from './tools3d.js';
import { makeDecalTextures } from './textures.js';
import { initWashMaterials, tickWashMaterials } from './washSurface.js';
import { CameraRig, Input } from './input.js';
import { Game, loadSettingsOnly } from './game.js';
import { UI } from './ui.js';
import { isTouchDevice } from './util.js';
import { setLang, getLang, t } from './i18n.js';

function pickQuality(setting) {
  const mobile = isTouchDevice() && Math.min(screen.width, screen.height) < 820;
  const level = setting === 'auto' ? (mobile ? 'medium' : 'high') : setting;
  return {
    level,
    shadows: level === 'high',
    dpr: level === 'high' ? 2 : level === 'medium' ? 1.5 : 1,
    aa: level !== 'low',
  };
}

function bootError(err) {
  console.error(err);
  const el = document.getElementById('boot-error');
  el.classList.remove('hidden');
  el.innerHTML = `<b>Shine Time couldn't start.</b><br>${String(err && err.message ? err.message : err)}<br><small>WebGL is required. Try another browser, or serve the folder over http:// (see README).</small>`;
  document.getElementById('loading').classList.add('hidden');
}

async function start() {
  const settings = loadSettingsOnly();
  setLang(settings.lang);
  document.querySelector('#loading p').textContent = t('loading');
  // 3D signs are painted with the Hebrew font, so give it a moment to load (it is local and tiny).
  if (getLang() === 'he' && document.fonts) {
    await Promise.race([document.fonts.load('700 40px "Fredoka"', 'שְׁטִיפָה'), new Promise((r) => setTimeout(r, 2000))]).catch(() => {});
  }
  const quality = pickQuality(settings.quality);
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.aa, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  const world = new World(scene, renderer, quality);
  const fx = new Fx(scene);
  fx.onFloorWater = (x, z, amount) => world.addWater(amount);
  const tools = new ToolRig(scene);
  const bot = new HelperBot(scene);
  initWashMaterials(makeDecalTextures());
  const camRig = new CameraRig(camera);

  const game = new Game({ scene, world, fx, tools, bot, camRig, camera, renderer });
  const ui = new UI(game);
  game.ui = ui;
  const input = new Input(canvas, game, camRig);
  game.input = input;

  const hudInsets = () => {
    const hud = document.getElementById('hud');
    if (hud.classList.contains('hidden')) return { top: 0, bottom: 0 };
    const tb = document.getElementById('toolbar').getBoundingClientRect();
    const sb = document.getElementById('step-banner').getBoundingClientRect();
    const top = Math.max(0, sb.bottom);
    const bottom = Math.max(0, window.innerHeight - tb.top);
    return { top: Math.min(top, window.innerHeight * 0.32), bottom: Math.min(bottom, window.innerHeight * 0.25) };
  };

  let lastW = 0, lastH = 0, lastInsets = '';
  function resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    const ins = hudInsets();
    const key = `${ins.top | 0},${ins.bottom | 0}`;
    if (!force && w === lastW && h === lastH && key === lastInsets) return;
    lastW = w; lastH = h; lastInsets = key;
    renderer.setSize(w, h, false);
    camRig.setViewport(w, h, ins.top, ins.bottom);
    fx.setScale(h * renderer.getPixelRatio(), camera.fov);
  }
  window.addEventListener('resize', () => resize(true));
  window.addEventListener('orientationchange', () => setTimeout(() => resize(true), 250));
  resize(true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (game.state === 'playing' || game.state === 'closing') && !ui.modalOpen()) ui.show('screen-pause');
  });

  let last = performance.now();
  let time = 0;
  let frames = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    time += dt;
    input.update();
    game.update(dt);
    camRig.update(dt);
    world.updateOcclusion(camera.position);
    world.update(dt);
    fx.update(dt);
    tickWashMaterials(time, game.hints);
    if ((frames++ & 15) === 0) resize(false);
    renderer.render(scene, camera);
    ui.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.getElementById('loading').classList.add('hidden');
  ui.showTitle();
  window.__shine = { game, camRig, renderer, scene, THREE };
}

start().catch(bootError);

// Not in a downloaded offline copy (window.__SHINE_OFFLINE__): it is one file and has no sw.js next to it.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/[?&]nosw\b/.test(location.search) && !window.__SHINE_OFFLINE__) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

/* DOM HUD and menus. */
import { ICONS, toolIcon } from './icons.js';
import { STEPS, TOOL_ORDER, UPGRADES, CONFIG, toolStats, toolUnlocked } from './data.js';
import { fmtMoney, fmtClock, clamp } from './util.js';
import { Sound } from './audio.js';
import {
  OFFLINE_FILE, buildOfflineHtml, saveFile, installState, promptInstall, onInstallChange, isOfflineCopy, isInstalledApp,
} from './offline.js';
import {
  t, applyStatic, getLang, toolLabel, stepName, stepHint, serviceName, upgradeName, upgradeDesc, upgradeNext,
  categoryName, rankName,
} from './i18n.js';

const $ = (id) => document.getElementById(id);
/** Write only when the value changes (the HUD updates every frame). */
function setText(id, v) {
  const el = $(id);
  if (el && el.textContent !== v) el.textContent = v;
}
function setWidth(id, pct) {
  const el = $(id);
  const v = `${pct.toFixed(1)}%`;
  if (el && el.style.width !== v) el.style.width = v;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MODALS = ['screen-title', 'screen-shop', 'screen-summary', 'screen-pause', 'screen-howto', 'screen-tutorial', 'screen-offline'];

function moodFace(m) {
  return m >= 0.8 ? '😄' : m >= 0.6 ? '🙂' : m >= 0.4 ? '😐' : m >= 0.2 ? '😕' : '😠';
}
function moodColor(m) {
  return m >= 0.6 ? '#51e4d1' : m >= 0.4 ? '#ffd166' : m >= 0.2 ? '#ff9f43' : '#ff6b6b';
}
function starsHtml(n, max = 5) {
  let s = '';
  for (let i = 1; i <= max; i++) s += `<span class="st ${i <= Math.round(n) ? 'on' : ''}">${ICONS.starSmall}</span>`;
  return s;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.timer = 0;
    this.toastLast = {};
    this.offlineBuild = null;
    applyStatic(document);
    this.fillIcons(document);
    this._bind();
    this.buildToolbar();
    this.refreshSettings();
  }

  fillIcons(root) {
    root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon] || ''; });
  }

  /* ---------- screens ---------- */
  show(id) { $(id).classList.remove('hidden'); this._syncPause(); }
  hide(id) { $(id).classList.add('hidden'); this._syncPause(); }
  isOpen(id) { return !$(id).classList.contains('hidden'); }
  modalOpen() { return MODALS.some((m) => this.isOpen(m)); }

  _syncPause() {
    const g = this.g;
    const blocking = ['screen-shop', 'screen-pause', 'screen-howto', 'screen-tutorial'].some((m) => this.isOpen(m));
    if (g.state === 'playing' || g.state === 'closing') g.paused = blocking;
  }

  showTitle() {
    const g = this.g;
    $('hud').classList.add('hidden');
    const cont = $('btn-continue');
    if (g.hasSave && (g.save.day > 1 || g.save.lifetime > 0)) {
      cont.classList.remove('hidden');
      cont.textContent = t('title.continueDay', { n: g.save.day });
    } else cont.classList.add('hidden');
    $('btn-new').classList.toggle('primary', cont.classList.contains('hidden'));
    // Already an installed app or a downloaded copy: nothing left to install.
    $('btn-install').classList.toggle('hidden', isOfflineCopy() || isInstalledApp());
    this.show('screen-title');
  }

  /* ---------- install offline copy ---------- */
  openOffline() {
    const s = installState();
    const phone = s.ios || s.android;
    $('off-app').classList.toggle('hidden', !s.canPrompt);
    // On the Wi-Fi (http) address: install from the https website instead, progress included.
    $('off-site').classList.toggle('hidden', !s.site);
    if (s.site) $('off-site').href = s.site;
    let tip = '';
    if (s.site) tip = s.ios ? 'off.siteIos' : 'off.site';
    else if (!s.canPrompt) tip = !s.secure ? (phone ? 'off.phoneHttp' : 'off.http') : (s.ios ? 'off.ios' : 'off.menu');
    $('off-tip').textContent = tip ? t(tip) : '';
    $('off-tip').classList.toggle('hidden', !tip);
    // Phones open a downloaded .html file in a viewer that can't keep progress (or, on iPhone, run it at all).
    $('off-download').classList.toggle('hidden', phone);
    $('off-note').classList.toggle('hidden', phone);
    $('off-status').textContent = '';
    // Start building now so the download is instant when the button is pressed.
    if (!phone) this.offlineBuild = buildOfflineHtml();
    this.offlineBuild?.catch(() => {});
    this.show('screen-offline');
  }

  closeOffline() {
    this.offlineBuild = null;
    this.hide('screen-offline');
  }

  async downloadOffline() {
    const btn = $('off-download');
    btn.disabled = true;
    $('off-status').textContent = t('off.working');
    try {
      const html = await (this.offlineBuild || (this.offlineBuild = buildOfflineHtml()));
      saveFile(html, OFFLINE_FILE);
      $('off-status').textContent = t('off.done', { file: OFFLINE_FILE });
    } catch (err) {
      console.error(err);
      this.offlineBuild = null;
      $('off-status').textContent = t('off.fail');
    }
    btn.disabled = false;
  }

  handleEscape() {
    if (this.isOpen('screen-offline')) return this.closeOffline();
    if (this.isOpen('screen-howto')) return this.hide('screen-howto');
    if (this.isOpen('screen-tutorial')) return this._closeTutorial();
    if (this.isOpen('screen-shop')) return this.closeShop();
    if (this.isOpen('screen-pause')) return this.hide('screen-pause');
    const st = this.g.state;
    if (st === 'playing' || st === 'closing') this.show('screen-pause');
  }

  handleEnter() {
    if (this.isOpen('screen-tutorial')) return this._closeTutorial();
    if (this.isOpen('screen-summary') && !this.isOpen('screen-shop')) return this._nextDay();
  }

  toggleSound() {
    const s = this.g.save.settings;
    s.sound = !s.sound;
    Sound.unlock();
    Sound.setEnabled(s.sound);
    this.g.persist();
    this.refreshSettings();
  }

  refreshSettings() {
    const s = this.g.save.settings;
    $('btn-sound').innerHTML = s.sound ? ICONS.soundOn : ICONS.soundOff;
    $('set-sound').checked = s.sound;
    $('set-sound-title').checked = s.sound;
    $('set-vibrate').checked = s.vibrate;
    $('set-quality').value = s.quality;
    $('set-quality-title').value = s.quality;
    document.querySelectorAll('.lang-btn').forEach((b) => {
      const on = b.dataset.lang === getLang();
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  _bind() {
    const g = this.g;
    const click = (id, fn) => $(id).addEventListener('click', (e) => { Sound.unlock(); Sound.click(); fn(e); });
    click('btn-continue', () => { this.hide('screen-title'); g.startDay(); });
    click('btn-new', () => {
      if (g.hasSave && (g.save.day > 1 || g.save.lifetime > 0) && !confirm(t('confirm.new'))) return;
      this.hide('screen-title');
      g.newGame();
    });
    click('btn-howto', () => this.show('screen-howto'));
    click('howto-close', () => this.hide('screen-howto'));
    click('btn-shop', () => this.openShop());
    click('shop-close', () => this.closeShop());
    click('btn-pause', () => this.show('screen-pause'));
    click('pause-resume', () => this.hide('screen-pause'));
    click('pause-shop', () => this.openShop());
    click('pause-howto', () => this.show('screen-howto'));
    click('pause-quit', () => {
      g.persist();
      location.reload();
    });
    click('btn-sound', () => this.toggleSound());
    click('btn-full', () => this.toggleFullscreen());
    click('sum-shop', () => this.openShop());
    click('sum-next', () => this._nextDay());
    click('tut-ok', () => this._closeTutorial());
    click('cam-left', () => g.camRig.snap(-Math.PI / 4));
    click('cam-right', () => g.camRig.snap(Math.PI / 4));
    click('cam-top', () => { g.camRig.phi = g.camRig.phi > 0.8 ? 0.3 : 1.15; });
    click('btn-install', () => this.openOffline());
    click('off-close', () => this.closeOffline());
    click('off-download', () => this.downloadOffline());
    click('off-app', async () => {
      if (await promptInstall()) {
        $('off-app').classList.add('hidden');
        $('off-status').textContent = t('off.installed');
      }
    });
    onInstallChange(() => { if (this.isOpen('screen-offline')) $('off-app').classList.toggle('hidden', !installState().canPrompt); });
    // Language: the 3D signs are painted at startup, so switching reloads (only offered on the title screen).
    document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.lang === getLang()) return;
      Sound.click();
      g.save.settings.lang = b.dataset.lang;
      g.persist();
      location.reload();
    }));
    const setSound = (e) => { g.save.settings.sound = e.target.checked; Sound.unlock(); Sound.setEnabled(e.target.checked); g.persist(); this.refreshSettings(); };
    $('set-sound').addEventListener('change', setSound);
    $('set-sound-title').addEventListener('change', setSound);
    $('set-vibrate').addEventListener('change', (e) => { g.save.settings.vibrate = e.target.checked; g.persist(); });
    const setQ = (reload) => (e) => {
      g.save.settings.quality = e.target.value;
      g.persist();
      this.refreshSettings();
      if (reload) location.reload();
    };
    $('set-quality').addEventListener('change', setQ(false));
    $('set-quality-title').addEventListener('change', setQ(true));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey) {
        if (this.isOpen('screen-shop')) this.closeShop();
        else if (['playing', 'closing', 'summary'].includes(g.state)) this.openShop();
      }
    });
    click('pause-full', () => this.toggleFullscreen());
    const canFull = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (!canFull) { $('btn-full').classList.add('hidden'); $('pause-full').classList.add('hidden'); }
  }

  toggleFullscreen() {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else {
      const el = d.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        Promise.resolve(req.call(el, { navigationUI: 'hide' })).then(() => {
          if (screen.orientation && screen.orientation.lock && innerWidth < 900) screen.orientation.lock('landscape').catch(() => {});
        }).catch(() => {});
      }
    }
  }

  _closeTutorial() {
    this.g.save.tutorialDone = true;
    this.g.persist();
    this.hide('screen-tutorial');
  }

  _nextDay() {
    this.hide('screen-summary');
    this.hide('screen-shop');
    this.g.startDay();
  }

  /* ---------- game hooks ---------- */
  onDayStart() {
    $('hud').classList.remove('hidden');
    this.buildToolbar();
    this.onQueueChanged();
    this.onBayChanged();
    this.updateHud(true);
    this.toast(t('toast.dayOpen', { n: this.g.save.day }), 'info');
  }

  showTutorial() { this.show('screen-tutorial'); }

  onToolChanged() { this._toolbarState(); }

  buildToolbar() {
    const g = this.g;
    const bar = $('toolbar');
    bar.innerHTML = '';
    TOOL_ORDER.forEach((id, i) => {
      if (!toolUnlocked(id, g.up)) return;
      const stats = toolStats(id, g.up);
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.tool = id;
      b.innerHTML = `<span class="tool-ico">${toolIcon(id, stats)}</span><span class="tool-name">${esc(toolLabel(id, g.up))}</span><kbd>${i + 1}</kbd>`;
      b.addEventListener('click', () => { Sound.unlock(); g.selectTool(id); });
      bar.appendChild(b);
    });
    this._toolbarState();
  }

  _toolbarState() {
    const g = this.g;
    const step = g.currentStep();
    $('toolbar').querySelectorAll('.tool').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === g.tool);
      b.classList.toggle('needed', !!step && b.dataset.tool === step.tool && g.tool !== step.tool);
      b.setAttribute('aria-pressed', b.dataset.tool === g.tool ? 'true' : 'false');
    });
  }

  pulseTool(id) {
    const b = $('toolbar').querySelector(`[data-tool="${id}"]`);
    if (!b) return;
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  }

  onQueueChanged() {
    const q = $('queue');
    q.innerHTML = '';
    for (const c of this.g.queue) {
      const el = document.createElement('div');
      el.className = 'qcard' + (c.vip ? ' vip' : '');
      el.dataset.id = c.id;
      el.innerHTML = `<img src="${c.thumb}" alt=""><div class="qinfo"><b>${esc(c.name)}</b><span style="color:${c.svc.color}">${esc(serviceName(c.svc))}</span></div>
        <span class="qface">${moodFace(c.mood)}</span><div class="qbar"><i></i></div>`;
      q.appendChild(el);
    }
    const free = CONFIG.queueMax - this.g.queue.length;
    if (this.g.queue.length) {
      const tag = document.createElement('div');
      tag.className = 'qtag';
      tag.textContent = free > 0 ? t('q.waiting', { n: this.g.queue.length }) : t('q.full');
      q.prepend(tag);
    }
  }

  onBayChanged() {
    const g = this.g;
    const job = $('job');
    const b = g.bay;
    if (!b) {
      job.innerHTML = `<div class="job-empty">${ICONS.car}<span>${g.state === 'closing' ? t('job.closing') : t('job.free')}</span></div>`;
    } else {
      const c = b.cust;
      const steps = c.svc.steps.map((id, i) => {
        const st = STEPS[id];
        const cls = b.state !== 'wash' && b.state !== 'enter' ? 'done' : i < b.stepIdx ? 'done' : i === b.stepIdx && b.state === 'wash' ? 'now' : '';
        const name = esc(stepName(st));
        return `<li class="${cls}" title="${name}"><span>${toolIcon(st.tool, toolStats(st.tool, g.up))}</span><em>${name}</em></li>`;
      }).join('');
      job.innerHTML = `
        <div class="job-head">
          <img src="${c.thumb}" alt="">
          <div class="job-who"><b>${esc(c.name)}${c.vip ? ` <i class="vip-badge">${t('badge.vip')}</i>` : ''}${c.muddy ? ` <i class="mud-badge">${t('badge.mud')}</i>` : ''}</b>
          <span style="color:${c.svc.color}">${esc(serviceName(c.svc))}</span></div>
          <div class="job-price">${fmtMoney(c.price)}</div>
        </div>
        <div class="mood"><span class="mface" id="job-face">${moodFace(c.mood)}</span><div class="mbar"><i id="job-mood"></i></div></div>
        <ol class="steps">${steps}</ol>`;
    }
    this._toolbarState();
    this._stepBanner();
  }

  stepDone(step) {
    this.toast(t('toast.stepDone', { step: stepName(step) }), 'good', 900);
  }

  showPayout(p) {
    const el = $('payout');
    const parts = [t('pay.service', { m: fmtMoney(p.price) })];
    if (p.tip) parts.push(t('pay.tip', { m: fmtMoney(p.tip) }));
    if (p.snack) parts.push(t('pay.snacks', { m: fmtMoney(p.snack) }));
    const streak = p.streak >= 2 ? t('pay.streak', { n: p.streak, m: (1 + 0.1 * Math.min(p.streak, 10)).toFixed(1) }) : '';
    el.innerHTML = `<div class="pay-stars">${starsHtml(p.stars)}</div>
      <div class="pay-say">“${esc(p.say)}”<span> · ${esc(p.name)}</span></div>
      <div class="pay-total">+${fmtMoney(p.price + p.tip + p.snack)}</div>
      <div class="pay-break">${esc(parts.join(' · '))}</div>
      ${streak ? `<div class="pay-streak">${esc(streak)}</div>` : ''}`;
    el.classList.remove('hidden', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(this.payTimer);
    this.payTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  toast(msg, kind = 'info', ms = 2400) {
    const now = performance.now();
    if (this.toastLast[msg] && now - this.toastLast[msg] < 1500) return;
    this.toastLast[msg] = now;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }

  /* ---------- shop ---------- */
  openShop() {
    this.renderShop();
    this.show('screen-shop');
  }

  closeShop() {
    this.hide('screen-shop');
    this.buildToolbar();
    this.onBayChanged();
    this.updateHud(true);
  }

  renderShop() {
    const g = this.g;
    $('shop-money').textContent = fmtMoney(g.money);
    const body = $('shop-body');
    body.innerHTML = '';
    const cats = [...new Set(UPGRADES.map((u) => u.cat))];
    for (const cat of cats) {
      const sec = document.createElement('section');
      sec.innerHTML = `<h3>${esc(categoryName(cat))}</h3><div class="shop-grid"></div>`;
      const grid = sec.querySelector('.shop-grid');
      for (const u of UPGRADES.filter((x) => x.cat === cat)) {
        const st = g.upgradeState(u);
        const card = document.createElement('div');
        card.className = 'ucard' + (st.cost === null ? ' maxed' : '') + (st.locked ? ' locked' : '');
        let pips = '';
        for (let i = 0; i < st.max; i++) pips += `<i class="${i < st.lvl ? 'on' : ''}"></i>`;
        const req = st.locked ? upgradeName(UPGRADES.find((x) => x.id === u.requires)) : '';
        card.innerHTML = `<div class="u-ico">${ICONS[u.icon] || ''}</div>
          <div class="u-main"><b>${esc(upgradeName(u))}</b><div class="pips">${pips}</div>
          <p>${esc(st.cost === null ? upgradeDesc(u) : upgradeNext(u, st.lvl, fmtMoney))}</p></div>
          <button class="btn buy ${st.affordable && !st.locked ? 'primary' : ''}" ${st.cost === null || st.locked || !st.affordable ? 'disabled' : ''}>
            ${st.cost === null ? t('shop.maxed') : st.locked ? esc(t('shop.needs', { x: req })) : fmtMoney(st.cost)}</button>`;
        card.querySelector('button').addEventListener('click', () => {
          if (g.buy(u.id)) {
            this.toast(t('toast.upgraded', { name: upgradeName(u) }), 'good', 1500);
            this.renderShop();
            this.updateHud(true);
          }
        });
        grid.appendChild(card);
      }
      body.appendChild(sec);
    }
  }

  /* ---------- summary ---------- */
  showSummary(s) {
    const g = this.g;
    $('sum-title').textContent = t('sum.title', { n: s.day });
    $('sum-stars').innerHTML = s.stars.length
      ? `${starsHtml(s.avgStars)}<span>${esc(t('sum.avg', { n: s.avgStars.toFixed(1) }))}</span>`
      : `<span>${esc(t('sum.none'))}</span>`;
    const row = (k, v, cls = '') => `<div class="sr ${cls}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
    $('sum-grid').innerHTML = [
      row(t('sum.washed'), s.washed),
      row(t('sum.lost'), s.lost, s.lost ? 'bad' : ''),
      row(t('sum.missed'), s.missed, s.missed ? 'bad' : ''),
      row(t('sum.revenue'), fmtMoney(s.revenue)),
      row(t('sum.tips'), fmtMoney(s.tips)),
      s.snacks ? row(t('sum.snacks'), fmtMoney(s.snacks)) : '',
      row(t('sum.goal', { m: fmtMoney(s.goal) }), s.goalMet ? t('sum.bonus', { m: fmtMoney(s.bonus) }) : t('sum.missedGoal'), s.goalMet ? 'good' : 'bad'),
      row(t('sum.supplies'), fmtMoney(-s.supplies), 'bad'),
      row(t('sum.net'), fmtMoney(s.net), 'total'),
    ].join('');
    const nr = g.nextRank;
    const prevAt = g.rank.at;
    const pct = nr ? clamp((g.save.lifetime - prevAt) / (nr.at - prevAt), 0, 1) * 100 : 100;
    $('sum-rank').innerHTML = `<div class="rank-line"><span>${esc(t('sum.rank'))}</span><b>${esc(rankName(g.rank))}</b></div>
      <div class="rank-bar"><i style="width:${pct.toFixed(0)}%"></i></div>
      <div class="rank-next">${nr ? t('sum.toNext', { m: esc(fmtMoney(nr.at - g.save.lifetime)), rank: esc(rankName(nr)) }) : esc(t('sum.top'))}</div>`;
    $('sum-next').textContent = t('sum.next', { n: g.save.day });
    $('hud').classList.add('hidden');
    this.show('screen-summary');
  }

  /* ---------- per-frame ---------- */
  _stepBanner() {
    const g = this.g;
    const b = g.bay;
    const banner = $('step-banner');
    let count = '', name = '', hint = '', prog = 0;
    if (!b) {
      name = g.state === 'closing' ? t('ban.closing') : t('ban.waiting');
      hint = g.queue.length ? t('ban.next') : t('ban.ads');
      banner.classList.add('idle');
    } else if (b.state === 'enter') {
      name = t('ban.enter', { name: b.cust.name });
      hint = serviceName(b.cust.svc);
      banner.classList.add('idle');
    } else if (b.state === 'wash') {
      const step = g.currentStep();
      count = t('ban.step', { i: b.stepIdx + 1, n: b.cust.svc.steps.length });
      name = stepName(step);
      hint = `${stepHint(step)} · ${toolLabel(step.tool, g.up)}`;
      prog = b.progress || 0;
      banner.classList.remove('idle');
    } else {
      name = t('ban.clean');
      hint = t('ban.nextCust');
      prog = 1;
      banner.classList.add('idle');
    }
    setText('step-count', count);
    setText('step-name', name);
    setText('step-hint', hint);
    setWidth('step-fill', clamp(prog / CONFIG.stepDone, 0, 1) * 100);
  }

  updateHud(force) {
    const g = this.g;
    if (g.state !== 'playing' && g.state !== 'closing' && !force) return;
    setText('hud-money', fmtMoney(g.money));
    setText('hud-day', t('hud.day', { n: g.save.day }));
    const clock = g.clock || CONFIG.dayStart;
    setText('hud-time', fmtClock(Math.min(clock, CONFIG.dayEnd)));
    setWidth('hud-daybar', clamp((clock - CONFIG.dayStart) / (CONFIG.dayEnd - CONFIG.dayStart), 0, 1) * 100);
    setText('hud-rep', g.rep.toFixed(1));
    const rev = g.dayStats ? g.dayStats.revenue : 0;
    setText('hud-goal', `${fmtMoney(rev)}/${fmtMoney(g.dayGoal)}`);
    $('hud-goal').parentElement.classList.toggle('met', rev >= g.dayGoal);
  }

  update(dt) {
    const g = this.g;
    if (g.state !== 'playing' && g.state !== 'closing') return;
    this._stepBanner();
    this.timer -= dt;
    $('side-hint').classList.toggle('hidden', !g.sideHint);
    if (this.timer <= 0) {
      this.timer = 0.2;
      if (g.bay) {
        const m = $('job-mood');
        if (m) {
          m.style.width = `${(clamp(g.bay.cust.mood, 0, 1) * 100).toFixed(1)}%`;
          m.style.background = moodColor(g.bay.cust.mood);
        }
      }
      for (const el of $('queue').querySelectorAll('.qcard')) {
        const c = g.queue.find((q) => String(q.id) === el.dataset.id);
        if (!c) continue;
        const bar = el.querySelector('.qbar i');
        bar.style.width = `${(clamp(c.mood, 0, 1) * 100).toFixed(1)}%`;
        bar.style.background = moodColor(c.mood);
      }
      this.updateHud();
      const face = $('job-face');
      if (face && g.bay) face.textContent = moodFace(g.bay.cust.mood);
      for (const el of $('queue').querySelectorAll('.qcard')) {
        const c = g.queue.find((q) => String(q.id) === el.dataset.id);
        if (c) el.querySelector('.qface').textContent = moodFace(c.mood);
      }
      this._toolbarState();
    }
  }
}

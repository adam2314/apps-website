/* Play without internet:
   - the browser's "install as app" prompt where it is offered (https or localhost), backed by sw.js;
   - a download of the whole game as ONE html file (styles, scripts, font and the player's progress)
     that runs straight from disk, with no server or internet.
   Not included in that downloaded copy. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FILE = 'Blockout-offline.html';
  const SAVE_PREFIX = 'blockout.';
  // The https copy of the game (GitHub Pages). Phones can only install the app from https, so the Wi-Fi
  // (http://192.168…) version sends them here, with their progress in the link. '' = no website.
  const SITE_URL = 'https://adam2314.github.io/apps-website/blockout/';
  const HANDOFF = '#progress=';

  const T = {
    ios: 'בְּאַייפוֹן אוֹ בְּאַייפֶּד: לוֹחֲצִים עַל "שִׁתּוּף" וּבוֹחֲרִים "הוֹסָפָה לְמָסַךְ הַבַּיִת".',
    phoneHttp: 'בַּטֶּלֶפוֹן וּבַטַּאבְּלֶט אֶפְשָׁר לְהַתְקִין רַק מִכְּתֹבֶת מְאֻבְטַחַת (https).',
    site: 'פּוֹתְחִים אֶת הָאֲתָר שֶׁל הַמִּשְׂחָק וְלוֹחֲצִים שָׁם "הַתְקָנָה". הַשְּׁלַבִּים וְהַכּוֹכָבִים שֶׁלָּכֶם עוֹבְרִים אִתְּכֶם.',
    siteIos: 'פּוֹתְחִים אֶת הָאֲתָר שֶׁל הַמִּשְׂחָק בְּסָפָארִי, לוֹחֲצִים עַל "שִׁתּוּף" וּבוֹחֲרִים "הוֹסָפָה לְמָסַךְ הַבַּיִת". הַשְּׁלַבִּים וְהַכּוֹכָבִים שֶׁלָּכֶם עוֹבְרִים אִתְּכֶם.',
    menu: 'כְּדֵי לְהַתְקִין כְּאַפְּלִיקַצְיָה: פּוֹתְחִים אֶת הַתַּפְרִיט שֶׁל הַדַּפְדְּפָן וּבוֹחֲרִים "הַתְקָנָה" אוֹ "הוֹסָפָה לְמָסַךְ הַבַּיִת".',
    http: 'מֵהַכְּתֹבֶת הַזֹּאת אִי אֶפְשָׁר לְהַתְקִין אַפְּלִיקַצְיָה, אֲבָל אֶפְשָׁר לְהוֹרִיד אֶת כָּל הַמִּשְׂחָק לְקֹבֶץ אֶחָד.',
    working: 'מְכִינִים אֶת הַקֹּבֶץ…',
    done: 'הַקֹּבֶץ נִשְׁמַר! מְחַפְּשִׂים אֶת ' + FILE + ' בַּהוֹרָדוֹת.',
    fail: 'לֹא הִצְלַחְנוּ לְהָכִין אֶת הַקֹּבֶץ. נַסּוּ שׁוּב.',
    installed: 'הַמִּשְׂחָק הֻתְקַן! מְחַפְּשִׂים אוֹתוֹ בֵּין הָאַפְּלִיקַצְיוֹת.',
  };

  // ---------- progress handed over in the link ----------
  // This script loads before game.js, so the game starts with the imported progress.
  // Keeps whichever progress is further along (highest unlocked level).
  const readMax = get => { try { return Number(JSON.parse(get('max'))) || 0; } catch (e) { return 0; } };
  if (location.hash.startsWith(HANDOFF)) {
    try {
      const incoming = JSON.parse(decodeURIComponent(location.hash.slice(HANDOFF.length)));
      const keys = Object.keys(incoming).filter(k => k.startsWith(SAVE_PREFIX) && typeof incoming[k] === 'string');
      const inMax = readMax(k => incoming[SAVE_PREFIX + k]);
      const curMax = readMax(k => localStorage.getItem(SAVE_PREFIX + k));
      if (keys.length && (inMax > curMax || (!curMax && localStorage.getItem(SAVE_PREFIX + 'level') === null))) {
        for (const k of keys) localStorage.setItem(k, incoming[k]);
      }
    } catch (e) { /* bad link: ignore it */ }
    history.replaceState(null, '', location.pathname + location.search);
  }
  function progress() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SAVE_PREFIX)) out[k] = localStorage.getItem(k);
      }
    } catch (e) { /* storage blocked */ }
    return out;
  }
  function siteLink() {
    const p = progress();
    return Object.keys(p).length ? SITE_URL + HANDOFF + encodeURIComponent(JSON.stringify(p)) : SITE_URL;
  }

  // ---------- install as app ----------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  let promptEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptEvt = e; if (isOpen()) render(); });
  window.addEventListener('appinstalled', () => { promptEvt = null; if (isOpen()) render(); });

  const installed = () => navigator.standalone === true
    || ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(m => matchMedia(`(display-mode: ${m})`).matches);
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const phone = ios || /Android/i.test(navigator.userAgent);

  // ---------- the panel ----------
  const ov = $('install');
  const isOpen = () => ov.classList.contains('show');
  let build = null;

  function render() {
    $('inApp').hidden = !promptEvt;
    // On the Wi-Fi (http) address: install from the https website instead, progress included.
    const site = !window.isSecureContext && SITE_URL ? siteLink() : '';
    $('inSite').hidden = !site;
    if (site) $('inSite').href = site;
    let tip = '';
    if (site) tip = ios ? T.siteIos : T.site;
    else if (!promptEvt) tip = !window.isSecureContext ? (phone ? T.phoneHttp : T.http) : (ios ? T.ios : T.menu);
    $('inTip').textContent = tip;
    $('inTip').hidden = !tip;
    // Phones open a downloaded .html file in a viewer that can't keep progress (or, on iPhone, run it at all).
    $('inDownload').hidden = phone;
    $('inNote').hidden = phone;
  }
  function open() {
    render();
    $('inStatus').textContent = '';
    if (!phone) { build = buildOfflineHtml(); build.catch(() => {}); } // ready by the time the button is pressed
    ov.classList.add('show');
  }
  function close() { ov.classList.remove('show'); build = null; }

  // A plain file:// page can't read its own files, so there is nothing to build there.
  $('installBtn').hidden = installed() || location.protocol === 'file:';
  $('installBtn').onclick = open;
  $('inClose').onclick = close;
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) { close(); e.stopImmediatePropagation(); }
  }, true);

  $('inApp').onclick = async () => {
    const e = promptEvt;
    if (!e) return;
    promptEvt = null;
    e.prompt();
    const choice = await e.userChoice.catch(() => null);
    render();
    if (choice && choice.outcome === 'accepted') $('inStatus').textContent = T.installed;
  };

  $('inDownload').onclick = async () => {
    const btn = $('inDownload');
    btn.disabled = true;
    $('inStatus').textContent = T.working;
    try {
      saveFile(await (build || (build = buildOfflineHtml())), FILE);
      $('inStatus').textContent = T.done;
    } catch (err) {
      console.error(err);
      build = null;
      $('inStatus').textContent = T.fail;
    }
    btn.disabled = false;
  };

  // ---------- single-file copy ----------
  async function get(url, as) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return as === 'blob' ? res.blob() : res.text();
  }
  const toDataUrl = blob => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  const scriptJson = v => JSON.stringify(v).replace(/</g, '\\u003c');

  // Rubik from Google Fonts, Hebrew and Latin only. Without internet the copy falls back to the system font.
  async function inlineWebFont(doc, link, base) {
    try {
      const cssUrl = new URL(link.getAttribute('href'), base);
      let css = await get(cssUrl);
      const faces = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
        .filter(m => m[1] === 'hebrew' || m[1] === 'latin').map(m => m[2]);
      if (faces.length) css = faces.join('\n');
      const refs = [...new Set([...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(m => m[1]))];
      for (const ref of refs) css = css.split(ref).join(await toDataUrl(await get(new URL(ref, cssUrl), 'blob')));
      const style = doc.createElement('style');
      style.textContent = css;
      link.replaceWith(style);
      doc.querySelectorAll('link[rel="preconnect"]').forEach(el => el.remove());
    } catch (e) { /* keep the link: it still works whenever there is internet */ }
  }

  async function buildOfflineHtml() {
    const base = new URL('./', location.href);
    const doc = new DOMParser().parseFromString(await get(new URL('index.html', base)), 'text/html');

    doc.querySelectorAll('[data-online-only], link[rel="manifest"], link[rel="apple-touch-icon"]').forEach(el => el.remove());

    for (const link of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
      const url = new URL(link.getAttribute('href'), base);
      if (url.origin !== base.origin) { await inlineWebFont(doc, link, base); continue; }
      const style = doc.createElement('style');
      style.textContent = await get(url);
      link.replaceWith(style);
    }
    for (const s of doc.querySelectorAll('script[src]')) {
      const url = new URL(s.getAttribute('src'), base);
      if (url.origin !== base.origin) continue;
      const el = doc.createElement('script');
      el.textContent = (await get(url)).replace(/<\/(script)/gi, '<\\/$1');
      s.replaceWith(el);
    }

    // Bring the levels and stars along (only used if that browser has no progress yet).
    const saves = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SAVE_PREFIX)) saves[k] = localStorage.getItem(k);
      }
    } catch (e) { /* storage blocked */ }
    const seed = doc.createElement('script');
    seed.textContent = `(function(s){try{for(var k in s)if(localStorage.getItem(k)===null)localStorage.setItem(k,s[k]);}catch(e){}})(${scriptJson(saves)});`;
    // After <meta charset>, which has to stay within the first 1024 bytes.
    const charset = doc.querySelector('meta[charset]');
    if (charset) charset.after(seed); else doc.head.prepend(seed);
    seed.before(doc.createComment(` קוביות צבעוניות: offline copy, saved ${new Date().toISOString().slice(0, 10)}. Open this file in a browser to play. `));

    return `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
  }

  function saveFile(html, name) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name, rel: 'noopener' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
})();

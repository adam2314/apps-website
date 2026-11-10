/* "Install offline copy": the browser's install-as-app prompt where it is offered, and a download of the
 * whole game as ONE html file (code, three.js, fonts, current save) that runs from disk with no server or internet. */
import { CONFIG } from './data.js';

export const OFFLINE_FILE = 'ShineTime-offline.html';

/** The https copy of the game (GitHub Pages). Phones can only install the app from https, so the Wi-Fi
 *  (http://192.168…) version sends them here, with their progress in the link. '' = no website. */
export const SITE_URL = 'https://adam2314.github.io/apps-website/shine-time/';

/* ---------------------------------------------------------------- progress handed over in the link */

const HANDOFF = '#progress=';
const further = (a, b) => (a.lifetime || 0) > (b.lifetime || 0) || (a.day || 0) > (b.day || 0);

// Runs when this module loads, before the game reads its save. Keeps whichever save is further along.
(function importHandoff() {
  if (!location.hash.startsWith(HANDOFF)) return;
  try {
    const raw = JSON.parse(decodeURIComponent(location.hash.slice(HANDOFF.length)))[CONFIG.saveKey];
    const incoming = raw && JSON.parse(raw);
    if (incoming && incoming.v === 1) {
      let current = null;
      try { current = JSON.parse(localStorage.getItem(CONFIG.saveKey)); } catch (e) { /* none */ }
      if (!current || current.v !== 1 || further(incoming, current)) localStorage.setItem(CONFIG.saveKey, raw);
    }
  } catch (e) { /* bad link: ignore it */ }
  history.replaceState(null, '', location.pathname + location.search);
}());

/** The website link, carrying this device's progress. */
export function siteLink() {
  let save = null;
  try { save = localStorage.getItem(CONFIG.saveKey); } catch (e) { /* storage blocked */ }
  return save ? `${SITE_URL}${HANDOFF}${encodeURIComponent(JSON.stringify({ [CONFIG.saveKey]: save }))}` : SITE_URL;
}

/* ---------------------------------------------------------------- install-as-app (PWA) */

// Listen from the moment this module loads: Chrome fires the event early, often before the title screen exists.
let promptEvt = null;
const subs = new Set();
const notify = () => subs.forEach((f) => f());
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptEvt = e; notify(); });
window.addEventListener('appinstalled', () => { promptEvt = null; notify(); });

export const onInstallChange = (f) => subs.add(f);
export const isOfflineCopy = () => !!window.__SHINE_OFFLINE__ || location.protocol === 'file:';
export function isInstalledApp() {
  return navigator.standalone === true
    || ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => matchMedia(`(display-mode: ${m})`).matches);
}
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(navigator.userAgent);

/** What this browser can do right now. `secure` = https or localhost, which app installs need.
 *  `site` = the website link to install from instead (only when this address can't install). */
export function installState() {
  const secure = window.isSecureContext;
  return { canPrompt: !!promptEvt, secure, ios: isIOS(), android: isAndroid(), site: !secure && SITE_URL ? siteLink() : '' };
}

/** Shows the browser's own install dialog. Resolves true if the player accepted. */
export async function promptInstall() {
  const e = promptEvt;
  if (!e) return false;
  promptEvt = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  notify();
  return !!choice && choice.outcome === 'accepted';
}

/* ---------------------------------------------------------------- single-file offline copy */

// import/export ... from '<spec>', import '<spec>', import('<spec>')
const IMPORT_RE = /(\b(?:import|export)\s*(?:[\w*${}\s,]+?\s*from\s*)?|\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g;
const KEY = (rel) => `@shine/${rel}`; // bare specifiers: they resolve the same from data: URLs

async function get(url, as = 'text') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === 'blob' ? res.blob() : res.text();
}
const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});
const textDataUrl = (text, type) => toDataUrl(new Blob([text], { type }));
/** JSON that is safe inside a <script> element. */
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/**
 * Builds the offline copy from the files this page was loaded from (through the service worker cache when there
 * is one, so it also works while offline). Every module goes into the import map as a data: URL.
 */
export async function buildOfflineHtml() {
  const base = new URL('./', location.href);
  const doc = new DOMParser().parseFromString(await get(new URL('index.html', base)), 'text/html');
  const rel = (url) => url.href.slice(base.href.length);

  // Modules: walk the import graph from the entry script.
  const mapEl = doc.querySelector('script[type="importmap"]');
  const pageMap = mapEl ? JSON.parse(mapEl.textContent).imports || {} : {};
  const entryEl = doc.querySelector('script[type="module"][src]');
  const resolve = (spec, from) => (/^\.{0,2}\//.test(spec) ? new URL(spec, from) : pageMap[spec] ? new URL(pageMap[spec], base) : null);
  const imports = {};
  const queue = [new URL(entryEl.getAttribute('src'), base)];
  const seen = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const src = (await get(url)).replace(IMPORT_RE, (m, head, q, spec) => {
      const dep = resolve(spec, url);
      if (!dep || dep.origin !== base.origin) return m;
      queue.push(dep);
      return `${head}${q}${KEY(rel(dep))}${q}`;
    });
    imports[KEY(rel(url))] = await textDataUrl(src, 'text/javascript');
  }
  mapEl?.remove(); // every import, 'three' included, now points at an @shine/ key
  const newMap = doc.createElement('script');
  newMap.type = 'importmap';
  newMap.textContent = scriptJson({ imports });
  const boot = doc.createElement('script');
  boot.type = 'module';
  boot.textContent = `import ${JSON.stringify(KEY(rel(new URL(entryEl.getAttribute('src'), base))))};`;
  entryEl.replaceWith(boot);

  // Styles, with their fonts inlined.
  for (const link of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
    const cssUrl = new URL(link.getAttribute('href'), base);
    if (cssUrl.origin !== base.origin) continue;
    let css = await get(cssUrl);
    const refs = [...new Set([...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]))].filter((u) => !u.startsWith('data:'));
    for (const ref of refs) css = css.split(ref).join(await toDataUrl(await get(new URL(ref, cssUrl), 'blob')));
    const style = doc.createElement('style');
    style.textContent = css;
    link.replaceWith(style);
  }

  // Icon inline; manifest, preloads and app-only links don't apply to a file.
  const icon = doc.querySelector('link[rel="icon"][href]');
  if (icon) icon.setAttribute('href', await toDataUrl(await get(new URL(icon.getAttribute('href'), base), 'blob')));
  doc.querySelectorAll('link[rel="manifest"], link[rel="preload"], link[rel="apple-touch-icon"]').forEach((el) => el.remove());

  // Flag the copy and bring the current save along (only used if that browser has none yet).
  const saves = {};
  try {
    const v = localStorage.getItem(CONFIG.saveKey);
    if (v != null) saves[CONFIG.saveKey] = v;
  } catch (e) { /* storage blocked */ }
  const head = doc.createElement('script');
  head.textContent = `window.__SHINE_OFFLINE__=true;(function(s){try{for(var k in s)if(localStorage.getItem(k)===null)localStorage.setItem(k,s[k]);}catch(e){}})(${scriptJson(saves)});`;
  // After <meta charset>, which has to stay within the first 1024 bytes.
  const charset = doc.querySelector('meta[charset]');
  if (charset) charset.after(head); else doc.head.prepend(head);
  head.before(doc.createComment(` Shine Time offline copy, saved ${new Date().toISOString().slice(0, 10)}. Open this file in a browser to play. `));
  doc.head.append(newMap); // after every other head element, before any module script

  return `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
}

/** Hands the file to the browser's downloads. */
export function saveFile(html, name = OFFLINE_FILE) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name, rel: 'noopener' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

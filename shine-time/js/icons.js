/* Inline SVG icons for the HUD, toolbar and shop. */

const svg = (body, vb = '0 0 48 48') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  hose: svg(`<rect x="4" y="20" width="16" height="9" rx="3" fill="#ffb300"/><rect x="9" y="27" width="6" height="12" rx="2" fill="#37474f" transform="rotate(-12 12 33)"/>
    <rect x="19" y="22.5" width="15" height="4" rx="2" fill="#cfd8dc"/><circle cx="38" cy="18" r="2.4" fill="#4fc3f7"/><circle cx="42" cy="24.5" r="2.4" fill="#4fc3f7"/><circle cx="38" cy="31" r="2.4" fill="#4fc3f7"/><circle cx="44" cy="15" r="1.6" fill="#81d4fa"/><circle cx="44" cy="34" r="1.6" fill="#81d4fa"/>`),
  foam: svg(`<circle cx="18" cy="28" r="11" fill="#fff" stroke="#b3e5fc" stroke-width="2"/><circle cx="31" cy="20" r="8" fill="#fff" stroke="#f8bbd0" stroke-width="2"/><circle cx="33" cy="34" r="6.5" fill="#fff" stroke="#b3e5fc" stroke-width="2"/>
    <circle cx="14" cy="24" r="3" fill="#e1f5fe"/><circle cx="28" cy="17" r="2.2" fill="#fce4ec"/>`),
  sponge: svg(`<rect x="7" y="16" width="34" height="20" rx="6" fill="#ffd54f"/><rect x="7" y="12" width="34" height="8" rx="4" fill="#43a047"/>
    <circle cx="15" cy="27" r="2" fill="#f9a825"/><circle cx="24" cy="31" r="1.6" fill="#f9a825"/><circle cx="31" cy="25" r="2.2" fill="#f9a825"/><circle cx="36" cy="31" r="1.4" fill="#f9a825"/>`),
  dryer: svg(`<path d="M8 14h28a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H8z" fill="#29b6f6"/><path d="M8 14h20v24H8z" fill="#4fc3f7"/><path d="M12 20h12M12 26h12M12 32h12" stroke="#e1f5fe" stroke-width="2" stroke-linecap="round"/>`),
  blower: svg(`<rect x="16" y="14" width="22" height="18" rx="4" fill="#ff7043"/><path d="M16 19 L4 21 L4 27 L16 29z" fill="#37474f"/><rect x="24" y="31" width="7" height="11" rx="2" fill="#263238"/>
    <path d="M2 17q-3 2 0 4M2 27q-3 2 0 4" stroke="#b3e5fc" stroke-width="2" fill="none"/>`),
  tire: svg(`<circle cx="24" cy="24" r="18" fill="#1b1d1f"/><circle cx="24" cy="24" r="9" fill="#cfd8dc"/><circle cx="24" cy="24" r="3" fill="#607d8b"/>
    <path d="M12 14a16 16 0 0 1 10-6" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".75"/>`),
  wax: svg(`<ellipse cx="22" cy="34" rx="16" ry="6" fill="#fafafa" stroke="#e53935" stroke-width="2"/><rect x="16" y="14" width="12" height="18" rx="4" fill="#ffca28"/><rect x="8" y="10" width="28" height="5" rx="2.5" fill="#263238"/>
    <path d="M40 8l1.6 4.4L46 14l-4.4 1.6L40 20l-1.6-4.4L34 14l4.4-1.6z" fill="#fff59d"/>`),
  bot: svg(`<ellipse cx="24" cy="26" rx="11" ry="9" fill="#eceff1"/><path d="M15 25a9 6 0 0 1 18 0z" fill="#0b2530"/><rect x="18" y="23" width="12" height="3" rx="1.5" fill="#51e4d1"/>
    <rect x="4" y="12" width="12" height="2.5" rx="1.2" fill="#90a4ae"/><rect x="32" y="12" width="12" height="2.5" rx="1.2" fill="#90a4ae"/><path d="M14 14l5 6M34 14l-5 6" stroke="#90a4ae" stroke-width="2.5"/><rect x="22" y="34" width="4" height="7" rx="1.5" fill="#ffb300"/>`),
  belt: svg(`<rect x="3" y="19" width="42" height="10" rx="3" fill="#6d4c41"/><rect x="18" y="16" width="12" height="16" rx="2" fill="none" stroke="#ffca28" stroke-width="3"/><rect x="23" y="22" width="9" height="4" fill="#ffca28"/>`),
  lounge: svg(`<rect x="6" y="18" width="36" height="12" rx="4" fill="#00897b"/><rect x="4" y="22" width="8" height="14" rx="3" fill="#00796b"/><rect x="36" y="22" width="8" height="14" rx="3" fill="#00796b"/><rect x="10" y="28" width="28" height="8" rx="2" fill="#26a69a"/><path d="M10 38v4M38 38v4" stroke="#004d40" stroke-width="3"/>`),
  ads: svg(`<path d="M8 20h8l16-9v26l-16-9H8z" fill="#ec407a"/><rect x="8" y="20" width="8" height="8" fill="#ad1457"/><path d="M12 28l3 10h5l-3-10z" fill="#ad1457"/><path d="M37 17q5 7 0 14M41 13q8 11 0 22" stroke="#f48fb1" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  star: svg(`<path d="M24 5l5.6 11.8 12.9 1.6-9.5 8.9 2.5 12.8L24 33.8 12.5 40.1 15 27.3 5.5 18.4l12.9-1.6z" fill="#ffd54f" stroke="#f9a825" stroke-width="2" stroke-linejoin="round"/>`),
  vend: svg(`<rect x="10" y="4" width="28" height="40" rx="3" fill="#c62828"/><rect x="14" y="8" width="15" height="28" rx="1.5" fill="#10161a"/><rect x="16" y="11" width="4" height="5" fill="#ffca28"/><rect x="22" y="11" width="4" height="5" fill="#42a5f5"/><rect x="16" y="19" width="4" height="5" fill="#66bb6a"/><rect x="22" y="19" width="4" height="5" fill="#ab47bc"/><rect x="31" y="12" width="4" height="8" fill="#80deea"/><rect x="15" y="38" width="13" height="3" fill="#10161a"/>`),
  coin: svg(`<circle cx="24" cy="24" r="19" fill="#ffca28" stroke="#f9a825" stroke-width="3"/><path d="M28.5 17.5c-1-1.5-2.8-2.4-4.9-2.4-3 0-5.1 1.6-5.1 4 0 5.6 10.5 3 10.5 8.8 0 2.5-2.3 4.3-5.4 4.3-2.4 0-4.4-1-5.5-2.7M24 12v4M24 32v4" stroke="#8d6e00" stroke-width="2.8" fill="none" stroke-linecap="round"/>`),
  clock: svg(`<circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M24 13v12l7 5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/>`),
  starSmall: svg(`<path d="M24 5l5.6 11.8 12.9 1.6-9.5 8.9 2.5 12.8L24 33.8 12.5 40.1 15 27.3 5.5 18.4l12.9-1.6z" fill="currentColor"/>`),
  cart: svg(`<path d="M5 9h6l5 22h21l4-15H14" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="19" cy="38" r="3.5" fill="currentColor"/><circle cx="34" cy="38" r="3.5" fill="currentColor"/>`),
  pause: svg(`<rect x="12" y="10" width="8" height="28" rx="2" fill="currentColor"/><rect x="28" y="10" width="8" height="28" rx="2" fill="currentColor"/>`),
  play: svg(`<path d="M15 9l24 15-24 15z" fill="currentColor"/>`),
  soundOn: svg(`<path d="M8 19h8l11-9v28l-11-9H8z" fill="currentColor"/><path d="M32 17q4 7 0 14M37 12q8 12 0 24" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  soundOff: svg(`<path d="M8 19h8l11-9v28l-11-9H8z" fill="currentColor"/><path d="M33 18l10 12M43 18L33 30" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`),
  full: svg(`<path d="M8 18V8h10M30 8h10v10M40 30v10H30M18 40H8V30" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  rotL: svg(`<path d="M14 18a14 14 0 1 1-2 14" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M6 10v12h12" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  rotR: svg(`<path d="M34 18a14 14 0 1 0 2 14" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M42 10v12H30" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  camTop: svg(`<path d="M24 8l16 9v14l-16 9-16-9V17z" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linejoin="round"/><path d="M8 17l16 9 16-9M24 26v14" stroke="currentColor" stroke-width="3" fill="none"/>`),
  check: svg(`<path d="M10 25l9 9 19-20" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  lock: svg(`<rect x="11" y="21" width="26" height="20" rx="4" fill="currentColor"/><path d="M16 21v-5a8 8 0 0 1 16 0v5" stroke="currentColor" stroke-width="4" fill="none"/>`),
  close: svg(`<path d="M13 13l22 22M35 13L13 35" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`),
  download: svg(`<path d="M24 7v23M14 21l10 10 10-10M9 33v6h30v-6" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  install: svg(`<rect x="13" y="5" width="22" height="38" rx="5" stroke="currentColor" stroke-width="3.5" fill="none"/><path d="M24 13v14M18 21l6 6 6-6" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 37h6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`),
  car: svg(`<path d="M6 30v-6l5-2 6-8h14l7 8 4 2v6z" fill="currentColor"/><circle cx="14" cy="32" r="4.5" fill="#071c2a" stroke="currentColor" stroke-width="2.5"/><circle cx="34" cy="32" r="4.5" fill="#071c2a" stroke="currentColor" stroke-width="2.5"/>`),
};

export function toolIcon(toolId, stats) {
  if (toolId === 'dryer' && stats && stats.blower) return ICONS.blower;
  return ICONS[toolId] || ICONS.hose;
}

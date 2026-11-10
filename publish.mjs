// Copies both games into this folder and publishes them to GitHub Pages.
//
//   node publish.mjs            copy the games, commit and push (the site updates within a minute or two)
//   node publish.mjs --no-push  only copy, to look at the result first
//
// Only the files a browser needs are copied: no server code, installers or build tools.
// Installed apps pick up a new version the next time they open with internet:
// their service worker refreshes each file in the background.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SITE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const CAR_WASH = path.resolve(SITE, '../car wash sim');
const BLOCKOUT = path.resolve(SITE, '../blockout/public');

/** Every file under `root`, as forward-slash relative paths. */
function walk(root, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

const GAMES = [
  {
    name: 'shine-time',
    root: CAR_WASH,
    // Same list the car wash's own server serves (minus the old 2D prototype).
    files: () => require(path.join(CAR_WASH, 'server.cjs')).listPublicFiles(CAR_WASH).filter((f) => f !== 'prototype-v0.html'),
  },
  { name: 'blockout', root: BLOCKOUT, files: () => walk(BLOCKOUT) },
];

for (const g of GAMES) {
  const out = path.join(SITE, g.name);
  fs.rmSync(out, { recursive: true, force: true });
  const files = g.files();
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.copyFileSync(path.join(g.root, f), path.join(out, f));
  }
  console.log(`${g.name}: ${files.length} files`);
}

if (process.argv.includes('--no-push')) process.exit(0);

const git = (...args) => execFileSync('git', args, { cwd: SITE, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
git('add', '-A');
if (!git('status', '--porcelain')) {
  console.log('Nothing changed, nothing to publish.');
  process.exit(0);
}
git('commit', '-q', '-m', `Update games ${new Date().toISOString().slice(0, 10)}`);
execFileSync('git', ['push', '-q'], { cwd: SITE, stdio: 'inherit' });
console.log('Published. The site updates within a minute or two.');

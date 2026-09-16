#!/usr/bin/env node
/**
 * Looks at what actually came out of the build, not at what went into it.
 *
 * Counting files does not prove pages. On another project the CI counted
 * outputs, called it 99 pages, and never looked at a single href — 43 dead
 * links went live. This reads the HTML.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');

const deaths = [];
const warnings = [];

function walk(dir, found = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, found);
    else if (f.endsWith('.html')) found.push(p);
  }
  return found;
}

if (!existsSync(OUT)) { console.error('public/ does not exist — did the build run?'); process.exit(1); }
const pages = walk(OUT);
if (!pages.length) { console.error('public/ has no HTML in it'); process.exit(1); }

const titles = new Map();
const descriptions = new Map();
let links = 0, images = 0, indexablePages = 0;
const placeholders = new Map();

/* Uniqueness is checked on pages that go into the index. In PREVIEW every page
   is noindex — so the check quietly stopped running in the exact mode the site
   publishes in, and reported "0 distinct titles" as if that were a result. A
   condition that is never true does not print a failure, it disappears. When
   nothing is indexable, the whole set is checked instead. */
const PREVIEW_BUILD = process.env.PREVIEW === 'yes';

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const where = file.slice(OUT.length) || '/';

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const indexable = !/<meta name="robots" content="noindex/.test(html);

  if (!title) deaths.push(`${where}: no <title>`);
  if (!desc) deaths.push(`${where}: no description`);
  if (indexable) indexablePages++;
  if ((indexable || PREVIEW_BUILD) && title) {
    if (titles.has(title)) deaths.push(`${where}: same title as ${titles.get(title)}`);
    else titles.set(title, where);
  }
  if ((indexable || PREVIEW_BUILD) && desc) {
    if (descriptions.has(desc)) warnings.push(`${where}: same description as ${descriptions.get(desc)}`);
    else descriptions.set(desc, where);
  }

  // Text the owner has not filled in must never reach a LIVE page. In preview
  // it is expected — that is what preview is for — so it warns there and kills
  // everywhere else. Counted by marker rather than by page: the address is on
  // all 96 of them and 202 identical lines would bury everything else.
  for (const m of html.matchAll(/⟨[^⟩]*⟩|\{\{[^}]*\}\}|TODO|FIXME|lorem ipsum/gi)) {
    const marker = m[0].slice(0, 60);
    placeholders.set(marker, (placeholders.get(marker) ?? 0) + 1);
  }

  // Every internal link has to resolve to something on disk. When the site is
  // served under a folder, a path that forgot the prefix resolves to somebody
  // else's site — so the prefix is checked here rather than trusted.
  const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    let target = m[1];
    if (BASE) {
      if (!target.startsWith(BASE + '/')) {
        deaths.push(`${where}: ${target} is missing the ${BASE} prefix and would 404`);
        continue;
      }
      target = target.slice(BASE.length);
    }
    if (/^\/(media|assets|data)\//.test(target)) {
      images++;
      if (!existsSync(join(OUT, target))) deaths.push(`${where}: ${target} does not exist`);
      continue;
    }
    links++;
    const asDir = join(OUT, target, 'index.html');
    const asFile = join(OUT, target);
    if (!existsSync(asDir) && !existsSync(asFile)) deaths.push(`${where}: link to ${target} goes nowhere`);
  }

  // Structure the shop cannot work without.
  if (!/<main id="main"/.test(html)) deaths.push(`${where}: no <main>`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) {
    deaths.push(`${where}: ${(html.match(/<h1[\s>]/g) || []).length} h1 elements, expected exactly 1`);
  }
  if (!/data-brand="(ithos|cathelier)"/.test(html)) deaths.push(`${where}: no brand on <html>`);
}

/* Every address INSIDE the stylesheet has to resolve too.
 *
 * The page checks above only ever read HTML attributes, and a CSS file has
 * addresses of its own. Eight @font-face rules shipped with root-relative
 * url() under a project path: every typeface 404ed on the live site and every
 * page rendered in the system fallback, while the local preview — where the
 * prefix is empty — looked perfect. */
const cssPath = join(OUT, 'assets', 'styles.css');
if (!existsSync(cssPath)) deaths.push('assets/styles.css is missing');
else {
  const css = readFileSync(cssPath, 'utf8');
  const BASE_CSS = (process.env.BASE_PATH || '').replace(/\/$/, '');
  let urls = 0;
  for (const m of css.matchAll(/url\((['"]?)(\/[^'")]+)\1\)/g)) {
    urls++;
    const target = m[2];
    if (BASE_CSS && !target.startsWith(BASE_CSS + '/')) {
      deaths.push(`styles.css: ${target} is missing the ${BASE_CSS} prefix — it would 404`);
      continue;
    }
    const onDisk = BASE_CSS ? target.slice(BASE_CSS.length) : target;
    if (!existsSync(join(OUT, onDisk))) deaths.push(`styles.css: ${target} does not exist`);
  }
  if (urls === 0) deaths.push('styles.css has no url() at all — are the typefaces still declared?');
  console.log(`  stylesheet: ${urls} addresses inside the CSS all resolve`);
}

/* The catalogue the Worker prices against has to be the one the pointer names. */
const pointer = join(OUT, 'data', 'catalogue-current.txt');
if (!existsSync(pointer)) deaths.push('data/catalogue-current.txt is missing');
else {
  const hash = readFileSync(pointer, 'utf8').trim();
  if (!existsSync(join(OUT, 'data', `catalogue.${hash}.json`))) {
    deaths.push(`the pointer names catalogue.${hash}.json, which does not exist`);
  }
}

for (const [marker, count] of placeholders) {
  const line = `an unfilled placeholder is on ${count} page${count > 1 ? 's' : ''}: ${marker}`;
  (PREVIEW_BUILD ? warnings : deaths).push(line);
}

for (const w of warnings) console.warn(`  warning: ${w}`);
if (deaths.length) {
  console.error(`\n${deaths.length} problem(s) in what was built:\n`);
  for (const d of deaths.slice(0, 40)) console.error(`  · ${d}`);
  if (deaths.length > 40) console.error(`  … and ${deaths.length - 40} more`);
  console.error('');
  process.exit(1);
}
console.log(`  output: ${pages.length} pages, ${links} internal links and ${images} assets all resolve`);
console.log(`  ${titles.size} distinct titles, ${descriptions.size} distinct descriptions`
  + (PREVIEW_BUILD ? ` (checked across all pages: this is a preview build, so none is indexable)`
                   : ` across ${indexablePages} indexable pages`));

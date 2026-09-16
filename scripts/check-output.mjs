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
let links = 0, images = 0;

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const where = file.slice(OUT.length) || '/';

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const indexable = !/<meta name="robots" content="noindex/.test(html);

  if (!title) deaths.push(`${where}: no <title>`);
  if (!desc) deaths.push(`${where}: no description`);
  if (indexable && title) {
    if (titles.has(title)) deaths.push(`${where}: same title as ${titles.get(title)}`);
    else titles.set(title, where);
  }
  if (indexable && desc) {
    if (descriptions.has(desc)) warnings.push(`${where}: same description as ${descriptions.get(desc)}`);
    else descriptions.set(desc, where);
  }

  // Text the owner has not filled in must never reach a live page.
  for (const m of html.matchAll(/⟨[^⟩]*⟩|\{\{[^}]*\}\}|TODO|FIXME|lorem ipsum/gi)) {
    deaths.push(`${where}: an unfilled placeholder reached the page: ${m[0].slice(0, 40)}`);
  }

  // Every internal link has to resolve to something on disk.
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const target = m[1];
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

/* The catalogue the Worker prices against has to be the one the pointer names. */
const pointer = join(OUT, 'data', 'catalogue-current.txt');
if (!existsSync(pointer)) deaths.push('data/catalogue-current.txt is missing');
else {
  const hash = readFileSync(pointer, 'utf8').trim();
  if (!existsSync(join(OUT, 'data', `catalogue.${hash}.json`))) {
    deaths.push(`the pointer names catalogue.${hash}.json, which does not exist`);
  }
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
console.log(`  ${titles.size} distinct titles, ${descriptions.size} distinct descriptions`);

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
const { MIRRORED } = await import('../src/lib/shell.mjs');
const PREVIEW_BUILD = process.env.PREVIEW === 'yes';
const byCanonical = new Map();

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const where = file.slice(OUT.length) || '/';

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const indexable = !/<meta name="robots" content="noindex/.test(html);

  if (!title) deaths.push(`${where}: no <title>`);
  if (!desc) deaths.push(`${where}: no description`);
  if (indexable) indexablePages++;

  /* THE QUESTION IS "ARE THESE THE SAME DOCUMENT?", NOT "THE SAME FILE?".
     Eight pages are now written twice, once in each shop's dress, and the two
     copies SHOULD carry the same title -- inventing a second description of
     one document is inventing a second claim about it. So pages are grouped by
     the canonical they name, and uniqueness is asked ACROSS groups.
     That is an exemption, so it is bounded on its own terms below: a group may
     hold at most two files, exactly one of which is the canonical. Without
     those two bounds, "same canonical" would be a way to make any two pages
     stop being compared. */
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] || where;
  if (!byCanonical.has(canonical)) byCanonical.set(canonical, []);
  byCanonical.get(canonical).push({
    where, title, desc, indexable,
    selfCanonical: canonical.endsWith(where) || canonical.endsWith(where.replace(/index\.html$/, '')),
  });

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
  // data-film is in here with href and src because it is the same kind of
  // thing: an address the page will fetch. It is fetched by script rather than
  // by the parser, which is exactly why it needs checking -- nothing about a
  // missing prefix shows up until somebody loads the home page.
  for (const m of html.matchAll(/(?:href|src|data-film)="(\/[^"#?]*)/g)) {
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

  // A product page has to describe itself. For a long while the 26 lamps did
  // and the 41 pieces did not — same shop, same basket, and to a search engine
  // only half of it was a shop.
  const ehProduto = /\/(lamps|pieces)\/[^/]+\/index\.html$/.test(where);
  if (ehProduto) {
    const blobs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
      .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
      .filter(Boolean)
      .flatMap((x) => (Array.isArray(x) ? x : [x]));
    if (!blobs.some((x) => x['@type'] === 'Product')) {
      deaths.push(`${where}: a product page with no Product in its structured data`);
    }
    if (!blobs.some((x) => x['@type'] === 'BreadcrumbList')) {
      deaths.push(`${where}: a product page with no BreadcrumbList`);
    }
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
const cssName = existsSync(join(OUT, 'assets'))
  ? readdirSync(join(OUT, 'assets')).find((f) => /^styles\.[a-f0-9]+\.css$/.test(f))
  : null;
const cssPath = cssName ? join(OUT, 'assets', cssName) : '';
if (!cssName) deaths.push('no styles.<digest>.css in assets/ — did the build write one?');
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
/* --- nobody is dropped into the other shop's chrome ------------------------
   Eight pages exist in both dresses. The failure this guards against is not
   today's: it is the next shared page somebody adds, links from the footer,
   and forgets to put in MIRRORED -- which would put 55 cathelier pages one
   click from the ithos wordmark, silently, exactly the way the basket did
   before this change.

   The question is asked of the built HTML and of the pages themselves: a page
   wearing cathelier may not link to the ithos copy of a shared page, and the
   other way round. The doors between the shops are the brands' OWN addresses
   and are not in this list, so they are untouched. */
{
  const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
  const dressOf = new Map();
  for (const f of pages) {
    const at = (f.slice(OUT.length) || '/').replace(/index\.html$/, '');
    dressOf.set(at, readFileSync(f, 'utf8').match(/data-brand="(ithos|cathelier)"/)?.[1] || null);
  }
  for (const m of MIRRORED) {
    if (dressOf.get(m) !== 'ithos') deaths.push(`${m}: missing, or not wearing ithos`);
    if (dressOf.get(`/cathelier${m}`) !== 'cathelier') deaths.push(`/cathelier${m}: missing, or not wearing cathelier`);
  }
  for (const f of pages) {
    const at = (f.slice(OUT.length) || '/').replace(/index\.html$/, '');
    if (dressOf.get(at) !== 'cathelier') continue;
    const html = readFileSync(f, 'utf8');
    for (const m of MIRRORED) {
      const bare = new RegExp(`\\shref="${BASE}${m.replace(/\//g, '\\/')}(?:#[^"]*)?"`);
      if (bare.test(html)) {
        deaths.push(`${at}: wears cathelier but links to ${m}, which wears ithos `
          + `— that link has to go through brandPath()`);
      }
    }
  }
}

/* --- one document, one title ---------------------------------------------- */
for (const [canonical, group] of byCanonical) {
  /* The bounds that stop "same canonical" becoming a way to be excused. */
  if (group.length > 2) {
    deaths.push(`${group.length} pages name the same canonical ${canonical}: `
      + group.map((g) => g.where).join(', ') + ' — a shared page has two dresses, not more');
  }
  const selves = group.filter((g) => g.selfCanonical).length;
  if (selves !== 1) {
    deaths.push(`${canonical}: ${selves} of ${group.length} pages are their own canonical, expected exactly 1 `
      + `(${group.map((g) => g.where).join(', ')}) — a copy must point home, and the home page must point at itself`);
  }
  /* Two dresses of one document say the same thing. If they diverge, one of
     them is lying about what it is. */
  const first = group[0];
  for (const g of group.slice(1)) {
    if (g.title !== first.title) deaths.push(`${g.where}: same canonical as ${first.where} but a different title`);
    if (g.desc !== first.desc) deaths.push(`${g.where}: same canonical as ${first.where} but a different description`);
  }

  /* Uniqueness is asked of documents that go into the index. In PREVIEW
     nothing is indexable, so the whole set is checked instead -- the same
     reasoning as the note at the top of this file, where a condition that was
     never true made the check disappear and report "0 distinct titles" as if
     that were a result. */
  const home = group.find((g) => g.selfCanonical) || first;
  if (!(PREVIEW_BUILD || home.indexable) || !first.title) continue;
  if (titles.has(first.title)) deaths.push(`${first.where}: same title as ${titles.get(first.title)}`);
  else titles.set(first.title, first.where);
  if (first.desc) {
    if (descriptions.has(first.desc)) warnings.push(`${first.where}: same description as ${descriptions.get(first.desc)}`);
    else descriptions.set(first.desc, first.where);
  }
}

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

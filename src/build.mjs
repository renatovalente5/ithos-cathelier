#!/usr/bin/env node
/**
 * Builds the shop into public/.
 *
 * Zero dependencies, on purpose: this has to still build in three years, on a
 * laptop nobody has maintained, with no lockfile to rot.
 *
 *     node src/build.mjs                 build with the live address
 *     BASE_URL=http://localhost:4320 …   build for the local preview
 *     PREVIEW=yes node src/build.mjs     noindex, and no way to pay
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { page } from './lib/shell.mjs';
import * as ithos from './lib/ithos.mjs';
import * as cath from './lib/cathelier.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'public');
const CONTENT = join(ROOT, 'content');

/* The address is read from CNAME and never guessed. Three places used to name
   the domain — the CNAME, a config and the Worker's allowed origins — and
   nothing compared them. */
const cname = existsSync(join(ROOT, 'CNAME')) ? readFileSync(join(ROOT, 'CNAME'), 'utf8').trim() : '';
const SITE = process.env.BASE_URL || (cname ? `https://${cname}` : 'http://localhost:4320');
const PREVIEW = process.env.PREVIEW === 'yes';

const read = (p) => JSON.parse(readFileSync(join(CONTENT, p), 'utf8'));
const identity = read('settings/identity.json');
const shipping = read('settings/shipping.json');
const shop = read('settings/shop.json');

/* --- content -------------------------------------------------------------- */

function loadProducts(brand) {
  const dir = join(CONTENT, brand);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const p = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    p.slug = f.replace(/\.json$/, '');
    return p;
  }).filter((p) => p.published).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

const lamps = loadProducts('ithos');
const pieces = loadProducts('cathelier').filter((p) => p.slug !== '_occasions');
const occasions = existsSync(join(CONTENT, 'cathelier/_occasions.json'))
  ? read('cathelier/_occasions.json').filter((o) => o.published).sort((a, b) => a.order - b.order)
  : [];
const counts = { lamps: lamps.length, pieces: pieces.length, occasions: occasions.length };

/* --- writing -------------------------------------------------------------- */

const written = [];
function write(path, html) {
  const file = path === '/' ? 'index.html'
    : path.endsWith('/') ? join(path.slice(1), 'index.html')
    : path.slice(1);
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html);
  written.push(path);
}

/* --- assets ---------------------------------------------------------------
   The stylesheet is one file, concatenated in a fixed order: the skeleton
   first, then each brand's world, then the shop furniture. One request, and
   the cascade order is a property of this list rather than of whatever order
   the browser happened to finish downloading in. */
function assets() {
  const css = ['styles/base.css', 'styles/brands/ithos.css', 'styles/brands/cathelier.css', 'styles/shop.css']
    .filter((f) => existsSync(join(HERE, f)))
    .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(HERE, f), 'utf8')}`)
    .join('\n\n');
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  writeFileSync(join(OUT, 'assets', 'styles.css'), css);

  cpSync(join(HERE, 'fonts'), join(OUT, 'assets', 'fonts'), { recursive: true });
  cpSync(join(ROOT, 'assets', 'brand'), join(OUT, 'assets'), { recursive: true });
  if (existsSync(join(HERE, 'js', 'shop.js'))) {
    cpSync(join(HERE, 'js', 'shop.js'), join(OUT, 'assets', 'shop.js'));
  }
  if (cname) writeFileSync(join(OUT, 'CNAME'), cname + '\n');
}

/* --- the catalogue the Worker prices against -----------------------------
   Named by the hash of its own contents and therefore immutable, with a
   pointer file beside it. The browser is never trusted with a price: the
   basket carries ids and quantities, and the Worker reprices from this. */
function catalogueFile() {
  const body = {
    preview: PREVIEW || !shop.open,
    currency: 'EUR',
    shipping,
    products: Object.fromEntries([...lamps, ...pieces].map((p) => [p.slug, {
      brand: lamps.includes(p) ? 'ithos' : 'cathelier',
      name: p.name,
      price: p.price,
      options: Object.fromEntries((p.options || []).map((o) => [o.id, o.type === 'text'
        ? { type: 'text', max: o.max || 40, extra: o.extra || 0 }
        : { type: 'choice', values: Object.fromEntries(o.values.map((v) => [v.id, v.extra || 0])) }])),
    }])),
  };
  const json = JSON.stringify(body);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 12);
  mkdirSync(join(OUT, 'data'), { recursive: true });
  writeFileSync(join(OUT, 'data', `catalogue.${hash}.json`), json);
  writeFileSync(join(OUT, 'data', 'catalogue-current.txt'), hash + '\n');
  return { hash, count: Object.keys(body.products).length };
}

/* --- pages ---------------------------------------------------------------- */

const shellArgs = { site: SITE, identity, counts, preview: PREVIEW };

function buildIthos() {
  write('/', page({
    ...shellArgs, brand: 'ithos', path: '/',
    title: 'ithos — handmade wooden night lights for children’s rooms',
    description: 'Wooden night lights cut, sanded and painted by hand in Castelo Branco, Portugal. '
      + `${lamps.length} designs, each one able to carry an engraved name.`,
    body: ithos.home({ products: lamps, identity }),
    schema: [{
      '@context': 'https://schema.org', '@type': 'Organization',
      name: 'ithos', url: SITE, email: identity.email, telephone: identity.phone,
    }],
  }));

  write('/lamps/', page({
    ...shellArgs, brand: 'ithos', path: '/lamps/',
    title: `Wooden night lights — all ${lamps.length} designs | ithos`,
    description: `Every ithos night light: ${lamps.length} handmade designs in solid pine, `
      + 'from animals to rockets. Each one can carry an engraved name.',
    crumbs: [{ name: 'Home', href: '/' }, { name: 'Lamps' }],
    body: ithos.catalogue({ products: lamps }),
  }));

  for (const p of lamps) {
    const { low } = ithos.fromPrice(p);
    write(`/lamps/${p.slug}/`, page({
      ...shellArgs, brand: 'ithos', path: `/lamps/${p.slug}/`,
      title: `${p.name} night light — handmade in wood | ithos`,
      description: p.summary,
      image: `/media/ithos/${p.photoFolder}/${p.cover}-1000.webp`,
      crumbs: [{ name: 'Home', href: '/' }, { name: 'Lamps', href: '/lamps/' }, { name: p.name }],
      body: ithos.product({ p, all: lamps, shop }),
      schema: [{
        '@context': 'https://schema.org', '@type': 'Product',
        name: `${p.name} wooden night light`, description: p.summary,
        image: `${SITE}/media/ithos/${p.photoFolder}/${p.cover}-1000.webp`,
        brand: { '@type': 'Brand', name: 'ithos' },
        offers: {
          '@type': 'Offer', price: low.toFixed(2), priceCurrency: 'EUR',
          availability: 'https://schema.org/MadeToOrder', url: `${SITE}/lamps/${p.slug}/`,
        },
      }],
    }));
  }
}

function buildCathelier() {
  write('/cathelier/', page({
    ...shellArgs, brand: 'cathelier', path: '/cathelier/',
    title: 'cathelier — personalised pieces, cut and engraved to order',
    description: `Laser-cut wooden keepsakes with your names, dates and words on them. `
      + `${occasions.length} occasions, ${pieces.length} pieces, each with a proof to approve before we cut.`,
    body: cath.home({ occasions, pieces }),
  }));

  for (const o of occasions) {
    const mine = pieces.filter((p) => p.occasion === o.slug || (p.alsoIn || []).includes(o.slug));
    write(`/cathelier/${o.slug}/`, page({
      ...shellArgs, brand: 'cathelier', path: `/cathelier/${o.slug}/`,
      title: `${o.name} — personalised wooden pieces | cathelier`,
      description: o.summary,
      crumbs: [{ name: 'cathelier', href: '/cathelier/' }, { name: o.name }],
      body: cath.occasion({ o, pieces, occasions }),
    }));
    if (!mine.length) console.warn(`  ! ${o.name} has no pieces in it`);
  }

  write('/cathelier/pieces/', page({
    ...shellArgs, brand: 'cathelier', path: '/cathelier/pieces/',
    title: `Every piece — ${pieces.length} personalised designs | cathelier`,
    description: `All ${pieces.length} cathelier pieces, made to order with your names, dates or words engraved.`,
    crumbs: [{ name: 'cathelier', href: '/cathelier/' }, { name: 'Every piece' }],
    body: cath.all({ pieces, occasions }),
  }));

  for (const p of pieces) {
    write(`/cathelier/pieces/${p.slug}/`, page({
      ...shellArgs, brand: 'cathelier', path: `/cathelier/pieces/${p.slug}/`,
      title: `${p.name} — personalised and engraved | cathelier`,
      description: p.summary,
      crumbs: [{ name: 'cathelier', href: '/cathelier/' },
               { name: 'Every piece', href: '/cathelier/pieces/' }, { name: p.name }],
      body: cath.piece({ p, all: pieces, shop, occasions }),
    }));
  }
}

/* --- run ------------------------------------------------------------------ */

const media = join(OUT, 'media');
const keepMedia = existsSync(media);
if (keepMedia) cpSync(media, join(ROOT, '.media-cache'), { recursive: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
if (keepMedia) { cpSync(join(ROOT, '.media-cache'), media, { recursive: true }); rmSync(join(ROOT, '.media-cache'), { recursive: true, force: true }); }

assets();
buildIthos();
buildCathelier();
const cat = catalogueFile();

writeFileSync(join(OUT, 'robots.txt'),
  PREVIEW ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + written.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n') + '\n</urlset>\n');

console.log(`  ${SITE}${PREVIEW ? '   (preview: noindex, no checkout)' : ''}`);
console.log(`  ${written.length} pages · ${lamps.length} lamps · ${pieces.length} pieces`);
console.log(`  catalogue.${cat.hash}.json (${cat.count} products)`);

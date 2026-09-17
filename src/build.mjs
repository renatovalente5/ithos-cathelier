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

import { page, MIRRORED } from './lib/shell.mjs';
import * as ithos from './lib/ithos.mjs';
import * as cath from './lib/cathelier.mjs';
import * as pages from './lib/pages.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'public');
const CONTENT = join(ROOT, 'content');

/* The address is read from CNAME and never guessed. Three places used to name
   the domain — the CNAME, a config and the Worker's allowed origins — and
   nothing compared them. */
const cname = existsSync(join(ROOT, 'CNAME')) ? readFileSync(join(ROOT, 'CNAME'), 'utf8').trim() : '';
/* With a prefix set, the site is NOT on its own domain, so the canonical URLs
   must not claim the domain either — a canonical pointing at a host that does
   not serve the page is worse than no canonical. */
const BASE_PATH_SET = !!process.env.BASE_PATH;
/* AND THE PREFIX, which was missing. The reasoning above was right and the
   arithmetic was not: with BASE_PATH set the site is served at
   github.io/ithos-cathelier/, and the canonical claimed github.io/contact/ --
   an address that serves nothing. It has been inert only because every build
   so far is a preview and noindex; it would have been wrong on all 96 pages
   the day the preview flag came off. The same constant feeds og:url and the
   sitemap, so all three were pointing at 404s. */
const SITE = process.env.BASE_URL
  || (BASE_PATH_SET ? `https://renatovalente5.github.io${(process.env.BASE_PATH || '').replace(/\/$/, '')}`
  : cname ? `https://${cname}` : 'http://localhost:4320');
const PREVIEW = process.env.PREVIEW === 'yes';

/* The address prefix, and it is not optional.
 *
 * On the real domain every path starts at the root and BASE is empty. Served
 * from a project page - renatovalente5.github.io/ithos-cathelier/ - every
 * absolute path has to carry that folder, or the stylesheet, the fonts and all
 * 836 photographs 404 at once and the shop renders as plain text.
 *
 * Rather than thread a helper through five page builders and hope nobody
 * forgets one, the prefix is applied HERE, to every page as it is written, and
 * scripts/check-output.mjs refuses to pass a page that still has a bare
 * absolute path in it. A rule that is only remembered is a rule that breaks. */
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

function prefix(html) {
  if (!BASE) return html;
  return html
    /* data-film is in this list for the same reason src is: it holds an
       address, and an address that misses the prefix is a 404 the moment the
       site is served from a subfolder. Putting it here means shop.js can
       assign the attribute verbatim and never do prefix arithmetic of its
       own -- which is the whole point of there being one place. */
    .replace(/(\s(?:href|src|content|action|data-film)=")\/(?!\/)/g, `$1${BASE}/`)
    .replace(/(\ssrcset=")([^"]+)"/g, (m, head, list) =>
      head + list.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE}/`) + '"');
}

/* The stylesheet needs it too, and forgetting that cost every typeface on the
 * live site.
 *
 * The HTML rewrite above only ever looked at attributes. A CSS file has its own
 * addresses — `url('/assets/fonts/...')` in eight @font-face rules — and those
 * went out unprefixed, resolved to the root of github.io, and 404ed. Every page
 * that has been published so far rendered in the system fallback: not
 * Montserrat, not Cormorant, not Klee One, not Grandstander.
 *
 * The battery could not see it. It drives localhost, where BASE is empty and
 * the fonts load, and its "typeface loaded" check passed every time. A build
 * verified against a different address than the one it ships to is not
 * verified. */
function prefixCss(css) {
  if (!BASE) return css;
  return css.replace(/url\((['"]?)\/(?!\/)/g, `url($1${BASE}/`);
}

const read = (p) => JSON.parse(readFileSync(join(CONTENT, p), 'utf8'));
const identity = read('settings/identity.json');
const shipping = read('settings/shipping.json');
const shop = read('settings/shop.json');
const covers = read('settings/covers.json');

/* Which cover renditions actually exist, counted off disk rather than assumed.
   The cathelier master is an enlarged Instagram still and stops short of the
   widest size; promising a file that was never written is how 548 broken image
   references got shipped once already. */
const COVER_WIDTHS = [640, 960, 1280, 1600, 2000, 2600];
const coverWidths = (brand) => {
  const have = COVER_WIDTHS.filter((w) =>
    existsSync(join(ROOT, 'public/media/covers', `${brand}-${w}.webp`)));
  if (!have.length) throw new Error(`No cover renditions for ${brand}. Run scripts/covers.py then scripts/renditions.py.`);
  return have;
};

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
function write(path, html, { sitemap = true } = {}) {
  const file = path === '/' ? 'index.html'
    : path.endsWith('/') ? join(path.slice(1), 'index.html')
    : path.slice(1);
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, prefix(html));
  written.push({ path, sitemap });
}

/* --- assets ---------------------------------------------------------------
   The stylesheet is one file, concatenated in a fixed order: the skeleton
   first, then each brand's world, then the shop furniture. One request, and
   the cascade order is a property of this list rather than of whatever order
   the browser happened to finish downloading in. */
/* The stylesheet and the script carry a digest of their own contents in their
 * filename, the same protocol the catalogue already uses.
 *
 * Without it, a browser that has visited once keeps the old file: the address
 * never changes, so nothing tells it to look again. That is how a fixed
 * stylesheet reached the CDN and the page in front of me still had the broken
 * one. A hashed name makes a deploy impossible to miss and lets these be
 * cached for a year instead of ten minutes. */
const digest = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const ASSET = { css: '', js: '' };

function assets() {
  const css = ['styles/base.css', 'styles/brands/ithos.css', 'styles/brands/cathelier.css', 'styles/shop.css']
    .filter((f) => existsSync(join(HERE, f)))
    .map((f) => `/* ===== ${f} ===== */\n${readFileSync(join(HERE, f), 'utf8')}`)
    .join('\n\n');
  mkdirSync(join(OUT, 'assets'), { recursive: true });
  const cssOut = prefixCss(css);
  ASSET.css = `styles.${digest(cssOut)}.css`;
  writeFileSync(join(OUT, 'assets', ASSET.css), cssOut);

  cpSync(join(HERE, 'fonts'), join(OUT, 'assets', 'fonts'), { recursive: true });
  cpSync(join(ROOT, 'assets', 'brand'), join(OUT, 'assets'), { recursive: true });
  if (existsSync(join(HERE, 'js', 'shop.js'))) {
    const API = (process.env.API_URL || '').replace(/\/$/, '');
    const js = readFileSync(join(HERE, 'js', 'shop.js'), 'utf8')
      .replace("const BASE = '';", `const BASE = '${BASE}';`)
      .replace("const API = '';", `const API = '${API}';`);
    ASSET.js = `shop.${digest(js)}.js`;
    if (BASE && !js.includes(`const BASE = '${BASE}'`)) {
      throw new Error('shop.js has no BASE line to fill in — every fetch in it would miss the prefix');
    }
    writeFileSync(join(OUT, 'assets', ASSET.js), js);
  }
  // The CNAME file is what tells GitHub to serve at the custom domain. While
  // the site is on a project path it must NOT be written, or Pages redirects
  // to a domain that does not resolve yet and the whole site disappears.
  if (cname && !BASE) writeFileSync(join(OUT, 'CNAME'), cname + '\n');
}

/* --- the catalogue the Worker prices against -----------------------------
   Named by the hash of its own contents and therefore immutable, with a
   pointer file beside it. The browser is never trusted with a price: the
   basket carries ids and quantities, and the Worker reprices from this. */
function catalogueFile() {
  const body = {
    preview: PREVIEW || !shop.open,
    currency: 'EUR',
    lead: { inStockDays: shop.lead.inStockDays, toOrderDays: shop.lead.toOrderDays },
    shipping,
    /* The options travel WHOLE, as an array, and not flattened to a price map.
     * The Worker has to do three things with them and only the full shape
     * allows all three: refuse a value the catalogue never offered, price the
     * one it did, and know which of them PERSONALISE — because an order
     * carrying an engraved name loses the right to cancel, and that is a legal
     * fact the shop has to be able to state on the invoice. */
    products: Object.fromEntries([...lamps, ...pieces].map((p) => [p.slug, {
      brand: lamps.includes(p) ? 'ithos' : 'cathelier',
      name: p.name,
      price: p.price,
      made: p.made || 'to_order',
      photo: p.photoFolder && p.cover
        ? `${lamps.includes(p) ? 'ithos' : 'cathelier'}/${p.photoFolder}/${p.cover}` : '',
      options: (p.options || []).map((o) => (o.type === 'text'
        ? { id: o.id, name: o.name, type: 'text', required: !!o.required,
            personalises: !!o.personalises, max: o.max || 40, extra: o.extra || 0 }
        : { id: o.id, name: o.name, type: 'choice', required: !!o.required,
            personalises: !!o.personalises,
            /* `available` travels. Without it the shop could refuse a choice in
               the browser and accept it at the till: the Worker prices from
               THIS file and knows nothing the file does not say. A disabled
               radio is a courtesy to the reader, never a control. */
            values: o.values.map((v) => ({
              id: v.id, name: v.name, extra: v.extra || 0,
              ...(v.available === false ? { available: false } : {}),
            })) })),
    }])),
  };
  const json = JSON.stringify(body);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 12);
  mkdirSync(join(OUT, 'data'), { recursive: true });
  writeFileSync(join(OUT, 'data', `catalogue.${hash}.json`), json);
  writeFileSync(join(OUT, 'data', 'catalogue-current.txt'), hash + '\n');
  return { hash, count: Object.keys(body.products).length };
}

const shellArgs = { site: SITE, identity, counts, preview: PREVIEW, shipping, shop, asset: ASSET };

function buildIthos() {
  write('/', page({
    ...shellArgs, brand: 'ithos', path: '/',
    title: 'ithos — handmade wooden night lights for children’s rooms',
    description: 'Wooden night lights cut, sanded and painted by hand in Castelo Branco, Portugal. '
      + `${lamps.length} designs, each one able to carry an engraved name.`,
    body: ithos.home({ products: lamps, identity, cover: covers.ithos, coverWidths: coverWidths('ithos') }),
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
    body: cath.home({ occasions, pieces, cover: covers.cathelier, coverWidths: coverWidths('cathelier') }),
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
      image: p.photoFolder && p.cover ? `/media/cathelier/${p.photoFolder}/${p.cover}-400.webp` : undefined,
      /* The 41 cathelier pieces emitted no structured data at all while the 26
         lamps did. Same shop, same basket, same law — and to a search engine
         only half of it was a shop. `MadeToOrder` is the honest availability:
         nothing here exists until somebody asks for it. */
      schema: [{
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.name, description: p.summary,
        ...(p.photoFolder && p.cover
          ? { image: `${SITE}/media/cathelier/${p.photoFolder}/${p.cover}-400.webp` } : {}),
        brand: { '@type': 'Brand', name: 'cathelier' },
        offers: {
          '@type': 'Offer', price: Number(p.price).toFixed(2), priceCurrency: 'EUR',
          availability: 'https://schema.org/MadeToOrder',
          url: `${SITE}/cathelier/pieces/${p.slug}/`,
        },
      }],
    }));
  }
}

/* --- the pages both shops share ------------------------------------------ */

const MARKERS = pages.markers({ identity, shop, shipping });
const readPage = (f) => readFileSync(join(CONTENT, 'pages', f), 'utf8');

function prose(path, file, { brand = 'ithos', title, description, crumbs, both = false }) {
  const html = pages.markdown(pages.fill(readPage(file), MARKERS));
  const body = pages.prosePage(html);
  if (both) { mirror(path, { title, description, crumbs, body }); return; }
  write(path, page({
    ...shellArgs, brand, path, title, description, crumbs,
    noindex: false, body,
  }));
}

/* Writes a shared page TWICE: at its own address wearing ithos, and under
   /cathelier/ wearing cathelier. Same body, same title, same description --
   the copy differs only in the navbar, the menu and the footer, which is what
   was asked for. The copy's canonical points home, it carries no structured
   data and it is not in the sitemap, so the two are never in competition. */
/** Rewrite every link to a shared page so it stays inside cathelier. Exact
 *  paths only, with an optional fragment -- never a prefix match, or
 *  /legal/terms-of-hire/ would be caught by /legal/terms/. */
function dressBody(html) {
  let out = String(html);
  for (const m of MIRRORED) {
    out = out.replace(new RegExp(`href="${m}(#[^"]*)?"`, 'g'), (_, hash) => `href="/cathelier${m}${hash || ''}"`);
  }
  return out;
}

function mirror(path, { title, description, crumbs, body, schema = [], noindex = false }) {
  const common = { ...shellArgs, path, title, description, body, noindex };
  write(path, page({ ...common, brand: 'ithos', crumbs, schema }),
    { sitemap: !noindex });
  write(`/cathelier${path}`, page({
    ...common, brand: 'cathelier', path: `/cathelier${path}`, canonicalPath: path,
    /* And the links INSIDE the words, not just the ones in the frame. The
       cancellation page points at the cancellation form, the delivery page
       points back at the cancellation page, and the FAQ answers point at three
       more -- every one of them a trapdoor out of cathelier and into the ithos
       wordmark, in the middle of a sentence. The body is rendered once and
       dressed here, before the address prefix is applied, because that is the
       one place that knows which shop this copy belongs to. */
    body: dressBody(body),
    /* The trail starts in the shop the reader is standing in. */
    crumbs: crumbs && [{ name: 'cathelier', href: '/cathelier/' }, ...crumbs.slice(1)],
  }), { sitemap: false });
}

function buildShared() {
  prose('/about/', 'about.md', { title: 'The workshop — ithos', crumbs: [{ name: 'Home', href: '/' }, { name: 'The workshop' }],
    description: 'A small workshop in Castelo Branco, Portugal, where every wooden night light is cut, sanded, painted and wired by hand.' });

  prose('/cathelier/about/', 'cathelier/about.md', { brand: 'cathelier',
    title: 'The workshop — cathelier', crumbs: [{ name: 'cathelier', href: '/cathelier/' }, { name: 'The workshop' }],
    description: 'The laser side of a small Portuguese workshop: personalised pieces drawn, cut and engraved to order, with a proof to approve before anything is cut.' });

  prose('/care-and-safety/', 'care-and-safety.md', { title: 'Care and safety — ithos',
    crumbs: [{ name: 'Home', href: '/' }, { name: 'Care and safety' }],
    description: 'How to look after a wooden night light, and what to know before putting one in a child\u2019s room.' });

  for (const [file, path, title, description] of [
    ['legal/terms.md', '/legal/terms/', 'Terms of sale', 'The terms that apply to every purchase on this site, under both the ithos and cathelier names.'],
    ['legal/privacy.md', '/legal/privacy/', 'Privacy', 'This site sets no analytics or advertising cookies and does not track you. What we hold, why, and for how long.'],
    ['legal/cancellation.md', '/legal/cancellation/', 'Your right to cancel', 'Fourteen days to change your mind on anything that is not personalised, and what that exception means.'],
    ['legal/returns-form.md', '/legal/returns-form/', 'Cancellation form', 'The form you may use to cancel an order. An email does the same job.'],
    ['legal/shipping-and-returns.md', '/legal/shipping-and-returns/', 'Delivery and returns', 'How long things take, where we ship, what it costs, and what happens if something arrives damaged.'],
    ['legal/identification.md', '/legal/identification/', 'Who you are buying from', 'The seller\u2019s legal identification, published under article 10 of Decree-Law 7/2004.'],
  ]) {
    prose(path, file, { both: true, title: `${title} — ${identity.tradingName}`, description,
      crumbs: [{ name: 'Home', href: '/' }, { name: title }] });
  }

  mirror('/contact/', {
    title: 'Contact — ithos · cathelier',
    description: 'WhatsApp, email or telephone. Answers in a day, usually less. And the questions we are asked most.',
    crumbs: [{ name: 'Home', href: '/' }, { name: 'Contact' }],
    body: pages.contact({ identity, shop, faq: pages.FAQ(shop) }),
    schema: [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: pages.FAQ(shop).map(([q, a]) => ({
        '@type': 'Question', name: q,
        acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() },
      })),
    }],
  });

  write('/cathelier/quote/', page({
    ...shellArgs, brand: 'cathelier', path: '/cathelier/quote/',
    title: 'Ask for a quote — cathelier',
    description: 'For anything in quantity: wedding favours, christening keepsakes, place cards, corporate gifts, trophies.',
    crumbs: [{ name: 'cathelier', href: '/cathelier/' }, { name: 'Ask for a quote' }],
    body: pages.quote({ identity }),
  }));

  /* The basket is the worst of them and the one nobody would have listed: its
     icon is in the header AND the drawer of every page, so a cathelier reader
     used to change shop by clicking the most-used control on the site. */
  mirror('/cart/', {
    noindex: true,
    title: 'Your basket — ithos · cathelier',
    description: 'What you have chosen so far.',
    body: pages.basket({ shipping }),
  });

  for (const [path, title, description, body] of [
    ['/thank-you/', 'Thank you', 'Your order is placed and the workshop starts now.', pages.thankYou()],
    ['/order-cancelled/', 'Nothing was charged', 'You closed the payment page, so the order was not placed.', pages.orderCancelled()],
  ]) {
    write(path, page({
      ...shellArgs, brand: 'ithos', path, noindex: true,
      title: `${title} — ithos · cathelier`, description, body,
    }), { sitemap: false });
  }

  write('/404.html', page({
    ...shellArgs, brand: 'ithos', path: '/404.html', noindex: true,
    title: 'Not found — ithos · cathelier',
    description: 'The page you were looking for has moved or never existed.',
    body: pages.notFound(),
  }), { sitemap: false });
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
buildShared();
const cat = catalogueFile();

writeFileSync(join(OUT, 'robots.txt'),
  PREVIEW ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  /* The copies are not in here, and neither is anything noindex. A sitemap
     entry for a page that carries a canonical pointing elsewhere is two
     contradictory signals about the same document; one for a noindex page is
     the same mistake, and this build has been making it since it was written
     (the basket, the thank-you page, the 404 were all listed). */
  + written.filter((w) => w.sitemap).map((w) => `  <url><loc>${SITE}${w.path}</loc></url>`).join('\n') + '\n</urlset>\n');

console.log(`  ${SITE}${PREVIEW ? '   (preview: noindex, no checkout)' : ''}`);
console.log(`  ${written.length} pages · ${lamps.length} lamps · ${pieces.length} pieces`);
console.log(`  catalogue.${cat.hash}.json (${cat.count} products)`);

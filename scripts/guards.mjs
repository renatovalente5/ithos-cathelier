#!/usr/bin/env node
/**
 * The guards. They run before the build and they are allowed to kill it.
 *
 * A shop published without the seller's legal identification on it is worse
 * than a shop that does not publish: the first is an offence, the second is a
 * Tuesday. On another project the back office quietly emptied the address
 * field and CI published anyway.
 *
 * With PREVIEW=yes, and only then, the checks that are waiting on the owner
 * become warnings instead of deaths. Everything else still kills.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content');
const PREVIEW = process.env.PREVIEW === 'yes';

const deaths = [];
const warnings = [];
const die = (m) => deaths.push(m);
const pending = (m) => (PREVIEW ? warnings.push(m) : deaths.push(m));

const read = (p) => JSON.parse(readFileSync(join(CONTENT, p), 'utf8'));

/* --- who is selling ------------------------------------------------------- */
const identity = read('settings/identity.json');
for (const field of ['legalName', 'taxNumber', 'email', 'phone', 'town', 'country']) {
  if (!identity[field]) die(`identity.json: "${field}" is empty — required by DL 7/2004 art. 10`);
}
for (const field of ['street', 'postcode']) {
  if (!identity[field]) pending(`identity.json: "${field}" is empty — required by DL 7/2004 art. 10`);
}

/* --- shipping ------------------------------------------------------------- */
const shipping = read('settings/shipping.json');
if (!shipping.zones?.length) die('shipping.json: no zones');
if (!shipping.active?.length) die('shipping.json: no country is switched on, so nobody can buy');
for (const c of shipping.active) {
  if (!shipping.zones.some((z) => z.countries.includes(c))) {
    die(`shipping.json: "${c}" is on sale but belongs to no zone, so it has no price`);
  }
}

/* --- the products --------------------------------------------------------- */
const seenNames = new Map();

function checkProduct(brand, slug, p) {
  const where = `${brand}/${slug}.json`;
  if (!p.name) die(`${where}: no name`);
  if (typeof p.price !== 'number' || p.price <= 0) die(`${where}: price is not a positive number`);
  if (!p.summary) pending(`${where}: no summary — it is the description search engines show`);

  const name = String(p.name).toLowerCase();
  if (seenNames.has(name)) die(`${where}: same name as ${seenNames.get(name)}`);
  seenNames.set(name, where);

  for (const o of p.options || []) {
    if (!o.id || !o.name) die(`${where}: an option has no id or no name`);
    if (o.type === 'choice') {
      if (!o.values?.length) die(`${where}: option "${o.id}" offers nothing to choose`);
      const ids = new Set();
      for (const v of o.values) {
        if (ids.has(v.id)) die(`${where}: option "${o.id}" has two values called "${v.id}"`);
        ids.add(v.id);
      }
      // The price on the card is the lowest the product can be bought for, so
      // some choice at zero surcharge has to exist. A required option whose
      // cheapest value carries a surcharge makes the card advertise a price
      // the product page then refuses to honour. It happened once.
      if (o.required && Math.min(...o.values.map((v) => v.extra || 0)) !== 0) {
        die(`${where}: option "${o.id}" is required and every choice costs extra, `
          + 'so the advertised price cannot be paid');
      }
    }
  }

  if (p.published && brand === 'ithos') {
    if (!p.photos?.length) die(`${where}: published with no photographs`);
    if (!p.photos.includes(p.cover)) die(`${where}: cover "${p.cover}" is not in the photo list`);
  }
}

let counted = { ithos: 0, cathelier: 0 };
for (const brand of ['ithos', 'cathelier']) {
  const dir = join(CONTENT, brand);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    const p = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (!p.published) continue;
    counted[brand]++;
    checkProduct(brand, f.replace(/\.json$/, ''), p);
  }
}

/* --- occasions ------------------------------------------------------------ */
if (existsSync(join(CONTENT, 'cathelier/_occasions.json'))) {
  const occ = read('cathelier/_occasions.json');
  const slugs = new Set();
  for (const o of occ) {
    if (slugs.has(o.slug)) die(`_occasions.json: two occasions share the address "${o.slug}"`);
    slugs.add(o.slug);
    if (!o.summary) pending(`_occasions.json: "${o.name}" has no summary`);
  }
  // A piece pointing at an occasion that does not exist would vanish from the
  // shop without a word.
  for (const f of readdirSync(join(CONTENT, 'cathelier')).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    const p = JSON.parse(readFileSync(join(CONTENT, 'cathelier', f), 'utf8'));
    for (const s of [p.occasion, ...(p.alsoIn || [])].filter(Boolean)) {
      if (!slugs.has(s)) die(`cathelier/${f}: occasion "${s}" does not exist`);
    }
  }
}

/* --- covers ---------------------------------------------------------------
   The cover is the first thing anybody sees, and every word on it is typed in
   the back office. An emptied headline does not break a build -- it publishes
   a photograph with a blank panel on it, which nobody notices from a diff.
   The picture is checked too: the page points at renditions, and a cover
   swapped without running the two scripts would be twelve broken references
   on the busiest page of the site. */
{
  const covers = read('settings/covers.json');
  for (const brand of ['ithos', 'cathelier']) {
    const c = covers[brand];
    if (!c) { die(`covers.json: "${brand}" has no cover at all`); continue; }
    if (!c.title) die(`covers.json: the ${brand} cover has no title`);
    if (!c.alt) die(`covers.json: the ${brand} cover photograph has no alt text`);
    if ((c.buttonLabel && !c.buttonHref) || (c.buttonHref && !c.buttonLabel)) {
      die(`covers.json: the ${brand} cover button has a label or an address but not both`);
    }
    for (const key of ['focus', 'focusWide']) {
      if (c[key] && !/^\s*[\d.]+%\s+[\d.]+%\s*$/.test(c[key])) {
        die(`covers.json: ${brand}.${key} must be two percentages, like "50% 44%" — got "${c[key]}"`);
      }
    }
    if (!existsSync(join(ROOT, 'photos/_covers', `${brand}.jpg`))) {
      die(`covers.json: photos/_covers/${brand}.jpg is missing — run scripts/covers.py`);
    }
    if (!existsSync(join(ROOT, 'public/media/covers', `${brand}-640.webp`))) {
      die(`covers.json: the ${brand} cover has no renditions — run scripts/renditions.py`);
    }
    if (!c.text) pending(`covers.json: the ${brand} cover has no sentence under the title`);
  }
}


/* --- report --------------------------------------------------------------- */
for (const w of warnings) console.warn(`  warning: ${w}`);
if (deaths.length) {
  console.error('\nTHE BUILD STOPPED. An incomplete shop published is worse than one that does not publish.\n');
  for (const d of deaths) console.error(`  · ${d}`);
  console.error('');
  process.exit(1);
}
if (PREVIEW) console.log('\n  PREVIEW: the shop stays out of the index and nobody can pay.\n');
console.log(`  guards: ${counted.ithos} lamps, ${counted.cathelier} pieces — all consistent`
  + `${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}`);

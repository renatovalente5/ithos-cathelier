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
const { shapeOf, rungs } = await import('../src/lib/photo.mjs');
const PREVIEW = process.env.PREVIEW === 'yes';

const deaths = [];
const esgotados = new Map();
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
        /* The colour is optional -- most variants are sizes, and a size has no
           colour -- but if it is there it has to be a colour, because it goes
           straight into a style attribute. Anything else paints nothing and
           leaves the empty square this field exists to stop. */
        if ('colour' in v && !/^#[0-9A-Fa-f]{6}$/.test(String(v.colour))) {
          die(`${where}: option "${o.id}" value "${v.id}" has colour "${v.colour}", `
            + `which is not a six-digit hex like #B32920`);
        }
      }
      /* A REQUIRED CHOICE WITH NOTHING LEFT TO CHOOSE IS A PRODUCT NOBODY CAN
         BUY, and it would not look broken: the page would draw every option
         greyed, the form would refuse to submit, and the shop would go on
         advertising a price. Marking the last value unavailable has to stop
         the build and say which product it was. */
      const aVenda = o.values.filter((v) => v.available !== false);
      if (o.required && !aVenda.length) {
        die(`${where}: every value of required option "${o.id}" is unavailable — `
          + `nobody could buy this. Unpublish the product instead.`);
      }
      /* Counted, not listed. "Mains cable with remote" is out of stock on all
         26 lamps at once, and 26 identical warning lines would bury the two
         that matter (the address the owner has still to fill in). One line
         per option says the same thing and can still be read. */
      for (const v of o.values.filter((x) => x.available === false)) {
        const chave = `${o.name} — ${v.name}`;
        esgotados.set(chave, (esgotados.get(chave) || 0) + 1);
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

    /* The film is optional and deleting the line is meant to be safe, so a
       missing "film" is silence. A film that is NAMED and not on disk is not:
       that is a 2 MB request for nothing on the busiest page of the site. */
    if (c.film) {
      if (!/^[a-z0-9-]+$/.test(c.film)) {
        die(`covers.json: ${brand}.film must be a plain file name — got "${c.film}"`);
      } else if (!existsSync(join(ROOT, 'public/media/film', `${c.film}.mp4`))) {
        die(`covers.json: the ${brand} cover names the film "${c.film}" and `
          + `public/media/film/${c.film}.mp4 is not there — run scripts/film.sh ${c.film}`);
      }
    }
  }
}

/* --- the film's breakpoint, and the panel it plays behind -------------------
   Two numbers in this project are written down in more than one language, and
   both have already gone wrong somewhere: a width that the stylesheet and a
   script have to agree on, and an opacity that a paragraph of prose claims is
   safe. Neither is checked by reading the site, because on the day they
   disagree the page still renders -- it just renders the wrong thing. */
{
  const css = readFileSync(join(ROOT, 'src/styles/shop.css'), 'utf8');
  const covers = read('settings/covers.json');

  /* 1. The film runs from the width at which the cover becomes 16:9, because
        that is the width at which the cover and the film are the same shape.
        The template writes that number into data-film-from and shop.js reads
        it from there; here we check it is still the number the stylesheet
        uses, rather than one somebody moved and the other did not. */
  if (Object.values(covers).some((c) => c && c.film)) {
    const wide = css.match(/@media \(width >= ([\d.]+rem)\) \{\s*\.cover__media \{ aspect-ratio: 16 \/ 9/);
    const template = readFileSync(join(ROOT, 'src/lib/cover.mjs'), 'utf8')
      .match(/data-film-from="([^"]+)"/);
    if (!wide) {
      die('shop.css: cannot find the breakpoint where .cover__media becomes 16/9, '
        + 'so the film\'s breakpoint cannot be checked against it');
    } else if (!template) {
      die('cover.mjs: the film element has no data-film-from');
    } else if (wide[1] !== template[1]) {
      die(`the film starts at ${template[1]} (cover.mjs) but the cover only becomes `
        + `16:9 at ${wide[1]} (shop.css) — between the two it would be cropped`);
    }
  }

  /* 2. The words sit on a panel that lets some of the picture -- or the film
        -- through, so the worst ground the ink can ever land on is the panel
        composited over black. cover.mjs claims that is still above 4.5:1.
        Claims in comments rot; this one is arithmetic, so it is done. */
  const lum = (hex) => {
    const n = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  for (const brand of ['ithos', 'cathelier']) {
    const sheet = readFileSync(join(ROOT, 'src/styles/brands', `${brand}.css`), 'utf8');
    const panel = sheet.match(/--cover-panel:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/);
    const ink = sheet.match(/--cover-ink:\s*(#[0-9a-fA-F]{6})/);
    if (!panel || !ink) { die(`${brand}.css: cannot read --cover-panel / --cover-ink`); continue; }
    const a = Number(panel[4]);
    /* over black: the panel keeps only its own alpha of itself */
    const over = '#' + panel.slice(1, 4)
      .map((v) => Math.round(Number(v) * a).toString(16).padStart(2, '0')).join('');
    const [hi, lo] = [lum(over), lum(ink[1])].sort((x, y) => y - x);
    const ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio < 4.5) {
      die(`${brand}: the cover panel at ${a} opacity over a black frame reads `
        + `${ratio.toFixed(2)}:1 against the ink — below the 4.5:1 minimum`);
    }
  }
}


/* --- every photograph a card can ask for is on disk ------------------------
   The hover cycle composes its addresses AT RUNTIME, by swapping the
   photograph's name inside the srcset the build wrote. Those URLs are in no
   HTML file, so scripts/check-output.mjs cannot see them -- it matches `src="`
   and never looks inside a `srcset=` at all. Nor can the browser battery: it
   only knows about an image once something has fetched it, and it never
   hovers.

   So `rm public/media/ithos/raposa/02-1000.avif` used to pass the build, the
   CI and the battery, and break the Fox card the moment a pointer rested on
   it. All 576 of them happen to exist today; the failure is the next
   photograph added without re-running scripts/renditions.py. */
{
  const PUB = join(ROOT, 'public', 'media');
  // What the card's frame asks for, and what the thumbnail strip asks for.
  const QUADRO = [200, 400, 600, 1000];
  const TIRA = [120, 200];
  let faltam = 0;
  const falta = [];
  for (const f of readdirSync(join(CONTENT, 'ithos')).filter((x) => x.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(join(CONTENT, 'ithos', f), 'utf8'));
    if (!p.published) continue;
    for (const n of p.photos || []) {
      if (!/^[A-Za-z0-9._-]+$/.test(n)) {
        die(`ithos/${f}: photograph "${n}" has a character that would break the srcset`);
        continue;
      }
      for (const w of QUADRO) for (const ext of ['avif', 'webp']) {
        if (!existsSync(join(PUB, 'ithos', p.photoFolder, `${n}-${w}.${ext}`))) faltam++;
      }
      for (const w of TIRA) {
        if (!existsSync(join(PUB, 'ithos', p.photoFolder, `${n}-${w}.webp`))) faltam++;
      }
    }
  }
  /* --- and the WHOLE family, which nothing else has ever looked at ----------
     The product page serves uncropped photographs from public/media/whole.
     check-output.mjs matches `src="` and never reads a srcset, so it sees one
     rung of each; the battery only knows an image once something fetched it.
     The ladder is derived from each master's own pixel size by the same
     function the build uses, so the two cannot come to disagree. */
  for (const [marca, pasta] of [['ithos', 'ithos'], ['cathelier', '_raw']]) {
    for (const f of readdirSync(join(CONTENT, marca)).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
      const p = JSON.parse(readFileSync(join(CONTENT, marca, f), 'utf8'));
      if (!p.published || !p.photoFolder) continue;
      for (const n of p.photos || []) {
        const master = marca === 'ithos'
          ? join(ROOT, 'photos', 'ithos', p.photoFolder, `${n}.jpg`)
          : join(ROOT, 'photos', 'cathelier', '_raw', `${n}.jpg`);
        if (!existsSync(master)) { falta.push(`${marca}/${f}: master ${n}.jpg`); faltam++; continue; }
        const key = marca === 'ithos' ? `ithos/${p.photoFolder}/${n}` : `cathelier/pool/${n}`;
        for (const w of rungs(shapeOf(master).w)) for (const ext of ['avif', 'webp']) {
          if (!existsSync(join(PUB, 'whole', `${key}-${w}.${ext}`))) { falta.push(`whole/${key}-${w}.${ext}`); faltam++; }
        }
      }
    }
  }

  if (faltam) {
    die(`${faltam} rendition(s) a page would ask for are not on disk — run `
      + `python3 scripts/renditions.py. Nothing else checks these: their `
      + `addresses are built at runtime or live inside a srcset, and neither `
      + `check-output.mjs nor the battery can see either. First few: `
      + falta.slice(0, 3).join(', '));
  }
}


/* --- the header shrink stays behind the reduced-motion gate ---------------
   A header that changes size as the page moves is motion, so a reader who
   asked for less of it gets a header that does not change size at all --
   doing it instantly instead of smoothly would be worse, not better.

   That only holds while EVERY rule that shrinks something sits inside the
   gate, and the trap is specificity: `[data-brand='ithos'] .head[data-shrunk]`
   outranks an ungated rule in shop.css, so one brand-file copy left outside
   would leave ithos sliding 96 -> 62 and stopping dead at 76 for exactly the
   readers who asked for no motion. The copies were deleted; this is what
   stops them coming back. */
{
  const folhas = ['base.css', 'shop.css', 'brands/ithos.css', 'brands/cathelier.css'];
  for (const f of folhas) {
    /* Comments out first, with their length preserved so the byte offsets
       still line up: this file explains the trap in prose, and a guard that
       cannot tell an explanation from a rule fires on its own documentation. */
    const css = readFileSync(join(ROOT, 'src/styles', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length));
    // os intervalos de bytes de cada bloco `prefers-reduced-motion: no-preference`
    const portoes = [];
    for (const m of css.matchAll(/@media[^{]*prefers-reduced-motion:\s*no-preference[^{]*\{/g)) {
      let i = m.index + m[0].length, nivel = 1;
      while (i < css.length && nivel > 0) {
        if (css[i] === '{') nivel++;
        else if (css[i] === '}') nivel--;
        i++;
      }
      portoes.push([m.index, i]);
    }
    for (const m of css.matchAll(/\[data-shrunk=.yes.\]/g)) {
      const dentro = portoes.some(([a, b]) => m.index > a && m.index < b);
      if (!dentro) {
        die(`${f}: a rule with [data-shrunk='yes'] sits outside the `
          + `prefers-reduced-motion: no-preference gate — readers who asked for `
          + `no motion would get a half-shrunk header`);
      }
    }
  }
}


/* A warning and never a `pending`. `pending` means "the owner has not filled
   this in yet" and kills a live build; being out of stock is a deliberate,
   legitimate state that must not stop the shop from publishing. It is still
   said out loud every build, because a thing that quietly stays out of stock
   for a year is a thing nobody remembered to put back. */
for (const [o, n] of esgotados) {
  warnings.push(`${o}: unavailable on ${n} product${n > 1 ? 's' : ''} — nobody can `
    + `choose it, and the Worker refuses it if anyone tries`);
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

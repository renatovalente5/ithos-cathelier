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
import { execFileSync } from 'node:child_process';

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
    /* The headline is set large and centred now, so its LENGTH is a layout
       decision the owner takes by typing. Thirty-eight characters is roughly
       two lines at the widest step of the clamp; past that it stops being a
       headline and starts being a paragraph in headline clothing. A warning
       and not a death: it is their shop, and a long title is ugly, not broken. */
    if (c.title && c.title.length > 38) {
      warnings.push(`covers.json: the ${brand} cover title is ${c.title.length} characters — `
        + 'it is set large and centred, and past about 38 it wraps into a wall');
    }
    if (c.text) {
      die(`covers.json: ${brand}.text is set but nothing reads it any more — `
        + 'the cover carries a short title and a button, and no sentence. Delete the field.');
    }

    /* The film is optional and deleting the line is meant to be safe, so a
       missing "film" is silence. A film that is NAMED and not on disk is not:
       that is a wasted request on the busiest page of the site. Both cuts are
       required, because the page asks for one or the other at every width and
       neither is a fallback for the other. */
    if (c.film) {
      if (!/^[a-z0-9-]+$/.test(c.film)) {
        die(`covers.json: ${brand}.film must be a plain file name — got "${c.film}"`);
      } else {
        for (const cut of [`${c.film}.mp4`, `${c.film}-tall.mp4`]) {
          if (!existsSync(join(ROOT, 'public/media/film', cut))) {
            die(`covers.json: the ${brand} cover names the film "${c.film}" and `
              + `public/media/film/${cut} is not there — run scripts/film.sh ${c.film}`);
          }
        }
      }
    }
  }
}

/* --- the cover's two numbers, checked and not claimed -----------------------
   Two things on the cover are written down in more than one language, and both
   have already gone wrong somewhere in this project: a WIDTH that a stylesheet
   and a script have to agree on, and an OPACITY that a paragraph of prose
   claims is safe. Neither shows up by looking at the site, because on the day
   they disagree the page still renders -- it just renders the wrong thing. */
{
  const css = readFileSync(join(ROOT, 'src/styles/shop.css'), 'utf8');
  const tmpl = readFileSync(join(ROOT, 'src/lib/cover.mjs'), 'utf8');
  const covers = read('settings/covers.json');
  const temFilme = Object.values(covers).some((c) => c && c.film);

  /* 1. THE COVER STILL HAS A FLAT GROUND UNDER ITS WORDS.
        This is the one that guards everything else here: every contrast number
        below is about the veil, and if the template stops emitting a veil they
        all become arithmetic about an element that is not on the page. It is
        checked against the template's text rather than against a built page so
        that it dies before the build, and it names the class explicitly so
        that renaming the class without telling anybody dies too. */
  if (!/class="cover__veil"/.test(tmpl)) {
    die('cover.mjs emits no cover__veil — text over a picture has no contrast '
      + 'anybody can measure, and every check below would be measuring nothing');
  }

  /* 2. THE VEIL IS FLAT, AND WHITE TEXT SURVIVES THE BRIGHTEST PICTURE.
        The worst ground is the brightest pixel a picture can hold, and the
        brightest there is, is white -- so the bound is the veil composited
        over white, and it holds for every photograph and film the owner will
        ever put there. A gradient has no single declared colour: its strong
        end is what a guard would read, and it would pass while its weak end
        was unreadable, which is the exact failure this check exists for. */
  const lum = (r, g, b) => {
    const ch = [r, g, b].map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const doHex = (h) => {
    const n = h.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  for (const brand of ['ithos', 'cathelier']) {
    const sheet = readFileSync(join(ROOT, 'src/styles/brands', `${brand}.css`), 'utf8');
    const veil = sheet.match(/--cover-veil:\s*([^;]+);/);
    const ink = sheet.match(/--cover-ink:\s*(#[0-9a-fA-F]{6})/);
    if (!veil || !ink) { die(`${brand}.css: cannot read --cover-veil / --cover-ink`); continue; }
    if (/gradient/i.test(veil[1])) {
      die(`${brand}.css: --cover-veil is a gradient. It has to be one flat colour at one `
        + 'opacity, or its worst case cannot be computed and this check is theatre');
      continue;
    }
    const m = veil[1].match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)/);
    if (!m) { die(`${brand}.css: --cover-veil must be rgb(R G B / A) — got "${veil[1].trim()}"`); continue; }
    const a = Number(m[4]);
    const over = [1, 2, 3].map((i) => a * Number(m[i]) + (1 - a) * 255);   // the veil over WHITE
    const [hi, lo] = [lum(...over), lum(...doHex(ink[1]))].sort((x, y) => y - x);
    const ratio = (hi + 0.05) / (lo + 0.05);
    /* 4.5 and not 3: the header floats on this veil too, and the bar's own
       words -- "Menu", and the arrow beside the other shop's mark -- are small
       text. Were the bar icons alone, 3:1 would do. */
    if (ratio < 4.5) {
      die(`${brand}: the cover veil over a white frame reads ${ratio.toFixed(2)}:1 against `
        + `${ink[1]} — below the 4.5:1 that the header's own small words need`);
    }
  }

  /* 3. THE FILM IS CUT TO THE SHAPE IT IS POURED INTO.
        Not a string comparison of two breakpoints, which passes the moment
        somebody changes both to the same wrong number. The real files are
        measured, the cover's real shapes are read out of the stylesheet, and
        the question asked is the one that matters: how much of the film
        survives object-fit: cover at that width. */
  if (temFilme) {
    /* The width is ONE constant in cover.mjs now, read by three things: the
       video's data-film-at, the picture's art-direction media query, and (via
       this guard) the stylesheet. So the constant is what gets read here, and
       the two users of it are checked to be USERS -- a literal copied back in
       would drift the day somebody moved the breakpoint. */
    const at = tmpl.match(/const SWITCH_AT = '([\d.]+)rem';/);
    if (!at) {
      die('cover.mjs: cannot read SWITCH_AT — the width the cover switches shape at');
    }
    if (!/data-film-at="\$\{SWITCH_AT\}"/.test(tmpl)) {
      die('cover.mjs: data-film-at does not use SWITCH_AT. A second copy of that width '
        + 'is how the film and the still end up switching at different places');
    }
    if (!/from: SWITCH_AT/.test(tmpl)) {
      die("cover.mjs: the picture's wide source does not use SWITCH_AT, so the still and "
        + 'the film would change shape at different widths and the cover would jump');
    }

    /* And the two still masters, which are what a visitor sees before the film
       starts and instead of it when they asked for less motion. Their shapes
       are written down in cover.mjs for the <img>'s intrinsic ratio; here the
       real files are measured, so those numbers cannot quietly stop being true. */
    for (const brand of ['ithos', 'cathelier']) {
      const c = covers[brand];
      if (!c || !c.film) continue;
      /* As formas saem do PRÓPRIO cover.mjs e não de uma cópia aqui. Uma
         guarda que compara os ficheiros com a sua própria ideia das formas
         responde a outra pergunta: valida-se a si mesma e deixa passar o
         template a mentir ao browser sobre a proporção intrínseca. */
      const leForma = (nome) => {
        const m = tmpl.match(new RegExp(`const ${nome} = \\[(\\d+), ?(\\d+)\\];`));
        return m ? [Number(m[1]), Number(m[2])] : null;
      };
      const tall = leForma('TALL'); const wide = leForma('WIDE');
      if (!tall || !wide) { die('cover.mjs: cannot read the TALL / WIDE still shapes'); continue; }
      const esperado = { '-still': tall, '-still-wide': wide };
      for (const [sufixo, [aw, ah]] of Object.entries(esperado)) {
        const master = join(ROOT, 'photos/_covers', `${c.film}${sufixo}.jpg`);
        if (!existsSync(master)) {
          die(`covers.json: the ${brand} cover names the film "${c.film}" but `
            + `photos/_covers/${c.film}${sufixo}.jpg is not there — the cover would fall back `
            + `to a photograph of something else. Run scripts/film.sh ${c.film}`);
          continue;
        }
        const { w, h } = shapeOf(master);
        const real = w / h;
        /* NaN antes de tudo, e de propósito. Isto já esteve escrito como
           `const { width, height } = shapeOf(...)` -- chaves que shapeOf não
           tem -- e o resultado não foi um erro: foi `NaN`, e QUALQUER
           comparação com NaN é falsa. A guarda existia, corria, e não podia
           disparar. Um número que não é número é a própria falha. */
        if (!Number.isFinite(real)) {
          die(`photos/_covers/${c.film}${sufixo}.jpg: could not read a shape from it `
            + `(got ${JSON.stringify(shapeOf(master))}) — the check cannot run`);
        } else if (Math.abs(real - aw / ah) > 0.02) {
          die(`photos/_covers/${c.film}${sufixo}.jpg is ${w}x${h} (${real.toFixed(3)}:1) `
            + `but cover.mjs tells the browser it is ${aw}/${ah} (${(aw / ah).toFixed(3)}:1)`);
        }
        if (!existsSync(join(ROOT, 'public/media/covers', `${c.film}${sufixo}-640.webp`))) {
          die(`photos/_covers/${c.film}${sufixo}.jpg has no renditions — run scripts/renditions.py`);
        }
      }
    }

    /* Every shape .cover__media takes, and the width each starts at. */
    const shapes = [[0, 4 / 5]];
    for (const q of css.matchAll(/@media \(width >= ([\d.]+)rem\)([\s\S]*?)\n\}/g)) {
      const ar = q[2].match(/\.cover__media\s*\{[^}]*aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
      if (ar) shapes.push([Number(q[1]), Number(ar[1]) / Number(ar[2])]);
    }
    if (shapes.length < 2) {
      die('guards: found no @media rule changing .cover__media aspect-ratio, so the film\'s '
        + 'shapes cannot be checked. Has the cover block been reformatted?');
    }
    const shapeAt = (rem) => shapes.filter(([w]) => w <= rem).pop()[1];

    const ffprobe = (file) => {
      const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file], { encoding: 'utf8' });
      const [w, h] = out.trim().split('x').map(Number);
      return w / h;
    };
    const switchAt = at ? Number(at[1]) : null;
    for (const brand of ['ithos', 'cathelier']) {
      const c = covers[brand];
      if (!c || !c.film || switchAt === null) continue;
      /* The tall cut serves everything below the switch, where the cover is at
         its tallest; the wide cut serves the switch upwards, where it is at its
         widest. Each is checked against the shape that crops it hardest. */
      const abaixo = shapes.filter(([w]) => w < switchAt).map(([, r]) => r);
      const acima = shapes.filter(([w]) => w >= switchAt).map(([, r]) => r);
      if (!abaixo.length || !acima.length) {
        die(`cover.mjs: data-film-at is ${switchAt}rem, and the cover has no shape `
          + `${abaixo.length ? 'on or above' : 'below'} that width. One of the two cuts would `
          + 'never be asked for, and the other would be poured into a frame it was not cut to');
        continue;
      }
      const casos = [
        ['tall', `${c.film}-tall.mp4`, Math.min(...abaixo)],
        ['wide', `${c.film}.mp4`, Math.max(...acima)],
      ];
      for (const [qual, file, coverAR] of casos) {
        const path = join(ROOT, 'public/media/film', file);
        if (!existsSync(path)) continue;          // already reported above
        let filmAR;
        try { filmAR = ffprobe(path); } catch {
          warnings.push(`guards: ffprobe is not available, so the ${brand} film's shape was not checked`);
          break;
        }
        /* object-fit: cover keeps min(1, coverAR/filmAR) of the width and
           min(1, filmAR/coverAR) of the height. */
        const keptW = Math.min(1, coverAR / filmAR);
        const keptH = Math.min(1, filmAR / coverAR);
        const kept = Math.min(keptW, keptH);
        if (kept < 0.8) {
          die(`${brand}: the ${qual} cut of the film keeps only ${(kept * 100).toFixed(0)}% of `
            + `itself in a ${coverAR.toFixed(2)}:1 cover — re-cut it with scripts/film.sh `
            + `${c.film}, or move data-film-at`);
        }
      }
    }
  }

  /* 1b. O LIMIAR DA BARRA ESTÁ ESCRITO EM DOIS SÍTIOS E TEM DE DIZER O MESMO.
         A linha inline no <head> decide o estado ANTES da primeira pintura, e
         o decide() do shop.js decide-o a partir daí. Se discordarem, a barra
         entra num estado e salta para o outro no primeiro quadro -- um flash
         que só aparece a quem recarrega a meio da página, que é precisamente
         quem nunca se testa. */
  {
    const shell = readFileSync(join(ROOT, 'src/lib/shell.mjs'), 'utf8');
    const js = readFileSync(join(ROOT, 'src/js/shop.js'), 'utf8');
    const noHead = shell.match(/dataset\.scrolled\s*=\s*scrollY\s*>\s*(\d+)/);
    const noScript = js.match(/const ON_AT = (\d+)/);
    if (!noHead || !noScript) {
      die('guards: cannot read the bar threshold from shell.mjs and shop.js, so the two '
        + 'copies of it cannot be checked against each other');
    } else if (noHead[1] !== noScript[1]) {
      die(`the bar's threshold disagrees: the inline script in shell.mjs says ${noHead[1]}px `
        + `and shop.js says ${noScript[1]}px — a reload part-way down a page would paint one `
        + 'state and jump to the other');
    }
  }

  /* 2a. THE BAR IS FROSTED, SO ITS GROUND HAS A WORST CASE TOO.
         Once it stops being opaque, what the bar's own words are read against
         stops being `--bg` and becomes `alpha x --bg` plus whatever is
         passing behind -- and what passes behind, on a cover page, is the dark
         part of the cover, which in pixels is nearly black. So the honest
         floor is the declared colour over BLACK, exactly as the veil's is over
         white, and it holds for any page and any photograph.
         This is not measurable from the built site either: the battery reads
         the DECLARED background and composites it over white, which is the
         kind case. The strict one is arithmetic, so it is done here. */
  {
    const lum2 = (r, g, b) => {
      const ch = [r, g, b].map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const doHex2 = (h) => {
      const n = h.replace('#', '');
      return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
    };
    for (const brand of ['ithos', 'cathelier']) {
      const sheet = readFileSync(join(ROOT, 'src/styles/brands', `${brand}.css`), 'utf8');
      const bar = sheet.match(/--head-bg:\s*rgb\(\s*(\d+) (\d+) (\d+)\s*\/\s*([\d.]+)\s*\)/);
      if (!bar) { die(`${brand}.css: cannot read --head-bg as rgb(R G B / A)`); continue; }
      const a = Number(bar[4]);
      const chao = [1, 2, 3].map((i) => a * Number(bar[i]));   // a barra sobre PRETO
      /* Os tons que o cabeçalho realmente pinta: os ícones, a palavra ao lado
         dos traços e a porta para a outra loja, e o tom de passagem do rato. */
      for (const token of ['--ink', '--ink-soft', '--accent']) {
        const m = sheet.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
        if (!m) { die(`${brand}.css: cannot read ${token}`); continue; }
        const [hi, lo] = [lum2(...chao), lum2(...doHex2(m[1]))].sort((x, y) => y - x);
        const r = (hi + 0.05) / (lo + 0.05);
        if (r < 4.5) {
          die(`${brand}: the frosted bar at ${a} opacity over a black frame reads `
            + `${r.toFixed(2)}:1 against ${token} (${m[1]}) — below 4.5:1. Raise --head-bg's `
            + 'opacity or darken that token');
        }
      }
    }
  }

  /* 2b. THE COVER'S FOUR LAYERS DECLARE THEIR ORDER.
         This one is not about tidiness, it is about a bug that fixed itself
         at the wrong moment. The layers share one grid cell, and without a
         z-index their paint order is emergent: an element whose opacity is
         BELOW 1 creates a stacking context and paints with the positioned
         boxes, above the veil, and the instant its opacity reaches exactly 1
         it stops creating one and drops below. So the film played bright for
         the 0.9s of its fade and went dark in a single frame at the end --
         measured, 0.99 rendered without the veil and 1.0 with it.
         Every layer therefore says where it belongs, and the veil has to sit
         above the film and below the words, or the whole contrast argument
         above is about a ground that is not on top of the picture. */
  {
    const ordem = ['cover__media', 'cover__film', 'cover__veil', 'cover__words'];
    const z = {};
    for (const nome of ordem) {
      const m = css.match(new RegExp(`\\.${nome}\\s*(?:,[^{]*)?\\{[^}]*?z-index:\\s*(-?\\d+)`, 's'));
      if (!m) {
        die(`shop.css: .${nome} declares no z-index. The cover's layers share one grid cell `
          + 'and an undeclared order changes by itself when an opacity transition lands on 1');
      } else z[nome] = Number(m[1]);
    }
    if (Object.keys(z).length === ordem.length) {
      for (let i = 1; i < ordem.length; i += 1) {
        if (z[ordem[i]] <= z[ordem[i - 1]]) {
          die(`shop.css: .${ordem[i]} (z-index ${z[ordem[i]]}) is not above `
            + `.${ordem[i - 1]} (z-index ${z[ordem[i - 1]]}) — the cover's layers are out of order`);
        }
      }
    }
  }

  /* 3b. THE LIST OF COVER WIDTHS IS WRITTEN TWICE, IN TWO LANGUAGES.
         scripts/renditions.py decides which renditions get WRITTEN and
         src/build.mjs decides which get PROMISED in the srcset. They have
         always been two copies; nothing noticed because they happened to
         agree. The day they stop, the failure is a promise to a file that was
         never written -- 548 broken references, which this project has already
         shipped once. */
  {
    const py = readFileSync(join(ROOT, 'scripts/renditions.py'), 'utf8')
      .match(/^COVER_WIDTHS = \(([^)]*)\)/m);
    const js = readFileSync(join(ROOT, 'src/build.mjs'), 'utf8')
      .match(/^const COVER_WIDTHS = \[([^\]]*)\]/m);
    if (!py || !js) {
      die('guards: cannot read COVER_WIDTHS from renditions.py and build.mjs, so the two '
        + 'copies of that list cannot be checked against each other');
    } else {
      const nums = (t) => t.split(',').map((x) => x.trim()).filter(Boolean).join(' ');
      if (nums(py[1]) !== nums(js[1])) {
        die(`COVER_WIDTHS disagree: renditions.py writes [${nums(py[1])}] and build.mjs `
          + `promises [${nums(js[1])}]`);
      }
    }
  }

  /* 4. THE BAR'S BACKGROUND BELONGS TO ONE FILE.
        A brand file that declares its own `.head { background }` outranks the
        shared rule and silently undoes the floating header in ONE of the two
        shops. That is precisely what cathelier.css did, and nothing could have
        told anybody: both shops build, both pass, and only one changed. */
  for (const brand of ['ithos', 'cathelier']) {
    const sheet = readFileSync(join(ROOT, 'src/styles/brands', `${brand}.css`), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = sheet.match(/\[data-brand='[a-z]+'\]\s+\.head\s*\{[^}]*background[^}]*\}/);
    if (rule) {
      die(`${brand}.css: this file declares a background on .head — it outranks the shared rule `
        + 'and would leave the bar solid in this shop and floating in the other');
    }
  }

  /* 5. THE FLOATING STATE IS NOT MOTION, AND MUST NOT BE GATED AS IF IT WERE.
        The shrink is motion and lives inside the reduced-motion gate, which is
        right. The background is a STATE: a reader who asked for less motion
        still wants a bar that is transparent at the top and solid below it,
        they just want it without the fade. Gating the state itself would leave
        them with a permanently transparent bar over the cover, forever, and no
        check anywhere. The floor below is the other half: if the rule is ever
        deleted, this dies instead of quietly passing on an empty list. */
  {
    const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const portoes = [...semComentarios.matchAll(/@media \(prefers-reduced-motion: no-preference\)\s*\{/g)]
      .map((m) => {
        let i = m.index + m[0].length, depth = 1;
        while (i < semComentarios.length && depth > 0) {
          if (semComentarios[i] === '{') depth += 1;
          if (semComentarios[i] === '}') depth -= 1;
          i += 1;
        }
        return [m.index, i];
      });
    const estados = [...semComentarios.matchAll(/html\[data-scrolled='no'\]/g)];
    if (!estados.length) {
      die("shop.css: nothing keys on html[data-scrolled='no'] — the header has no rule that "
        + 'takes its background away at the top, so the whole floating bar is gone');
    }
    for (const m of estados) {
      if (portoes.some(([a, b]) => m.index > a && m.index < b)) {
        die("shop.css: a html[data-scrolled='no'] rule sits inside the prefers-reduced-motion "
          + 'gate. That is a state, not motion: gating it leaves a reader who asked for less '
          + 'motion with a permanently transparent bar over the cover');
      }
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

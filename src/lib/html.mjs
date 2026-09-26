/* Small helpers shared by every page builder. Nothing clever lives here. */

import { t } from './i18n.mjs';
import { CARD_RATIO, cardWidths } from './photo.mjs';

/** Escape for HTML text and double-quoted attributes. */
export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* A LINK THAT COMES FROM CONTENT CAN ONLY GO TO FIVE KINDS OF PLACE.
   Content is about to be written by someone other than the programmer (the
   back office), and `esc()` only stops a value breaking out of the quotes --
   `javascript:alert(1)` has no quotes to break and ran in ithos-cathelier.pt,
   the page where the buyer types an address, a phone number and a NIF. So:
   a path on this site, an anchor, https, mailto or tel, and nothing else. A
   refusal STOPS THE BUILD and says where, the same way an unknown {{MARKER}}
   does: a link quietly dropped would be a page that lies about where it goes. */
export function safeHref(h, where = 'a link') {
  const s = String(h ?? '').trim();
  if (/^(\/(?!\/)|#|https:\/\/[^\s]|mailto:[^\s]|tel:[+0-9])/i.test(s)) return s;
  throw new Error(`${where}: "${s.slice(0, 80)}" is not an address this site links to — only /…, #…, https://…, mailto: and tel:`);
}

/* STRUCTURED DATA INSIDE <script> IS NOT HTML, AND `esc()` DOES NOT APPLY.
   JSON.stringify leaves `<` alone, so a product called
   `</script><script>…` closed the tag and ran. \u003c is the same character
   to every JSON reader and cannot close anything; U+2028/U+2029 are escaped
   because some engines still treat them as line ends inside a script. */
export const jsonInScript = (v) => JSON.stringify(v)
  .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Prices are written once, here, so the shop cannot disagree with itself. */
/* O preço: o número com vírgula decimal, e o € onde a língua o põe -- à
   frente em inglês («€24,00»), atrás nas outras («24,00 €»). O sítio do
   símbolo é uma frase do dicionário (build.euros), como no shop.js. */
export const money = (n) => t('build.euros', { n: Number(n).toFixed(2).replace('.', ',') });

/** A URL-safe slug from a name. */
export const slugify = (s) => String(s).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * A responsive <picture> over a square master.
 *
 * Both AVIF and WebP: AVIF is smaller, WebP decodes faster on a cheap phone,
 * and a cheap phone is who buys a night light at eleven at night. The browser
 * picks; the plain <img> fallback is WebP, which everything reads.
 */
export function picture({ dir, name, alt, sizes, widths, loading = 'lazy', fetchpriority }) {
  /* Por omissão, as larguras que EXISTEM para esta fotografia -- não uma lista
     fixa. Cinco masters do estúdio são pequenos de mais para o degrau de cima e
     renditions.py não o escreve; a lista fixa prometia-o na mesma. */
  widths = widths && widths.length ? widths : cardWidths(dir, name);
  /* esc() nos nomes: vêm do conteúdo (a pasta e o nome da fotografia), e o
     conteúdo escreve-o o painel. Um nome com aspas não pode abrir um atributo. */
  const set = (ext) => esc(widths.map((w) => `/media/${dir}/${name}-${w}.${ext} ${w}w`).join(', '));
  // The fallback is the LARGEST width that was actually asked for, not a fixed
  // 600: the cathelier stand-ins only go to 400, and hardcoding 600 wrote 548
  // references to files that do not exist. The intrinsic size matches it, so
  // the browser reserves the right box before anything loads.
  const biggest = Math.max(...widths);
  const attrs = [
    `src="${esc(`/media/${dir}/${name}-${biggest}.webp`)}"`,
    `alt="${esc(alt)}"`,
    /* A altura intrínseca vem da forma do cartão, não de um segundo
       "biggest". Eram iguais enquanto a família era quadrada, e isso
       escondia a suposição: declarar uma caixa quadrada para ficheiros
       3:4 faria a grelha saltar quando as fotografias chegassem. */
    `width="${biggest}" height="${Math.round(biggest * CARD_RATIO[1] / CARD_RATIO[0])}"`,
    `loading="${loading}"`,
    `decoding="async"`,
    fetchpriority ? `fetchpriority="${fetchpriority}"` : '',
  ].filter(Boolean).join(' ');
  return `<picture>
      <source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">
      <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
      <img ${attrs}>
    </picture>`;
}

/** Line-broken prose from a content field. */
export const prose = (text) => String(text || '').split(/\n{2,}/)
  .map((p) => `<p>${esc(p.trim())}</p>`).join('\n      ');

/**
 * The <picture> for a brand cover.
 *
 * Separate from picture() because that one writes width and height equal --
 * every product master is square, and a cover is the one image on the site
 * that is not. Passing a square box for a 4:5 file would reserve the wrong
 * space and shift the page the moment the photograph arrived.
 */
export function coverPicture({ name, alt, sizes, widths, aspect = [4, 5], wide = null }) {
  /* The widths are the ones that EXIST, counted off disk by the build. The
     cathelier master is an enlarged Instagram still and stops at 1600; a
     srcset promising 2600 would be 548 broken references all over again.

     ART DIRECTION, AND WHY IT IS NOT AN OPTIMISATION

     When the cover carries a film, this picture is the film's own first frame
     -- it is what a visitor sees before it starts, and what they keep if they
     asked for less motion or their connection says it is metered. The film is
     cut to two shapes, so the still has to be cut to the same two, and the
     `media` here has to name the same width the film switches at. If it did
     not, the visitor would watch the cover jump between two framings at the
     moment the film began, which is worse than either framing.

     Order matters: the browser takes the FIRST source whose media and type it
     accepts, so the wide pair has to come before the unqualified pair. The
     <img> falls back to the shape with no media query on it. */
  const set = (stem, ws, ext) =>
    ws.map((w) => `/media/covers/${stem}-${w}.${ext} ${w}w`).join(', ');
  const biggest = Math.max(...widths);
  const [aw, ah] = aspect;
  const art = wide && wide.widths.length
    ? `<source media="(min-width: ${esc(wide.from)})" type="image/avif" srcset="${set(wide.name, wide.widths, 'avif')}" sizes="${sizes}">
      <source media="(min-width: ${esc(wide.from)})" type="image/webp" srcset="${set(wide.name, wide.widths, 'webp')}" sizes="${sizes}">
      `
    : '';
  return `<picture class="cover__media">
      ${art}<source type="image/avif" srcset="${set(name, widths, 'avif')}" sizes="${sizes}">
      <source type="image/webp" srcset="${set(name, widths, 'webp')}" sizes="${sizes}">
      <img class="cover__img" src="/media/covers/${esc(name)}-${biggest}.webp" alt="${esc(alt)}"
           width="${biggest}" height="${Math.round(biggest * ah / aw)}" fetchpriority="high" decoding="async">
    </picture>`;
}

/**
 * The WHOLE photograph, uncropped, for a product page.
 *
 * picture() serves the square family, which is a CROP: on a portrait master a
 * square window throws away a third of the frame, and it threw away Santa's
 * hat. A card stays square -- a grid wants one shape -- but a product page is
 * where somebody decides, and there the photograph is shown whole.
 *
 * The rungs come from the master's own pixel size, read out of the file by
 * src/lib/photo.mjs, so a srcset can never name a width the file does not
 * have. The intrinsic width and height are the real ones, which is what stops
 * the page jumping as each slide arrives.
 */
export function wholePicture({ key, shape, alt, sizes, widths, loading = 'lazy', fetchpriority }) {
  const set = (ext) => esc(widths.map((w) => `/media/whole/${key}-${w}.${ext} ${w}w`).join(', '));
  const biggest = Math.max(...widths);
  const attrs = [
    `src="${esc(`/media/whole/${key}-${biggest}.webp`)}"`,
    `alt="${esc(alt)}"`,
    `width="${biggest}" height="${Math.round(biggest * shape.h / shape.w)}"`,
    `loading="${loading}"`,
    'decoding="async"',
    fetchpriority ? `fetchpriority="${fetchpriority}"` : '',
  ].filter(Boolean).join(' ');
  return `<picture>
      <source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">
      <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
      <img ${attrs}>
    </picture>`;
}

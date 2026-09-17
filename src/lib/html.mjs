/* Small helpers shared by every page builder. Nothing clever lives here. */

/** Escape for HTML text and double-quoted attributes. */
export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Prices are written once, here, so the shop cannot disagree with itself. */
export const money = (n) => `€${Number(n).toFixed(2).replace('.', ',')}`;

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
export function picture({ dir, name, alt, sizes, widths = [200, 400, 600, 1000], loading = 'lazy', fetchpriority }) {
  const set = (ext) => widths.map((w) => `/media/${dir}/${name}-${w}.${ext} ${w}w`).join(', ');
  // The fallback is the LARGEST width that was actually asked for, not a fixed
  // 600: the cathelier stand-ins only go to 400, and hardcoding 600 wrote 548
  // references to files that do not exist. The intrinsic size matches it, so
  // the browser reserves the right box before anything loads.
  const biggest = Math.max(...widths);
  const attrs = [
    `src="/media/${dir}/${name}-${biggest}.webp"`,
    `alt="${esc(alt)}"`,
    `width="${biggest}" height="${biggest}"`,
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
export function coverPicture({ name, alt, sizes, widths }) {
  /* The widths are the ones that EXIST, counted off disk by the build. The
     cathelier master is an enlarged Instagram still and stops at 1600; a
     srcset promising 2600 would be 548 broken references all over again. */
  const set = (ext) => widths.map((w) => `/media/covers/${name}-${w}.${ext} ${w}w`).join(', ');
  const biggest = Math.max(...widths);
  return `<picture class="cover__media">
      <source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">
      <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
      <img class="cover__img" src="/media/covers/${esc(name)}-${biggest}.webp" alt="${esc(alt)}"
           width="${biggest}" height="${Math.round(biggest * 5 / 4)}" fetchpriority="high" decoding="async">
    </picture>`;
}

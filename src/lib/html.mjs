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
  const attrs = [
    `src="/media/${dir}/${name}-600.webp"`,
    `alt="${esc(alt)}"`,
    'width="600" height="600"',
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

/*
 * The cover: one photograph filling the first screen, and the brand's words
 * over it.
 *
 * Both are read from content/settings/covers.json, so the owner changes the
 * headline, the sentence under it and the button from the back office without
 * anyone touching a template. Replacing the picture is replacing one file in
 * photos/_covers/ and running scripts/covers.py.
 *
 * WHY THE SCRIM IS FLAT AND NOT A GRADIENT
 *
 * Text over a photograph has no measurable contrast: the ground is whatever
 * the picture happens to be at that pixel. A gradient is worse than useless
 * here -- the guard reads the declared colour, which is the strong end, and
 * passes while the weak end is unreadable. So the words sit on a FLAT panel at
 * a known opacity, and the worst case can be computed rather than hoped for:
 * at 92% cream, the darkest photograph underneath can move the panel by at
 * most 8% toward black, and scripts/check-output.mjs checks that composite,
 * not the ideal one.
 */
import { esc, coverPicture } from './html.mjs';

/**
 * @param {object} c      the brand's block of covers.json
 * @param {string} brand  'ithos' | 'cathelier' -- names the picture file
 */
export function cover(c, brand, widths) {
  const focus = `--cover-focus:${esc(c.focus || '50% 50%')};`
    + `--cover-focus-wide:${esc(c.focusWide || c.focus || '50% 50%')}`;

  return `
<section class="cover" style="${focus}">
  ${coverPicture({
    name: brand,
    alt: c.alt || '',
    widths,
    /* The cover is always the full width of the screen, so the browser needs
       no arithmetic: 100vw is the honest answer at every breakpoint. */
    sizes: '100vw',
  })}
  <div class="cover__words">
    <div class="cover__panel">
      <h1 class="cover__title">${esc(c.title)}</h1>
      ${c.text ? `<p class="cover__text">${esc(c.text)}</p>` : ''}
      ${c.buttonLabel && c.buttonHref
        ? `<a class="btn cover__btn" href="${esc(c.buttonHref)}">${esc(c.buttonLabel)}</a>`
        : ''}
    </div>
  </div>
</section>`;
}

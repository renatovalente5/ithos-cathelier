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
 * a known opacity, and the worst case can be computed rather than hoped for.
 * The panel is 72% cream, so at most 28% of whatever is behind shows through,
 * and the worst thing that can be behind is black: that composite still reads
 * better than 5.5:1 against the ink, above the 4.5:1 minimum. And it is
 * scripts/guards.mjs that computes it, not this paragraph -- a number written
 * in prose stops being true the day somebody nudges the token.
 *
 * THIS IS WHY A FILM BEHIND THE WORDS IS SAFE
 *
 * A moving picture has a different ground in every frame, and no measurement
 * of one frame would say anything about the next. It needs none: the bound
 * above is over BLACK, and nothing a film can do is darker than black. The
 * film changes what is behind the panel, never what the panel guarantees.
 */
import { esc, coverPicture } from './html.mjs';

/*
 * THE FILM, AND EVERYTHING IT IS NOT ALLOWED TO BREAK
 *
 * A night light's whole argument is that it glows in a dark room, and that is
 * the one thing a photograph of it cannot show. So the film earns its place.
 * What it must not do is take anything away from the page that is already
 * there, and that is four separate promises, each kept somewhere different:
 *
 * 1. THE RESTING STATE IS THE PHOTOGRAPH. The element below carries no `src`.
 *    Nothing is fetched and nothing moves until shop.js decides it should, so
 *    a page with no JavaScript, a refused autoplay and a file that 404s all
 *    land in the same place: the cover as it was before any of this existed.
 *    That is why there is no `poster` either -- a poster would be a second
 *    resting state to keep matched to the first.
 *
 * 2. IT NEVER PLAYS ON A PHONE. Not for the bytes, though 2 MB on somebody's
 *    data is reason enough. The cover is 4:5 on a phone and the film is 16:9:
 *    filling that shape crops the sides away, and the lamps live near them.
 *    The film runs from 64rem up, which is exactly where the CSS makes the
 *    cover 16:9 and the two shapes agree. That number is written once, in
 *    data-film-from, and shop.js reads it from there rather than keeping its
 *    own copy -- a media query in the script that drifts from the one in the
 *    stylesheet is a bug this project has already paid for once.
 *
 * 3. IT NEVER PLAYS FOR SOMEBODY WHO ASKED FOR STILLNESS. A moving background
 *    behind text is the exact thing prefers-reduced-motion exists to stop.
 *
 * 4. IT IS DECORATION, NOT CONTENT. Everything the film says, the photograph
 *    under it already says in its alt text, so this is aria-hidden and has no
 *    controls -- which also keeps it out of the tab order.
 */
function film(c) {
  if (!c.film) return '';
  return `<video class="cover__film" data-film="/media/film/${esc(c.film)}.mp4"
    data-film-from="64rem" preload="none" muted loop playsinline aria-hidden="true"></video>`;
}

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
  ${film(c)}
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

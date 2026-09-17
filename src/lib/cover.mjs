/*
 * The cover: one picture filling the first screen, a few words over it, and
 * the header floating on top of both.
 *
 * The words are read from content/settings/covers.json, so the owner changes
 * the headline and the button from the back office without anyone touching a
 * template. Replacing the picture is replacing one file in photos/_covers/ and
 * running scripts/covers.py; replacing the film is scripts/film.sh.
 *
 * WHY THERE IS A FLAT VEIL AND NOT A PANEL, AND NOT A GRADIENT
 *
 * Text over a picture has no contrast anybody can measure: the ground is
 * whatever the picture happens to be at that pixel. The words used to sit on a
 * cream PANEL for exactly that reason -- a small flat rectangle whose worst
 * case was arithmetic. Centring the words and taking the panel away was
 * measured before it was done, on the built pages: a centred block over the
 * ithos photograph reads 1.11:1 with the brand's ink and 2.02:1 in white, and
 * over the cathelier photograph 1.00:1 and 1.28:1. That is not "a bit low", it
 * is invisible, and it fails even the 3:1 that large text is allowed.
 *
 * So the flat ground did not go away, it grew: the whole cover now carries one
 * veil at one declared opacity, and the words sit on it in white. A gradient
 * would be worse than useless -- a guard reads the declared colour, which is
 * the strong end, and passes while the weak end is unreadable.
 *
 * WHERE 56% COMES FROM, AND WHY IT IS NOT A TASTE DECISION
 *
 * The worst ground is the brightest pixel the picture can hold, and this
 * picture holds the brightest one there is: every single one of the film's 922
 * frames contains a clipped white pixel, because the subject is lit LEDs, and
 * 909 of them have one inside the box the headline sits in. So the bound is
 * the same one a sheet of white paper would give, and it is honest for every
 * film and photograph the owner will ever put here. Black over white at 53.5%
 * is where small white text reaches 4.5:1. The veil is set above that, and
 * scripts/guards.mjs computes it rather than trusting this paragraph.
 *
 * The header's own words are what force the small-text threshold. Were the bar
 * icons alone, 42% would do -- non-text controls are allowed 3:1 -- but the
 * burger has the word "Menu" beside it and words are read, not recognised.
 */
import { esc, coverPicture } from './html.mjs';

/* THE ONE WIDTH THIS WHOLE COVER TURNS ON.
 *
 * Below it the cover is a tall frame and the page asks for the tall cut of the
 * film and the tall still; from it up, the wide ones. Three things have to
 * agree about that number -- the <picture>'s media query, the video's
 * data-film-at, and the stylesheet's own breakpoint where .cover__media stops
 * being tall -- and they agree here, once, by being the same constant.
 * scripts/guards.mjs checks it against the stylesheet, which cannot import it. */
const SWITCH_AT = '48rem';

/* The shapes the two cuts are cut to, by scripts/film.sh. They are written
 * down because the <img> needs an intrinsic ratio, and they are CHECKED --
 * guards.mjs measures the real files and dies if these stop being true. */
const TALL = [2, 3];
const WIDE = [16, 9];

/*
 * THE FILM, AND THE FOUR THINGS IT IS NOT ALLOWED TO BREAK
 *
 * A night light's whole argument is that it glows in a dark room, and that is
 * the one thing a photograph of it cannot show. What the film must not do is
 * take anything away from the page that is already there:
 *
 * 1. THE RESTING STATE IS STILL THE PHOTOGRAPH. The element below carries no
 *    src. Nothing is fetched and nothing moves until shop.js decides it
 *    should, so a page with no JavaScript, a refused autoplay and a file that
 *    404s all land in the same place: the cover as it was before any of this
 *    existed. That is also why there is no poster -- a poster would be a
 *    second resting state to keep matched to the first.
 *
 * 2. IT IS CUT TO THE SHAPE OF THE SCREEN IT PLAYS ON. The cover is a tall
 *    frame on a phone and a wide one on a laptop, and a 16:9 film poured into
 *    a phone's frame loses 62% of its width -- which is where the lamps live.
 *    So there are two encodes, and data-film-at names the width where the page
 *    stops asking for the tall one. That number mirrors the stylesheet and is
 *    read from this one attribute rather than copied into the script, because
 *    a media query in JavaScript that drifts from the one in the CSS is a bug
 *    this project has already paid for.
 *
 * 3. IT NEVER PLAYS FOR SOMEBODY WHO ASKED FOR STILLNESS, or on a connection
 *    that says it is metered.
 *
 * 4. IT IS DECORATION. Everything the film says, the photograph under it
 *    already says in its alt text, so this is aria-hidden and has no controls,
 *    which also keeps it out of the tab order.
 */
function film(c) {
  if (!c.film) return '';
  return `<video class="cover__film"
    data-film="/media/film/${esc(c.film)}.mp4"
    data-film-tall="/media/film/${esc(c.film)}-tall.mp4"
    data-film-at="${SWITCH_AT}" preload="none" muted loop playsinline aria-hidden="true"></video>`;
}

/**
 * @param {object} c      the brand's block of covers.json
 * @param {string} brand  'ithos' | 'cathelier'
 * @param {object} art    {name, widths, wideName, wideWidths} -- the cover
 *                        renditions that actually exist, counted off disk.
 *                        With a film these are its own frames; without one,
 *                        the photographic master, and wideWidths is empty.
 */
export function cover(c, brand, art) {
  const focus = `--cover-focus:${esc(c.focus || '50% 50%')};`
    + `--cover-focus-wide:${esc(c.focusWide || c.focus || '50% 50%')}`;
  const temFilme = !!c.film;

  return `
<section class="cover" style="${focus}">
  ${coverPicture({
    name: art.name,
    alt: c.alt || '',
    widths: art.widths,
    aspect: temFilme ? TALL : [4, 5],
    wide: temFilme ? { name: art.wideName, widths: art.wideWidths, from: SWITCH_AT, aspect: WIDE } : null,
    /* The cover is always the full width of the screen, so the browser needs
       no arithmetic: 100vw is the honest answer at every breakpoint. */
    sizes: '100vw',
  })}
  ${film(c)}
  <div class="cover__veil"></div>
  <div class="cover__words">
    <div class="cover__block">
      <h1 class="cover__title">${esc(c.title)}</h1>
      ${c.buttonLabel && c.buttonHref
        ? `<a class="btn cover__btn" href="${esc(c.buttonHref)}">${esc(c.buttonLabel)}</a>`
        : ''}
    </div>
  </div>
</section>`;
}

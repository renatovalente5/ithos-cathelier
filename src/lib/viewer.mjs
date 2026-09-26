import { icon } from './icons.mjs';
import { esc } from './html.mjs';
import { t } from './i18n.mjs';

/* The full-size viewer, written as a SIBLING of the product section and never
 * inside the gallery.
 *
 * .gallery is overflow:hidden, which clips a non-modal dialog -- the state
 * show() produces, and the state the battery opens one in. And the track takes
 * an inline translate on the first arrow click, which makes it the containing
 * block for anything fixed inside it, so a viewer nested there would be
 * dragged sideways along with the slides.
 *
 * It ships EMPTY. The photograph is put in when it opens, which means a
 * product page carries no second copy of an image nobody has asked to see, and
 * the biggest rendition is only ever fetched by someone who wants it.
 * (Also: no HTML comment in here. This note would otherwise be served to every
 * visitor who opens the page source.)
 */
export function viewer() {
  return `<dialog class="lightbox" id="photo" aria-label="${esc(t('visor.rotulo'))}">
  <div class="lightbox__bar">
    <button class="icon-btn lightbox__close" type="button" data-box-close aria-label="${esc(t('visor.fechar'))}">${icon('close', 24)}</button>
  </div>
  <div class="lightbox__stage" data-box-stage></div>
</dialog>`;
}


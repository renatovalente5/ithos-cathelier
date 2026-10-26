/* «AVISE-ME QUANDO VOLTAR» (a Cathia, 26 out 2026).
 *
 * Uma janela por página de produto, que se abre de dois sítios:
 *   · «Avise-me quando houver em stock», por baixo do prazo de um candeeiro
 *     -- escondido, e o shop.js mostra-o quando a escolha não tem stock (o
 *     candeeiro vende-se na mesma, por encomenda: é para quem prefere
 *     esperar);
 *   · «Avise-me quando «…» voltar», por baixo de uma escolha «Esgotado por
 *     agora».
 * O shop.js diz à janela o que é e manda o pedido ao Worker (POST /aviso,
 * src/avisos.js na API). O quadrado das novidades vem DESMARCADO: é um
 * consentimento à parte, para publicidade (Lei 41/2004, art. 13.º-A), e só
 * conta depois de confirmado no email. O campo «site» está escondido de quem
 * lê: um robô preenche-o, e o Worker deita esse pedido fora. */
import { esc } from './html.mjs';
import { icon } from './icons.mjs';
import { t } from './i18n.mjs';

export function janelaDoAviso(slug) {
  return `<dialog class="avisar" data-avisar data-produto="${esc(slug)}" aria-labelledby="avisar-titulo"
      data-titulo-stock="${esc(t('paginas.avisar.tituloStock'))}" data-titulo-escolha="${esc(t('paginas.avisar.tituloEscolha'))}">
      <form method="dialog"><button class="avisar__fechar" value="fechar" aria-label="${esc(t('paginas.avisar.fechar'))}">${icon('close', 20)}</button></form>
      <form class="avisar__form" data-avisar-form novalidate>
        <h2 id="avisar-titulo" data-avisar-titulo>${esc(t('paginas.avisar.tituloStock'))}</h2>
        <p class="avisar__o-que" data-avisar-o-que></p>
        <label class="avisar__rotulo" for="avisar-email">${esc(t('paginas.avisar.email'))}</label>
        <input class="avisar__email" id="avisar-email" type="email" name="email" autocomplete="email" inputmode="email" maxlength="254" required>
        <div class="avisar__mel" aria-hidden="true"><label>Site <input type="text" name="site" tabindex="-1" autocomplete="off"></label></div>
        <label class="avisar__novidades"><input type="checkbox" name="novidades"><span>${esc(t('paginas.avisar.novidades'))}</span></label>
        <button class="btn btn--wide" type="submit" data-avisar-enviar>${esc(t('paginas.avisar.enviar'))}</button>
        <p class="avisar__nota" data-avisar-nota role="status" hidden></p>
        <p class="avisar__legal">${esc(t('paginas.avisar.legal'))} <a href="/legal/privacy/">${esc(t('paginas.avisar.privacidade'))}</a></p>
      </form>
    </dialog>`;
}

/** O de um candeeiro sem stock, por baixo do prazo. */
export const botaoDoStock = () => `<button type="button" class="avisar__abrir" data-avisar-stock hidden>${icon('bell', 15)}<span>${esc(t('paginas.avisar.abrirStock'))}</span></button>`;

/** O de uma escolha esgotada, por baixo das escolhas. */
export function botoesDasEscolhas(o) {
  const off = (o.values ?? []).filter((v) => v.available === false);
  return off.map((v) => `<button type="button" class="avisar__abrir" data-avisar-opcao="${esc(o.id)}" data-avisar-valor="${esc(v.id)}" data-avisar-nome="${esc(v.name)}">${icon('bell', 15)}<span>${esc(t('paginas.avisar.abrirEscolha', { valor: v.name }))}</span></button>`).join('\n        ');
}

/* «AVISE-ME QUANDO VOLTAR» (a Cathia, 26 out 2026).
 *
 * Uma janela por página de produto, que se abre do sininho no botão de uma
 * escolha esgotada (o Renato, 8 nov 2026: «podia ficar apenas com o icon do
 * sininho» -- saíram o «Esgotado por agora» e a linha «Avise-me quando…»; o
 * nome da escolha vai no aria-label e na própria janela). Um candeeiro sem
 * stock não leva aviso: vende-se na mesma, por encomenda, e escolher as duas
 * coisas não fazia sentido (a Cathia, 27 out 2026: «deixamos comprar na
 * mesma»).
 * O shop.js diz à janela o que é e manda o pedido ao Worker (POST /aviso,
 * src/avisos.js na API). O quadrado das novidades vem DESMARCADO: é um
 * consentimento à parte, para publicidade (Lei 41/2004, art. 13.º-A), e só
 * conta depois de confirmado no email. O campo «site» está escondido de quem
 * lê: um robô preenche-o, e o Worker deita esse pedido fora. */
import { esc } from './html.mjs';
import { icon } from './icons.mjs';
import { t } from './i18n.mjs';

export function janelaDoAviso(slug) {
  return `<dialog class="avisar" data-avisar data-produto="${esc(slug)}" aria-labelledby="avisar-titulo">
      <form method="dialog"><button class="avisar__fechar" value="fechar" aria-label="${esc(t('paginas.avisar.fechar'))}">${icon('close', 20)}</button></form>
      <form class="avisar__form" data-avisar-form novalidate>
        <h2 id="avisar-titulo">${esc(t('paginas.avisar.tituloEscolha'))}</h2>
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

/** O sininho de uma escolha esgotada, por cima do botão dela. Não pode ir DENTRO
    do <label>: um botão é um elemento rotulável, e o rótulo passava a ter dois. */
export function sinoDaEscolha(o, v) {
  return `<button type="button" class="avisar__abrir avisar__sino" data-avisar-opcao="${esc(o.id)}" data-avisar-valor="${esc(v.id)}" data-avisar-nome="${esc(v.name)}" aria-label="${esc(t('paginas.avisar.abrirEscolha', { valor: v.name }))}">${icon('bell', 19)}</button>`;
}

/** Uma escolha: o rótulo, e, se estiver esgotada, o rótulo com o sininho por cima. */
export const comSino = (o, v, rotulo) => (v.available === false ? `<div class="choice-esgotada">${rotulo}${sinoDaEscolha(o, v)}</div>` : rotulo);

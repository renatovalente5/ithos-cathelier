/* AS PEÇAS LEGAIS COMUNS, vestidas para este site.
 *
 * A biblioteca vive em legal-comum/ (cópia de _ferramentas/legal-comum,
 * instalada por `node …/legal-comum/instalar.mjs <este repo>`; a versão está em
 * legal-comum/VERSION e em .legal-comum.json). NÃO SE EDITA AQUI: o que lhe
 * falte adapta-se neste ficheiro, com o porquê escrito ao lado.
 *
 * A BIBLIOTECA ESCREVE EM PORTUGUÊS, E O SITE TEM DUAS LÍNGUAS. As frases do
 * código saem do dicionário (src/i18n/<língua>/paginas.json), que o Worker
 * traduz sozinho. Por isso cada texto da biblioteca passa pelo dicionário:
 * em português, `frase()` EXIGE que a entrada do dicionário seja igual à que a
 * biblioteca gera agora -- se a biblioteca mudar, a construção pára e diz que
 * chave actualizar --; nas outras línguas sai a tradução (ou o português, até
 * o Worker a fazer). Assim a biblioteca continua a ser a origem, e a tradução
 * continua a ser automática.
 *
 * O que vem da dona (os meios de pagamento, o nome do botão) entra por
 * variáveis `{…}`, nunca escrito na frase do dicionário: uma mudança no painel
 * não pode parar a publicação. */
import {
  VERSAO, LIVRO_URL, livroReclamacoes, livroCss,
  ralHtml, ralTexto, FRASE_RAL,
  AVISO_RETOMA, COMO_SE_FAZ_A_ENCOMENDA, BOTAO_ENCOMENDA,
  destinatarios, destinatariosHtml, CATALOGO_DESTINATARIOS,
  textoDefinicoesCookies, esc as escBiblioteca,
} from '../../legal-comum/index.mjs';
import { t, lingua, LOCALE, ORIGEM } from './i18n.mjs';
import { esc, noutroSeparador } from './html.mjs';

export { LIVRO_URL, VERSAO as VERSAO_LEGAL_COMUM };

/* Uma frase da biblioteca pelo dicionário. Em português confere; nas outras
   línguas traduz. `vars` são as variáveis `{x}` que a frase do dicionário
   deixa em aberto (o português gerado pela biblioteca tem de as trazer também,
   por isso quem chama gera a frase da biblioteca com «{x}» no lugar). */
function frase(chave, textoPt, vars) {
  if (lingua() === ORIGEM) {
    const d = t(chave);
    if (d !== textoPt) {
      throw new Error(`src/i18n/pt/paginas.json: «${chave}» não é o texto que a biblioteca legal-comum v${VERSAO} gera agora.\n`
        + `  dicionário: ${d}\n  biblioteca: ${textoPt}\n  (actualiza o dicionário, ou a adaptação em src/lib/legal.mjs)`);
    }
  }
  return t(chave, vars);
}

/* A mesma conferência para um texto que a biblioteca traz DENTRO de um HTML
   (os textos de enquadramento da RAL, as finalidades da tabela da
   privacidade): o HTML da biblioteca tem de o conter, escapado como ela
   escapa. */
function conferirNaBiblioteca(html, textoPt, onde) {
  if (lingua() === ORIGEM && !html.includes(escBiblioteca(textoPt))) {
    throw new Error(`legal-comum v${VERSAO} já não escreve «${textoPt}» em ${onde}: rever src/lib/legal.mjs e o dicionário`);
  }
}

/* --- retoma (DL 152-D/2017, art. 13.º) ------------------------------------- */

const RETOMA_PT = AVISO_RETOMA({ tipos: ['eee', 'pilhas'] });

/** O aviso da retoma gratuita dos candeeiros usados e das pilhas, em texto. */
export const avisoRetoma = () => frase('paginas.retoma.aviso', RETOMA_PT);

/** O mesmo, num parágrafo (para as páginas). */
export const blocoRetoma = () => `<p class="retoma">${esc(avisoRetoma())}</p>`;

/* --- Livro de Reclamações (DL 156/2005, art. 5.º-B) ----------------------- */

/* A ligação, DISCRETA (o Renato, 22 out 2026: «quero algo mais discreto»):
   o ícone pequeno do livro e o texto, com a letra e a cor das outras ligações
   à volta, sem caixa nem fundo (variante por omissão da legal-comum v1.1.0).
   Entre marcadores de versão (verificar-versoes.mjs lê-os). */
export function livroLigacao() {
  const a = livroReclamacoes({ texto: t('shell.rodape.reclamacoes'), lingua: LOCALE[lingua()] });
  return `<!-- legal-comum:livro v${VERSAO} -->${a}<!-- /legal-comum:livro -->`;
}

/** O CSS da ligação (da biblioteca; traz também o da variante em botão). */
export const livroEstilos = () => livroCss('lr-botao');

/* --- RAL (Lei 144/2015, art. 18.º) ----------------------------------------- */

/* Os textos de enquadramento que a biblioteca não exporta um a um: aqui em
   português e conferidos contra o HTML dela. */
const RAL_PT = {
  enquadramento: FRASE_RAL,
  supletivoNacional: 'para quem resida fora das áreas dos outros centros',
  lista: 'A lista actualizada das entidades está no',
  portal: 'Portal do Consumidor',
};

function textosRal() {
  const ref = ralHtml({ ambito: 'nacional' });
  for (const v of Object.values(RAL_PT)) conferirNaBiblioteca(ref, v, 'ralHtml');
  return Object.fromEntries(Object.entries(RAL_PT).map(([k, v]) => [k, frase(`paginas.ral.${k}`, v)]));
}

/** Os dez centros, com a frase do centro competente, para as páginas. */
/* A biblioteca já abre os centros noutro separador; o site junta o aviso para
   quem usa um leitor de ecrã, como nas outras ligações para fora (html.mjs). */
export const ralBloco = () => ralHtml({ ambito: 'nacional', lingua: LOCALE[lingua()], textos: textosRal(), classe: 'ral' })
  .replace(/(<a [^>]*target="_blank"[^>]*>)([^<]*)<\/a>/g, (_, abre, txt) => `${abre}${txt}${noutroSeparador()}</a>`);

/** O mesmo em texto (para o ficheiro das condições que vai no PDF). */
export const ralTextoDoSite = () => ralTexto({ ambito: 'nacional', textos: textosRal() });

/* --- como se faz uma encomenda (DL 7/2004, arts. 27.º a 31.º) ------------- */

/* As adaptações a esta loja, cada uma com o porquê:
   · «carrinho» → «cesto»: é a palavra do site inteiro;
   · «Encomendar com obrigação de pagar» → o botão desta loja («Encomendar e
     pagar», que cumpre o art. 5.º n.º 4 do DL 24/2014 e é o que o cesto tem);
   · «o preço total com IVA» → «o preço total»: a loja não cobra IVA (art. 53.º
     do CIVA) e diz-o ao lado dos preços;
   · o passo 4 inteiro: aqui o aviso de recepção e a confirmação não são sempre
     dois emails -- no MB WAY e no cartão a confirmação segue assim que o
     pagamento entra, no Multibanco segue primeiro o aviso com a referência.
   Os meios de pagamento e o nome do botão ficam como variáveis. */
const PASSO4_BIBLIOTECA = /^Recebe logo um aviso de recepção por email/;
const PASSO4_SITE = 'Recebe logo um email: o aviso de receção da encomenda ou, assim que o pagamento é confirmado, a confirmação da encomenda com as condições inteiras em anexo (PDF) — sempre antes da entrega.';

function passosPt() {
  const html = COMO_SE_FAZ_A_ENCOMENDA({
    canal: 'site', pagamentos: ['{pagamentos}'], linguas: ['português', 'inglês'],
    urlTermos: '/legal/terms/', arquivo: '90 dias (a fatura, 10 anos)',
  });
  const passos = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  if (passos.length !== 6) throw new Error(`legal-comum v${VERSAO}: COMO_SE_FAZ_A_ENCOMENDA já não tem 6 passos — rever src/lib/legal.mjs`);
  if (!PASSO4_BIBLIOTECA.test(passos[3])) throw new Error(`legal-comum v${VERSAO}: o passo 4 de COMO_SE_FAZ_A_ENCOMENDA mudou — rever a adaptação em src/lib/legal.mjs`);
  return passos.map((p, i) => (i === 3 ? PASSO4_SITE : p
    .replaceAll('carrinho', 'cesto')
    .replaceAll(`«${BOTAO_ENCOMENDA}»`, '«{botao}»')
    .replaceAll('o preço total com IVA', 'o preço total')));
}

function passos({ shop }) {
  const vars = { pagamentos: shop.payment?.methods ?? t('paginas.pagamento.metodos'), botao: t('paginas.botao.encomendarEPagar') };
  return passosPt().map((p, i) => frase(`paginas.comoEncomendar.${i + 1}`, p, vars));
}

/** A lista ordenada dos seis passos, para as condições de venda. */
export function comoSeFazBloco({ shop }) {
  return `<ol class="como-encomendar" lang="${LOCALE[lingua()]}">\n${passos({ shop }).map((p) => `<li>${p}</li>`).join('\n')}\n</ol>`;
}

/** Os mesmos passos em texto, numerados; as ligações ficam entre parênteses. */
export function comoSeFazTexto({ shop, abs = (u) => u }) {
  return passos({ shop })
    .map((p, i) => `${i + 1}. ${p.replace(/<a href="([^"]+)">([^<]*)<\/a>/g, (_, u, txt) => `${txt} (${abs(u)})`).replace(/<[^>]+>/g, '')}`)
    .join('\n');
}

/* --- privacidade: quem recebe mesmo os dados (RGPD, arts. 13.º e 28.º) ---- */

/* Os fornecedores desta loja. A Cloudflare serve o site, corre a API e a zona
   DNS; a caixa de correio da dona é um Outlook da Microsoft; o mapa é da
   Google e só carrega ao clique; o WhatsApp, o Instagram e o Facebook são da
   Meta; os emails saem pela Resend; o pagamento é da ifthenpay. */
export const FORNECEDORES = Object.freeze({
  alojamento: 'cloudflare', dns: 'cloudflare', email: 'microsoft', mapas: 'google',
  whatsapp: true, instagram: true, facebookPage: true, envioEmails: 'resend', pagamentos: ['ifthenpay'], analytics: null,
});

/* O que a biblioteca não diz e esta loja precisa de dizer (acrescentado à
   finalidade dela, nunca no lugar): a folha de cada encomenda chega à caixa
   Outlook; a ifthenpay recebe também os pagamentos por cartão, Google Pay e
   Apple Pay. E o GitHub, que a biblioteca só conhece como alojamento (aqui
   não o é): guarda o código e os textos do site e constrói-o. */
const EXTRA_FINALIDADE = {
  microsoft: 'e a folha de cada encomenda, que nos chega por email (nome, morada, telefone, email, NIF e artigos)',
  ifthenpay: 'pagamentos por cartão, Google Pay e Apple Pay (o seu nome, o seu email e o valor; no MB WAY, o seu número de telemóvel)',
};
const GITHUB = {
  chave: 'github', ...CATALOGO_DESTINATARIOS.github,
  finalidade: 'o código e os textos do site e a sua construção (nunca os dados das encomendas)',
};
const PAIS_CHAVE = { EUA: 'eua', 'EUA / Irlanda': 'euaIrlanda', Portugal: 'portugal' };
const TRANSFERENCIA_PT = {
  DPF: 'EUA: consta da lista do Data Privacy Framework (decisão de adequação da Comissão Europeia)',
  UE: 'Sem transferência: os dados ficam na União Europeia',
};
const CABECALHO_PT = { quem: 'Quem', paraQue: 'Para quê', onde: 'Onde', transferencia: 'Transferência para fora da UE' };

/** A lista dos destinatários (os da biblioteca e o GitHub), na ordem da página. */
export function listaDestinatarios() {
  const lista = destinatarios(FORNECEDORES);
  const ordem = ['ifthenpay', 'resend', 'microsoft', 'cloudflare', 'meta', 'google'];
  const ordenada = ordem.map((k) => lista.find((d) => d.chave === k)).filter(Boolean);
  if (ordenada.length !== lista.length) throw new Error('legal-comum: destinatarios() devolveu uma entidade que a página não ordena — rever src/lib/legal.mjs');
  return [...ordenada, GITHUB];
}

/** A tabela dos destinatários, com as palavras pelo dicionário. */
export function destinatariosBloco() {
  const ref = destinatariosHtml(FORNECEDORES);
  for (const v of Object.values(CABECALHO_PT)) conferirNaBiblioteca(ref, v, 'destinatariosHtml');
  for (const v of Object.values(TRANSFERENCIA_PT)) conferirNaBiblioteca(ref, v, 'destinatariosHtml');
  const cab = Object.fromEntries(Object.entries(CABECALHO_PT).map(([k, v]) => [k, frase(`paginas.destinatarios.${k}`, v)]));
  const linhas = listaDestinatarios().map((d) => {
    const base = d.chave === 'github' ? d.finalidade : (conferirNaBiblioteca(ref, d.finalidade, 'destinatariosHtml'), d.finalidade);
    const fin = frase(`paginas.destinatarios.f.${d.chave}`, EXTRA_FINALIDADE[d.chave] ? `${base}; ${EXTRA_FINALIDADE[d.chave]}` : base);
    const paisChave = PAIS_CHAVE[d.pais];
    if (!paisChave) throw new Error(`legal-comum: país «${d.pais}» sem chave no dicionário (src/lib/legal.mjs, PAIS_CHAVE)`);
    const pais = frase(`paginas.destinatarios.pais.${paisChave}`, d.pais);
    if (!TRANSFERENCIA_PT[d.transferencia]) throw new Error(`legal-comum: transferência «${d.transferencia}» de ${d.nome} sem texto conferido (src/lib/legal.mjs)`);
    const tr = frase(`paginas.destinatarios.${d.transferencia}`, TRANSFERENCIA_PT[d.transferencia]);
    return `<tr><td>${esc(d.nome)}</td><td>${esc(fin)}</td><td>${esc(pais)}</td><td>${esc(tr)}</td></tr>`;
  });
  return [
    `<div class="table-wrap"><table class="destinatarios" lang="${LOCALE[lingua()]}">`,
    `<thead><tr><th scope="col">${esc(cab.quem)}</th><th scope="col">${esc(cab.paraQue)}</th><th scope="col">${esc(cab.onde)}</th><th scope="col">${esc(cab.transferencia)}</th></tr></thead>`,
    '<tbody>', ...linhas, '</tbody></table></div>',
  ].join('\n');
}

/** A mesma lista em texto. */
export function destinatariosTexto() {
  return listaDestinatarios().map((d) => {
    const fin = EXTRA_FINALIDADE[d.chave] ? `${d.finalidade}; ${EXTRA_FINALIDADE[d.chave]}` : d.finalidade;
    return `- ${d.nome} (${d.pais}): ${fin}. ${TRANSFERENCIA_PT[d.transferencia] ?? d.transferencia}.`;
  }).join('\n');
}

/* --- o mapa e o que o browser guarda (Lei 41/2004, art. 5.º) --------------- */

/* A primeira frase é a segunda de textoSemCookies() da biblioteca, com «o
   mapa da página de contactos» no lugar de «o mapa» e sem a primeira frase
   dela («não grava nada antes de uma escolha sua»): o cesto, a sessão de
   revendedor e o contador da janela da campanha também ficam no aparelho, e a
   política já os explica um a um. A segunda é textoDefinicoesCookies(). */
const MAPA_PT = 'O mapa da página de contactos só é carregado dos servidores da Google depois de carregar em «{botao}», e essa escolha fica guardada no seu aparelho (localStorage) até a retirar em «{retirar}».';

export function cookiesMapaTextos() {
  const vars = { botao: t('paginas.contacto.mapa'), retirar: t('paginas.contacto.mapaRetirar') };
  return [
    frase('paginas.cookies.mapa', MAPA_PT, vars),
    frase('paginas.cookies.retirar', textoDefinicoesCookies({ textoRetirar: '{retirar}' }), vars),
  ];
}

export const cookiesMapaBloco = () => cookiesMapaTextos().map((x) => `<p>${esc(x)}</p>`).join('\n');

/* --- a frase junto de cada formulário (RGPD, art. 13.º) -------------------- */

/* fraseFormularioHtml() da biblioteca fixa um prazo em meses («ficam guardados
   até N meses»); aqui a encomenda guarda-se 90 dias e a fatura 10 anos, e o
   registo de um revendedor dura enquanto ele o for. As duas frases seguem a
   forma dela (para quê, até quando, a ligação à política) com os prazos
   verdadeiros desta loja. */
const FORMULARIO_PT = {
  cesto: 'Os dados que escrever servem só para tratar a encomenda, entregá-la e emitir a fatura; a encomenda fica guardada 90 dias e a fatura 10 anos. Saiba mais na <a href="/legal/privacy/">política de privacidade</a>.',
  revenda: 'O NIF que escrever serve só para lhe enviar o acesso de revendedor; os dados do registo ficam guardados enquanto for revendedor. Saiba mais na <a href="/legal/privacy/">política de privacidade</a>.',
};

export const frasePrivacidade = (qual) => `<p class="privacidade-formulario small">${frase(`paginas.privacidade.${qual}`, FORMULARIO_PT[qual])}</p>`;

/* O QUE SE TRADUZ, E COMO UMA TRADUÇÃO SE APLICA.
 *
 * Este ficheiro é a regra única sobre o conteúdo em várias línguas, e tem uma
 * cópia no Worker (ithos-cathelier-api/src/traduziveis.mjs) -- que é quem
 * traduz. As duas cópias TÊM de ser iguais; a bateria da API compara-as.
 *
 * O CONTEÚDO DE ORIGEM está em content/ (em português). Uma tradução vive em
 * content/i18n/<língua>/<o mesmo caminho>, e é um mapa plano:
 *
 *     { "name": { "t": "Fox", "h": "3fa1…" }, "options.power.values.batteries.name": { … } }
 *
 * `t` é o texto traduzido; `h` é o resumo do texto de ORIGEM de onde saiu. Se
 * a dona mudar o texto em português, o resumo deixa de bater e a tradução
 * fica «desactualizada»: o site continua a mostrá-la até o Worker a refazer
 * (minutos), e um campo sem tradução nenhuma mostra o português. `fixo: true`
 * marca uma tradução corrigida à mão, que o Worker não volta a escrever por
 * cima -- mas que fica assinalada quando a origem muda.
 *
 * Os caminhos usam os ids das opções e dos valores, nunca a posição na lista:
 * reordenar os campos de uma peça não pode trocar as traduções entre eles.
 *
 * As páginas (.md) vivem em content/i18n/<língua>/pages/x.md, com a primeira
 * linha `<!-- origem: <resumo> partes: … -->` (ver partesDaPagina). */

/** O resumo de um texto: os primeiros 12 algarismos hexadecimais do SHA-256.
 *  Recebe a função de resumo (node:crypto no gerador, WebCrypto no Worker). */
export const RESUMO_TAMANHO = 12;

const TEXTO = (v) => typeof v === 'string' && v.trim() !== '';

/** Os campos a traduzir de um objecto de conteúdo, conforme o ficheiro. */
export function campos(caminhoDoFicheiro, obj) {
  const out = [];
  const juntar = (caminho, v) => { if (TEXTO(v)) out.push([caminho, v]); };
  const c = caminhoDoFicheiro.replace(/^content\//, '');

  if (/^(ithos|cathelier)\/[^_][^/]*\.json$/.test(c)) {
    juntar('name', obj.name);
    juntar('summary', obj.summary);
    juntar('text', obj.text);
    juntar('seo.title', obj.seo?.title);
    juntar('seo.description', obj.seo?.description);
    for (const o of obj.options ?? []) {
      juntar(`options.${o.id}.name`, o.name);
      juntar(`options.${o.id}.help`, o.help);
      juntar(`options.${o.id}.example`, o.example);
      for (const v of o.values ?? []) {
        juntar(`options.${o.id}.values.${v.id}.name`, v.name);
        juntar(`options.${o.id}.values.${v.id}.note`, v.note);
      }
    }
    (obj.gpsr?.warnings ?? []).forEach((w, i) => juntar(`gpsr.warnings.${i}`, w));
  } else if (c === 'cathelier/_occasions.json') {
    for (const o of obj ?? []) { juntar(`${o.slug}.name`, o.name); juntar(`${o.slug}.summary`, o.summary); }
  } else if (c === 'settings/covers.json') {
    for (const marca of ['ithos', 'cathelier']) {
      for (const k of ['title', 'buttonLabel', 'alt']) juntar(`${marca}.${k}`, obj[marca]?.[k]);
    }
  } else if (c === 'settings/shop.json') {
    juntar('notice.text', obj.notice?.text);
    juntar('payment.methods', obj.payment?.methods);
    (obj.safetyIthos ?? []).forEach((w, i) => juntar(`safetyIthos.${i}`, w));
    (obj.safetyCathelier ?? []).forEach((w, i) => juntar(`safetyCathelier.${i}`, w));
  } else if (c === 'settings/shipping.json') {
    for (const z of obj.zones ?? []) juntar(`zones.${z.id}.name`, z.name);
    juntar('campaign.title', obj.campaign?.title);
  } else if (c === 'settings/identity.json') {
    juntar('legalForm', obj.legalForm);
    juntar('country', obj.country);
  }
  return out;
}

/** Os campos que são uma POSIÇÃO numa lista de frases sem id (os avisos de
 *  segurança). Tirar o segundo aviso faz do terceiro o segundo: a tradução
 *  guardada na posição 2 passa a ser a de outro texto. Nestes, uma tradução só
 *  serve com o resumo certo -- desactualizada ou «fixo», não se aplica, e fica
 *  o português até o Worker a refazer. */
export const posicional = (campo) => /^(gpsr\.warnings|safetyIthos|safetyCathelier)\.\d+$/.test(campo);

/* Pôr um texto num caminho de campos. Os segmentos depois de «options» e
   «values»/«zones» são ids, não posições; nos avisos de segurança são
   posições (são listas de frases sem id). */
function pôr(obj, caminho, texto) {
  const p = caminho.split('.');
  if (p[0] === 'options') {
    const o = (obj.options ?? []).find((x) => String(x.id) === p[1]);
    if (!o) return;
    if (p[2] === 'values') { const v = (o.values ?? []).find((x) => String(x.id) === p[3]); if (v) v[p[4]] = texto; }
    else o[p[2]] = texto;
    return;
  }
  if (p[0] === 'zones') { const z = (obj.zones ?? []).find((x) => x.id === p[1]); if (z) z[p[2]] = texto; return; }
  if (Array.isArray(obj)) { const o = obj.find((x) => x.slug === p[0]); if (o) o[p[1]] = texto; return; }
  let x = obj;
  for (const k of p.slice(0, -1)) { if (x[k] == null) return; x = x[k]; }
  const ultimo = p.at(-1);
  if (Array.isArray(x)) x[Number(ultimo)] = texto; else x[ultimo] = texto;
}

/**
 * O objecto na outra língua: uma cópia do de origem com os textos traduzidos
 * por cima. Devolve também quantos campos ficaram desactualizados ou por
 * traduzir, para as guardas.
 *   resumir(texto) → resumo do texto de origem (sincrono, no gerador)
 */
export function aplicar(caminhoDoFicheiro, origem, traducao, resumir) {
  const obj = structuredClone(origem);
  let desactualizados = 0; let emFalta = 0; const invalidos = [];
  for (const [caminho, texto] of campos(caminhoDoFicheiro, origem)) {
    const tr = traducao?.[caminho];
    if (!tr || typeof tr.t !== 'string' || !tr.t.trim()) { emFalta++; continue; }
    /* Uma tradução que não bate com o português de agora -- uma ligação a
       mais, um marcador a menos -- não entra: fica o português. Assim uma
       página traduzida tem sempre as ligações e os marcadores da original, e
       passa nas verificações sempre que a original passa. */
    const porque = validar(texto, tr.t);
    if (porque) { invalidos.push(`${caminho} (${porque})`); emFalta++; continue; }
    if (tr.h !== resumir(texto)) {
      if (posicional(caminho)) { emFalta++; continue; }
      desactualizados++;
    }
    pôr(obj, caminho, tr.t);
  }
  return { obj, desactualizados, emFalta, invalidos };
}

/* AS PÁGINAS TRADUZEM-SE AOS BOCADOS: o texto parte-se antes de cada título de
   nível 2 («## »), e a primeira parte leva o título da página e a introdução.
   A primeira linha da página traduzida guarda o resumo da origem inteira e o
   de cada parte:
       <!-- origem: 3fa1… partes: 91c0… 5d2e… -->
   Quando a dona muda um parágrafo, só a parte onde ele está volta a ser
   traduzida -- o resto fica como estava, revisto ou não. */
export function partesDaPagina(md) {
  const partes = []; let actual = [];
  const fechar = () => { const t = actual.join('\n').trim(); if (t) partes.push(t); actual = []; };
  for (const linha of String(md ?? '').split('\n')) {
    if (/^## /.test(linha)) fechar();
    actual.push(linha);
  }
  fechar();
  return partes;
}

/** Uma página traduzida: o texto, o resumo da origem e os das partes, lidos da
 *  primeira linha. `fixo` marca uma página corrigida à mão. */
export function lerPaginaTraduzida(md) {
  const m = /^<!-- origem: ([^\n]*?) -->\n/.exec(md ?? '');
  if (!m) return null;
  const [h, ...resto] = m[1].split(/\s+/);
  if (!/^[0-9a-f]+$/.test(h)) return null;
  const i = resto.indexOf('partes:');
  const partes = i < 0 ? [] : resto.slice(i + 1).filter((x) => /^[0-9a-f]+$/.test(x));
  return { h, texto: md.slice(m[0].length), fixo: resto.includes('fixo'), partes };
}

/** O inverso de lerPaginaTraduzida. */
export function escreverPaginaTraduzida({ h, texto, fixo = false, partes = [] }) {
  const cab = [`origem: ${h}`, ...(fixo ? ['fixo'] : []), ...(partes.length ? ['partes:', ...partes] : [])].join(' ');
  return `<!-- ${cab} -->\n${String(texto).replace(/\s+$/, '')}\n`;
}

/* A VALIDAÇÃO DE UMA TRADUÇÃO. O Worker corre-a antes de gravar e as guardas
   do site voltam a corrê-la antes de publicar. */
const todos = (re, s) => [...String(s).matchAll(re)].map((m) => m[0]).sort().join('\u0000');
const conta = (re, s) => (String(s).match(re) ?? []).length;
const titulos = (s) => String(s).split('\n').filter((l) => /^#{1,6} /.test(l)).map((l) => l.match(/^#+/)[0]).join(',');

/**
 * Porque é que uma tradução não serve, ou null se serve. Não julga o estilo --
 * isso é do modelo --, só o que partiria a página: um marcador perdido, uma
 * ligação que muda de destino, uma etiqueta a mais, um título que desaparece,
 * uma resposta cortada a meio ou a falar de outra coisa.
 */
export function validar(origem, traducao, { pagina = false } = {}) {
  if (typeof traducao !== 'string' || !traducao.trim()) return 'vazia';
  const o = String(origem);
  const par = (f, nome) => (f(o) === f(traducao) ? null : nome);
  const r = par((s) => todos(/\{\{[A-Z0-9_]+\}\}/g, s), 'marcadores')
    ?? par((s) => todos(/(?<!\{)\{[A-Za-z0-9_]+\}(?!\})/g, s), 'variáveis')
    ?? par((s) => todos(/\]\([^)]*\)/g, s), 'ligações')
    ?? par((s) => todos(/<\/?[A-Za-z][^>]*>/g, s), 'etiquetas')
    /* E os sinais soltos: «<img src=x onerror=…» sem o «>» do fim passava na
       contagem das etiquetas (fecha-se no HTML a seguir), e «<!--» engolia o
       resto da página. */
    ?? par((s) => `${conta(/</g, s)}:${conta(/>/g, s)}:${conta(/<!/g, s)}`, 'sinais < >')
    ?? par((s) => conta(/\*\*/g, s), 'negrito')
    /* Os números: um prazo, um preço, um artigo de lei. «14 dias» traduzido
       para «30 days» passava em tudo o resto -- e uma frase inteira com uma
       referência legal desaparecida também. */
    ?? par((s) => todos(/\d+/g, s), 'números')
    ?? par((s) => conta(/```/g, s), 'código');
  if (r) return r;
  /* As marcas contam-se sem olhar a maiúsculas (a dona pode escrever «A Ithos
     nasceu…» e o modelo, obediente, escreve «ithos»); e a tradução não pode
     ter mais maiúsculas nelas do que o original. */
  for (const m of ['ithos', 'cathelier']) {
    const ci = new RegExp(m, 'gi'); const baixa = new RegExp(m, 'g');
    if (conta(ci, o) !== conta(ci, traducao)) return `marca ${m}`;
    if (conta(ci, traducao) - conta(baixa, traducao) > conta(ci, o) - conta(baixa, o)) return `marca ${m}`;
  }
  if (pagina) {
    const p = par(titulos, 'títulos')
      ?? par((s) => conta(/^\s*(?:[-*+]|\d+\.)\s/gm, s), 'listas')
      ?? par((s) => conta(/^\|/gm, s), 'tabelas');
    if (p) return p;
  }
  /* O tamanho só se mede em texto corrido: num nome, «Red Racer» contra «Carro
     de corrida vermelho» é uma tradução certa com um terço do comprimento. */
  if (o.length >= 60) {
    const razao = traducao.length / o.length;
    if (razao < 0.35 || razao > 2.8) return 'tamanho';
  }
  return null;
}

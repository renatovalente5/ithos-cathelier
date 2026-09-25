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
 * As páginas (.md) traduzem-se inteiras: content/i18n/<língua>/pages/x.md, com
 * a primeira linha `<!-- origem: <resumo> -->`. */

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
  let desactualizados = 0; let emFalta = 0;
  for (const [caminho, texto] of campos(caminhoDoFicheiro, origem)) {
    const tr = traducao?.[caminho];
    if (!tr || typeof tr.t !== 'string' || !tr.t.trim()) { emFalta++; continue; }
    if (tr.h !== resumir(texto)) desactualizados++;
    pôr(obj, caminho, tr.t);
  }
  return { obj, desactualizados, emFalta };
}

/** Uma página traduzida: o texto e o resumo da origem, lidos da primeira linha. */
export function lerPaginaTraduzida(md) {
  const m = /^<!-- origem: ([0-9a-f]+)(?: fixo)? -->\n/.exec(md ?? '');
  return m ? { h: m[1], texto: md.slice(m[0].length), fixo: / fixo -->/.test(m[0]) } : null;
}

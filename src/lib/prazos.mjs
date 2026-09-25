/* OS PRAZOS, DITOS DE UMA MANEIRA SÓ.
 *
 * A regra da dona: um candeeiro em stock sai em poucos dias; sem stock
 * compra-se na mesma e é feito, «3 a 4 semanas»; as peças da cathelier são
 * sempre feitas por encomenda. A mesma frase aparece na ficha do produto, no
 * cesto, nas perguntas frequentes e nas condições -- e sai daqui, dos dois
 * números de content/settings/shop.json, para não haver uma que fique para
 * trás quando o número mudar. O Worker usa os mesmos números nos emails.
 *
 * O público vê «In stock» ou «Out of stock», nunca quantos: só os revendedores
 * vêem os números, e isso é o script da página que o acrescenta. */

export function semanas(lead) {
  const [a, b] = lead.toOrderWeeks;
  return a === b ? `${a} weeks` : `${a} to ${b} weeks`;
}

export function prazos(lead) {
  const w = semanas(lead);
  return {
    stock: `In stock — leaves the workshop within ${lead.inStockDays} working days.`,
    semStock: `Out of stock — we make yours, with you in ${w}.`,
    encomenda: `Made to order — with you in ${w}.`,
    /* Para o cesto, quando a encomenda inteira espera pela peça mais lenta. */
    junto: `Everything ships together, when the last piece is ready.`,
    semanas: w,
    dias: `${lead.inStockDays} working days`,
  };
}

/* QUE UNIDADES DE STOCK GASTA CADA ESCOLHA.
 *
 * Um candeeiro sem modelos gasta-se a si próprio (`bear`); com modelos, gasta o
 * modelo escolhido (`acorn/1`); e uma escolha que junta outras -- o «Both
 * together» da bolota -- diz em `stockFrom` quais gasta, um de cada. A potência
 * e a gravação não contam: o stock é dos candeeiros, não do cabo.
 *
 * O Worker lê isto do catálogo e é ele que decide; a página lê o mesmo para
 * perguntar pelas unidades certas. */
export function stockDe(p) {
  const v = (p.options || []).find((o) => o.id === 'variant' && o.type === 'choice');
  if (!v) return { option: null, skus: { '': [p.slug] } };
  return {
    option: 'variant',
    skus: Object.fromEntries(v.values.map((x) => [String(x.id),
      (x.stockFrom?.length ? x.stockFrom : [x.id]).map((id) => `${p.slug}/${id}`)])),
  };
}

/** As prateleiras que existem, com o nome que a dona reconhece. As escolhas
 *  que juntam outras não são prateleira: não se fazem, juntam-se. */
export function prateleiras(lamps) {
  const out = {};
  for (const p of lamps) {
    const v = (p.options || []).find((o) => o.id === 'variant' && o.type === 'choice');
    if (!v) { out[p.slug] = p.name; continue; }
    for (const x of v.values) if (!x.stockFrom?.length) out[`${p.slug}/${x.id}`] = `${p.name} — ${x.name}`;
  }
  return out;
}

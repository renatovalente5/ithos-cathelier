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
 * vêem os números, e isso é o script da página que o acrescenta.
 *
 * As frases são da língua da página (src/i18n/<língua>/prazos.json); os
 * números são os mesmos em todas. Tudo isto é chamado ao desenhar, depois de
 * o gerador escolher a língua. */
import { t, tn } from './i18n.mjs';

export function semanas(lead) {
  const [a, b] = lead.toOrderWeeks;
  return a === b ? tn('prazos.semanas', a) : t('prazos.semanas.intervalo', { a, b });
}

/* «3 to 5 working days». Aceita ainda um número só (`inStockDays: 3`), que
   era a forma antes de a dona pedir um intervalo. */
export function dias(lead) {
  const d = lead.inStockDays;
  const [a, b] = Array.isArray(d) ? d : [d, d];
  return a === b ? tn('prazos.dias', a) : t('prazos.dias.intervalo', { a, b });
}

export function prazos(lead) {
  const w = semanas(lead);
  return {
    stock: t('prazos.stock', { dias: dias(lead) }),
    semStock: t('prazos.semStock', { semanas: w }),
    encomenda: t('prazos.encomenda', { semanas: w }),
    /* Para o cesto, quando a encomenda inteira espera pela peça mais lenta. */
    junto: t('prazos.junto'),
    semanas: w,
    dias: dias(lead),
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

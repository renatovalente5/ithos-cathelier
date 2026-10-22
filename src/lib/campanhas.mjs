/* AS CAMPANHAS DE PORTES GRÁTIS (content/settings/shipping.json, que a dona
 * gere no painel, em Campanhas).
 *
 * Eram uma só (`campaign`); passaram a uma lista (`campaigns`) para se poder
 * deixar o Natal e a Black Friday marcados com antecedência. Em cada dia vale
 * A PRIMEIRA DA LISTA que estiver ligada, com valor, e com o dia de Lisboa
 * dentro das datas -- a mesma regra no carrinho (shop.js), no Worker
 * (src/catalogue.js da API) e aqui, que escreve a faixa e a janela de cada
 * uma para o shop.js escolher. Um ficheiro antigo, só com `campaign`, lê-se
 * como uma lista de uma. */
export const campanhasDe = (s) => (Array.isArray(s?.campaigns) ? s.campaigns : (s?.campaign ? [s.campaign] : []));
export const campanhasLigadas = (s) => campanhasDe(s).filter((c) => c && c.active && Number(c.freeOver) > 0);

/* ONDE VALE (o painel, 21 out 2026: «Onde vale» em cada campanha). `countries`
   são os códigos das zonas de «Envios» escolhidas (PT, PT-20, PT-30…); sem
   lista, vale em todo o lado. Para a faixa e a janela dizerem onde, os nomes
   das zonas que a campanha cobre inteiras -- a mesma lista que o carrinho e o
   Worker usam para cobrar. */
export function zonasDaCampanha(c, shipping) {
  const lista = Array.isArray(c?.countries) ? c.countries : [];
  if (!lista.length) return [];
  return (shipping?.zones ?? []).filter((z) => (z.countries ?? []).length && z.countries.every((k) => lista.includes(k))).map((z) => z.name);
}

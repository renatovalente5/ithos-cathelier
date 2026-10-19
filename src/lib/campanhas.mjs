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

/* A ORDEM QUE A DONA ESCOLHE NUM SÍTIO, GUARDADA COMO UMA LISTA DE ENDEREÇOS.
 *
 * As peças de cada separador (_occasions.json, ordem), escolhidas no painel a
 * arrastar (a dona, 20 out 2026: «em cada separador, por exemplo no Natal,
 * alterar a ordem do aparecimento das peças»). O que não estiver na lista vem
 * a seguir, pela ordem de sempre; um endereço que já não pertence ao sítio
 * salta-se. A mesma conta do painel (js/ordenar.js da API). A página inicial
 * já não tem lista própria (21 out 2026): segue a ordem da marca, com os em
 * destaque primeiro (src/build.mjs, porOrdem). */
export function pelaLista(itens, lista, id = (x) => x.slug) {
  const lugar = new Map((Array.isArray(lista) ? lista : []).map((s, i) => [s, i]));
  return itens.map((x, k) => ({ x, k, l: lugar.get(id(x)) ?? Infinity }))
    .sort((a, b) => a.l - b.l || a.k - b.k).map((a) => a.x);
}

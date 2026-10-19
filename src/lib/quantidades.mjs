/* OS PREÇOS POR QUANTIDADE (a dona, 19 out 2026: «tinha isto no ano passado
 * para o Natal, dá para colocar no site?»).
 *
 * Uma peça pode ter `quantityPrices`: [{ from: 11, price: 3.3 }, …] -- a
 * partir de `from` unidades, cada uma custa `price` (sem as escolhas pagas,
 * que se somam por cima, como sempre). O escalão conta-se pela quantidade
 * TOTAL da peça na encomenda, todas as linhas juntas (dez bolas com dez nomes
 * são dez bolas), e vale para TODAS as unidades: «o desconto fica nas 15
 * bolas, em todas» (a dona). Abaixo do primeiro escalão vale `price`.
 *
 * A mesma conta está no Worker (catalogue.js, precoParaQuantidade) e no
 * cesto (src/js/shop.js): o servidor é que cobra, e o cesto não pode mostrar
 * outra coisa. As guardas (scripts/guards.mjs) recusam escalões fora de
 * ordem, ou um preço que não desce. */
export const escaloes = (p) => (Array.isArray(p?.quantityPrices) ? p.quantityPrices : [])
  .filter((t) => Number.isInteger(t?.from) && t.from >= 2 && typeof t.price === 'number' && t.price > 0)
  .sort((a, b) => a.from - b.from);

export function precoParaQuantidade(p, qtd) {
  let preco = p.price;
  for (const t of escaloes(p)) if (qtd >= t.from) preco = t.price;
  return preco;
}

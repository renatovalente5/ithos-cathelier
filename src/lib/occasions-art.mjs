/* ===========================================================================
   The ten cathelier badges, drawn rather than photographed.
   ===========================================================================

   The model shop puts a photograph in each circle. Photographs do not work for
   these: at 74px across, a photograph of a small engraved disc becomes a beige
   smudge, and ten beige smudges in a row tell a visitor nothing about where
   each one leads. A drawing at that size can still say "trophy" or "pram".

   So each one is a line drawing of the thing the collection actually sells —
   the tree for Christmas, the pram for a new baby, the key for keyrings, the
   pencil for what is drawn to order. (The daisy and the superhero shield that
   stood for Mother's and Father's Day left on 25 September 2026, when the two
   days became one collection; they are in the git history.) They share one
   grammar on purpose: a 48-unit square, a 1.4 stroke, round joins, and one
   filled accent each. That is what makes ten different subjects read as one
   set rather than ten clip-art icons.
   ------------------------------------------------------------------------- */

const ART = {
  /* UMA ÁRVORE, e não a bola que aqui estava. A bola era um círculo com linhas
     dentro -- e o disco de nascimento, a seguir, também: a 46px os dois eram a
     mesma mancha, e a dona disse que não dava para perceber o que eram. Uma
     árvore não se confunde com nada no conjunto. */
  christmas: `
    <path d="M24 7.8 14.6 21.2h18.8Z"/>
    <path d="M24 15.6 10.2 33h27.6Z"/>
    <path d="M21.4 33h5.2v6.4h-5.2z"/>
    <circle cx="24" cy="5.4" r="1.9" fill="currentColor" stroke="none"/>`,

  /* A heart on a ribbon. The scalloped disc I drew first sat on its ribbon
     tail and read as a lollipop, which is not what a christening favour is. */
  keepsakes: `
    <path d="M24 39.4C14.6 33 10.2 27.6 10.2 22.2a7.2 7.2 0 0 1 13.8-2.9 7.2 7.2 0 0 1 13.8 2.9c0 5.4-4.4 10.8-13.8 17.2Z"/>
    <circle cx="24" cy="17.6" r="1.6"/>
    <path d="M24 16c0-2.6-2-3.6-2-5.6a2 2 0 0 1 4 0c0 2-2 3-2 5.6Z"/>
    <path d="M16.6 24.4h14.8M18.8 28.6h10.4"/>`,

  /* UM CARRINHO. Era o disco de nascimento com as linhas dos dados -- honesto
     sobre o produto e ilegível como sinal: um círculo com linhas era o que
     metade das ocasiões parecia. O cabeçalho deste ficheiro já dizia que um
     desenho a este tamanho ainda consegue dizer "pram". Diz. */
  'new-baby': `
    <path d="M10.6 25.6h26.8a13.4 13.4 0 0 1-26.8 0Z"/>
    <path d="M24 25.6V12.2a13.4 13.4 0 0 1 13.4 13.4"/>
    <path d="M14.4 36.6 16.6 31.4M33.6 36.6 31.4 31.4"/>
    <circle cx="14" cy="39.2" r="2.7"/>
    <circle cx="34" cy="39.2" r="2.7"/>
    <circle cx="30.6" cy="19.4" r="1.7" fill="currentColor" stroke="none"/>`,
  /* UMA LETRA, grande. Era uma assinatura manuscrita desenhada a traço e a
     46px lia-se como um garatujo -- nem letra, nem nome, nem nada. É isto que
     a ocasião vende: um nome cortado grande para uma porta ou uma parede. Um
     "A" diz "letras" ao primeiro olhar e não se parece com mais nenhum dos
     dez. O acento cheio é o interior da própria letra. */
  names: `
    <path d="M24 9.6 20 20.6h8Z" fill="currentColor" stroke="none" opacity=".45"/>
    <path d="M11.6 39.4 24 7.6l12.4 31.8"/>
    <path d="M16.4 27.2h15.2"/>`,

  /* UM DISCO PENDURADO PELA ARGOLA. Era um rectângulo com linhas dentro e
     lia-se como uma folha de papel. O que estas peças têm em comum é o furo e
     a fita -- é isso que se desenha. */
  hanging: `
    <circle cx="24" cy="11.2" r="3.6"/>
    <path d="M24 14.8v3.4"/>
    <circle cx="24" cy="29.4" r="10.8"/>
    <path d="M17.6 29h12.8M20.4 33.6h7.2"/>
    <circle cx="24" cy="24.4" r="1.7" fill="currentColor" stroke="none"/>`,
  /* UM OVO COM UMA FAIXA EM ZIGUEZAGUE. É o sinal de Páscoa que ninguém lê
     mal, e não se confunde com nada do conjunto: o disco pendurado é redondo
     e tem argola, o ovo é oval e não tem. */
  easter: `
    <path d="M24 9.5c6.4 0 11 8.6 11 16.4 0 7.8-4.9 13.6-11 13.6s-11-5.8-11-13.6C13 18.1 17.6 9.5 24 9.5Z"/>
    <path d="M13.5 26l3.5 3 3.5-3 3.5 3 3.5-3 3.5 3 3.5-3"/>
    <circle cx="24" cy="18.4" r="1.9" fill="currentColor" stroke="none"/>`,

  /* UMA PRENDA, e não a margarida nem o escudo. O separador junta os dois
     dias, e cada um dos dois desenhos antigos só dizia um deles. Uma caixa
     com laço diz «é para oferecer», que é o que os dois dias têm em comum. */
  'special-days': `
    <path d="M12.6 22.4h22.8v15.2a1.6 1.6 0 0 1-1.6 1.6H14.2a1.6 1.6 0 0 1-1.6-1.6Z"/>
    <path d="M10.8 16.8h26.4v5.6H10.8Z" fill="currentColor" stroke="none" opacity=".45"/>
    <path d="M10.8 16.8h26.4v5.6H10.8Z"/>
    <path d="M24 16.8v22.4"/>
    <path d="M24 16.8c-2.2-4.4-7.6-5.6-7.6-2.2 0 2 3.4 2.2 7.6 2.2Zm0 0c2.2-4.4 7.6-5.6 7.6-2.2 0 2-3.4 2.2-7.6 2.2Z"/>`,

  /* UMA CHAVE NUMA ARGOLA, em diagonal. Não pode ser um disco pendurado --
     esse já é o dos pendentes, e a 46px os dois eram a mesma coisa. A chave
     diz porta-chaves ao primeiro olhar; o íman é o mesmo objecto sem argola. */
  'magnets-keyrings': `
    <circle cx="16" cy="16" r="6.4"/>
    <circle cx="24.8" cy="24.8" r="5.4"/>
    <circle cx="24.8" cy="24.8" r="1.7" fill="currentColor" stroke="none"/>
    <path d="M28.6 28.6l9.6 9.6M34.4 34.4l2.6-2.6M37.2 37.2l2.6-2.6"/>`,

  /* UM QUADRO PENDURADO NUM PREGO. A casa que aqui estava dizia «para a
     casa», que era o nome antigo; o separador agora chama-se Decoração de
     parede, e o que a define é a parede. O prego é o acento cheio. */
  'wall-decor': `
    <circle cx="24" cy="8.4" r="1.9" fill="currentColor" stroke="none"/>
    <path d="M24 8.4 13.4 18.6M24 8.4l10.6 10.2"/>
    <path d="M10.6 18.6h26.8v20.2H10.6Z"/>
    <path d="M14.6 34.6l6.2-7 4.4 4.6 3-3 5.2 5.4"/>`,

  /* UM LÁPIS A RISCAR. «Pedidos especiais» é o que se desenha à medida -- o
     topo de bolo com os dois nomes, a sinalética do casamento, o troféu do
     clube -- e leva ao orçamento. O lápis diz «feito para si», e o traço por
     baixo é o desenho a começar. */
  custom: `
    <path d="M14.8 28.6 31 12.4a2.8 2.8 0 0 1 4 0l.6.6a2.8 2.8 0 0 1 0 4L19.4 33.2Z"/>
    <path d="M14.8 28.6 11.4 36.6l8-3.4"/>
    <path d="M28.2 15.2l4.6 4.6"/>
    <path d="M11.4 36.6l1.3-3.1 1.8 1.8Z" fill="currentColor" stroke="none"/>
    <path d="M22 39.6h14"/>`,
};

/* 1.9 e nao 1.4. Os desenhos passaram a ocupar 62% do circulo em vez de 40%, e
 * a esse tamanho o traco fino desaparecia -- a dona disse que nao dava para
 * perceber o que eram. Renderizei os dez a 150px com 1.4, 1.9 e 2.4 lado a
 * lado: a 1.4 ficam esquelicos e a 2.4 os detalhes fecham-se (o escudo do Pai,
 * a taca dos premios). 1.9 e o que le em ambos os tamanhos. */
export function occasionArt(slug, size = 30) {
  const body = ART[slug];
  if (!body) return '';
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${body}</svg>`;
}

export const drawnOccasions = Object.keys(ART);

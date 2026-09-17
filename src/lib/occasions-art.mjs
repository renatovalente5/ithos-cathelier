/* ===========================================================================
   The ten occasion badges, drawn rather than photographed.
   ===========================================================================

   The model shop puts a photograph in each circle. Photographs do not work for
   these: at 74px across, a photograph of a small engraved disc becomes a beige
   smudge, and ten beige smudges in a row tell a visitor nothing about where
   each one leads. A drawing at that size can still say "trophy" or "pram".

   So each one is a line drawing of the thing the occasion actually sells —
   the daisy the workshop really cuts for Mother's Day, the "superhero" shield
   for Father's Day, the birth disc with its rows of data. They share one
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
  /* A MESMA margarida, com SEIS pétalas gordas em vez de oito estreitas. As
     oito, rodadas, fechavam-se umas nas outras e a flor lia-se como uma
     explosão de raios. Menos pétalas e mais largas, e volta a ser uma flor. */
  'mothers-day': `
    ${[0, 60, 120, 180, 240, 300].map((a) =>
      `<ellipse cx="24" cy="11.4" rx="4.4" ry="6.5" transform="rotate(${a} 24 19)"/>`).join('\n    ')}
    <circle cx="24" cy="19" r="3.4" fill="currentColor" stroke="none" opacity=".55"/>
    <path d="M24 30.2V42"/>
    <path d="M24 35.6c-4-2.6-8.2-1.2-8.2-1.2s1.8 3.9 5.8 3.4"/>`,
  /* O MESMO escudo de super-herói, com uma ESTRELA cheia em vez da figurinha.
     A figura tinha cabeça, tronco, pernas e capa dentro de 20px de escudo: a
     46px era um borrão. A estrela lê-se ao primeiro olhar e a frase da ocasião
     -- "You are my superhero" -- continua de pé. */
  'fathers-day': `
    <path d="M24 7.5 37 12v12.4c0 9-5.5 14.3-13 17.1-7.5-2.8-13-8.1-13-17.1V12Z"/>
    <path d="M24 15.5 25.94 20.33 31.13 20.68 27.14 24.02 28.41 29.07 24 26.3 19.59 29.07 20.86 24.02 16.87 20.68 22.06 20.33Z" fill="currentColor" stroke="none" opacity=".55"/>`,
  /* A balloon with a name tag on its string. The first attempt was a rocking
     horse and at badge size it read as a tent: too many joints, none of them
     legible below 40px. A balloon survives being small. */
  'childrens-day': `
    <path d="M24 9.6c5.3 0 9.2 4 9.2 9.4 0 5.6-4.1 10.4-9.2 13-5.1-2.6-9.2-7.4-9.2-13 0-5.4 3.9-9.4 9.2-9.4Z"/>
    <path d="M21.8 32.4h4.4l-2.2 2.8Z" fill="currentColor" stroke="none"/>
    <path d="M24 35.2c0 2.6 2.4 2.6 2.4 5.2"/>
    <path d="M19.6 15.4c-1 1-1.6 2.3-1.8 3.8"/>
    <path d="M28.6 38h5.8a1.4 1.4 0 0 1 1.4 1.4v2.2a1.4 1.4 0 0 1-1.4 1.4h-5.8Z"/>`,

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
  /* A growth chart on a wall: the piece that stays in the house for years. */
  home: `
    <path d="M11.4 22.6 24 12l12.6 10.6"/>
    <path d="M14.6 21v15.4a1.6 1.6 0 0 0 1.6 1.6h15.6a1.6 1.6 0 0 0 1.6-1.6V21"/>
    <path d="M27.8 38V26.2a1.4 1.4 0 0 0-1.4-1.4h-4.8a1.4 1.4 0 0 0-1.4 1.4V38"/>
    <path d="M20.2 29.4h7.6M20.2 33h4.4"/>`,

  /* UM DISCO PENDURADO PELA ARGOLA. Era um rectângulo com linhas dentro e
     lia-se como uma folha de papel. O que estas peças têm em comum é o furo e
     a fita -- é isso que se desenha. */
  hanging: `
    <circle cx="24" cy="11.2" r="3.6"/>
    <path d="M24 14.8v3.4"/>
    <circle cx="24" cy="29.4" r="10.8"/>
    <path d="M17.6 29h12.8M20.4 33.6h7.2"/>
    <circle cx="24" cy="24.4" r="1.7" fill="currentColor" stroke="none"/>`,
  /* A trophy, for the clubs and the end-of-season nights. */
  awards: `
    <path d="M17 10.4h14v8.4a7 7 0 0 1-14 0Z"/>
    <path d="M17 13.2h-3.4a4 4 0 0 0 4 6.4M31 13.2h3.4a4 4 0 0 1-4 6.4"/>
    <path d="M24 25.8v5.4M19.6 37.6h8.8a4.4 4.4 0 0 0-4.4-6.4 4.4 4.4 0 0 0-4.4 6.4Z"/>
    <path d="M24 12.6l1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4Z" fill="currentColor" stroke="none" opacity=".5"/>`,
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

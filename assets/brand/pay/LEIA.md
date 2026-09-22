# Os logótipos dos métodos de pagamento

Estes três não são nossos e **não podem ser redesenhados, recoloridos, cortados
nem esticados**. São marcas registadas de terceiros, e o que aqui está é a
obra-de-arte oficial, ficheiro a ficheiro, tal como saiu da fonte.

| ficheiro | marca de | proporção |
|---|---|---|
| `mbway.svg` | SIBS | 143,2 × 69,57 (deitado) |
| `multibanco.svg` | SIBS | 153,98 × 181,88 (**ao alto**) |
| `payshop.svg` | CTT | 455,24 × 120,57 (deitado) |
| `applepay.svg` | Apple | 165,52 × 105,97 (deitado) |
| `googlepay.svg` | Google | 41 × 17 (deitado) |

## De onde vieram

Do módulo oficial da ifthenpay para o Magento 2 —
`github.com/ifthenpay/magento2`, em `view/frontend/web/img/` — descarregados a
22 de setembro de 2026. É a obra-de-arte que a ifthenpay distribui aos
comerciantes para a pôr num checkout de **fundo claro**.

Os ficheiros do site deles (`ifthenpay.com/assets/images/`) são a versão para
**fundo escuro**: `mb_white.svg`, `mbway_white.svg` e `payshop_white.svg` têm
`fill="white"` e desaparecem sobre o creme das duas marcas. Não servem aqui, e
pintá-los de outra cor seria alterar a marca.

## Porque é que o Multibanco é maior do que os outros no ecrã

Porque o logótipo dele é **ao alto** — o símbolo MB com a palavra por baixo — e
os outros dois são deitados. À mesma altura dos outros, a palavra
«MULTIBANCO» fica uma mancha: medido, só se lê a partir dos ~38px, enquanto o
MB WAY se lê aos 24 e o Payshop aos 19. Cada marca vai ao seu tamanho óptico, e
é por isso que as três alturas no CSS são diferentes e não é distracção.

A ifthenpay também tem o Multibanco **deitado** (`mb_white.svg`, 101×30), que
resolveria isto — mas só existe em branco.

## Apple Pay e Google Pay: vieram das próprias

Não estão no módulo da ifthenpay — o módulo deles nem sequer suporta esses
métodos. Foram buscadas à fonte:

· **Apple Pay** — `developer.apple.com/apple-pay/marketing/Apple-Pay-Mark.zip`,
  ficheiro `SVG/Apple_Pay_Mark_RGB_041619.svg`, descarregado a 22 set 2026.
  A Apple só distribui **uma** versão e escreve: «Other color options aren't
  available. Don't alter the artwork in any way or create your own version of
  the Apple Pay mark. Use only the artwork provided by Apple.» Também proíbe
  mexer na largura, na proporção, no raio dos cantos, rodar, animar, ou pôr
  sombras. Área livre mínima: um quarto da altura da marca.

· **Google Pay** — `gstatic.com/instantbuy/svg/light_gpay.svg`, que é a versão
  para **fundo claro** (o «Pay» em cinzento #5F6368). Há uma `dark_gpay.svg`
  para fundos escuros, que aqui desapareceria sobre o creme.

## A regra que decide os tamanhos

A Apple e a Google proíbem as duas mostrar a sua marca **mais pequena do que as
outras identidades de pagamento em formato semelhante**. As marcas deitadas
desta loja são o MB WAY (24px) e o Payshop (19px); o Apple Pay e o Google Pay
vão a **28px**, que não é menor do que nenhuma delas.

O Multibanco fica nos 38px e não entra nesta comparação: é um logótipo **ao
alto**, outro formato, e a sua palavra deixa de se ler abaixo disso. Medi a
alternativa de pôr tudo a 38: cumpre a regra à letra e fica pior, com o Apple
Pay e o Google Pay a dominar a lista.

Medi também a tinta de cada ficheiro numa tela: nenhum tem folga transparente
significativa (95,6% no Google, 100% nos outros), por isso a altura em CSS é a
altura que se vê e comparar alturas é honesto.

## Visa e Mastercard NÃO estão aqui, de propósito

A opção de cartão mostra um ícone NOSSO e a palavra «Card». Três razões:

1. A obra-de-arte da Visa que a ifthenpay distribui é o logótipo **antigo**
   (azul #00579f com a vírgula dourada), e a Visa proíbe-o por escrito: «do not
   use the old blue Visa Brand Mark… Only use the new». O `ccard.svg` deles é
   um redesenho com cores que não são oficiais de nenhuma das duas marcas.
2. A obra-de-arte oficial das duas está atrás de acordos de descarga — o link
   directo do Mastercard Brand Center devolve 403.
3. Mostrar marcas de aceitação é **opcional**. Não as mostrar não custa nada;
   mostrá-las mal custa.

## Se um dia for preciso trocar

Voltar à mesma fonte e substituir o ficheiro inteiro. Não abrir num editor para
«arranjar» a cor, o espaçamento ou a caixa.

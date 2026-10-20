# Os logótipos dos métodos de pagamento

Estes ficheiros não são nossos e **não podem ser redesenhados, recoloridos, cortados
nem esticados**. São marcas registadas de terceiros, e o que aqui está é a
obra-de-arte oficial, ficheiro a ficheiro, tal como saiu da fonte.

| ficheiro | marca de | proporção | onde |
|---|---|---|---|
| `mbway.svg` | SIBS | 480 × 234 (deitado) | pagamento e rodapé |
| `multibanco.svg` | SIBS | 153,98 × 181,88 (**ao alto**) | pagamento |
| `multibanco-horizontal.svg` | SIBS | 416 × 88 (deitado) | rodapé |
| `applepay.svg` | Apple | 165,52 × 105,97 | pagamento (e rodapé, depois do teste) |
| `googlepay.svg` | Google | 41 × 17 | pagamento |
| `googlepay-marca.svg` | Google | 1094 × 742 (com margem) | rodapé |
| `visa.svg` | Visa | 295,2 × 144 | pagamento (cartão) e rodapé |
| `mastercard.svg` | Mastercard | 152,4 × 108 | pagamento (cartão) e rodapé |

## De onde vieram

Do módulo oficial da ifthenpay para o Magento 2 —
`github.com/ifthenpay/magento2`, em `view/frontend/web/img/` — descarregados a
22 de setembro de 2026. É a obra-de-arte que a ifthenpay distribui aos
comerciantes para a pôr num checkout de **fundo claro**.

Os ficheiros do site deles (`ifthenpay.com/assets/images/`) são a versão para
**fundo escuro**: `mb_white.svg` e `mbway_white.svg` têm
`fill="white"` e desaparecem sobre o creme das duas marcas. Não servem aqui, e
pintá-los de outra cor seria alterar a marca.

## Porque é que o Multibanco é maior do que os outros no ecrã

Porque o logótipo dele é **ao alto** — o símbolo MB com a palavra por baixo — e
os outros são deitados. À mesma altura dos outros, a palavra
«MULTIBANCO» fica uma mancha: medido, só se lê a partir dos ~38px, enquanto o
MB WAY se lê aos 24. Cada marca vai ao seu tamanho óptico, e
é por isso que as alturas no CSS são diferentes e não é distracção.

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
desta loja são o MB WAY (24px); o Apple Pay e o Google Pay vão a **28px**, que
não é menor.

O Multibanco fica nos 38px e não entra nesta comparação: é um logótipo **ao
alto**, outro formato, e a sua palavra deixa de se ler abaixo disso. Medi a
alternativa de pôr tudo a 38: cumpre a regra à letra e fica pior, com o Apple
Pay e o Google Pay a dominar a lista.

Medi também a tinta de cada ficheiro numa tela: nenhum tem folga transparente
significativa (95,6% no Google, 100% nos outros), por isso a altura em CSS é a
altura que se vê e comparar alturas é honesto.

## Payshop saiu

O Payshop foi oferecido até 25 set 2026 e saiu dos pagamentos a pedido da dona.
O `payshop.svg` foi apagado com ele; se voltar, vem outra vez da mesma fonte
(o módulo da ifthenpay para o Magento 2), a 455,24 × 120,57.

## 20 out 2026: os ficheiros das próprias marcas, e o rodapé

O Renato pediu os meios de pagamento no rodapé. Foram buscados às páginas de marca
de cada dono, descarregados a 20 out 2026 (com autorização dele):

· **MB WAY** — `docs.pay.sibs.com/portugal/our-brands/mb-way-brandbook/brand-mb-way/`,
  «MB WAY – Main Logo.zip», ficheiro `main - horizontal/SVG/MB WAY-Positivo.svg`.
  Substituiu o da ifthenpay (mesma proporção, 2,05). Regras: a cores sempre que
  possível; mínimo de **20 mm**; ao lado do Multibanco, o **MB WAY primeiro** e os
  dois à mesma escala.
· **Multibanco (deitado)** — `docs.pay.sibs.com/portugal/our-brands/multibanco-brandbook/`,
  «Horizontal Logo.zip», ficheiro `logo horizontal/svg/horizontal-positive.svg`. O do
  pagamento continua o ao alto da ifthenpay (as alturas de lá estão medidas).
· **A SIBS EXIGE VALIDAÇÃO**: «All logo integrations must be reviewed for compliance.
  Please submit your implementation for validation to marketing@sibs.pt before
  launch.» — nas duas marcas. Enviar antes de abrir a loja.
· **Visa** — `brand.visa.com/public` (Logos), «main-logo-pack», ficheiro `Visa Brand
  Mark Blue.svg` (o novo, azul #1434CB). As regras de comércio electrónico da Visa
  (set 2025) pedem a quem a aceita online que mostre a marca, em azul.
· **Mastercard** — `mastercard.com/brandcenter` (Download Artwork), `mc_symbol_SVG.zip`,
  ficheiro `ma_symbol.svg`. O símbolo **só a cores**, nunca cinzento; ao mesmo nível
  (tamanho, cor, sítio) das outras marcas mostradas, de preferência em primeiro.
· **Google Pay (marca de aceitação)** — `developers.google.com/pay/api/web/guides/brand-guidelines`,
  `Google-Pay-Acceptance.zip`, ficheiro `google-pay-mark_800.svg`. O ficheiro tem margem
  transparente à volta da pílula (só 54% da altura é marca); o CSS do rodapé corta a
  margem para a pílula ficar da altura das outras — a Google proíbe-a mais pequena. A
  marca em si não se toca.
· **Apple Pay** — o mesmo ficheiro de setembro (confirmado igual byte a byte). Fica fora
  do rodapé até haver uma compra de teste a sério num iPhone.

As marcas do rodapé dizem-se em `content/settings/shop.json` (`payment.marks`), e as
guardas recusam uma de um meio que a loja não diz aceitar, ou o Multibanco antes do
MB WAY.

## Até 20 out 2026: Visa e Mastercard NÃO estavam aqui, de propósito

(Já não é assim: desde 20 out a opção de cartão mostra as duas, com os ficheiros
oficiais acima.) Até lá, a opção de cartão mostrava um ícone NOSSO e a palavra «Card». Três razões:

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

## 20 out 2026, à tarde: sem contorno

O Renato perguntou se as marcas tinham de ter «aquela borda». Não: o contorno
escuro (#3c4043) era nosso, para as outras ficarem iguais à pílula do Google Pay.
Saiu. As marcas ficam em cartões brancos sem contorno, a 32 px (30 no telemóvel,
para as cinco caberem numa fila). O Google Pay continua com o contorno dele,
porque faz parte da marca: «Don't change the color or weight of the mark's
outline, or alter the mark in any way» (brand guidelines da Google). A SIBS tem
de receber as capturas novas.

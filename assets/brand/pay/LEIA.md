# Os logótipos dos métodos de pagamento

Estes três não são nossos e **não podem ser redesenhados, recoloridos, cortados
nem esticados**. São marcas registadas de terceiros, e o que aqui está é a
obra-de-arte oficial, ficheiro a ficheiro, tal como saiu da fonte.

| ficheiro | marca de | proporção |
|---|---|---|
| `mbway.svg` | SIBS | 143,2 × 69,57 (deitado) |
| `multibanco.svg` | SIBS | 153,98 × 181,88 (**ao alto**) |
| `payshop.svg` | CTT | 455,24 × 120,57 (deitado) |

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

## Se um dia for preciso trocar

Voltar à mesma fonte e substituir o ficheiro inteiro. Não abrir num editor para
«arranjar» a cor, o espaçamento ou a caixa.

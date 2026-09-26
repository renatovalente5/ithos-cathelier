# O aviso harmonizado da garantia legal

Estes quatro ficheiros **não são nossos e não se editam**: nem cores, nem
recortes, nem texto, nem nada acrescentado lá dentro. O Regulamento de Execução
(UE) 2025/1960 da Comissão (anexo I, nota 1) proíbe editar qualquer elemento do
aviso, e a nota 5 manda mostrá-lo **a cores** quando é mostrado online. O que
for preciso dizer além do aviso (os 3 anos portugueses, a ligação ao portal)
vai **fora** dele, na página `/legal/guarantee/`.

| ficheiro | é o ficheiro oficial | SHA-256 |
|---|---|---|
| `aviso-garantia-legal-pt.svg` | `Legal guarantee_notice PT.svg` (arquivo SVG) | `9069bb0bc5e9f3cf655579038be5646181cc5447a25f3f8ccf2d018eacba0ac1` |
| `aviso-garantia-legal-en.svg` | `Legal guarantee_notice EN.svg` (arquivo SVG) | `d1b4293b75637022b582b3025f789d292e1c845660a0460d855bbe523b9763f7` |
| `aviso-garantia-legal-pt.pdf` | `Legal guarantee_notice PTN.pdf` (arquivo PDF, 24 línguas) | `b145a3014984f474d9bb81c60b5a492a376e64e55695eb089f0554adaa752877` |
| `aviso-garantia-legal-en.pdf` | `Legal guarantee_notice ENN.pdf` (arquivo PDF, 24 línguas) | `620b88ee6f916ca6925d6381c60848429575e32977b55d8ce56e37936dfa73be` |

Só mudou o **nome** do ficheiro: os originais têm espaços, e um espaço num
endereço de imagem já partiu um `srcset` noutro projecto. O conteúdo é byte a
byte o da Comissão, e `scripts/guards.mjs` confere estes quatro SHA-256 antes
de cada construção.

## De onde vieram

Da página da Comissão Europeia «Practical guidelines and high-resolution vector
files for the EU notice and label on product guarantees», descarregados a 26 de
setembro de 2026:

- SVG a cores (usar estes, e **não** os `_BW`, que são a preto e branco para
  lojas físicas):
  https://commission.europa.eu/document/download/27c45f1f-78a1-47a7-a7cc-adf23afee5ea_en?filename=SVG.zip
- PDF A4, página 1 a cores e página 2 a preto e branco:
  https://commission.europa.eu/document/download/29acbfc0-a26e-4c21-85af-8bc2b167103e_en?filename=Harmonised%20notice%20in%2024%20languages%20colour%20and%20black%20and%20white_0.zip

## Coisas que parecem erros e não são

- **As cores.** Os ficheiros usam `#0b4f9e` e `#faea26`; o regulamento escreve
  `#003399` e `#FFED00`. A Comissão manda usar os ficheiros tal como são.
- **O SVG não tem texto.** As letras estão convertidas em contornos (não há um
  único `<text>`). Por isso a página leva o texto oficial, palavra por palavra,
  no `alt` da imagem (`paginas.garantia.avisoAlt` em `src/i18n/*/paginas.json`,
  conferido com os PDF oficiais).
- **O peso.** O SVG português tem 629 KB, mas vai comprimido: são uns 60 KB pela
  rede, e só carrega nesta página.
- **O código QR do PT aponta para `…/guarantees-returns/index_pt.htm`**, e o
  endereço escrito por baixo dele é `europa.eu/youreurope/garantias`. Os dois
  chegam à mesma página. A ligação clicável ao lado do aviso é a curta.

## Uma língua nova no site

O arquivo da Comissão tem as 24 línguas. Copiar o SVG e o PDF da língua nova
para aqui (com um nome sem espaços), juntá-los a `AVISO_GARANTIA` em
`src/lib/pages.mjs` e o SHA-256 à guarda. Sem isso o gerador pára, de
propósito: uma página numa língua com o aviso de outra não é o aviso daquela
língua.


- **A altura era 900 px e nunca foi outra coisa.** O condutor abria cada página
  num `iframe` de 900 px de altura, qualquer que fosse a largura. A verificação
  «o menu de telemóvel cabe no ecrã sem rolar» compara o conteúdo da gaveta com
  o `innerHeight` DE DENTRO do iframe, por isso a conta era sempre `578 <= 901`:
  verdadeira para todos os telemóveis que existem. A guarda não podia falhar, e
  não falhou — enquanto a gaveta da cathelier transbordava, em produção, num
  ecrã de 568 px.

  Cada largura passa a trazer a altura do aparelho que representa (320×568,
  375×667, 390×844, 768×1024, 1280×800). Ao pôr a altura certa apareceram de
  imediato **dez falhas** que estiveram invisíveis o projecto todo: a gaveta a
  transbordar, e as fichas de produto a rolarem de lado a 320 px.

  Essa segunda tinha duas causas, e ambas são armadilhas da plataforma. Um
  `<fieldset>` tem `min-width: min-content` por omissão do browser — é o único
  elemento do HTML que se recusa a encolher — e um item de grelha tem
  `min-width: auto`, que faz o mesmo. As duas juntas davam 321 px de linha
  dentro de uma coluna de 288.

  É a segunda vez neste projecto que uma guarda mede contra um número escolhido
  por conveniência e devolve um ✓ sobre o que nunca viu.

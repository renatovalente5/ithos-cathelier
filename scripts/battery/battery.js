// Bateria injectável: mede o que só o browser sabe.
window.__bateria = function () {
  const R = [];
  const nota = (ok, o, detalhe = '') => R.push({ ok: !!ok, o, detalhe: String(detalhe).slice(0, 180) });

  // --- abrir o acordeão do rodapé ANTES de medir seja o que for ------------
  // Três medições desta bateria descartam o que não está pintado: alvos de
  // toque e contraste por `offsetParent !== null`, e o corpo de letra por
  // altura zero. Com os grupos do rodapé fechados no telemóvel, as ligações
  // legais deixavam de ser medidas — e as três imprimiam ✓ sobre conteúdo em
  // que nunca tinham tocado. Abre-se tudo, mede-se, e repõe-se no fim.
  const closedGroups = [...document.querySelectorAll('.foot__group:not([open])')];
  for (const g of closedGroups) g.open = true;

  // --- e a drawer, pela mesmíssima razão ------------------------------------
  // A drawer era aberta no FIM, só para se lhe medir a altura. Resultado: o
  // contraste, os alvos de toque e o corpo de letra corriam com ela fechada —
  // e um <dialog> fechado não tem geometria nenhuma. O menu de telemóvel, que
  // é a navegação mais usada do site, atravessou o projecto inteiro sem nunca
  // ser medido: 306 verificações e zero sobre ele.
  //
  // `show()` e não `showModal()`: o modal põe `inert` em todo o resto e a
  // página por trás deixava de se medir. Assim medem-se as duas, de uma vez.
  //
  // A ORDEM importa, e custou uma verificação que nunca correu. A pergunta
  // «a drawer está visível?» era feita ANTES de a abrir — e o nosso próprio
  // CSS tem `.drawer:not([open]) { display: none }`. Com a drawer fechada a
  // resposta era sempre «não», a condição era insatisfazível, e o teste que
  // mede se o menu cabe no ecrã nunca chegou a existir. Uma condição que
  // nunca é verdade não imprime ✗ nenhum: desaparece. Abre-se primeiro, e só
  // depois se pergunta se esta largura tem drawer (a partir de 60 rem não tem).
  const drawer = document.querySelector('.drawer');
  const drawerWasOpen = drawer?.open;
  if (drawer && !drawerWasOpen) drawer.show();
  const drawerIsShown = drawer && getComputedStyle(drawer).display !== 'none';
  if (drawer && !drawerIsShown && !drawerWasOpen) drawer.close();

  // --- transbordo lateral --------------------------------------------------
  const de = document.documentElement;
  nota(de.scrollWidth <= de.clientWidth + 1, 'não rola de lado',
    `scrollWidth ${de.scrollWidth} > clientWidth ${de.clientWidth}`);
  // Um filho de um rolador HORIZONTAL passa da margem por desenho — é para isso
  // que o rolador existe. O que não pode passar é a página, e isso mede-se
  // acima, no `scrollWidth`. Sem esta excepção, a fila de filtros do catálogo
  // acusava quatro transbordos que são o funcionamento correcto.
  const dentroDeRolador = (e) => {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      // `hidden` and `clip` count too, and leaving them out cost two false
      // failures. A carousel track is six slides at 100% each inside a box
      // that clips: the slides are SUPPOSED to sit past the edge, and the
      // clipping is what makes that correct. What may never pass the edge is
      // the page, and that is measured above on scrollWidth.
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };
  const transbordam = [...document.querySelectorAll('body *')]
    .filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1
      && getComputedStyle(e).position !== 'fixed'
      && !dentroDeRolador(e))
    .slice(0, 4).map((e) => `${e.tagName}.${(e.className || '').toString().split(' ')[0]}`);
  nota(transbordam.length === 0, 'nada passa da margem direita', transbordam.join(', '));

  // --- drawer lateral ------------------------------------------------------
  // Mede-se o CONTEÚDO, não o contentor: o contentor é largo de propósito e o
  // respiro vive no seu `padding`. Medir a caixa dava sempre «0 px de respiro»
  // em todas as páginas — catorze falhas seguidas, nenhuma verdadeira.
  const conteudo = document.querySelector('main h1, main p, main .peca__nome');
  if (conteudo) {
    const r = conteudo.getBoundingClientRect();
    nota(r.left >= 15 && de.clientWidth - r.right >= 15, 'há pelo menos 16 px de respiro dos lados',
      `esquerda ${Math.round(r.left)} direita ${Math.round(de.clientWidth - r.right)}`);
  }

  // --- contraste -----------------------------------------------------------
  // A cor tem de ser normalizada pelo BROWSER, não lida com uma expressão
  // regular. Um `color-mix()` computado sai como `color(srgb 0.98 0.96 0.94)` —
  // números entre 0 e 1 — e tratá-los como 0-255 dá um fundo quase preto. Foi
  // isso que fez esta bateria acusar 31 falhas de contraste que não existiam:
  // o contraste real era 7:1 e ela dizia 2,7:1.
  // A cor é PINTADA e lida de volta, em vez de analisada com uma expressão
  // regular. É a única forma que funciona para todas as sintaxes: `rgb()`,
  // `#rrggbb`, `color(srgb …)` (o que um `color-mix()` computado devolve, com
  // números de 0 a 1) e `oklch()`. Sobre branco, para resolver a transparência.
  const tela = document.createElement('canvas');
  tela.width = tela.height = 1;
  const ctx2 = tela.getContext('2d', { willReadFrequently: true });
  const rgbDe = (c, porBaixo = 'rgb(255,255,255)') => {
    ctx2.clearRect(0, 0, 1, 1);
    ctx2.fillStyle = porBaixo; ctx2.fillRect(0, 0, 1, 1);
    ctx2.fillStyle = c; ctx2.fillRect(0, 0, 1, 1);
    const d = ctx2.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = (c, porBaixo) => {
    const [r, g, b] = rgbDe(c, porBaixo).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const opaco = (c) => {
    if (!c || c === 'transparent') return false;
    const n = c.match(/[\d.]+/g);
    // O quarto número é a opacidade quando existe: um fundo a 0 não é fundo.
    return !(n && n.length === 4 && Number(n[3]) === 0);
  };
  const fundoDe = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (opaco(c)) return c;
      e = e.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
  };
  const corDoBody = getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
  const razao = (a, b) => {
    // O fundo pode ser translúcido (o cabeçalho é): compõe-se sobre o fundo do
    // corpo antes de medir. O texto compõe-se sobre o fundo já resolvido.
    const fundoResolvido = rgbDe(b, corDoBody);
    const fundoCss = `rgb(${fundoResolvido.join(',')})`;
    const [x, y] = [lum(a, fundoCss), lum(fundoCss)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const maus = [];
  const textos = [...document.querySelectorAll('p, a, li, h1, h2, h3, h4, span, button, label, td, th, summary, dt, dd')]
    .filter((e) => e.offsetParent !== null && e.textContent.trim().length > 1
      && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  for (const e of textos) {
    const s = getComputedStyle(e);
    const tam = parseFloat(s.fontSize);
    const grande = tam >= 24 || (tam >= 18.66 && Number(s.fontWeight) >= 700);
    const r = razao(s.color, fundoDe(e));
    const minimo = grande ? 3 : 4.5;
    if (r < minimo) {
      maus.push(`${e.tagName}.${(e.className || '').toString().split(' ')[0]} «${e.textContent.trim().slice(0, 26)}» ${r.toFixed(2)}:1 (min ${minimo})`);
    }
  }
  nota(maus.length === 0, `contraste de ${textos.length} textos`, maus.slice(0, 5).join(' · '));

  // --- alvos de toque ------------------------------------------------------
  /* Duas isenções, e as duas são da própria norma (WCAG 2.5.8):
     · um campo dentro de uma <label> tem como alvo A ETIQUETA INTEIRA, que é
       grande — medir a caixa de 20 px dá um falso positivo;
     · uma ligação no meio de uma frase está expressamente isenta.
     Sem elas, a bateria acusava dez alvos que não têm problema nenhum, e o
     ruído escondia os três que tinham. */
  const dentroDeEtiqueta = (e) => {
    const lab = e.closest('label');
    return !!lab && lab.getBoundingClientRect().height >= 23.5;
  };
  const noMeioDeUmaFrase = (e) => {
    if (e.tagName !== 'A') return false;
    const pai = e.parentElement;
    if (!pai) return false;
    const texto = pai.textContent.trim();
    return texto.length > e.textContent.trim().length + 3;
  };
  const pequenos = [...document.querySelectorAll('a, button, input[type=checkbox], input[type=radio], select')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ e, r }) => (r.height < 23.5 || r.width < 23.5)
      && !dentroDeEtiqueta(e) && !noMeioDeUmaFrase(e)
      && !e.closest('.migalhas, .rodape__legal, .prosa, .linha__opcoes'))
    .slice(0, 5)
    .map(({ e, r }) => `${e.tagName}«${e.textContent.trim().slice(0, 18)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
  nota(pequenos.length === 0, 'alvos de toque com pelo menos 24 px', pequenos.join(' · '));

  // --- imagens -------------------------------------------------------------
  // A prova de que uma imagem falhou é o ESTADO DA RESPOSTA, não o
  // `naturalWidth`: numa moldura fora do ecrã o browser troca de candidato a
  // meio e há um instante em que `complete` é verdade com `naturalWidth` a
  // zero. A primeira versão desta bateria acusou três imagens que carregam
  // perfeitamente numa página normal.
  const respostas = new Map(performance.getEntriesByType('resource')
    .map((r) => [r.name, r.responseStatus]));
  const partidas = [...document.images]
    .map((i) => i.currentSrc || i.src)
    .filter((u) => u && respostas.get(u) >= 400)
    .slice(0, 4);
  nota(partidas.length === 0, 'nenhuma imagem partida (pelo estado da resposta)', partidas.join(', '));
  const semAlt = [...document.images].filter((i) => i.alt === null || i.alt === undefined).length;
  nota(semAlt === 0, 'todas as imagens têm atributo alt', String(semAlt));

  // --- estrutura -----------------------------------------------------------
  nota(document.querySelectorAll('h1').length === 1, 'há exactamente um h1',
    String(document.querySelectorAll('h1').length));
  nota(!!document.querySelector('main#main'), 'há um <main> com âncora');
  nota(document.documentElement.lang === 'en', 'a língua está declarada', document.documentElement.lang);
  const marca = document.documentElement.dataset.brand;
  nota(['ithos', 'cathelier'].includes(marca), 'the brand is in the HTML as served', marca);

  // --- tipografia carregada ------------------------------------------------
  const esperadas = { ithos: ['Montserrat', 'Cormorant Garamond'], cathelier: ['Klee One', 'Grandstander'] }[marca] ?? [];
  const carregadas = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  for (const f of esperadas) nota(carregadas.includes(f), `tipo «${f}» carregado`, carregadas.join(', '));

  // --- corpo de letra mínimo ------------------------------------------------
  // Não há mínimo na WCAG, mas há na prática: abaixo de 12 px um texto no
  // telemóvel deixa de se ler sem aproximar os dedos, e o iOS passa a oferecer
  // zoom automático nos campos. Mede-se o TEXTO VISÍVEL, não a folha de
  // estilo — o que interessa é o que chega ao ecrã depois dos `clamp()`.
  const miudos = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!e.firstChild || e.firstChild.nodeType !== 3 || !e.textContent.trim()) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const px = parseFloat(getComputedStyle(e).fontSize);
    if (px < 12) miudos.push(`${e.tagName}.${(e.className || '').toString().split(' ')[0]} ${px.toFixed(1)}px`);
  }
  nota(miudos.length === 0, 'nenhum texto abaixo de 12 px', miudos.slice(0, 5).join(' · '));

  // --- o menu cabe no ecrã --------------------------------------------------
  // A drawer é `100dvh` e não rola. Se o conteúdo crescer (mais uma entrada,
  // uma contagem mais larga), a última linha sai por baixo sem aviso — e a
  // última linha é o telefone.
  if (drawerIsShown) {
    const contentHeight = [...drawer.children].reduce((t, e) => t + e.getBoundingClientRect().height, 0);
    nota(contentHeight <= innerHeight + 1, 'o menu de telemóvel cabe no ecrã sem rolar',
      `conteúdo ${Math.round(contentHeight)}px, ecrã ${innerHeight}px`);
    nota(drawer.querySelectorAll('.drawer__nav a').length >= 3,
      'a drawer foi medida com as entradas lá dentro',
      `${drawer.querySelectorAll('.drawer__nav a').length} entradas`);
  }

  // O `summary` é um alvo de toque por direito próprio — mas SÓ enquanto for
  // clicável. A partir de 60 rem o acordeão desaparece: o CSS põe-lhe
  // `pointer-events: none` e ele volta a ser um cabeçalho de coluna, que não
  // se mede como alvo. Medir os dois casos com a mesma régua dava 64 falsos.
  for (const sm of document.querySelectorAll('.foot__group > summary')) {
    if (getComputedStyle(sm).pointerEvents === 'none') continue;
    const r = sm.getBoundingClientRect();
    nota(r.height >= 24 && r.width >= 24, 'o título do grupo do rodapé é um alvo de toque',
      `${Math.round(r.width)}×${Math.round(r.height)}`);
  }

  for (const g of closedGroups) g.open = false;
  if (drawerIsShown && !drawerWasOpen) drawer.close();

  return { total: R.length, falhas: R.filter((x) => !x.ok), tudo: R };
};
'bateria pronta';

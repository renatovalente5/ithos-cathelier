# ithos · cathelier

One domain, two shops that must not look like each other.

* **ithos** — handmade wooden night lights for children's rooms.
  Built to the shape of the shop the owner chose as the model: a 1:1 product
  frame, a four-column grid, colour swatches on the card, and a gallery-first
  product page.
* **cathelier** — personalised laser-cut pieces, organised in the ten collections
  the owner listed on 25 September 2026 (Christmas, Easter, special days, magnets
  and keyrings, new baby, names, hanging pieces, wall decor, custom orders, favours),
  in the warm cream-and-brown world of the second shop the owner chose.

They share one cart, one checkout, one set of legal pages and one back office.
They share almost no CSS.

English only for now. Every string lives in `src/i18n/` so other languages cost
translation, not rework.

## The photographs come first

Of the 58 studio files, two thirds are 2:3, and the shop's cards are 3:4 frames.
`scripts/cards.py` finds the subject in each portrait photograph and centres a
3:4 window on it; `photos/focus.json` records, by hand, the sixteen frames where the
guess was wrong. Read the header of that script before touching any of it.

**A cover photograph must show the whole piece.** Some of the studio files are
deliberate close-ups that run off the frame — good as the second or third
picture in a gallery, never as the face of a product card.

## Onde vive

O CI (`.github/workflows/publish.yml`) constrói o site e publica `public/` num
Worker da Cloudflare de ficheiros (`wrangler.jsonc`) — o único código,
`worker/intervalos.js`, só corre para o vídeo da capa, porque os ficheiros
estáticos ignoram pedidos por intervalos e o iOS precisa deles —, servido em
ithos-cathelier.pt por uma route; o www vai para o apex por uma Redirect Rule
da zona. O GitHub Pages foi desligado a 26 set 2026: os termos dele proíbem
lojas. **Não correr `wrangler deploy` à mão:** o `public/` local não é o do CI —
não tem as versões web das fotografias juntas no painel (só o CI as gera) e,
construído sem `PREVIEW=yes` e sem `API_URL`, publicava um site indexável e sem
API (stock, revenda e retratação desligados). Os cabeçalhos (cache de um ano nos
ficheiros com resumo no nome, e os de segurança) saem de `public/_headers`,
escrito pelo build.

## Running it

```bash
node src/build.mjs                                  # live address, from CNAME
BASE_URL=http://localhost:4320 PREVIEW=yes node src/build.mjs

python3 scripts/cards.py --contact    # review sheets for the card crops
python3 scripts/cards.py              # write the card masters
python3 scripts/renditions.py         # web sizes from the masters
python3 scripts/fonts.py              # re-download the self-hosted typefaces
python3 scripts/share.py              # the link-preview cards (og:image); CI runs it too
node scripts/logos.mjs                # the logos as PNG for those cards, only when a logo changes
```

Fotografias juntas no painel: o Worker grava só o original; as versões web
geram-se no CI e ficam numa cache entre publicações (ver publish.yml), por isso
cada fotografia custa uns segundos uma vez. `cards.py` e `renditions.py` passam
à frente de um original que não abre (avisam) e deitam fora os masters e as
versões de uma fotografia cujo original saiu; quem decide se alguma página
precisa de uma fotografia em falta são as guardas.

### O cartão de partilha (o que o WhatsApp mostra)

Desde 7 out 2026 cada página dá às redes um cartão **com o logótipo**
(`og:image`), porque a queixa foi essa: «quando partilho o link não aparece o
logo». São imagens JPEG de 1200×630 com a arte verdadeira da cliente —
`assets/brand/ithos-wordmark.svg` e `cathelier.svg`, passados a PNG por um
browser, nunca redesenhados nem recoloridos — sobre o fundo de cada loja.

| Cartão | Onde |
|---|---|
| `share-ithos-cathelier.jpg` (as duas marcas) | a entrada (`/`, `/en/`), as cópias ithos das páginas partilhadas (contactos, cesto, legais, revendedores — são as canónicas das duas lojas), pagar, obrigado, encomenda cancelada, o 404 da raiz |
| `share-ithos.jpg` | as páginas da ithos (candeeiros, oficina, cuidados) |
| `share-cathelier.jpg` | as páginas da cathelier, as cópias cathelier das partilhadas, os stubs |
| `public/media/partilha/<marca>/<pasta>/<foto>.jpg` | cada ficha: o logótipo e a fotografia da capa do produto (a mesma `cover` que a página mostra) |

**Duas formas, uma imagem.** O WhatsApp mostra o link em grande (a imagem
inteira, 1.91:1) ou em pequeno (um quadrado cortado ao meio). Tudo o que tem
de se ver fica dentro do quadrado central, x 285–915: nas marcas, o
logótipo; nas fichas, o logótipo e o produto lado a lado. O `share.py` pára se
alguma coisa sair do quadrado.

**Voltar a gerar.** `python3 scripts/share.py` refaz só o que mudou: cada
cartão traz dentro (comentário do JPEG) a receita de que saiu — a versão do
desenho (`DESENHO`), o resumo do SVG de cada logótipo e o de cada fotografia.
O CI corre-o depois do `renditions.py`, e é assim que as fichas das
fotografias juntas no painel ganham cartão. Trocar um logótipo em
`assets/brand/` obriga a `node scripts/logos.mjs` (precisa do Playwright com o
Chromium: `PLAYWRIGHT=/caminho/node_modules/playwright`) e depois ao
`share.py`; sem isso, `scripts/guards.mjs` pára a publicação. Mudar o desenho
é mudar `DESENHO` no `share.py`.

**A morada muda com o desenho.** O gerador acrescenta `?v=<resumo do ficheiro>`
ao `og:image`: a Meta guarda as imagens pela morada, e um cartão redesenhado
com o endereço antigo ficava velho no Facebook. O nome do ficheiro não muda, e
uma pré-visualização antiga recebe o desenho novo em vez de um 404. O
`assets/brand/share.jpg` antigo (as duas capas, sem logótipo) fica publicado
pela mesma razão: há pré-visualizações feitas com ele.

**As etiquetas.** `og:image` absoluto, `og:image:secure_url`, `:type`,
`:width`, `:height` (lidos do ficheiro) e `:alt` na língua da página, e
`twitter:image`. O `check-output` confere cada uma contra os bytes publicados,
mais os limites do WhatsApp (menos de 600 KB, 300 px ou mais, até 4:1, o
`<head>` nos primeiros 300 KB) e os 600×315 da Meta.

**O robots.txt em PREVIEW** deixa entrar só os dois robôs das
pré-visualizações — `facebookexternalhit` (Facebook, Messenger, Instagram) e
`WhatsApp` — e mantém o `Disallow: /` para os outros; o `noindex` continua nas
páginas. Um «Disallow: /» para todos fechava a porta ao robô da Meta. O
`meta-externalagent` (treino de IA da Meta) não entra. Fora do PREVIEW entra
toda a gente, como antes.

**Para ver se funciona** (depois de publicar): no telemóvel, escrever a
mensagem com um endereço que esse telemóvel nunca partilhou
(`https://ithos-cathelier.pt/?v=2`, `?v=3`…) e **não enviar**: em 10 s a
pré-visualização tem de aparecer, em grande e com o logótipo. A Meta guarda o
robots.txt até 24 h. No Facebook, o Sharing Debugger
(developers.facebook.com/tools/debug, «Scrape Again») relê a página.



`public/` holds 104 HTML files: **94 pages** and **10 redirect stubs**. The stubs
sit at the ten old cathelier occasion addresses (`/cathelier/christmas/` and the
rest), which were deleted on 17 September 2026 when an occasion became a filter
on `/cathelier/pieces/`. When the collections changed on 25 September 2026, five
of those old words no longer existed; their stubs now point at the collection
their pieces went to, and the same table feeds the map in `shop.js` that turns an
old `#home` or `#fathers-day` shared before the change into the new one. They are
listed in `src/lib/redirects.mjs`, they are not
in the sitemap, and both the build and `check-output` report them apart from the
page count — a file count has never been able to tell a signpost from a
destination.

### Os separadores da cathelier mudam no painel

Desde 27 set 2026 a dona cria, esconde e apaga separadores no painel (as
«ocasiões» de `content/cathelier/_occasions.json`). As regras estão num sítio
só, `src/lib/ocasioes.mjs`, que o gerador, as guardas e o check-output usam:

* **Um separador vê-se quando está publicado E tem pelo menos uma peça à
  venda.** Um acabado de criar não aparece (o círculo dele esvaziava a lista)
  até ter a primeira peça; não é erro, é um aviso nas guardas.
* **Apagado**, as peças dele foram arrumadas pelo painel no mesmo commit, e o
  painel escreve `content/cathelier/_occasions-moved.json`
  (`{ "moved": { "christmas": "easter" } }`): o stub `/cathelier/christmas/` e
  um `#christmas` partilhado levam à Páscoa. A cadeia segue-se.
* **Escondido** (o Natal fora de época), quem chega pela morada antiga vai para
  a lista completa, com um texto que o diz. As peças continuam à venda.
* Um separador sem desenho próprio leva o genérico (`src/lib/occasions-art.mjs`);
  as guardas dizem quais, para lhes desenhar um.

As guardas continuam a parar com uma peça num separador que não existe, e
param também se nenhum separador se vir. `src/lib/redirects.mjs` não muda: é
história, e o destino de cada stub segue os separadores.

### The browser battery

Measures what only a browser knows: real contrast, tap targets, sideways
overflow, broken images, the typefaces actually loading. It **drives** the site
rather than reading it.

```bash
cp scripts/battery/battery.js public/_battery.js
cp scripts/battery/drive.html public/_drive.html
# then open /_drive.html?w=390 (and ?w=768, ?w=1280) and read window.__resultados
```

The build wipes `public/`, so both files have to be copied again after every
build. Neither goes to the live site.

The filtered lists it drives (`/cathelier/pieces/#…`) are read from the filter
buttons the built list actually has — christmas, keepsakes and custom when they
show, then the others — so a tab the owner hides or deletes in the back office
is not a false alarm. A tab that holds every piece (the last one left) may show
the whole list; what is checked is that nothing from outside it shows.

### The cover photograph

Every product names its own `cover`, and it is **not** taken to be photograph
number one. The cover is the frame that shows the whole piece against a clean
background; the close-ups and the room shots are what the gallery is for, and
the card cycles through them on hover.

All 26 were reviewed on a contact sheet. Four still have a cover that is not
what it should be, and none of them has an alternative to switch to — they each
have exactly one photograph:

  penguin      a workshop shot with an easel, paint pots and two penguins
  raccoon      the raccoon runs off the left edge, cushions behind
  snail        a room shot on a chair, loosely framed
  wood-racer   lying on autumn leaves, busy background

These need one plain studio photograph each, of the whole piece on the brown
backdrop, like the other twenty-two.

## A note about analysis agents

Agents spawned to *analyse* this repository have write access to it. During the
cover study, four of them edited `src/lib/ithos.mjs`, `src/lib/cathelier.mjs`
and both brand stylesheets while I was working, and those edits were swept into
an unrelated commit by a `git add -A`.

The work was good and it survived verification, so it stayed. That was luck.
**Run `git status` after every analysis workflow, before staging anything**, and
stage by path rather than with `-A` while one is running.

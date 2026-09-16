#!/usr/bin/env python3
"""
Downloads the typefaces from Google Fonts so they are SELF-HOSTED.

Porquê: servir fontes de fonts.gstatic.com faz o browser do visitante contactar um
domínio da Google. Isso é uma transferência de dados para um terceiro, obriga a
nomeá-lo na política de privacidade e, em vários entendimentos, a pedir
consentimento. Auto-alojadas, o site não contacta ninguém — e é por isso que não
precisa de aviso de cookies.

Só se guardam os subconjuntos `latin` e `latin-ext`: o português precisa dos dois.

    python3 scripts/fontes.py
"""
import re
import subprocess
import sys
from pathlib import Path

DEST = Path(__file__).resolve().parent.parent / 'src' / 'fonts'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/140.0 Safari/537.36')

# Four families, and the reason for each is the shop it comes from.
#
#   Montserrat  — everything on the ithos side. The shop the owner chose as her
#                 model sets its entire interface in it: 300 for quiet text, 400
#                 for body, 500 for product names, 600 for prices and buttons.
#   Cormorant   — the ithos display line, and the one substitution in the whole
#                 project. That shop's headline face is Canela, which is
#                 licensed and cannot be used. Cormorant Garamond at 300 is the
#                 nearest free relative: the same high contrast, the same long
#                 delicate serifs, the same air at large sizes.
#   Klee One    — the cathelier body. The second shop sets its body copy in it,
#                 and it is free. A brush-hand serif that reads as handwriting
#                 without being a script.
#   Grandstander— the cathelier headings, straight from that shop too. A rounded
#                 display sans that keeps a personalised-gift shop from feeling
#                 like an office.
FAMILIAS = {
    'montserrat': 'Montserrat:wght@300..600',
    'cormorant': 'Cormorant+Garamond:ital,wght@0,300..500;1,300',
    'kleeone': 'Klee+One:wght@400;600',
    'grandstander': 'Grandstander:wght@100..700',
}



def curl(url, binario=None):
    cmd = ['curl', '-sS', '-A', UA, url]
    if binario:
        cmd += ['-o', str(binario)]
        subprocess.run(cmd, check=True)
        return None
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    total = 0
    for nome, familia in FAMILIAS.items():
        css = curl(f'https://fonts.googleapis.com/css2?family={familia}&display=swap')
        blocos = re.findall(r'/\*\s*([a-z0-9\-\[\] ]+?)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S)
        guardados = []
        for rotulo, corpo in blocos:
            if rotulo not in ('latin', 'latin-ext'):
                continue
            m = re.search(r'url\((https://[^)]+\.woff2)\)', corpo)
            if not m:
                continue
            italico = 'font-style: italic' in corpo
            # The weight belongs in the filename, and finding out why cost a
            # font. A VARIABLE family returns one @font-face per subset and the
            # weight is a range. A STATIC one returns a separate block per
            # weight, all with the same subset label — so naming the file after
            # the subset alone made Klee One 600 overwrite Klee One 400, and the
            # shop would have set its body copy in semibold with nothing to show
            # for it. Two files, two names.
            peso = re.search(r'font-weight:\s*([0-9]+)(?:\s+([0-9]+))?', corpo)
            variavel = bool(peso and peso.group(2))
            sufixo = '' if variavel or not peso else f'-{peso.group(1)}'
            alvo = DEST / f'{nome}{sufixo}{"-italico" if italico else ""}-{rotulo}.woff2'
            curl(m.group(1), alvo)
            guardados.append(f'{alvo.name} ({alvo.stat().st_size // 1024} KB)')
            total += alvo.stat().st_size
        print(f'{nome:14s} {" · ".join(guardados) if guardados else "!! NADA GUARDADO"}')
    print(f'\ntotal: {total // 1024} KB em {DEST}')


if __name__ == '__main__':
    sys.exit(main())

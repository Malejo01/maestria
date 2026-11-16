"""Pase de tokens: reemplaza las clases de la paleta de Tailwind por los tokens
del sistema de diseño, en todo `app/` y `components/` menos los primitivos
vendored de `components/ui/`.

    python scripts/codemod-tokens.py            # aplica
    python scripts/codemod-tokens.py --simular  # sólo cuenta

Toca ÚNICAMENTE nombres de clase. No cambia lógica, ni JSX, ni textos: el
motor de cuestionarios y los inputs de respuesta se probaron con 31 alumnos y
este pase no los altera por dentro.

Reglas (design-reference/sistema/brand-book.md):

  verdes            → logrado      (acierto, dominado)
  rojos y naranjas  → flojo        (naranja, NUNCA rojo: "reforzá esto")
  azules y violetas → accion       (un solo azul)
  grises            → texto / texto-suave / borde / superficie-base
  blanco y negro    → superficie-tarjeta / texto-sobre-accion / texto

  Los tonos claros (≤200) y los muy oscuros (≥800) de un color son su versión
  "fondo"; los del medio, el color pleno. Así `bg-green-50 text-green-700`
  queda `bg-logrado-fondo text-logrado`, que es el par con contraste medido.

  Degradés → el color sólido de arranque. Sombras y desenfoques → afuera
  ("bordes, no sombras"). Animaciones CSS de Tailwind → afuera (toda animación
  es de Framer Motion); `animate-spin` se deja, porque quitarlo dejaría un
  ícono de carga quieto, y se reemplaza a mano por <Cargando />.

Es idempotente: una segunda corrida no cambia nada.
"""
import io
import os
import re
import sys

SIMULAR = '--simular' in sys.argv
RAICES = ['app', 'components']
EXCLUIR = ('components' + os.sep + 'ui' + os.sep,)

VERDES = 'green|emerald|teal|lime'
CALIDOS = 'red|rose|pink|orange|amber|yellow'
AZULES = 'blue|indigo|violet|purple|fuchsia|sky|cyan'
GRISES = 'slate|gray|zinc|neutral|stone'
COLORES = f'{VERDES}|{CALIDOS}|{AZULES}|{GRISES}|white|black'
UTILIDADES = 'text|bg|border|ring|from|via|to|fill|stroke|divide|outline|decoration|placeholder|caret|accent|shadow'

# Sin comillas en la clase de caracteres. Con ellas, una clase con variante al
# principio de una cadena ('hover:shadow-xl ...') se llevaba puesta la comilla
# de apertura al quitarse: pasó dos veces, y lo atrapó el compilador.
VARIANTE = r'(?:[a-z0-9\[\]&>_.=-]+:)*'
CLASE = re.compile(
    rf'(?<![\w/-])({VARIANTE})({UTILIDADES})-({COLORES})(?:-(\d{{2,3}}))?(/\d+)?(?![\w-])'
)

familia = lambda c: (
    'verde' if re.fullmatch(VERDES, c) else
    'calido' if re.fullmatch(CALIDOS, c) else
    'azul' if re.fullmatch(AZULES, c) else
    'gris' if re.fullmatch(GRISES, c) else c
)


def token(util, color, tono):
    f = familia(color)
    t = int(tono) if tono else 500
    claro_u_oscuro = t <= 200 or t >= 800

    if util in ('text', 'fill', 'stroke', 'decoration', 'caret', 'placeholder', 'accent'):
        return {
            'verde': 'logrado', 'calido': 'flojo', 'azul': 'accion',
            'gris': 'texto' if t >= 600 else 'texto-suave',
            'white': 'texto-sobre-accion', 'black': 'texto',
        }[f]

    if util in ('bg', 'from'):
        return {
            'verde': 'logrado-fondo' if claro_u_oscuro else 'logrado',
            'calido': 'flojo-fondo' if claro_u_oscuro else 'flojo',
            'azul': 'accion-tenue' if claro_u_oscuro else 'accion',
            'gris': 'superficie-base' if t <= 200 else 'borde' if t <= 400 else 'texto-suave' if t <= 700 else 'texto',
            'white': 'superficie-tarjeta', 'black': 'texto',
        }[f]

    # border, ring, divide, outline
    return {
        'verde': 'logrado', 'calido': 'flojo',
        'azul': 'accion-tenue-borde' if t <= 300 else 'accion',
        'gris': 'borde' if t <= 200 else 'borde-fuerte' if t <= 400 else 'texto-suave',
        'white': 'superficie-tarjeta', 'black': 'texto',
    }[f]


def reemplazar(m):
    variante, util, color, tono, opacidad = m.groups()
    if util in ('via', 'to', 'shadow'):
        return ''  # parte de un degradé o sombra de color: se va
    destino = 'bg' if util == 'from' else util
    return f'{variante}{destino}-{token(util, color, tono)}{opacidad or ""}'


# Clases que se van enteras, con o sin variante adelante.
QUITAR = re.compile(
    rf'(?<![\w/-]){VARIANTE}(?:'
    r'bg-gradient-to-[a-z]+|bg-linear-to-[a-z]+|'
    r'from-transparent|(?:via|to)-(?:primary|secondary|accent|background|card|muted|transparent|\[[^\]\s]+\])(?:/\d+)?|'
    r'backdrop-blur(?:-[a-z0-9]+)?|'
    r'shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?|'
    r'shadow-\[[^\]\s]+\](?:/\d+)?|shadow-(?:primary|destructive|black|white)(?:/\d+)?|drop-shadow(?:-[a-z0-9]+)?|'
    r'animate-(?:pulse|bounce|ping|shake|in|out)'
    r')(?![\w/-])'
)


def procesar(texto):
    # Un degradé que arrancaba en un color del tema conserva ese color, sólido.
    texto = re.sub(
        rf'(?<![\w/-])({VARIANTE})bg-gradient-to-[a-z]+(\s+)({VARIANTE})from-(primary|secondary|accent|background|card|muted)(/\d+)?',
        lambda m: f'{m.group(3)}bg-{m.group(4)}{m.group(5) or ""}',
        texto,
    )
    texto = CLASE.sub(reemplazar, texto)
    # El arranque de un degradé pasa a ser el fondo sólido. Sin esto, un botón
    # que sólo tenía color por su degradé quedaba sin fondo y con el texto
    # invisible (pasó con la pantalla de carga y con los botones del cuestionario).
    texto = re.sub(
        rf'(?<![\w/-])({VARIANTE})from-(\[[^\]\s]+\]|primary|secondary|accent|background|card|muted)(/\d+)?(?![\w/-])',
        lambda m: f'{m.group(1)}bg-{m.group(2)}{m.group(3) or ""}',
        texto,
    )
    texto = QUITAR.sub('', texto)
    # Los huecos que dejan las clases quitadas, sólo dentro de cadenas de clases.
    texto = re.sub(r'(className=(?:"|\{`|\{\'|\{cn\(\s*\'))\s+', r'\1', texto)
    texto = re.sub(r'(?<=[\w\]\)/%.-])[ \t]{2,}(?=[\w\[!&-])', ' ', texto) if False else texto
    return texto


def limpiar_espacios(linea):
    """Colapsa espacios dobles sólo en líneas que tienen una lista de clases."""
    if 'className' not in linea and '`' not in linea and "'" not in linea:
        return linea
    sangria = len(linea) - len(linea.lstrip(' '))
    cuerpo = re.sub(r'(?<=\S) {2,}(?=\S)', ' ', linea[sangria:])
    cuerpo = re.sub(r'" (?=[>\s/])', '" ', cuerpo)
    cuerpo = cuerpo.replace(' "', ' "').replace('( ', '(')
    cuerpo = re.sub(r' +(["`\'])(?=[\s>),}])', r'\1', cuerpo)
    return linea[:sangria] + cuerpo


cambiados = 0
for raiz in RAICES:
    for carpeta, _, archivos in os.walk(raiz):
        for nombre in archivos:
            ruta = os.path.join(carpeta, nombre)
            if not nombre.endswith(('.tsx', '.ts')) or '.test.' in nombre:
                continue
            if any(parte in ruta for parte in EXCLUIR):
                continue
            original = io.open(ruta, encoding='utf-8').read()
            nuevo = procesar(original)
            if nuevo != original:
                nuevo = '\n'.join(
                    limpiar_espacios(n) if n != o else n
                    for n, o in zip(nuevo.split('\n'), original.split('\n'))
                ) if nuevo.count('\n') == original.count('\n') else nuevo
                cambiados += 1
                print(ruta)
                if not SIMULAR:
                    io.open(ruta, 'w', encoding='utf-8', newline='\n').write(nuevo)

print(f'{cambiados} archivos {"cambiarían" if SIMULAR else "cambiados"}')

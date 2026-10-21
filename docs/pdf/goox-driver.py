"""PDF de la marca propuesta Goox Driver: dominio, revisión, diez logos, ventajas y pronunciación.
Uso: python3 docs/pdf/goox-driver.py
Luego: node docs/pdf/a-pdf.mjs docs/pdf/goox-driver.html docs/Goox-Driver-2026-10-21.pdf
"""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))


def palabra(fuente, peso, color, tam=34, estilo='normal', esp=0, texto='Goox'):
    return f'<span style="font-family:\'{fuente}\';font-weight:{peso};font-style:{estilo};color:{color};font-size:{tam}pt;letter-spacing:{esp}px;line-height:1">{texto}</span>'


def driver(color, fuente='Poppins', abajo=True, tam=8.5):
    return f'<span style="font-family:\'{fuente}\';font-weight:600;color:{color};font-size:{tam}pt;letter-spacing:3px;text-transform:uppercase;{"margin-top:1.2mm" if abajo else "margin-left:1.5mm;align-self:flex-end;margin-bottom:1.5mm"}">driver</span>'


# Diez propuestas: (nombre, idea, fondo, ícono SVG 64x64, html de la marca)
L = [
    ('Dos ruedas', 'Las dos «o» son las ruedas de una moto: movimiento y reparto.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#111"/><circle cx="21" cy="40" r="9" fill="none" stroke="#c6f432" stroke-width="5"/><circle cx="43" cy="40" r="9" fill="none" stroke="#c6f432" stroke-width="5"/><path d="M21 40 30 24h10l3 16" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>',
     palabra('Poppins', 800, '#111') + driver('#5a8a00')),
    ('Carita amable', 'Las «o» son ojos: una marca cercana, que sonríe.', '#fff4e6',
     '<circle cx="32" cy="32" r="30" fill="#ff7a00"/><circle cx="23" cy="28" r="6" fill="#fff"/><circle cx="41" cy="28" r="6" fill="#fff"/><circle cx="24" cy="29" r="2.6" fill="#111"/><circle cx="42" cy="29" r="2.6" fill="#111"/><path d="M22 41q10 8 20 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
     palabra('Fredoka', 700, '#3a1d00') + driver('#ff7a00', 'Fredoka')),
    ('Cruce de caminos', 'La «x» es un cruce: conectamos restaurantes, gente y destinos.', '#fffbe0',
     '<rect width="64" height="64" rx="12" fill="#ffd400"/><path d="M14 14 50 50M50 14 14 50" stroke="#111" stroke-width="9" stroke-linecap="round"/><path d="M14 14 50 50M50 14 14 50" stroke="#ffd400" stroke-width="1.6" stroke-dasharray="4 5"/>',
     palabra('Archivo Black', 400, '#111') + driver('#111')),
    ('Ruta infinita', 'Las «oo» forman un recorrido que no se corta.', '#eaf7f6',
     '<circle cx="32" cy="32" r="30" fill="#0b7a75"/><path d="M14 32c0-7 5-11 10-11 8 0 8 22 16 22 5 0 10-4 10-11s-5-11-10-11c-8 0-8 22-16 22-5 0-10-4-10-11z" fill="none" stroke="#fff" stroke-width="5"/>',
     palabra('Outfit', 800, '#063b39') + driver('#0b7a75', 'Outfit')),
    ('Velocidad', 'Letra inclinada y líneas de viento: llega rápido.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#e8222c"/><path d="M12 24h18M8 32h22M12 40h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M34 18h12l-6 28H28z" fill="#fff"/>',
     palabra('Barlow', 900, '#e8222c', estilo='italic') + driver('#111', 'Barlow')),
    ('La caja', 'Un paquete: comida, mercado y envíos.', '#f6efe6',
     '<rect width="64" height="64" rx="14" fill="#7a4a24"/><path d="M14 24 32 15l18 9v20l-18 9-18-9z" fill="#e8c69a"/><path d="M14 24l18 9 18-9M32 33v20" fill="none" stroke="#7a4a24" stroke-width="3"/>',
     palabra('Montserrat', 800, '#3b2412') + driver('#7a4a24', 'Montserrat')),
    ('Minimalista', 'En minúsculas, limpio, de empresa de tecnología.', '#ffffff',
     '<rect width="64" height="64" rx="32" fill="#1257ff"/><circle cx="25" cy="32" r="7" fill="#fff"/><circle cx="41" cy="32" r="7" fill="none" stroke="#fff" stroke-width="4"/>',
     palabra('Sora', 700, '#0a1a3f', texto='goox') + driver('#1257ff', 'Sora')),
    ('Insignia', 'Un sello redondo, para gorras, cascos y maletas de reparto.', '#eef8ee',
     '<circle cx="32" cy="32" r="30" fill="#1f8a3a"/><circle cx="32" cy="32" r="23" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 3"/><text x="32" y="39" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="20" fill="#fff">G</text>',
     palabra('Baloo 2', 800, '#0f4a1f') + driver('#1f8a3a', 'Baloo 2')),
    ('Calle', 'Letra alta y angosta, de cartel de carretera.', '#0e1b2c',
     '<rect width="64" height="64" rx="10" fill="#f2a900"/><path d="M22 54 30 10h4l8 44" fill="#0e1b2c"/><path d="M32 16v6M32 28v6M32 40v6" stroke="#f2a900" stroke-width="2.5"/>',
     palabra('Bebas Neue', 400, '#ffffff', tam=42, esp=2) + driver('#f2a900', 'Poppins', False)),
    ('Flecha', 'La «G» que avanza: siempre en camino.', '#fff1ee',
     '<rect width="64" height="64" rx="18" fill="#ff5a3c"/><path d="M44 22a15 15 0 1 0 3 14H33" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M40 30l8 6-8 6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
     palabra('Space Grotesk', 700, '#2d0f08') + driver('#ff5a3c', 'Space Grotesk')),
]

IDIOMAS = [
    ('Inglés', 'gúks', 'como «goose» con una equis al final; rima con «books» alargando la u'),
    ('Español', 'gúks', 'la doble o se dice «u», como en Google; dos letras para enseñar una vez'),
    ('Portugués', 'gúks', 'igual que en inglés; en Brasil Google se dice «gúgol»'),
    ('Francés', 'gúks', 'se escribe «gouks» al decirlo; muy natural'),
    ('Italiano', 'gúks', 'sin cambios; la equis final suena firme'),
    ('Alemán', 'gúks', 'en alemán la doble o se leería «oo» largo; en marca se adopta «gúks», como Google'),
    ('Chino mandarín', 'gǔ kè sī · 古克斯', 'tres sílabas aproximadas, como se adaptan las marcas extranjeras'),
    ('Japonés', 'gūkusu · グークス', 'adaptación al silabario katakana'),
    ('Árabe', 'ghūks · غوكس', 'sonido parecido, se lee de derecha a izquierda'),
    ('Hindi', 'gūks · गूक्स', 'una sílaba larga, fácil'),
    ('Ruso', 'guks · Гукс', 'corto y directo'),
]


def icono(svg, tam='17mm'):
    return f'<svg viewBox="0 0 64 64" width="{tam}" height="{tam}">{svg}</svg>'


def bloque_logo(i, l):
    nombre, idea, fondo, svg, marca = l
    oscuro = fondo in ('#0e1b2c',)
    return f'''<div class="ficha">
  <div class="lienzo" style="background:{fondo}">
    <div class="logo">{icono(svg)}<div class="marca" style="{'flex-direction:row' if 'margin-left' in marca else ''}">{marca}</div></div>
  </div>
  <div class="pie-ficha"><b>{i}. {nombre}</b><span>{idea}</span><div class="mini" style="background:{fondo}">{icono(svg, '9mm')}</div></div>
</div>'''


fuentes = ('family=Poppins:wght@500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Fredoka:wght@600;700'
           '&family=Outfit:wght@700;800&family=Archivo+Black&family=Baloo+2:wght@700;800&family=Barlow:ital,wght@1,900;0,600'
           '&family=Sora:wght@600;700&family=Bebas+Neue&family=Space+Grotesk:wght@600;700&display=swap')

ventajas = [
    ('Único', 'No encontramos ninguna app, empresa ni marca llamada Goox (App Store de EE. UU., buscadores web y registros de marcas, 21 oct 2026).'),
    ('Dominio libre', 'gooxdriver.com está libre, y también gooxdriver.net, gooxdriver.us, gooxapp.com y getgoox.com, para campañas.'),
    ('Cuatro letras', 'Corto como las grandes marcas: se lee de un vistazo en un ícono, una gorra o una maleta de reparto.'),
    ('Suena a «go»', 'En inglés «go» es ir. Goox suena a movimiento, sirve igual para comida, motos, carros y envíos.'),
    ('Fácil de diseñar', 'La doble o se presta para ruedas, ojos o una ruta; la equis, para un cruce de caminos.'),
    ('Cero competencia en búsquedas', 'Hoy nadie compite por esa palabra en las tiendas ni en Google: cuando publiquemos, salimos primero.'),
    ('Funciona en todo el mundo', 'Se pronuncia casi igual en los idiomas más hablados y no tiene un significado malo en inglés ni en español.'),
    ('Marca registrable', 'Al ser una palabra inventada, es más fácil de registrar y de proteger que una palabra común como «Bite» o «Good».'),
]
tener_en_cuenta = [
    'goox.com, sin «driver», ya tiene dueño: por eso la marca va con «driver» como apellido en el dominio y en el nombre largo de las tiendas.',
    'En inglés «goo» es una sustancia pegajosa; en la marca casi nadie lo asocia, pero el diseño debe verse limpio y rápido, no blando.',
    'Suena un poco a Google: es bueno para recordarlo, y hay que cuidar que el logo no se parezca al de Google en colores ni en forma.',
    'Falta que un abogado de marcas lo confirme en la oficina de marcas de EE. UU. y revisar Google Play y los usuarios en redes.',
]

html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Goox Driver</title>
<link href="https://fonts.googleapis.com/css2?{fuentes}" rel="stylesheet">
<style>
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: Montserrat, sans-serif; color: #1f1f23; font-size: 9.6pt; line-height: 1.45; }}
.hoja {{ width: 297mm; height: 210mm; padding: 12mm 15mm; position: relative; page-break-after: always; overflow: hidden; background: #f7f7f3; }}
.hoja:last-child {{ page-break-after: auto; }}
h1, h2, h3 {{ font-family: Poppins, sans-serif; color: #111; }}
h2 {{ font-size: 21pt; font-weight: 800; margin-bottom: 2mm; letter-spacing: -.3px; }}
h3 {{ font-size: 11pt; font-weight: 700; margin-bottom: 1.5mm; }}
.sub {{ color: #55555c; font-size: 10.5pt; max-width: 235mm; margin-bottom: 6mm; }}
.etq {{ font-family: Poppins; font-size: 8pt; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: #5a8a00; margin-bottom: 2mm; }}
.pie {{ position: absolute; left: 15mm; right: 15mm; bottom: 6mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #6b6b6b; }}
.portada {{ background: #111; color: #fff; display: grid; grid-template-columns: 1.1fr 1fr; gap: 12mm; align-items: center; }}
.portada .gigante {{ font-family: Poppins; font-weight: 800; font-size: 96pt; line-height: .9; letter-spacing: -3px; color: #fff; }}
.portada .gigante span {{ display: block; font-size: 18pt; letter-spacing: 8px; color: #c6f432; font-weight: 600; margin-top: 3mm; }}
.portada p {{ color: #cfcfd4; font-size: 11pt; max-width: 135mm; }}
.dom {{ margin-top: 7mm; display: inline-flex; align-items: baseline; gap: 3mm; background: #fff; color: #111; border-radius: 12px; padding: 3mm 5mm; }}
.dom b {{ font-family: Poppins; font-size: 18pt; }}
.dom em {{ font-style: normal; color: #0f8a4a; font-weight: 800; font-size: 9pt; }}
.captura {{ width: 100%; border-radius: 14px; border: 1px solid #333; }}
.rejilla {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 4mm; }}
.ficha {{ border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }}
.lienzo {{ height: 34mm; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #e2e2e2; }}
.logo {{ display: flex; align-items: center; gap: 2.5mm; }}
.lienzo .logo {{ transform: scale(.74); }}
.marca {{ display: flex; flex-direction: column; }}
.pie-ficha {{ padding: 2.5mm 3mm; font-size: 7.8pt; position: relative; min-height: 26mm; }}
.pie-ficha b {{ display: block; font-family: Poppins; font-size: 8.8pt; margin-bottom: .6mm; padding-right: 11mm; }}
.pie-ficha span {{ display: block; color: #55555c; padding-right: 11mm; }}
.mini {{ position: absolute; right: 2.5mm; top: 2.5mm; width: 10mm; height: 10mm; border-radius: 2.6mm; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; }}
.col2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }}
.col4 {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }}
.caja {{ border: 1px solid #2a2a2a; border-radius: 12px; padding: 4.5mm 5mm; background: #fff; }}
.caja h3 {{ color: #111; }}
.caja p {{ font-size: 8.8pt; color: #3d3d44; }}
ul.lista {{ list-style: none; }}
ul.lista li {{ padding: 1.6mm 0 1.6mm 5mm; position: relative; border-bottom: 1px solid #ececec; }}
ul.lista li::before {{ content: "!"; position: absolute; left: .8mm; color: #c47a00; font-weight: 800; }}
table {{ width: 100%; border-collapse: collapse; font-size: 9pt; background: #fff; }}
th {{ text-align: left; font-family: Poppins; font-weight: 600; font-size: 8pt; color: #6b6b6b; border-bottom: 1.5px solid #111; padding: 2mm; }}
td {{ padding: 2.1mm 2mm; border-bottom: 1px solid #ececec; }}
td.dice {{ font-family: Poppins; font-weight: 700; font-size: 11pt; white-space: nowrap; }}
.check {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-top: 5mm; }}
.check div {{ background: #fff; border: 1px solid #2a2a2a; border-radius: 10px; padding: 3mm 4mm; font-size: 8.6pt; }}
.check b {{ display: block; font-family: Poppins; color: #0f8a4a; font-size: 9.5pt; }}
</style></head><body>

<section class="hoja portada">
  <div>
    <div class="etq" style="color:#c6f432">Propuesta de marca · 21 de octubre de 2026</div>
    <div class="gigante">Goox<span>DRIVER</span></div>
    <p style="margin-top:8mm">Una sola app para comida, motos, carros y envíos. El primer nombre, <b>Goox</b>, es la marca que la gente va a decir. «driver» va pequeño, como apellido: nos diferencia en Google y en las tiendas de apps y nos da el dominio.</p>
    <div class="dom"><b>gooxdriver.com</b><em>DISPONIBLE</em></div>
    <div class="dom" style="margin-left:3mm"><b>App Store</b><em>NINGUNA APP LLAMADA GOOX</em></div>
  </div>
  <div><img class="captura" src="img-goox/dominio-libre.webp" alt="Búsqueda del dominio gooxdriver.com: disponible">
    <p style="margin-top:2mm;font-size:8pt;color:#9a9aa2">Búsqueda del dominio en YaDominios, 21 oct 2026: gooxdriver.com, .net, .org, .co, .io, .me y .us disponibles.</p></div>
  <div class="pie" style="color:#8a8a92"><span>Goox Driver · propuesta de marca</span><span>1</span></div>
</section>

<section class="hoja">
  <div class="etq">Revisión</div>
  <h2>Goox está libre: lo que revisamos</h2>
  <p class="sub">Antes de enamorarse de un nombre hay que saber si alguien ya lo usa. Esto es lo que encontramos el 21 de octubre de 2026.</p>
  <div class="check">
    <div><b>Dominio libre</b>gooxdriver.com, gooxdriver.net y gooxdriver.us, comprobados en el registro oficial de cada dominio.</div>
    <div style="border-color:#0f8a4a;border-width:2px"><b>Libre en toda la App Store</b>No existe ninguna app llamada Goox. Al escribir «goox» en la App Store, la tienda solo sugiere otras palabras (goodreads, goodnotes, goodwill…), y el buscador oficial de Apple no devuelve ninguna app ni ningún desarrollador con ese nombre (21 oct 2026).</div>
    <div><b>Sin empresas ni marcas</b>Ninguna empresa ni marca registrada llamada Goox en buscadores y registros públicos de marcas. Lo más cercano es GOOVOX, de maquinaria.</div>
    <div><b>Variantes para campañas</b>gooxapp.com y getgoox.com también están libres.</div>
    <div><b>Sin pegas en inglés ni en español</b>No es una grosería ni tiene un significado malo en los dos idiomas principales.</div>
    <div><b>Se busca solo</b>Es una palabra inventada: quien la busque en Google, nos encuentra a nosotros.</div>
  </div>
  <div class="caja" style="margin-top:6mm"><h3>Lo que falta antes de comprarlo</h3>
    <p>Que un abogado de marcas lo confirme en la oficina de marcas de EE. UU. (clases de software, transporte, publicidad y restaurantes) y en Colombia; revisar Google Play; asegurar los usuarios en Instagram, TikTok, Facebook y X; y comprar los dominios el mismo día.</p></div>
  <div class="pie"><span>Goox Driver · propuesta de marca</span><span>2</span></div>
</section>

<section class="hoja">
  <div class="etq">Diez logos</div>
  <h2>Diez caminos para el logo</h2>
  <p class="sub">Todos siguen la misma regla: <b>Goox</b> grande y <b>driver</b> pequeño, como apellido. Cada uno trae su ícono de app al lado. Son propuestas para que el equipo de marketing elija un camino y lo termine.</p>
  <div class="rejilla">{''.join(bloque_logo(i + 1, l) for i, l in enumerate(L))}</div>
  <div class="pie"><span>Logos de propuesta, diseñados para este documento · sin degradados, listos para una sola tinta</span><span>3</span></div>
</section>

<section class="hoja">
  <div class="etq">Ventajas</div>
  <h2>Por qué Goox Driver</h2>
  <p class="sub">Lo que el nombre le da a la empresa desde el primer día.</p>
  <div class="col4">{''.join(f'<div class="caja"><h3>{t}</h3><p>{d}</p></div>' for t, d in ventajas)}</div>
  <div class="caja" style="margin-top:6mm"><h3>A tener en cuenta</h3><ul class="lista">{''.join(f'<li>{x}</li>' for x in tener_en_cuenta)}</ul></div>
  <div class="pie"><span>Goox Driver · propuesta de marca</span><span>4</span></div>
</section>

<section class="hoja">
  <div class="etq">Pronunciación</div>
  <h2>Cómo se dice Goox en los idiomas más hablados</h2>
  <p class="sub">La marca se dice <b>«gúks»</b>: una sola sílaba, con u larga, como la «oo» de Google. Así se adapta en cada idioma (aproximado).</p>
  <table><tr><th>Idioma</th><th>Se dice</th><th>Nota</th></tr>
  {''.join(f'<tr><td><b>{a}</b></td><td class="dice">{b}</td><td>{c}</td></tr>' for a, b, c in IDIOMAS)}</table>
  <p style="margin-top:4mm;font-size:8.6pt;color:#55555c">«driver» se dice <b>«dráiver»</b> en todos los idiomas: es una palabra del inglés que el mundo ya conoce.</p>
  <div class="pie"><span>Goox Driver · propuesta de marca</span><span>5</span></div>
</section>

<section class="hoja">
  <div class="etq">Cómo se usa</div>
  <h2>El nombre en la vida real</h2>
  <div class="col2">
    <div class="caja"><h3>Cómo se escribe</h3><table>
      <tr><td>La marca (ícono, publicidad, conversación)</td><td><b>Goox</b></td></tr>
      <tr><td>Logo completo</td><td><b>Goox</b> con <b>driver</b> pequeño</td></tr>
      <tr><td>Dominio</td><td><b>gooxdriver.com</b></td></tr>
      <tr><td>Nombre largo en las tiendas</td><td><b>Goox Driver: Food, Rides & Delivery</b></td></tr>
      <tr><td>Apps</td><td><b>Goox</b> (cliente), <b>Goox Driver</b> (repartidor), <b>Goox for Restaurants</b></td></tr>
      <tr><td>Redes</td><td><b>@gooxdriver</b></td></tr></table></div>
    <div class="caja"><h3>Cómo lo dice la gente</h3>
      <p>«Pídelo por Goox». «Llegó el Goox». «¿Vas en Goox?». Cuatro letras que se vuelven verbo, como pasó con las grandes.</p>
      <h3 style="margin-top:5mm">Siguientes pasos</h3>
      <p>1. El equipo elige uno de los diez caminos de logo. 2. Abogado de marcas. 3. Comprar los dominios y los usuarios en redes el mismo día. 4. Abrir las cuentas de Apple y Google Play con el nombre definitivo. 5. Cambiar la marca en las apps, la web y Docs, pasando por el sitio de pruebas.</p></div>
  </div>
  <div class="pie"><span>© 2026 Windoce LLC</span><span>6</span></div>
</section>
</body></html>'''

open(os.path.join(AQUI, 'goox-driver.html'), 'w').write(html)
print('listo')

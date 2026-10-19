"""Arma la propuesta de franquicia de Tumbite Bogotá (HTML para PDF horizontal) con los números del modelo.
Uso: python3 docs/pdf/modelo-franquicia-bogota.py && python3 docs/pdf/franquicia-bogota.py
Luego: node docs/pdf/a-pdf.mjs docs/pdf/franquicia-bogota.html docs/Propuesta-franquicia-Tumbite-Bogota.pdf
"""
import json, os

AQUI = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(AQUI, 'modelo-franquicia-bogota.json')))
TRM = 3170.46
M = 1_000_000


def usd(cop, dec=0):
    v = cop / TRM
    return f"{v:,.{dec}f}".replace(',', '.') + ' USD' if dec == 0 else f"{v:,.{dec}f}"


def musd(cop):
    return f"{cop / TRM / 1e6:.2f}".replace('.', ',') + ' millones de USD'


def cop(v):
    return f"{v / M:,.0f}".replace(',', '.') + ' M COP'


def n(v):
    return f"{v:,.0f}".replace(',', '.')


CAP = 'img-franquicia/'
base = d['res']['base']
cons = d['res']['conservador']
opti = d['res']['optimista']
total_inv = d['total_inv']
lanz = d['total_lanz']


def telefono(nombre, pie):
    return f'<figure class="tel"><img src="{CAP}{nombre}.jpg" alt="{pie}"><figcaption>{pie}</figcaption></figure>'


filas_capital = ''.join(
    f'<tr><td>{k}</td><td class="num">{cop(v)}</td><td class="num">{usd(v)}</td></tr>' for k, v in d['capital'].items()
)


def fila_anios(nombre, r):
    celdas = ''.join(f'<td class="num">{usd(a["franq"])}</td>' for a in r['anios'])
    pago = f"mes {r['payback']}" if r['payback'] else 'después del mes 48'
    return f'<tr><td><b>{nombre}</b></td>{celdas}<td class="num">{pago}</td></tr>'


def fila_tumbite(nombre, r):
    return f'<tr><td><b>{nombre}</b></td>' + ''.join(f'<td class="num">{usd(a["tumbite"])}</td>' for a in r['anios']) + '<td></td></tr>'


def fila_pedidos(nombre, r):
    return f'<tr><td><b>{nombre}</b></td>' + ''.join(f'<td class="num">{n(a["pedidos"])}</td>' for a in r['anios']) + '<td></td></tr>'


# Gráfico: caja acumulada del franquiciado (escenario base), 48 meses, en USD.
serie = [v / TRM for v in base['acum']]
lo, hi = min(serie), max(serie)
W, H, PADL, PADB = 470, 250, 46, 24
def x(i): return PADL + i * (W - PADL - 10) / (len(serie) - 1)
def y(v): return 10 + (hi - v) * (H - PADB - 10) / (hi - lo)
puntos = ' '.join(f'{x(i):.1f},{y(v):.1f}' for i, v in enumerate(serie))
y0 = y(0)
marcas = ''
for val in range(int(lo // 1e6) * 1_000_000, int(hi) + 1, 1_000_000):
    marcas += f'<line x1="{PADL}" x2="{W-10}" y1="{y(val):.1f}" y2="{y(val):.1f}" stroke="#e6e6e6"/><text x="{PADL-8}" y="{y(val)+4:.1f}" text-anchor="end" font-size="11" fill="#6b6b6b">{val/1e6:+.0f} M</text>'
for mes in (12, 24, 36, 48):
    marcas += f'<text x="{x(mes-1):.1f}" y="{H-8}" text-anchor="{'end' if mes == 48 else 'middle'}" font-size="11" fill="#6b6b6b">mes {mes}</text>'
pb = base['payback']
grafico = f'''<svg viewBox="0 0 {W} {H}" width="100%">{marcas}
<line x1="{PADL}" x2="{W-10}" y1="{y0:.1f}" y2="{y0:.1f}" stroke="#191919" stroke-width="1"/>
<polyline points="{puntos}" fill="none" stroke="#ff3008" stroke-width="2.5"/>
<circle cx="{x(pb-1):.1f}" cy="{y0:.1f}" r="5" fill="#0f8a4a"/>
<text x="{x(pb-1)-6:.1f}" y="{y0-10:.1f}" text-anchor="end" font-size="12" fill="#0f8a4a" font-weight="700">capital recuperado, mes {pb}</text></svg>'''

html = f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Tumbite Bogotá · Propuesta de franquicia</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
:root {{ --rojo:#ff3008; --gris:#191919; --texto:#2b2b2b; --suave:#6b6b6b; --borde:#2a2a2a; --linea:#dcdcdc; --fondo:#f6f5f3; --verde:#0f8a4a; }}
body {{ font-family: Montserrat, sans-serif; color: var(--texto); font-size: 9.6pt; line-height: 1.42; }}
.hoja {{ width: 297mm; height: 210mm; padding: 11mm 14mm 13mm; position: relative; page-break-after: always; overflow: hidden; background: #fff; }}
.hoja:last-child {{ page-break-after: auto; }}
h1, h2, h3, .p {{ font-family: Poppins, sans-serif; color: var(--gris); }}
h2 {{ font-size: 19pt; font-weight: 800; letter-spacing: -0.3px; margin-bottom: 2mm; }}
h3 {{ font-size: 11.5pt; font-weight: 700; margin-bottom: 1.5mm; }}
.sub {{ color: var(--suave); font-size: 10.5pt; margin-bottom: 6mm; max-width: 230mm; }}
.etq {{ font-family: Poppins; font-size: 8pt; font-weight: 700; color: var(--rojo); letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 1.5mm; }}
.pie {{ position: absolute; left: 14mm; right: 14mm; bottom: 6mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: var(--suave); }}
.pie a {{ color: var(--suave); text-decoration: none; }}
.col2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }}
.col3 {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; }}
.col4 {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; }}
.tarjeta {{ border: 1px solid var(--borde); border-radius: 10px; padding: 4.5mm 5mm; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.06); }}
.cifra {{ font-family: Poppins; font-size: 21pt; font-weight: 800; color: var(--gris); line-height: 1.1; }}
.cifra.verde {{ color: var(--verde); }}
.cifra.roja {{ color: var(--rojo); }}
.chico {{ font-size: 8.2pt; color: var(--suave); }}
ul.lista {{ list-style: none; }}
ul.lista li {{ padding: 1.2mm 0 1.2mm 4.5mm; position: relative; border-bottom: 1px solid #efefef; }}
ul.lista li::before {{ content: ""; position: absolute; left: 0; top: 2.9mm; width: 1.8mm; height: 1.8mm; border-radius: 50%; background: var(--rojo); }}
table {{ width: 100%; border-collapse: collapse; font-size: 8.8pt; }}
th {{ text-align: left; font-family: Poppins; font-weight: 600; font-size: 8pt; color: var(--suave); border-bottom: 1.5px solid var(--gris); padding: 1.6mm 2mm; }}
td {{ padding: 1.5mm 2mm; border-bottom: 1px solid #ececec; vertical-align: top; }}
td.num, th.num {{ text-align: right; white-space: nowrap; }}
tr.total td {{ font-weight: 700; color: var(--gris); border-top: 1.5px solid var(--gris); border-bottom: none; }}
.tels {{ display: flex; gap: 5mm; justify-content: space-between; }}
.tel {{ flex: 1; text-align: center; }}
.tel img {{ width: 100%; max-height: 118mm; object-fit: contain; object-position: top; border: 1px solid var(--borde); border-radius: 14px; }}
.tel figcaption {{ font-size: 8pt; color: var(--suave); margin-top: 1.5mm; }}
.panel img {{ width: 100%; border: 1px solid var(--borde); border-radius: 8px; }}
.nota {{ font-size: 8pt; color: var(--suave); margin-top: 3mm; }}
.portada {{ background: var(--gris); color: #fff; display: grid; grid-template-columns: 1.15fr 1fr; gap: 10mm; padding: 12mm 16mm; }}
.portada h1 {{ color: #fff; font-size: 34pt; font-weight: 800; line-height: 1.05; letter-spacing: -0.8px; }}
.portada .rojo {{ color: var(--rojo); }}
.portada p {{ color: #d6d6d6; font-size: 11pt; }}
.portada .datos {{ margin-top: 10mm; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }}
.portada .dato {{ border: 1px solid #3a3a3a; border-radius: 10px; padding: 4mm; }}
.portada .dato b {{ display: block; font-family: Poppins; font-size: 17pt; color: #fff; }}
.portada .dato span {{ font-size: 8.5pt; color: #bdbdbd; }}
.fase {{ border-left: 1px solid var(--linea); padding-left: 4mm; }}
.fase b.p {{ font-size: 10pt; }}
.paso {{ display: inline-block; font-family: Poppins; font-weight: 700; font-size: 8pt; color: #fff; background: var(--gris); border-radius: 20px; padding: .6mm 2.5mm; margin-bottom: 1.5mm; }}
.verde-t {{ color: var(--verde); font-weight: 700; }}
.barra {{ height: 7mm; border-radius: 5px; display: flex; overflow: hidden; border: 1px solid var(--borde); margin: 2mm 0 1mm; font-family: Poppins; font-size: 8.5pt; font-weight: 700; color: #fff; }}
.barra div {{ display: flex; align-items: center; justify-content: center; }}
</style></head><body>

<section class="hoja portada">
  <div>
    <img src="../../apps/panel/public/marca/logo.webp" style="height:16mm;background:#fff;border-radius:8px;padding:2mm 3mm" alt="Tumbite">
    <div style="margin-top:6mm;display:inline-block;border:1px solid #ff3008;color:#ff3008;border-radius:6px;padding:1.5mm 3mm;font-family:Poppins;font-weight:700;font-size:8.5pt">BORRADOR PARA REVISIÓN DE RICHARD · CIFRAS PROPUESTAS, NO DEFINITIVAS</div>
    <div style="margin-top:6mm" class="etq">Propuesta de franquicia · Colombia</div>
    <h1>Tumbite <span class="rojo">Bogotá</span>:<br>la franquicia de toda la ciudad</h1>
    <p style="margin-top:6mm;max-width:130mm">Una app de domicilios completa, ya construida y funcionando, para lanzarla en Bogotá con un socio local. Este documento explica cuánto cuesta, cómo se lanza, cómo te apoyamos, cuánto deja y cómo se recupera el capital.</p>
    <div class="datos">
      <div class="dato"><b>{musd(total_inv)}</b><span>inversión total: franquicia y lanzamiento de 6 meses</span></div>
      <div class="dato"><b>mes {base['payback']}</b><span>capital recuperado en el escenario base</span></div>
      <div class="dato"><b>75 % / 25 %</b><span>del margen de cada pedido: franquiciado / Tumbite</span></div>
      <div class="dato"><b>10 años</b><span>exclusividad en toda Bogotá, renovables</span></div>
    </div>
    <p style="margin-top:6mm;font-size:8pt;color:#9a9a9a">Preparado por Windoce LLC para el Dr. Niño y sus socios · 18 de octubre de 2026 · Cifras en dólares a la tasa del 16 de octubre de 2026: 3.170,46 pesos por dólar.</p>
  </div>
  <div style="display:flex;gap:4mm;align-items:flex-end">
    <img src="{CAP}cliente-inicio-es.jpg" style="width:50%;border-radius:14px;border:1px solid #3a3a3a" alt="Inicio de la app del cliente">
    <img src="{CAP}cliente-en-camino-es.jpg" style="width:50%;border-radius:14px;border:1px solid #3a3a3a;margin-bottom:14mm" alt="Pedido en camino">
  </div>
</section>

<section class="hoja">
  <div class="etq">Resumen</div>
  <h2>La propuesta en una página</h2>
  <p class="sub">Bogotá mueve millones de domicilios al mes y la comisión que cobran las apps a los restaurantes ronda el 27 %. Tumbite entra cobrando cerca de la mitad, con una app que ya funciona de punta a punta y un socio local que conoce la ciudad.</p>
  <div class="col4" style="margin-bottom:6mm">
    <div class="tarjeta"><div class="chico">Cuota de franquicia (una vez)</div><div class="cifra">120.000 USD</div><div class="chico">toda Bogotá, con exclusividad</div></div>
    <div class="tarjeta"><div class="chico">Capital del lanzamiento (6 meses)</div><div class="cifra">{musd(lanz).replace(' millones de USD',' M USD')}</div><div class="chico">{cop(lanz)}, con 10 % de reserva</div></div>
    <div class="tarjeta"><div class="chico">Utilidad del franquiciado, año 3 (base)</div><div class="cifra verde">{usd(base['anios'][2]['franq'])}</div><div class="chico">después de equipo y publicidad</div></div>
    <div class="tarjeta"><div class="chico">Capital recuperado (base)</div><div class="cifra verde">mes {base['payback']}</div><div class="chico">conservador: mes {cons['payback']} · optimista: mes {opti['payback']}</div></div>
  </div>
  <div class="col3">
    <div class="tarjeta"><h3>Qué compras</h3><ul class="lista">
      <li>La marca Tumbite y la exclusividad de toda Bogotá por 10 años.</li>
      <li>Tres apps listas (cliente, restaurante, repartidor) y los paneles web.</li>
      <li>El plan de lanzamiento en frío y el acompañamiento de nuestro equipo.</li>
      <li>Las actualizaciones de la tecnología, sin costo extra.</li></ul></div>
    <div class="tarjeta"><h3>Qué pone el socio local</h3><ul class="lista">
      <li>La empresa en Colombia (S.A.S.) y su cuenta con la pasarela de pagos.</li>
      <li>El capital del lanzamiento y el equipo de la ciudad.</li>
      <li>La afiliación de restaurantes y repartidores, y la atención local.</li>
      <li>El cumplimiento de las normas colombianas.</li></ul></div>
    <div class="tarjeta"><h3>Cómo se reparte</h3>
      <div class="barra"><div style="width:75%;background:#191919">75 % franquiciado</div><div style="width:25%;background:#ff3008">25 %</div></div>
      <p class="chico">De lo que deja cada pedido (comisión del restaurante y tarifa de servicio, menos la pasarela de pagos, los aportes del repartidor y el soporte), el 75 % es del franquiciado y el 25 % de Tumbite. El envío y la propina son del repartidor, completos.</p></div>
  </div>
  <div class="pie"><span>Tumbite Bogotá · Propuesta de franquicia</span><span>Las proyecciones no son promesas: dependen de la ejecución y del mercado.</span></div>
</section>

<section class="hoja">
  <div class="etq">El mercado</div>
  <h2>Bogotá pide a domicilio, y paga caro por hacerlo</h2>
  <p class="sub">Todos los datos salen de fuentes públicas (la lista está al final). Donde no hay cifra pública, se dice que es una estimación nuestra.</p>
  <div class="col4" style="margin-bottom:6mm">
    <div class="tarjeta"><div class="cifra">9 millones</div><div class="chico">de órdenes al mes de Rappi en Colombia (mayo 2026), con más de 19.000 restaurantes</div></div>
    <div class="tarjeta"><div class="cifra">25 % + 2 %</div><div class="chico">comisión que Rappi publica para restaurantes en Colombia, más IVA; en la práctica 27 a 32 %</div></div>
    <div class="tarjeta"><div class="cifra verde">+18,1 %</div><div class="chico">crecieron los domicilios de restaurantes en el primer semestre de 2026, más que el canal total</div></div>
    <div class="tarjeta"><div class="cifra">64 % / 18 %</div><div class="chico">usuarios activos de Rappi y de DiDi Food: un mercado de dos, con espacio para un tercero</div></div>
  </div>
  <div class="col2">
    <div class="tarjeta"><h3>Lo que dicen los números</h3><ul class="lista">
      <li>Estimamos que Bogotá mueve entre 4 y 5 millones de domicilios al mes, con un ticket medio de 30.000 a 40.000 pesos.</li>
      <li>DiDi Food llegó con descuentos fuertes y en cinco años suma 15.000 restaurantes y 9 millones de usuarios: entrar es posible.</li>
      <li>Uber Eats (2020) e iFood (2022) salieron del país: el error fue competir solo con dinero y sin socio local.</li>
      <li>El efectivo sigue pesando: bajó al 65 % del valor de las compras habituales en 2026. Tumbite ya acepta pago en efectivo y transferencia al repartidor.</li></ul></div>
    <div class="tarjeta"><h3>Por qué Tumbite gana restaurantes</h3>
      <table><tr><th>Concepto</th><th class="num">Rappi</th><th class="num">Tumbite</th></tr>
      <tr><td>Comisión al restaurante</td><td class="num">25 % + 2 %</td><td class="num"><b>15 %</b></td></tr>
      <tr><td>Primeros 3 meses de los primeros restaurantes</td><td class="num">comisión normal</td><td class="num"><b>0 %</b></td></tr>
      <tr><td>Tablet para recibir pedidos</td><td class="num">la pone el local</td><td class="num"><b>incluida</b></td></tr>
      <tr><td>Menú y fotos cargados por nosotros</td><td class="num">no</td><td class="num"><b>sí</b></td></tr>
      <tr><td>Restaurante con 100.000.000 COP al mes en apps</td><td class="num">≈ 73 M le quedan</td><td class="num"><b>≈ 85 M le quedan</b></td></tr></table>
      <p class="nota">Ejemplo calculado con las comisiones publicadas, sin IVA. La comisión exacta por plan la decide la franquicia con Tumbite.</p></div>
  </div>
  <div class="pie"><span>Fuentes: Prensa Mercosur, Semana, El Tiempo, Sensor Tower, Valora Analitik, Rappi Merchants, Infobae (lista completa al final)</span><span>2</span></div>
</section>

<section class="hoja">
  <div class="etq">El producto, ya construido</div>
  <h2>La app del cliente: capturas reales, no maquetas</h2>
  <p class="sub">Estas pantallas son de la app que ya funciona hoy (versión de Miami, por eso los precios salen en dólares). Para Bogotá se configuran la moneda, las zonas y los métodos de pago.</p>
  <div class="tels">
    {telefono('cliente-inicio-es', 'Inicio con servicios y restaurantes')}
    {telefono('cliente-menu-es', 'Menú del restaurante')}
    {telefono('cliente-pago-al-recibir-es', 'Carrito: tarjeta o efectivo al recibir')}
    {telefono('cliente-en-camino-es', 'Pedido en vivo en el mapa')}
    {telefono('cliente-sellado-es', 'Pedido sellado con foto')}
  </div>
  <div class="pie"><span>Capturas originales del recorrido automático de la app (18 oct 2026)</span><span>3</span></div>
</section>

<section class="hoja">
  <div class="etq">El producto, ya construido</div>
  <h2>Repartidores y restaurantes, con su propia app</h2>
  <p class="sub">El repartidor ve cuánto gana antes de aceptar y lleva su saldo; el restaurante recibe el pedido con alarma y ve su dinero del día. Todo en español y en inglés.</p>
  <div class="tels">
    {telefono('repartidor-oferta-es', 'Oferta con el pago antes de aceptar')}
    {telefono('repartidor-ganancias-es', 'Ganancias del día con desglose')}
    {telefono('repartidor-prepago-es', 'Saldo para pedidos en efectivo')}
    {telefono('restapp-nuevo-es', 'Pedido nuevo en la app del restaurante')}
  </div>
  <div class="pie"><span>Capturas originales del recorrido automático de la app (18 oct 2026)</span><span>4</span></div>
</section>

<section class="hoja">
  <div class="etq">El producto, ya construido</div>
  <h2>El panel del restaurante y el de la franquicia</h2>
  <p class="sub">El restaurante maneja su menú, sus pedidos, sus reseñas y su dinero desde la computadora. La franquicia tiene su propio panel con los números de su territorio, y nuestro equipo vigila cada pedido.</p>
  <div class="col2">
    <div class="panel"><img src="{CAP}restaurante-pedido-nuevo-es.jpg" alt="Pedido nuevo en el panel del restaurante"><p class="chico" style="margin-top:1.5mm">Pedido nuevo en el panel del restaurante, con el tiempo para aceptar.</p></div>
    <div class="panel"><img src="{CAP}restaurante-beneficios-es.jpg" alt="Beneficios del restaurante comparados con otras apps"><p class="chico" style="margin-top:1.5mm">Lo que le queda al restaurante, comparado con otras apps.</p></div>
  </div>
  <div class="pie"><span>Capturas originales del recorrido automático de la app (18 oct 2026)</span><span>5</span></div>
</section>

<section class="hoja">
  <div class="etq">Lo que aprendimos de Yango</div>
  <h2>Cómo entró Yango a Bogotá, y qué tomamos</h2>
  <p class="sub">Yango (del grupo Yandex) llegó a Bogotá en febrero de 2025 después de 16 meses en otras cinco ciudades. Anunció 300 millones de dólares a cuatro años y gastó unos 600.000 dólares por semana en publicidad, sobre todo en TikTok. No hace comida a domicilio en Colombia todavía.</p>
  <div class="col2">
    <div class="tarjeta"><h3>Lo que hicieron</h3><ul class="lista">
      <li>Entraron con la oferta ya armada: se aliaron con Taxis Libres y tuvieron más de 25.000 taxis desde el primer día.</li>
      <li>Dos campañas separadas: 80 % de descuento en el primer viaje para el usuario, y cuatro meses sin comisión más bonos diarios para el conductor.</li>
      <li>Gasto digital constante, creadores con código propio y el gerente país en todos los medios económicos.</li>
      <li>Un precio fácil de comprobar: «15 % más barato», sin tarifa dinámica.</li>
      <li>Alianzas donde el comercio paga parte del descuento (centro comercial Nuestro Bogotá).</li>
      <li>Un informe público de seguridad con cifras.</li></ul></div>
    <div class="tarjeta"><h3>Lo que hace Tumbite en Bogotá</h3><ul class="lista">
      <li><b>Oferta antes del día uno:</b> 300 restaurantes con menú cargado y 800 repartidores aprobados antes de abrir; alianza con una cadena o una asociación de domiciliarios.</li>
      <li><b>Repartidor:</b> garantía de ingresos las primeras tres semanas y su kit (chaqueta y maleta) sin costo.</li>
      <li><b>Cliente:</b> primer pedido con descuento grande y referidos que ganan los dos.</li>
      <li><b>Restaurante:</b> 0 % de comisión tres meses y después la mitad de lo que cobra la competencia.</li>
      <li><b>Precio claro:</b> tarifas publicadas y comparador en la web.</li>
      <li><b>Sin quemar dinero:</b> abrimos por zonas y el capital se libera por metas, no de golpe.</li></ul></div>
  </div>
  <p class="nota">Fuentes: El Colombiano (10 oct 2024), Publimetro (5 feb y 6 mar 2025), Autocosmos (27 feb 2025), ENTER.CO (21 abr 2026), Portafolio (18 oct 2026). Investigación con fuentes públicas solamente.</p>
  <div class="pie"><span>Tumbite Bogotá · Propuesta de franquicia</span><span>6</span></div>
</section>

<section class="hoja">
  <div class="etq">Lanzamiento en frío</div>
  <h2>De cero a toda Bogotá en nueve meses</h2>
  <p class="sub">Una app de domicilios necesita tres cosas a la vez: restaurantes, repartidores y clientes. Por eso se abre por zonas, y cada zona abre solo cuando tiene oferta suficiente.</p>
  <div class="col4">
    <div class="fase"><span class="paso">Meses 1 a 3</span><br><b class="p">Antes de abrir</b><ul class="lista" style="margin-top:2mm">
      <li>Empresa, pasarela de pagos y oficina.</li><li>Gerente de ciudad y equipo de 9 personas, entrenados con nuestras guías.</li>
      <li>300 restaurantes firmados, con menú y fotos cargados y su tablet.</li><li>800 repartidores aprobados y uniformados.</li><li>Lista de espera de clientes y alianzas.</li></ul></div>
    <div class="fase"><span class="paso">Mes 4</span><br><b class="p">Apertura por zonas</b><ul class="lista" style="margin-top:2mm">
      <li>Chapinero, Usaquén, Teusaquillo y Cedritos primero: alta densidad y ticket alto.</li><li>Vallas en la 7.ª, la Autonorte y la 26; estaciones de TransMilenio.</li>
      <li>Campaña de primer pedido y creadores de Bogotá.</li><li>Brigadas en universidades y centros comerciales.</li></ul></div>
    <div class="fase"><span class="paso">Meses 5 y 6</span><br><b class="p">Expansión</b><ul class="lista" style="margin-top:2mm">
      <li>Suba, Engativá, Fontibón y Salitre.</li><li>Radio y Citytv en el horario de la cena.</li><li>Referidos y alianzas con cadenas.</li><li>Meta: 1.000 restaurantes y 1.500 repartidores.</li></ul></div>
    <div class="fase"><span class="paso">Meses 7 a 9</span><br><b class="p">Toda la ciudad</b><ul class="lista" style="margin-top:2mm">
      <li>Kennedy, Bosa, Américas y el sur.</li><li>La publicidad pasa a un gasto mensual estable.</li><li>Se activan más servicios de la app (mercado, farmacia) cuando la ciudad lo pida.</li><li>Meta: 2 % de los domicilios de Bogotá al cerrar el año.</li></ul></div>
  </div>
  <div class="tarjeta" style="margin-top:6mm"><h3>Compuertas: el capital sale por metas</h3>
    <p>El dinero del lanzamiento no se gasta de golpe. Se libera en tres partes: <b>40 %</b> para la preparación (meses 1 a 3), <b>35 %</b> al abrir, si hay 300 restaurantes y 800 repartidores listos, y <b>25 %</b> en el mes 6, si se cumplen las metas de pedidos de la primera zona. Si una meta no se cumple, se corrige antes de gastar más.</p></div>
  <div class="pie"><span>Tumbite Bogotá · Propuesta de franquicia</span><span>7</span></div>
</section>

<section class="hoja">
  <div class="etq">Cómo te apoyamos</div>
  <h2>Lo que hace Tumbite y lo que hace el socio local</h2>
  <p class="sub">La franquicia no es solo una marca: es una operación completa con la tecnología, el método y el acompañamiento de nuestro equipo.</p>
  <div class="col2">
    <div class="tarjeta"><h3>Tumbite pone</h3><ul class="lista">
      <li>Las tres apps (cliente, restaurante, repartidor) en las tiendas, y los paneles web, con sus servidores y su mantenimiento.</li>
      <li>El panel de la franquicia: pedidos, ventas, restaurantes, repartidores e incidencias de Bogotá.</li>
      <li>La vigilancia de cada pedido, los avisos automáticos y el soporte técnico.</li>
      <li>El manual del lanzamiento en frío y las guías de capacitación por puesto, en español.</li>
      <li>La campaña creativa: piezas de vallas, redes, radio y uniformes con la marca.</li>
      <li>Dos semanas de acompañamiento presencial en la apertura y una reunión semanal de números.</li>
      <li>La conexión técnica con la pasarela de pagos de Colombia que contrate la franquicia.</li>
      <li>Las mejoras de la app para todas las ciudades, sin costo extra.</li></ul></div>
    <div class="tarjeta"><h3>El socio local pone</h3><ul class="lista">
      <li>La S.A.S. en Colombia, su RUT, su cuenta bancaria y el contrato con la pasarela (Wompi u otra).</li>
      <li>El capital del lanzamiento y del primer año.</li>
      <li>El equipo de la ciudad: gerente, comerciales, soporte, flota y redes.</li>
      <li>La firma de restaurantes y el reclutamiento de repartidores.</li>
      <li>La compra de la publicidad en Bogotá, con las piezas que le entregamos.</li>
      <li>Los aportes de seguridad social de los repartidores que exige la Ley 2466 de 2025.</li>
      <li>Contador y abogado locales, y la atención a las autoridades.</li></ul></div>
  </div>
  <div class="pie"><span>Tumbite Bogotá · Propuesta de franquicia</span><span>8</span></div>
</section>

<section class="hoja">
  <div class="etq">La inversión</div>
  <h2>Lo que cuesta lanzar en toda Bogotá, sin exagerar</h2>
  <p class="sub">Cotizamos un lanzamiento con vallas, TransMilenio, radio, televisión local, redes y calle. Es el necesario para que toda Bogotá conozca Tumbite, no el máximo posible.</p>
  <div class="col2" style="grid-template-columns:1.45fr 1fr">
    <div><table><tr><th>Rubro (primeros 6 meses)</th><th class="num">Pesos</th><th class="num">Dólares</th></tr>
      {filas_capital}
      <tr class="total"><td>Capital del lanzamiento</td><td class="num">{cop(lanz)}</td><td class="num">{usd(lanz)}</td></tr>
      <tr><td>Cuota de franquicia (toda Bogotá, 10 años)</td><td class="num">{cop(d['cuota_fr'])}</td><td class="num">120.000 USD</td></tr>
      <tr class="total"><td>Inversión total</td><td class="num">{cop(total_inv)}</td><td class="num">{usd(total_inv)}</td></tr></table></div>
    <div>
      <div class="tarjeta" style="margin-bottom:4mm"><h3>Tres tamaños de lanzamiento</h3>
        <table><tr><th>Escenario</th><th class="num">6 meses</th></tr>
        <tr><td>Sobrio: redes y calle, poca valla</td><td class="num">1,4 M USD</td></tr>
        <tr><td><b>Este plan</b>: toda Bogotá, por zonas</td><td class="num"><b>{musd(lanz).replace(' millones de USD',' M USD')}</b></td></tr>
        <tr><td>Fuerte: ciudad cubierta de vallas</td><td class="num">5,2 M USD</td></tr>
        <tr><td>Por todo lo alto: TV nacional y celebridades</td><td class="num">13 M USD</td></tr></table>
        <p class="nota">Como referencia, Yango gastó unos 600.000 dólares por semana en publicidad en Colombia.</p></div>
      <div class="tarjeta"><h3>De dónde salen los precios</h3><p class="chico">Vallas: de 8 a 50 millones de pesos al mes (Las2orillas, feb 2026). TransMilenio: 318.960 pesos por metro cuadrado al mes (tarifa oficial 2025). Radio y TV: tarifarios de RCN y Caracol. Instalaciones: 1,2 a 2,5 dólares por app instalada. Salarios: portales de empleo de 2026. Las piezas sin tarifa pública son estimaciones y se confirman al cotizar.</p></div>
    </div>
  </div>
  <div class="pie"><span>Detalle en el estudio de costos de lanzamiento en Bogotá</span><span>9</span></div>
</section>

<section class="hoja">
  <div class="etq">Cuánto deja cada pedido</div>
  <h2>Un pedido típico de 35.000 pesos</h2>
  <p class="sub">El cliente paga la comida, el envío, la tarifa de servicio y la propina. El repartidor se lleva el envío y la propina completos. La plataforma vive de la comisión y la tarifa de servicio.</p>
  <div class="col2">
    <div class="tarjeta"><table>
      <tr><th>Concepto</th><th class="num">Pesos</th></tr>
      <tr><td>Comisión del restaurante (15 % de 35.000)</td><td class="num">5.250</td></tr>
      <tr><td>Tarifa de servicio al cliente (5 %)</td><td class="num">1.750</td></tr>
      <tr class="total"><td>Ingreso de la plataforma</td><td class="num">{n(d['ingreso_bruto'])}</td></tr>
      <tr><td>Pasarela de pagos (mitad de los pedidos con tarjeta)</td><td class="num">−{n(d['pasarela']/2)}</td></tr>
      <tr><td>Aportes de seguridad social del repartidor (Ley 2466)</td><td class="num">−{n(d['aportes'])}</td></tr>
      <tr><td>Completar el mínimo del repartidor y soporte</td><td class="num">−650</td></tr>
      <tr class="total"><td>Margen por pedido</td><td class="num">{n(d['neto_pedido'])}</td></tr>
      <tr><td>Franquiciado (75 %)</td><td class="num verde-t">{n(d['neto_pedido']*0.75)}</td></tr>
      <tr><td>Tumbite (25 %)</td><td class="num">{n(d['neto_pedido']*0.25)}</td></tr></table></div>
    <div class="tarjeta"><h3>Por qué 75 % y 25 %</h3>
      <p>El franquiciado carga con lo más pesado de la operación diaria: el equipo, la publicidad, los repartidores y la atención en Bogotá. Por eso se queda con tres de cada cuatro pesos del margen.</p>
      <p style="margin-top:3mm">Tumbite cubre con su 25 % la tecnología, los servidores, las tiendas de apps, la vigilancia de los pedidos, las mejoras continuas y el soporte. En las franquicias maestras del mundo el reparto suele ser 50 y 50; aquí es más favorable para el socio local porque la tecnología ya está hecha.</p>
      <p style="margin-top:3mm" class="chico">No hay regalías sobre las ventas de los restaurantes ni cuota mensual fija: Tumbite gana solo cuando la franquicia gana.</p>
      <p style="margin-top:3mm" class="chico">Ingresos extra que no están en estas cuentas: restaurantes destacados en la app, una membresía con envío gratis y otros servicios (mercado, farmacia, envíos).</p></div>
  </div>
  <div class="pie"><span>Supuestos: ticket de 35.000 pesos, envío de 4.500, Wompi 2,65 % + 700 pesos + IVA, 50 % de pagos con tarjeta</span><span>10</span></div>
</section>

<section class="hoja">
  <div class="etq">Proyección</div>
  <h2>Utilidad anual del franquiciado y retorno del capital</h2>
  <p class="sub">Utilidad del franquiciado después de su equipo y su publicidad mensual, sin contar el capital del lanzamiento (que es la inversión que se recupera). Tres escenarios: el base supone 2 % de los domicilios de Bogotá al año, 4,5 % al segundo y 6 % al tercero.</p>
  <div class="col2" style="grid-template-columns:1.1fr 1fr">
    <div>
      <table><tr><th>Escenario</th><th class="num">Año 1</th><th class="num">Año 2</th><th class="num">Año 3</th><th class="num">Año 4</th><th class="num">Recupera</th></tr>
        {fila_anios('Conservador', cons)}{fila_anios('Base', base)}{fila_anios('Optimista', opti)}</table>
      <h3 style="margin-top:6mm">Pedidos al año</h3>
      <table><tr><th>Escenario</th><th class="num">Año 1</th><th class="num">Año 2</th><th class="num">Año 3</th><th class="num">Año 4</th><th></th></tr>
        {fila_pedidos('Conservador', cons)}{fila_pedidos('Base', base)}{fila_pedidos('Optimista', opti)}</table>
      <h3 style="margin-top:6mm">Lo que recibe Tumbite (25 %)</h3>
      <table><tr><th>Escenario</th><th class="num">Año 1</th><th class="num">Año 2</th><th class="num">Año 3</th><th class="num">Año 4</th><th></th></tr>
        {fila_tumbite('Base', base)}</table></div>
    <div class="tarjeta"><h3>Caja acumulada del franquiciado, escenario base</h3>
      {grafico}
      <p class="chico">Empieza en menos la inversión total y sube con la utilidad de cada mes. En el escenario base, en el mes {pb} vuelve todo el capital; desde ahí todo es utilidad.</p>
      <div class="col2" style="margin-top:3mm;gap:3mm">
        <div><div class="chico">Utilidad al mes 24 (base)</div><div class="cifra verde" style="font-size:15pt">{usd(base['mes24']['util'])}</div></div>
        <div><div class="chico">Utilidad al mes 36 (base)</div><div class="cifra verde" style="font-size:15pt">{usd(base['mes36']['util'])}</div></div></div></div>
  </div>
  <div class="pie"><span>Modelo con supuestos escritos; se actualiza con los datos reales de cada mes</span><span>11</span></div>
</section>

<section class="hoja">
  <div class="etq">Socios y capital</div>
  <h2>Cómo entran los socios y cómo se recupera el capital</h2>
  <p class="sub">Los inversionistas son dueños de la franquicia. Tumbite no les pide acciones: gana con su 25 % del margen y con la cuota de entrada.</p>
  <div class="col3">
    <div class="tarjeta"><span class="paso">1</span><h3>La empresa</h3><p>Se crea <b>Tumbite Bogotá S.A.S.</b>, la franquicia. Los socios aportan el capital y reciben acciones en proporción a su aporte. Ejemplo: con {musd(total_inv)} en total, un aporte de 100.000 dólares equivale a cerca del {str(round(100000/(total_inv/TRM)*100,1)).replace('.',',')} % de la empresa.</p></div>
    <div class="tarjeta"><span class="paso">2</span><h3>El aporte, por partes</h3><p>Al firmar se paga la mitad de la cuota de franquicia (60.000 dólares) y el 40 % del capital del lanzamiento. La otra mitad de la cuota y el 35 % del capital, al abrir la primera zona. El último 25 %, en el mes 6, con las metas cumplidas.</p></div>
    <div class="tarjeta"><span class="paso">3</span><h3>El retorno</h3><p>Mientras los socios no recuperen su aporte, toda la utilidad de la franquicia va primero a devolverles el capital, en proporción a lo que pusieron. Después, la utilidad se reparte por acciones o se reinvierte, según lo decida la asamblea.</p></div>
  </div>
  <div class="tarjeta" style="margin-top:6mm"><h3>Ejemplo para un socio con 100.000 dólares (escenario base)</h3>
    <table><tr><th>Momento</th><th>Qué pasa</th><th class="num">Para el socio</th></tr>
      <tr><td>Meses 1 a 6</td><td>Se prepara la ciudad y se abre por zonas</td><td class="num">aporte de 100.000 USD</td></tr>
      <tr><td>Hasta el mes {pb}</td><td>La utilidad devuelve el capital a todos los socios</td><td class="num">recupera los 100.000 USD</td></tr>
      <tr><td>Año 3</td><td>Utilidad de la franquicia: {usd(base['anios'][2]['franq'])}</td><td class="num verde-t">≈ {usd(base['anios'][2]['franq']*100000/(total_inv/TRM))}</td></tr>
      <tr><td>Año 4</td><td>Utilidad de la franquicia: {usd(base['anios'][3]['franq'])}</td><td class="num verde-t">≈ {usd(base['anios'][3]['franq']*100000/(total_inv/TRM))}</td></tr></table>
    <p class="nota">Cálculo proporcional y antes de impuestos de Colombia. El valor de la franquicia también crece: una franquicia que deja utilidad se puede vender o ampliar a otras ciudades.</p></div>
  <div class="pie"><span>Tumbite Bogotá · Propuesta de franquicia</span><span>12</span></div>
</section>

<section class="hoja">
  <div class="etq">Lo construido y lo que falta para Bogotá</div>
  <h2>Qué hace hoy el sistema y qué se construye antes de abrir</h2>
  <p class="sub">Para que el socio sepa exactamente qué recibe el primer día y qué queda en el plan de trabajo de Tumbite antes del lanzamiento.</p>
  <div class="col2">
    <div class="tarjeta"><h3>Ya funciona hoy</h3><ul class="lista">
      <li>Las tres apps (cliente, restaurante, repartidor) y los paneles web, en español e inglés.</li>
      <li>El panel de la franquicia con los números de su territorio, y zonas dibujadas por mapa.</li>
      <li>El cobro en mano: efectivo o transferencia al repartidor, el pago de la comida en el local con su ticket, y la comisión cobrada de un saldo prepago, con su libro contable.</li>
      <li>Las recargas por punto de venta con códigos de un solo uso.</li>
      <li>El cobro con tarjeta por Stripe (hoy en Estados Unidos).</li>
    </ul></div>
    <div class="tarjeta"><h3>Se construye o se contrata antes de abrir Bogotá</h3><ul class="lista">
      <li><b>Tarifas en pesos:</b> precios, envío y comisiones en pesos colombianos (hoy la tarifa es en dólares).</li>
      <li><b>Pasarela local:</b> tarjeta, PSE y Nequi con la empresa del socio (Wompi u otra); Stripe no ofrece PSE ni Nequi.</li>
      <li><b>Liquidación automática 75 / 25:</b> hoy las condiciones de la franquicia se guardan, pero el reparto mensual se calcula a mano; se automatiza antes de abrir.</li>
      <li><b>0 % de comisión los tres primeros meses:</b> hoy se haría con el plan de cada restaurante; la promoción automática por fechas se construye.</li>
      <li><b>Revisión legal en Colombia</b> (franquicia, datos personales, Ley 2466 de repartidores, saldo prepago).</li>
    </ul></div>
  </div>
  <p class="nota">Qué hace Tumbite y qué contrata el socio (por ejemplo, la pasarela y su abogado) se fija en el contrato.</p>
  <div class="pie"><span>Tumbite Bogotá · Propuesta de franquicia</span><span></span></div>
</section>

<section class="hoja">
  <div class="etq">Condiciones</div>
  <h2>Las condiciones de la franquicia, y lo que hay que saber</h2>
  <div class="col2">
    <div class="tarjeta"><h3>Condiciones propuestas</h3><table>
      <tr><td>Territorio</td><td>Toda Bogotá, con exclusividad. Soacha y Chía se pueden sumar.</td></tr>
      <tr><td>Cuota de franquicia</td><td>120.000 USD, en dos pagos: firma y apertura (propuesta).</td></tr>
      <tr><td>Reparto del margen</td><td>75 % franquiciado, 25 % Tumbite, liquidado cada mes (propuesta).</td></tr>
      <tr><td>Duración</td><td>10 años, renovables por 5.</td></tr>
      <tr><td>Metas para conservar la exclusividad</td><td>500 restaurantes activos al mes 12 y 50.000 pedidos al mes al mes 24.</td></tr>
      <tr><td>Comisión a restaurantes</td><td>Cerca del 15 %, con 0 % los 3 primeros meses para los primeros restaurantes.</td></tr>
      <tr><td>Pagos</td><td>Tarjeta y billeteras por la pasarela de la franquicia; efectivo y transferencia al repartidor, ya incluidos en la app.</td></tr></table></div>
    <div class="tarjeta"><h3>Lo que hay que saber, con honestidad</h3><ul class="lista">
      <li>Los pagos con tarjeta en Colombia se activan cuando la franquicia firme con la pasarela (Wompi u otra); la conexión la hacemos nosotros. El efectivo y la transferencia al repartidor ya funcionan en la app.</li>
      <li>La Ley 2466 de 2025 pide a las plataformas pagar el 60 % de los aportes de salud y pensión de los repartidores. Ya está en las cuentas.</li>
      <li>Las proyecciones dependen de la ejecución y del mercado; no son promesas. El modelo se revisa cada mes con los números reales.</li>
      <li>Rappi y DiDi Food van a responder. Por eso el plan entra por zonas y libera el capital por metas.</li>
      <li>Antes de firmar conviene la revisión de un abogado colombiano: contrato de franquicia, datos personales y normas de domiciliarios.</li></ul></div>
  </div>
  <div class="tarjeta" style="margin-top:6mm"><h3>Siguientes pasos</h3>
    <p>1. Reunión para revisar este documento y los supuestos. 2. Carta de intención con la exclusividad reservada por 60 días. 3. Contrato de franquicia y creación de la S.A.S. 4. Arranca el mes 1 del plan.</p></div>
  <div class="pie"><span>© 2026 tumbite.com | All rights reserved. Developed by Windoce LLC</span><span>13</span></div>
</section>

<section class="hoja">
  <div class="etq">Fuentes</div>
  <h2>De dónde salen los datos</h2>
  <div class="col2" style="font-size:8pt">
    <ul class="lista">
      <li>Rappi en Colombia, órdenes y restaurantes: Prensa Mercosur, 29 may 2026; Semana, 2026.</li>
      <li>Crecimiento de domicilios: El Tiempo (Sales Track y GIG Latam), 2026.</li>
      <li>Participación de mercado: Sensor Tower.</li>
      <li>DiDi Food en Colombia: Valora Analitik, 19 sep 2026.</li>
      <li>Comisiones de Rappi a restaurantes: Rappi Merchants Colombia; Chejefe; POS Colombia, 2026.</li>
      <li>Tarifa mínima del repartidor: Infobae, 21 feb 2024.</li>
      <li>Efectivo en Colombia: Infobae (Banco de la República), 6 oct 2026.</li>
      <li>Ley 2466 de 2025 y Decreto 991 de 2026: MinTIC; El Colombiano, oct 2026.</li>
      <li>Franquicias en Colombia (McDonald's, Subway, Juan Valdez): Pulzo, Subway Colombia, Mundofranquicia.</li></ul>
    <ul class="lista">
      <li>Lanzamiento de Yango: El Colombiano, 10 oct 2024; Publimetro, 5 feb y 6 mar 2025; Autocosmos, 27 feb 2025; ENTER.CO, 21 abr 2026; Portafolio, 18 oct 2026.</li>
      <li>Vallas en Bogotá: Las2orillas, 11 feb 2026; DóndePauto.</li>
      <li>Publicidad en TransMilenio: tarifa oficial de TransMilenio S.A., 2025.</li>
      <li>Radio y televisión: tarifario de RCN Radio 2025; Caracol vía Pulzo, may 2025.</li>
      <li>Costos digitales: Business of Apps 2025; Adamigo.</li>
      <li>Salarios en Bogotá 2026: Glassdoor, Indeed, elempleo.</li>
      <li>Pasarelas: Wompi, PayU, dLocal Go.</li>
      <li>Tasa de cambio: Portafolio, TRM del 16 oct 2026.</li>
      <li>Las estimaciones propias están marcadas como tales en los estudios completos de Tumbite.</li></ul>
  </div>
  <div class="pie"><span>© 2026 tumbite.com | All rights reserved. Developed by Windoce LLC</span><span>14</span></div>
</section>
</body></html>'''

open(os.path.join(AQUI, 'franquicia-bogota.html'), 'w').write(html)
print('listo')

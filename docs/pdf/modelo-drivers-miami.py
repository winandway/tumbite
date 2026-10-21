"""Modelo de dinero de DRIVER'S Miami (propuesta de venta; NO es Tumbite). Supuestos escritos abajo.
Uso: python3 docs/pdf/modelo-drivers-miami.py  → escribe modelo-drivers-miami.json
"""
import json, math, os

AQUI = os.path.dirname(os.path.abspath(__file__))
MESES = 48
LICENCIA = 120_000            # cuota de la licencia (propuesta), mes 1
PARTE_WINDOCE = 0.25          # de la utilidad bruta positiva de cada mes (propuesta)

# Margen por pedido después del procesador de pagos y del pago mínimo al repartidor (tarifas reales
# de la plataforma; pedido de 30 USD a 2 km con 4 de propina). Planes propuestos para DRIVER'S:
# Básico 15 % (4,02 por pedido), Plus 20 % (6,02) y Premium 25 % (7,52); mezcla 50/35/15.
PLANES = {'Básico': (0.15, 0.50), 'Plus': (0.20, 0.35), 'Premium': (0.25, 0.15)}
def margen_plan(pct):  # comisión + servicio 1,99 − complemento del repartidor 1,01 − procesador 1,46
    return round(30 * pct + 1.99 - 1.01 - 1.46, 2)
MARGEN = round(sum(margen_plan(p) * w for p, w in PLANES.values()), 2)
MARGEN_PROMO = -0.48          # meses 4 a 6: 0 % de comisión a los primeros restaurantes
PROMO_POR_PEDIDO = 0.30       # cupones y bonos permanentes, por pedido

ESCENARIOS = {
    'conservador': {'techo': 55_000, 'tau': 15},
    'base': {'techo': 90_000, 'tau': 12},
    'optimista': {'techo': 130_000, 'tau': 10},
}


def pedidos(m, e):
    if m <= 3:
        return 0
    return round(e['techo'] * (1 - math.exp(-(m - 3) / e['tau'])))


def equipo(m):
    if m <= 3: return 35_000      # gerente y 3 comerciales, con cargas
    if m <= 12: return 62_000     # + soporte bilingüe, flota y redes
    if m <= 24: return 75_000
    return 85_000


def publicidad(m):
    if m <= 3: return 20_000
    if m <= 9: return 120_000
    if m <= 12: return 80_000
    return 50_000


def incentivos(m, n):
    fijo = 60_000 if 4 <= m <= 6 else 30_000 if 7 <= m <= 9 else 0
    return fijo + PROMO_POR_PEDIDO * n


UNA_VEZ = {  # pagos únicos del lanzamiento, por mes
    1: [('Abogado, permisos y seguros iniciales', 45_000)],
    2: [('Tablets para los primeros 300 restaurantes', 45_000), ('Kits de repartidores (500)', 17_500)],
    5: [('Tablets para 300 restaurantes más', 45_000), ('Kits de repartidores (500 más)', 17_500)],
}
SEGUROS_Y_OFICINA = 6_000  # mensual: seguro comercial, oficina compartida, herramientas


def correr(nombre):
    e = ESCENARIOS[nombre]
    caja = -LICENCIA
    meses = []
    for m in range(1, MESES + 1):
        n = pedidos(m, e)
        margen = n * (MARGEN_PROMO if 4 <= m <= 6 else MARGEN)
        windoce = PARTE_WINDOCE * margen if margen > 0 else 0
        costos = equipo(m) + publicidad(m) + incentivos(m, n) + SEGUROS_Y_OFICINA
        unicos = sum(v for _, v in UNA_VEZ.get(m, []))
        util = margen - windoce - costos - unicos
        caja += util
        meses.append({'m': m, 'pedidos': n, 'margen': margen, 'windoce': windoce, 'costos': costos + unicos, 'util': util, 'caja': caja})
    return meses


res = {k: correr(k) for k in ESCENARIOS}
base = res['base']
peor = min(x['caja'] for x in base)
capital = math.ceil((-peor - LICENCIA) * 1.10 / 10_000) * 10_000  # lanzamiento + 10 % de reserva
total = LICENCIA + capital


def resumen(meses):
    anios = []
    for a in range(4):
        tramo = meses[a * 12:(a + 1) * 12]
        anios.append({k: sum(x[k] for x in tramo) for k in ('pedidos', 'margen', 'windoce', 'util')})
    # Caja acumulada del proyecto: empieza en menos la licencia, baja con el arranque y sube con la
    # utilidad. El capital de los socios cubre el fondo de esa curva; cuando vuelve a cero, los socios
    # ya recuperaron todo lo que pusieron (la reserva no usada también vuelve).
    serie = [x['caja'] for x in meses]
    pago = next((x['m'] for x in meses if x['m'] > 6 and x['caja'] >= 0), None)
    return {'anios': anios, 'payback': pago, 'serie': serie,
            'mes12': meses[11], 'mes24': meses[23], 'mes36': meses[35]}


salida = {
    'planes': {k: {'pct': p, 'peso': w, 'margen': margen_plan(p)} for k, (p, w) in PLANES.items()},
    'licencia': LICENCIA, 'capital': capital, 'total': total, 'margen': MARGEN,
    'parte_windoce': PARTE_WINDOCE,
    'res': {k: resumen(v) for k, v in res.items()},
}
json.dump(salida, open(os.path.join(AQUI, 'modelo-drivers-miami.json'), 'w'), indent=1)
print('margen', MARGEN, 'capital', capital, 'total', total)
for k, v in salida['res'].items():
    print(k, 'recupera mes', v['payback'], [round(a['util']) for a in v['anios']], [a['pedidos'] for a in v['anios']], 'm24', v['mes24']['pedidos'])

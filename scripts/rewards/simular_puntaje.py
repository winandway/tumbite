"""Divoox Rewards · Fase 2 · Simulación A (30 oct 2026). Escalas del puntaje y su justicia.

No toca la base: población sintética con tasas «verdaderas» y ventanas de 100 con ruido binomial.
Uso: python3 scripts/rewards/simular_puntaje.py
"""
import random, statistics as st

random.seed(7)

def lineal(x, cero, lleno, pts):
    return max(0.0, min(1.0, (x - cero) / (lleno - cero))) * pts

def suave(x, tramos, pts):
    """Escala por tramos: [(valor, fracción)], interpola y satura."""
    if x <= tramos[0][0]:
        return tramos[0][1] * pts
    for (a, fa), (b, fb) in zip(tramos, tramos[1:]):
        if x <= b:
            return (fa + (fb - fa) * (x - a) / (b - a)) * pts
    return tramos[-1][1] * pts

FIN_LINEAL = lambda f: lineal(f, 0.90, 1.00, 30)
FIN_SUAVE = lambda f: suave(f, [(0.85, 0), (0.90, 0.40), (0.95, 0.80), (1.00, 1.0)], 30)

def puntaje(f, p, q, s, a, fin):
    return (fin(f) + lineal(p, 0.75, 0.98, 25) + q + lineal(s, 4.2, 5.0, 15)
            + lineal(a, 0.40, 0.85, 10))

def calidad(menores, mayores):
    return max(0.0, 20 - menores * 1 - mayores * 3)

def estrellas_ventana(media, n, previa=4.8, k=20):
    """Pocas notas: se mezclan con un valor neutro (encogimiento)."""
    notas = [min(5, max(1, round(random.gauss(media, 0.6)))) for _ in range(n)]
    if not notas:
        return previa
    return (sum(notas) + previa * max(0, k - len(notas))) / (len(notas) + max(0, k - len(notas)))

def ventana(t):
    f = sum(random.random() < t['fin'] for _ in range(100)) / 100
    p = sum(random.random() < t['pun'] for _ in range(100)) / 100
    a = sum(random.random() < t['ace'] for _ in range(100)) / 100
    men = sum(random.random() < t['men'] for _ in range(100))
    may = sum(random.random() < t['may'] for _ in range(100))
    s = estrellas_ventana(t['est'], int(100 * t['califica']))
    return f, p, calidad(men, may), s, a

def poblacion(n=4000):
    out = []
    for _ in range(n):
        out.append({
            'fin': min(0.999, random.betavariate(60, 1.8)),   # media ~97 %
            'pun': min(0.999, random.betavariate(18, 2.2)),   # media ~89 %
            'ace': random.betavariate(5, 2.6),                # media ~66 %
            'men': random.betavariate(1.2, 90),               # ~1,3 % menores
            'may': random.betavariate(1.0, 250),              # ~0,4 % mayores
            'est': random.gauss(4.78, 0.12),
            'califica': random.uniform(0.25, 0.45),
        })
    return out

def nivel(x, u=(60, 75, 88)):
    return 'Diamante' if x >= u[2] else 'Oro' if x >= u[1] else 'Plata' if x >= u[0] else 'Inicial'

print('== 1. Sensibilidad alrededor del 90 % de finalización (lo demás fijo y bueno) ==')
print('fin   lineal  suave   | puntaje total lineal  suave')
for f in (0.86, 0.88, 0.89, 0.90, 0.91, 0.93, 0.95, 0.97, 0.99, 1.0):
    pl = puntaje(f, 0.92, 19, 4.8, 0.70, FIN_LINEAL)
    ps = puntaje(f, 0.92, 19, 4.8, 0.70, FIN_SUAVE)
    print(f'{f:.2f}  {FIN_LINEAL(f):5.1f}  {FIN_SUAVE(f):5.1f}   | {pl:5.1f}  {ps:5.1f}  {nivel(pl):8} {nivel(ps)}')

print('\n== 2. Ruido: un repartidor con 96 % real, 1.000 ventanas de 100 ==')
for nombre, fin in (('lineal', FIN_LINEAL), ('suave', FIN_SUAVE)):
    xs = []
    for _ in range(1000):
        f = sum(random.random() < 0.96 for _ in range(100)) / 100
        xs.append(fin(f))
    bajo90 = sum(1 for _ in range(1000) if sum(random.random() < 0.96 for _ in range(100)) < 90) / 10
    print(f'{nombre:7} puntos de finalización: media {st.mean(xs):.1f}, desviación {st.pstdev(xs):.1f}; '
          f'ventanas por debajo de 90 %: {bajo90:.1f} %')

print('\n== 3. Distribución de niveles y estabilidad (dos ventanas seguidas, mismo repartidor) ==')
pob = poblacion()
for nombre, fin in (('lineal', FIN_LINEAL), ('suave', FIN_SUAVE)):
    for u in ((60, 75, 88), (60, 75, 90), (55, 70, 85)):
        n1, cambia = [], 0
        for t in pob:
            a = puntaje(*ventana(t), fin)
            b = puntaje(*ventana(t), fin)
            n1.append(nivel(a, u))
            cambia += nivel(a, u) != nivel(b, u)
        dist = {k: round(100 * n1.count(k) / len(n1)) for k in ('Inicial', 'Plata', 'Oro', 'Diamante')}
        print(f'{nombre:7} umbrales {u}: {dist}  cambian de nivel entre ventanas: {100*cambia/len(pob):.0f} %')

print('\n== 4. Histéresis (bajar solo con 3 puntos de margen) ==')
cambia_h = 0
for t in pob:
    a = puntaje(*ventana(t), FIN_SUAVE)
    b = puntaje(*ventana(t), FIN_SUAVE)
    na = nivel(a)
    sube = nivel(b) > na if False else None
    orden = ['Inicial', 'Plata', 'Oro', 'Diamante']
    u = (60, 75, 88)
    ib, ia = orden.index(nivel(b)), orden.index(na)
    if ib > ia:
        cambia_h += 1
    elif ib < ia and b < u[ia - 1] - 3:
        cambia_h += 1
print(f'suave (60, 75, 88) con margen de 3 puntos: cambian {100*cambia_h/len(pob):.0f} %')

print('\n== 5. Umbrales por percentiles (objetivo: Inicial 15 %, Plata 45 %, Oro 30 %, Diamante 10 %) ==')
xs = sorted(puntaje(*ventana(t), FIN_SUAVE) for t in pob)
pct = lambda q: xs[int(q * (len(xs) - 1))]
u = (round(pct(0.15)), round(pct(0.60)), round(pct(0.90)))
print('umbrales calculados:', u)
dist = {k: 0 for k in ('Inicial', 'Plata', 'Oro', 'Diamante')}
for x in xs:
    dist[nivel(x, u)] += 1
print({k: round(100 * v / len(xs)) for k, v in dist.items()})
print('puntaje de un repartidor «perfecto» típico (100 % fin., 97 % punt., sin incidentes, 4,9, 80 % acept.):',
      round(puntaje(1.0, 0.97, 20, 4.9, 0.80, FIN_SUAVE), 1))

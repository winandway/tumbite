"""Divoox Rewards · Fase 2 · Simulación D (30 oct 2026). Despacho con y sin ventaja de nivel.

Ciudad sintética de 12 x 12 km, 4 horas de cena, 60 repartidores, restaurantes al azar.
Políticas: A sin ventaja · B ventaja en segundos (20/45/75) · C = B + cupo 15 % para Inicial
· D prioridad estricta por nivel dentro de 5 km (para ver el «círculo cerrado»).
No toca la base. Uso: python3 scripts/rewards/simular_despacho.py
"""
import math, random, statistics as st

VEL = 25 / 60          # km por minuto
PREP = 12              # minutos de cocina
ESPERA_RECHAZO = 0.75  # minutos que se pierden si rechaza
VENTAJA = {'Inicial': 0, 'Plata': 20 / 60, 'Oro': 45 / 60, 'Diamante': 75 / 60}
NIVELES = ['Inicial'] * 12 + ['Plata'] * 27 + ['Oro'] * 15 + ['Diamante'] * 6

def correr(politica, semilla, pedidos_min=0.75, horas=4):
    rnd = random.Random(semilla)
    reps = [{'x': rnd.uniform(0, 12), 'y': rnd.uniform(0, 12), 'libre': 0.0, 'nivel': n,
             'pedidos': 0, 'gana': 0.0, 'ofertas': 0, 'acepta': 0.62 + 0.25 * rnd.random()}
            for n in NIVELES]
    t, res = 0.0, []
    while t < horas * 60:
        t += rnd.expovariate(pedidos_min)
        rx, ry = rnd.uniform(1, 11), rnd.uniform(1, 11)
        dx, dy = rx + rnd.uniform(-4, 4), ry + rnd.uniform(-4, 4)
        libres = [r for r in reps if r['libre'] <= t]
        if not libres:
            res.append(None)
            continue
        def eta(r):
            return math.hypot(r['x'] - rx, r['y'] - ry) / VEL
        cand = [r for r in libres if eta(r) <= 15 / VEL * 1.0]
        if not cand:
            res.append(None)
            continue
        if politica == 'A':
            orden = sorted(cand, key=eta)
        elif politica in ('B', 'C'):
            orden = sorted(cand, key=lambda r: eta(r) - VENTAJA[r['nivel']])
            if politica == 'C' and rnd.random() < 0.15:
                mejor = eta(orden[0])
                nuevos = [r for r in cand if r['nivel'] == 'Inicial' and eta(r) <= mejor + 2]
                if nuevos:
                    elegido = min(nuevos, key=eta)
                    orden = [elegido] + [r for r in orden if r is not elegido]
        else:  # D
            cerca = [r for r in cand if eta(r) <= 5 / VEL]
            rango = {'Diamante': 0, 'Oro': 1, 'Plata': 2, 'Inicial': 3}
            orden = sorted(cerca, key=lambda r: (rango[r['nivel']], eta(r))) or sorted(cand, key=eta)
        demora = 0.0
        elegido = None
        for r in orden[:6]:
            r['ofertas'] += 1
            if rnd.random() < r['acepta']:
                elegido = r
                break
            demora += ESPERA_RECHAZO
        if not elegido:
            elegido = orden[0]
        cercano = min(cand, key=eta)
        recogida = t + demora + eta(elegido)
        listo = t + PREP
        sale = max(recogida, listo)
        km_ent = math.hypot(dx - rx, dy - ry)
        fin = sale + km_ent / VEL
        km_tot = math.hypot(elegido['x'] - rx, elegido['y'] - ry) + km_ent
        elegido.update(x=dx, y=dy, libre=fin)
        elegido['pedidos'] += 1
        elegido['gana'] += 3 + 0.9 * km_tot
        res.append({'entrega': fin - t, 'espera_comida': max(0, recogida - listo),
                    'km_vacio': math.hypot(cercano['x'] - rx, cercano['y'] - ry),
                    'km_elegido': math.hypot(elegido['x'] - rx, elegido['y'] - ry)})
    hechos = [r for r in res if r]
    porn = {}
    for n in ('Inicial', 'Plata', 'Oro', 'Diamante'):
        g = [r for r in reps if r['nivel'] == n]
        porn[n] = (st.mean(x['pedidos'] for x in g), st.mean(x['gana'] for x in g) / horas)
    ped = sorted(r['pedidos'] for r in reps)
    gini = sum((2 * i - len(ped) + 1) * x for i, x in enumerate(ped)) / (len(ped) * sum(ped))
    return {
        'entrega': st.mean(r['entrega'] for r in hechos),
        'comida_espera': st.mean(r['espera_comida'] for r in hechos),
        'km_extra': st.mean(r['km_elegido'] - r['km_vacio'] for r in hechos),
        'sin_repartidor': 100 * (len(res) - len(hechos)) / len(res),
        'gini': gini, 'por_nivel': porn,
    }

for p, nombre in (('A', 'A sin ventaja'), ('B', 'B segundos 20/45/75'), ('C', 'C = B + cupo 15 %'),
                  ('D', 'D prioridad estricta')):
    rs = [correr(p, s) for s in range(30)]
    m = lambda k: st.mean(r[k] for r in rs)
    print(f'\n{nombre}: entrega {m("entrega"):.1f} min · comida esperando {m("comida_espera"):.2f} min · '
          f'km extra a la recogida {m("km_extra"):.2f} · sin repartidor {m("sin_repartidor"):.1f} % · Gini {m("gini"):.3f}')
    for n in ('Inicial', 'Plata', 'Oro', 'Diamante'):
        ped = st.mean(r['por_nivel'][n][0] for r in rs)
        gh = st.mean(r['por_nivel'][n][1] for r in rs)
        print(f'   {n:9} pedidos por repartidor {ped:5.1f} · ganancia por hora {gh:5.2f} USD')

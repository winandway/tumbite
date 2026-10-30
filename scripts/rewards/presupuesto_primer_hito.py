"""Divoox Rewards · Fase 2 · Cálculo C (30 oct 2026). Presupuesto del primer hito (30 USD a las 100
entregas en 60 días), por ciudad y mes. Contribución por entrega: 1,14 (plan Inicial) a 2,64 (Crece).
Uso: python3 scripts/rewards/presupuesto_primer_hito.py
"""
PREMIO = 30
for etapa, nuevos in (('Lanzamiento (Miami)', 40), ('Crecimiento', 150), ('Escala', 600)):
    for r in (0.25, 0.40, 0.55):
        ganan = nuevos * r
        costo = ganan * PREMIO
        contrib = (ganan * 100 * 1.14, ganan * 100 * 2.64)
        print(f'{etapa:20} nuevos/mes {nuevos:4} · llegan a 100 en 60 días {int(r*100)} % · premios {ganan:6.1f} · '
              f'costo {costo:8,.0f} USD · contribución de esas entregas {contrib[0]:9,.0f}–{contrib[1]:9,.0f} · '
              f'premio/contribución {100*costo/contrib[1]:.0f}–{100*costo/contrib[0]:.0f} %')

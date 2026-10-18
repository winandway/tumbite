# Modelo financiero de la franquicia Tumbite Bogotá (todo en COP salvo que se diga)
import json
TRM = 3170.46
M = 1_000_000
# --- Unidad por pedido (supuestos [INF], fuentes en las fichas) ---
ticket = 35_000           # comida
comision = 0.15           # Tumbite Colombia: unos 15 %, frente al 25 % + 2 % de Rappi
servicio = 0.05           # tarifa de servicio al cliente, 5 %
envio = 4_500             # lo paga el cliente, va al repartidor
tarjeta_part = 0.5        # mitad tarjeta/billetera, mitad efectivo o transferencia
pasarela = (0.0265 * (ticket + envio + ticket*servicio) + 700) * 1.19  # Wompi + IVA
aportes = 0.6 * 0.40 * 4_500 * (0.125 + 0.16 + 0.02436)  # Ley 2466 sobre lo que gana el repartidor
completar_min = 300       # lo que la plataforma completa al mínimo del repartidor
soporte_var = 350         # soporte y fallas por pedido
ingreso_bruto = ticket*comision + ticket*servicio
neto_pedido = ingreso_bruto - tarjeta_part*pasarela - aportes - completar_min - soporte_var
# --- Pedidos al mes (escenario base, rampa) ---
mercado_bog = 4_800_000  # pedidos al mes en Bogotá [INF]
cuota = {1:0.0015,2:0.003,3:0.005,4:0.007,5:0.009,6:0.011,7:0.013,8:0.015,9:0.017,10:0.019,11:0.021,12:0.023}
def participacion(m, esc):
    f = {'conservador':0.7,'base':1.0,'optimista':1.35}[esc]
    if m <= 12: p = cuota[m]
    elif m <= 24: p = 0.023 + (0.045-0.023)*(m-12)/12
    else: p = 0.045 + (0.06-0.045)*(m-24)/12
    return p*f
# --- Capital de lanzamiento (6 meses) ---
capital = {
 'Publicidad exterior (10 vallas, 12 estaciones de TransMilenio, 15 buses, 4 pantallas LED, 40 mupis)': 1_000*M,
 'Radio, Citytv y prensa': 480*M,
 'Digital (200.000 instalaciones, creadores de Bogotá, piezas)': 1_300*M,
 'Activaciones (brigadas, volantes, universidades y centros comerciales, uniformes)': 760*M,
 'Kit de 1.500 repartidores (chaqueta, maleta térmica)': 450*M,
 'Flota propia de 50 motos de respaldo': 375*M,
 'Tablets para 1.000 restaurantes': 450*M,
 'Incentivos: garantía a 1.200 repartidores (3 semanas)': 720*M,
 'Incentivos: primer pedido de 100.000 clientes': 1_000*M,
 'Incentivos: referidos (25.000)': 500*M,
 'Empresa y equipo de lanzamiento (6 meses)': 420*M,
}
sub = sum(capital.values())
reserva = round(sub*0.10/M)*M
capital['Reserva de imprevistos (10 %)'] = reserva
total_lanz = sum(capital.values())
cuota_fr_usd = 120_000
cuota_fr = cuota_fr_usd*TRM
# --- Costos fijos del franquiciado después del lanzamiento ---
def fijo(m):
    if m <= 6: return 0  # ya en el capital de lanzamiento
    equipo = 85*M if m <= 12 else 120*M if m <= 24 else 150*M
    mkt = 120*M if m <= 12 else 150*M if m <= 24 else 170*M
    return equipo + mkt + 15*M  # oficina y servicios
def corrida(esc, meses=36, reparto=0.75):
    filas=[]; acum=-(total_lanz+cuota_fr); payback=None
    for m in range(1, meses+1):
        ped = mercado_bog*participacion(m, esc)
        neto = ped*neto_pedido
        if m <= 3: neto -= ped*ticket*comision  # 3 meses sin comisión a los primeros restaurantes
        fr = neto*reparto; tb = neto*(1-reparto)
        util = fr - fijo(m)
        acum += util
        if payback is None and acum >= 0: payback = m
        filas.append(dict(mes=m, pedidos=round(ped), neto=round(neto), franq=round(fr), tumbite=round(tb), fijo=fijo(m), util=round(util), acum=round(acum)))
    return filas, payback
res = {}
for esc in ['conservador','base','optimista']:
    f,p = corrida(esc, 48)
    anual = lambda a: dict(pedidos=sum(x['pedidos'] for x in f[(a-1)*12:a*12]), franq=sum(x['util'] for x in f[(a-1)*12:a*12]), tumbite=sum(x['tumbite'] for x in f[(a-1)*12:a*12]), gmv=sum(x['pedidos'] for x in f[(a-1)*12:a*12])*ticket)
    res[esc] = dict(payback=p, anios=[anual(a) for a in (1,2,3,4)], mes12=f[11], mes24=f[23], mes36=f[35], acum=[x['acum'] for x in f])
out = dict(neto_pedido=round(neto_pedido), ingreso_bruto=round(ingreso_bruto), pasarela=round(pasarela), aportes=round(aportes),
  capital={k:v for k,v in capital.items()}, total_lanz=total_lanz, cuota_fr=cuota_fr, total_inv=total_lanz+cuota_fr, res=res)
json.dump(out, open(__import__('os').path.join(__import__('os').path.dirname(__file__),'modelo-franquicia-bogota.json'),'w'), indent=1)
u=lambda x: f"{x/TRM:,.0f} USD"
print('neto por pedido', round(neto_pedido), 'bruto', round(ingreso_bruto), 'pasarela', round(pasarela), 'aportes', round(aportes))
print('lanzamiento', f"{total_lanz/M:,.0f} M", u(total_lanz), 'cuota', u(cuota_fr), 'total', u(total_lanz+cuota_fr))
for e,r in res.items():
    print(e, 'recupera mes', r['payback'])
    for i,a in enumerate(r['anios'],1): print('  año',i, f"pedidos {a['pedidos']:,}", 'franq', u(a['franq']), 'tumbite', u(a['tumbite']))
    for k in ('mes12','mes24','mes36'): print('  ',k, f"{r[k]['pedidos']:,} ped", 'util/mes', u(r[k]['util']), 'tumbite/mes', u(r[k]['tumbite']))

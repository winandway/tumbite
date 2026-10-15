"""Capacidad y costos estimados (supuestos explícitos). Precios oficiales de Cloudflare (Workers Paid),
consultados el 15 oct 2026. D1 lo cobra YaDominios: su precio y sus límites no se conocen."""
S = dict(
    horas_mes=12 * 30,            # horas por mes con conductores conectados (12 h al día)
    en_operacion=0.20,            # fracción de conductores en un viaje o entrega
    ubic_espera_s=10, ubic_viaje_s=4,
    viajes_por_conductor_h=1.5,   # operaciones por conductor conectado por hora
    transiciones_por_viaje=8, ofertas_por_viaje=2,
    sondeo_estado_s=30,           # la app consulta su estado cada 30 s (las ofertas llegan empujadas)
    consultas_por_sondeo=3,
    tick_despacho_s=3, consultas_por_tick=6,
    lote_s=15, rastro_s=15,
    gb_por_do=0.125,              # memoria facturada por objeto (128 MB)
)
PRECIO = dict(base=5.0, do_req_incl=1e6, do_req=0.15 / 1e6, do_gbs_incl=400e3, do_gbs=12.50 / 1e6,
              do_fil_incl=50e6, do_fil=1.00 / 1e6, w_req_incl=10e6, w_req=0.30 / 1e6)
def objetos(n):            # objetos de ubicación: 1 por zona hasta ~300 msg/s; arriba, por celdas
    msg = n * mensajes_por_s()
    return max(1, -(-int(msg) // 300))
def mensajes_por_s(): return (1 - S['en_operacion']) / S['ubic_espera_s'] + S['en_operacion'] / S['ubic_viaje_s']
def d1_por_s(n, zonas=1):
    sondeos = n / S['sondeo_estado_s'] * S['consultas_por_sondeo']
    viajes = n * S['viajes_por_conductor_h'] / 3600 * (S['transiciones_por_viaje'] + S['ofertas_por_viaje'] + 1)
    despacho = zonas / S['tick_despacho_s'] * S['consultas_por_tick']
    lotes = objetos(n) / S['lote_s'] * 2
    return sondeos + viajes + despacho + lotes
def d1_actual_por_s(n):
    # Diseño de hoy (leído del código): ubicación cada 10 s ≈ 5 consultas; estado + ofertas cada 5 s
    # ≈ 2 peticiones de 3 consultas + el reparto dentro de la consulta de ofertas (≥ 3 consultas).
    return n * (5 / 10 + (2 * 3 + 3) / 5)
def costo_mes(n):
    seg = S['horas_mes'] * 3600; obj = objetos(n)
    msgs = n * mensajes_por_s() * seg
    alarmas = seg / S['tick_despacho_s']
    llamadas = n * S['viajes_por_conductor_h'] * S['horas_mes'] * 4          # candidatos + eventos al objeto
    req = msgs / 20 + alarmas + llamadas
    gbs = obj * seg * S['gb_por_do']
    filas = n * S['en_operacion'] * seg / S['rastro_s']                        # rastro de viajes en el objeto
    c_req = max(0, req - PRECIO['do_req_incl']) * PRECIO['do_req']
    c_gbs = max(0, gbs - PRECIO['do_gbs_incl']) * PRECIO['do_gbs']
    c_fil = max(0, filas - PRECIO['do_fil_incl']) * PRECIO['do_fil']
    w_req = seg / 60 + n * 2 * 30                                              # reloj + conexiones WebSocket
    c_w = max(0, w_req - PRECIO['w_req_incl']) * PRECIO['w_req']
    return dict(objetos=obj, req=req, gbs=gbs, filas=filas, total=PRECIO['base'] + c_req + c_gbs + c_fil + c_w,
                partes=(c_req, c_gbs, c_fil, c_w))
if __name__ == '__main__':
    print(f"mensajes de ubicación por conductor: {mensajes_por_s():.3f}/s")
    for n in (100, 1000, 10000):
        c = costo_mes(n)
        print(f"{n:>6} conductores | D1 hoy ≈{d1_actual_por_s(n):>7.0f} q/s | D1 nuevo ≈{d1_por_s(n):>6.1f} q/s | "
              f"ubic {n*mensajes_por_s():>6.0f} msg/s | objetos {c['objetos']:>2} | DO req {c['req']/1e6:6.2f} M | "
              f"GB-s {c['gbs']/1e6:5.2f} M | filas {c['filas']/1e6:6.1f} M | USD/mes ≈ {c['total']:7.2f} "
              f"(req {c['partes'][0]:.2f}, dur {c['partes'][1]:.2f}, filas {c['partes'][2]:.2f}, worker {c['partes'][3]:.2f})")

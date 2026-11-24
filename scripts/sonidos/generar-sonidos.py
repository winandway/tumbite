#!/usr/bin/env python3
"""
C-SONIDOS-PROPIOS (24 nov 2026) — todos los países.

Genera los sonidos ORIGINALES de los avisos de Divoox por síntesis pura (senos, envolventes y
pulsos calculados aquí mismo, sin muestras de ninguna otra app ni librería de audio). Lo que sale es
obra nuestra y se puede volver a generar idéntico:

    python3 scripts/sonidos/generar-sonidos.py

- llego.wav               (clientes)  «llegó tu conductor»: dos notas que suben, campanita clara.
- dinero.wav              (las tres)  recarga, cobro y saldo: dos destellos agudos y cortos.
- panico.wav              (las tres)  pánico: sirena de dos tonos con golpes, 20 s, fuerte.
- pedido_nuevo_largo.wav  (Restaurants) pedido nuevo con la app cerrada: timbre en ráfagas, 25 s.
- panico_bucle.wav        (panel)     la misma sirena, dos golpes (2,8 s), para repetir en bucle en la
                                      web sin pesar (el panel no admite archivos de más de 400 KB).

Formato: WAV PCM 16 bits mono (44,1 kHz los cortos, 22,05 kHz los largos para que pesen poco).
iPhone acepta hasta 30 s por aviso; los largos quedan por debajo.
"""
import math
import os
import struct
import wave

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def escribir(ruta, muestras, tasa):
    pico = max(1e-9, max(abs(m) for m in muestras))
    escala = 0.89 / pico
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with wave.open(ruta, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(tasa)
        w.writeframes(
            b''.join(struct.pack('<h', int(max(-1.0, min(1.0, m * escala)) * 32767)) for m in muestras)
        )


def nota(frec, dur, tasa, ataque=0.005, caida=6.0, armonicos=((1, 1.0),)):
    n = int(dur * tasa)
    out = []
    for i in range(n):
        t = i / tasa
        env = min(1.0, t / ataque) * math.exp(-caida * t)
        v = sum(a * math.sin(2 * math.pi * frec * k * t) for k, a in armonicos)
        out.append(env * v)
    return out


def mezclar(base, otra, desde, tasa):
    i0 = int(desde * tasa)
    if len(base) < i0 + len(otra):
        base.extend([0.0] * (i0 + len(otra) - len(base)))
    for i, v in enumerate(otra):
        base[i0 + i] += v
    return base


def llego():
    tasa = 44100
    campana = ((1, 1.0), (2, 0.35), (3, 0.12))
    s = [0.0] * int(1.1 * tasa)
    mezclar(s, nota(784.0, 0.6, tasa, caida=5.0, armonicos=campana), 0.0, tasa)  # Sol
    mezclar(s, nota(1174.7, 0.8, tasa, caida=4.0, armonicos=campana), 0.16, tasa)  # Re (quinta)
    return s, tasa


def dinero():
    tasa = 44100
    brillo = ((1, 1.0), (2.76, 0.4), (5.4, 0.15))  # parciales inarmónicos: «metal»
    s = [0.0] * int(0.75 * tasa)
    mezclar(s, nota(1975.5, 0.3, tasa, ataque=0.002, caida=14.0, armonicos=brillo), 0.0, tasa)
    mezclar(s, nota(2637.0, 0.5, tasa, ataque=0.002, caida=9.0, armonicos=brillo), 0.09, tasa)
    return s, tasa


def panico(dur=20.0):
    tasa = 22050
    n = int(dur * tasa)
    s = []
    fase = 0.0
    for i in range(n):
        t = i / tasa
        # Sirena de dos tonos (cambia cada 0,35 s) con onda casi cuadrada (suma de impares).
        f = 1046.5 if int(t / 0.35) % 2 == 0 else 784.0
        fase += 2 * math.pi * f / tasa
        v = math.sin(fase) + math.sin(3 * fase) / 3 + math.sin(5 * fase) / 5
        # Golpes: cada 1,4 s, 0,15 s de silencio para que se oiga como alarma y no como zumbido.
        hueco = 1.0 if (t % 1.4) < 1.25 else 0.0
        entrada = min(1.0, t / 0.02)
        s.append(v * hueco * entrada)
    return s, tasa


def pedido_nuevo_largo():
    tasa = 22050
    dur = 25.0
    s = [0.0] * int(dur * tasa)
    timbre = ((1, 1.0), (2, 0.5), (3, 0.25), (4.2, 0.1))
    t = 0.0
    while t < dur - 0.6:
        # Ráfaga de tres golpes ascendentes y una pausa corta: «ring, ring, ring».
        for k, f in enumerate((880.0, 1108.7, 1318.5)):
            mezclar(s, nota(f, 0.22, tasa, ataque=0.003, caida=10.0, armonicos=timbre), t + k * 0.16, tasa)
        t += 1.0
    return s[: int(dur * tasa)], tasa


SALIDAS = {
    'llego.wav': (llego, ['apps/cliente']),
    'dinero.wav': (dinero, ['apps/cliente', 'apps/repartidor', 'apps/restaurante']),
    'panico.wav': (panico, ['apps/cliente', 'apps/repartidor', 'apps/restaurante']),
    'panico_bucle.wav': (lambda: panico(2.8), ['apps/panel/public']),
    'pedido_nuevo_largo.wav': (pedido_nuevo_largo, ['apps/restaurante']),
}

if __name__ == '__main__':
    for nombre, (fn, destinos) in SALIDAS.items():
        muestras, tasa = fn()
        for d in destinos:
            carpeta = d if d.endswith('public') else os.path.join(d, 'assets', 'sonidos')
            ruta = os.path.join(RAIZ, carpeta, nombre)
            escribir(ruta, muestras, tasa)
            print(f'{ruta}  {len(muestras) / tasa:.2f} s')

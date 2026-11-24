# Origen de los sonidos de los avisos

C-SONIDOS-PROPIOS (24 nov 2026) — todos los países.

Los cuatro sonidos nuevos son **obra nuestra**: se generan por síntesis pura (senos, envolventes, pulsos y una onda casi cuadrada calculados muestra por muestra) con el guion `scripts/sonidos/generar-sonidos.py`. No usan ninguna muestra de otra app, ni bancos de sonidos, ni librerías de audio: solo la biblioteca estándar de Python (`math`, `wave`, `struct`). Volver a correr el guion los genera idénticos.

```bash
cd /Users/windocellc/Divoox && python3 scripts/sonidos/generar-sonidos.py
```

| Archivo                  | Para qué                             | Cómo suena                                                          | Duración | Dónde va                                                                                               |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `llego.wav`              | «Llegó tu conductor»                 | Campanita de dos notas que suben (sol y re)                         | 1,1 s    | clientes                                                                                               |
| `dinero.wav`             | Recarga, cobro, saldo, propina       | Dos destellos agudos con brillo metálico                            | 0,75 s   | clientes, Driver, Restaurants                                                                          |
| `panico.wav`             | Pánico                               | Sirena de dos tonos casi cuadrada con golpes de silencio cada 1,4 s | 20 s     | clientes, Driver, Restaurants; en el panel, `panico_bucle.wav` (dos golpes, 2,8 s, se repite en bucle) |
| `pedido_nuevo_largo.wav` | Pedido nuevo con Restaurants cerrada | Timbre en ráfagas de tres golpes ascendentes, una por segundo       | 25 s     | Restaurants                                                                                            |

Los largos van a 22,05 kHz para que pesen poco; iPhone admite hasta 30 s por aviso. Los cinco sonidos de antes (`aviso.wav`, `oferta.wav`, `oferta_larga.wav`, `oferta_bucle.wav`, `alarma.wav`) no se tocaron. La prueba `apps/servidor/src/canalesAvisos.test.ts` comprueba que los nuevos son WAV válidos, que duran menos de 30 s y que son distintos entre sí y de los de antes.

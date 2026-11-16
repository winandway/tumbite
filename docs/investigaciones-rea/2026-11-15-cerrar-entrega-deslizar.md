# Cerrar la entrega en la puerta: foto y deslizar (15 nov 2026) — todos los países

Candados: C-FOTO-ENTREGA-IPHONE y C-DESLIZAR-ENTREGA (ver `CANDADOS.md`).

## Por qué

Primera prueba real de Richard en Novi, Michigan (Divoox Driver PRUEBAS versión 17, iPhone). En la
casa del cliente tomó la foto y el pedido no se cerró: «No pudimos leer los datos enviados.» y, en
el chat, «No se pudo subir la foto.». Pidió además un cierre claro: con la foto tomada y el GPS en
el lugar, un botón deslizante que cierre la operación, como Uber y DoorDash.

## Referencias y evidencia

| Referencia                                                         | Qué hace                                                                                                                                                                                                                                                                                                 | Etiqueta                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DoorDash Dasher, entrega sin contacto                              | Al llegar, la parte de abajo de la pantalla dice «complete delivery steps»; se toma la foto (obligatoria) y una descripción opcional; **después** se toca «complete delivery». Si el cliente tomó la comida antes, «Handed order directly to customer». La foto se le manda al cliente por SMS y correo. | [REA] página pública de ayuda de Dasher, capturada con REA como visitante (paquete `evidencia-rea-2026-11-15-cerrar-entrega.json.gz`, escenario sha256 `9f740d4fe490727f76e9850a58a42bad59478daa5960d65c0091cf96c1c448cc`) |
| Uber Eats (guía para repartidores)                                 | La entrega se termina deslizando «delivered» en la app del conductor; si se deja en la puerta, la foto se toma en la app para poder completar.                                                                                                                                                           | [DOC] guía pública de Uber para repartidores (Australia)                                                                                                                                                                   |
| Shipt (prueba de entrega)                                          | Después de la foto, «Swipe to finish» confirma y completa la entrega.                                                                                                                                                                                                                                    | [DOC] ayuda pública de Shipt para conductores                                                                                                                                                                              |
| Amazon Flex (nuestra pieza «Deslizar» de Mi ruta, C-FLEX-DESLIZAR) | «Deslice para finalizar».                                                                                                                                                                                                                                                                                | [OBS] capturas de Richard, 30 oct 2026                                                                                                                                                                                     |
| Nuestra app (Driver v17)                                           | La foto de la puerta cerraba el pedido de una vez; en iPhone fallaba por el tipo vacío.                                                                                                                                                                                                                  | [OBS] video de Richard + prueba en rojo                                                                                                                                                                                    |

Lo que no se puede verificar desde afuera: si Uber exige un radio exacto de GPS para habilitar el
deslizador [NV]. Nosotros mantenemos nuestra regla (llegada confirmada con dos lecturas precisas y
unos 80 metros), que el servidor revisa al deslizar.

## Flujo

```
En camino → llega a la puerta (GPS confirma) → «Tomar foto de la entrega»
   → foto sube sola (evidencia, sin cerrar) → miniatura + «Tomar otra foto»
   → «Desliza para completar» (verde) → servidor revisa foto + GPS → entregado
```

Sin señal: la foto y el cierre quedan en la cola del celular, en orden, y se mandan solos.

## Comparación con Divoox y decisión

- Antes: un toque en «Tomar foto de la entrega» subía la foto y cerraba en el mismo paso; sin
  confirmación visible y con el fallo del iPhone.
- Ahora: foto por su propio camino (`/foto-entrega`) y cierre con deslizador (`/entregado` con modo
  «puerta»), igual que DoorDash (foto, luego completar) y Uber (deslizar). El deslizador evita
  cierres por un toque accidental.
- Se reutiliza: la regla de llegada por GPS, la cola sin señal, la evidencia y el correo con la
  foto al cliente. La app vieja (versión 17) sigue funcionando con el camino de antes.
- Con PIN o con productos para mayores de 21 no hay foto: se entrega en mano, como hasta hoy.

## Pruebas de aceptación

- Foto sin tipo (como el iPhone) a `/entregado` → entrega (antes 400).
- Foto del chat → responde con su dirección.
- Foto aparte → el pedido sigue en camino; el repartidor ve «foto lista»; el cliente no la ve aún.
- Deslizar con foto en la puerta → entregado y evidencia confirmada.
- Deslizar sin foto → 409 «Primero toma la foto…». Deslizar lejos → 409.
- Recorrido del navegador: foto y deslizador sin señal, se manda solo al volver la señal.

Fuentes: ayuda de DoorDash Dasher («No-Contact Delivery Requests»), guía de Uber para repartidores
(«Delivering using the Uber Eats app»), ayuda de Shipt («Proof of delivery»).

## Segunda parte (15 nov 2026): fotos livianas y las dos fotos para el restaurante

### Fotos que suben rápido (C-FOTO-EVIDENCIA-LIVIANA)

- Richard vio que la foto en el restaurante tardaba mucho. Causa [OBS]: el Driver subía la foto de
  la cámara en tamaño completo (12 megapíxeles), y además pedía la ubicación DESPUÉS de tomarla.
- Decisión: achicar en el teléfono a 1280 px de lado mayor y JPEG 0,6 (rango habitual de las apps de
  reparto para fotos de prueba [INF]: no publican su número), pedir la ubicación mientras la cámara
  está abierta, y reintentar sola la recogida y la entrega cuando falla la señal.
- Medida con dos fotos reales de 12 megapíxeles (4032 × 2268), en esta computadora:

| Foto | Antes (completa, JPEG 0,5) | Después (1280 px, JPEG 0,6) | Con 1 Mbps de subida |
| ---- | -------------------------- | --------------------------- | -------------------- |
| 1    | 786 KB                     | 137 KB                      | de 6,3 s a 1,1 s     |
| 2    | 969 KB                     | 192 KB                      | de 7,8 s a 1,5 s     |

Un iPhone suele sacar la foto más pesada que esta prueba (1,5 a 2,5 MB): ahí la diferencia pasa
de 12-20 segundos a uno o dos.

### El restaurante ve las dos fotos (C-FOTOS-AL-COMERCIO)

| Referencia               | Qué se encontró                                                                                                                                                                                                                                                                 | Etiqueta                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| DoorDash Merchant Portal | El detalle de un pedido muestra datos del cliente y del Dasher, horas estimadas y reales y la dirección; no documenta la foto de la entrega para el comercio. La única foto que DoorDash comparte con el comercio es la del montaje de los pedidos grandes (Drive Large Order). | [DOC] ayuda pública de DoorDash para comercios |
| DoorDash Dasher          | La foto de la entrega es obligatoria y se le manda al cliente.                                                                                                                                                                                                                  | [REA] (primera parte)                          |
| Uber Eats Manager        | Los reclamos se atienden desde el pedido, con pruebas; no hay documento oficial que diga que el comercio ve la foto de la entrega.                                                                                                                                              | [NV]                                           |

- Decisión: es un pedido explícito de Richard y va un paso más allá de lo que documentan los grandes.
  El restaurante ve en el detalle del pedido (app y panel) «Al recoger» y «Al entregar», que se
  abren en grande. Es la misma foto guardada una sola vez (`/datos/pedidos/:id/evidencia/:tipo`,
  que ya permitía al dueño y a su equipo); nada se copia.
- La app del restaurante dice «Entregado al cliente» cuando el pedido se cierra; antes se quedaba en
  «Recogido / En camino» porque el cierre fallaba (primera parte).
- El cliente ve la foto de la entrega en su pedido («Así quedó tu pedido»), comprobado en el recorrido.

Fuentes: ayuda de DoorDash para comercios («How to Find and Manage Orders in the Merchant Portal»,
«Completing a Drive Large Order Delivery»).

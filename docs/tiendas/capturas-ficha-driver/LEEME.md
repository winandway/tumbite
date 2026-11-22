# Capturas de la ficha de Divoox Driver en Google Play (22 nov 2026) — todos los países

Ocho piezas por idioma (español e inglés), de 1080 × 1920, PNG de 24 bits sin transparencia.
Pedido de Richard: «bien profesionales». **No están subidas a Play Console**: las sube Gerencia
cuando el auditor de tiendas dé su dictamen.

- `originales/<es|en>/` — la pantalla real de Driver (el mismo código de la app, en su versión web,
  contra el servidor local del recorrido), tal cual, a 1200 × 2256.
- `finales/<es|en>/` — la pieza armada: fondo azul de Driver, «PARA CONDUCTORES», titular de máximo
  seis palabras y la pantalla entera dentro de un marco de teléfono. Copia en
  Documentos → Entregas → Divoox → ficha-driver-google-play.

| N.º | Idea                           | Pantalla                                                        |
| --- | ------------------------------ | --------------------------------------------------------------- |
| 01  | Gana con cada viaje            | La oferta de un viaje en moto, con lo que gana antes de aceptar |
| 02  | Conéctate cuando quieras       | El inicio, conectado y esperando viajes                         |
| 03  | Trabaja en moto o carro        | Perfil → «Mi vehículo»: su moto en uso y «Registrar mi carro»   |
| 04  | Registro guiado, foto por foto | El asistente de papeles, paso 1 de 3                            |
| 05  | Tu saldo, siempre claro        | Ganancias → «Saldo para comisiones»                             |
| 06  | Tu línea y tu equipo           | «Mi línea» del líder, con su código y sus solicitudes           |
| 07  | Ves la foto de la entrada      | La foto de la entrada del pasajero, en el viaje aceptado        |
| 08  | Camila te ayuda                | El chat de ayuda con la respuesta de Camila                     |

## Cómo se rehacen

```bash
PUERTO_RECORRIDO=8796 node scripts/recorrido/preparar.mjs
npx wrangler dev -c .recorrido/wrangler.jsonc --port 8796 --persist-to .recorrido/estado   # en otra terminal
node scripts/recorrido/capturas-ficha-driver.mjs
node scripts/marca/ficha-driver-google-play.mjs
```

## Datos neutros (C-DOCS-SIN-DATOS-REALES)

Ciudad «Ciudad de ejemplo» / «Sample City», mapa sin rótulos, personas inventadas, código de línea
imposible (`EJEMPLO01`), la entrada es un dibujo. Ninguna pieza nombra ni lista ciudades o países.
Todos los montos están en dólares y son los de la cuenta de ejemplo (cifras pequeñas, sin promesa).

## Medidas (comprobadas pieza por pieza)

1080 × 1920 píxeles (lado corto de 1080, proporción 9:16), PNG de 24 bits sin transparencia, entre
117 KB y 312 KB cada una (el límite de Google Play es 8 MB). El teléfono se ve entero y ninguna pieza
termina con un texto o un número cortado. Fondo `logistica` (#1F4D69) y resalte `logisticaAccion`
(#4AA5DC) de `MARCA.colores`, el sistema de diseño de Driver; el guion los lee de ahí.

## Para el dictamen del auditor de tiendas

0. **Dictamen decimocuarto (22 nov 2026), cumplido:** en las piezas 01 y 07 el mapa es un DIBUJO de
   ejemplo (calles y una plaza inventadas, la misma tesela repetida; conserva la atribución): no deja
   reconocer ninguna ciudad. En la 01 el contador dice «25s» en los dos idiomas (el reloj de la página
   se detiene ahí) y la foto empieza en el borde de la oferta, sin el encabezado asomando (lo que se
   quita arriba se completa abajo con el blanco de la misma hoja). En la 08 la pregunta empieza en un
   borde limpio.
1. **Pieza 01:** el monto grande de la oferta es la pantalla real (C-PRECIO-PROTAGONISTA) y sale de la
   tarifa de ejemplo para un viaje de 4,4 km con el conductor a 0,8 km; el titular no promete cifras.
2. **Pieza 02:** «3 h 20 m en línea» se logra adelantando el reloj de la página (la app cuenta desde
   que se conectó); «4 viajes» son los de la cuenta. La app dice «Viajes» cuando lo de hoy fueron solo
   viajes de pasajeros (C-HOY-VIAJES): en las tiendas entra con la próxima compilación de Driver; la
   0.1.68 todavía dice «Entregas» ahí.
3. **Piezas 02 y 03:** el enlace «¿Una empresa o un restaurante te invitó?» se deja invisible (es lo
   mismo que recortarlo); nada más se toca.
4. **Pieza 05:** para que no aparezca la moneda ni el método de pago local de un país, los viajes de
   ejemplo van cobrados en dólares y la lista de métodos de pago a celular llega vacía (la app no
   dibuja esa tarjeta, como en un país que no los usa). El saldo y lo demás son los de la cuenta.
5. **Pieza 03:** dice «moto o carro» porque la app deja registrar los dos; se trabaja con uno a la vez.

# Capturas de la ficha de Divoox Driver en Google Play (22 nov 2026) — todos los países

Ocho piezas por idioma (español e inglés), de 1080 × 1920, PNG de 24 bits sin transparencia.
Pedido de Richard: «bien profesionales». **No están subidas a Play Console**: las sube Gerencia
cuando el auditor de tiendas dé su dictamen.

- `originales/<es|en>/` — la pantalla real de Driver (el mismo código de la app, en su versión web,
  contra el servidor local del recorrido), tal cual, a 1200 × 2460.
- `finales/<es|en>/` — la pieza armada: fondo azul de Driver, «PARA CONDUCTORES», titular de máximo
  seis palabras y la pantalla dentro de un marco de teléfono. Copia en
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

## Para el dictamen del auditor de tiendas

1. **Pieza 01:** el monto grande de la oferta es la pantalla real (C-PRECIO-PROTAGONISTA); el titular
   no promete cifras. Si el auditor prefiere no mostrar un monto, se cambia por la pantalla del viaje.
2. **Pieza 05:** para que no aparezca el método de pago local de un país («dónde te pagan los
   pasajeros»), en esa foto la lista de esos métodos llega vacía y la app no dibuja esa tarjeta, como
   en un país que no los usa. El saldo y lo demás son los de la cuenta.
3. **Pieza 03:** dice «moto o carro» porque la app deja registrar los dos; se trabaja con uno a la vez.
4. Las pantallas de la app 0.1.68 dicen «Entregas» / «Deliveries» en el inicio; la etiqueta de la
   pieza dice «PARA CONDUCTORES» / «FOR DRIVERS».

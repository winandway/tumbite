# Lo que se encendió en producción el 31 oct 2026 (orden de Richard: «actívalo de tu lado, coherente con el mercado»)

País: EE. UU. Zonas: Miami y Novi (Michigan, donde está Richard para probar).

## Envíos de persona a persona — «solo piloto»

- Visible y usable solo para los participantes del piloto; el público sigue viendo «muy pronto».
- Tarifa (la misma del sitio de pruebas, a la par de Uber Connect): 2 USD de base + 0,90 USD por km + 0,10 USD por minuto, mínimo 6 USD, sin cargo por cancelar en los primeros 2 minutos, 5 minutos de espera gratis.
- Valor máximo del paquete: 100 USD, igual que Uber Connect. Sin seguro aparte (Uber Connect tampoco lo ofrece).
- Cobra con Stripe EN VIVO: es dinero real. Los topes del piloto (por pedido y por día) siguen puestos.

## Participantes del piloto

- La cuenta de administrador de Divoox y las tres cuentas del revisor de las tiendas (cliente, Driver, restaurante).
- Para sumar a alguien: superadmin → Piloto (o la tabla `piloto_participantes`).

## Divoox Rewards — modo piloto

- Variable `REWARDS_MODO=piloto` en el sitio de producción.
- Ajustes (como DoorDash: el nivel da prioridad; el premio en dinero es chico y con tope):
  - prioridad de despacho por nivel: encendida;
  - premio: 5 % del margen real de las 100 entregas que cuentan, con tope de 20 USD por premio;
  - presupuesto: 100 USD por ciudad y por mes (octubre y noviembre, Miami y Novi).
- El nivel aparece cuando el repartidor del piloto tiene al menos una entrega terminada (el reloj lo calcula cada pocas horas).

## Lo que NO se encendió y por qué

- **Moto y Carro:** llevan pasajeros. En Florida y Michigan hace falta el permiso de empresa de transporte por app (TNC) y su seguro comercial; el código no los deja ni en piloto (`SERVICIOS_PILOTO`). Es una decisión legal, no técnica.
- **Mercado, Farmacia y Licores:** se pueden encender en piloto igual que Envíos cuando haya tiendas reales cargadas en producción.

## Cómo se apaga

- Envíos: borrar la fila de `servicios_piloto` (servicio `envios`).
- Rewards: variable `REWARDS_MODO=apagado` y republicar.

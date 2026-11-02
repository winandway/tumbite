# Comisión del prepago de conductores en Venezuela y Colombia (2 nov 2026)

Pedido: Richard dio el permiso comercial y legal para encender el prepago de conductores por país
(chat del 2 nov 2026: «Permiso comercial y legal por país para encender el prepago de los conductores, Sí»).

## Lo que cobra el mercado al conductor [DOC, prensa pública]

| App          | País      | Comisión al conductor                                                 | Fuente                                                                                                                                                      |
| ------------ | --------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inDrive      | México    | 9,9 % a 12 % por viaje                                                | Expansión, 26 feb 2026: https://expansion.mx/tecnologia/2026/02/26/indrive-reporta-ingresos-30-mayores-para-conductores                                     |
| inDrive      | Colombia  | 9 % (fecha del artículo sin confirmar); otros reportes, cerca de 12 % | enter.co: https://www.enter.co/?p=560333 · Pulzo: https://www.pulzo.com/economia/cuanto-gana-conductor-indrive-100000-pesos-diarios-mas-PP3818897A          |
| Uber, Cabify | Colombia  | 10 % a 25 %                                                           | enter.co (mismo artículo)                                                                                                                                   |
| Ridery       | Venezuela | 25 % (el conductor recibe el 75 %)                                    | Valora Analitik: https://www.valoraanalitik.com/?p=559884                                                                                                   |
| Yummy Rides  | Venezuela | sin porcentaje público                                                | Bloomberg Línea: https://www.bloomberglinea.com/latinoamerica/venezuela/startup-venezolana-insiste-en-mas-rentabilidad-con-nuevo-servicio-para-yummy-rides/ |

[NV] Ninguna de estas apps publica hoy una tabla oficial vigente; las cifras salen de prensa y pueden haber cambiado.

## Decisión

- **10 % del valor del viaje o del envío**, descontado del saldo prepago del conductor, en Moto (ride), Carro (car) y
  Envíos (express), en Venezuela (VES) y Colombia (COP). Es el piso del mercado (como inDrive) para entrar
  compitiendo; se sube desde el panel si hace falta.
- **EE. UU.:** sigue con Stripe Connect, sin prepago de conductores.
- **Comida y Mercado:** siguen con la comisión del país del cobro directo (`comisionPb`), sin política nueva.
- Solo rige donde el país y el servicio estén encendidos. Moto y Carro siguen apagados en producción hasta la
  aprobación legal del transporte de pasajeros y el seguro del pasajero (eso es aparte del prepago).

# Divoox Moto · Resultados de las fases M1 a M10

**Fecha:** 28 oct 2026 · **Rama:** `fase-moto-1` · **Plan:** `docs/PLAN-MOTO-PASAJEROS.md` · **Investigación:** `docs/investigaciones-rea/2026-10-28-moto-fuentes-publicas.md` y `docs/investigaciones-rea/2026-10-28-moto-rea.md` (con su paquete de evidencia REA).

## En una frase

Moto de pasajeros funciona de punta a punta en el sitio de pruebas. El pasajero pide con precio fijo y el conductor recibe la oferta, recoge con código, lleva y cobra en efectivo. Hay emergencia, viaje compartido, comisión del prepago, calificación y panel. **En producción sigue apagado** hasta que Richard lo ordene con la aprobación legal.

## Qué quedó hecho

| Fase | Qué hace                                                                                                                                                                                                                                                                           | Candado                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| M1   | Tarifa por ciudad, versionada y con auditoría. Cotización con precio fijo guardada en el servidor por 5 minutos. Con REA se sumaron el cargo fijo, la copia de la tarifa en cada cotización y la ruta estimada por ciudad.                                                         | C-MOTO-SOLO-PRUEBAS, C-VIAJE-PRECIO-FIJO |
| M2a  | **Fallo encontrado con REA en el código de la Fase 3:** «Llegué», «No se presentó» y el código de inicio no tenían reglas. Ahora hay radio de llegada con ubicación reciente, espera gratis cumplida y un tope de 5 intentos para el código.                                       | C-VIAJE-PASOS-REALES                     |
| M2   | Pedir con una cotización de un solo uso y un viaje activo por pasajero. Cancelar es gratis mientras se busca y durante la ventana desde la asignación; después hay cargo, que en efectivo queda como deuda. A los 10 minutos sin conductor, el viaje se cierra «sin conductor».    | C-VIAJE-PEDIR-CANCELAR                   |
| M3   | La oferta trae la ganancia, la recogida, el destino, la duración y la forma de pago. Se despacha al pedir, al rechazar, al soltar y cuando el pasajero consulta, porque el sitio no tiene reloj propio.                                                                            | C-OFERTA-COMPLETA                        |
| M4   | App del Driver: tarjeta de oferta y viaje activo paso a paso (navegación, Llegué con la posición del momento, espera gratis, casco, código, iniciar, terminar, no se presentó y cuánto cobrar).                                                                                    | —                                        |
| M5   | App del cliente: pedir Moto con precio fijo, que se vuelve a cotizar solo antes de vencer. El pasajero sigue la búsqueda, ve al conductor con su moto y su placa, el mapa y su código. Puede cancelar sabiendo antes cuánto cuesta y paga en efectivo. Lo escrito no se pierde.    | —                                        |
| M6   | Botón de emergencia en las dos apps: queda registrado, avisa al equipo por correo y llama al número del país. Viaje compartido en vivo con un enlace secreto que se apaga al terminar; la página no aparece en buscadores ni en caché.                                             | C-VIAJE-SEGURIDAD                        |
| M7   | La comisión del prepago se aparta al aceptar; sin saldo no se acepta. Se cobra al terminar y se devuelve si el viaje no se hace. La espera se cobra por minuto y las deudas pasan a la cuenta final. La conciliación aparece en la salud. Sin política vigente, no se aparta nada. | C-VIAJE-COMISION                         |
| M8   | Calificación de los dos lados, una sola vez. La del pasajero cuenta en el promedio del conductor.                                                                                                                                                                                  | C-VIAJE-CALIFICACION                     |
| M9   | Superadmin «Moto · Viajes»: emergencias abiertas para atender, viajes recientes y tarifa por ciudad.                                                                                                                                                                               | —                                        |
| M10  | Viaje de punta a punta en el sitio de pruebas en cada publicación, más la misma prueba en local.                                                                                                                                                                                   | —                                        |

## Fallos reales encontrados y corregidos en el camino

1. **Pasos del conductor sin reglas** (con REA, comparando con Namma Yatri): un conductor podía cobrar un «no se presentó» sin haber ido. Corregido con prueba en rojo.
2. **Clave de idempotencia compartida entre conductores:** si dos conductores mandaban la misma clave para el mismo viaje, el servidor fallaba con un error 500. Ahora la clave incluye al conductor.
3. **La prueba interna del sitio de pruebas exigía Moto apagada también allí:** se adaptó para que compare contra lo implementado en cada entorno.

## Cómo se comprobó

- Todo el proyecto en verde: tipos, estilo, 1.070 pruebas con cobertura, compilación y auditoría de seguridad.
- Cada candado se comprobó en rojo: se rompió a propósito, la prueba falló, y se restauró.
- En el sitio de pruebas, en cada publicación, corre `scripts/staging/probar-moto.mjs`. Hace cotizar, pedir y recibir la oferta. Luego aceptar, compartir, llegar, probar un código equivocado y el correcto, terminar y calificar. Al final revisa la salud en verde, limpia y comprueba, solo leyendo, que en producción Moto sigue «muy pronto».

## Qué NO se hizo todavía (queda en la fila)

- Pago con tarjeta de los viajes (Stripe en modo prueba) y propina.
- Que el cargo de cancelación en efectivo vaya al conductor afectado. Hoy lo cobra el conductor del siguiente viaje.
- Contactos de emergencia, aviso si el viaje se desvía, límite de horas, pausa del chat.
- Interruptores por ciudad: código solo de noche, selfie con casco.
- Oferta del pasajero tipo inDrive.
- Carro con lo mismo.
- Guías públicas en Docs: se escriben al encender Moto, para no prometer algo que el público no puede usar.

## Lo que solo decide Richard

1. Primer país de Moto y su aprobación legal (Colombia es zona gris, Venezuela no tiene norma, Florida está frenada por el seguro).
2. Aseguradora para el seguro de accidentes del pasajero.
3. Tarifas y comisión reales por ciudad (hoy hay valores de prueba).
4. La orden de encender Moto en producción.

# Divoox · Plan de lanzamiento en producción controlada (piloto)

Fecha: 30 de octubre de 2026. Origen: directiva de dirección «Lanzamiento real en producción
controlada», traída por Richard. País: EE. UU. (Miami) para el piloto; el código sirve a todos.

Regla de trabajo nueva: construir → probar en producción controlada → medir → corregir. Las
funciones terminadas no se quedan en modo sombra. Se mantienen las protecciones contra cobros
duplicados, pagos no autorizados, pérdida de fondos, accesos indebidos y datos corruptos; todo lo
de dinero lleva trazabilidad y conciliación, y cada cambio grande se puede revertir rápido.

Se pide aprobación solo para: comprometer fondos (presupuesto de premios), operaciones
irreversibles y abrir el piloto a personas no autorizadas.

## 1. La pieza que falta primero: el piloto

Hoy un servicio está encendido o apagado para todo un país. No existe forma de encenderlo solo para
las personas del grupo de prueba. Sin eso no se puede abrir nada en producción sin abrirlo al público.

- **P1. Lista de participantes del piloto** (cliente, restaurante, repartidor, empresa), administrada
  desde el superadmin, con alta y baja en un clic y registro de quién la cambió.
- **P2. Servicios por piloto:** cada servicio (Moto, Carro, Envíos, Mercado, Farmacia, Licores) puede
  estar «apagado», «solo piloto» o «público», por ciudad. «Solo piloto» lo ven y lo usan únicamente
  los participantes; el resto sigue viendo «muy pronto».
- **P3. Límites del piloto:** monto máximo por pedido y por día para participantes, para que un error
  no cueste más que una cifra pequeña.

## 2. Divoox Rewards a producción controlada

Lo que ya está listo (Fase 2): motor de reputación común (0 a 100, cinco componentes), ventana de 100
unidades ponderadas, Flex sin que una ruta domine, muestras pequeñas, elegibilidad aparte,
antifraude por servicio, estados de premio sin pagos, idempotencia con concurrencia, presupuesto
reservado, cálculo diario, y la limpieza corregida el 30 oct.

Lo que falta conectar, en este orden:

| Paso | Qué                                                                                                                                                             | Resultado para el repartidor del piloto                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| R1   | Llevar el motor a producción y reemplazar el nivel viejo por puntos (Bronce con 490 puntos para Plata) por el nivel de reputación                               | Ve su nivel real, su puntaje y qué le falta, en Driver                |
| R2   | Pantalla «Mi nivel» en Driver: puntaje, los cinco componentes con su explicación, experiencia por servicio, progreso al siguiente nivel y al siguiente hito     | Entiende por qué tiene su puntaje y cómo subir                        |
| R3   | Panel de Rewards en el superadmin: umbrales, pesos, hitos, porcentaje del margen, presupuesto por ciudad y mes, y encender o apagar, todo sin publicar de nuevo | El equipo ajusta con los resultados del piloto                        |
| R4   | Prioridad de despacho configurable por nivel (peso 0 = apagada), solo para participantes                                                                        | Los mejores reciben primero las ofertas, como en Platinum de DoorDash |
| R5   | Premio variable: porcentaje configurable del margen de contribución real de las entregas que cuentan (antifraude incluido), con tope por premio y por mes       | El premio sale de lo que de verdad dejó su trabajo                    |
| R6   | Pago real del premio a la billetera del repartidor, con su movimiento, su evento y la conciliación; nunca más que el presupuesto reservado                      | Cobra el premio y lo retira como sus ganancias                        |
| R7   | Apelaciones: el repartidor pide revisar una nota o un incidente; soporte lo resuelve desde su bandeja                                                           | Tiene a quién reclamar                                                |
| R8   | Guías de Docs en español e inglés con capturas reales                                                                                                           | Sabe cómo funciona                                                    |

Lo único que necesita aprobación: **el presupuesto de premios del piloto** (cuánto dinero, por mes) y
el porcentaje inicial del margen. Mientras no esté, R6 se construye con presupuesto cero: todo
funciona y se ve, pero no se paga nada.

## 3. Todo lo que falta del lado del código para que las apps funcionen completas

1. El piloto (P1 a P3).
2. Rewards a producción (R1 a R8).
3. Encender para el piloto en producción lo que ya está construido en pruebas: Moto, Carro, Envíos de
   persona a persona, Mercado, Farmacia y Licores (cada uno ya pasa su viaje o compra de punta a
   punta en pruebas).
4. Monetización prepago: unificar el cobro de Comida con la capa de políticas y enchufar Express,
   Tiendas y Flex conductor (requisito del 27 oct). Se enciende por mercado.
5. Publicar los arreglos del repaso del 30 oct (estadísticas, textos de Driver, lecturas que se
   pierden), que están pasando por el sitio de pruebas.
6. GPS en segundo plano en Driver mientras hay un pedido, cuando Google apruebe la revisión actual.
7. Subir a Google Play, en una sola versión por app, todo lo acumulado, en cuanto Google apruebe.
8. Compilar y enviar las tres apps a Apple en cuanto la cuenta esté activa.
9. Fichas de las tiendas con capturas reales (al final, con las pantallas cerradas).

Lo que no es código y espera a Richard (no frena lo de arriba): presupuesto de premios, Twilio,
Checkr, Apple Pay y Google Pay en Stripe, cuenta de Apple, la compra real de 1 dólar, y lo legal de
Moto y Carro por país.

## 4. Orden de ejecución

P1 → P2 → P3 → R1 → R2 → R3 → R4 → R5 → R6 (con presupuesto cero) → R7 → R8 → servicios en piloto →
monetización prepago. Cada paso: prueba en rojo, construir, sitio de pruebas, producción, verificación
breve. Cada cambio dice a qué país aplica.

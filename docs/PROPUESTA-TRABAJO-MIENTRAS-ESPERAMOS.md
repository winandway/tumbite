# Qué hacer durante las 9 horas de espera

**Para:** el manager del proyecto Tumbite
**Fecha:** 16 de octubre de 2026, mediodía en Michigan
**Decisión que se pide:** aprobar qué trabajo avanza mientras esperamos la conciliación del 16. Esa conciliación llega entre las 8:00 y las 9:30 p. m. de Michigan.

## Por qué esperamos y por qué no hay que quedarse parados

El código del reloj seguro está listo y probado. Para publicarlo **sin ninguna excepción** hay que esperar a que la revisión diaria del dinero del 16 de octubre corra sola esta noche. Eso es una espera de calendario, no de trabajo.

La vigilancia sigue en segundo plano, solo leyendo: avisa en cuanto aparezca la conciliación. Mientras tanto, el equipo puede avanzar en todo lo que no toque producción.

**La única limitación real:** el sitio de pruebas es uno solo y guarda una versión a la vez. Por eso el trabajo nuevo se construye **encima de la rama del reloj seguro**. Así, el sitio de pruebas siempre tiene lo que se va a publicar. Antes de publicar el reloj, se vuelve a dejar el sitio de pruebas con la rama del reloj sola: son 30 minutos.

## Dónde estamos, fase por fase

| #   | Fase                                   | Qué es                                                                                                                     | Estado                                                                                                     |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0   | Seguridad del dinero                   | Retiros sin doble pago, anulaciones verificadas, retiros apagados por defecto                                              | ✅ **En producción** desde el 16 oct                                                                       |
| 1   | Base de varios servicios               | Catálogo de servicios, vehículos, documentos y habilitaciones. Moto y Carro bloqueados                                     | ✅ **En producción** desde el 16 oct                                                                       |
| 2   | Tiempo real                            | Conexión en vivo, ubicación por lotes, reloj de Cloudflare                                                                 | ✅ Código en producción, **apagado**. Los trabajadores de Cloudflare funcionan solo en el sitio de pruebas |
| 3   | Exclusividad y asignación              | Un conductor nunca tiene dos trabajos a la vez y dos conductores nunca se llevan el mismo                                  | ✅ **En producción** desde el 16 oct (versión `36f4e35`)                                                   |
| —   | Reloj seguro                           | Las tareas del reloj no se frenan entre sí y la salud lo vigila                                                            | 🟡 **Listo y probado.** Se publica esta noche, cuando cuadre la conciliación                               |
| —   | Reloj de producción en Cloudflare      | Que el reloj corra cada minuto en producción, en vez de cada 2 a 5 horas                                                   | 🟡 Espera su autorización aparte                                                                           |
| 4   | El reparto de Comida usa la base nueva | Vehículos de los repartidores actuales, el reparto revisa vehículo y seguro, pantallas del repartidor, seguimiento en vivo | ⏸️ No empezada (orden de Richard)                                                                          |
| 5   | Moto y Carro, apagados al público      | Pedir viaje, precio, viaje en curso, cobro y emergencia                                                                    | ⏸️ No empezada. Necesita la aprobación legal de pasajeros                                                  |

Entre el reloj y la Fase 4 va el **hito 1 del cliente**, ya aprobado: arreglar el catálogo que desaparece y la pantalla de carga de la sesión.

## Qué se puede hacer en estas 9 horas (sin tocar producción)

Ordenado por importancia para lanzar Comida:

| #   | Trabajo                                                                                                                                                                                                    | Tiempo      | Riesgo                        | ¿Necesita algo de Richard?              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------- | --------------------------------------- |
| 1   | **Hito 1 del cliente:** catálogo estable y sesión con tiempo máximo. Ya está diseñado y aprobado. Se construye en su rama, encima del reloj seguro, con sus 13 pruebas, y se valida en el sitio de pruebas | 6 a 8 horas | Bajo: solo la app del cliente | Para publicar, sí. Para construirlo, no |
| 2   | **Versionado visible** en la web, el panel y las apps: el mismo número en todas, puesto solo en cada publicación                                                                                           | 1 a 2 horas | Muy bajo                      | No                                      |
| 3   | **Diseño de las imágenes en WebP:** dónde se convierten, tamaños, calidad, qué se conserva como prueba y cuánto cuesta. Solo el documento, sin código                                                      | 1 hora      | Ninguno                       | Decidir la opción                       |
| 4   | **Plan detallado de la Fase 4** (sin código): migraciones de vehículos sobre los repartidores reales, cómo se enciende el reparto nuevo con su interruptor, y pruebas                                      | 1 a 2 horas | Ninguno                       | Aprobar el plan                         |
| 5   | **Excepciones auditables del dinero:** que la salud no esconda discrepancias viejas (la del 15 y los 10 pedidos de prueba de Novi)                                                                         | 2 a 3 horas | Bajo                          | Para publicar, sí                       |

**No entran en esta propuesta:**

- publicar nada en producción;
- activar el reloj de Cloudflare;
- programar la Fase 4 o la Fase 5;
- cualquier operación con dinero real.

## Recomendación

**Hacer el 1 y el 2 en estas horas**, en una sola rama encima del reloj seguro y validados en el sitio de pruebas:

- el hito 1 es el siguiente paso del plan aprobado, y es lo que Richard va a poder probar en su teléfono;
- el versionado es corto, y sirve justo para comprobar en el teléfono qué versión está viendo.

Si queda tiempo, el 3 y el 4 como documentos.

**Cómo queda la noche:**

1. Cuando llegue la conciliación, se comprueba que cuadra.
2. Se deja el sitio de pruebas con el reloj solo, unos 30 minutos.
3. Se repiten los controles de producción.
4. Se pide la autorización para publicar el reloj seguro.
5. El hito 1 se publica **después** del reloj, con su propia autorización, como manda el orden.

**Nada de esto cambia el orden aprobado de publicación:** Fase 3 (ya está) → reloj seguro → reloj de producción → catálogo y sesión → validar el MVP de Comida.

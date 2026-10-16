# Auditoría del MVP de Comida

**Fecha:** 16 de octubre de 2026, 21:30 UTC.

**Fuentes:**

- el código de `main` (versión en producción `36f4e35`) y de las ramas de trabajo;
- la salud de producción leída en vivo;
- la base de producción, solo lectura;
- `docs/ROADMAP.md`, `PENDIENTES.md` y `VERIFICAR-PAGOS.md` (varias líneas de esos dos últimos estaban viejas: aquí manda lo comprobado hoy);
- el plan v2.

## Qué es el MVP

**Comida en Miami, lanzamiento cerrado.** Pocos restaurantes y repartidores de confianza, con dinero real.

El MVP está completo cuando se cumple todo esto:

1. un cliente pide y paga desde la app instalada de la tienda;
2. el restaurante recibe y prepara;
3. un repartidor lo lleva;
4. el dinero llega a cada uno;
5. cada paso está probado con dinero real.

Moto, Carro y las Fases 4 y 5 quedan fuera.

## Foto de hoy

| Indicador                                               | Estado                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Producción (tumbite.com)                                | Versión `36f4e35`, con las Fases 0, 1 y 3 publicadas el 16 oct                                 |
| Salud de producción                                     | Todo en verde **salvo «dinero»**, en rojo solo por la conciliación conocida del 15 oct         |
| Conciliación del 16 oct                                 | Todavía no corrió (corre después de las 00:00 UTC)                                             |
| Datos en producción                                     | 5 restaurantes aprobados, 24 repartidores registrados, 11 pedidos entregados, 4 zonas          |
| Sitio de pruebas                                        | Integración temporal (reloj seguro + Hito 1 + versionado + fallos críticos): **todo en verde** |
| Circuito de pagos con dinero real                       | 🔴 **NO probado** con el flujo actual (autorizar y capturar dentro de la app)                  |
| Apps en las tiendas                                     | 🔴 **NO**: faltan las cuentas de Apple, Google y Expo de la empresa                            |
| Prueba en la calle (cliente + restaurante + repartidor) | 🔴 **NO hecha**                                                                                |

Leyenda:

- ✅ hecho y en producción;
- 🟢 hecho y probado, en una rama, esperando publicar;
- 🟡 a medias, o hecho sin probar con dinero real;
- ❌ falta;
- 👤 depende de Richard;
- 🤖 lo hace la IA.

En la última columna, **«MVP»** quiere decir que bloquea el lanzamiento y **«después»** que puede esperar.

## 1. Infraestructura y publicación

| #    | Pieza                                                       | Estado | Detalle                                                                                | Quién        | ¿Bloquea? |
| ---- | ----------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- | ------------ | --------- |
| 1.1  | Producción en YaDominios Cloud, dominio tumbite.com         | ✅     | En vivo                                                                                | —            | —         |
| 1.2  | Sitio de pruebas staging.tumbite.com, con su base           | ✅     | Stripe en modo prueba cargado (S11 y S12 en verde)                                     | —            | —         |
| 1.3  | Publicación automática con semáforo                         | ✅     | verify → pruebas → producción, con la prueba de humo                                   | —            | —         |
| 1.4  | Verificador de publicación (antes y después)                | ✅     | Excepción única: la conciliación del 15                                                | —            | —         |
| 1.5  | Respaldo diario de la base                                  | ✅     | 30 días                                                                                | —            | —         |
| 1.6  | Reloj (tareas automáticas)                                  | 🟡     | En producción corre con GitHub, cada 2 a 5 horas (impuntual)                           | —            | MVP       |
| 1.7  | **Reloj seguro** (las tareas no se frenan entre sí)         | 🟢     | Rama `fase-reloj-seguro`, validada; espera la conciliación del 16                      | 👤 autorizar | MVP       |
| 1.8  | **Reloj de Cloudflare en producción** (cada minuto)         | ❌     | Funciona en pruebas; en producción espera autorización aparte                          | 👤 autorizar | MVP       |
| 1.9  | Versión visible en la web, el panel, el servidor y las apps | 🟢     | Rama `versionado-visible`                                                              | 👤 autorizar | después   |
| 1.10 | Tiempo real (Durable Objects) conectado a las apps          | ❌     | El Worker existe y está probado; ninguna app abre la conexión (hoy consultan cada 5 s) | 🤖           | después   |
| 1.11 | Bundle web de la app del cliente partido                    | ❌     | Un solo archivo de unos 3 MB                                                           | 🤖           | después   |

## 2. Cuentas y acceso

| #   | Pieza                                               | Estado | Detalle                                                          | Quién        | ¿Bloquea? |
| --- | --------------------------------------------------- | ------ | ---------------------------------------------------------------- | ------------ | --------- |
| 2.1 | Registro, entrar, salir, ojito en la contraseña     | ✅     |                                                                  | —            | —         |
| 2.2 | Recuperar contraseña y confirmar correo             | ✅     | Correo del dominio activo                                        | —            | —         |
| 2.3 | **Sesión con tiempo máximo** (no se queda cargando) | 🟢     | Rama `hito1-catalogo-sesion`, probada en el sitio de pruebas     | 👤 autorizar | MVP       |
| 2.4 | Borrar la cuenta (exigido por Apple)                | ✅     |                                                                  | —            | —         |
| 2.5 | Escudo anti-robots (Turnstile)                      | ❌     | Opcional: el login ya tiene límite de intentos                   | 👤 claves    | después   |
| 2.6 | Entrar con Google, Apple o teléfono                 | ❌     |                                                                  | 🤖           | después   |
| 2.7 | Cuenta de administrador «Soporte Tumbite»           | 🟡     | Variables puestas; confirmar que la cuenta existe y tiene el rol | 👤 + 🤖      | MVP       |

## 3. App del cliente

| #    | Pieza                                                           | Estado | Detalle                                                                      | Quién              | ¿Bloquea? |
| ---- | --------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- | ------------------ | --------- |
| 3.1  | Inicio, servicios, ofertas (con «Ejemplo») y restaurantes cerca | ✅     | Diseño aprobado                                                              | —                  | —         |
| 3.2  | **Catálogo estable** (no desaparece)                            | 🟢     | Rama `hito1-catalogo-sesion`; en producción todavía puede desaparecer        | 👤 autorizar       | MVP       |
| 3.3  | Menú, modificadores, horarios, «abierto ahora»                  | ✅     |                                                                              | —                  | —         |
| 3.4  | Carrito, dirección con pin en el mapa                           | ✅     |                                                                              | —                  | —         |
| 3.5  | Dirección con autocompletado                                    | ❌     | Hace falta la llave de Google Places                                         | 👤 llave           | después   |
| 3.6  | **Pago dentro de la app**, autorizar y capturar al entregar     | 🟡     | Construido y probado con Stripe de prueba; **🔴 sin compra real**            | 👤 compra de 1 USD | MVP       |
| 3.7  | Tarjeta guardada para la próxima compra                         | 🟡     | Construido; sin probar con dinero real                                       | 👤                 | MVP       |
| 3.8  | Apple Pay y Google Pay                                          | 🟡     | Construido; faltan los interruptores en Stripe y el identificador de Apple   | 👤                 | después   |
| 3.9  | Seguimiento con mapa, hora «a más tardar», avisos «casi llega»  | ✅     | Consulta cada 5 s                                                            | —                  | —         |
| 3.10 | Avisos al celular                                               | 🟡     | Construidos; necesitan la cuenta de Expo de la empresa y las apps instaladas | 👤 Expo            | MVP       |
| 3.11 | Chat con el repartidor                                          | ✅     |                                                                              | —                  | —         |
| 3.12 | SMS de respaldo y llamadas con número oculto                    | ❌     | Construidos con Twilio simulado; apagados en producción                      | 👤 Twilio          | después   |
| 3.13 | Cancelar antes de que acepten, con devolución                   | 🟡     | Funciona; el arreglo de la autorización retenida está en `fallos-criticos`   | 👤 autorizar       | MVP       |
| 3.14 | Propina después de entregar                                     | 🟡     | El arreglo «solo si Stripe cobró» está en `fallos-criticos`                  | 👤 autorizar       | MVP       |
| 3.15 | Cambio de dirección con recálculo                               | 🟡     | Sin probar contra Stripe cuando sube el monto autorizado (Entrega 1b)        | 🤖                 | MVP       |
| 3.16 | Recoger en el local, PIN en mano, en la puerta o en mano        | ✅     |                                                                              | —                  | —         |
| 3.17 | Regalos, niveles, calificaciones, quejas                        | ✅     |                                                                              | —                  | —         |
| 3.18 | Soporte por WhatsApp                                            | ❌     | Cableado; falta el número                                                    | 👤 número          | MVP       |
| 3.19 | Botón de agregar que explica qué falta y recargo por opción     | ❌     | Visto en DoorDash (Entrega 1c)                                               | 🤖                 | después   |

## 4. Restaurante (app y panel)

| #    | Pieza                                                               | Estado | Detalle                                                                        | Quién       | ¿Bloquea? |
| ---- | ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ | ----------- | --------- |
| 4.1  | Alta, lista de activación, aprobación del administrador             | ✅     |                                                                                | —           | —         |
| 4.2  | Menú con fotos, modificadores y horarios                            | ✅     | En la app, sin editar opciones (en el panel sí)                                | —           | —         |
| 4.3  | Recibir pedidos con alarma y semáforo                               | ✅     |                                                                                | —           | —         |
| 4.4  | Aceptar con minutos, listo, plato agotado, rechazar, cocina ocupada | ✅     | ⚠️ La app ofrece 10, 15, 20, 30 y 45 minutos; el panel, 10, 20 y 30 (unificar) | 🤖          | después   |
| 4.5  | Ver venir al repartidor, QR, confirmar la foto de la recogida       | ✅     |                                                                                | —           | —         |
| 4.6  | Pausa automática si la tableta pierde la señal (como DoorDash)      | ❌     | Entrega 3 del plan v2                                                          | 🤖          | MVP       |
| 4.7  | Billetera y alta de Stripe Connect (página de Stripe)               | ✅     | Probada solo en modo prueba                                                    | —           | —         |
| 4.8  | Alta de Connect **integrada** en la app y el panel                  | ❌     | Decisión del 15 oct                                                            | 🤖          | después   |
| 4.9  | Retiros a banco                                                     | 🟡     | Fase 0 publicada, retiros **apagados**; S11 en verde con Stripe de prueba      | 👤 encender | MVP       |
| 4.10 | Impresora de cocina y cajas registradoras                           | ❌     |                                                                                | 🤖          | después   |

## 5. Repartidor

| #    | Pieza                                                           | Estado | Detalle                                                                 | Quién           | ¿Bloquea? |
| ---- | --------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- | --------------- | --------- |
| 5.1  | Registro, identidad con selfie, selfie al azar                  | ✅     |                                                                         | —               | —         |
| 5.2  | Antecedentes con Checkr                                         | ❌     | Construido; falta la cuenta                                             | 👤 Checkr       | MVP       |
| 5.3  | Conectarse, zonas, ubicación con dos lecturas                   | ✅     | 👤 falta probar «Conectarme» en tumbite.com con una cuenta suya         | 👤              | MVP       |
| 5.4  | Ofertas con reloj, oferta abierta con bono, rechazo sin castigo | ✅     |                                                                         | —               | —         |
| 5.5  | Exclusividad (nunca dos trabajos a la vez)                      | ✅     | Fase 3 en producción                                                    | —               | —         |
| 5.6  | Recogida con foto y QR; entrega con foto o PIN; cola sin señal  | ✅     |                                                                         | —               | —         |
| 5.7  | Pedidos agrupados del mismo restaurante                         | 🟡     | Funcionan; los arreglos de orden y de soltar están en `fallos-criticos` | 👤 autorizar    | MVP       |
| 5.8  | **Ubicación en segundo plano**                                  | ❌     | Necesita la compilación propia de la app y un video para Apple          | 🤖 + 👤 cuentas | MVP       |
| 5.9  | Mapa en Android                                                 | ❌     | Falta la llave de Google Maps para Android                              | 👤 llave        | MVP       |
| 5.10 | Billetera y retiros                                             | 🟡     | Igual que 4.9                                                           | 👤              | MVP       |
| 5.11 | Edad por estado; licencia y seguro según el vehículo (M6)       | ❌     |                                                                         | 🤖              | después   |

## 6. Dinero

| #    | Pieza                                                                                    | Estado | Detalle                                                                       | Quién        | ¿Bloquea? |
| ---- | ---------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- | ------------ | --------- |
| 6.1  | Cuatro bolsillos (restaurante, repartidor, plataforma, complemento)                      | ✅     | Al centavo                                                                    | —            | —         |
| 6.2  | Conciliación diaria con canario                                                          | ✅     | «Dinero» en rojo por la del 15 (conocida); se espera verde con la del 16      | —            | —         |
| 6.3  | **Los cinco fallos críticos** (aviso perdido, autorización retenida, propina, agrupados) | 🟢     | Rama `fallos-criticos`, con el cierre de seguridad; sitio de pruebas en verde | 👤 autorizar | MVP       |
| 6.4  | Idempotencia persistente de los avisos de Stripe                                         | 🟢     | En la misma rama                                                              | 👤 autorizar | MVP       |
| 6.5  | **Compra real de 1 USD** + cancelar otra de 1 USD                                        | ❌     | Lo único que falta para dar los pagos por probados                            | 👤           | MVP       |
| 6.6  | Captura al entregar con dinero real; devolución parcial por plato agotado                | ❌     | Se prueba en la prueba en la calle                                            | 👤 + 🤖      | MVP       |
| 6.7  | Retiro real a banco                                                                      | ❌     | Después de encender los retiros                                               | 👤           | MVP       |
| 6.8  | Retiro mínimo (hoy 1 USD; recomendado 10)                                                | ❌     | Decisión de dinero                                                            | 👤           | MVP       |
| 6.9  | Nombre del negocio en el cobro (hoy «Windoce, LLC»)                                      | ❌     |                                                                               | 👤           | después   |
| 6.10 | Impuesto de ventas de Florida y 1099 de repartidores                                     | ❌     | Contador                                                                      | 👤           | MVP       |
| 6.11 | Cancelar después de «aceptado»: ¿devolución parcial o nada?                              | ❌     | Decisión de negocio                                                           | 👤           | después   |
| 6.12 | Circuit breaker hacia Stripe                                                             | ❌     | Entrega 1b                                                                    | 🤖           | después   |

## 7. Administración y operación

| #   | Pieza                                                           | Estado | Detalle                                        | Quién                 | ¿Bloquea? |
| --- | --------------------------------------------------------------- | ------ | ---------------------------------------------- | --------------------- | --------- |
| 7.1 | Superadmin: restaurantes, zonas, verificación, pedidos en curso | ✅     |                                                | —                     | —         |
| 7.2 | Manager con reglas (recordatorios, cancelación a los 6 min)     | ✅     |                                                | —                     | —         |
| 7.3 | Transiciones del pedido forzadas por la base                    | ❌     | Entrega 1 del plan v2                          | 🤖                    | MVP       |
| 7.4 | Estados intermedios del repartidor con nombres estándar         | ❌     | Entrega 2                                      | 🤖                    | después   |
| 7.5 | Permisos finos y doble aprobación en el panel                   | ❌     | Obligatorio antes de pasajeros; no para Comida | 🤖                    | después   |
| 7.6 | Limpiar los datos de prueba de producción                       | ❌     | Orlando y Tampa de prueba, cuentas de prueba   | 👤 decide, 🤖 ejecuta | MVP       |
| 7.7 | Zona de pruebas de Novi                                         | ❌     | Decisión pendiente                             | 👤                    | MVP       |
| 7.8 | Llave del sitio de pruebas que pasó por el chat                 | ❌     | Revocarla y crear otra                         | 👤                    | MVP       |

## 8. Tiendas y lanzamiento

| #   | Pieza                                                           | Estado | Detalle                                                        | Quién      | ¿Bloquea? |
| --- | --------------------------------------------------------------- | ------ | -------------------------------------------------------------- | ---------- | --------- |
| 8.1 | Cuenta de Apple Developer de Windoce LLC                        | ❌     | Guía con croquis en `docs/Guia-publicar-apps-Apple-Google.pdf` | 👤         | MVP       |
| 8.2 | Cuenta de Google Play de Windoce LLC                            | ❌     |                                                                | 👤         | MVP       |
| 8.3 | Organización de Expo (EAS) de la empresa                        | ❌     |                                                                | 👤         | MVP       |
| 8.4 | Abrir Xcode una vez en la Mac                                   | ❌     |                                                                | 👤         | MVP       |
| 8.5 | Compilar las tres apps y subirlas (TestFlight y prueba interna) | ❌     | Se hace al tener 8.1 a 8.3                                     | 🤖         | MVP       |
| 8.6 | Fichas de tienda, capturas y textos en los dos idiomas          | ✅     | Capturas automáticas listas                                    | —          | —         |
| 8.7 | Legales: privacidad, términos, borrar cuenta                    | ✅     | Falta la revisión del abogado                                  | 👤 abogado | MVP       |
| 8.8 | Marca «Tumbite» ante la oficina de marcas                       | ❌     |                                                                | 👤         | después   |
| 8.9 | Promociones de lanzamiento                                      | ❌     | Decisión de dinero                                             | 👤         | después   |

## 9. Calidad y pruebas

| #   | Pieza                                                                                 | Estado | Detalle                           | Quién   | ¿Bloquea? |
| --- | ------------------------------------------------------------------------------------- | ------ | --------------------------------- | ------- | --------- |
| 9.1 | Verificación completa en cada cambio (tipos, estilo, pruebas, compilación, auditoría) | ✅     | 555 pruebas en la rama de fallos  | —       | —         |
| 9.2 | Recorrido completo de Comida en inglés y español en el sitio de pruebas               | ✅     | Corre en cada rama                | —       | —         |
| 9.3 | Candados documentados                                                                 | ✅     | `CANDADOS.md`                     | —       | —         |
| 9.4 | **Prueba en la calle** con cliente, restaurante y repartidor                          | ❌     | `docs/PLAN-DE-PRUEBA-EN-CALLE.md` | 👤 + 🤖 | MVP       |
| 9.5 | Metodología REA para cada función nueva                                               | ✅     | En las instrucciones del proyecto | —       | —         |

## Ruta crítica al MVP (en orden)

| Paso | Qué                                                                                                 | Quién                   | Depende de            |
| ---- | --------------------------------------------------------------------------------------------------- | ----------------------- | --------------------- |
| 1    | La conciliación del 16 cuadra y la salud de «dinero» pasa a verde                                   | 🤖 vigila               | La medianoche UTC     |
| 2    | Publicar el **reloj seguro**                                                                        | 👤 autoriza, 🤖 ejecuta | 1                     |
| 3    | Encender el **reloj de Cloudflare** en producción                                                   | 👤 autoriza, 🤖 ejecuta | 2                     |
| 4    | Publicar el **Hito 1** (catálogo y sesión) y el **versionado**                                      | 👤 autoriza, 🤖 ejecuta | 2                     |
| 5    | Publicar los **fallos críticos**                                                                    | 👤 autoriza, 🤖 ejecuta | 2                     |
| 6    | Entrega 1 (transiciones en la base), Entrega 1b (dinero abierto) y Entrega 3 (pausa sin señal)      | 🤖                      | 5                     |
| 7    | **Compra real de 1 USD** y cancelación de otra de 1 USD                                             | 👤                      | 5                     |
| 8    | Cuentas de **Apple, Google y Expo**; abrir Xcode; llave de Google Maps para Android                 | 👤                      | Puede empezar ya      |
| 9    | Compilar las apps, con la ubicación en segundo plano, y subirlas a TestFlight y a la prueba interna | 🤖                      | 8                     |
| 10   | **Checkr**, número de **WhatsApp**, encender los retiros con el retiro mínimo decidido              | 👤                      | Puede empezar ya      |
| 11   | **Prueba en la calle** con las apps instaladas y dinero real                                        | 👤 + 🤖                 | 6, 7, 9, 10           |
| 12   | Limpiar los datos de prueba, revisión del abogado y del contador, revocar la llave expuesta         | 👤 + 🤖                 | Antes del lanzamiento |
| 13   | **Lanzamiento cerrado en Miami**                                                                    | 👤                      | Todo lo anterior      |

## Lo que ya está y no se toca

- Ciclo completo del pedido, como los grandes.
- Exclusividad de la Fase 3.
- Seguridad del dinero de la Fase 0.
- Conciliación diaria y respaldo.
- Docs públicas en los dos idiomas.
- Recorrido automático y candados.

Todo lo que falta es **publicar lo ya probado**, **probar con dinero real**, **las cuentas de las tiendas** y **la prueba en la calle**. Las funciones nuevas que bloquean son tres, todas del lado de la IA:

- las transiciones del pedido forzadas por la base;
- la pausa del restaurante sin señal;
- la ubicación en segundo plano.

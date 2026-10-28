# Divoox Flex · Fase 5: ubicación exacta, Venezuela y la página web

**Fecha:** 28 oct 2026 · **Rama:** `fase-flex-5` · **País:** Venezuela primero; EE. UU. separado por su perfil · **Investigación:** `docs/investigaciones-rea/2026-10-28-flex-venezuela.md` (con su evidencia REA).

## En una frase

Cada paquete sale con su ubicación exacta. El destinatario la confirma con un enlace por WhatsApp o con su app de Divoox, o la empresa la marca con el pin. En Venezuela la ruta no sale sin esa confirmación. Además, la web ya tiene su página «Flex» con capturas reales y el rastreo por número de guía.

## Lo que encontró la investigación con REA (resumen)

- MRW, Zoom y Tealca piden la cédula del remitente y del destinatario, la dirección con «punto de referencia» y la declaración de contenido. Ofrecen cobro en destino y entrega en agencia o a domicilio.
- Google no valida direcciones en Venezuela. Lo que sirve allá son los códigos plus: gratis, abiertos y funcionan sin internet.
- Ningún programa grande de última milla documenta un enlace para que el destinatario marque dónde recibe antes de la entrega. Es algo que nos diferencia.
- El rastreo público de MRW devuelve el nombre y la cédula de otra persona con una guía inventada. El nuestro no muestra datos personales.

## Qué quedó hecho

| Pieza                           | País                | Qué hace                                                                                                                                                                |
| ------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil por país                 | Venezuela / EE. UU. | Una sola pieza decide monedas, pagos, si la ubicación tiene que estar confirmada, cédula o RIF y punto de referencia.                                                   |
| Datos del destinatario          | Venezuela / EE. UU. | Correo, cédula o RIF (Venezuela) y punto de referencia en cada envío, también desde Excel.                                                                              |
| Vínculo con la app              | Todos               | Con el teléfono o el correo se encuentra al destinatario en Divoox. Si marcó su casa, el paquete llega ya ubicado.                                                      |
| Enlace «confirma dónde recibes» | Todos               | Mensaje listo para WhatsApp. El destinatario marca su puerta en el mapa, sin cuenta. Mientras dure, el enlace es siempre el mismo.                                      |
| Regla de salida                 | Venezuela           | La ruta no se asigna ni se ofrece con paradas sin ubicación confirmada.                                                                                                 |
| Etiqueta                        | Todos               | Agrega el punto de referencia y el código plus del punto exacto.                                                                                                        |
| «Mis paquetes»                  | Todos               | En la app del cliente: lo que le envían, su seguimiento y su ubicación. La casa se marca una sola vez.                                                                  |
| Rastreo público                 | Todos               | En `/track`: solo estados y fechas, sin nombres ni direcciones.                                                                                                         |
| Búsqueda de Google              | Todos               | Pasa por el servidor y está apagada hasta tener la llave. Sin ella funciona el pin.                                                                                     |
| Web                             | Todos               | Página `/flex` con capturas reales de la app, «Flex» en el menú de arriba y en el pie, y la sección para empresas sin tecnología.                                       |
| Docs                            | Todos               | Guías nuevas, en español e inglés: «la ubicación exacta de cada destinatario» y «rastrear un paquete». Además se corrigió una guía vieja que decía que no había saldos. |

## Fallos reales encontrados al tomar las capturas, y corregidos

1. **El enlace viejo dejaba de servir.** Si la empresa volvía a tocar «pedir la ubicación», el enlace que ya había mandado por WhatsApp quedaba muerto. Ahora es el mismo mientras dure.
2. **Un paquete podía aparecerle a otra persona.** Si varias cuentas compartían el mismo teléfono, el envío se vinculaba a la primera que se encontraba. Ahora solo se vincula por teléfono si una sola cuenta lo tiene, o por correo.
3. **La lista de trazabilidad salía pegada en una sola línea.** Ahora sale un evento por línea.

## Cómo se comprobó

- Cada regla nueva tiene su prueba, rota a propósito para verla fallar y luego restaurada: la de Venezuela, el enlace estable y el destinatario único. El código plus se probó contra los valores oficiales del estándar.
- Las capturas de la página salen de la app real: una empresa de ejemplo en Caracas con datos neutros, armada de punta a punta con `scripts/flex/capturas.mjs`. Las originales están en `docs/capturas/flex/fase5-*`.

## Lo que falta para Venezuela (en la fila)

- Cobro contra entrega, con liquidación al comercio.
- Pagos locales en la billetera, con comprobante: pago móvil, transferencia, Zelle y efectivo.
- Doble moneda: dólar y bolívar.
- Cédula de quien recibe al momento de la entrega.
- Avisos automáticos al destinatario por WhatsApp.
- Retiro en un punto, con plazo.
- Seguro.

## Lo que solo decide Richard

- La llave de Google Places, para buscar direcciones mientras se escribe. Es opcional: sin ella funciona el pin.
- Los pagos locales en Venezuela: con qué banco o proveedor, y la revisión con un contador del impuesto a los pagos en divisas.

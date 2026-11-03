# Tutorial: el rechazo de Apple a las tres apps de Divoox (3 nov 2026)

Apps: Divoox (cliente, compilación 11), Divoox Driver (compilación 7) y Divoox Restaurants (compilación 2), versión 1.0. Rechazadas el 3 nov 2026 a las 11:58 de Miami, el mismo minuto que las demás apps de la cuenta de Windoce LLC.

**Regla mientras dure esto (orden de Richard, por Gerencia):** nadie reenvía a revisión, nadie sube compilaciones a App Store Connect, nadie cancela envíos y nadie le escribe a Apple hasta que Richard apruebe el estudio común de la cuenta.

---

## 1. Qué dijo Apple

Dos mensajes en cada app, leídos en App Store Connect → la app → Distribución → Revisión de apps → el envío de iOS. Motivo que figura en el envío: **«4.3.0 Design: Spam»**.

**Mensaje del 3 nov, 11:58 (el rechazo), literal:**

> Guidelines 4.3 - Spam and 4.2.6 - App Generation Services
>
> Issue Description
>
> The app does not appear to meet App Store requirements to prevent the distribution of spam submissions.
>
> Specifically, the app appears to match one or more of the following kinds of spam, which make it harder for users to find the apps they want:
>
> - Apps that duplicate content or functionality already on the App Store. See guideline 4.3(a).
> - Apps that are indistinguishable from what's already widely available or is an opportunistic variant of an existing category or popular app. See guideline 4.3(b).
> - Apps that are created from a commercialized template or app generation service but are not submitted directly by the provider of the app's content. See guideline 4.2.6.
>
> Next Steps
>
> If any of the above descriptions apply to this submission, do not resubmit for review until significant changes have been made to resolve this issue. If the app is resubmitted without substantial improvements, it will be rejected again, and may be rejected for additional issues.
>
> If you believe the app already meets the requirements of guidelines 4.3(a), 4.3(b) and 4.2.6, do not resubmit the app. Instead, reply to this message and answer all of the following questions in full:
>
> 1. Describe in detail what this app does and the primary problem it solves for users. Do not use the App Store marketing description as your response.
> 2. Who is the intended user of this app? Provide a detailed description of the specific target audience.
> 3. What need or gap in the market does this app address that existing apps do not currently address, or address less effectively? Provide a detailed, substantive explanation.
> 4. What beta testing did you conduct before submitting the app for review? Provide examples of user feedback provided in beta that was applied to the production build.
> 5. Is this app intended to function as a standalone product, or is it part of a suite of related apps published under your developer account? If part of a suite, provide a detailed description of how this app's scope and functionality differ from each other app in the suite.
> 6. Could the functionality of this app be fully delivered as an in-app purchase, feature expansion, or content addition within any other app on your developer account? If so, provide a detailed explanation of why this functionality was not consolidated into that existing app.
> 7. Does this app's binary share any significant code, frameworks, or assets with any other app on your developer account, beyond standard third-party frameworks? If so, identify each shared component and describe its role in detail.
> 8. Does this app share any codebase, SDK, or content library with any third-party app, beyond standard third-party frameworks? If so, identify the shared component and provide a detailed explanation of the original functionality this app adds beyond it.
> 9. Was this app created for a client, partner, or other third party who provided the app's content, concept, or branding? If so, identify who provided the content and provide a detailed explanation of why the app is submitted under your developer account rather than theirs. Note that guideline 4.2.6 requires apps built from a commercial template or app generation service to be submitted directly by the provider of the app's content, not on their behalf by the template or service provider.
>
> Resources
>
> - Learn more about requirements to prevent spam on the App Store in guideline 4.3.
> - Learn more about requirements for apps created from a template or app generation service in guideline 4.2.6.
> - Use TestFlight to share the app with beta testers and gather feedback before resubmitting.

**Mensaje anterior, 31 oct, 15:36 (pidió información; motivo «2.1.0 Performance: App Completeness»), lo que importa para el video, literal:**

> 1. A screen recording captured on a physical device, running the latest operating system, demonstrating the app's functionality. The recording must begin with launching the app and show the typical user flow. If the app has any of the following, include them in the recording:
>
> - Account registration, login, and account deletion flows. Account deletion is required in apps that support account creation.

Ese mismo mensaje pidió también, en las notas para el revisor: el propósito y el público, cómo entrar (con la cuenta de cada tipo de usuario), los servicios externos y las diferencias por país. Eso ya está cargado en las notas de las tres apps.

## 2. Por qué pasó

Lo que dicen las pautas oficiales de Apple (App Review Guidelines, leídas el 3 nov 2026):

- **4.3(a):** «Don't create multiple Bundle IDs of the same app». Tres apps de la misma marca, con la misma pantalla de entrar, se pueden leer como tres copias de una misma app.
- **4.3(b):** «Don't submit apps that are indistinguishable from what's already widely available». Una app de reparto con la estructura de DoorDash y Uber Eats, sin algo propio a la vista, encaja ahí.
- **4.2.6:** las apps hechas «from a commercialized template or app generation service» se rechazan si no las sube el dueño del contenido. La misma pauta pone como ejemplo válido de modelo agregado «a restaurant finder app with separate customized entries or pages for each client restaurant».

Lo que vimos en nuestras apps y en lo que recibió el revisor (hechos, no suposiciones):

1. **Es una revisión de la cuenta entera.** Apple rechazó en el mismo minuto casi todas las apps de Windoce LLC (Kipuu, FinTwin, QRbott, Escenia, Mercatren y otras). Muchas apps nuevas de una misma cuenta, en pocos días y hechas con las mismas herramientas (Expo y React Native), son justo lo que la pauta 4.3 vigila. Esto se contesta igual en todas las apps (línea común de Gerencia).
2. **Las tres apps de Divoox se ven iguales al abrirlas.** En los videos, la pantalla de entrar de Divoox Driver tiene la misma cabecera roja «Divoox» y el mismo formulario que la del cliente; solo cambia una línea de texto.
3. **El revisor ve contenido de prueba.** En el video del cliente aparecen un restaurante llamado «Café Fountain Walk (prueba)», ofertas marcadas «Sample» y un restaurante «Divoox Review Kitchen» sin pedidos. Eso se parece a una plantilla rellena.
4. **Los videos no cumplen lo que Apple pidió el 31 oct** (punto 3 de abajo).

## 3. El video que grabó Richard: no sirve y hay que rehacerlo

Los tres videos (cliente, 53 segundos; Driver, 60; Restaurants, 64; grabados en un iPhone de verdad) están adjuntos en App Store Connect. No cumplen lo que pidió Apple el 31 oct:

| Lo que pide Apple (mensaje del 31 oct)                    | Lo que muestra el video                                                                                                                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «must begin with launching the app»                       | Empieza ya dentro de la app, en la pantalla de entrar.                                                                                                                                                    |
| «show the typical user flow»                              | El cliente llega al pago y no lo termina; nadie ve el pedido llegar al restaurante ni al repartidor.                                                                                                      |
| «Account registration, login, and account deletion flows» | Se ve entrar a la cuenta. No se ve crear una cuenta. «Delete account» aparece como botón, pero no se usa.                                                                                                 |
| (nada que confunda)                                       | Aparece el gestor de contraseñas con correos de otras empresas de Richard, un restaurante «(prueba)», ofertas «Sample» y, al final del de Restaurants, la pantalla de inicio con otras apps de la cuenta. |

**Cómo tiene que ser el video nuevo (uno por app, en inglés, en el iPhone):**

1. Empieza en la pantalla de inicio del iPhone y toca el ícono de la app.
2. Crea una cuenta nueva con un correo nuevo (no la de revisión), sin el gestor de contraseñas a la vista.
3. Hace el recorrido típico de esa app:
   - **cliente:** elige dirección, abre Comida, un restaurante real (sin «prueba»), agrega platos, paga y ve el pedido en el mapa;
   - **Driver:** se conecta, recibe la oferta, la acepta, recoge con foto y entrega;
   - **Restaurants:** recibe el pedido con su alarma, lo acepta, lo marca listo y ve al repartidor que viene.
4. Sale de la cuenta, vuelve a entrar y la borra con «Delete account» hasta el final.
5. Sin notificaciones personales y sin otras apps a la vista. Activar «No molestar» antes de grabar.

## 4. Qué arreglamos nosotros (y qué falta)

Ya en vivo (no se ha subido a Apple, por la orden de no subir nada):

- La portada del cliente ya no muestra ofertas «Sample» ni servicios «Pronto»: solo lo que funciona (C-SOLO-LO-TERMINADO, 3 nov).
- Las respuestas a las nueve preguntas están escritas, con la línea común de la cuenta y por debajo de 4000 caracteres: RESPUESTA-APPLE-4.3, en esta misma carpeta.

Lo que queda para cuando Richard apruebe el estudio común (no se empieza antes):

- Dar a cada app su propia cara desde la primera pantalla, con los colores oficiales de sus íconos: cliente en rojo, Driver en negro, Restaurants en blanco.
- Quitar «(prueba)» y los restaurantes de prueba de lo que ve la cuenta del revisor en producción, y darle un restaurante con menú y fotos reales. Esto toca la base de producción y necesita el sí de Richard.
- Grabar los tres videos nuevos (punto 3) y cambiarlos en las notas para el revisor.
- Mandar la respuesta en cada app. Es un mensaje en nombre de Windoce y lo autoriza Richard.

## 5. Qué tiene que hacer Richard, paso a paso

Hoy solo dos cosas: aprobar el estudio común de Gerencia y, cuando lo apruebe, grabar los videos nuevos. No toques nada en App Store Connect hasta entonces.

Cuando se autorice responder, se hace así en cada una de las tres apps:

![Croquis: dónde se responde a Apple](croquis-responder-apple.svg)

1. Entra a App Store Connect con tu cuenta (go@windoce.com) → Apps → Divoox → Distribution → Revisión de apps → el envío de iOS con «Problemas sin resolver».
2. En «Mensajes», abre el de hoy y toca **«Responder al equipo de revisión de apps»**.
3. Pega el texto de esa app desde RESPUESTA-APPLE-4.3 (uno distinto para Divoox, Driver y Restaurants).
4. Toca **Enviar**.

**No toques:**

- «Volver a enviar a revisión de apps»: si se reenvía sin cambios grandes, Apple la rechaza otra vez.
- «Cancelar envío» ni «Eliminar»: se pierde el hilo de mensajes con el revisor.
- No subas compilaciones nuevas mientras se espera la respuesta.

**Cómo se sabe que salió bien:** tu mensaje aparece en «Mensajes», debajo del de Apple. La respuesta del revisor llega por correo a go@windoce.com y aparece en esa misma página.

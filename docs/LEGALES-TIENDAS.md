# Legales listos para las tiendas (12 oct 2026)

Lo que Apple y Google revisan sobre privacidad, términos y borrado de cuenta, y dónde está cada cosa en Divoox.
Fuentes leídas el 12 oct 2026:

- Apple, App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/ (5.1.1, 5.1.2, 5.1.5, 3.1.3(e), 1.2)
- Google Play, borrado de cuenta: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play, política de datos de usuario: https://support.google.com/googleplay/android-developer/answer/10144311

## Lo que piden y dónde lo cumplimos

| Requisito                                           | Quién                   | Dónde está                                                                       |
| --------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Política pública, con título «privacidad», no PDF   | Apple y Google          | `https://divoox.com/privacy` (ES/EN, prerenderizada)                             |
| Qué datos, cómo se recogen y para qué               | Apple 5.1.1(i), Google  | Privacidad §2, §3, §4                                                            |
| Terceros con la misma protección                    | Apple 5.1.1(i)          | Privacidad §5                                                                    |
| Cuánto se guarda y cómo se borra                    | Apple 5.1.1(i), Google  | Privacidad §6 (`#cuanto-tiempo`) y §7 (`#borrar`)                                |
| Retirar el consentimiento                           | Apple 5.1.1(ii)         | Privacidad §7                                                                    |
| Contacto de privacidad y nombre del desarrollador   | Google                  | Privacidad §1: Windoce LLC, go@windoce.com                                       |
| Política enlazada dentro de la app                  | Apple y Google          | Menú de 3 puntos → «Términos y privacidad»; aviso al crear cuenta                |
| Borrar la cuenta desde la app                       | Apple 5.1.1(v), Google  | Menú de 3 puntos → «Borrar mi cuenta» → `/delete-account` → botón directo        |
| Página web para borrar sin reinstalar               | Google                  | `https://divoox.com/delete-account` (qué se borra, qué se guarda, plazo, correo) |
| Ubicación solo para lo necesario y con alternativa  | Apple 5.1.5 y 5.1.1(iv) | Privacidad §4; el cliente puede escribir la dirección a mano                     |
| Pagos de bienes físicos fuera de la compra de Apple | Apple 3.1.3(e)          | Stripe con tarjeta y Apple Pay, no compras dentro de la app                      |
| Reportar contenido ofensivo y contacto publicado    | Apple 1.2               | Términos §6 y Soporte «Reportar un comentario»                                   |
| Derechos de California y otros estados              | Ley                     | Privacidad §8                                                                    |
| Menores                                             | Apple, COPPA            | Privacidad §10 (18+ para cuenta, nada dirigido a menores de 13)                  |

## Lo que el código cumple (si cambia uno, cambia el otro)

- Borrar cuenta (`apps/servidor/src/rutas/cuentas.ts`, `DELETE /datos/cuentas/yo`): cuenta, sesiones, direcciones/notas/ubicación de pedidos, comentarios de calificaciones, teléfonos de avisos, enlaces de confirmación y recuperación, lista de espera. Prueba en `cuentas.test.ts`.
- Copias de seguridad: 30 días (candado C-RESPALDO).
- Ubicación del repartidor: solo la última posición (tabla `repartidores`).
- Sin publicidad ni rastreo: no hace falta la pantalla de rastreo de Apple (App Tracking Transparency).

## Pendiente

- 👤 Revisión de un abogado antes del lanzamiento abierto (ya en PENDIENTES.md).
- En App Store Connect → «Privacidad de la app» marcar: datos de contacto, ubicación precisa, compras, contenido del usuario (calificaciones), identificadores (token de avisos); todos «vinculados al usuario», ninguno «para rastreo».

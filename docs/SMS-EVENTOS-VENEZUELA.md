# Eventos de SMS de Divoox para Venezuela (sugerencia aprobada por Richard, 16 nov 2026)

Origen: sugerencia que Richard trajo de Gemini y aprobó como «importantísima». Se guarda para la integración con SMSya. Regla de fondo: **SMS solo cuando el evento es crítico o la persona puede estar sin internet en ese momento; el resto, avisos al celular (push) gratuitos.**

## Tabla maestra de eventos SMS

| App / módulo                   | Evento                 | Cuándo se dispara                                                                         | Plantilla sugerida (máx. 160 caracteres)                                                                        | Prioridad |
| ------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| Todas las apps                 | AUTH_OTP_LOGIN         | Registro, inicio de sesión o recuperación de clave.                                       | Divoox: Tu codigo de verificacion es 482910. Valido por 5 min. No lo compartas con nadie.                       | Crítica   |
| Cliente (comida y tiendas)     | ORDER_DELIVERY_PIN     | El repartidor va en camino y el cliente eligió entrega en mano con PIN.                   | Divoox: Tu pedido va en camino. Entrega este PIN de 4 digitos al repartidor al recibir: 7391.                   | Alta      |
| Cliente (comida y tiendas)     | ORDER_ITEM_MISSING     | El restaurante marca un producto agotado y el cliente no responde el aviso push en 2 min. | Divoox: Falta un producto en tu orden #402. Entra a la app para elegir reemplazo o reembolso.                   | Media     |
| Cliente (taxi y mototaxi)      | RIDE_DRIVER_ARRIVED    | El auto o mototaxi llega al punto de recogida.                                            | Divoox: Tu conductor Luis (Placa AB123CD - Moto Roja) ya llego al punto de recogida.                            | Alta      |
| Cliente (envíos A a B)         | P2P_RECIPIENT_TRACK    | Al destinatario (punto B), que quizás no tiene la app, con enlace de rastreo y PIN.       | Divoox: Juan te envio un paquete. Sigue la ruta aqui: <enlace corto de divoox.com> y da el PIN 5520 al recibir. | Crítica   |
| Driver (taxi, delivery, A a B) | DRIVER_DOCS_APPROVED   | El equipo verifica la identidad y activa la cuenta del conductor.                         | Divoox Driver: Tu cuenta y documentos fueron aprobados. Ya puedes conectarte y generar ganancias.               | Media     |
| Driver (Divoox Flex)           | FLEX_BLOCK_REMINDER    | 45 minutos antes de iniciar un bloque reservado.                                          | Divoox Flex: Tu bloque de entregas inicia en 45 min en Almacen Centro. Confirma asistencia en la app.           | Alta      |
| Driver (seguridad)             | DRIVER_PAYOUT_ALERT    | Se procesa un retiro de ganancias de su billetera.                                        | Divoox: Se proceso tu retiro de $45.00 USD desde tu billetera. Revisa el detalle en la app.                     | Media     |
| Restaurante                    | STORE_UNATTENDED_ORDER | Respaldo si una orden en hora pico no se acepta tras 3 minutos.                           | ALERTA DIVOOX: Tienes el pedido #815 esperando aceptacion hace 3 min. Revisa tu panel urgente.                  | Alta      |

Sumado por decisión de Richard: **botón de pánico** al responsable de la zona (crítica) y **aviso al cliente de que el mototaxista va en camino**.

## Tres consejos clave

1. **No usar SMS para el flujo normal de estados** («En cocina», «Repartidor asignado», «Entregado»): cuatro SMS por pedido costarían unos 0,13 USD por orden. Eso va por aviso push; el SMS queda para el PIN de entrega, la llegada del conductor y el destinatario externo de envíos.
2. **El envío de A a B (P2P_RECIPIENT_TRACK) es el caso más rentable:** el destinatario suele no tener Divoox; el SMS con enlace corto y PIN asegura la entrega y trae usuarios nuevos.
3. **Respaldo por caídas de internet en comercios (STORE_UNATTENDED_ORDER):** un SMS automático si una orden lleva más de 3 minutos sin aceptarse evita cancelaciones.

## Notas para la implementación (Gerencia)

- Plantillas sin acentos para que quepan en un solo SMS (160 caracteres GSM); confirmar con SMSya cómo cuentan acentos.
- Cada evento con tope diario, registro de envío y estado de entrega; cada uno se puede apagar desde el superadmin.
- Los textos visibles al público en español e inglés según el idioma de la persona.
- Los PIN y códigos nunca se guardan en claro en los registros.

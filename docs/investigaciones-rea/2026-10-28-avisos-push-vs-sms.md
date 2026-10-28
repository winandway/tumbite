# Avisos al destinatario: push y no SMS (Venezuela y todos los países)

**Fecha:** 28 oct 2026 · **Idea de Richard:** usar avisos push con un buen sonido, porque el SMS a Venezuela cuesta más de lo que Divoox cobra por caja entregada.

## Evidencia

- [OBS] Página pública de precios de Twilio para Venezuela, leída como visitante el 28 oct 2026: «SMS Outbound» con número internacional o remitente alfanumérico, **0,2257 dólares por mensaje** (huella sha256 del HTML: 6db7670a32b43b57…).
- [DOC] Divoox cobra 0,20 dólares por caja entregada en Flex (dato de Richard). Un solo SMS por entrega ya cuesta más que la comisión.
- [DOC] Los avisos push por Expo (Firebase en Android, Apple en iPhone) no tienen costo por mensaje.

## Decisión

- Los avisos al destinatario van por push en la app de Divoox, con sonido propio y canal de importancia máxima en Android: va en camino, eres la próxima parada, entregado y listo para retirar (C-AVISO-PAQUETE).
- El conductor tiene su alarma propia en las ofertas y asignaciones.
- El SMS no se usa para avisos de paquetes. Quien no tiene la app recibe el mensaje listo para WhatsApp que manda la empresa (gratis).

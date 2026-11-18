# La oferta suena en bucle hasta que el conductor responde (18 nov 2026) — todos los países

**Pedido de Richard:** el aviso de una oferta en Divoox Driver sonaba una sola vez y se perdía. Debe sonar fuerte y en bucle todo el tiempo de la oferta (unos 30 segundos), hasta aceptar, rechazar o vencer.

## Referencias y evidencia

- [DOC] DoorDash, ayuda de Dashers («New Order Notification Update»): cada oportunidad nueva llega como aviso «New Order» de la app de Dasher; la aceptación sigue en la app.
- [OBS] Foros de conductores (r/DoorDashDrivers): en Android la oferta de Dasher vibra sin parar hasta responder; algunos lo apagan en los ajustes de avisos del teléfono. Es una queja, pero confirma el comportamiento: la oferta insiste.
- [OBS] Uber Driver: la solicitud dura entre 10 y 20 segundos según Uber, unos 15 según The Rideshare Guy y ride.guru; un conductor la describe como un timbre fuerte que sigue sonando. Silenciar el teléfono hace perder la oferta (UberPeople).
- [DOC] Apple, UNNotificationSound: un sonido propio de aviso dura como mucho 30 segundos, en PCM lineal (WAV, AIFF o CAF). Si es más largo suena el sonido normal del sistema.
- [DOC] Expo, expo-notifications: los sonidos propios se incluyen con el complemento `sounds` (recomienda WAV). En Android, de un canal ya creado solo se puede cambiar el nombre y la descripción: un sonido nuevo exige un canal con id nuevo. Si un aviso nombra un canal que el teléfono no tiene, Android NO lo muestra.
- [DOC] Expo, envío de avisos: `channelId` (Android), `sound` e `interruptionLevel` (iOS, incluye `time-sensitive`), `priority: high`, `tag`.
- [DOC] Android y Google Play, «full-screen intent»: desde el 22 ene 2025, en Android 14 o más nuevo, el permiso USE_FULL_SCREEN_INTENT solo viene dado a apps de llamadas y alarmas; las demás deben pedirlo al usuario y completar una declaración en Play Console.
- [INF] El aviso «time-sensitive» de iOS (pasa a través de Concentración, no del modo silencio) necesita activar la capacidad en el perfil de la app; no pide aprobación a Apple. Las «alertas críticas» (pasan el modo silencio) sí necesitan aprobación de Apple, y Apple las niega a apps de reparto.
- [REA] Nuestra app: `Oferta.tsx` y `OfertaViaje.tsx` vibraban una vez (`Vibration.vibrate(patrón)`), y el sonido solo existía en la versión web (`sonidoOferta.ts`, una vez). El aviso del celular usaba el canal `pedidos` con `oferta.wav` (menos de un segundo). Los avisos no se muestran con la app abierta (no hay `setNotificationHandler`).

## Diagrama

```
oferta nueva ─┬─ app cerrada o al fondo ─► aviso del celular
              │                            Android: canal «ofertas» (importancia máxima, 29 s)
              │                            iPhone: sonido de 29 s
              │                            Driver 25 o anterior: canal «pedidos», como siempre
              └─ app abierta ─► pantalla de oferta ─► alarma: tono en bucle + vibración repetida
                                     │
         aceptar · rechazar · vence · se retira · sale de la pantalla · cierra sesión · app al fondo
                                     ▼
                     se calla, deja de vibrar, quita el aviso de la bandeja
                     (y un tope propio: el vencimiento + 2 s, máximo 75 s)
```

## Comparación con Divoox y decisión

| Pieza               | Antes                                     | Ahora                                                                                                                         |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| App abierta         | vibraba una vez; sin sonido en el celular | tono propio en bucle + vibración repetida hasta responder                                                                     |
| Android cerrado     | canal `pedidos`, sonido corto             | canal NUEVO `ofertas`, importancia máxima, tono de 29 s                                                                       |
| iPhone cerrado      | `oferta.wav` corto                        | tono de 29 s (el máximo que deja Apple)                                                                                       |
| Bandeja             | el aviso quedaba                          | se quita al abrir la oferta y al vencer con la app abierta                                                                    |
| Driver 25 publicada | —                                         | el servidor solo usa el canal nuevo si el teléfono dijo que lo tiene (`dispositivos.capacidades`); si no, sigue con `pedidos` |

- Tono propio, sintetizado con ffmpeg (no se usa ningún sonido ajeno): dos bips agudos y un tono más alto, 2 s, normalizado fuerte (pico −1 dB). `oferta_bucle.wav` (2 s) para la app abierta y `oferta_larga.wav` (29 s, el mismo tono repetido) para el aviso. WAV PCM de 16 bits sirve en los dos sistemas.
- Sin permisos nuevos: expo-audio entra con micrófono apagado y `MODIFY_AUDIO_SETTINGS` bloqueado (reproducir no lo necesita); la vibración ya estaba.
- La alarma suena aunque el teléfono esté en vibración o silencio (como la alarma del restaurante): el conductor se conectó para recibir ofertas.

## Para la próxima versión (solo investigado, no se hace ahora)

1. **Pantalla completa (full-screen intent) en Android:** es lo que hace sonar y encender la pantalla como una llamada. Riesgo: Play solo lo da por defecto a llamadas y alarmas; a un reparto le tocaría pedir el permiso al usuario y llenar la declaración, con riesgo de rechazo en revisión. No entra.
2. **Alertas críticas de Apple:** NO se piden (Apple las reserva a salud y seguridad).
3. **Bucle desde un servicio en primer plano** (que siga sonando con la app cerrada más allá de 29 s): Driver ya tiene servicio de ubicación, pero sonar desde ahí necesita código nativo propio y otro tipo de servicio (media playback), que Play revisa. Para otra versión.
4. **Elegir el tono:** varios tonos en Ajustes. Cada uno necesitaría su canal en Android. Para otra versión.
5. **iPhone «time-sensitive»:** se puede declarar sin aprobación, pero cambia el perfil de firma (capacidad nueva) y no pasa el modo silencio. Se deja para cuando se toque el perfil de Apple; no entra en esta compilación.

## Pruebas de aceptación

- `apps/repartidor/src/alarmaOferta.test.ts`: se calla al aceptar, rechazar, vencer, retirarse, salir de la pantalla, cerrar sesión e irse al fondo; tope propio; una nueva calla la anterior; si callar falla, igual deja de vibrar (vistas en rojo).
- `apps/servidor/src/ofertaCanal.test.ts`: el teléfono que declaró el canal nuevo recibe la oferta por `ofertas` con el tono largo; Driver 25 (sin declarar) sigue por `pedidos` con `oferta.wav`.
- Recorrido: los guiones no dejan ningún sonido pegado (la web usa el mismo módulo y se calla al cerrar la oferta).

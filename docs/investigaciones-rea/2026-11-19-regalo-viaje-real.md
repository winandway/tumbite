# Ficha: validar que el viaje fue real antes de acreditar el regalo

Fecha: 19 nov 2026 · Puesto: investigador · Países: todos (Carro y Moto) · Rama: regalo-viaje-real

## Referencia y límites

- Pregunta: cómo validan los grandes (Uber, Lyft, Bolt, DiDi, inDrive) que un viaje fue real antes de pagar una promoción, bono o viaje con código, y qué hacen cuando sospechan.
- Hueco nuestro: conductor y conocido, juntos, piden el viaje, marcan llegada, inician y terminan en segundos sin moverse, y el conductor cobra el regalo.
- Método: solo documentación pública y prensa. No se usó REA ni cuentas ajenas: no hay artefacto propio que analizar para esta pregunta (límite legal del proyecto). Se probará sobre nuestra propia app en staging al construir.

## Evidencia

1. [DOC] Uber, política de uso fraudulento: son fraude pedir, aceptar o completar viajes falsos, aumentar tiempo o distancia, y abusar de promociones, incentivos o referidos. Uber puede retener las ganancias asociadas, ajustar lo programado, quitar el acceso a ofertas o restringir la cuenta mientras revisa.
2. [DOC] Uber: la revisión y la apelación van por soporte; el plazo típico es de hasta siete días hábiles y a veces más. La decisión final no se revisa más.
3. [DOC] Uber, reglas de referidos (varios países): puede negar el código o el pago si determina que el uso fue erróneo, fraudulento o contrario a las reglas. El premio exige completar cierto número de viajes en cierto plazo.
4. [DOC] Lyft, reglas de referidos: puede retener o descontar premios obtenidos por error o fraude y quitar la elegibilidad. Prohíbe expresamente el fraude. Los requisitos del conductor (número de viajes y días) se confirman en la app, no en la página.
5. [DOC] Lyft: la página no fija distancia ni duración mínima del viaje; solo plazos (por ejemplo 30 días para el primer viaje del referido).
6. [NV] Una búsqueda indicó que Lyft cuenta como máximo dos viajes al mismo pasajero para los requisitos de un programa. No se pudo confirmar en las páginas leídas; no usarlo como dato.
7. [DOC] Bolt y DiDi: no se halló política pública con umbrales ni texto de «pago en revisión». Hay prensa sobre bloqueos de cuentas por pedir y cancelar viajes falsos (Bolt) y sobre perfiles alquilados, que Bolt trata como fraude.
8. [DOC] inDrive: la ayuda solo cubre bloqueos de pasajeros (por pedidos falsos, temporales o permanentes). Nada público sobre revisión de pagos al conductor.
9. [OBS] Prensa sobre fraude de incentivos (China 2015, Nigeria 2024): el esquema es exactamente el nuestro (un cómplice pide viajes cortos para cumplir una meta y se reparte el bono). Uber reaccionó bloqueando cuentas y, en un caso, después de pagar.
10. [DOC] Blog de un proveedor antifraude (Radar, mayo 2026), no de las plataformas: señales de fraude en circuito cerrado: movimiento GPS que no corresponde a un viaje real, tiempos idénticos entre cuentas, mismos aparatos, ubicaciones o redes entre conductor y pasajero, ciclos repetidos entre el mismo grupo de cuentas, picos de bonos en una zona, GPS que no concuerda con IP o red, dispositivos con root o emulados. No da números.
11. [INF] Las plataformas casi no publican umbrales (distancia o minutos mínimos) ni textos de «pago en revisión»; lo guardan por seguridad. Los plazos y cuentas de soporte sí son públicos (punto 2).
12. [DOC] Qué hacen al sospechar, resumen de lo publicado: retener el pago, revisión manual por soporte, quitar el incentivo, restringir o desactivar la cuenta (incluida la de pasajero si es la misma persona).

## Cómo se lo comunican al conductor

- [DOC] Uber: aviso de revisión con apelación por soporte y plazo aproximado de siete días hábiles. No publica el texto exacto de la notificación.
- [NV] Textos de «pago en revisión» de las otras plataformas: no encontrados.

## Qué hacen ellos / qué haremos

| Tema                   | Ellos (según lo publicado)                                                 | Divoox                                                                                         |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Umbral de viaje mínimo | No publicado (Lyft no tiene)                                               | Sí, propio (ver abajo), solo para el regalo, no para el viaje                                  |
| Señales                | GPS contra viaje real, aparato compartido, pareja repetida, cuentas nuevas | Distancia GPS real, duración, cercanía previa, pareja repetida, aparato                        |
| Si no cumple           | Retiene, revisa a mano, quita incentivo, desactiva                         | Regalo «en revisión»; el equipo aprueba o rechaza; el viaje y el cobro en efectivo no se tocan |
| Aviso al conductor     | Notificación con plazo de revisión                                         | «Tu regalo está en revisión; respondemos en máximo 3 días hábiles» (en su idioma)              |
| Dinero                 | Retienen antes de pagar                                                    | La empresa no acredita el regalo hasta la decisión                                             |

## Recomendación de umbrales de arranque [INF, nuestra, no salen de una fuente]

El regalo se acredita solo si se cumplen TODAS; si falla una, pasa a «en revisión» (no se rechaza solo).

1. Llegada al destino: posición GPS del conductor al terminar a 150 m o menos del destino. Razón: el GPS urbano falla decenas de metros y los pasajeros se bajan antes; 150 m deja margen sin aceptar «terminé en otro lado».
2. Distancia recorrida real (suma de puntos GPS del viaje en curso) de al menos 60 % de la distancia cotizada. Razón: los atajos y rutas distintas son normales; menos de 60 % indica que no se hizo el trayecto.
3. Duración real de al menos 50 % de la duración cotizada.
4. Piso absoluto: al menos 800 m recorridos y 3 minutos desde «Iniciar viaje» hasta «Terminar». Razón: cierra el caso de viaje al segundo sin moverse aunque la cotización fuera corta. Se puede bajar a 400 m y 2 minutos solo en Moto de zona pequeña.
5. Separación mínima entre punto de recogida y destino: 500 m en línea recta (un regalo no paga «viajes» de una cuadra).
6. Puntos GPS suficientes: al menos un punto cada 30 segundos durante el viaje; si faltan, pasa a revisión (puede ser un teléfono sin señal, no fraude).

Señales extra que mandan a revisión aunque pasen los pisos (también [INF]):

- Misma pareja conductor-pasajero con 3 regalos o más en 30 días.
- Conductor y pasajero con el mismo aparato, o con teléfonos a menos de 50 m uno del otro desde 10 minutos antes del pedido hasta que se aceptó.
- Cuenta de pasajero creada menos de 24 horas antes del viaje regalado.
- Viaje terminado sin cambio de posición del conductor (velocidad máxima menor a 5 km/h todo el viaje).

## Decisión recomendada

- Validar al terminar el viaje y antes de acreditar; guardar las medidas usadas para que el equipo vea por qué quedó en revisión.
- Los umbrales viven en configuración por país, no en el código, para ajustarlos con datos reales de El Vigía y Novi.
- Aprobar o rechazar desde el superadmin deja registro (quién, cuándo, motivo).
- Sin cambiar el estado del viaje, el cobro en efectivo ni la calificación.

## Pruebas de aceptación

1. Viaje real completo: regalo acreditado solo.
2. Conductor y pasajero parados: llegada, inicio y fin en segundos: queda «en revisión», no se acredita.
3. Viaje que llega a 120 m del destino: pasa; a 200 m: revisión.
4. Distancia 59 % de lo cotizado: revisión; 60 %: pasa.
5. Menos de 800 m o menos de 3 minutos: revisión aunque la cotización fuera corta.
6. Sin puntos GPS suficientes: revisión, con motivo visible.
7. Pareja repetida (3.er regalo en 30 días): revisión.
8. Aprobar acredita una sola vez; rechazar no acredita y deja motivo; ambas dejan registro.
9. El conductor ve el aviso de revisión en español e inglés.

## Fuentes (nombre y dirección)

- Uber, Fraudulent Use Policy: https://www.uber.com/blog/uber-fraudulent-use-policy-seattle
- Uber, reglas de referidos (EE. UU.): https://www.uber.com/us/en/legal/referral-program-rules/
- Lyft, términos de referidos: https://www.lyft.com/terms/referrals
- Lyft, reglas de invitación: https://www.lyft.com/invite-terms
- Radar, patrones de fraude en reparto de pasajeros: https://radar.com/blog/5-rideshare-patterns-costing-platforms
- TechCabal, conductores que juegan con los bonos: https://techcabal.com/2024/10/02/gig-drivers-game-the-system-bonuses/
- TechCabal, Bolt bloquea cuentas por pedir y cancelar: https://techcabal.com/2024/08/22/bolt-ride-cancel-trend/
- Quartz, fraude de viajes falsos en China: https://qz.com/423288/fake-drivers-and-passengers-are-boosting-ubers-growth-in-china
- inDrive, desbloqueo de cuentas: https://indrive.com/help/passengers/how-to-unblock-an-indrive-account
- DiDi, suspensión de conductores (Australia): https://web.didiglobal.com/au/help-center/driver-suspension/

## Decisión tomada (desarrollador, 19 nov 2026) — candado C-REGALO-VIAJE-REAL

Se construyó la validación al terminar el viaje, con revisión del equipo. Los umbrales de arranque quedaron en el código (`apps/servidor/src/viajeReal.ts`), algo más anchos que la recomendación de arriba, porque nuestra medición del recorrido suma tramos rectos de 25 m o más (se queda corta frente a la ruta por calles) y el GPS del piloto de Venezuela es irregular. Una regla demasiado fina llenaría la revisión de conductores honestos.

- Llegada al destino: a 300 m o menos, con una ubicación de hace menos de 2 minutos (la recomendación decía 150 m).
- Recorrido medido: al menos 50 % de la distancia cotizada (la recomendación decía 60 %).
- Duración: al menos 40 % de la cotizada, con piso de 2 minutos (la recomendación decía 50 % y 3 minutos).
- Sin moverse: menos de 200 m recorridos.
- Pasajero: su teléfono a más de 300 m del conductor en la mayoría de sus lecturas (mínimo dos lecturas, una por minuto).
- La cuenta nueva del pasajero NO manda a revisión: el regalo de bienvenida es justamente para cuentas nuevas. Queda como alerta cuando un mismo conductor junta tres o más regalos en una semana con pasajeros dados de alta el mismo día.
- La misma pareja repetida sigue como alerta (ya existía) y el mismo aparato o teléfono ya estaba frenado al aceptar.

Hay que mirar las primeras revisiones del piloto y ajustar: si casi todo lo que cae es GPS malo, se ensancha; si pasan viajes dudosos, se aprieta.

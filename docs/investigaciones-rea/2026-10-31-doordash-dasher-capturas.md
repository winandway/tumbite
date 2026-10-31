# DoorDash Dasher, observado al volver a la app · comparación con Divoox Driver (31 oct 2026)

País: EE. UU. (Michigan). Servicio: repartidores (comida y todos los servicios con conductor).

## Evidencia y límites

- **[OBS] 16 capturas** que hizo Richard con su propia cuenta de Dasher al volver a la app después de un
  tiempo sin entrar. Guardadas FUERA del repositorio (tienen su cara, su nombre y su cuenta): carpeta
  privada `~/Divoox-privado/estudios/doordash-2026-10-31`. Aquí solo se describen.
- **[OBS] contado por Richard** (sin captura): antes de todo, la app le pidió verificar el correo y el
  teléfono por SMS.
- No se descompiló ni se analizó la app de DoorDash (lo prohíben sus términos). Lo de abajo es lo que se
  VE; lo que pasa por detrás se marca [INF].

## Lo observado, en orden [OBS]

1. **Volver después de un tiempo = verificar otra vez.** Correo y teléfono por SMS (contado), y después
   la cara: «Mira ligeramente a la derecha», con un círculo guía, «Captura automática activada»,
   «Procesando autofotos» y «Tu identidad se verificó con éxito. Gracias por ayudar a hacer de DoorDash
   un lugar seguro para todos». [INF] El giro de cabeza es una prueba de vida: una foto de una foto no
   gira.
2. **Permisos explicados antes de pedirlos.** «Otorga permisos para disfrutar de la mejor experiencia»:
   ubicación actual (para hacer un dash), notificaciones push (alertas críticas de entregas) y ofertas
   personalizadas, cada uno con su porqué y un check; botón «Estoy listo». Después sale la ventana del
   sistema (actividad física, rastreo).
3. **Términos actualizados.** Antes de seguir, «Acuerdo de términos y condiciones actualizado» con la
   fecha de la última versión, casilla «He leído, comprendo y acepto» y «De acuerdo / En desacuerdo».
4. **Bienvenida.** «¡Qué bueno verte de nuevo, Pedro! El tiempo que estuviste alejado no cambió tu
   impresionante nivel Silver.» Con «Tiempo promedio de espera de la oferta: 1 min» y «Hacer un dash».
5. **Mapa de demanda.** Hexágonos rojos donde hay movimiento y una franja arriba «+$2.00 por orden» con
   los minutos que le quedan (pago extra por hora pico). Conectado: «Buscando ofertas… Es más probable
   que recibas ofertas en zonas populares» y «Esperar la oferta de la zona: 1–3 min». Richard notó que el
   rojo aparece a la hora del almuerzo y de la cena, y que alrededor de él no había nada.
6. **Dash actual.** Pausar órdenes, ganancias de este dash, «El dash termina a las 7:00 p. m.»,
   «Agregar horario», «Terminar ahora», navegación (elegir app) y «Lee las instrucciones al llegar».
7. **SafeDash.** Llamada de seguridad (un agente que puede escalar al 911), reportar un problema de
   seguridad, compartir la ubicación con contactos de confianza y «Desliza para 911».
8. **Preferencias.** Comprar y entregar (con Tarjeta Roja), entrega de bebidas alcohólicas (certificado),
   efectivo contra entrega, entrega de pizza (bolsa verificada), ofertas relámpago, «Establece tu hora y
   ubicación».
9. **Cuenta.** Perfil, información de la cuenta, tarjeta de pago, configuración, vehículos, funciones de
   conducción segura, versión beta, cerrar sesión y número de versión.

## Comparación con Divoox Driver

| #   | Del estándar                                | Divoox hoy                                            | Brecha                                                             |
| --- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Verificar otra vez al volver tras un tiempo | Foto de control al azar (20 %, una por semana)        | **Falta**: obligatoria si estuvo un tiempo sin conectarse          |
| 1b  | Prueba de vida con giro de cabeza           | Foto de control de frente                             | **Falta**: segunda foto mirando a un lado                          |
| 1c  | Correo y SMS otra vez                       | Correo confirmado al registrarse; SMS espera a Twilio | SMS depende de Richard                                             |
| 2   | Permisos explicados antes                   | Se piden directo                                      | **Falta** la pantalla previa                                       |
| 3   | Aceptar términos actualizados               | Se aceptan al registrarse                             | **Falta** pedirlo cuando cambian                                   |
| 4   | Bienvenida con el nivel                     | Tarjeta de nivel en el inicio                         | Parcial: falta «tu nivel no cambió» al volver                      |
| 5   | Mapa de demanda y espera de la zona         | Zonas de demanda en el mapa                           | **Falta** «Buscando ofertas… zonas populares» y la espera estimada |
| 5b  | Pago extra por hora pico                    | Bono por oferta (dinero)                              | Monto y horario los decide Richard                                 |
| 6   | Dash actual                                 | Pausa y conectarse                                    | Revisar hora de fin y «terminar ahora»                             |
| 7   | SafeDash                                    | Ayuda con 911                                         | Revisar «desliza para 911» y compartir ubicación                   |
| 8   | Preferencias                                | Vehículos y servicios habilitados                     | Revisar efectivo y alcohol por preferencia                         |

## Decisión

Se construye primero lo que protege a los clientes: la verificación obligatoria al volver y la prueba de
vida con giro (revisada por nuestro equipo mientras Richard decide el proveedor de comparación de caras,
punto K5). Después los permisos explicados, los términos actualizados, la bienvenida y el texto de las
zonas populares. El pago extra por hora pico espera el monto de Richard.

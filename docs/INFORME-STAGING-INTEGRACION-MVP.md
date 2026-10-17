# Integración del MVP en el sitio de pruebas — 17 oct 2026

Autorizado por Richard: publicar integracion-mvp en staging. Producción no se tocó. Sin dinero real. Retiros apagados.

## Qué se publicó

- Rama `fase-integracion-mvp` = integracion-mvp (`adf71d5d`) + main con el reloj seguro (`09060814`), commit `c0483b1b`.
- El archivo de contraseñas de prueba quedó fuera del repositorio en esta rama (la copia local se conserva).
- Staging sirve `c0483b1` (comprobado en la dirección de versión). Flujo pruebas-rama `38989018737`: todo en verde.

## Qué funciona (comprobado en staging)

| Prueba                                                                                                                                               | Resultado       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Verificación completa (tipos, lint, 649 pruebas, build, auditoría, secretos)                                                                         | Verde           |
| Tablas nuevas: liquidaciones, transiciones_pedido (12 filas), reloj_tareas, avisos_stripe                                                            | Creadas         |
| Columnas nuevas: avisos_stripe.estado, liquidaciones.alertado_en, restaurantes.senal_en y pausa_aviso_en                                             | Creadas         |
| Disparadores (pedidos, viajes, vehículos, retiros) y los 17 de las fases 1 y 2                                                                       | Presentes       |
| S2, S3, S4, S5, S7, S11, S12, F1, F2, F3, migraciones M4/M5, reloj                                                                                   | Verde           |
| L1 contra Stripe TEST: 13 casos (autorizar, capturar una vez, clave repetida, captura a medias, error guardado, anulada a revisión, saldo retirable) | Verde           |
| Tiempo real: pases, WebSocket, GPS, avisos firmados, reconexión, reloj externo                                                                       | Verde           |
| Recorrido completo de Comida (restaurante, repartidor y cliente, con Stripe de prueba) en inglés                                                     | Verde (3,3 min) |
| Mismo recorrido en español                                                                                                                           | Verde (3,1 min) |
| Conciliación: el libro cuadra, 14 cobros coinciden con Stripe, retiros cuadran                                                                       | Verde           |
| Salud de staging: todas las piezas ok; sms y retiros «pendiente» a propósito                                                                         | Ok              |

## Qué falla

Nada atribuible a la integración. Dos avisos revisados que no son fallas:

- Respaldo «atrasado» en staging: por diseño solo producción guarda copias diarias.
- Consola: la política de seguridad bloquea el contador de visitas que inyecta la plataforma (Cloudflare Insights). No es nuestro código; se deja bloqueado para no abrir la política a un script externo.

## Qué falta para instalar las apps en teléfonos reales

1. **Cuenta de Expo de la empresa** (organización windoce-llc). La sesión de esta computadora es de otra cuenta y las tres apps aún no tienen su proyecto en Expo. Con acceso a la organización se crean los tres proyectos y se compila el perfil «pruebas», que ya apunta a staging. 👤
2. **Android:** con lo anterior basta. El perfil «pruebas» genera un instalable directo (distribución interna) que se abre en el celular sin pasar por Google Play. Para que el mapa se vea en Android falta la llave de Google Maps para Android. 👤
3. **iPhone:** hace falta la cuenta de Apple Developer de Windoce LLC y registrar cada iPhone de prueba (o usar TestFlight). Sin esa cuenta no se puede instalar en un iPhone real. 👤
4. **Ubicación del repartidor en segundo plano:** necesita la compilación propia (no Expo Go); queda lista con el punto 1.
5. **Antes de repartir cuentas de prueba:** cambiar las contraseñas que estaban en el archivo expuesto. 👤

## No tocado

Producción (sigue en el reloj seguro, `1fe7d2e3`), retiros, dinero real, reloj de Cloudflare en producción.

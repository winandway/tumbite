# Identidad de repartidores y conductores (29 oct 2026) — todos los países

Pedido de Richard y su equipo: saber de verdad quién reparte, con una foto real que no se pueda cambiar,
y reconocer a quien vuelve con otro correo después de que se le cerró la cuenta por mala conducta.

## Referencias

Uber (Real-Time ID Check), DoorDash (verificación de Dashers), proveedores de verificación con documento y
selfie (Stripe Identity) y de búsqueda de caras (servicios de reconocimiento facial en la nube).

## Evidencia y límites

- [REA] Captura como visitante del blog de ingeniería de Uber, «Engineering Safety with Uber’s Real-Time ID
  Check». Paquete `evidencia-rea-2026-10-29-identidad-repartidores.json`, evidencia
  `ev_094ff5c4e2170ce0e4ecc190c101abfa44447e65ec0a1183de2498f1aac558c3`. Lo que dice:
  - la foto de perfil verificada del conductor es la referencia;
  - se le pide una selfie al azar y la compara con esa foto (Microsoft Face API: detectar la cara y verificar);
  - si no coincide, el conductor queda bloqueado temporalmente mientras se investiga;
  - con gafas, se le pide repetir sin ellas; la pantalla es blanca para que la foto salga bien de noche;
  - si el vehículo se mueve, primero le pide detenerse.
- [DOC] Stripe Identity: documento y selfie con comparación de cara, unos 1,50 dólares por verificación en
  EE. UU. (fuentes de terceros; confirmar en la página de Stripe antes de encenderlo).
- [DOC] Leyes de datos biométricos: Illinois (BIPA) es la más estricta y exige consentimiento por escrito;
  Texas y Washington exigen aviso y consentimiento; Colorado y Connecticut agregan reglas en 2026.
  Florida: no se encontró una ley específica [NV]. Colombia y Venezuela tienen leyes de datos personales:
  el abogado debe confirmar.
- [NV] Cómo guarda cada empresa las caras para detectar cuentas repetidas: no es público.
- No se analizaron las apps de Uber ni de DoorDash (son de terceros).

## Lo que Divoox ya tiene

| Pieza                                                                      | Estado                                        |
| -------------------------------------------------------------------------- | --------------------------------------------- |
| Foto del documento (frente y reverso) y selfie al registrarse              | Sí (`kyc`), privadas, solo el equipo las ve   |
| Revisión del equipo antes de aprobar                                       | Sí (bandeja de verificación)                  |
| No se puede volver a subir después de aprobado                             | Sí                                            |
| Selfie de control al azar                                                  | Sí (`selfies_control`), la revisa una persona |
| Foto verificada visible en su perfil y para el cliente                     | **No**                                        |
| Cambiar la foto solo con soporte, con motivo y registro                    | **No**                                        |
| Correo y teléfono únicos de verdad (mayúsculas, puntos, «+algo», formatos) | **Parcial**: solo el correo exacto            |
| Lista de personas bloqueadas por mala conducta                             | **No**                                        |
| Comparación de caras con IA                                                | **No**                                        |

## Decisión

1. **Mecánico ya (K2 a K4), sin costo ni datos biométricos:**
   - La selfie aprobada pasa a ser la foto de perfil verificada. Se muestra en su perfil y al cliente del
     pedido en curso. El repartidor no la puede cambiar: solo soporte, con motivo, y vuelve a revisión.
   - Correo y teléfono canónicos: un correo con puntos o «+algo» en Gmail, o un teléfono en otro formato,
     cuenta como el mismo.
   - Al cerrar una cuenta por mala conducta, su correo y su teléfono entran a la lista de bloqueados; quien
     se registre con ellos no entra. La foto queda guardada para la comparación de la fase con IA.
2. **IA (K5), detrás de un interruptor:** comparar la selfie con el documento y con las caras de la lista de
   bloqueados, como Uber. Necesita que Richard apruebe el proveedor y el costo, y que el abogado apruebe el
   consentimiento biométrico por país y estado. Recomendación: un servicio de reconocimiento facial en la
   nube que permita buscar una cara en una colección propia; Stripe Identity sirve para documento contra
   selfie, pero no para buscar en la lista de bloqueados.

## Pruebas de aceptación

- La foto aprobada no se puede reemplazar desde la app; soporte la libera con motivo y queda registrado.
- El cliente ve la foto del repartidor de su pedido en curso, y nadie más la ve.
- Registrarse con el mismo correo con otra forma, o con el mismo teléfono en otro formato, no entra.
- Un correo o un teléfono de la lista de bloqueados no entra.

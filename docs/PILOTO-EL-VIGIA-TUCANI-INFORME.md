# Piloto en vivo de Divoox en El Vigía y Tucaní — informe (16 nov 2026)

Todo en el sitio real (divoox.com). Venezuela.

## Qué quedó encendido

| Zona                          | Centro           | Radio | Mototaxi | Comida | Envíos de A a B |
| ----------------------------- | ---------------- | ----- | -------- | ------ | --------------- |
| El Vigía (VE-MER-ELVIGIA)     | 8.6219, -71.6506 | 15 km | sí       | sí     | sí              |
| Tucaní (VE-MER-TUCANI), nueva | 8.9679, -71.2741 | 10 km | sí       | sí     | sí              |

- Precios en dólares; bolívares solo de referencia a la tasa del BCV (914,02 el 16 nov, automática).
- Tarifa de moto y de envíos (las dos zonas): 0,50 de arranque, 0,22 por km, 0,03 por minuto, mínimo 1,00 dólar. Ya no sale como «precio de prueba».
- Cobro: efectivo y pago móvil. Comisión del 10 % del saldo prepago del conductor.
- Venezuela no tenía en producción su configuración de país (efectivo, pago móvil, recargas, tarifas de comida): se copió la probada en el sitio de pruebas.

## Pruebas de punta a punta en el sitio real (cuentas del equipo, todas «Soporte …»)

| Qué                                                                            | Resultado                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Alta de conductor de moto: ciudad, moto, papeles, identidad; el equipo aprueba | Moto, comida y envíos habilitados                       |
| Recarga de saldo con código del punto del equipo (5 dólares)                   | Acreditada al momento                                   |
| Viaje de moto en efectivo (Plaza Bolívar → Aeropuerto)                         | 1,32 USD; comisión 0,13 del saldo                       |
| Viaje de moto desde la app Driver real en el emulador                          | Oferta llegó, aceptar, llegué, código, terminar         |
| Pedido de comida en efectivo                                                   | 5,25 USD (≈ 4.798,61 Bs); cobro conciliado              |
| Envío de A a B                                                                 | 1,32 USD; foto al recoger y al entregar, cierre con PIN |

Lo de prueba quedó cerrado: el restaurante de prueba pausado (no se ve), el conductor de prueba desconectado y sin servicios.

## Apps de Android de la versión real (descarga directa, sin Google Play)

| App                | Número | Código  | Peso   |
| ------------------ | ------ | ------- | ------ |
| Divoox Driver      | 22     | d575627 | 139 MB |
| Divoox (cliente)   | 24     | d575627 | 153 MB |
| Divoox Restaurants | 15     | 9ef1241 | 108 MB |

- Página: https://divoox-progreso.sitios.dev/apps (bloque verde «Versión real»).
- Driver: https://expo.dev/artifacts/eas/N8xo6cGpPgy1jSuxoqEBc-OgjyQDyoIx1XO7P9QCrf8.apk
- Cliente: https://expo.dev/artifacts/eas/tU84puNslfJew9a3nid53xnE6Lb8qDok7j1R7r-oULo.apk
- Restaurants: https://expo.dev/artifacts/eas/zadu4EB_WhVCK9DZ9SXncdjMdjmOViNxF6jthV5xW6U.apk
- La versión de Google Play aprobada (Driver 16, cliente 17, código del 11 nov) NO sirve para el piloto: no tiene ciudad del conductor, papeles de Venezuela ni pago móvil.

## Lo que falta

1. **Mapa gris en las apps del piloto.** La llave «Divoox Maps Android» solo acepta la firma de Google Play. Agregar en Google Cloud → Credenciales → Divoox Maps Android → Apps para Android:
   - com.windoce.tumbite.driver · 50:3B:B2:7B:70:1B:A9:B8:E9:82:23:58:8E:B5:D5:28:68:61:76:AE
   - com.windoce.tumbite · 03:53:BC:31:34:E5:33:54:B8:F1:70:C6:FB:20:DA:E2:B5:04:EB:CC
     Sin esto todo funciona (ofertas, viajes, cobro, «Abrir navegación» con Google Maps), solo el mapa dentro de la app sale gris. Pide la contraseña de la cuenta de Google: lo hace Richard.
2. **Responsables de zona.** Superadmin → Zonas → «Responsable de la zona»: nombre y celular +58 de El Vigía y de Tucaní.
3. **SMS a Venezuela.** El número de Twilio (+1 866) no entrega a +58. Decisión de Richard: SMSya (tarea SMS-VE-1, eventos en `docs/SMS-EVENTOS-VENEZUELA.md`). Mientras, el pánico llega por correo al equipo y por aviso al celular del responsable si tiene cuenta Divoox con ese número.

## Piezas nuevas (código)

- C-PANICO-ZONA: el botón de pánico avisa al responsable de la zona (SMS cuando haya proveedor, aviso al celular), con tope diario y registro.
- C-SMS-PROVEEDOR: proveedor de SMS intercambiable (Twilio hoy, SMSya después).
- C-ENVIOS-POR-PAIS: Envíos se abre por la compuerta de Venezuela; el certificado de antecedentes vale para Envíos en Venezuela.
- C-PUNTO-VENTA-PANEL: el punto de recarga emite sus códigos desde el superadmin (Dinero → Mi punto de recarga).
- C-APPS-VERSION-REAL: sección aparte en la página de apps.

Guía para los responsables: `docs/PILOTO-GUIA-RESPONSABLE-DE-ZONA.md` (con capturas de la instalación).

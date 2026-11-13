# Moto en Venezuela: moneda, tarifa, forma de pago y papeles del conductor (13 nov 2026)

**Para qué:** dejar Divoox Moto listo para pruebas en Venezuela copiando el estándar del mercado local, sin inventar cifras.
**Método:** solo fuentes públicas (prensa, fichas de tiendas de apps, sitios de los operadores). No se usaron cuentas, ni se descompiló ninguna app, ni se capturó tráfico ajeno. REA no se corrió sobre terceros (lo prohíbe la regla legal del proyecto); sobre nuestra app, el recorrido queda cubierto por las pruebas de punta a punta (`apps/servidor/src/rutas/motoVenezuela.test.ts`).
**Etiquetas:** [OBS] observación pública o prensa · [DOC] documentación oficial · [INF] inferencia nuestra · [NV] no verificado.

## 1. ¿Dólares o bolívares?

| Hallazgo                                                                                                                                                                                      | Etiqueta | Fuente                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Las apps de transporte de Venezuela fijan los precios en dólares y dejan pagar con tarjeta, transferencia o efectivo; el efectivo en dólares cuesta porque no circulan monedas fraccionarias. | [OBS]    | Reportaje de AP replicado por Yahoo News y La Patilla (julio–agosto 2022), «Ride-sharing apps rise in Venezuela as public transit decays». |
| Comparación de precios de moto en Caracas en dólares: viaje de 1,2 km, mínimo US$0,31 en Yango, US$0,98 en Ridery y US$1,29 en Yummy (febrero 2026).                                          | [OBS]    | Comparación de prensa citada en la búsqueda pública del 13 nov 2026 (Valora Analitik y medios venezolanos).                                |
| Viaje de 9 km en moto (La Candelaria a Los Palos Grandes): Yango US$2,10, Yummy US$3,20, Ridery US$3,11 (2025).                                                                               | [OBS]    | Misma comparación de prensa.                                                                                                               |
| Yango muestra el precio final en bolívares y en dólares, y convierte con la tasa oficial del BCV de cada día.                                                                                 | [OBS]    | Descubre.vc, «Yango Ride implementa precios en bolívares para viajes en Venezuela» (agosto 2026).                                          |
| Ridery deja pagar con pago móvil y lista los bancos al elegirlo; devuelve solo lo pagado por pago móvil si el viaje se cancela.                                                               | [OBS]    | Ficha de Ridery en la App Store (Apple).                                                                                                   |
| Yummy aceptaba pago móvil, Zelle, tarjetas, PayPal y Binance Pay.                                                                                                                             | [OBS]    | CriptoNoticias (2022).                                                                                                                     |

**Decisión [INF]:** la moto en Venezuela se cotiza y se cobra en **dólares** (como Ridery y Yummy). El pasajero paga en **efectivo** (en mano al conductor) o por **pago móvil** al conductor; en pago móvil paga el equivalente en bolívares a la tasa oficial del día (como Yango), y el conductor confirma en su app que le llegó. Es lo más simple y fiel al mercado, y no rompe la comisión: la política del prepago de Venezuela se siembra también en dólares, con el mismo 10 % ya aprobado (`prepago-ve-ride-usd`), sin inventar otro porcentaje.

**Lo que NO se construyó todavía:** la tasa BCV automática (diseño en `docs/DISENO-TASA-VES.md`). No es imprescindible para probar: el precio y la comisión están en dólares; el pasajero que paga por pago móvil hace la cuenta con la tasa del día, como hoy en la calle. Queda anotado en `PENDIENTES.md`.

## 2. La tarifa

Calibrada con la comparación de Caracas [OBS], en centavos de dólar (`TARIFA_MOTO_VENEZUELA`, `packages/compartido/src/perfilPasajeros.ts`):

| Pieza           | Valor                            | Por qué                                |
| --------------- | -------------------------------- | -------------------------------------- |
| Base            | 0,50                             | —                                      |
| Por km          | 0,22                             | 9 km ≈ 3,15 (Ridery 3,11 y Yummy 3,20) |
| Por minuto      | 0,03                             | 24 km/h estimados en moto [INF]        |
| Mínimo          | 1,00                             | Ridery 0,98 y Yummy 1,29 en 1,2 km     |
| Espera gratis   | 3 minutos, luego 0,05 por minuto | [INF]                                  |
| Cancelación     | gratis 2 minutos, luego 0,50     | [INF]                                  |
| Redondeo        | ninguno                          | las apps muestran centavos [OBS]       |
| Precio dinámico | apagado                          | [INF]                                  |

Es una tarifa **de prueba** (`de_prueba = 1`). La definitiva se ajusta con la práctica en la ciudad real.

## 3. Comisión y recargas (modelo confirmado por Richard el 13 nov 2026)

- El conductor recarga saldo prepago en puntos de venta autorizados; el pasajero le paga el viaje completo en mano; al cerrar el viaje se descuenta la comisión del saldo; sin saldo no recibe ni acepta carreras. Como inDrive en Cúcuta (comisión del 9 % al 12 % en la región [OBS]: La República, Expansión, La Prensa de Nicaragua).
- El 10 % ya está aprobado (C-PREPAGO-MERCADOS, ficha `2026-11-02-comision-prepago-conductores.md`).

## 4. Papeles del conductor

- No encontramos en fuentes públicas la lista exacta de requisitos de Ridery o Yummy para conductores de moto [NV]. Ridery se presenta como plataforma que conecta con «conductores certificados» [OBS: El Diario, Voz de América].
- El INTT (Instituto Nacional de Transporte Terrestre) emite la licencia de moto con examen teórico-práctico [OBS: El Diario, 2024], y en agosto de 2026 fijó nuevas obligaciones para las empresas de reparto, empezando por el registro nacional del INTT [OBS: El Diario, Finanzas Digital, Bloomberg Línea]. **Si eso alcanza a las apps de pasajeros lo tiene que decir el abogado** (anotado para Richard).
- **Decisión [INF]:** sin proveedor automático de antecedentes en Venezuela, el conductor sube su **licencia de moto** y su **certificado de antecedentes penales**, más su cédula por la verificación de identidad de siempre (documento y selfie). El equipo los revisa y aprueba a mano. La moto lleva su **registro** y su **póliza de responsabilidad civil** con cobertura de pasajeros. La edad mínima se deja en 21 (la de EE. UU.) hasta que el abogado diga otra cosa: no se baja un piso de seguridad sin fuente.

## 5. Lo que depende de Richard

La ciudad real, el abogado venezolano (requisitos del INTT para pasajeros, edad mínima, seguro), quién vende y recibe las recargas, y el número de solicitud de la marca Divoox en Venezuela para abrir el país en producción.

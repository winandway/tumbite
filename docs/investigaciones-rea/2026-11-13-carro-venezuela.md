# Carro (taxi) en Venezuela: papeles del conductor y tarifa (13 nov 2026)

**Para qué:** dejar Divoox Carro y Carro XL listos para probar en El Vigía (estado Mérida), copiando el estándar del mercado local sin inventar cifras. Venezuela; lo común sirve a todos los países.
**Método:** solo fuentes públicas (prensa, fichas de tiendas). Sin cuentas, sin descompilar apps de terceros, sin capturar tráfico ajeno. El recorrido de nuestra app queda cubierto por las pruebas de punta a punta (`apps/servidor/src/rutas/carroVenezuela.test.ts`).
**Etiquetas:** [OBS] observación pública o prensa · [DOC] documentación oficial o ley · [INF] inferencia nuestra · [NV] no verificado.

## 1. Papeles del conductor de carro

| Hallazgo                                                                                                                                                                                                                             | Etiqueta | Fuente                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------- |
| Ridery y Yummy no publican en abierto la lista de papeles del conductor de carro; el alta se hace dentro de su app de conductor.                                                                                                     | [NV]     | Búsqueda pública del 13 nov 2026 (sitios y fichas de las apps). |
| Yummy deja trabajar «con tu propio carro o moto» en su modo conductor.                                                                                                                                                               | [OBS]    | Ficha de Yummy Rides en la App Store.                           |
| En agosto de 2026 el INTT exigió a Ridery y Yummy responder por sus conductores y pidió seguros y registro ante el INTT.                                                                                                             | [OBS]    | Descubre.vc (19 ago 2026), Finanzas Digital.                    |
| Para circular en Venezuela un carro lleva licencia de conducir del grado que corresponde, certificado médico, título de propiedad o certificado de registro (carnet de circulación) y póliza de responsabilidad civil (RCV) vigente. | [DOC]    | Ley de Transporte Terrestre y su reglamento (INTT).             |
| Uber, en sus requisitos públicos de EE. UU.: licencia vigente, seguro, inspección del vehículo aprobada, antecedentes y récord de manejo.                                                                                            | [REA]    | Ficha `2026-10-30-carro.md`.                                    |

**Decisión [INF]:** en Venezuela, sin proveedor automático de antecedentes, el taxista sube su **licencia de conducir** y su **certificado de antecedentes penales**, más su cédula por la verificación de identidad de siempre. El carro lleva **título de propiedad o carnet de circulación** (registro), **póliza RCV**, **póliza que cubre a los pasajeros** (puede ser la misma RCV si cubre ocupantes), **revisión del vehículo** (inspección) y fotos. Todo lo aprueba una persona del equipo, igual que en Moto. La edad mínima se queda en 21 hasta que el abogado diga otra cosa. En EE. UU. no cambia nada: Checkr, inspección y seguro de pasajeros siguen como estaban sembrados.

## 2. Tarifa de Carro

| Hallazgo                                                                                                                                                      | Etiqueta | Fuente                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Trayecto corto de 1,2 km en Caracas, en carro: Ridery cerca de 4,20 dólares y Yummy cerca de 4,25 (febrero 2026). En moto, en el mismo trayecto: 0,98 y 1,29. | [OBS]    | Comparación de prensa citada por Valora Analitik y medios venezolanos. |
| Los taxis en Caracas arrancan en 3 o 4 dólares según el trayecto (marzo 2026).                                                                                | [OBS]    | El Diario, «¿Cuánto cuesta vivir en Caracas en 2026?».                 |
| Yango muestra el precio en bolívares y en dólares, con la tasa oficial.                                                                                       | [OBS]    | Descubre.vc (27 ago 2026).                                             |

**Decisión [INF]:** `TARIFA_CARRO_VENEZUELA` en centavos de dólar (`packages/compartido/src/perfilPasajeros.ts`), de prueba, para una ciudad mediana como El Vigía (algo por debajo de Caracas): base 1,50; 0,45 por kilómetro; 0,06 por minuto; mínimo 3,50 (Caracas cobra 4,20 y los taxis arrancan en 3 o 4); espera gratis de 3 minutos y después 0,10 por minuto; cancelación gratis 2 minutos y después 1,00; «no se presentó» 1,00; sin redondeo y sin precio dinámico. **Carro XL** es la misma tarifa por 1,5 (como «Extra room» de Uber, C-CARRO-XL). Se ajusta con la práctica en la calle.

## 3. Comisión y forma de pago

- La comisión del prepago de Carro en Venezuela es el mismo 10 % aprobado por Richard el 2 nov 2026 (C-PREPAGO-MERCADOS), sembrada en bolívares (`prepago-ve-car`) y en dólares (`prepago-ve-car-usd`). No se inventó otro porcentaje.
- El pasajero paga en efectivo o por pago móvil al conductor (lo mismo de Moto, C-PAGO-MOVIL-VIAJE). En EE. UU., tarjeta (y efectivo si la ciudad lo deja) con propina.

## 4. Lo que depende de Richard

El abogado venezolano (si el registro del INTT alcanza a las apps de pasajeros, edad mínima, seguro de ocupantes), quién recibe las recargas en El Vigía y el número de solicitud de la marca para abrir Venezuela en producción.

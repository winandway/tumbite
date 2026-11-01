# Cómo funciona Divoox Flex (logística para empresas)

Documento madre, 1 nov 2026. Escrito para Richard y para cualquier persona del equipo que tenga que
vender, explicar o probar la logística. Las fuentes están al final. Vale para todos los países; lo
que cambia por país se dice en su sitio.

## 1. Qué vendemos, en una frase

**Divoox Flex es la tecnología para que una empresa de reparto reparta con SUS propios conductores y
vehículos.** Divoox no pone camiones, ni motos, ni conductores. Pone el panel, la app del conductor y
el seguimiento para quien recibe.

Es el mismo negocio que Onfleet y Spoke (antes Circuit) en Estados Unidos. No es el negocio de
Amazon Flex: Amazon Flex contrata conductores independientes por bloques; nosotros le damos la
herramienta a la empresa que ya tiene su gente (ficha REA, sección 5).

**No confundir con «Envíos» de la app de Divoox.** «Envíos de A a B» es otro servicio: una persona
pide que una moto de Divoox lleve algo ya mismo, como un viaje. Flex es para empresas que reparten
muchos paquetes en rutas planificadas, normalmente cargadas el día antes.

## 2. Los jugadores

Hay **dos clientes distintos**:

| Quién                                                      | Qué es                                                                                                                                                         | Qué usa                                                                                                                                                    | Cómo entra                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nuestro cliente: la empresa de reparto**                 | La empresa que nos contrata la tecnología (una courier, una distribuidora, una tienda con flota propia). Tiene sus camiones, carros o motos y sus conductores. | **El panel web** en divoox.com/panel/business (también se abre dentro de la app Divoox, en Envíos → «Bloque de logística»).                                | Crea su cuenta de empresa y se registra con sus datos legales y su primer centro.                                                                  |
| Su equipo                                                  | Despachadores, administradores, finanzas.                                                                                                                      | El mismo panel, con su rol.                                                                                                                                | El dueño los invita por correo desde «Equipo».                                                                                                     |
| **Sus conductores**                                        | Las personas que manejan y entregan. Son de la empresa, no de Divoox.                                                                                          | **La app Divoox Driver**, sección «Mi ruta (paquetes)».                                                                                                    | La empresa los invita con nombre y celular o correo. Les llega un enlace, instalan Divoox Driver, entran con ese mismo celular o correo y aceptan. |
| **El cliente de nuestro cliente: quien recibe el paquete** | La persona o el negocio al que le llega el paquete.                                                                                                            | **Nada obligatorio.** Recibe avisos con un enlace de seguimiento (divoox.com/track). Si quiere, usa la app Divoox: «Mis paquetes» y «Rastrear un paquete». | No necesita cuenta.                                                                                                                                |
| Divoox                                                     | Nosotros.                                                                                                                                                      | El superadmin («Flex · Dinero»).                                                                                                                           | Cuenta de Soporte.                                                                                                                                 |

**Respuesta corta a «¿la empresa necesita otra app?»: no.** La empresa trabaja en el panel web.
Sus conductores usan Divoox Driver. Quien recibe usa el enlace o, si quiere, la app Divoox. Es
exactamente el reparto de Onfleet y Spoke: panel web para la empresa, app para el conductor y
seguimiento sin app para quien recibe.

## 3. Lo que se le entrega a la empresa (el día uno)

1. **Su cuenta y su empresa:** se registra con nombre comercial, razón social, país, moneda, número
   fiscal (EIN en EE. UU., RIF en Venezuela, NIT en Colombia, RFC en México), dirección fiscal,
   representante, teléfono y su primer centro de carga con su punto exacto.
2. **El panel**, con un «Primeros pasos» que se va marcando solo: centro, conductores, primer envío,
   etiquetas, ruta asignada y primera entrega.
3. **Sus conductores invitados** en Divoox Driver.
4. **La guía paso a paso** en Docs («Empieza con Divoox Flex»), con las pantallas reales.

## 4. El día de trabajo (cómo lo hacen los grandes y cómo lo hacemos)

| Paso                     | Quién               | Dónde                          | Qué pasa                                                                                                                                                                        |
| ------------------------ | ------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Cargar los envíos     | Empresa             | Panel → Envíos                 | Uno por uno, con una planilla CSV (guardada desde Excel o Google Sheets) o por la API.                                                                                          |
| 2. Imprimir etiquetas    | Empresa             | Panel → Etiquetas              | Una por paquete, con código QR y código de barras. Se pega en cada caja o sobre.                                                                                                |
| 3. Armar la ruta         | Empresa             | Panel → Rutas → «Nueva ruta»   | Elige los envíos y el centro. Divoox sugiere el orden de las paradas.                                                                                                           |
| 4. Asignarla             | Empresa             | La página de la ruta           | «Asignar» a su conductor (propio) u «Ofrecer» con plazo (red).                                                                                                                  |
| 5. Cargar el vehículo    | Conductor           | Divoox Driver → Mi ruta        | «Llegué al centro», escanea cada paquete; sin todo cargado no puede salir.                                                                                                      |
| 6. Repartir              | Conductor           | Mi ruta                        | «Parada actual», navegar con Google Maps, Apple Maps o Waze, escanear el paquete en la puerta, foto, firma o PIN, deslizar para terminar. No deja entregar a más de 200 metros. |
| 7. Avisos a quien recibe | Divoox, solo        | SMS, correo, celular           | «Va en camino», «ya llega» (con conductor, vehículo y placa), «entregado» con la prueba.                                                                                        |
| 8. Lo que no se entregó  | Conductor y empresa | Mi ruta → Panel → Devoluciones | Vuelve al centro; la empresa confirma que lo recibió.                                                                                                                           |
| 9. Ver cómo fue          | Empresa             | Panel → Rutas y Reportes       | Cada parada con su prueba; indicadores del periodo.                                                                                                                             |

## 5. Moto, carro o camión

- **Carro o camioneta:** lo normal en Estados Unidos para paquetes. Se carga el día anterior o
  temprano, ruta de muchas paradas.
- **Moto:** sobres y cajas pequeñas en una caja trasera. Funciona todo el año en Venezuela,
  Colombia, México y en ciudades de clima templado como Miami. En los estados con invierno no es lo
  común.
- En el panel, cada vehículo tiene su capacidad (paquetes, peso, volumen y el lado más largo). Al
  asignar, el panel avisa si la ruta no cabe en ese vehículo. El vehículo sale de lo que el
  conductor registró en Divoox Driver.

## 6. Cada país

- **Estados Unidos:** avisos por SMS (cuando Twilio apruebe el número), correo y celular. Sin cobro
  contra entrega.
- **Venezuela:** cédula o RIF, ubicación confirmada antes de asignar (las direcciones son
  imprecisas), cobro contra entrega en dólares o bolívares con la caja de la ruta, tasa del BCV,
  retiro en el centro. El SMS no se usa por su costo: avisos por la app, correo y el enlace que la
  empresa manda por WhatsApp.
- Colombia y México usan hoy las mismas reglas que Estados Unidos.

## 7. Cuánto cobra el mercado (referencia para cuando fijemos precio)

Casi nadie cobra por conductor: cuota mensual con entregas incluidas, más un cobro por entrega
extra (ficha REA, sección 4). Onfleet desde 619 dólares al mes; Spoke 125, 200 y 1.000; Shipday desde
99; Routific 150 hasta mil pedidos; Tookan 99, 249 y 399. **Hoy Divoox Flex no cobra** (las
recargas de la billetera están apagadas hasta que Richard decida el precio).

## 8. Lo que todavía no está (dicho sin adornos)

- **Portal del comercio:** una tienda que le manda pedidos a la empresa de reparto por su propio
  portal. Hoy lo hace la empresa o su sistema por la API.
- **GPS con la app cerrada:** el conductor manda su ubicación con la app abierta. En segundo plano
  espera a que Google apruebe la versión actual de Driver.
- **Prueba gratis automática:** hoy la empresa se registra y empieza; no hay un plan de prueba con
  fecha.
- **Conductor que solo trabaja para empresas:** usa la misma app Divoox Driver, que también muestra
  lo de comida. Funciona; la pantalla de inicio todavía no se simplifica para él.

## Fuentes

- Ficha REA: `docs/investigaciones-rea/2026-11-01-logistica-actores-y-flujo.md` (capturas REA de
  Onfleet, Spoke, Shipday, Routific y Tookan, con sus hashes).
- Estudio de Amazon Flex: `docs/investigaciones-rea/2026-10-30-amazon-flex-capturas.md`.
- Inventario del código del 1 nov 2026 y `CANDADOS.md` (C-FLEX-*).
- Plan de este trabajo: `docs/PLAN-LOGISTICA-2026-11-01.md`.

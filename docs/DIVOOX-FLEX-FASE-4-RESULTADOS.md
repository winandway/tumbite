# Divoox Flex · Fase 4 — Resultados

Fecha: 27 de octubre de 2026. Rama `fase-flex-4`, creada sobre `fase-flex-3`. **Solo desarrollo y sitio de pruebas, con Stripe en modo prueba.** Sin cobros, transferencias ni retiros reales; producción no se tocó; Deliveries no se publicó; la experiencia de Food no cambió.

Documentos relacionados: `docs/API-DIVOOX-FLEX-V1.md` (sección «Fase 4»), `docs/REQUISITO-MONETIZACION-PREPAGO-MULTISERVICIO.md` (requisito de Richard del 27 oct con su auditoría), `VERIFICAR-PAGOS.md`, `CANDADOS.md` (C-FIN-*).

## 1. Funciones implementadas

- **Capa común de políticas financieras** para todos los servicios (flex, express, food, ride, car, grocery): quién paga (empresa o conductor), país, ciudad, empresa, moneda, modalidad (saldo prepago, Stripe Connect o sin cobro), regla (por paquete, por ruta, porcentaje con mínimo y máximo, por volumen, exenta), promociones (descuento con vigencia y prioridad), revisión legal obligatoria para el prepago de conductores. Ninguna tarifa vive en el código; sin política, no se cobra nada.
- **Billetera prepago de cada empresa** sobre el libro contable existente: disponible, reservado, pendiente (deuda), total, movimientos, alertas.
- **Recargas con Stripe en modo prueba**: importes sugeridos y personalizado con límites por país, idempotencia, pago dentro de la pantalla, acreditación solo por el aviso firmado y una sola vez, pagos rechazados, cancelados, reembolsos, disputas, recarga automática opcional con tarjeta guardada, comprobante numerado.
- **Comisiones y reservas en las rutas**: se aparta al asignar u ofrecer (si no alcanza, la ruta no sale), se cobra cada paquete entregado en la misma transacción de la entrega, se libera lo de los faltantes al salir, se cobra la regla por ruta y se libera el resto al cerrar, todo se devuelve al retirar, vencer o cancelar. La tarifa queda congelada en la ruta.
- **Sin saldos negativos**: lo que un reembolso o una disputa perdida no puede cubrir queda como deuda; con deuda no salen rutas nuevas facturables (las que ya salieron terminan); lo liberado y la próxima recarga pagan primero la deuda.
- **Conductor prepago** reutilizable por servicio (cobro atómico e idempotente, nunca negativo, separado de las ganancias retirables), activable por mercado solo con revisión legal aprobada. No se enchufó a Food.
- **Servicio logístico completo** separado en tecnología de Divoox, transporte, conductor, procesador de pagos e impuestos (cálculo y simulador; sin transferencias).
- **Conciliación y recuperación** en el reloj existente: recargas pendientes contra Stripe, reservas huérfanas, invariantes del libro y pieza `billeteras` en la salud.
- **Superadmin financiero**: políticas (crear, cerrar hacia adelante, revisión legal), límites de recarga por país, billeteras de las empresas con movimientos y auditoría, ajuste manual y reembolso con la contraseña del administrador y un motivo, conciliación y simulador.
- **Panel financiero de la empresa**: Mi billetera, Recargar, Comisiones, Comprobantes (imprimir o PDF), Configuración (alertas, correo, recarga automática, quitar tarjeta), en español e inglés, celular y escritorio.
- **Protección nueva del libro**: ninguna fila del libro contable se puede editar ni borrar (disparadores); la auditoría financiera y los comprobantes tampoco.
- **Rediseño pedido por Richard** (maquetas del 27 oct): panel de Paquetes con selección y acciones en bloque, etiqueta nueva con QR, Code 128, ruta y parada, hoja de impresión; «Mi ruta» del conductor con rutas por pestañas, mapa numerado, línea de paradas, detalle de parada, escáner, confirmación de carga, entrega completada y resumen de la ruta.

## 2. Archivos creados

- Compartido: `packages/compartido/src/finanzas.ts`, `finanzas.test.ts`.
- Servidor: `apps/servidor/src/finanzas/politicas.ts`, `billetera.ts`, `cobrosRuta.ts`, `conductor.ts`, `reloj.ts`, `rutasEmpresa.ts`, `rutasAdmin.ts`, `finanzas.test.ts`.
- Panel: `apps/panel/src/panel/flex/PantallasBilletera.tsx` y su prueba, `apps/panel/src/panel/SuperFinanzas.tsx` y su prueba.
- App del conductor (rediseño): `apps/repartidor/src/flex/piezas.tsx`, `MapaRuta.tsx`, `MapaRuta.web.tsx`, `colorTono.ts`.
- Scripts y documentos: `scripts/staging/probar-billetera-flex.mjs`, este informe, `docs/REQUISITO-MONETIZACION-PREPAGO-MULTISERVICIO.md`.

## 3. Archivos modificados

- `schema.sql` (tablas nuevas, columna `disputas.recarga_empresa_id`), `apps/servidor/src/esquema.ts`, `esquemaColumnas.ts`, `esquemaFlex.ts` (disparadores de inmutabilidad).
- `apps/servidor/src/flex/rutasEmpresa.ts` (reserva y liberación), `flex/conductor.ts` (ajuste al salir, cobro en la entrega, cierre), `flex/index.ts`, `flex/envios.ts` (rediseño: ruta y parada en la etiqueta, filtro por centro), `rutas/pedidos.ts` (eventos de Stripe de las recargas de empresa), `rutas/stripeAvisos.ts` (eventos del aviso principal), `rutas/operacion.ts` (tareas del reloj), `app.ts` (rutas y salud), `mensajesEn.ts`.
- `packages/compartido/src/flex.ts` (permiso `finanzas.gestionar`), `index.ts`.
- Panel: `PanelEmpresa.tsx`, `PantallasEnvios.tsx`, `PantallasRutas.tsx`, `textos.ts`, `PanelApp.tsx`, `panel/textos.ts`, `estilos.css`, `sitio/docs/guias.ts`, `package.json` (Stripe en el panel).
- App del conductor: `apps/repartidor/src/flex/MiRuta.tsx`, `textos.ts`.
- Límites de tiempo: `apps/servidor/src/correo.ts` (10 s), `notificaciones.ts` (10 s), `stripe.ts` (25 s) y `packages/compartido/src/api.ts` (30 s en el cliente común), con `correoLimite.test.ts` y `api.test.ts` (C-LLAMADAS-CON-LIMITE, C-PEDIDO-CON-LIMITE). `e2e/recorrido/recorrido.spec.ts` e `internacional.spec.ts` ya no esperan «la red quieta» del panel.
- `.github/workflows/pruebas-rama.yml` (eventos de Stripe de prueba en staging), `docs/API-DIVOOX-FLEX-V1.md`, `VERIFICAR-PAGOS.md`, `CANDADOS.md`, `PENDIENTES.md`, `PLAN.md`, `CLAUDE.md`.

## 4. Tablas y migraciones

Todas nacen con `CREATE TABLE IF NOT EXISTS` (seguras en cada publicación): `politicas_financieras`, `finanzas_auditoria`, `flex_cobros_ruta`, `recargas_empresa`, `comprobantes`, `empresa_finanzas`. Columna nueva en tabla existente, por la lista segura `COLUMNAS`: `disputas.recarga_empresa_id`. Disparadores nuevos (recreados al arrancar): `politicas_financieras_inmutables`, `politicas_financieras_cierre_adelante`, `politicas_financieras_sin_borrar`, `finanzas_auditoria_inmutable_update/delete`, `libro_inmutable_update/delete`, `comprobantes_inmutables_update/delete`. El dinero sigue en `libro` (no hay un segundo sistema).

## 5. Endpoints

- Empresa (prefijo `/datos/v1/flex`, 9): `GET …/billetera`, `GET …/billetera/movimientos`, `GET …/billetera/recargas`, `GET …/billetera/recargas/{r}`, `POST …/billetera/recargas`, `GET …/billetera/comisiones`, `GET …/comprobantes`, `GET …/comprobantes/{c}`, `PUT …/billetera/config`, `POST …/billetera/metodo/quitar`.
- Superadmin (prefijo `/datos/admin/finanzas`, 13): políticas (listar, crear, cerrar, revisión legal), límites de recarga (leer, guardar), empresas, movimientos de una empresa, ajuste, reembolso, conciliación (ver, correr), simulador logístico.
- Interno: `POST /datos/interno-stripe/avisos/principal/eventos`.

## 6. Pantallas

Ver sección 1. Capturas en `docs/capturas/flex/` (rediseño y billetera).

## 7. Integración con Stripe (modo prueba)

- Auditoría de lo existente: Payment Intents de pedidos (autorización y captura al entregar), Connect Express para restaurantes y repartidores, transferencias y retiros (Fase 0, apagados), reembolsos de pedidos, disputas por aviso, conciliación diaria, dos secretos de aviso. **Nada de eso se modificó.**
- Lo nuevo usa el mismo aviso firmado con la misma idempotencia persistente (`avisos_stripe`): `payment_intent.succeeded/payment_failed/canceled` con `metadata.tipo = recarga_empresa`, `charge.refunded`, `charge.dispute.*`. Las recargas de empresa se distinguen de pedidos y de recargas de repartidores por su metadata y por su intento.
- Clientes de Stripe por empresa (solo para guardar la tarjeta de la recarga automática); se guarda el id del método y «marca •••• 4 últimos», nunca el número.
- Sin transferencias, sin cargos a cuentas conectadas, sin dinero real.

## 8. Billetera

Saldo = suma del libro por bolsillo, nunca un campo suelto. Cada movimiento con referencia única; el libro no se puede editar ni borrar; los ajustes son filas nuevas con autor y su comprobante.

## 9. Comisiones

Tarifa congelada por ruta (`flex_cobros_ruta.tarifa_unitaria` y `regla_json`). Por paquete o volumen: se cobra cada entrega. Por ruta: al cerrar, si hubo entregas. Porcentual: lista para servicios con valor de operación (Flex no tiene valor por paquete). Exenta y promociones con vigencia.

## 10. Reservas

Lote atómico que solo entra si alcanza; índice único de una reserva abierta por ruta; liberación idempotente; recuperación de reservas huérfanas por el reloj. Probado: dos rutas a la vez con saldo para una sola → una sola se reserva.

## 11. Conciliación

`fin_conciliacion` cada 5 minutos: recupera recargas pagadas cuyo aviso se perdió, cancela las abandonadas un día, libera o cierra reservas huérfanas, compara recargas acreditadas contra el libro y las comisiones de las empresas contra las de Divoox, avisa por correo si hay diferencias y alimenta la pieza `billeteras` de la salud.

## 12. Pruebas ejecutadas

Ver «Resultado de la verificación» al final. Pruebas nuevas: 11 de la capa común, 20 del servidor de dinero, 5 de la billetera del panel, 1 del superadmin financiero, más las del rediseño (panel y conductor). Cubren todas las obligatorias: recarga una sola vez, pago fallido sin crédito, aviso duplicado, comisión duplicada, reservas simultáneas, saldo insuficiente, liberación, reembolso, disputa, separación entre empresas, permisos, conciliación, integridad del libro; la regresión de Food es la batería completa existente. **Candados comprobados en rojo** (se rompió cada protección y su prueba falló): reserva solo si alcanza, una comisión por paquete, recarga acreditada una vez, sin saldos negativos, política no retroactiva, la recarga es de esa empresa, la deuda frena rutas nuevas, lo liberado paga la deuda.

## 13. Estado de staging

Ver «Sitio de pruebas» al final.

## 14. Credenciales configuradas

| Servicio                                         | Estado (comprobado el 27 oct 2026)                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe en el sitio de pruebas                    | Llaves de **prueba** cargadas (salud `stripe` y `webhookStripe` en `ok`); la recarga de prueba se confirmó de punta a punta                           |
| Aviso de Stripe de prueba con los eventos nuevos | Lo agrega el paso nuevo del pipeline de staging (con el secreto del reloj que ya está en GitHub)                                                      |
| Firebase (avisos Android)                        | Proyecto `divoox-apps` con las tres apps; la API de Expo confirma la llave FCM V1 en las tres. Este punto de PENDIENTES estaba viejo y se marcó hecho |
| Expo (EAS)                                       | Organización y proyectos de las tres apps; token del robot guardado fuera del repo                                                                    |
| Llave de cifrado de integraciones (Fase 3)       | En staging                                                                                                                                            |
| Apple (avisos y pruebas en iPhone)               | **Pendiente**: la inscripción de Apple Developer sigue en revisión; no hay credenciales de iOS en Expo                                                |

## 15. Credenciales pendientes

- 👤 Apple Developer (inscripción en revisión; después contrato y 99 dólares).
- Llaves de Stripe de **producción** para Flex: no se tocan en esta fase (los cobros reales necesitan autorización).

## 16. Riesgos regulatorios

- **Saldo prepago (stored value)**: guardar saldo de terceros puede considerarse transmisión de dinero o «stored value» según el estado o el país. Mitigación de diseño: el saldo solo paga comisiones de Divoox (no se transfiere a terceros ni se retira como dinero), los reembolsos vuelven a la tarjeta original por Stripe. **Antes de activarlo comercialmente**, validación legal por mercado (Estados Unidos: reglas estatales de transmisión de dinero y términos de Stripe para saldos prepagados; Sudamérica: proveedores de recarga y regulación de cada país).
- **Comprobantes**: no son facturas fiscales; la facturación fiscal por país queda para el contador.
- **Impuestos** del servicio: el simulador los separa, pero las tasas las fija el contador.
- **Prepago de conductores**: solo con revisión legal y comercial aprobada por mercado (la política no rige sin ella).

## 17. Limitaciones

- La recarga automática usa la tarjeta guardada fuera de sesión: si el banco pide verificar (3D Secure), falla y se avisa a la empresa; no hay reintento automático.
- Un reembolso que Stripe confirme como fallido después de pedirlo no se revierte solo (raro; queda para soporte).
- La regla porcentual no aplica a Flex (no hay valor por paquete).
- El conductor prepago está listo pero no enchufado a ningún servicio (Food sigue igual; Express y Grocery no existen todavía).
- El servicio logístico completo (empresa paga transporte a conductores Divoox) queda en desglose y simulador; sin transferencias.
- El rediseño del conductor se vio en la versión web; el mapa nativo, la cámara y la firma con el dedo esperan un celular real.

## 18. Listo para producción y pendiente de activación

- **Listo** (código probado; se publica por el flujo normal cuando Richard lo apruebe): capa de políticas, billetera, recargas, reservas, comisiones, reembolsos, disputas, conciliación, panel, superadmin, rediseño.
- **Pendiente de activación** (no se enciende sin decisión): recargas por país (de fábrica apagadas), políticas de tarifa (ninguna en producción), recarga automática por país, prepago de conductores por mercado, llaves de Stripe de producción para Flex, compra real de prueba.

## 19. Recomendaciones para la siguiente fase

1. Compra real mínima (1 dólar) de una recarga de empresa en producción, con autorización, antes de anunciar nada.
2. Validación legal del saldo prepago en EE. UU. y en el primer mercado de Sudamérica.
3. Fijar la primera tarifa comercial (Richard) y crearla como política.
4. Unificar Food en cobro directo con la capa de políticas sin cambiar su resultado, y enchufar Express y Grocery cuando existan (`docs/REQUISITO-MONETIZACION-PREPAGO-MULTISERVICIO.md`).
5. Piloto en la calle con celulares reales (`docs/DIVOOX-FLEX-PROTOCOLO-PILOTO.md`).

**Esperando la autorización para la siguiente fase.**

## Resultado de la verificación

- `npm run verify` en verde: 164 archivos de pruebas (163 pasan, 1 omitido), **1019 pruebas pasan**, 2 omitidas; tipos, lint, compilación y auditoría sin vulnerabilidades.
- Candados comprobados en rojo: los de la sección 12, más C-STRIPE-AVISO-PRINCIPAL (el aviso de pruebas también escucha `account.updated`), C-LLAMADAS-CON-LIMITE y C-PEDIDO-CON-LIMITE.

## Sitio de pruebas

- Recarga de punta a punta con Stripe en **modo prueba** (tarjeta de prueba `pm_card_visa`, `scripts/staging/probar-billetera-flex.mjs`): 10 dólares, la misma clave de idempotencia no abre dos recargas, el aviso firmado acreditó el saldo una sola vez, comprobante `DVX-2026-000001`.
- Reembolsos parciales de prueba (3 y 2 dólares): el saldo bajó a 5; el aviso `charge.refunded` se recibió y no descontó dos veces.
- Salud del sitio: esquema, Stripe, aviso de Stripe, libro y reloj en `ok`; billeteras en `pendiente` hasta la primera conciliación del reloj.
- Hallazgos de staging corregidos en esta fase: el aviso principal no se reconocía (escucha más eventos), llamadas a correo/Expo/Stripe sin límite y el recorrido de Comida colgado 15 minutos por esperar la red quieta del panel.
- Nada de esto tocó producción ni movió dinero real.

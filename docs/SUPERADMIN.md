# Superadmin de Tumbite (12 oct 2026)

Lo que el superadmin maneja y por qué, tomando como referencia lo que DoorDash pide a repartidores y restaurantes.

## Qué pide DoorDash (leído el 12 oct 2026)

- **Repartidores (Dashers):** documento con foto, licencia vigente, datos del vehículo, seguro vigente si usa motor, consentimiento y verificación de antecedentes (la hace un tercero como Checkr), y datos bancarios para cobrar. Fuentes: https://triplog.net/blog/doordash-driver-requirements-explained , https://www.everlance.com/gig-guides/doordash-requirements , https://mileiq.com/mileage-guide/doordash-driver-requirements-how-to-start-driving-as-a-dasher
- **Restaurantes (merchants):** nombre legal de la empresa, número fiscal (EIN), dueño con fecha de nacimiento, dirección y horario del local, y banco. Fuente oficial: https://help.doordash.com/en-us/merchants/article/sign-up-for-doordash

## Cómo lo hace Tumbite

| Dato                                                                                        | Dónde vive                                                 | Quién lo ve                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| ID del repartidor `PAÍS-CIUDAD-número` (US-MIA-000123)                                      | `repartidores.codigo`, contador por ciudad en `contadores` | Repartidor (en «Mis datos»), superadmin  |
| Vehículo, licencia, seguro, antecedentes, seguro de Tumbite                                 | `repartidor_datos`                                         | Repartidor y superadmin                  |
| Empresa del restaurante: nombre legal, tipo, dirección fiscal, dueño, manager, horario, web | `restaurante_empresa`                                      | Restaurante y superadmin                 |
| KYC: documento, cara, foto del local con ubicación                                          | `kyc` + almacén privado `kyc/<usuario>/…`                  | Solo superadmin (ruta propia, sin caché) |
| Bitácora de cada pedido: estados, quién, hora y lo que hizo el Manager                      | `historial_estados` + `bitacora_pedidos`                   | Solo superadmin (`…/pedidos/<id>`)       |
| Número de seguro social, EIN y banco                                                        | **Stripe Connect** (no en Tumbite)                         | Stripe                                   |

El código de ciudad usa tres letras (MIA, NOV, ORL, TPA) en vez de dos para que no choquen ciudades del mismo país (Miami y Michigan empiezan igual). El código de cada zona se puede fijar en `zonas.codigo_ciudad`.

## A escala de un millón de usuarios

- Toda lista va **paginada por clave** («cargar más», sin `OFFSET`) de a 50.
- Todo buscador usa un índice: ID exacto o «empieza por», número del ID, correo exacto, teléfono «empieza por», nombre «empieza por» (índice `nombre COLLATE NOCASE`).
- Todo entra **por ciudad** primero.
- Siguiente paso cuando haga falta: búsqueda por palabras dentro del nombre con FTS5.

## KYC

- Con `KYC_OBLIGATORIO=1` (variable del sitio, decisión de Richard): sin KYC aprobado el repartidor no se conecta y el restaurante no se aprueba. Hoy está apagado para no frenar la prueba en la calle.
- Los restaurantes se vuelven a verificar cada año (`proxima_revision`).
- La foto del local se compara con la dirección: a más de 300 metros queda marcada.
- La revisión automática con IA (comparar cara y documento, leer el documento) va después, con el tope de gasto aprobado; alternativa sin IA propia: Stripe Identity (cobra por verificación; confirmar precio antes).

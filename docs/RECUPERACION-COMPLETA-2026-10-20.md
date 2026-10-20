# Recuperación completa: base y archivos — 20 oct 2026

> Estado: **diagnóstico y propuesta. Nada se copió, nada se contrató, no se creó ningún recurso.** Lo que pide permiso está en la solicitud única del 20 oct (`docs/SOLICITUD-AUTORIZACIONES-2026-10-20.md`, grupo 2).

## 1. Qué se guarda hoy y dónde (inventario de solo lectura, 20 oct)

Tumbite tiene un solo almacén de archivos por sitio. En él viven, juntos, los archivos de la operación y los respaldos de la base.

| Carpeta del almacén              | Qué es                                               | Quién lo sube           | Retención hoy                                                                   | Producción                      | Staging                      |
| -------------------------------- | ---------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- | ------------------------------- | ---------------------------- |
| `evidencias/<pedido>/recogida-…` | Foto del pedido en el restaurante                    | Repartidor              | 30 días; se queda si hay un reclamo abierto                                     | 0                               | 135 (4,8 MB)                 |
| `evidencias/<pedido>/entrega-…`  | Foto de la entrega en la puerta                      | Repartidor              | 30 días; ídem                                                                   | 0                               | 122 (5,6 MB)                 |
| `evidencias/<pedido>/ticket-…`   | Ticket del pago en el local (cobro en mano)          | Repartidor              | 30 días y solo si el pedido quedó conciliado sin diferencias                    | 0                               | 0                            |
| `kyc/<persona>/…`                | Documento de identidad, cara, local, foto de control | Repartidor, restaurante | Mientras exista la cuenta; se borra con ella                                    | 0                               | 115 (3,7 MB)                 |
| `vehiculos/<persona>/…`          | Registro, seguro, fotos del vehículo                 | Conductor               | Mientras exista la cuenta; **desde hoy** se borra con ella (C-BORRADO-VEHICULO) | 0                               | 0                            |
| `fotos/<restaurante>/…`          | Fotos de los platos (públicas)                       | Restaurante             | Sin vencimiento                                                                 | 2 (0,07 MB)                     | 0                            |
| `respaldos/<día>/<tabla>.json`   | Respaldo diario de la base, tabla por tabla          | El servidor, cada día   | 30 días                                                                         | 580 archivos, 10 días (0,75 MB) | 207 archivos, 2 días (27 MB) |

Producción todavía casi no tiene archivos porque no hay operación real; staging muestra el peso típico: unos 40 KB por foto.

## 2. Qué se perdería hoy (exposición)

| Si pasa esto                                   | Base de datos                                                                         | Fotos de pedidos y tickets | Identidad y vehículo                                   | Fotos de platos                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Se borra una fila por error                    | **Se recupera** del respaldo del día (C-RESTAURACION-AISLADA, C-RESTAURACION-SIEMPRE) | —                          | —                                                      | —                                              |
| Se borra un archivo por error                  | —                                                                                     | **Perdido**: no hay copia  | **Perdido**                                            | **Perdido** (el restaurante la vuelve a subir) |
| Se pierde o se vacía el almacén entero         | **Perdida**: los respaldos viven en ese mismo almacén                                 | **Perdidas**               | **Perdidas**: los repartidores repiten la verificación | **Perdidas**                                   |
| Una llave del sitio cae en malas manos y borra | **Perdida** (la misma llave borra base y respaldos)                                   | **Perdidas**               | **Perdidas**                                           | **Perdidas**                                   |

**Lo más grave:** el respaldo de la base está en el mismo lugar que lo que protege. Es una copia, no un respaldo independiente. Las fotos de entrega y los tickets son la evidencia de las disputas y del cobro en mano: perderlas durante un reclamo abierto es perder el caso.

## 3. Solución propuesta (no ejecutada)

**Principio:** una segunda copia en un almacén **separado**, en una cuenta distinta, al que el sitio solo puede **escribir** (no borrar), con retención fija.

1. **Destino:** un almacén nuevo de Cloudflare (R2) en la cuenta de Windoce que ya usamos para los Workers de la Fase 2, que no es la del sitio. Nombre propuesto: `tumbite-respaldo`. Requiere la autorización de crear el recurso.
2. **Quién copia:** el reloj (`tumbite-reloj`) una vez por hora: lista lo nuevo del almacén del sitio y lo copia al destino con la misma clave. La base sigue respaldándose cada día y esa copia también viaja. Credencial del reloj sobre el destino: solo escribir y leer, nunca borrar.
3. **Retención en el destino** (reglas de ciclo de vida del propio almacén, no código):
   - Respaldos de la base: 30 diarios + el del día 1 de cada mes durante 12 meses.
   - Fotos de pedidos y tickets: 90 días (30 de la retención actual + margen para reclamos tardíos y contracargos). Las que tienen reclamo abierto se vuelven a copiar mientras siga abierto.
   - Identidad y vehículo: la copia se borra **a los 30 días** de que se borre el original, para cumplir lo que promete la página de borrar la cuenta. Ese borrado lo hace una tarea aparte con su propia credencial, registrada.
   - Fotos de platos: 30 días después del original.
4. **Bloqueo:** regla de retención del almacén para que nada se pueda borrar antes de su plazo, ni siquiera con la llave (si la plataforma lo ofrece en ese plan; se comprueba antes de encender).
5. **Prueba mensual:** restaurar en aislado un respaldo de la copia y una muestra de fotos, con el mismo verificador de C-RESTAURACION-SIEMPRE. Canario nuevo «copia»: error si la última copia tiene más de 26 horas.
6. **Acceso:** solo Richard y la cuenta de Soporte del equipo; nada público. Todo acceso queda en el registro de la cuenta.

## 4. Costo (precios oficiales de Cloudflare R2, leídos el 20 oct 2026)

Almacenamiento estándar 0,015 dólares por GB al mes; escrituras 4,50 dólares por millón; lecturas 0,36 por millón; salida gratis. Gratis cada mes por cuenta: 10 GB, un millón de escrituras y diez millones de lecturas.

| Escenario                                         | Volumen en la copia   | Escrituras al mes | Costo al mes            |
| ------------------------------------------------- | --------------------- | ----------------- | ----------------------- |
| Hoy                                               | menos de 0,1 GB       | unas 2 000        | 0 (dentro de lo gratis) |
| 10 000 pedidos al mes (3 fotos de 40 KB, 90 días) | unos 4 GB + respaldos | unas 35 000       | 0 (dentro de lo gratis) |
| 100 000 pedidos al mes                            | unos 36 GB            | unas 320 000      | unos 0,40 dólares       |

**Tope de gasto propuesto:** alerta de facturación en la cuenta a 5 dólares al mes. La cuenta de Cloudflare no es prepago: el tope es la alerta y la regla de retención, no un corte automático.

## 5. Lo que queda abierto

- Crear el almacén, la credencial del reloj y las reglas de retención: autorización (grupo 2 de la solicitud).
- Encender el reloj en producción: sigue apagado por orden de Richard; sin él, la copia no corre en producción.
- Comprobar que la regla de bloqueo existe en el plan de la cuenta [NV].
- Mientras tanto: los respaldos de la base siguen siendo diarios y la restauración está probada en cada corrida, pero **no protegen contra la pérdida del almacén**.

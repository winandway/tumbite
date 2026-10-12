# Plan: superadmin completo, a escala de un millón de usuarios (12 oct 2026, noche)

Referencia: lo que DoorDash pide a repartidores y restaurantes (ver `docs/SUPERADMIN.md`).

- [x] 1. Base de datos: código de ciudad en cada zona; ID de repartidor «PAÍS-CIUDAD-número» (ej. US-MIA-000123); vehículo (tipo, marca, modelo, año, color, placa), licencia (número, estado, vence), seguro (aseguradora, póliza, vence, seguro de Tumbite) y verificación de antecedentes; datos de la empresa del restaurante (nombre legal, tipo, dirección fiscal, dueño, manager, horario). Índices para buscar rápido con millones de filas.
- [x] 2. El repartidor llena sus datos (vehículo, licencia, seguro) en su app; el restaurante los de su empresa en su panel. Sin perder lo escrito.
- [x] 3. Superadmin — Ciudades: cada ciudad con sus cuentas (restaurantes, repartidores, clientes, pedidos) y entrar a cada una.
- [x] 4. Superadmin — Repartidores: por ciudad, buscador por ID o nombre, paginado; ficha con datos, vehículo, licencia, seguro (vigente o vencido), antecedentes, nivel, ubicación, historial de entregas, billetera y quejas.
- [x] 5. Superadmin — Clientes: buscador por nombre, correo, teléfono o ID, paginado; ficha con datos, compras, total gastado y quejas.
- [x] 6. Superadmin — Restaurantes: entrar a cada uno: dueño, manager, empresa, menú, pedidos, ventas, calificación y quejas.
- [ ] 7. Datos de relleno marcados «(prueba)»: ciudades de prueba y repartidores con vehículos y seguros (algunos vencidos) y clientes, en producción, fáciles de borrar.
- [x] 8. KYC (pedido por Richard en medio del trabajo): el repartidor y el dueño del restaurante toman con la app la foto del documento (frente y reverso) y una foto de su cara; el restaurante además una foto del local con la ubicación del celular (para que no se registren restaurantes falsos ni mudados). Las fotos van a un almacén PRIVADO (nunca públicas). El superadmin las ve lado a lado y aprueba o rechaza; sin KYC aprobado, el repartidor no recibe pedidos y el restaurante no se publica. Revalidación periódica del local. La revisión automática con IA va después, con el tope de gasto aprobado.
- [ ] 9. Privacidad actualizada (licencia, seguro, antecedentes), pruebas, verify, publicar y comprobar en vivo.

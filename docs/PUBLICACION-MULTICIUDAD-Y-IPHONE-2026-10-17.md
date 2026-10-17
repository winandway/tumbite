# Multiciudad en producción y apps en el simulador de iPhone — 17 oct 2026

## 1. Multiciudad y franquicias en producción

- **Commit publicado:** `bac14e2a`, la unión de `fase-franquicias-multiciudad` `38aadbdf`. Es **idéntico** al código aprobado en staging (`git diff` vacío) e incluye los ajustes visuales. El paquete se sirve en yapanel-build y producción responde `bac14e2`.
- **Restauración:** etiquetas `restauracion-antes-territorio-main` (`d97420cb`) y `restauracion-antes-territorio-paquete` (`66f81e54`), subidas.

| Condición                          | Resultado                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Control previo                     | VERDE                                                                                                                                                                                                                    |
| Datos conservados                  | Conteos idénticos antes y después: 16 pedidos, 52 usuarios, 5 restaurantes, 24 repartidores, 4 ciudades (2 activas), 0 franquicias, 0 tickets, 0 movimientos, 0 cobros                                                   |
| Migraciones                        | Tablas `areas`, `franquicia_areas` y `franquicia_miembros` creadas; la tabla de franquicias tiene la forma nueva (varias por ciudad)                                                                                     |
| Miami con su cobertura actual      | Cero áreas dibujadas; `/datos/cobertura` en el centro de Miami responde «dentro», por su círculo                                                                                                                         |
| Sin ciudades ni territorios nuevos | Activas, las mismas de antes: Miami y Novi. Áreas: 0                                                                                                                                                                     |
| Condiciones comerciales            | Sin valores; ninguna franquicia creada                                                                                                                                                                                   |
| Superadmin y panel de franquicias  | `/panel` y `/panel/franchise-…` responden 200. Sus datos responden 401 sin sesión (protegidos). Con sesión se probaron en el panel local con el mismo código: dibujar un área, asignarla y ver el panel de la franquicia |
| Verificador posterior              | VERDE                                                                                                                                                                                                                    |

No se repitieron en producción las pruebas que ya pasaron en staging.

**Falta comprobar con sesión en producción:** solo Richard puede entrar como superadmin. La prueba es abrir Zonas → Áreas y Franquicias → Territorio y equipo.

## 2. Simulador de iPhone

- **Herramientas:** se instaló CocoaPods en esta computadora. Las tres apps se compilan para el simulador sin cuenta de Apple, apuntando a staging.
- **Fallo real encontrado:** con iOS 27 las tres apps **se cerraban al abrir**. iOS 27 exige el ciclo de vida por escenas, y la plantilla nativa de Expo 57 todavía no lo trae (la de Expo 58 sí). A un iPhone real con iOS 27 le pasaría lo mismo.
- **Arreglo:** el complemento `plugins/escenas-ios.js` aplica lo que trae la plantilla de Expo 58, con la pieza que Expo 57 ya incluye:
  - la escena en Info.plist;
  - el SceneDelegate;
  - el arranque sin ventana propia.
- **Resultado:** las tres abren en el simulador (iPhone 18 Pro, iOS 27): la pantalla de entrar en español, con la bandera de España. Android se sigue generando bien.
- **Candado C-ESCENAS-IOS:** en `configMovil.test.ts`, comprobado en rojo.
- **Las apps para el simulador** quedan en `apks-pruebas/ios-simulador/` (fuera de GitHub): `tumbite-cliente.app`, `tumbite-repartidor.app` y `tumbite-restaurante.app`.
- **Cómo se rehacen:** el guion de compilación hace `expo prebuild -p ios`, después `xcodebuild` para el simulador en modo Release, y se instalan con `xcrun simctl install`.

## 3. Lo que sigue pendiente para iPhone real

- 👤 Cuenta de Apple Developer de Windoce LLC: sin ella no se instala en un iPhone físico ni en TestFlight.
- 👤 Organización de Expo y Firebase: activan los avisos al celular.

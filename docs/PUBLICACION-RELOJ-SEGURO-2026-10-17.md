# Publicación del reloj seguro en producción — 17 oct 2026

Autorizada por Richard: «únicamente la rama fase-reloj-seguro, commit 7ba6ed1e».

## Qué se publicó

- Commit en main: `1fe7d2e3` (unión de fase-reloj-seguro `7ba6ed1e`).
- Paquete servido: rama yapanel-build `ecb4712d` («deploy: 1fe7d2e3…»).
- Código: idéntico a fase-reloj-seguro. Las únicas diferencias son documentos que main ya tenía.
- Se excluyó `password_apps.md`, que había entrado por error en la rama (ver «Incidencia»).

## Condiciones de Richard

| #   | Condición               | Resultado                                                                                                     |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Producción segura antes | Verificador «antes» en VERDE                                                                                  |
| 2   | Punto de restauración   | Etiquetas `restauracion-antes-reloj-main` (e2b004c0) y `restauracion-antes-reloj-paquete` (516b4735), subidas |
| 3   | Solo el reloj seguro    | Comprobado con diff contra 7ba6ed1e                                                                           |
| 4   | Fusionar y publicar     | verify y publicar en verde                                                                                    |
| 5   | Verificador posterior   | `despues-reloj` en VERDE; revisor de paquete de producción limpio                                             |
| 6   | Reversión               | No hizo falta: sin regresiones                                                                                |
| 7   | Retiros apagados        | Sí («pendiente, apagado a propósito»)                                                                         |
| 8   | Incidencia del 15 oct   | Sigue visible, sin tocar                                                                                      |

No se activó el reloj de Cloudflare, ni integracion-mvp, ni otras entregas, ni retiros.

## Cómo revertir si hiciera falta

Restaurar la rama yapanel-build a la etiqueta `restauracion-antes-reloj-paquete` y main a `restauracion-antes-reloj-main` (con commit de reversión, nunca borrando historia), y correr el verificador `despues`.

## Incidencia: archivo de contraseñas de prueba en GitHub

- `password_apps.md` (credenciales de prueba de Expo y de las cuentas de cliente, repartidor y restaurante) entró por error en el commit `16cdde4c` de fase-reloj-seguro, aunque `.gitignore` lo excluye.
- El repositorio es público y el archivo sigue en el historial de varias ramas desde el 16 oct.
- No entró en main ni en producción. La copia local sigue intacta.
- Acción recomendada: cambiar esas contraseñas (👤 Richard). Borrarlo del historial es destructivo y espera su decisión.

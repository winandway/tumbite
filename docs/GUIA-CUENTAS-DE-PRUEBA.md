# Cuentas fijas de prueba (sitio de pruebas)

Tres cuentas para probar las apps contra staging, con **un solo correo y sus alias**. Todo llega a la misma bandeja:

| Papel       | Correo                   |
| ----------- | ------------------------ |
| Cliente     | `tucorreo+cliente@…`     |
| Restaurante | `tucorreo+restaurante@…` |
| Repartidor  | `tucorreo+repartidor@…`  |

- **Una sola contraseña de pruebas** para las tres, guardada en el gestor de contraseñas (Bitwarden, 1Password o el de Apple). Nunca se usa en producción ni en cuentas reales.
- Se crean con `node scripts/staging/cuentas-prueba.mjs`: pide el correo y la contraseña en la terminal, y la contraseña no se muestra.
- Si una cuenta ya existe, el guion no la toca.
- El guion solo corre contra staging o localhost. Contra tumbite.com se niega.
- La contraseña no queda escrita en ningún archivo del proyecto.
- La cuenta de restaurante necesita, como cualquier restaurante, armar su ficha y que el equipo la apruebe para recibir pedidos.

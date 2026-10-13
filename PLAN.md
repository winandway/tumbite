# Plan: inglés como idioma principal de Tumbite (13 oct 2026)

- [x] Paso 1: Mapa único de direcciones (en `packages/compartido`): cada página pública con su dirección en inglés y la vieja en español, para redirigir.
- [x] Paso 2: El sitio en inglés por defecto: «/» y todas las páginas sin prefijo en inglés; el español bajo «/es/». El selector de idioma cambia entre las dos direcciones.
- [x] Paso 3: Todas las direcciones en inglés: legales, soporte, borrar cuenta, cómo funciona, recuperar contraseña, confirmar correo, países, ciudades, comidas, Docs (secciones y guías) y las páginas de vuelta de Stripe.
- [x] Paso 4: Redirecciones 301 en el servidor: cada dirección vieja en español lleva a la nueva (la versión en español), y lo viejo bajo «/en» lleva a la dirección sin prefijo. Con el resto de la dirección y sus parámetros.
- [x] Paso 5: Cambiar cada enlace que apuntaba a lo viejo: pie de página, apps (borrar cuenta, términos), correos (confirmar, recuperar), Stripe (vuelta de la billetera), semáforo de publicación, mapa del sitio, robots y llms.txt.
- [x] Paso 5b: Direcciones del panel y de las apps web también en inglés (/panel/orders, /panel/company, /panel/settings, /app/order/…, /app/cart, /driver), con las viejas redirigidas; y arreglar el enlace del correo del recibo, que llevaba a una dirección que no existe.
- [x] Paso 6: Los textos legales dicen que rige la versión en inglés; la española es traducción de cortesía.
- [x] Paso 7: Documentos (tiendas, legales para tiendas, candados) con las direcciones nuevas en inglés.
- [x] Paso 8: Pruebas (direcciones en inglés, redirecciones viejas, prerender en los dos idiomas) comprobadas en rojo; prueba en pantalla en celular y computadora.
- [ ] Paso 9: verify, commit, push, publicación y comprobación en vivo de cada dirección nueva y de cada redirección.

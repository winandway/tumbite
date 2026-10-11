# Plan: Etapa 0.4b + Docs (11 oct 2026, piloto automático)

Lo que depende de Richard queda en PENDIENTES.md (👤). Aquí solo lo que se puede hacer ya.

- [x] Paso 1: Copia de seguridad diaria de la base: ruta protegida `/datos/respaldo` que vuelca cada tabla a JSON en el almacén del sitio (`respaldos/AAAA-MM-DD/tabla.json`), guarda 30 días y borra lo más viejo. El reloj de GitHub la llama una vez al día (3 am Miami). Canario `respaldo` con la fecha del último. Prueba con almacén de mentira.
- [x] Paso 2: Sección pública «Docs» del sitio (regla de la casa: barra lateral con secciones e íconos, buscador, cada guía con su propia dirección, «← Docs» en celular, colores de Tumbite). Guías iniciales bilingües: comensales (pedir, seguir, regalos, calificar), restaurantes (panel, menú y fotos, pedidos y alarma, agotado, regalos y marketing, resumen y billetera), repartidores (conectarse, ofertas, niveles, billetera, ruta), y cuenta (recuperar contraseña, confirmar correo, borrar cuenta, soporte).
- [x] Paso 3: Enlaces a Docs en el menú y el pie de la landing, en el mapa del sitio y en las apps (ayuda). Prueba de la barra que nunca se pierde y del buscador.
- [x] Paso 4: Verificación completa, prueba en pantalla (celular), publicar por el semáforo, documentar en CANDADOS.md, ROADMAP.md y PENDIENTES.md.

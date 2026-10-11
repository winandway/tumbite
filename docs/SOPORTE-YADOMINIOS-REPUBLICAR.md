# Soporte YaDominios Cloud: tumbite no se republica solo

Reporte armado el 10 oct 2026 (23:26 hora de Miami) para llevarlo a la sesión de YaDominios Cloud.

## Lo comprobado

- Repositorio público `winandway/tumbite`. El sitio `tumbite` (tumbite.com y tumbite.sitios.dev) está conectado a la rama `yapanel-build`.
- El Action `publicar` empuja ahí después de cada `verify` en verde. Los empujones salen bien (con `peaceiris/actions-gh-pages@v4` y el `GITHUB_TOKEN`, historia lineal, sin forzar).
- Lo que está en vivo es el armado del commit `d9e4aff` (10 oct, 23:19 UTC), el que Richard republicó a mano. Su JS es `assets/index-DFiZd-Fa.js`.
- Desde entonces la rama avanzó con 3 empujones que nunca salieron: `344395b` (11 oct 00:48 UTC), `87f8d89` (02:50 UTC) y `51a9126` (03:20 UTC, la cabeza actual, JS `assets/index-DMgwjGF4.js`).
- No es caché: con `?v=aleatorio` sigue saliendo el JS viejo, y el JS nuevo da 404. En tumbite.sitios.dev pasa lo mismo.
- Ya había pasado antes: el 10 oct, desde las 21:12 UTC, entraron 4 empujones y no salió ninguno hasta que se republicó a mano.
- Dato extra: el HTML sale con `cf-cache-status: HIT` aunque tenga `max-age=0`.

## Respuesta y arreglo (11 oct 2026)

- **Causa:** la ronda automática de YaDominios revisaba solo los 10 sitios con la publicación más vieja, y esa lista no rotaba. Tumbite era el undécimo y nunca se revisaba. Además, la republicación manual no guardaba el SHA publicado.
- **Arreglo de ellos:** ahora se revisan todos los sitios en cada ronda (se publican como máximo 5 por ronda y el resto queda en cola), se avisa si hay más de 10 minutos de atraso, y el registro muestra «En vivo» frente a «En tu rama». Funciona desde las 03:34 UTC.
- **El empujón de las 03:27 UTC no existió:** ese push era solo de documentos, el armado salió idéntico y el Action no tenía nada que empujar.

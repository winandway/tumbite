# Plan: Pie de página profesional + páginas por país (12 oct 2026, piloto automático)

- [x] Paso 1: Datos de cobertura en un solo lugar (`apps/panel/src/sitio/cobertura.ts`): países (Estados Unidos activo en verde; Rumanía, Colombia, México, Venezuela, Guatemala y Bolivia «muy pronto») y ciudades (Miami activa; Orlando, Tampa y Ocala próximas), bilingüe, con su dirección propia.
- [x] Paso 2: Pie de página nuevo (`Pie.tsx`): fondo negro estilo DoorDash, arriba el bloque de Uber con pestañas Ciudades / Países / Tipos de comida; columnas Conócenos, Te ayudamos, Negocios (con «Franquicias: muy pronto»), insignias de App Store y Google Play, redes, legal, crédito de Windoce. Enlaces reales (HTML) para el SEO.
- [x] Paso 3: Página por país (`/pais/<slug>`) y por ciudad (`/ciudad/<slug>`): título, estado (activo / muy pronto), texto para el SEO, formulario de lista de espera de los tres públicos, canónica y mapa del sitio.
- [x] Paso 4: Servidor: `/pais/*` y `/ciudad/*` públicas con caché y canónica. Pruebas: pie en los dos idiomas, página de país con formulario, mapa del sitio con todas las direcciones.
- [x] Paso 5: Verificación completa, prueba en pantalla (celular y escritorio), publicar por el semáforo, documentar (CANDADOS, PENDIENTES).
- [x] Paso 6: Prompt para la sesión de Laboratorio AI con la investigación de franquicias por ciudad.

# Plan: dejar Divoox Flex (logística para empresas) terminado y entendible

Pedido de Richard el 1 nov 2026: «le vamos a dar un frenazo y vamos a organizar esta parte… terminarlo
al 100%». Fuentes: inventario del código (1 nov) y ficha REA
`docs/investigaciones-rea/2026-11-01-logistica-actores-y-flujo.md`. Todos los países salvo donde se diga.

- [ ] 1. Documento madre «Cómo funciona Divoox Flex»: los jugadores, qué app usa cada uno, el día de trabajo, qué se le vende a quién (docs/LOGISTICA-COMO-FUNCIONA.md).
- [x] 2. La cuenta de una empresa nunca se crea como «restaurante»: el acceso desde /flex y /panel/business crea una cuenta de empresa.
- [x] 3. Un solo registro de empresa, el mismo en la web y en la app: datos legales y primer centro; el Perfil deja editar los datos fiscales.
- [x] 4. Primeros pasos que se van marcando en el Inicio del panel (centro, conductor, primer envío, etiquetas, ruta asignada), cada uno con su botón.
- [x] 5. Menú del panel ordenado por grupos (Día a día / Configuración / Más) y una sola sección «Rutas»: crear (con su centro), asignar u ofrecer y seguir, sin saltar de pantalla.
- [x] 6. Invitar conductores como Onfleet y Spoke (ficha REA): la empresa escribe nombre y teléfono o correo; al conductor le llega el enlace por SMS o correo, instala Divoox Driver y entra como conductor de ESA empresa, sin el alta de repartidor independiente (sin KYC de comida); si ya tiene cuenta, acepta la invitación.
- [x] 7. Vehículo y placa del conductor salen de lo que él registró en Driver (aviso «ya llega», asignación).
- [ ] 8. Textos viejos corregidos (planilla CSV y sus columnas, «la asignación llega en la siguiente fase», «Rutas en curso»).
- [ ] 9. Probar en el sitio de pruebas de punta a punta y publicar en producción.
- [ ] 10. Tutorial público en Docs, español e inglés, con capturas REALES de producción: «Empieza con Divoox Flex paso a paso» (empresa, conductor, destinatario).
- [ ] 11. Prueba completa en producción con la empresa de demostración (registro, centro, conductor invitado, envíos, etiquetas, ruta, entregas) y documento entregado a Richard con el enlace del tutorial.

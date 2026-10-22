# Cambio de marca: de Tumbite a Divoox — plan

> Actualizado el 22 oct 2026 con la decisión de Richard: **Divoox es la marca que se lanza al público; Tumbite queda como nombre interno del proyecto** (como hacen muchas empresas: un nombre de trabajo y después la marca de verdad). **Solo cambia lo que ve la gente.** Tablas, código, carpetas, repositorio, identificadores de las apps y el sitio de pruebas se quedan como Tumbite. Dominio: **solo divoox.com** (pedido en YaDominios el 22 oct; se registra cuando Richard paga el enlace).

## 1. Lo que tiene que pasar antes (Richard)

| Qué                                                         | Estado                           |
| ----------------------------------------------------------- | -------------------------------- |
| Pagar divoox.com (14 USD, un año)                           | Enlace de pago enviado el 22 oct |
| Abogado de marcas: confirmar DIVOOX (revisando Divox)       | Pendiente                        |
| Elegir el logo (escudo moderno u otro del PDF Divoox-marca) | Pendiente                        |

## 1b. Lo que NO cambia (decisión de Richard)

Tablas y datos de la base, nombres internos del código, el repositorio y sus carpetas, el sitio de pruebas (staging.tumbite.com), los identificadores de las apps (com.windoce.tumbite y sus variantes: el público no los ve) y los enlaces internos de las apps. La empresa sigue siendo Windoce LLC.

## 2. Qué cambia, dónde, y quién lo hace

| Parte                                    | Qué hay hoy                                                                                                                                                                       | Qué se hace                                                                                                                                                      | Quién                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Nombre en el código                      | «Tumbite» en un solo lugar central (la marca compartida) y además en unos 270 archivos de las apps, el panel y el servidor (unas 1.200 veces, sin contar los documentos internos) | Cambiar la marca central y repasar los textos de las apps, el panel, los correos y el servidor                                                                   | Claude                                           |
| Apps                                     | «Tumbite», «Tumbite Driver», «Tumbite Restaurants»; enlaces internos «tumbite-cliente», etc.                                                                                      | «Divoox», «Divoox Driver», «Divoox for Restaurants»; enlaces internos nuevos (los viejos siguen funcionando)                                                     | Claude                                           |
| Identificadores de las apps              | com.windoce.tumbite, .driver, .restaurants                                                                                                                                        | **Decisión:** como las apps todavía no están en las tiendas, se pueden cambiar gratis a com.windoce.divoox… Después de publicar ya no. Recomendación: cambiarlos | Richard decide, Claude ejecuta                   |
| Web                                      | tumbite.com con la landing, Docs, legales y paneles                                                                                                                               | divoox.com como dirección principal; **tumbite.com redirige para siempre a divoox.com** (ningún enlace compartido se rompe)                                      | Claude, con el dominio comprado                  |
| Correos                                  | support@, sales@, no-reply@ y jefe@tumbite.com                                                                                                                                    | Los mismos con @divoox.com; activar el correo del dominio nuevo                                                                                                  | Claude                                           |
| Legales                                  | Términos, privacidad, restaurantes, repartidores y borrar cuenta dicen Tumbite                                                                                                    | Cambiar el nombre comercial; la empresa sigue siendo Windoce LLC. **El abogado los revisa**                                                                      | Claude y el abogado                              |
| Docs públicos                            | Guías en español e inglés con capturas                                                                                                                                            | Texto con el nombre nuevo y **todas las capturas rehechas** con el recorrido automático                                                                          | Claude                                           |
| Logo, ícono, favicon, tarjeta para redes | Kit de marca de Tumbite (logo, mascota)                                                                                                                                           | Kit nuevo con el logo elegido: ícono de las tres apps, favicon, imagen para compartir en redes, banners                                                          | Claude prepara; Richard aprueba                  |
| Mascota                                  | La mascota de Tumbite                                                                                                                                                             | **Decisión:** se queda (es un personaje, no un nombre) o se reemplaza por el escudo                                                                              | Richard                                          |
| Stripe                                   | El cobro sale como «Windoce, LLC»                                                                                                                                                 | Poner el nombre público «DIVOOX» en el cobro de la tarjeta                                                                                                       | Richard (en su panel de Stripe)                  |
| Sitio de pruebas                         | staging.tumbite.com                                                                                                                                                               | Puede seguir así o pasar a staging.divoox.com                                                                                                                    | Claude                                           |
| Datos guardados                          | Pedidos, cuentas, dinero                                                                                                                                                          | **No se tocan.** El cambio de marca no mueve ni un dato                                                                                                          | —                                                |
| Tiendas de apps                          | Aún sin publicar                                                                                                                                                                  | Se abren las cuentas de Apple y Google Play ya con Divoox                                                                                                        | Richard abre las cuentas; Claude hace las fichas |

## 3. Orden de trabajo, el día que arranque

1. Rama de trabajo: marca central, apps, panel, servidor, correos y legales.
2. Kit de marca nuevo (ícono, favicon, tarjeta para redes) con el logo elegido.
3. Docs y web: textos y capturas rehechas.
4. Pruebas completas y recorrido en el sitio de pruebas, en inglés y español.
5. Publicar en divoox.com y activar la redirección desde tumbite.com.
6. Fichas de las tiendas con las capturas finales.

## 4. Lo que no cambia

La empresa (Windoce LLC), los colores (rojo escarlata, blanco y gris oscuro, que ya combinan con el escudo), los datos, las cuentas de los usuarios y el funcionamiento de las apps.

## 5. Plan de marketing del lanzamiento de la marca

| Paso | Qué                                                                                                                | Quién                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1    | Elegir el logo y cerrar el kit: colores (los mismos), tipografías, ícono, versiones claro y oscuro                 | Equipo de marketing y Richard; Claude prepara los archivos |
| 2    | Apartar los usuarios en redes: Instagram, TikTok, Facebook, X, YouTube y LinkedIn (@divoox o @divooxapp)           | Equipo de marketing                                        |
| 3    | Web divoox.com con la marca nueva, Docs y legales; tumbite.com redirige                                            | Claude                                                     |
| 4    | Correo support@divoox.com y demás                                                                                  | Claude                                                     |
| 5    | Cuentas de Apple y Google Play a nombre de Windoce LLC, con las apps llamadas Divoox                               | Richard abre las cuentas; Claude hace las fichas           |
| 6    | Nombre «DIVOOX» en el cobro de la tarjeta (Stripe)                                                                 | Richard                                                    |
| 7    | Material de lanzamiento: video, piezas para redes, maletas, cascos y gorras con el escudo                          | Equipo de marketing                                        |
| 8    | Anuncio: «Tumbite ahora es Divoox» solo para quienes ya conocían el nombre (restaurantes y repartidores de prueba) | Equipo de marketing                                        |

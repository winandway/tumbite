# Auditoría de marca Tumbite → Divoox (29 oct 2026) — todos los países

Pedida por Richard el 23 oct 2026. Hecha sobre el código de `main` y sobre lo publicado en divoox.com.

## Resultado

**Lo que ve el público ya dice Divoox en todas partes.** No quedó ningún texto visible con el nombre viejo.

| Dónde se buscó                                                                                  | Cómo                               | Resultado                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Web pública (portada, restaurantes, repartidores, franquicia, legales en los dos idiomas, Docs) | código fuente y páginas publicadas | limpio                                                                                                                                          |
| Código publicado de la web (paquetes JS de divoox.com)                                          | búsqueda de «Tumbite»              | solo nombres internos de variables (`conTumbite`, `seguroTumbite`, `pedidosTumbiteMes`); el texto que muestran dice «Divoox»                    |
| robots.txt, sitemap, llms.txt, canario de salud                                                 | descarga directa                   | limpio                                                                                                                                          |
| Las tres apps (nombre visible)                                                                  | `app.json`                         | «Divoox», «Divoox Driver», «Divoox Restaurants»                                                                                                 |
| Correos                                                                                         | `apps/servidor/src/correo.ts`      | producción manda desde `@divoox.com` desde el 27 oct (no-reply, support, sales, orders, billing, hello), firmados con DKIM por YaDominios Cloud |
| Mensajes del servidor y textos de la base                                                       | `apps/servidor/src` y el esquema   | limpio                                                                                                                                          |

## Lo que se queda con el nombre interno (a propósito)

| Qué                                                                                                                 | Por qué no se cambia                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identificadores de las apps (`com.windoce.tumbite`, `.driver`, `.restaurants`) y esquemas (`tumbite-cliente`, etc.) | Google Play y Apple no dejan cambiar el identificador de una app ya creada: cambiarlo sería otra app nueva y perder las revisiones. El público nunca los ve. |
| Paquetes `@tumbite/*`, tablas, columnas (`seguro_tumbite`), variables del código                                    | Nombre interno del proyecto (regla del CLAUDE.md). No se ve.                                                                                                 |
| Sitio de pruebas en `staging.tumbite.com` y sus correos desde `tumbite.com`                                         | Solo lo usa el equipo; divoox.com no está conectado al sitio de pruebas.                                                                                     |
| `tumbite.com` y `www.tumbite.com`                                                                                   | Redirigen para siempre (301) a divoox.com; las apps viejas siguen pudiendo llamar a la API.                                                                  |
| Identificador de Apple Pay `merchant.com.tumbite.cliente`                                                           | Interno; espera la cuenta de Apple.                                                                                                                          |

## Lo que depende de Richard (ya anotado en PENDIENTES)

- Nombre que sale en el estado de cuenta de la tarjeta (hoy «Windoce, LLC» en Stripe).
- Revisión legal de la marca Divoox con abogado.
- El banner de marketing con la mascota vieja (lo corrige marketing).

## Conclusión

Parte 2 de la auditoría (corregir lo visible): **no hace falta ningún cambio**. El remitente en divoox.com también está hecho.

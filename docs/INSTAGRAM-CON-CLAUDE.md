# ¿Puede Claude gestionar Instagram como community manager? (investigación, 13 oct 2026)

## Respuesta corta

Sí, pero a medias y por terceros. Anthropic no tiene un conector propio de Instagram,
y Meta tampoco: el único conector oficial de Meta es el de **anuncios** (Meta Ads AI
Connectors, beta abierta desde el 29 abr 2026). Lo orgánico (publicar, responder
comentarios) se hace con conectores de terceros que ya están en el directorio de Claude.

## Qué se puede hoy

| Tarea                                                  | ¿Se puede? | Con qué                                                                                                                   |
| ------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| Publicar y programar posts, carruseles, Reels, Stories | Sí         | PostFast, Windsor.ai, Socialync (directorio de Claude)                                                                    |
| Responder, ocultar y borrar comentarios                | Sí         | PostFast (y una respuesta privada por comentario)                                                                         |
| Estadísticas del perfil                                | Sí         | PostFast, Windsor.ai, Supermetrics                                                                                        |
| Leer y contestar DMs                                   | Limitado   | Solo servicios aparte (Zernio, DMdaddy); PostFast no                                                                      |
| Anuncios y promocionar posts                           | Sí         | Conector oficial de Meta Ads (ya está conectado en esta máquina)                                                          |
| Responder solo, 24/7, cuando entra un comentario       | **No**     | Los conectores solo actúan dentro de un chat que uno abre. Se puede programar una tarea periódica que revise cada X horas |

## Requisitos

- Cuenta de Instagram **Business o Creator** (las personales no sirven).
- Cuenta del servicio intermedio (PostFast: 7 días gratis, luego desde 12 €/mes).
- En Claude: Personalizar → Conectores → buscar PostFast → Conectar → iniciar sesión.
  Alternativa: conector personalizado con la dirección `https://mcp.postfa.st/mcp`.
- En cada chat se activa el conector desde el botón «+» → Conectores.
- Cada publicación la muestra Claude antes y espera aprobación.

## Estado en esta máquina

- El conector oficial de Meta Ads ya está conectado. Ve 10 páginas de Facebook
  (Windoce.com, Caprichoso TV, Academia Winandway, etc.). **No aparece ninguna de Tumbite.**

## Fuentes

- PostFast, guía actualizada el 11 oct 2026: https://postfa.st/blog/connect-claude-to-instagram
- Carly, «Claude + Instagram» (26 jun 2026): https://www.usecarly.com/blog/claude-instagram-integration/
- Carly, «Instagram MCP: no official Meta server»: https://www.usecarly.com/blog/instagram-mcp/
- PPC Land, Meta abre su sistema de anuncios a Claude: https://ppc.land/meta-opens-its-ad-system-to-claude-and-chatgpt-with-new-ai-connectors/
- Windsor.ai, publicar en Instagram desde Claude: https://windsor.ai/post-to-instagram-from-claude/
- Supermetrics: https://supermetrics.com/connect/instagram-to-claude
- Socialync: https://www.socialync.io/post-to-instagram-with-claude
- Zernio (DMs): https://zernio.com/instagram-mcp
- Directorio de conectores de Claude: https://claude.com/connectors
- Servidor autoalojado (código abierto): https://github.com/maxx3250/claude-meta-mcp

# Camila atiende el correo como el chat (C-CAMILA-CORREO-HILO)

Pedido de Richard del 20 nov 2026: «que le escriban un correo y le llegue como si fuese el chat, de
manera que ella responda por correo como si estuviese respondiendo el chat, claro, más largo, con más
información». Aplica a todos los países.

## El camino de un correo

1. Alguien responde a un correo de Camila, o escribe a la dirección `support` o `soporte` de
   divoox.com.
2. Cloudflare Email Routing (que ya recibía el correo de divoox.com desde el 4 nov 2026) se lo entrega
   al Worker `divoox-correo` (`apps/tiempo-real/src/correoEntrante.ts`, cuenta de Cloudflare del
   proyecto).
3. El Worker lee el correo (remitente, asunto, texto, cabeceras del hilo, si Cloudflare autenticó al
   remitente y la imagen adjunta) y se lo pasa al servidor: `POST /datos/gerente/camila/correo`, con el
   secreto del gerente.
4. El servidor (`apps/servidor/src/camila/correoEntrante.ts`) decide:
   - lo que no es una persona escribiendo (respuesta automática, rebote, lista, correo masivo, basura,
     remitente sin autenticar, nuestros propios dominios) NO gasta modelo ni recibe respuesta;
   - un mismo correo se atiende una sola vez (por su identificador);
   - topes del día: 150 correos en total, 12 por persona y 4 seguidos en diez minutos;
   - la persona se encuentra por su remitente (la misma ficha de su chat y de su cuenta);
   - los datos de una cuenta solo se miran si el correo es el CONFIRMADO de esa cuenta; a los demás se
     les atiende como visitantes (sin herramientas de cuenta, sin historial, sin casos).
5. Camila contesta por correo, en el mismo hilo: mismo asunto con «Re:», cabeceras `In-Reply-To` y
   `References`, a la dirección tal como la escribió la persona, con formato de correo (saludo, todos
   los pasos, botón de la guía), su firma y «Puedes responder a este correo y te contestamos aquí
   mismo».
6. La dirección de respuesta de cada correo de Camila lleva el identificador de la conversación de esa
   persona (`support+c…` en divoox.com). El identificador solo confirma el hilo: quien lo use desde
   otra dirección no entra a la conversación ajena.
7. Lo que Camila NO toma (o si el servidor falla), el Worker lo desvía al buzón del equipo con el
   motivo en la cabecera `X-Divoox-Camila`. Ningún correo se pierde.
8. El equipo responde desde el superadmin («Camila · Soporte», Conversación): su respuesta sale por
   correo en el mismo hilo, firmada con su nombre. Los correos se ven dentro de la conversación con la
   marca «Correo» y, arriba, el asunto.

## Por dónde sale la respuesta en hilo

Para que la respuesta caiga en la misma conversación del buzón de la persona hacen falta las cabeceras
`In-Reply-To` y `References`. El servicio de correo del sitio (YaDominios) **no las deja pasar**: se
comprobó el 20 nov 2026 con un correo real, que llegó sin ellas. El envío de Cloudflare sí las admite
(documentación oficial, «Email headers»), y divoox.com y tumbite.com ya estaban dados de alta ahí.

- Solo las respuestas que van en un hilo salen por el Worker `divoox-correo`
  (`apps/tiempo-real/src/correoSalida.ts`, puerta `POST /enviar`, enlace `send_email` llamado `EMAIL`).
  Entra solo con el secreto del gerente, solo manda desde la dirección `support` de los dos dominios y
  solo pone las dos cabeceras de hilo.
- El servidor conoce al Worker por la variable `CORREO_HILO_URL` (guardada en el sitio de pruebas y en
  producción el 20 nov 2026). Sin esa variable, o si el Worker falla, la respuesta sale por el camino
  de siempre, sin cabeceras: que llegue importa más que dónde se acomoda.
- Todo el resto del correo de Divoox (bienvenidas, recibos, avisos) sigue por el servicio del sitio.
- Comprobado en vivo el 20 nov 2026: la respuesta enviada por el Worker cayó en la misma conversación
  de Gmail que el correo anterior.

## Por dónde entra el Worker al servidor

El Worker llama al servidor por su dirección de la plataforma (`BACKEND_URL` = la dirección
`sitios.dev` del sitio de producción), **no** por divoox.com. Comprobado el 20 nov 2026 con correos
reales: desde el manejador de correo, la llamada a divoox.com respondía 522 (los dos intentos) y el
correo se desviaba al buzón del equipo; por la dirección de la plataforma entra a la primera. El
servidor es el mismo y arma sus direcciones con `SITIO_URL`, así que nada más cambia.

## Prueba real del 20 nov 2026 (producción)

- Correo real desde el buzón del equipo a la dirección `support`: Camila contestó en 5 segundos, en la
  misma conversación del buzón.
- Respuesta dentro del hilo pidiendo una persona: caso abierto (`pide_persona`) y aviso en el hilo.
- Correo a una dirección `support+c…`: entra igual (subdirecciones encendidas).
- Respuesta del equipo desde la bandeja de Camila: llegó al mismo hilo, firmada con el nombre de la
  cuenta de Soporte.
- La conversación en el panel muestra los ocho mensajes con el canal «correo» y el asunto del hilo.
- Reglas cambiadas: `support` (id 8fd6b711fef94c71ba1e950bfda633c7) y `soporte`
  (id 95bd60243c9444feb9464136917ae1ce), las dos al Worker `divoox-correo`.

## Registros del dominio (DNS)

**No se añadió ningún registro.** divoox.com ya recibía correo desde el 4 nov 2026 (tres registros MX
hacia `route1`, `route2` y `route3.mx.cloudflare.net`, y el SPF de la raíz
`v=spf1 include:_spf.mx.cloudflare.net ~all`, que Cloudflare puso solo al activar Email Routing). El
envío no se tocó: SPF y DKIM siguen en `cf-bounce.divoox.com` y DMARC sigue en `p=reject`.

Lo que cambió fue la configuración de Email Routing (no es DNS):

| Qué                                                  | Antes                        | Ahora                          |
| ---------------------------------------------------- | ---------------------------- | ------------------------------ |
| Regla de la dirección `support`                      | reenviar al buzón del equipo | al Worker `divoox-correo`      |
| Regla de la dirección `soporte`                      | reenviar al buzón del equipo | al Worker `divoox-correo`      |
| Subdirecciones («+algo»)                             | apagadas                     | encendidas (para `support+c…`) |
| Reglas de `orders` y `sales`, y la regla atrapa-todo | sin cambio                   | sin cambio                     |

El sitio de pruebas (tumbite.com) no tiene entrada de correo propia: ahí las respuestas siguen yendo
al buzón de soporte y la puerta se prueba con correo simulado.

## Cómo se despliega el Worker

Siempre con la sesión aparte de la cuenta del proyecto:

```
cd apps/tiempo-real
HOME=~/.tumbite-cloudflare npx wrangler deploy -c wrangler.correo.jsonc
HOME=~/.tumbite-cloudflare npx wrangler secret put GERENTE_SECRETO -c wrangler.correo.jsonc
```

El secreto es el mismo `GERENTE_SECRETO` del sitio (nunca va en el repositorio).

## Volver atrás en una emergencia

Devolver las dos reglas a «reenviar al buzón del equipo» (el correo vuelve a llegar a las personas,
como antes; Camila deja de recibirlo y nada más cambia):

```
HOME=~/.tumbite-cloudflare npx wrangler email routing rules list divoox.com
HOME=~/.tumbite-cloudflare npx wrangler email routing rules update divoox.com <id-de-la-regla> \
  --match-type literal --match-field to --match-value <la dirección> \
  --action-type forward --action-value <buzón del equipo>
```

## Cómo se vigila

- Canario (`/datos/salud`), pieza `correoEntrante`: `ok`, `tope` (hoy llegó al tope de correos) o
  `atrasado` (la entrada o una respuesta falló en las últimas 24 horas). Trae cuántos correos
  entraron, cuántos atendió Camila y cuántos se ignoraron hoy.
- Registro del Worker (observability en Cloudflare): cada correo que no tomó Camila, con su motivo y
  sin su contenido.
- Presupuesto de filas: un correo atendido escribe como mucho 14 filas; uno ignorado, una sola. La
  prueba lo mide.

## Pruebas

- `apps/servidor/src/camila/correoEntrante.test.ts` (servidor, con correo simulado).
- `apps/tiempo-real/src/correoEntrante.test.ts` (Worker, con correos crudos simulados).
- `apps/servidor/src/correoSinRecibirDivoox.test.ts` (la única dirección de divoox.com que se acepta
  como «responder a»).
- `scripts/camila/banco-correo.md`: seis correos contra el modelo real, a mano, antes de cambiar las
  instrucciones de correo de Camila.

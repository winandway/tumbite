# Encender el escudo anti-robots (Turnstile)

> Candado C-TURNSTILE-LISTO (24 nov 2026) — todos los países. Todo el código ya está puesto y
> probado. El escudo se enciende **solo** con poner dos variables en cada sitio y republicar. No hay
> que tocar código ni compilar las apps.

## Qué hace

Cloudflare Turnstile comprueba que quien entra es una persona y no un robot que prueba contraseñas.
A la gente normal no le pide nada (ni semáforos ni letras torcidas); solo reta cuando algo huele raro.

Con las variables puestas, el servidor pide el pase **antes de mirar la contraseña** en:

| Puerta                           | Ruta del servidor                               | Pantalla que pinta el escudo                                                                |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Crear cuenta                     | `POST /datos/cuentas/registro`                  | web (`Acceso.tsx`, en «Revisa tus datos») y las tres apps (`packages/movil/src/Acceso.tsx`) |
| Entrar                           | `POST /datos/cuentas/entrar`                    | web (`Acceso.tsx`) y las tres apps                                                          |
| Recuperar la clave               | `POST /datos/cuentas/recuperar`                 | «Olvidé mi contraseña» (`Restablecer.tsx`); las apps abren esta misma página                |
| Entrar como agente               | `POST /datos/agent/login`                       | `apps/panel/src/agente/Agente.tsx`                                                          |
| Recuperar la clave del agente    | `POST /datos/agent/password/forgot`             | `Agente.tsx`                                                                                |
| Aceptar la invitación del equipo | `POST /datos/equipo-interno/invitacion/aceptar` | `AceptarInvitacion.tsx`                                                                     |

Las apps pintan el escudo dentro de una vista web con la página `turnstile.html` del propio sitio,
así que **no hace falta compilar** ninguna app para encenderlo.

Sin las variables, todo funciona exactamente como hoy: nadie pide pase y nadie llama a Cloudflare.
Si Cloudflare no responde, se deja pasar (detrás siguen la contraseña y los límites de intentos).

## 1. El widget (lo crea quien tenga la cuenta de Cloudflare)

- Cuenta: la de Cloudflare de windoce1 (la misma de los Workers del reloj).
- Lugar: Cloudflare → Turnstile → «Add widget».
- Nombre del widget: `Divoox`.
- Modo: **Managed** (el recomendado).
- Dominios (hostnames) del widget, uno por línea:
  - `divoox.com`
  - `tumbite.com`
  - `staging.tumbite.com`
  - `tumbite-pruebas.sitios.dev`
  - `tumbite.sitios.dev`
- Al crearlo, Cloudflare da dos llaves: la **Site Key** (pública) y la **Secret Key** (secreta).
  Las dos se pueden volver a ver en la misma pantalla del widget.

## 2. Las variables (van en los DOS sitios de YaDominios Cloud)

Lugar: YaDominios Cloud → tarjeta del sitio → Variables de entorno. Se hace en el sitio de pruebas
primero y, cuando se comprueba, en producción.

| Sitio de YaDominios Cloud | Dirección                     | Variable               | Valor                    |
| ------------------------- | ----------------------------- | ---------------------- | ------------------------ |
| `tumbite-pruebas`         | `https://staging.tumbite.com` | `TURNSTILE_SITE_KEY`   | la Site Key del widget   |
| `tumbite-pruebas`         | `https://staging.tumbite.com` | `TURNSTILE_SECRET_KEY` | la Secret Key del widget |
| `tumbite`                 | `https://divoox.com`          | `TURNSTILE_SITE_KEY`   | la Site Key del widget   |
| `tumbite`                 | `https://divoox.com`          | `TURNSTILE_SECRET_KEY` | la Secret Key del widget |

- Las dos variables van **juntas**. Si se pone solo la secreta, la salud lo marca en rojo
  (`turnstile: error`): el servidor pediría el pase y la web y las apps no sabrían pintarlo.
- La secreta nunca va al repositorio ni al chat; la pública sí es pública (la web la lee de
  `GET /datos/publico`, campo `turnstileSitio`).
- Después de guardarlas: **republicar** el sitio (las variables se aplican al republicar).

## 3. Cómo se comprueba que quedó

1. La salud del sitio: `GET https://staging.tumbite.com/datos/salud` (y después
   `https://divoox.com/datos/salud`). La pieza `turnstile` pasa de `pendiente` a **`ok`**.
2. `GET https://staging.tumbite.com/datos/publico` trae `turnstileSitio` con la Site Key.
3. En la web de pruebas, la pantalla de entrar muestra el recuadro de Cloudflare debajo de la
   contraseña, y «Olvidé mi contraseña» también. Entrar con una cuenta de prueba funciona.
4. En una app de pruebas (cliente o Driver), la pantalla de entrar muestra el recuadro y entrar
   funciona.
5. Si algo sale mal, se borran las dos variables y se republica: todo vuelve a como estaba.

## Lo que lo vigila

- Prueba `apps/servidor/src/turnstileListo.test.ts` (C-TURNSTILE-LISTO): sin llaves no se pide pase;
  con la secreta, cada puerta de la tabla frena sin pase y mira el pase antes que la contraseña; cada
  pantalla pinta el escudo; la política de seguridad de la web deja cargar el script de Cloudflare.
- Prueba `apps/panel/src/panel/OlvideEscudo.test.tsx`: «Olvidé mi contraseña» pinta el escudo con
  la clave y manda el pase; sin clave, funciona como hoy.
- Prueba `apps/servidor/src/turnstileApps.test.ts` (C-TURNSTILE-APPS): la página de las apps y el
  canario `turnstile` de la salud.

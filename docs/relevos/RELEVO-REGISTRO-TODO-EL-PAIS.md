# Relevo: registro en todo el país (26 nov 2026, tarde)

Encargo de Gerencia. Causa, contrato y estado completo: notas `registro-en-todo-el-pais-*.md` de la carpeta de notas de
Gerencia. Este archivo es lo que falta para PUBLICAR.

## Dónde está

- Copia: `.claude/worktrees/registro-pais`, rama `fase-registro-todo-pais`, punta en el servidor `4951db34da`.
- Lleva unidas: la main `d711aacb91` (licencia de una cara, YA en producción), `prep-privacidad-reverso` (`fcdd9c740d`:
  privacidad + arreglo del recorrido; NO está en main, sale con esta rama), el arreglo de la prueba intermitente
  `kycBandeja.test.ts` y el semáforo nuevo (C-SEMAFORO-RELOJ, C-SEMAFORO-DICE-LA-PIEZA).
- `npm run verify` verde en la punta (gancho de empuje).

## Qué pasó en la pasada del sitio de pruebas (45878257110)

Semáforo y TODOS los guiones de punta a punta en verde. Cayó solo el recorrido de Playwright, 4 pruebas:

1. `e2e/recorrido/altaPuntaAPunta.spec.ts:21` (alta de conductor, es): `enPaso` (`e2e/recorrido/registroPorPasos.ts`) no llega
   a la casilla «Correo». **Causa: el registro por pasos ahora tiene el paso de la ciudad (`registro-lugar`) y el recorrido no
   lo sabe llenar.** Es de este paquete.
2. `e2e/recorrido/recorrido.spec.ts:121` (es y en), línea 337: en el registro del panel web, «Continuar» no abre «Revisa tus
   datos». **Misma causa: falta elegir la ciudad** (`panel-selector-lugar`). Es de este paquete.
3. `e2e/recorrido/domicilioStaging.spec.ts:269` (LAN-2a): «That phone number already has an account» al crear la cuenta por API
   (`ayudaStaging.ts:46`, `celularDePrueba()`). Parece choque de celular al azar, ajeno; repetir y, si vuelve, mirar el ayudante.

## Qué hay que hacer

1. Enseñarle al recorrido a elegir la ciudad en UNA pieza: en `registroPorPasos.ts`, si `registro-lugar` está a la vista y
   sin elegir, elegirla (como hace `scripts/recorrido/capturas-registro-ciudad.mjs`, líneas 60-80: `registro-lugar` →
   `selector-lugar-pais-US` → `selector-lugar-estado-FL` → `selector-lugar-buscar` → `selector-lugar-ciudad-<lugarId>`).
   Usar una ciudad DENTRO de la zona que cada prueba espera (Miami para las de EE. UU.; mirar qué zona pide cada guion), para
   que la cuenta reciba su zona y no quede en espera. Lo mismo en el registro del panel (`recorrido.spec.ts` ~línea 330).
   Ojo con los avisos nuevos que pueden tapar la pantalla después de entrar: `aviso-lugar-cuenta`, `pregunta-lugar`
   (tienen «Entendido» / «Ahora no»).
2. Buscar otros guiones que registran por pantalla: `grep -rl "pasos-siguiente\|registro-continuar\|enPaso(" e2e scripts`.
3. Correr el recorrido EN LOCAL antes de empujar (`npm run recorrido`), no gastar pasadas de una hora.
4. Empujar la rama, esperar la pasada verde, probar en el sitio de pruebas Maracaibo y Gilroy (espera), Miami (zona), panel
   «Espera por ciudad», abrir una zona de pruebas; canario `columnasFaltantes` vacío y `esperaCiudades` ok.
5. A main. Producción: canario, guía de Docs es y en, `/lugares/VE/V.json` y `/lugares/US/CA.json` en 200. NO activar zonas
   nuevas en producción (avisa a los que esperan; lo decide Richard).
6. Avisar con el commit de main a Gerencia, a la sesión del saldo con regalos (local_94075d97, rama `fase-saldo-regalos-auto`)
   y a la de la Driver (local_515658f4, espera main para compilar).
7. Después: `scripts/docs/subir-capturas-grandes.mjs`, `scripts/docs/subir-ayuda-interna.mjs` (pruebas y produccion),
   compilar Driver y cliente en la Mac una a la vez, nota al auditor (ahora se guarda país, estado y ciudad), página de
   progreso.

## Trampas de hoy

- «publicar» y «pruebas-rama» comparten grupo de concurrencia y solo cabe UNA pasada en espera: un empuje o un relanzamiento
  tumba a la que espera. Mirar `gh run list` antes de empujar o relanzar.
- La salud del sitio de pruebas en 503 frena el semáforo. Hoy fue una revisión de regalo de prueba olvidada 7 días
  (rechazada desde el superadmin de pruebas con la cuenta Soporte Demo). El semáforo ahora imprime la pieza.
- Con la Mac saturada (otra sesión compilando Android) el gancho de empuje cae por tiempo agotado: esperar a que baje la carga.
- El build deja modificados `apps/panel/src/sitio/paisesAbiertos.json` y `tarifasCiudades.json`: restaurar, no van a commit.
- La sesión de vistas previas (local_9f176efa) tiene su rama `fase-vista-previa-rama` en la misma fila.

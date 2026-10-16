# REA en Tumbite: instalación y primera investigación

**Fecha:** 16 de octubre de 2026. **Rama:** `investigacion-rea` (solo documentos). **No se tocó producción, ni la rama del reloj seguro, ni las conciliaciones. No hubo pagos reales.**

## 1. Qué es REA y qué se instaló

REA («Reverse Engineer Anything») es un servidor MCP de código abierto (licencia MIT, 287 mil estrellas en GitHub, versión 6.5.0 publicada el 14 de octubre de 2026) que le presta a un agente herramientas para examinar binarios nativos, aplicaciones JavaScript y Electron, paquetes de Android, páginas web y capturas de red. Devuelve **evidencia** con hash, confianza y limitaciones explícitas, para que el agente separe lo que vio de lo que infiere.

Lo que hice, en orden:

1. Leí la documentación oficial de instalación (`docs/installation.md` del repositorio) y revisé el paquete en npm: autor único, 25 MB, sin scripts raros de postinstalación.
2. Corrí el instalador en modo **solo plan** (`--dry-run`) y revisé los cambios propuestos: dos y nada más.
3. Lo apliqué **solo para Claude Code** (`--client claude_code`): no se tocó Codex, Cursor, Claude Desktop ni VS Code, aunque el instalador los detectó.

| Cambio                                              | Dónde                                                                    | Respaldo                         |
| --------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| Registro del servidor MCP `rea`                     | `~/.claude.json` → `mcpServers.rea` (`npx -y rea-agents@6.5.0 mcp`)      | `~/.claude.json.rea.backup`      |
| Guía de trabajo (skill) `reverse-engineer-anything` | `~/.claude/skills/reverse-engineer-anything/` (SKILL.md + 6 referencias) | — (se quita con `rea uninstall`) |

**El repositorio de Tumbite no se modificó durante la configuración.** La versión queda fijada a 6.5.0 en el registro: no se actualiza sola.

### Verificación

- El servidor MCP arranca y responde al protocolo: **207 herramientas** y 6 prompts (comprobado con una conexión de prueba por stdio).
- `rea doctor`: Node 24.15 correcto; **Hopper, Ghidra, IDA y JADX no están instalados** (REA no los instala; son para binarios nativos y APK). No hacen falta para lo que se decidió investigar (ver §3).
- Para que Claude Code vea las herramientas hay que **reiniciar la sesión** (el instalador lo avisa). En esta sesión usé REA por su línea de comandos (`npx rea-agents@6.5.0 <comando>`), que es el mismo motor.

## 2. Entorno de investigación

Carpeta `docs/investigaciones-rea/` del repositorio:

| Archivo                                  | Qué es                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `INVESTIGACION-REA.md`                   | Este documento: qué se instaló, qué se hizo, límites                        |
| `EVIDENCIA-DOORDASH-FUENTES-PUBLICAS.md` | La evidencia cruda de DoorDash, con 52 fuentes públicas y cada dato marcado |
| `../ARQUITECTURA-REFERENCIA-DOORDASH.md` | El mapa de arquitectura de referencia (Fase 4)                              |
| `../COMPARACION-TUMBITE-DOORDASH-REA.md` | La comparación con nuestro código (Fase 5)                                  |
| `../PLAN-ACELERACION-TUMBITE-REA.md`     | El plan de entregas pequeñas (Fase 6)                                       |

Las evidencias de REA (JSON de 20 MB con hash) se quedan fuera del repositorio, en la carpeta temporal de la sesión; se regeneran con un comando.

## 3. Límite legal y de alcance: qué se investigó y qué NO

**No se descompiló ninguna app de DoorDash.** Tampoco se descargó su APK, ni se capturó su tráfico, ni se usó una cuenta. Motivos:

- Los términos de servicio de DoorDash prohíben la ingeniería inversa de sus apps; «comprender la arquitectura» no es una excepción que ellos reconozcan.
- REA mismo lo dice en su licencia: es para software propio o que se está autorizado a examinar.
- Para lo que necesitamos (estados, flujos, reglas de negocio, decisiones de diseño) **la documentación pública de DoorDash es más precisa que una descompilación**: la API Drive publica la lista exacta de estados y eventos; los centros de ayuda publican las reglas de reembolso, de PIN, de foto, de pausa automática; el blog de ingeniería explica el despacho, el checkout y los reintentos.

Entonces la investigación de DoorDash se hizo con **fuentes públicas** (52, listadas en la evidencia) y REA se usó en lo que sí es legítimo y útil: **nuestras propias apps compiladas**, para tener el mismo tipo de evidencia que daría sobre cualquier app.

## 4. Primera investigación con REA: nuestras propias apps compiladas

Objetivo: saber qué ve «desde afuera» un analizador estático de la app web del cliente y del panel, tal como quedan publicados. Comando: `rea analyze-javascript-application <carpeta>`.

| Artefacto                      | Nodos del grafo                                                                    | Hallazgos                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/cliente/dist-web` (Expo) | 9 puntos de red, 11 usos de almacenamiento local, 1 service worker, 1 worker       | El bundle de entrada (unos 3 MB en un solo archivo) **agota la memoria del analizador** incluso con 6 GB: REA lo declara como límite explícito, no como ausencia. Lo que sí recuperó: rutas de Expo Router, localStorage (sesión e idioma en la web), el service worker. **No recuperó las direcciones `/datos/…`** por el agotamiento. |
| `apps/panel/dist` (Vite)       | 251 artefactos, 250 páginas prerenderizadas, 15 puntos de red, 3 de almacenamiento | Recuperó las direcciones públicas que la landing llama (`/datos/publico`, `/datos/zonas`), las 250 páginas estáticas (Docs, legales, en los dos idiomas) y el único módulo JS. Sin secretos en el paquete (coincide con nuestro revisor `verificar-paquete.mjs`).                                                                       |

Conclusiones prácticas:

1. **Para una app Expo web, REA necesita el bundle partido** o los source maps. Una app de terceros empaquetada igual tendría el mismo límite; no es un defecto nuestro, pero conviene saberlo antes de prometer que REA «abre cualquier app».
2. **Para APK** (la vía natural para estudiar una app de celular) hace falta JDK + `jadx-headless-mcp`, y además autorización legal sobre el APK. No se instaló.
3. **Para páginas web en vivo** (`capture_browser_scenario`, `analyze_web_bundle`) REA sirve para auditar **nuestro propio sitio** en staging: qué llama, qué guarda, qué escucha. Eso sí entra en el plan (ver PLAN-ACELERACION, entrega 0).

## 5. Qué le aporta REA a Tumbite de verdad (decisión)

| Uso                                                           | ¿Vale?                      | Por qué                                                                                                        |
| ------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Descompilar DoorDash, Uber Eats o Rappi                       | **No**                      | Prohibido por sus términos; además lo público ya cubre lo que necesitamos                                      |
| Auditar nuestras apps y el sitio como las ve un atacante      | **Sí**                      | Evidencia reproducible con hash: direcciones, almacenamiento, secretos filtrados, listeners                    |
| Comparar dos versiones publicadas (antes/después)             | **Sí**                      | `compare_application_versions` sobre dos paquetes: candado para C-VERSION-DEL-ARTEFACTO y C-ENTORNOS-SEPARADOS |
| Analizar bibliotecas de terceros que usamos (Stripe RN, Expo) | **Sí, puntual**             | Son de código abierto o con licencia que lo permite; sirve para entender fallos raros                          |
| Estudiar apps de Android de competidores pequeños             | **Solo con asesoría legal** | Depende de la licencia de cada app                                                                             |

## 6. Cómo repetirlo

Desde la raíz del repositorio, con el panel y el cliente ya compilados (`npm run build` y `npm run build:app-web`):

```bash
cd /Users/windocellc/tumbite && npx -y rea-agents@6.5.0 analyze-javascript-application apps/panel/dist --format json > /tmp/rea-panel.json
```

```bash
cd /Users/windocellc/tumbite && npx -y rea-agents@6.5.0 doctor
```

Para quitar REA por completo: `npx -y rea-agents@6.5.0 uninstall` (restaura el respaldo de `~/.claude.json`).

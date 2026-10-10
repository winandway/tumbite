# Candados de Tumbite

Cada cosa que funciona y no debe romperse. Escrito para que otra IA, sin memoria, lo repare sola.

## C-IDIOMA-1 · Bandera del español = España

- Qué: el selector usa 🇪🇸 para español y 🇺🇸 para inglés (regla de Richard).
- Candado: `packages/compartido/src/idiomas.test.ts` falla si el español lleva 🇲🇽. Comprobado en rojo el 10 oct 2026.
- No tocar: la lista `IDIOMAS`.

## C-DINERO-1 · El dinero va en centavos enteros

- Qué: `formatearDolares` y `porcentajeDe` rechazan decimales y negativos; los porcentajes van en puntos básicos (750 = 7,5 %).
- Candado: `packages/compartido/src/dinero.test.ts`; cobertura mínima 90 % en `dinero.ts`.

## C-SALUD-1 · Canario del servidor

- Qué: `GET /datos/salud` dice ok / error / pendiente por pieza (base, variables, Stripe, webhook) y responde 503 si algo está en rojo.
- Candado: `apps/servidor/src/app.test.ts`.

## C-REACT-1 · Una sola copia de React

- Qué se rompió: dos copias de React (19.2.3 y 19.3.0) hacían fallar el panel con «Cannot read properties of null (reading 'useState')».
- Arreglo: `overrides` de `react` y `react-dom` a 19.2.3 en el `package.json` raíz (la versión que exige Expo 57). Al subir de SDK de Expo, se sube aquí también.

## Deuda vigilada · Avisos de seguridad de las herramientas de Expo

- `npm audit` marca altas en `node-forge`, `braces`, `metro` y `uuid` dentro de `expo` / `@expo/cli`. Son herramientas de compilación que corren en la máquina del programador, no viajan en la app ni en el servidor, y no tienen versión corregida (10 oct 2026).
- Se revisa con `npm run audit:apps` en cada actualización de SDK de Expo.

// Repaso de pantallas (UX-4, 1 nov 2026, pedido de Richard: «que ninguna se vea mal ni en inglés ni
// en español»). Fotografía las pantallas principales de las tres apps en el SITIO DE PRUEBAS, en los
// dos idiomas, con las cuentas de demostración (docs/CUENTAS-DE-PRUEBA.md, fuera de git), y además
// avisa si en la pantalla aparecen palabras del otro idioma. No cambia nada.
// Salida: la carpeta que se pase como primer argumento (por defecto, repaso-pantallas/ fuera de git).
// Uso: node scripts/docs/repaso-pantallas.mjs <carpeta>
import fs from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const SITIO = 'https://staging.tumbite.com';
const RAIZ = process.cwd();
const SALIDA = process.argv[2] ?? join(RAIZ, 'repaso-pantallas');
// La carpeta de salida la elige quien corre el repaso en su propia computadora.
// eslint-disable-next-line security/detect-non-literal-fs-filename
fs.mkdirSync(SALIDA, { recursive: true });
const fila = fs
  .readFileSync(join(RAIZ, 'docs', 'CUENTAS-DE-PRUEBA.md'), 'utf8')
  .split('\n')
  .find((l) => l.includes('demo.soporte@ejemplo.com'));
const CLAVE = fila.split('|')[4].trim();
const MIAMI = { latitude: 25.7745, longitude: -80.1905 };

const entrar = async (rol) =>
  (
    await fetch(`${SITIO}/datos/cuentas/entrar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ correo: `demo.${rol}@ejemplo.com`, clave: CLAVE }),
    })
  ).json();
const [cliente, rep, rest] = await Promise.all(
  ['cliente', 'repartidor', 'restaurante'].map(entrar),
);

// Palabras que delatan el otro idioma en pantalla (las de los nombres de locales de prueba no cuentan).
const DEL_OTRO = {
  es: /\b(Help request|Problem report|Order again|Sign out|My account|Delivered|Canceled|Search|Orders)\b/,
  en: /\b(Pedido de ayuda|Pedir otra vez|Cerrar sesión|Mi cuenta|Entregado|Cancelado|Buscar|Pedidos)\b/,
};

const PANTALLAS = [
  ['cliente', cliente, '/app/', 'inicio'],
  ['cliente', cliente, '/app/restaurants', 'restaurantes'],
  ['cliente', cliente, '/app/search', 'buscar'],
  ['cliente', cliente, '/app/orders', 'pedidos'],
  ['cliente', cliente, '/app/favorites', 'favoritos'],
  ['cliente', cliente, '/app/account', 'cuenta'],
  ['cliente', cliente, '/app/notifications', 'avisos'],
  ['cliente', cliente, '/app/packages', 'paquetes'],
  ['cliente', cliente, '/app/cart', 'carrito'],
  ['driver', rep, '/driver/', 'inicio'],
  ['restaurante', rest, '/restaurant/', 'inicio'],
];

const navegador = await chromium.launch();
const avisos = [];
for (const idioma of ['es', 'en'])
  for (const [app, u, ruta, nombre] of PANTALLAS) {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
      geolocation: MIAMI,
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([token, id, i]) => {
        localStorage.setItem('tumbite.sesion', token);
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem(`divoox.permisos.${id}`, '1');
      },
      [u.token, u.usuario.id, idioma],
    );
    const p = await ctx.newPage();
    try {
      await p.goto(`${SITIO}${ruta}`, { waitUntil: 'networkidle', timeout: 45_000 });
      await p.waitForTimeout(2500);
      await p.screenshot({ path: join(SALIDA, `${app}-${nombre}-${idioma}.png`), fullPage: true });
      const texto = await p.locator('body').innerText();
      const otro = texto.match(idioma === 'es' ? DEL_OTRO.es : DEL_OTRO.en);
      if (otro) avisos.push(`${app}/${nombre} (${idioma}): aparece «${otro[0]}»`);
    } catch (e) {
      avisos.push(`${app}/${nombre} (${idioma}): no cargó (${String(e).slice(0, 80)})`);
    }
    await ctx.close();
  }
await navegador.close();
// eslint-disable-next-line security/detect-non-literal-fs-filename
fs.writeFileSync(join(SALIDA, 'avisos.txt'), avisos.join('\n') + '\n');
console.log(avisos.join('\n') || 'Sin palabras del otro idioma.');
console.log(`Pantallas: ${SALIDA}`);

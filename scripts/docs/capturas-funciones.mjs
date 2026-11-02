// Capturas REALES para las guías de Docs de las funciones nuevas (1 nov 2026, regla de Richard:
// «ninguna guía sin capturas»). Corre contra el SITIO DE PRUEBAS con las cuentas de demostración
// (docs/CUENTAS-DE-PRUEBA.md, fuera de git). Enciende un momento Ganar por tiempo, anuncios, Divoox
// Plus y tarjetas de regalo SOLO en pruebas, fotografía y los deja como estaban (pase lo que pase).
// No mueve dinero.
// Salida: docs/capturas/funciones/<nombre>-<es|en>.png y apps/panel/public/docs/<nombre>-<es|en>.webp
// Uso: node scripts/docs/capturas-funciones.mjs [solo=nombre1,nombre2]
import fs from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const SITIO = 'https://staging.tumbite.com';
const RAIZ = process.cwd();
const ORIGINALES = join(RAIZ, 'docs', 'capturas', 'funciones');
const WEB = join(RAIZ, 'apps', 'panel', 'public', 'docs');
fs.mkdirSync(ORIGINALES, { recursive: true });
const SOLO = (process.argv.find((a) => a.startsWith('solo=')) ?? '')
  .slice(5)
  .split(',')
  .filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);

const fila = fs
  .readFileSync(join(RAIZ, 'docs', 'CUENTAS-DE-PRUEBA.md'), 'utf8')
  .split('\n')
  .find((l) => l.includes('demo.soporte@ejemplo.com'));
const CLAVE = fila.split('|')[4].trim();
const MIAMI = { latitude: 25.7745, longitude: -80.1905 };

async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${SITIO}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(metodo !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const entrar = (rol) =>
  api('POST', '/datos/cuentas/entrar', { correo: `demo.${rol}@ejemplo.com`, clave: CLAVE });

const [admin, cliente, rest, rep] = await Promise.all(
  ['soporte', 'cliente', 'restaurante', 'repartidor'].map(entrar),
);

// Lo que se enciende un momento, con lo que había antes para dejarlo igual.
const AJUSTES = [
  ['/datos/admin/pago-pico', { centavos: 200, presupuestoDiaCentavos: 2000 }],
  ['/datos/admin/ganar-por-tiempo', { centavosHora: 2500, centavosMilla: 50 }],
  ['/datos/admin/anuncios', { centavosPorPedido: 300, maxEnLista: 2 }],
  ['/datos/admin/plus', { centavosMes: 999, minimoSubtotal: 1200, servicioDescuentoPct: 50 }],
  ['/datos/admin/tarjetas-regalo', { activas: true, minimo: 1500, maximo: 50000 }],
];
// Cada ajuste con su valor de antes, para dejarlo igual al final.
const antes = [];
for (const [ruta] of AJUSTES) antes.push([ruta, await api('GET', ruta, undefined, admin.token)]);
const anuncioAntes = await api('GET', '/datos/mi-restaurante/anuncios', undefined, rest.token);

// Un caso de ayuda de la cuenta de demostración con una captura adjunta y la respuesta de soporte
// (se crea una sola vez; las corridas siguientes reutilizan el mismo).
async function casoDeDemostracion(idioma) {
  const en = idioma === 'en';
  const marca = en ? 'coupon' : 'cupón';
  const { tickets } = await fetch(`${SITIO}/datos/mis-tickets`, {
    headers: { authorization: `Bearer ${cliente.token}` },
  }).then((r) => r.json());
  if (tickets?.some((x) => x.mensajes?.some((m) => m.texto?.includes(marca)))) return;
  const r0 = await fetch(`${SITIO}/datos/quejas`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-idioma': idioma,
      authorization: `Bearer ${cliente.token}`,
    },
    body: JSON.stringify({
      tipo: 'soporte',
      texto: en
        ? 'I can’t apply my coupon in the cart. Here is a screenshot of what I see.'
        : 'No puedo aplicar mi cupón en el carrito. Les mando la captura de lo que veo.',
    }),
  });
  const q = await r0.json();
  const codigo = q.enlace.split('/').at(-1);
  // La ruta sale de la carpeta fija de originales y del idioma (es o en), no de datos de afuera.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const imagen = fs.readFileSync(join(ORIGINALES, `cliente-plus-${idioma}.png`));
  const r = await fetch(
    `${SITIO}/datos/tickets/${codigo}/adjuntos?nombre=${en ? 'cart' : 'carrito'}.png`,
    {
      method: 'POST',
      headers: { 'content-type': 'image/png', authorization: `Bearer ${cliente.token}` },
      body: imagen,
    },
  );
  const { adjunto } = await r.json();
  await api(
    'POST',
    `/datos/tickets/${codigo}/mensajes`,
    {
      texto: en ? 'This is the screen.' : 'Esta es la pantalla.',
      adjuntos: [adjunto.id],
    },
    cliente.token,
  );
  await api(
    'POST',
    `/datos/admin/tickets/${q.ticketId}/mensajes`,
    {
      texto: en
        ? 'Thanks for the screenshot. We found it: the coupon applies to orders of $15 or more. Let us know if you need anything else.'
        : 'Gracias por la captura. Ya vimos el problema: el cupón aplica desde 15 dólares. Avísanos si necesitas algo más.',
    },
    admin.token,
  );
}

const aWebp = (png, webp, ancho) =>
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '82',
    ...(ancho ? ['-resize', String(ancho), '0'] : []),
    png,
    '-o',
    webp,
  ]);

const navegador = await chromium.launch();
try {
  for (const [ruta, valor] of AJUSTES) await api('PUT', ruta, valor, admin.token);
  await api(
    'PUT',
    '/datos/mi-restaurante/anuncios',
    { activa: true, presupuestoSemanalCentavos: 5000 },
    rest.token,
  );
  await api('POST', '/datos/repartidor/conectar', { conectado: false }, rep.token).catch(
    () => undefined,
  );

  for (const idioma of ['es', 'en']) {
    const t = (es, en) => (idioma === 'en' ? en : es);
    // Celular: la app con la sesión ya guardada (en la web la app la lee del almacenamiento local).
    const celular = async (usuario, ruta) => {
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
        [usuario.token, usuario.usuario.id, idioma],
      );
      const p = await ctx.newPage();
      await p.goto(`${SITIO}${ruta}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
      return { ctx, p };
    };
    const foto = async (p, nombre, opciones = {}) => {
      await p.waitForTimeout(1200);
      const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
      await (opciones.elemento ?? p).screenshot({
        path: png,
        ...(opciones.elemento ? {} : { fullPage: Boolean(opciones.entera) }),
      });
      aWebp(png, join(WEB, `${nombre}-${idioma}.webp`), opciones.ancho ?? 540);
      console.log('foto', nombre, idioma);
    };

    if (toca('driver')) {
      const { ctx, p } = await celular(rep, '/driver/');
      await p.waitForTimeout(4000);
      // El mapa de zonas tiene su propio guion (capturas-zonas.mjs): necesita pedidos de la última hora.
      const modo = p.getByText(t('¿Cómo quieres cobrar hoy?', 'How do you want to earn today?'));
      if (await modo.count()) {
        await modo.scrollIntoViewIfNeeded();
        await foto(p, 'driver-ganar-por-tiempo');
        await p
          .getByText(t('Por tiempo', 'By time'), { exact: true })
          .first()
          .click()
          .catch(() => undefined);
        await foto(p, 'driver-ganar-por-tiempo-elegido');
        await p
          .getByText(t('Por oferta', 'Per offer'), { exact: true })
          .first()
          .click()
          .catch(() => undefined);
      } else console.log('aviso: no apareció la tarjeta de Ganar por tiempo');
      await ctx.close();
    }

    if (toca('cliente')) {
      // El local solo cuenta como abierto si su panel está escuchando pedidos (C-PAUSA-SIN-SENAL).
      await api('GET', '/datos/restaurante/pedidos', undefined, rest.token);
      const { ctx, p } = await celular(cliente, '/app/');
      // La pantalla es una lista con su propio desplazamiento: se baja con la rueda, como una persona.
      await p.mouse.move(195, 500);
      await p.mouse.wheel(0, 950);
      await p.waitForTimeout(1500);
      await foto(p, 'cliente-inicio-patrocinado');
      await api('GET', '/datos/restaurante/pedidos', undefined, rest.token);
      await p.goto(`${SITIO}/app/restaurants`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2000);
      await foto(p, 'cliente-lista-patrocinado');
      await p.goto(`${SITIO}/app/plus`, { waitUntil: 'networkidle' });
      await foto(p, 'cliente-plus');
      await p.goto(`${SITIO}/app/gift-cards`, { waitUntil: 'networkidle' });
      await foto(p, 'cliente-tarjetas-regalo', { entera: true });
      await p.goto(`${SITIO}/app/account`, { waitUntil: 'networkidle' });
      await foto(p, 'cliente-mi-cuenta', { entera: true });
      if (toca('soporte')) {
        await casoDeDemostracion(idioma);
        await p.reload({ waitUntil: 'networkidle' });
        await p.waitForTimeout(2000);
        const casos = p.getByText(t('Mis casos de ayuda', 'My help cases')).first();
        await casos.scrollIntoViewIfNeeded();
        await p.mouse.move(195, 500);
        await p.mouse.wheel(0, 400);
        await foto(p, 'cliente-casos-ayuda');
        // El caso más nuevo es el de esta corrida: se abre tocando su fila.
        await p
          .getByText(/^(Caso|Case) [0-9A-F]{8} · /)
          .first()
          .click()
          .catch(() => undefined);
        await p.waitForTimeout(2500);
        await p.mouse.wheel(0, 500);
        await foto(p, 'cliente-caso-con-captura');
      }
      await ctx.close();
    }

    if (toca('pedidos')) {
      const { ctx, p } = await celular(cliente, '/app/orders');
      await foto(p, 'cliente-mis-pedidos');
      await ctx.close();
    }

    if (toca('restaurante')) {
      const ctx = await navegador.newContext({
        viewport: { width: 1366, height: 860 },
        deviceScaleFactor: 2,
        locale: idioma === 'en' ? 'en-US' : 'es-US',
      });
      await ctx.addCookies([
        {
          name: 'tumbite_sesion',
          value: rest.token,
          domain: 'staging.tumbite.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ]);
      await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
      const p = await ctx.newPage();
      await p.goto(`${SITIO}${idioma === 'en' ? '' : '/es'}/panel/ads`, {
        waitUntil: 'networkidle',
      });
      await foto(p, 'restaurante-anuncios', { ancho: 0, entera: true });
      await ctx.close();
    }
  }
} finally {
  await api('PUT', '/datos/repartidor/modo-pago', { modo: 'oferta' }, rep.token).catch(
    () => undefined,
  );
  // Todo vuelve a como estaba en el sitio de pruebas (la campaña primero: con los anuncios
  // apagados el restaurante ya no puede tocarla).
  await api(
    'PUT',
    '/datos/mi-restaurante/anuncios',
    {
      activa: anuncioAntes.campana?.activa ?? false,
      presupuestoSemanalCentavos: anuncioAntes.campana?.presupuestoSemanalCentavos ?? 0,
    },
    rest.token,
  ).catch((e) => console.error('no se pudo restaurar la campaña', e));
  for (const [ruta, valor] of antes)
    await api('PUT', ruta, valor, admin.token).catch((e) =>
      console.error('no se pudo restaurar', ruta, e),
    );
  await navegador.close();
}
console.log(`Capturas: ${ORIGINALES}`);

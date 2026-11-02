// Capturas REALES para las guías de Docs que no tenían ninguna (CAP-7, 1 nov 2026: «ninguna guía
// sin capturas»). Corre SOLO contra el sitio de pruebas con las cuentas de demostración
// (docs/CUENTAS-DE-PRUEBA.md, fuera de git). No mueve dinero.
// Salida: docs/capturas/funciones/<nombre>-<es|en>.png y apps/panel/public/docs/<nombre>-<es|en>.webp
// Uso: node scripts/docs/capturas-guias-faltantes.mjs [solo=web,cliente,...]
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

const aWebp = (png, webp, ancho) =>
  execFileSync('cwebp', ['-quiet', '-q', '82', '-resize', String(ancho), '0', png, '-o', webp]);

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
if (!SITIO.includes('staging')) throw new Error('Este guion solo corre en el sitio de pruebas.');
const { restaurante } = await api('GET', '/datos/mi-restaurante', undefined, rest.token);
const { platos } = await api(
  'GET',
  `/datos/restaurantes/${restaurante.id}`,
  undefined,
  cliente.token,
);
const plato = platos.find((x) => !(x.grupos ?? []).some((g) => g.minimo > 0));
const grupos = [];
// Por un momento, los platos de la Pizzería Demo llevan categoría y marcas de dieta (para que se
// vean los filtros y los horarios del menú); al final quedan exactamente como estaban.
const platosAntes = platos.map((x) => ({ ...x }));
const comoPlato = (x) => ({
  nombreEs: x.nombreEs,
  nombreEn: x.nombreEn,
  descripcionEs: x.descripcionEs,
  descripcionEn: x.descripcionEn,
  categoria: x.categoria,
  categoriaEn: x.categoriaEn,
  precioCentavos: x.precioCentavos,
  disponible: x.disponible,
  imagen: x.imagen,
  requiereEdad: x.requiereEdad,
  etiquetas: x.etiquetas,
});
const conDemo = (x) => {
  const bebida = /limonada/i.test(x.nombreEs);
  return {
    ...comoPlato(x),
    categoria: x.categoria || (bebida ? 'Bebidas' : 'Pizzas'),
    categoriaEn: x.categoriaEn || (bebida ? 'Drinks' : 'Pizzas'),
    etiquetas: bebida
      ? ['vegetariano', 'vegano']
      : /margarita/i.test(x.nombreEs)
        ? ['vegetariano']
        : x.etiquetas,
  };
};
if (toca('cliente') || toca('restaurante'))
  for (const x of platos)
    await api('PUT', `/datos/mi-restaurante/platos/${x.id}`, conDemo(x), rest.token);
// Un pedido en curso para «Compartir el seguimiento»: pago al recibir (el efectivo se enciende un
// momento en pruebas y queda como estaba); al final se cancela.
let pedidoEnCurso = null;
let paisAntes = null;
if (toca('cliente')) {
  paisAntes = (await api('GET', '/datos/admin/paises/US', undefined, admin.token)).config;
  await api('PUT', '/datos/admin/paises/US', { efectivoActivo: true }, admin.token);
  // El local solo cuenta como abierto si su panel está escuchando pedidos (C-PAUSA-SIN-SENAL).
  await api('GET', '/datos/restaurante/pedidos', undefined, rest.token);
  const r = await api(
    'POST',
    '/datos/pedidos',
    {
      restauranteId: restaurante.id,
      lineas: [{ platoId: plato.id, cantidad: 1 }],
      propinaCentavos: 0,
      direccion: '200 S Biscayne Blvd',
      lat: MIAMI.latitude,
      lng: MIAMI.longitude,
      entrega: 'puerta',
      metodoPago: 'efectivo',
    },
    cliente.token,
  ).catch((e) => console.error('aviso: no se pudo crear el pedido en curso', e.message));
  pedidoEnCurso = r?.pedidoId ?? null;
}

const navegador = await chromium.launch();
// Celular: la app con la sesión ya guardada (en la web la app la lee del almacenamiento local).
const celular = async (usuario, ruta, idioma) => {
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
  await p.waitForTimeout(3500);
  return { ctx, p };
};
try {
  for (const idioma of ['es', 'en']) {
    const t = (es, en) => (idioma === 'en' ? en : es);
    const foto = async (p, nombre, opciones = {}) => {
      await p.waitForTimeout(1200);
      const png = join(ORIGINALES, `${nombre}-${idioma}.png`);
      await (opciones.elemento ?? p).screenshot({ path: png });
      aWebp(png, join(WEB, `${nombre}-${idioma}.webp`), opciones.ancho ?? 540);
      console.log('foto', nombre, idioma);
    };

    if (toca('web')) {
      // La calculadora pública: lo que cobra Divoox al lado de lo que publican las otras apps.
      const ctx = await navegador.newContext({
        viewport: { width: 1280, height: 900 },
        locale: idioma === 'en' ? 'en-US' : 'es-US',
      });
      const p = await ctx.newPage();
      await p.goto(`${SITIO}${idioma === 'en' ? '' : '/es'}/calculator`, {
        waitUntil: 'networkidle',
      });
      await foto(p, 'web-comparar-restaurante', { ancho: 960 });
      await p.getByRole('tab', { name: t('Cliente', 'Customer') }).click();
      await foto(p, 'web-comparar-cliente', { ancho: 960 });
      await ctx.close();
    }

    if (toca('driver')) {
      const { ctx, p } = await celular(rep, '/driver/', idioma);
      const menu = async (opcion) => {
        await p.getByLabel(t('Menú', 'Menu')).first().click();
        await p.getByText(opcion, { exact: true }).first().click();
        await p.waitForTimeout(2500);
      };
      await menu(t('Mis turnos', 'My shifts'));
      await foto(p, 'driver-turnos');
      await menu(t('Seguridad', 'Safety'));
      await foto(p, 'driver-seguridad');
      await p.getByText(t('Perfil', 'Profile'), { exact: true }).last().click();
      await p.waitForTimeout(2000);
      await p.getByText(t('Mis calificaciones', 'My ratings'), { exact: true }).first().click();
      await p.waitForTimeout(2500);
      await foto(p, 'driver-calificaciones');
      // La pantalla es una lista con su propio desplazamiento: se baja con la rueda, como una persona.
      await p.mouse.move(195, 500);
      await p.mouse.wheel(0, 700);
      await foto(p, 'driver-destacado');
      await menu(t('Mi billetera', 'My wallet'));
      await foto(p, 'driver-billetera');
      await p.getByText(t('Pedidos', 'Orders'), { exact: true }).last().click();
      await p.waitForTimeout(2500);
      if (await p.getByTestId('calificar-cliente').count()) {
        await p.getByTestId('calificar-cliente').scrollIntoViewIfNeeded();
        await foto(p, 'driver-calificar-cliente');
      } else console.log('aviso: no hay entregas de hoy para calificar al cliente');
      await ctx.close();
    }

    if (toca('cliente')) {
      // El local solo cuenta como abierto si su panel está escuchando pedidos (C-PAUSA-SIN-SENAL).
      await api('GET', '/datos/restaurante/pedidos', undefined, rest.token);
      const { ctx, p } = await celular(cliente, `/app/restaurant/${restaurante.id}`, idioma);
      // Instrucciones especiales: se abre un plato y se escribe la nota.
      await p.getByLabel(plato.nombreEs, { exact: true }).first().click();
      await p.waitForTimeout(1500);
      await p.getByTestId('nota-plato').fill(t('Sin hielo, por favor', 'No ice, please'));
      await foto(p, 'cliente-nota-plato');
      await p.getByText(t('Agregar al carrito', 'Add to cart')).first().click();
      await p.waitForTimeout(1500);
      // El carrito con el botón para pagar (la tarjeta, Apple Pay o Google Pay se eligen después).
      await p.goto(`${SITIO}/app/cart`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
      await p.mouse.move(195, 500);
      await p.mouse.wheel(0, 2000);
      await foto(p, 'cliente-carrito-pagar');
      // Filtros de dieta en el buscador.
      await p.goto(`${SITIO}/app/search`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
      await foto(p, 'cliente-filtros-dieta');
      await p.getByText(t('Vegetariano', 'Vegetarian'), { exact: true }).first().click();
      await foto(p, 'cliente-filtros-dieta-elegido');
      // Te puede gustar, en el inicio (sale si ya pidió antes y hay otro local de ese tipo abierto).
      await p.goto(`${SITIO}/app/`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(3000);
      if (await p.getByTestId('te-puede-gustar').count()) {
        await p.mouse.move(195, 500);
        await p.mouse.wheel(0, 600);
        await foto(p, 'cliente-te-puede-gustar');
      } else console.log('aviso: no apareció «Te puede gustar»');
      // Pedido en grupo: se crea desde el menú y se cancela al terminar.
      await p.goto(`${SITIO}/app/restaurant/${restaurante.id}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2500);
      await foto(p, 'cliente-grupo-boton');
      await p.getByText(t('Hacer un pedido en grupo', 'Start a group order')).first().click();
      await p.waitForURL(/\/group\//, { timeout: 15_000 });
      await p.waitForTimeout(2500);
      grupos.push(p.url().split('/group/')[1].split(/[?#/]/)[0]);
      await foto(p, 'cliente-grupo');
      // Compartir el seguimiento: un pedido en curso (pago al recibir, solo en pruebas).
      if (pedidoEnCurso) {
        await p.goto(`${SITIO}/app/order/${pedidoEnCurso}`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(3000);
        const enlace = p.getByText(t('Compartir el seguimiento', 'Share tracking')).first();
        if (await enlace.count()) await enlace.scrollIntoViewIfNeeded();
        await foto(p, 'cliente-compartir-seguimiento');
      }
      await ctx.close();
    }

    if (toca('flex')) {
      // Divoox Flex: la empresa de la cuenta demo del cliente (billetera y operación).
      const { empresas } = await api('GET', '/datos/v1/flex/empresas', undefined, cliente.token);
      const empresa = empresas[0];
      const ctx = await navegador.newContext({
        viewport: { width: 1366, height: 860 },
        deviceScaleFactor: 2,
        locale: idioma === 'en' ? 'en-US' : 'es-US',
      });
      await ctx.addCookies([
        {
          name: 'tumbite_sesion',
          value: cliente.token,
          domain: 'staging.tumbite.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ]);
      await ctx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
      const p = await ctx.newPage();
      for (const [ruta, nombre] of [
        ['wallet', 'flex-billetera'],
        ['operations', 'flex-operacion'],
        ['vehicles', 'flex-vehiculos'],
        ['integrations', 'flex-integraciones'],
      ]) {
        await p.goto(
          `${SITIO}${idioma === 'en' ? '' : '/es'}/panel/business/${empresa.id}/${ruta}`,
          { waitUntil: 'networkidle' },
        );
        await p.waitForTimeout(2500);
        await foto(p, nombre, { ancho: 960 });
      }
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
      const ir = async (ruta) => {
        await p.goto(`${SITIO}${idioma === 'en' ? '' : '/es'}/panel/${ruta}`, {
          waitUntil: 'networkidle',
        });
        await p.waitForTimeout(2000);
      };
      // Lleva el título arriba de la pantalla, con un poco de aire.
      const subir = async (texto) => {
        const el = p.getByText(texto, { exact: true }).first();
        await el.waitFor({ timeout: 15_000 });
        await el.evaluate((n) => {
          // Sin animación: el panel desplaza suave y un segundo ajuste cortaría el movimiento.
          n.scrollIntoView({ block: 'start', behavior: 'instant' });
          n.ownerDocument.defaultView.scrollBy({ top: -90, behavior: 'instant' });
        });
      };
      const ancho = { ancho: 960 };
      await ir('orders');
      await subir(t('Aceptar pedidos automáticamente', 'Accept orders automatically'));
      // En la misma foto salen «Aceptar pedidos automáticamente» e «Imprimir la comanda al aceptar».
      await foto(p, 'restaurante-aceptar-automatico', ancho);
      await ir('earnings');
      await foto(p, 'restaurante-beneficios', ancho);
      await ir('menu');
      await subir(t('Horarios del menú', 'Menu hours'));
      // Al final de la página: «Horarios del menú» y, debajo, «Cargar el menú desde una planilla».
      await foto(p, 'restaurante-horarios-menu', ancho);
      await ir('restaurant');
      await subir(t('Conectar tu punto de venta', 'Connect your point of sale'));
      await foto(p, 'restaurante-punto-de-venta', ancho);
      await ctx.close();
    }
  }
} finally {
  await navegador.close();
  for (const codigo of grupos)
    await api('POST', `/datos/grupos/${codigo}/cancelar`, {}, cliente.token).catch((e) =>
      console.error('no se pudo cancelar el grupo', codigo, e.message),
    );
  if (pedidoEnCurso)
    await api(
      'POST',
      `/datos/admin/pedidos/${pedidoEnCurso}/cancelar`,
      { motivo: 'Pedido de demostración para las capturas de Docs.' },
      admin.token,
    ).catch((e) => console.error('no se pudo cancelar el pedido', e.message));
  if (toca('cliente') || toca('restaurante'))
    for (const x of platosAntes)
      await api('PUT', `/datos/mi-restaurante/platos/${x.id}`, comoPlato(x), rest.token).catch(
        (e) => console.error('no se pudo dejar el plato como estaba', x.nombreEs, e.message),
      );
  if (paisAntes)
    await api(
      'PUT',
      '/datos/admin/paises/US',
      { efectivoActivo: paisAntes.efectivoActivo },
      admin.token,
    );
  console.log(
    'grupos cancelados:',
    grupos.length,
    '· pedido de prueba cancelado:',
    Boolean(pedidoEnCurso),
  );
}

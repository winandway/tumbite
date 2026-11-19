import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { VERSION_TERMINOS, geohash } from '@tumbite/compartido';
import { expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';
import { SQL_TASA_EJEMPLO } from './tasaEjemplo';

/**
 * Capturas de las fichas de Google Play del cliente y del Driver (tercera auditoría de tiendas,
 * 18 nov 2026): a tamaño de teléfono (1206 × 2622), con datos neutros y SOLO con lo que de verdad
 * está abierto en producción. Inglés en Novi, Michigan: solo Comida (así está Estados Unidos hoy).
 * Español en El Vigía: Comida, Moto, Carro y Envíos. Direcciones neutras («123 Main St»), cuentas de
 * prueba, sin barra de estado del teléfono, sin superlativos ni precios de promoción.
 * Solo con CAPTURAS_TIENDA=1 y en esta computadora: guarda en capturas-tiendas/ de la carpeta
 * principal (fuera de git), de donde lee scripts/marca/fichas-tiendas.mjs.
 */
const RAIZ = join(__dirname, '..', '..');
const ACTIVO = process.env.CAPTURAS_TIENDA === '1' && !process.env.RECORRIDO_URL;
test.skip(!ACTIVO, 'solo con CAPTURAS_TIENDA=1, en esta computadora');
// Una ciudad tras otra: la base local no aguanta las dos a la vez.
test.describe.configure({ mode: 'serial' });
const DATOS = ACTIVO
  ? (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    })
  : null;
const DESTINO = process.env.CARPETA_TIENDAS ?? '/Users/windocellc/Divoox/capturas-tiendas';
const sql = sqlLocal;
const FOTOS = 'https://divoox-progreso.sitios.dev/borrador-inicio/img';
// La foto del banner de Comida (la misma del administrador de banners del sitio de pruebas).
const BANNER_COMIDA = 'https://staging.tumbite.com/media/fotos/banners/demo-banner-comida.webp';
const FOTO_BOLSA = readFileSync(join(__dirname, 'fotos', 'bolsa-entrega.jpg'));

const CIUDADES = {
  es: {
    carpeta: 'Español',
    zona: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      pais: 'VE',
      lat: 8.6219,
      lng: -71.6506,
      tz: 'America/Caracas',
    },
    casa: { direccion: 'Calle 5, Urb. Las Flores, El Vigía', lat: 8.6345, lng: -71.6611 },
    trabajo: { direccion: 'Av. Bolívar 123, El Vigía', lat: 8.6151, lng: -71.6432 },
    gimnasio: {
      nombre: 'Gimnasio',
      direccion: 'Av. Los Próceres, El Vigía',
      lat: 8.6262,
      lng: -71.6568,
    },
    restaurantes: [
      ['Bella Pizza', 'Pizza', 'foto-pizza'],
      ['Sushi House', 'Sushi', 'foto-sushi'],
      ['Pollo Dorado', 'Pollo', 'foto-pollo'],
    ],
    recientes: [
      ['Mercado municipal, Av. Libertad, El Vigía', 8.6188, -71.6491],
      ['Colegio del centro, Calle 3, El Vigía', 8.6241, -71.6539],
    ],
    populares: [
      { titulo: 'Terminal de pasajeros', detalle: 'Av. Bolívar', lat: 8.612, lng: -71.643 },
      { titulo: 'Hospital central', detalle: 'Av. Principal', lat: 8.628, lng: -71.66 },
      { titulo: 'Centro comercial', detalle: 'Zona norte', lat: 8.64, lng: -71.655 },
      { titulo: 'Universidad', detalle: 'Sector universitario', lat: 8.633, lng: -71.67 },
    ],
    // Lo abierto en producción en El Vigía (auditoría de tiendas, 18 nov).
    servicios: ['comida', 'moto', 'carro', 'envios'],
    viaje: 'moto' as string | null,
    portada: 'moto',
    pago: 'efectivo',
    pasajero: 'Alex Rivera',
    conductor: 'Carlos Méndez',
    repartidor: 'Luis Herrera',
    telefono: '+584145550188',
    banner: ['Tu comida favorita, a tu puerta', 'Pizza, sushi, pollo y más, cerca de ti.'],
  },
  en: {
    carpeta: 'English',
    zona: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      pais: 'US',
      lat: 42.4806,
      lng: -83.4755,
      tz: 'America/Detroit',
    },
    casa: { direccion: '123 Main St, Novi, MI', lat: 42.4935, lng: -83.4612 },
    trabajo: { direccion: '456 Oak Ave, Novi, MI', lat: 42.4801, lng: -83.4902 },
    gimnasio: { nombre: 'Gym', direccion: '789 Park Ave, Novi, MI', lat: 42.4712, lng: -83.4687 },
    restaurantes: [
      ['Bella Pizza', 'Pizza', 'foto-pizza'],
      ['Sushi House', 'Sushi', 'foto-sushi'],
      ['Golden Chicken', 'Chicken', 'foto-pollo'],
    ],
    recientes: [] as (string | number)[][],
    populares: [] as { titulo: string; detalle: string; lat: number; lng: number }[],
    // Estados Unidos hoy: solo Comida (Novi y Miami).
    servicios: ['comida'],
    viaje: null as string | null,
    portada: 'comida',
    pago: 'tarjeta',
    pasajero: 'Alex Turner',
    conductor: 'Michael Brooks',
    repartidor: 'Sam Carter',
    telefono: '+12485550188',
    banner: ['Your local favorites, delivered', 'Pizza, sushi, chicken and more near you.'],
  },
};

/** Un número de prueba distinto en cada corrida (las cuentas de corridas anteriores se quedan). */
const telefonoDe = (base: string, n: number) =>
  `${base.slice(0, -4)}${String((Date.now() + n) % 10_000).padStart(4, '0')}`;

const TODOS = ['comida', 'mercado', 'farmacia', 'licores', 'carro', 'moto', 'envios'];
// El teléfono: 402 × 874 puntos a 3× (1206 × 2622). La app web no dibuja barra de estado.
const TELEFONO = { width: 402, height: 874 };

/** Un teléfono con la sesión de la cuenta, el idioma y los permisos ya explicados. */
async function telefono(
  browser: Browser,
  idioma: 'es' | 'en',
  cuenta: { token: string; usuario: { id: string } },
  donde: { lat: number; lng: number },
) {
  const ctx = await browser.newContext({
    viewport: TELEFONO,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    baseURL: DATOS!.url,
    locale: idioma === 'en' ? 'en-US' : 'es-VE',
    geolocation: { latitude: donde.lat, longitude: donde.lng },
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(
    ([pase, idi, u]) => {
      localStorage.setItem('tumbite.idioma', idi);
      localStorage.setItem('tumbite.sesion', pase);
      localStorage.setItem(`divoox.permisos.${u}`, '1');
      // La portada de respaldo que toca al abrir (la moto en El Vigía; en Novi, comida).
      localStorage.setItem('inicio-ultima-portada', '|1');
    },
    [cuenta.token, idioma, cuenta.usuario.id] as const,
  );
  return ctx;
}

// Al terminar, los servicios de pasajeros vuelven a quedar apagados en esta base local: encendidos
// en un país sin apertura, el canario de servicios se pone en rojo y el servidor del recorrido no
// vuelve a arrancar (su salud tiene que dar 200).
test.afterAll(() => {
  if (!ACTIVO) return;
  sql(
    "UPDATE servicios_zona SET estado = 'no_disponible' WHERE estado = 'disponible' AND servicio_id IN (SELECT id FROM servicios WHERE transporta_personas = 1)",
  );
  sql(
    "UPDATE servicios SET estado = 'proximamente' WHERE transporta_personas = 1 AND estado = 'disponible'",
  );
});

for (const idioma of ['es', 'en'] as const)
  test(`capturas de las fichas del cliente y del Driver (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(420_000);
    const C = CIUDADES[idioma];
    const z = C.zona;
    const en = idioma === 'en';
    const carpeta = join(DESTINO, 'Divoox (cliente)', 'Google Play', C.carpeta, 'Celular');
    const carpetaDriver = join(
      DESTINO,
      'Divoox Driver (repartidor)',
      'Google Play',
      C.carpeta,
      'Celular',
    );
    mkdirSync(carpeta, { recursive: true });
    mkdirSync(carpetaDriver, { recursive: true });
    const id = `${Date.now().toString(36)}${idioma}`;
    let ip = 0;
    const cuenta = async (rol: string, nombre: string, extra: object = {}) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.98.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: {
          nombre,
          correo: `tienda.${rol}.${id}.${ip}@recorrido.test`,
          clave: DATOS!.clave,
          rol,
          ...extra,
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const c = (await r.json()) as { token: string; usuario: { id: string } };
      sql(
        `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${c.usuario.id}'`,
      );
      return c;
    };
    const h = (t: string, extra: Record<string, string> = {}) => ({
      authorization: `Bearer ${t}`,
      ...extra,
    });
    const foto = async (p: Page, dir: string, nombre: string, arriba = dir === carpetaDriver) => {
      await p.waitForTimeout(1_200);
      // La burbuja de ayuda no sale en las fotos de la ficha.
      await p.evaluate(() =>
        document
          .querySelectorAll<HTMLElement>('[class*=burbuja]')
          .forEach((e) => (e.style.visibility = 'hidden')),
      );
      // La tarjeta de avisos «bloqueados en este navegador» es de la versión web (la app de la tienda
      // los pide con el permiso del teléfono): se descarta con «Ahora no», como en el recorrido.
      const ahoraNo = p
        .getByTestId('tarjeta-avisos-web')
        .getByText(en ? 'Not now' : 'Ahora no', { exact: true });
      if (await ahoraNo.isVisible().catch(() => false)) {
        await ahoraNo.click();
        await p.waitForTimeout(600);
      }
      // El Driver se fotografía desde arriba (cabecera, estado y mapa), como en el recorrido.
      if (arriba) {
        await p.evaluate(() => {
          window.scrollTo(0, 0);
          document.querySelectorAll('div').forEach((x) => {
            if (x.scrollHeight > x.clientHeight + 4) x.scrollTop = 0;
          });
        });
        await p.waitForTimeout(500);
      }
      await p.screenshot({ path: join(dir, nombre) });
    };
    const mapaListo = (p: Page) =>
      p
        .locator('.leaflet-tile-loaded')
        .first()
        .waitFor({ timeout: 15_000 })
        .then(() => p.waitForTimeout(1_500))
        .catch(() => undefined);

    // ───────── La ciudad con SOLO los servicios abiertos en producción (en la base local)
    const admin = await cuenta('cliente', en ? 'Divoox Support' : 'Soporte Divoox');
    sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
    sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, idioma)
         VALUES ('${z.id}', '${z.nombre}', '${z.pais}', 'USD', '${z.tz}', ${z.lat}, ${z.lng}, 15, 1, '${idioma}')`);
    const SERVICIOS: readonly string[] = C.servicios;
    for (const s of TODOS) {
      const abierto = SERVICIOS.includes(s);
      sql(
        `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('${s}', 1)`,
      );
      if (abierto) sql(`UPDATE servicios SET estado = 'disponible' WHERE id = '${s}'`);
      sql(`DELETE FROM servicios_zona WHERE servicio_id = '${s}' AND zona_id = '${z.id}'`);
      sql(
        `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('${s}', '${z.id}', '${abierto ? 'disponible' : 'no_disponible'}')`,
      );
    }
    for (const s of ['moto', 'carro', 'envios'].filter((x) => SERVICIOS.includes(x))) {
      const t = await request.post('/datos/admin/viajes/tarifas', {
        headers: h(admin.token),
        data: {
          servicio: s,
          zona: z.id,
          tarifa: { base: 50, porKm: 22, porMinuto: 3, minimo: 100 },
          dePrueba: false,
          motivo: 'Capturas de la tienda',
        },
      });
      expect(t.ok(), await t.text()).toBe(true);
    }

    if (z.pais !== 'US') {
      // Comida abierta en la ciudad, en dólares, con la tasa de referencia del día (el paso del panel
      // que da el equipo, como en scripts/staging/probar-comida-venezuela.mjs).
      const abrir = await request.post('/datos/admin/comida/ciudades', {
        headers: h(admin.token),
        data: {
          zona: {
            id: z.id,
            nombre: z.nombre,
            lat: z.lat,
            lng: z.lng,
            radioKm: 15,
            zonaHoraria: z.tz,
            moneda: 'USD',
          },
          motivo: 'Capturas de la tienda',
        },
      });
      expect(abrir.ok(), await abrir.text()).toBe(true);
      sql(SQL_TASA_EJEMPLO);
    }

    // El carrusel del inicio: una promoción de COMIDA sin precio ni código (Google Play no admite
    // ofertas en las capturas).
    sql(`DELETE FROM cupones WHERE destacado = 1`);
    sql(`DELETE FROM banners WHERE lugar = 'promociones'`);
    sql(`INSERT OR REPLACE INTO banners (id, lugar, estado, imagen, titulo_es, titulo_en, texto_es, texto_en, destino_tipo, destino_valor, zonas, orden)
         VALUES ('tienda-banner-comida', 'promociones', 'publicado', '${BANNER_COMIDA}', '${CIUDADES.es.banner[0]}', '${CIUDADES.en.banner[0]}',
                 '${CIUDADES.es.banner[1]}', '${CIUDADES.en.banner[1]}', 'servicio', 'comida', '[]', 1)`);
    // Ningún pedido de otras corridas en la ciudad (el mapa del Driver no marca zonas con pedidos).
    sql(`UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${z.id}'`);

    // Los restaurantes de corridas anteriores de las capturas se pausan (no salen repetidos).
    sql(
      `UPDATE restaurantes SET estado = 'pausado', abierto = 0 WHERE id LIKE 'rest-tienda-%' AND zona_id = '${z.id}'`,
    );
    // …y sus pedidos quedan fuera de «la última hora» (el mapa del Driver no muestra cifras de demanda).
    sql(
      `UPDATE pedidos SET creado_en = datetime('now', '-3 hours') WHERE restaurante_id LIKE 'rest-tienda-%'`,
    );
    // Restaurantes con nombres neutros, abiertos todo el día, cerca de la persona.
    const restos: { id: string; token: string; lat: number; lng: number }[] = [];
    for (const [i, [nombre, categoria, img]] of C.restaurantes.entries()) {
      const duenio = await cuenta('restaurante', nombre!);
      const rid = `rest-tienda-${id}-${i}`;
      const lat = z.lat + 0.003 * (i + 1);
      const lng = z.lng + 0.002 * (i + 1);
      sql(`INSERT INTO restaurantes (id, dueno_id, nombre, categoria, telefono, direccion, lat, lng, estado, abierto, zona_id, geohash, senal_en, imagen, tiempo_prep_min)
           VALUES ('${rid}', '${duenio.usuario.id}', '${nombre}', '${categoria}', '${C.telefono}', '${z.nombre}', ${lat}, ${lng}, 'aprobado', 1, '${z.id}', '${geohash(lat, lng)}', datetime('now'), '${FOTOS}/${img}.webp', ${10 + i * 5})`);
      for (let d = 0; d < 7; d++)
        sql(
          `INSERT INTO horarios_restaurante (restaurante_id, dia, abre, cierra) VALUES ('${rid}', ${d}, '00:00', '23:59')`,
        );
      restos.push({ id: rid, token: duenio.token, lat, lng });
    }
    // El menú de Bella Pizza: pizzas (la margarita con tamaño), una entrada y una bebida.
    const r0 = restos[0]!;
    // Las categorías salen en orden alfabético: los nombres dejan las pizzas arriba.
    const platos = [
      ['margarita', 'Pizza margarita', 'Margherita pizza', 'Pizzas', 'Pizzas', 1450, 'foto-pizza'],
      [
        'pepperoni',
        'Pizza de pepperoni',
        'Pepperoni pizza',
        'Pizzas',
        'Pizzas',
        1650,
        'oferta-pizza',
      ],
      ['tiramisu', 'Tiramisú', 'Tiramisu', 'Postres', 'Sweets', 550, null],
      ['limonada', 'Limonada', 'Lemonade', 'Refrescos', 'Soft drinks', 350, null],
    ] as const;
    for (const [i, [clave, es, enN, cat, catEn, precio, img]] of platos.entries())
      sql(`INSERT INTO platos (id, restaurante_id, nombre_es, nombre_en, categoria, categoria_en, precio_centavos, imagen, orden)
           VALUES ('pl-${clave}-${id}', '${r0.id}', '${es}', '${enN}', '${cat}', '${catEn}', ${precio}, ${img ? `'${FOTOS}/${img}.webp'` : 'NULL'}, ${i})`);
    sql(`INSERT INTO grupos_opciones (id, plato_id, nombre_es, nombre_en, minimo, maximo, orden)
         VALUES ('go-tam-${id}', 'pl-margarita-${id}', 'Tamaño', 'Size', 1, 1, 0)`);
    sql(`INSERT INTO opciones (id, grupo_id, nombre_es, nombre_en, precio_centavos, orden)
         VALUES ('op-med-${id}', 'go-tam-${id}', 'Mediana', 'Medium', 0, 0), ('op-gra-${id}', 'go-tam-${id}', 'Grande', 'Large', 400, 1)`);

    // ═════════ COMIDA: el cliente con Casa, Trabajo y Gimnasio guardados ═════════
    // Un teléfono no abre dos cuentas: cada corrida usa el suyo.
    const cli = await cuenta('cliente', C.pasajero, { telefono: telefonoDe(C.telefono, 0) });
    for (const [etiqueta, icono, d] of [
      [en ? 'Home' : 'Casa', 'casa', C.casa],
      [en ? 'Work' : 'Trabajo', 'trabajo', C.trabajo],
      [C.gimnasio.nombre, 'gimnasio', C.gimnasio],
    ] as const) {
      const r = await request.post('/datos/mis-direcciones', {
        headers: h(cli.token),
        data: { etiqueta, icono, direccion: d.direccion, lat: d.lat, lng: d.lng },
      });
      expect(r.ok(), await r.text()).toBe(true);
    }
    const ctx = await telefono(browser, idioma, cli, C.casa);
    const p = await ctx.newPage();

    // 01 · El inicio: solo lo abierto, la portada y la promoción de comida, restaurantes cercanos.
    await p.goto('/app/');
    for (const s of [...SERVICIOS, 'mas'])
      await expect(p.getByTestId(`servicio-${s}`)).toBeVisible({ timeout: 30_000 });
    for (const s of TODOS.filter((x) => !SERVICIOS.includes(x)))
      // C-OCHO-ICONOS-SIEMPRE: los de la cuadrícula de ocho se ven siempre, abran o no en la zona.
      await expect(p.getByTestId(`servicio-${s}`)).toHaveCount(
        ['mercado', 'farmacia', 'licores', 'carro', 'moto', 'envios'].includes(s) ? 1 : 0,
      );
    await expect(p.getByTestId(`portada-respaldo-${C.portada}`)).toBeVisible();
    await expect(p.getByText(C.banner[en ? 1 : 0]!.split(',')[0]!).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(p.getByText('Bella Pizza').first()).toBeVisible({ timeout: 30_000 });
    await foto(p, carpeta, '01-inicio.png');

    // Direcciones guardadas: «Entregar en ▾» abre Casa, Trabajo y Gimnasio.
    await p.getByTestId('inicio-direccion').click();
    await expect(p.getByTestId('inicio-direccion-casilla')).toBeVisible({ timeout: 10_000 });
    await expect(p.getByText(C.trabajo.direccion).first()).toBeVisible({ timeout: 20_000 });
    await p.getByTestId('inicio-direccion-casilla').blur();
    await p.waitForTimeout(900);
    await foto(p, carpeta, '08-direcciones-guardadas.png');
    await p.getByRole('button', { name: en ? 'Close' : 'Cerrar', exact: true }).click();

    // Restaurantes cercanos (la pantalla de Comida).
    await p.getByTestId('servicio-comida').click();
    await expect(p.getByLabel(/Buscar restaurantes|Search restaurants/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(p.getByText('Sushi House').filter({ visible: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await foto(p, carpeta, '02-restaurantes-cercanos.png');

    // El menú de Bella Pizza.
    await p.goto(`/app/restaurant/${r0.id}`);
    const pizza = en ? 'Margherita pizza' : 'Pizza margarita';
    await expect(p.getByText(pizza).filter({ visible: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await foto(p, carpeta, '03-menu-del-restaurante.png');
    // Elige el tamaño (Grande) y agrega una limonada.
    await p
      .getByRole('button', { name: `${en ? 'Add' : 'Agregar'} ${pizza}` })
      .filter({ visible: true })
      .click();
    const grande = p.getByRole('radio', { name: en ? 'Large' : 'Grande' });
    await expect(grande).toBeVisible({ timeout: 10_000 });
    await grande.click();
    await p.waitForTimeout(900);
    // En español van Moto y su seguimiento: las ocho de Google Play no alcanzan para esta también.
    if (en) await foto(p, carpeta, '04-elige-tamano-y-extras.png');
    await p.getByRole('button', { name: en ? 'Add to cart' : 'Agregar al carrito' }).click();
    await p
      .getByRole('button', { name: `${en ? 'Add' : 'Agregar'} ${en ? 'Lemonade' : 'Limonada'}` })
      .filter({ visible: true })
      .click();
    await p
      .getByRole('button', { name: en ? 'View cart' : 'Ver carrito' })
      .filter({ visible: true })
      .click();
    // El carrito con el precio completo, entregando en la puerta de Casa.
    await p.getByRole('radio', { name: en ? 'Leave at my door' : 'En la puerta' }).click();
    await p.getByLabel(en ? 'Street address' : 'Calle y número').fill(C.casa.direccion);
    await mapaListo(p);
    // En Venezuela se paga al recibir: el botón dice «Pedir y pagar al recibir».
    const seguir = p
      .getByRole('button', {
        name: /^(Continue to payment|Continuar al pago|Pedir y pagar al recibir)/,
      })
      .last();
    await seguir.scrollIntoViewIfNeeded();
    await foto(p, carpeta, '05-carrito-con-el-precio-completo.png');

    // ═════════ DRIVER: un repartidor de comida conectado cerca del restaurante ═════════
    const rep = await cuenta('repartidor', C.repartidor);
    const rid = rep.usuario.id;
    const yo = (metodo: 'GET' | 'POST', ruta: string, data: object = {}) =>
      metodo === 'GET'
        ? request.get(`/datos${ruta}`, { headers: h(rep.token) })
        : request.post(`/datos${ruta}`, { headers: h(rep.token), data });
    expect((await yo('POST', '/repartidor/terminos', { version: VERSION_TERMINOS })).ok()).toBe(
      true,
    );
    // Su foto de control al día (aquí se toman fotos, no se prueba la verificación).
    sql(
      `INSERT INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES ('sc-${id}', '${rid}', datetime('now'), 'ok')`,
    );
    // Saldo para las comisiones (donde el servicio funciona con saldo prepago).
    sql(
      `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('recarga-rep-${id}', '${rid}', 'prepago', '${z.pais}', 'USD', 2000, 'recarga_recorrido', 'recarga-rep-${id}')`,
    );
    const cerca = { lat: r0.lat - 0.001, lng: r0.lng - 0.001 };
    sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${rid}', 0, ${cerca.lat}, ${cerca.lng}, datetime('now'), '${z.id}')
         ON CONFLICT(usuario_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
    const conectar = await yo('POST', '/repartidor/conectar', { conectado: true, ...cerca });
    expect(conectar.ok(), await conectar.text()).toBe(true);
    const ubicar = async (d: { lat: number; lng: number }) => {
      await yo('POST', '/repartidor/ubicacion', { ...d, precision: 8 });
      // El servidor descarta saltos de GPS: en esta base local la posición se escribe directo.
      sql(
        `UPDATE repartidores SET conectado = 1, lat = ${d.lat}, lng = ${d.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${rid}'`,
      );
    };
    await ubicar(cerca);
    const ctxD = await telefono(browser, idioma, rep, cerca);
    const d = await ctxD.newPage();
    await d.goto('/driver/');
    await expect(
      d.getByText(/Online for \d+ services?|Conectado a \d+ servicios?/).filter({ visible: true }),
    ).toBeVisible({ timeout: 30_000 });
    await mapaListo(d);
    await foto(d, carpetaDriver, '01-conectado-buscando-pedidos.png');

    // ═════════ El pedido: pagado, aceptado por el restaurante y ofrecido al repartidor ═════════
    const pedidoR = await request.post('/datos/pedidos', {
      headers: h(cli.token),
      data: {
        restauranteId: r0.id,
        lineas: [
          { platoId: `pl-margarita-${id}`, cantidad: 1, opciones: [`op-gra-${id}`] },
          { platoId: `pl-limonada-${id}`, cantidad: 1 },
        ],
        propinaCentavos: 300,
        direccion: C.casa.direccion,
        lat: C.casa.lat,
        lng: C.casa.lng,
        ...(C.pago === 'tarjeta' ? {} : { metodoPago: C.pago }),
      },
    });
    expect(pedidoR.ok(), await pedidoR.text()).toBe(true);
    const pid = ((await pedidoR.json()) as { pedidoId: string }).pedidoId;
    if (C.pago === 'tarjeta')
      // El banco aprobó la tarjeta (en esta base local el pago queda anotado directo).
      sql(`UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now') WHERE id = '${pid}'`);
    const resto = (ruta: string, data: object = {}) =>
      request.post(`/datos/restaurante/pedidos/${pid}/${ruta}`, { headers: h(r0.token), data });
    const acepto = await resto('aceptar', { minutos: 5 });
    expect(acepto.ok(), await acepto.text()).toBe(true);
    // Como en el recorrido: la cocina lo deja listo y recién ahí se ofrece (al repartidor que está
    // al lado no se le manda a esperar en el local).
    const listo = await resto('listo');
    expect(listo.ok(), await listo.text()).toBe(true);
    await ubicar(cerca);
    // La oferta llega al pedir la lista (como la app): se espera a que sea suya.
    await expect
      .poll(
        async () => {
          const r = await yo('GET', '/repartidor/ofertas');
          const o = (await r.json()) as { ofertas?: { id: string }[] };
          return o.ofertas?.some((x) => x.id === pid) ?? false;
        },
        { timeout: 60_000, intervals: [3_000] },
      )
      .toBe(true);
    // La oferta en la app del Driver, con el pago antes de aceptar.
    await expect(
      d.getByRole('button', { name: en ? 'Accept' : 'Aceptar', exact: true }),
    ).toBeVisible({ timeout: 60_000 });
    await foto(d, carpetaDriver, '02-oferta-con-el-pago-antes-de-aceptar.png');
    await d.getByRole('button', { name: en ? 'Accept' : 'Aceptar', exact: true }).click();
    await expect
      .poll(() => sql(`SELECT repartidor_id FROM pedidos WHERE id = '${pid}'`)[0]?.repartidor_id, {
        timeout: 30_000,
      })
      .toBe(rid);
    if (C.pago !== 'tarjeta') {
      // Paga el pedido en el local (el cliente le paga al recibir), como en Venezuela.
      const l = await yo('GET', `/repartidor/pedidos/${pid}/pago-local`);
      if (l.ok()) {
        const pl = (await l.json()) as { montoEsperado?: number; subtotal?: number };
        if (pl.montoEsperado != null)
          await yo('POST', `/repartidor/pedidos/${pid}/pago-local`, {
            montoPagado: pl.montoEsperado,
            importeTicket: pl.subtotal,
            metodo: 'efectivo',
          });
      }
    }
    const recogida = await request.post(
      `/datos/repartidor/pedidos/${pid}/foto-recogida?lat=${r0.lat}&lng=${r0.lng}`,
      { headers: { ...h(rep.token), 'content-type': 'image/jpeg' }, data: FOTO_BOLSA },
    );
    expect(recogida.ok(), await recogida.text()).toBe(true);
    expect((await resto('confirmar-recogida')).ok()).toBe(true);
    // A mitad de camino hacia Casa.
    const enRuta = { lat: (r0.lat + C.casa.lat) / 2, lng: (r0.lng + C.casa.lng) / 2 };
    await ubicar(enRuta);
    await ctxD.setGeolocation({ latitude: enRuta.lat, longitude: enRuta.lng });
    await d.reload();
    await expect(d.getByText(/^(Deliver to|Entrega en):$/).filter({ visible: true })).toBeVisible({
      timeout: 30_000,
    });
    await mapaListo(d);
    await foto(d, carpetaDriver, '03-en-camino-como-llegar.png');

    // El cliente sigue su pedido en vivo en el mapa.
    await p.goto(`/app/order/${pid}`);
    await p
      .getByText(en ? 'Not now' : 'Ahora no', { exact: true })
      .click({ timeout: 8_000 })
      .catch(() => undefined);
    await expect(p.getByText(/Your driver is on the way|Tu repartidor va en camino/)).toBeVisible({
      timeout: 30_000,
    });
    await mapaListo(p);
    await foto(p, carpeta, '07-pedido-en-vivo-en-el-mapa.png');

    // Estados Unidos: la entrega en la puerta con foto y sus ganancias en el Driver (en Venezuela la
    // ficha muestra el saldo, que sale de regalosDivoox.spec.ts).
    if (en) {
      await ubicar(C.casa);
      await ubicar(C.casa);
      // El repartidor llegó a la puerta (como en capturas-comida-venezuela.mjs).
      sql(
        `INSERT OR IGNORE INTO hitos_pedido (pedido_id, hito) VALUES ('${pid}', 'llego_cliente')`,
      );
      const entrega = await request.post(
        `/datos/repartidor/pedidos/${pid}/entregado?lat=${C.casa.lat}&lng=${C.casa.lng}`,
        { headers: { ...h(rep.token), 'content-type': 'image/jpeg' }, data: FOTO_BOLSA },
      );
      expect(entrega.ok(), await entrega.text()).toBe(true);
      await d.goto('/driver/');
      await d.getByText('Earnings', { exact: true }).last().click({ timeout: 30_000 });
      await expect(d.getByTestId('ganancias-desglose')).toBeVisible({ timeout: 30_000 });
      // Ganancias empieza en su título (arriba de la pestaña va el modo destino).
      await d
        .getByText('Earnings', { exact: true })
        .first()
        .evaluate((x) => x.scrollIntoView({ block: 'start' }));
      await foto(d, carpetaDriver, '04-ganancias.png', false);
    }
    await yo('POST', '/repartidor/conectar', { conectado: false });
    await ctxD.close();
    await ctx.close();

    // ═════════ VIAJES (solo donde están abiertos: El Vigía) ═════════
    if (C.viaje) await viajes(browser, request, idioma, { id, admin, carpeta, cuenta, h, foto });
  });

/** Moto en El Vigía: el precio con el destino y el seguimiento del viaje con su conductor. */
async function viajes(
  browser: Browser,
  request: APIRequestContext,
  idioma: 'es' | 'en',
  x: {
    id: string;
    admin: { usuario: { id: string } };
    carpeta: string;
    cuenta: (
      rol: string,
      nombre: string,
      extra?: object,
    ) => Promise<{ token: string; usuario: { id: string } }>;
    h: (t: string, extra?: Record<string, string>) => Record<string, string>;
    foto: (p: Page, dir: string, nombre: string) => Promise<void>;
  },
) {
  const C = CIUDADES[idioma];
  const z = C.zona;
  const viaje = C.viaje!;
  const { id, cuenta, h, foto, carpeta } = x;
  const cond = await cuenta('repartidor', C.conductor);
  const c = cond.usuario.id;
  const v = `veh-tienda-${id}`;
  // Aquí se toman fotos, no se prueba el alta del conductor (como en regalosDivoox).
  const requisitos = sql(
    `SELECT servicio_id, requisito, obligatorio FROM servicio_requisitos WHERE servicio_id = '${viaje}'`,
  );
  sql(`DELETE FROM servicio_requisitos WHERE servicio_id = '${viaje}'`);
  try {
    sql(`UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${z.id}'`);
    sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${c}', 1, ${z.lat + 0.004}, ${z.lng - 0.003}, datetime('now'), '${z.id}')
       ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
    sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
       VALUES ('${v}', '${c}', '${viaje}', 'Vespa', 'Primavera', 'Roja', 'AB${String(Date.now() % 100_000).padStart(5, '0')}', '', 2023, 1, 'aprobado')`);
    sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
    for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
      sql(
        `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${t}-${id}', '${v}', '${t}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
      );
    sql(
      `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', '${viaje}', 'aprobada', '${x.admin.usuario.id}', datetime('now'))`,
    );
    sql(
      `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', '${viaje}', 1)`,
    );
    sql(
      `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('recarga-${id}', '${c}', 'prepago', '${z.pais}', 'USD', 2000, 'recarga_recorrido', 'recarga-${id}')`,
    );
    // El pasajero (otra cuenta, sin el pedido de comida), con sus lugares y viajes anteriores.
    const cli = await cuenta('cliente', C.pasajero, { telefono: telefonoDe(C.telefono, 1) });
    for (const [etiqueta, icono, d] of [
      ['Casa', 'casa', C.casa],
      ['Trabajo', 'trabajo', C.trabajo],
      [C.gimnasio.nombre, 'gimnasio', C.gimnasio],
    ] as const) {
      const r = await request.post('/datos/mis-direcciones', {
        headers: h(cli.token),
        data: { etiqueta, icono, direccion: d.direccion, lat: d.lat, lng: d.lng },
      });
      expect(r.ok(), await r.text()).toBe(true);
    }
    const ahora = Date.now();
    const anteriores: [string, number, number, number][] = [
      [C.trabajo.direccion, C.trabajo.lat, C.trabajo.lng, 7],
      ...C.recientes.map(
        (r, i) =>
          [String(r[0]), Number(r[1]), Number(r[2]), 3 - i] as [string, number, number, number],
      ),
    ];
    for (const [i, [dir, lat, lng, dias]] of anteriores.entries()) {
      const op = `op-tienda-${id}-${i}`;
      const enF = new Date(ahora - dias * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
      sql(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general, creado_en) VALUES ('${op}', '${viaje}', 'viaje_pasajero', '${cli.usuario.id}', '${z.id}', 'terminada', '${enF}')`,
      );
      sql(`INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, pin_recogida)
         VALUES ('${op}', 'terminado', 'sistema', 'alta:${op}', ${z.lat}, ${z.lng}, '${z.nombre}', ${lat}, ${lng}, '${dir.replace(/'/g, "''")}', '4321')`);
    }
    sql(`INSERT INTO config (clave, valor, actualizado_en) VALUES ('populares:${z.id}', '${JSON.stringify({ origen: 'ciudad', lugares: C.populares }).replace(/'/g, "''")}', datetime('now'))
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en`);

    const ctx = await telefono(browser, idioma, cli, { lat: z.lat, lng: z.lng });
    const p = await ctx.newPage();
    await p.goto('/app/');
    await p.getByTestId(`servicio-${viaje}`).click();
    await expect(p.getByTestId('lugar-casa')).toBeVisible({ timeout: 30_000 });
    await p.getByTestId('lugar-casa').click();
    await expect(p.getByTestId('moto-precio')).toBeVisible({ timeout: 30_000 });
    await foto(p, carpeta, '06-moto-con-destino-y-precio.png');
    await p.getByTestId('pedir-boton').click();
    await expect(p.getByTestId('viaje-estado-buscando')).toBeVisible({ timeout: 30_000 });
    const op = String(
      sql(
        `SELECT o.id FROM operaciones o WHERE o.cliente_id = '${cli.usuario.id}' AND o.estado_general = 'buscando'`,
      )[0]?.id ?? '',
    );
    expect(op).not.toBe('');
    await expect
      .poll(
        async () =>
          (
            await request.post(`/datos/conductor/operaciones/${op}/aceptar`, {
              headers: { ...h(cond.token), 'idempotency-key': `tienda-aceptar-${id}` },
              data: {},
            })
          ).status(),
        { timeout: 30_000 },
      )
      .toBe(200);
    // Como al volver a abrir la app con el viaje en curso: entra directo al seguimiento.
    await p.goto('/app/');
    await expect(p.getByTestId('viaje-conductor')).toBeVisible({ timeout: 30_000 });
    await p
      .locator('.leaflet-tile-loaded')
      .first()
      .waitFor({ timeout: 15_000 })
      .catch(() => undefined);
    await foto(p, carpeta, '06b-seguimiento-del-viaje.png');
    await ctx.close();
  } finally {
    for (const r of requisitos)
      sql(
        `INSERT OR IGNORE INTO servicio_requisitos (servicio_id, requisito, obligatorio) VALUES ('${String(r.servicio_id)}', '${String(r.requisito)}', ${Number(r.obligatorio)})`,
      );
  }
}

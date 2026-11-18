import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { geohash } from '@tumbite/compartido';
import { expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';

/**
 * Capturas de la ficha de Google Play del cliente (18 nov 2026, inicio nuevo aprobado): a tamaño de
 * iPhone (1206 × 2622), con datos neutros, en español (El Vigía) y en inglés (Novi), con TODOS los
 * servicios encendidos en la ciudad. Solo con CAPTURAS_TIENDA=1 y en esta computadora: guarda en
 * capturas-tiendas/ de la carpeta principal (fuera de git), de donde lee scripts/marca/fichas-tiendas.mjs.
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
// La foto del banner del súper (la misma del administrador de banners del sitio de pruebas).
const BANNER_MERCADO = 'https://staging.tumbite.com/media/fotos/banners/demo-banner-mercado.webp';

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
    trabajo: {
      direccion: 'Edificio Torre Norte, Av. Bolívar, El Vigía',
      lat: 8.6151,
      lng: -71.6432,
    },
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
    // Lo que de verdad está abierto en el sitio de pruebas en esa ciudad (auditor de tiendas, 18 nov).
    servicios: ['comida', 'carro', 'moto'],
    viaje: 'moto',
    portada: 'moto',
    pasajero: 'Alex Rivera',
    conductor: 'Carlos Méndez',
    telefono: '+584145550188',
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
    casa: { direccion: '41000 Oak Ave, Novi, MI', lat: 42.4935, lng: -83.4612 },
    trabajo: {
      direccion: 'North Tower Building, Grand River Ave, Novi, MI',
      lat: 42.4801,
      lng: -83.4902,
    },
    gimnasio: { nombre: 'Gym', direccion: 'Park Ave, Novi, MI', lat: 42.4712, lng: -83.4687 },
    restaurantes: [
      ['Bella Pizza', 'Pizza', 'foto-pizza'],
      ['Sushi House', 'Sushi', 'foto-sushi'],
      ['Golden Chicken', 'Chicken', 'foto-pollo'],
    ],
    recientes: [
      ['Farmers market, Liberty Ave, Novi, MI', 42.4851, -83.4733],
      ['Downtown school, 3rd St, Novi, MI', 42.4778, -83.4801],
    ],
    populares: [
      { titulo: 'Public library', detalle: 'Taft Rd', lat: 42.481, lng: -83.473 },
      { titulo: 'General hospital', detalle: 'Grand River Ave', lat: 42.488, lng: -83.49 },
      { titulo: 'Shopping mall', detalle: 'North side', lat: 42.494, lng: -83.47 },
      { titulo: 'City park', detalle: 'Downtown', lat: 42.476, lng: -83.48 },
    ],
    // En Novi no hay Moto ni Envíos: la ficha en inglés muestra Carro y una portada de comida.
    servicios: ['comida', 'carro', 'mercado', 'farmacia', 'licores'],
    viaje: 'carro',
    portada: 'comida',
    pasajero: 'Alex Turner',
    conductor: 'Michael Brooks',
    telefono: '+12485550188',
  },
} as const;

const TODOS = ['comida', 'mercado', 'farmacia', 'licores', 'carro', 'moto', 'envios'];

for (const idioma of ['es', 'en'] as const)
  test(`capturas de la tienda del cliente (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const C = CIUDADES[idioma];
    const z = C.zona;
    const carpeta = join(DESTINO, 'Divoox (cliente)', 'Google Play', C.carpeta, 'Celular');
    mkdirSync(carpeta, { recursive: true });
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
      return (await r.json()) as { token: string; usuario: { id: string } };
    };
    const h = (t: string) => ({ authorization: `Bearer ${t}` });

    // La ciudad con los ocho servicios encendidos (solo en la base local del recorrido).
    const admin = await cuenta('cliente', idioma === 'es' ? 'Soporte Divoox' : 'Divoox Support');
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
    for (const s of ['moto', 'carro', 'envios']) {
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

    // El carrusel del inicio con una promoción SIN precio ni código (Google Play no admite ofertas en
    // las capturas): el banner del súper, como el del administrador de banners del sitio de pruebas.
    sql(`DELETE FROM cupones WHERE destacado = 1`);
    sql(`INSERT OR REPLACE INTO banners (id, lugar, estado, imagen, titulo_es, titulo_en, texto_es, texto_en, destino_tipo, destino_valor, zonas, orden)
         VALUES ('tienda-banner-mercado', 'promociones', 'publicado', '${BANNER_MERCADO}', 'Tu súper sin salir de casa', 'Your groceries without leaving home',
                 'Frutas, pan y más en minutos.', 'Fruit, bread and more in minutes.', 'servicio', 'mercado', '[]', 1)`);
    // Restaurantes con nombres neutros, abiertos todo el día, cerca de la persona.
    for (const [i, [nombre, categoria, foto]] of C.restaurantes.entries()) {
      const duenio = await cuenta('restaurante', nombre);
      const rid = `rest-tienda-${id}-${i}`;
      const lat = z.lat + 0.003 * (i + 1);
      const lng = z.lng + 0.002 * (i + 1);
      sql(`INSERT INTO restaurantes (id, dueno_id, nombre, categoria, telefono, direccion, lat, lng, estado, abierto, zona_id, geohash, senal_en, imagen, tiempo_prep_min)
           VALUES ('${rid}', '${duenio.usuario.id}', '${nombre}', '${categoria}', '${C.telefono}', '${z.nombre}', ${lat}, ${lng}, 'aprobado', 1, '${z.id}', '${geohash(lat, lng)}', datetime('now'), '${FOTOS}/${foto}.webp', ${10 + i * 5})`);
      for (let d = 0; d < 7; d++)
        sql(
          `INSERT INTO horarios_restaurante (restaurante_id, dia, abre, cierra) VALUES ('${rid}', ${d}, '00:00', '23:59')`,
        );
    }

    // El conductor de moto, cerca, con su vehículo aprobado.
    const cond = await cuenta('repartidor', C.conductor);
    const c = cond.usuario.id;
    const v = `veh-tienda-${id}`;
    // Aquí se toman fotos, no se prueba el alta del conductor (como en regalosDivoox).
    const requisitos = sql(
      `SELECT servicio_id, requisito, obligatorio FROM servicio_requisitos WHERE servicio_id = '${C.viaje}'`,
    );
    sql(`DELETE FROM servicio_requisitos WHERE servicio_id = '${C.viaje}'`);
    try {
      sql(`UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${z.id}'`);
      sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${c}', 1, ${z.lat + 0.004}, ${z.lng - 0.003}, datetime('now'), '${z.id}')
         ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
      sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
         VALUES ('${v}', '${c}', '${C.viaje}', '${C.viaje === 'moto' ? 'Vespa' : 'Toyota'}', '${C.viaje === 'moto' ? 'Primavera' : 'Corolla'}', '${idioma === 'es' ? 'Roja' : 'Silver'}', '${idioma === 'es' ? 'AB123CD' : 'ABC1234'}', '', 2023, ${C.viaje === 'moto' ? 1 : 4}, 'aprobado')`);
      sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
      for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
        sql(
          `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${t}-${id}', '${v}', '${t}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
        );
      sql(
        `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', '${C.viaje}', 'aprobada', '${admin.usuario.id}', datetime('now'))`,
      );
      sql(
        `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', '${C.viaje}', 1)`,
      );
      sql(
        `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('recarga-${id}', '${c}', 'prepago', '${z.pais}', 'USD', 2000, 'recarga_recorrido', 'recarga-${id}')`,
      );
      // El pasajero, con Casa, Trabajo y Gimnasio, viajes anteriores (Recientes) y Populares de la ciudad.
      const cli = await cuenta('cliente', C.pasajero, { telefono: C.telefono });
      for (const [etiqueta, icono, d] of [
        [idioma === 'es' ? 'Casa' : 'Home', 'casa', C.casa],
        [idioma === 'es' ? 'Trabajo' : 'Work', 'trabajo', C.trabajo],
        [C.gimnasio.nombre, 'gimnasio', C.gimnasio],
      ] as const) {
        const r = await request.post('/datos/mis-direcciones', {
          headers: h(cli.token),
          data: { etiqueta, icono, direccion: d.direccion, lat: d.lat, lng: d.lng },
        });
        expect(r.ok(), await r.text()).toBe(true);
      }
      const ahora = new Date();
      const viajes: [string, number, number, number][] = [
        [C.trabajo.direccion, C.trabajo.lat, C.trabajo.lng, 7],
        [C.trabajo.direccion, C.trabajo.lat, C.trabajo.lng, 14],
        [C.recientes[0]![0], C.recientes[0]![1], C.recientes[0]![2], 3],
        [C.recientes[1]![0], C.recientes[1]![1], C.recientes[1]![2], 2],
      ];
      for (const [i, [dir, lat, lng, dias]] of viajes.entries()) {
        const op = `op-tienda-${id}-${i}`;
        const en = new Date(ahora.getTime() - dias * 86_400_000)
          .toISOString()
          .replace('T', ' ')
          .slice(0, 19);
        sql(
          `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general, creado_en) VALUES ('${op}', '${C.viaje}', 'viaje_pasajero', '${cli.usuario.id}', '${z.id}', 'terminada', '${en}')`,
        );
        sql(`INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, pin_recogida)
           VALUES ('${op}', 'terminado', 'sistema', 'alta:${op}', ${z.lat}, ${z.lng}, '${z.nombre}', ${lat}, ${lng}, '${dir.replace(/'/g, "''")}', '4321')`);
      }
      sql(`INSERT INTO config (clave, valor, actualizado_en) VALUES ('populares:${z.id}', '${JSON.stringify({ origen: 'ciudad', lugares: C.populares }).replace(/'/g, "''")}', datetime('now'))
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en`);

      // El teléfono: iPhone de 402 × 874 puntos a 3× (1206 × 2622), en la ciudad.
      const ctx = await browser.newContext({
        viewport: { width: 402, height: 874 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        baseURL: DATOS!.url,
        geolocation: { latitude: z.lat, longitude: z.lng },
        permissions: ['geolocation'],
      });
      await ctx.addInitScript(
        ([pase, idi]) => {
          localStorage.setItem('tumbite.idioma', idi);
          localStorage.setItem('tumbite.sesion', pase);
          // La portada de respaldo que toca al abrir: la moto en El Vigía; en Novi (sin moto), comida.
          localStorage.setItem('inicio-ultima-portada', '|1');
        },
        [cli.token, idioma] as const,
      );
      const p = await ctx.newPage();
      const foto = async (nombre: string) => {
        await p.waitForTimeout(1_200);
        await p.screenshot({ path: join(carpeta, nombre) });
      };

      await p.goto('/app/');
      for (const s of [...SERVICIOS, 'mas'])
        await expect(p.getByTestId(`servicio-${s}`)).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId(`portada-respaldo-${C.portada}`)).toBeVisible();
      await expect(p.getByTestId('inicio-promos')).toBeVisible({ timeout: 30_000 });
      for (const s of TODOS.filter((x) => !SERVICIOS.includes(x)))
        await expect(p.getByTestId(`servicio-${s}`)).toHaveCount(0);
      await foto('00-inicio-todos-los-servicios.png');

      await p.getByTestId(`servicio-${C.viaje}`).click();
      await expect(p.getByTestId('lugar-gimnasio').or(p.getByText(C.gimnasio.nombre))).toBeVisible({
        timeout: 30_000,
      });
      await foto('00f-lugares-guardados.png');

      await p.getByTestId('moto-destino').click();
      await expect(p.getByText(idioma === 'es' ? 'Recientes' : 'Recent')).toBeVisible({
        timeout: 30_000,
      });
      await expect(p.getByText(C.populares[0]!.titulo)).toBeVisible({ timeout: 30_000 });
      await p.getByTestId('destino-casilla').blur();
      await foto('00c-a-donde-vas.png');
      await p
        .getByRole('button', { name: idioma === 'es' ? 'Volver' : 'Back', exact: true })
        .last()
        .click();

      await p.getByTestId('lugar-casa').click();
      await expect(p.getByTestId('moto-precio')).toBeVisible({ timeout: 30_000 });
      await foto('00b-moto-con-destino-y-precio.png');

      await p.getByTestId('pedir-boton').click();
      await expect(p.getByTestId('viaje-estado-buscando')).toBeVisible({ timeout: 30_000 });
      await foto('00d-buscando-tu-moto.png');

      // El conductor acepta (en la base local): el seguimiento con su moto, su placa y el mapa.
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
      await foto('00e-seguimiento-del-viaje.png');
      await ctx.close();
    } finally {
      for (const r of requisitos)
        sql(
          `INSERT OR IGNORE INTO servicio_requisitos (servicio_id, requisito, obligatorio) VALUES ('${String(r.servicio_id)}', '${String(r.requisito)}', ${Number(r.obligatorio)})`,
        );
    }
  });

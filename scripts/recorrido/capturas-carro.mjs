// Capturas REALES de Divoox Carro (taxi) para Docs (C-DOCS-CARRO, 14 nov 2026). Venezuela (El Vigía,
// estado Mérida, zona VE-MER-ELVIGIA): efectivo y pago móvil. Contra el servidor local del recorrido
// (.recorrido, armado con scripts/recorrido/preparar.mjs y encendido en el puerto 8790), con las apps
// web reales del pasajero y del Driver y el panel del equipo:
//   1. corre probar-moto-venezuela.mjs (conductor de prueba aprobado con saldo en El Vigía);
//   2. abre Carro en El Vigía con el paso del panel (tarifa de mercado, no «de prueba»);
//   3. el conductor registra su carro y sus papeles desde la app; el equipo lo revisa y lo aprueba;
//   4. viaje en Carro (pago móvil) y en Carro XL (efectivo), propina, «Mis viajes» con su recibo y
//      «Olvidé algo en el vehículo»;
//   5. C-CARRO-CATEGORIAS, C-VIAJE-PARADAS y C-CARRO-DINAMICA (14 nov 2026): la lista de categorías con
//      precio, un viaje Comfort con una parada y tarifa dinámica (fijada a mano en este servidor local),
//      el cambio de paradas con el viaje en marcha y los pasos de la parada en el Driver. Este servidor
//      local no tiene la llave de direcciones: la sugerencia de la parada nueva se responde aquí con un
//      lugar fijo de El Vigía (la pantalla y el precio son los reales).
// Datos neutros («Pasajero de prueba», «Conductor de prueba»). Guarda las originales en
// docs/capturas/recorrido/carro-*.png (y las del panel interno en docs/capturas/ciudad-*.png para la
// guía interna COMO-ABRIR-UNA-CIUDAD). Uso: node scripts/recorrido/capturas-carro.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deslizar } from './deslizar.mjs';
import { abrirAlta } from './altaDriver.mjs';
import { ciudadNeutra, mapaSinRotulos } from './neutro.mjs';
import { chromium, devices } from '@playwright/test';

const RAIZ = join(import.meta.dirname, '..', '..');
const DATOS = JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'));
const URL = DATOS.url;
const SECRETO = DATOS.relojSecreto;
const SALIDA = join(RAIZ, 'docs', 'capturas', 'recorrido');
const INTERNAS = join(RAIZ, 'docs', 'capturas');
// C-CAPTURAS-POR-IDIOMA (15 nov 2026): cada idioma con SUS ejemplos. Español: El Vigía (Venezuela),
// en dólares con su equivalente en bolívares, efectivo y pago móvil. Inglés: Novi, Michigan (Estados
// Unidos), en dólares, efectivo o tarjeta, sin nada de Venezuela.
const LUGARES = {
  ve: {
    pais: 'VE',
    pagoMovil: true,
    ciudad: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      lat: 8.6219,
      lng: -71.6506,
      radioKm: 15,
      zonaHoraria: 'America/Caracas',
    },
    origen: { lat: 8.6219, lng: -71.6506, direccion: 'Plaza Central' },
    destino: { lat: 8.6105, lng: -71.6672, direccion: 'Avenida Principal 12' },
    parada: { lat: 8.6195, lng: -71.6585, direccion: 'Calle Principal 123' },
    parada2: { lat: 8.6262, lng: -71.6612, direccion: 'Avenida Central 456' },
    carro: { color: 'Gris' },
  },
  us: {
    pais: 'US',
    pagoMovil: false,
    ciudad: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      lat: 42.4806,
      lng: -83.4755,
      radioKm: 15,
      zonaHoraria: 'America/Detroit',
    },
    origen: { lat: 42.4915, lng: -83.4706, direccion: 'Central Plaza' },
    destino: { lat: 42.4712, lng: -83.4745, direccion: '12 Main Avenue' },
    parada: { lat: 42.481, lng: -83.4735, direccion: '123 Main Street' },
    parada2: { lat: 42.4722, lng: -83.478, direccion: '456 Central Avenue' },
    carro: { color: 'Gray', placaEstado: 'MI' },
    // Tarifa de este servidor local para las fotos (centavos de dólar).
    tarifa: {
      base: 250,
      porKm: 110,
      porMinuto: 30,
      minimo: 800,
      esperaGratisS: 300,
      porMinutoEspera: 30,
      cancelacionGratisS: 120,
      cargoCancelacion: 300,
      cargoNoSePresento: 400,
      xlPb: 15_000,
      comfortPb: 12_500,
      premiumPb: 18_000,
      topeDinamicoPb: 15_000,
    },
  },
};
const FOTO = readFileSync(join(RAIZ, 'e2e', 'recorrido', 'fotos', 'bolsa-entrega.jpg'));

let ip = 0;
async function pedir(metodo, ruta, cuerpo, token, extra = {}, intento = 1) {
  const r = await fetch(`${URL}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': `10.78.${Math.floor(++ip / 250) % 250}.${ip % 250}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 429 && intento < 4) {
    await new Promise((x) => setTimeout(x, 15_000));
    return pedir(metodo, ruta, cuerpo, token, extra, intento + 1);
  }
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${d.error ?? ''}`);
  return d;
}
const intentar = (p) => p.catch((x) => ({ error: String(x) }));
const sql = (q) =>
  pedir('POST', '/datos/interno/diagnostico/sql', { sql: q }, undefined, {
    'x-reloj-secreto': SECRETO,
  });
const subir = async (ruta, token) => {
  const r = await fetch(`${URL}${ruta}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
    body: FOTO,
  });
  if (!r.ok) throw new Error(`subir ${ruta}: ${r.status} ${await r.text()}`);
  return r.json();
};

const interno = (ruta, cuerpo = {}) =>
  pedir('POST', `/datos/interno/diagnostico/${ruta}`, cuerpo, undefined, {
    'x-reloj-secreto': SECRETO,
  });

/** Las cuentas de prueba de Venezuela (conductor aprobado con saldo en El Vigía). */
async function cuentasVe() {
  execFileSync('node', ['scripts/staging/probar-moto-venezuela.mjs'], {
    cwd: RAIZ,
    env: { ...process.env, URL_PRUEBAS: URL, RELOJ_SECRETO: SECRETO, CIUDAD_VE: 'el-vigia' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const a = await interno('moto-ve/armar');
  return { tokens: a.tokens, ids: a.ids, clave: a.clave };
}

/** Las cuentas de prueba de Estados Unidos (las del guion de Carro), con nombres en inglés. */
async function cuentasUs() {
  const a = await interno('carro/armar');
  await sql(`UPDATE usuarios SET nombre = 'Sam C.' WHERE id = '${a.ids.conductorUs}'`);
  await sql(`UPDATE usuarios SET nombre = 'Jamie L.' WHERE id = '${a.ids.cliente}'`);
  return {
    tokens: { equipo: a.tokens.equipo, conductor: a.tokens.conductorUs, cliente: a.tokens.cliente },
    ids: { conductor: a.ids.conductorUs, cliente: a.ids.cliente },
    clave: a.clave,
    versionTerminos: a.versionTerminos,
  };
}

// C-DOCS-SIN-DATOS-REALES: el mapa sin rótulos y la ciudad con nombre de ejemplo.
const navegador = mapaSinRotulos(await chromium.launch());
let n = 0;
let restaurarCiudad = async () => {};

/** Todas las capturas de Carro de un país, en los idiomas que le tocan. */
async function correr(M, idiomas) {
  const {
    tokens,
    ids: IDS,
    clave,
    versionTerminos,
  } = await (M.pais === 'VE' ? cuentasVe() : cuentasUs());
  const CIUDAD = M.ciudad;
  const ORIGEN = M.origen;
  const DESTINO = M.destino;
  const PARADA = M.parada;
  const PARADA_2 = M.parada2;
  for (const t of Object.values(tokens))
    await sql(
      `UPDATE sesiones SET expira_en = datetime('now', '+90 minutes') WHERE id = '${createHash('sha256').update(t).digest('hex')}'`,
    );
  const equipo = (m, r, c) => pedir(m, r, c, tokens.equipo);
  const conductor = (m, r, c) => pedir(m, r, c, tokens.conductor);
  const pasajero = (m, r, c) => pedir(m, r, c, tokens.cliente);
  const paso = (op, nombre, cuerpo = {}) =>
    pedir('POST', `/datos/conductor/operaciones/${op}/${nombre}`, cuerpo, tokens.conductor, {
      'idempotency-key': `capturas-carro-${nombre}-${++n}-${Date.now().toString(36)}`,
    });
  const cerrarColgado = async () => {
    const v = (await pasajero('GET', '/datos/viajes/actual')).viaje;
    if (!v) return;
    if (v.estado === 'en_curso') await paso(v.id, 'terminar');
    else
      await pedir('POST', `/datos/viajes/${v.id}/cancelar`, {}, tokens.cliente, {
        'idempotency-key': `capturas-carro-cancelar-${Date.now().toString(36)}`,
      });
  };
  await cerrarColgado();

  // ───────── 1. Carro en la ciudad, con el paso del panel (compuerta del país solo en este servidor local)
  const abrir = () =>
    equipo('POST', '/datos/admin/viajes/ciudades', {
      servicio: 'carro',
      zona: CIUDAD,
      ...(M.tarifa ? { tarifa: M.tarifa } : {}),
      motivo: 'Ciudad de las capturas de Carro (servidor local)',
    });
  if (M.pais === 'US') {
    // En Estados Unidos el paso del panel no abre el país (lo abre la orden legal): en este servidor
    // local la ciudad se arma directo, como hace el guion de Carro con Detroit.
    await sql(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('${CIUDAD.id}', '${CIUDAD.nombre}', 'US', 'USD', '${CIUDAD.zonaHoraria}', ${CIUDAD.lat}, ${CIUDAD.lng}, ${CIUDAD.radioKm}, 1)`,
    );
    await sql("UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'");
    await sql(
      `INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('carro', '${CIUDAD.id}', 'disponible')
     ON CONFLICT DO UPDATE SET estado = 'disponible'`,
    );
    await equipo('POST', '/datos/admin/viajes/tarifas', {
      servicio: 'carro',
      zona: CIUDAD.id,
      tarifa: M.tarifa,
      dePrueba: false,
      motivo: 'Tarifa de las capturas de Carro (servidor local)',
    });
  } else if ((await intentar(abrir())).error) {
    await equipo('PUT', `/datos/admin/pasajeros-pais/${M.pais}/carro`, {
      clave,
      abierto: true,
      solicitudMarca: 'LOCAL-0000',
      confirmo: true,
    });
    await abrir();
  }
  await sql(`UPDATE tarifas_viaje SET de_prueba = 0 WHERE zona_id = '${CIUDAD.id}' AND activa = 1`);
  // C-CARRO-DINAMICA: en este servidor local la ciudad admite tarifa dinámica hasta 1,5 (para sus capturas).
  await sql(
    `UPDATE tarifas_viaje SET tope_dinamico_pb = 15000 WHERE zona_id = '${CIUDAD.id}' AND servicio_id = 'carro' AND activa = 1`,
  );
  if (M.pais === 'VE')
    await pedir('PUT', '/datos/admin/tasas-referencia/VE', { tasa: 240 }, tokens.equipo);
  // En Estados Unidos el conductor de prueba queda en la ciudad (su ficha y su zona) antes del alta.
  if (M.pais === 'US') {
    await interno('carro/conductor', { quien: 'us', zonaId: CIUDAD.id, ...ORIGEN });
    await conductor('POST', '/datos/repartidor/terminos', { version: versionTerminos });
  }
  await cerrarColgado();

  // Un carro anterior de estas cuentas fijas se retira para que el alta empiece de cero.
  await sql(
    `UPDATE vehiculos SET estado = 'retirado' WHERE conductor_id = '${IDS.conductor}' AND tipo = 'carro'`,
  );
  await sql(
    `DELETE FROM habilitaciones WHERE conductor_id = '${IDS.conductor}' AND servicio_id = 'carro'`,
  );

  // C-DOCS-SIN-DATOS-REALES: mientras se toman las fotos la ciudad lleva un nombre de ejemplo.
  restaurarCiudad = await ciudadNeutra(sql, CIUDAD.id, idiomas[0]);

  const telefono = async (token, id, idioma) => {
    const ctx = await navegador.newContext({
      ...devices['Pixel 7'],
      baseURL: URL,
      locale: idioma === 'en' ? 'en-US' : 'es-VE',
      ...(M.pais === 'US' ? { timezoneId: 'America/Detroit' } : {}),
      geolocation: { latitude: ORIGEN.lat, longitude: ORIGEN.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [token, id, idioma],
    );
    return ctx;
  };
  const foto = (p, nombre, idioma) =>
    p.screenshot({ path: join(SALIDA, `carro-${nombre}-v2-${idioma}.png`) });
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const arribaDe = (l) => l.evaluate((x) => x.scrollIntoView({ block: 'start' }));
  // El estado va al final del alta: se deja abajo de la pantalla para que se vea el carro encima.
  const abajoDe = (l) =>
    l.evaluate((x) => {
      x.scrollIntoView({ block: 'end' });
      globalThis.scrollBy(0, 40);
    });

  /** Abre «Divoox Carro» en el perfil del Driver y saca la foto de lo que pida `que`. */
  async function altaCarro(idioma, nombre, que) {
    const en = idioma === 'en';
    const ctx = await telefono(tokens.conductor, IDS.conductor, idioma);
    const d = await ctx.newPage();
    await d.goto('/driver/');
    await abrirAlta(d, 'carro', en);
    await espera(1_200);
    await que(d, en);
    await espera(600);
    await foto(d, nombre, idioma);
    await ctx.close();
  }

  // ───────── 2. Driver: el alta antes de registrar el carro
  for (const idioma of idiomas)
    await altaCarro(idioma, 'driver-alta', (d) => arribaDe(d.getByTestId('alta-carro')));

  const carro = (
    await conductor('POST', '/datos/conductor/vehiculos', {
      tipo: 'carro',
      marca: 'Toyota',
      modelo: 'Corolla',
      anio: 2019,
      ...M.carro,
      placa: `AB${Math.floor(Math.random() * 9e4 + 1e4)}`,
      plazas: 4,
    })
  ).id;
  for (const t of [
    'registro',
    'seguro',
    'seguro_pasajeros',
    'inspeccion',
    'foto_frente',
    'foto_lado',
    'foto_placa',
    'foto_interior',
  ])
    await intentar(
      subir(`/datos/conductor/vehiculos/${carro}/documentos?tipo=${t}`, tokens.conductor),
    );
  await conductor('POST', `/datos/conductor/vehiculos/${carro}/enviar`);
  // La licencia de conducir de carro (la de moto no sirve para Carro). En Estados Unidos los
  // antecedentes y la licencia van por el proveedor: no hay papeles del conductor que subir.
  const licencia =
    M.pais === 'VE'
      ? await intentar(
          subir(
            '/datos/conductor/papeles?tipo=licencia_conducir&vence=2030-01-01',
            tokens.conductor,
          ),
        )
      : null;

  // ───────── 3. Driver: el carro en revisión, y el panel del equipo con la cola por revisar
  for (const idioma of idiomas)
    await altaCarro(idioma, 'driver-revision', (d) => abajoDe(d.getByTestId('estado-carro')));

  const ruta = (await equipo('GET', '/datos/admin/ruta')).ruta;
  // Las capturas del panel son para la guía interna de abrir una ciudad: solo en la pasada de Venezuela.
  for (const idioma of M.pais === 'VE' ? idiomas : []) {
    const en = idioma === 'en';
    const ctxP = await navegador.newContext({
      viewport: { width: 1440, height: 900 },
      baseURL: URL,
      locale: en ? 'en-US' : 'es-US',
    });
    await ctxP.addCookies([
      { name: 'tumbite_sesion', value: tokens.equipo, url: URL, httpOnly: true },
    ]);
    await ctxP.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), idioma);
    const p = await ctxP.newPage();
    await p.goto(`${en ? '' : '/es'}/panel/${ruta}/moto`);
    await p.getByTestId('super-moto').waitFor({ timeout: 60_000 });
    await espera(1_500);
    // Se fotografía cada tarjeta entera, sin depender del desplazamiento del panel.
    await p
      .locator('.tarjeta-form')
      .filter({
        has: p.getByText(
          en ? 'Open a ride service in a city' : 'Abrir un servicio de viajes en una ciudad',
          { exact: true },
        ),
      })
      .first()
      .screenshot({ path: join(INTERNAS, `ciudad-abrir-servicio-${idioma}.png`) });
    await p.getByTestId(`moto-${carro}`).waitFor({ timeout: 30_000 });
    await p
      .getByTestId(`moto-${carro}`)
      .screenshot({ path: join(INTERNAS, `ciudad-vehiculos-por-revisar-${idioma}.png`) });
    await ctxP.close();
  }

  // El equipo aprueba los papeles del carro, el carro y la habilitación (como en el panel).
  const veh = (await equipo('GET', '/datos/admin/vehiculos?estado=en_revision')).vehiculos.find(
    (x) => x.id === carro,
  );
  for (const d of veh?.documentos ?? [])
    await equipo('PUT', `/datos/admin/vehiculos/${carro}/documentos/${d.id}`, {
      estado: 'aprobado',
      venceEn: '2030-01-01',
    });
  await equipo('PUT', `/datos/admin/vehiculos/${carro}`, { estado: 'aprobado' });
  if (licencia?.id)
    await intentar(
      equipo('PUT', `/datos/admin/papeles-conductor/${licencia.id}`, { estado: 'aprobado' }),
    );
  // El vehículo se cambia desconectado (revisor, 18 nov 2026).
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false });
  await conductor('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: carro });
  const faltan = (await conductor('GET', '/datos/conductor/servicios')).servicios.find(
    (s) => s.servicioId === 'carro',
  );
  for (const req of faltan?.requisitosFaltantes ?? [])
    await intentar(
      equipo('PUT', `/datos/admin/cumplimientos/${IDS.conductor}/${req}`, {
        estado: 'aprobado',
        vehiculoId: carro,
      }),
    );
  await equipo('PUT', `/datos/admin/habilitaciones/${IDS.conductor}/carro`, { estado: 'aprobada' });
  await conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'carro', activa: true });
  await intentar(
    conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: false }),
  );

  // ───────── 4. Driver: aprobado, con el interruptor para recibir viajes de Carro
  for (const idioma of idiomas)
    await altaCarro(idioma, 'driver-aprobado', (d) => abajoDe(d.getByTestId('estado-carro')));
  // C-CARRO-CATEGORIAS: el carro quedó Comfort (cumple la antigüedad de su país) y su interruptor.
  for (const idioma of idiomas)
    await altaCarro(idioma, 'driver-categoria', async (d) => {
      await d.getByTestId('carro-menores').waitFor({ timeout: 30_000 });
      await d.getByTestId('carro-categoria').evaluate((x) => x.scrollIntoView({ block: 'center' }));
    });

  for (const idioma of idiomas) {
    const en = idioma === 'en';
    await cerrarColgado();
    // Cada idioma empieza a precio normal (la tarifa dinámica se fija más abajo, para sus fotos).
    await pedir(
      'PUT',
      `/datos/admin/viajes/dinamica/carro/${CIUDAD.id}`,
      { modo: 'auto', motivo: 'Capturas: precio normal' },
      tokens.equipo,
    );
    // La foto de control de identidad no es parte de estas capturas: queda como recién tomada.
    await sql(
      `DELETE FROM selfies_control WHERE usuario_id = '${IDS.conductor}' AND tomada_en IS NULL`,
    );
    await sql(
      `INSERT OR IGNORE INTO selfies_control (id, usuario_id, tomada_en, resultado)
     VALUES ('capturas-carro-${M.pais}', '${IDS.conductor}', datetime('now'), 'ok')`,
    );
    await conductor('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN });
    await conductor('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN.lat, lng: ORIGEN.lng });

    // ───────── Pasajero: Carro y Carro XL, precio fijo y forma de pago
    const ctxC = await telefono(tokens.cliente, IDS.cliente, idioma);
    await ctxC.addInitScript(
      ([u, b]) => localStorage.setItem(`tumbite.borrador.carro.${u}`, b),
      [
        IDS.cliente,
        JSON.stringify({
          recogida: ORIGEN.direccion,
          recogidaLat: String(ORIGEN.lat),
          recogidaLng: String(ORIGEN.lng),
          destino: DESTINO.direccion,
          destinoLat: String(DESTINO.lat),
          destinoLng: String(DESTINO.lng),
        }),
      ],
    );
    const c = await ctxC.newPage();
    await c.goto('/app/ride?servicio=carro');
    // C-INICIO-NUEVO (borrador aprobado): ya no hay «Ver precio»; el precio sale solo con el destino.
    await c.getByTestId('moto-precio').waitFor({ timeout: 30_000 });
    // La forma de pago de cada país: pago móvil en Venezuela, tarjeta en Estados Unidos.
    await c
      .getByText(M.pagoMovil ? (en ? 'Mobile payment' : 'Pago móvil') : en ? 'Card' : 'Tarjeta', {
        exact: true,
      })
      .first()
      .click();
    await c.getByTestId('moto-precio').scrollIntoViewIfNeeded();
    await espera(800);
    await foto(c, 'pasajero-precio', idioma);
    // C-CARRO-CATEGORIAS: la lista «Elige tu carro» con el precio de cada categoría.
    const verCategorias = async () => {
      await arribaDe(c.getByTestId('carro-categorias'));
      await c.evaluate(() => globalThis.scrollBy(0, -90));
      await espera(800);
    };
    await verCategorias();
    await foto(c, 'pasajero-categorias', idioma);
    await c.getByTestId('carro-categoria-comfort').click();
    await c
      .getByRole('button', { name: en ? 'Request Car Comfort' : 'Pedir Carro Comfort' })
      .waitFor({ timeout: 30_000 });
    await verCategorias();
    await foto(c, 'pasajero-comfort', idioma);
    await c.getByTestId('carro-categoria-xl').click();
    await c
      .getByRole('button', { name: en ? 'Request Car XL' : 'Pedir Carro XL' })
      .waitFor({ timeout: 30_000 });
    await verCategorias();
    await foto(c, 'pasajero-xl', idioma);
    // Vuelve a Carro normal y pide con pago móvil.
    await c.getByTestId('carro-categoria-estandar').click();
    await c
      .getByRole('button', { name: en ? 'Request Car' : 'Pedir Carro', exact: true })
      .waitFor({ timeout: 30_000 });
    const cot = (
      await pasajero('POST', '/datos/viajes/cotizar', {
        servicio: 'carro',
        origen: ORIGEN,
        destino: DESTINO,
      })
    ).cotizacion;
    const viaje = (
      await pasajero('POST', '/datos/viajes', {
        cotizacionId: cot.id,
        metodoPago: M.pagoMovil ? 'pago_movil' : 'efectivo',
      })
    ).viaje;

    // ───────── Driver: la oferta de Carro
    const ctxD = await telefono(tokens.conductor, IDS.conductor, idioma);
    const d = await ctxD.newPage();
    await d.goto('/driver/');
    await d.getByTestId('oferta-viaje').waitFor({ timeout: 60_000 });
    await espera(800);
    await foto(d, 'driver-oferta', idioma);
    await paso(viaje.id, 'aceptar');

    // ───────── Pasajero: conductor asignado con foto, carro, placa, llegada y código
    await c.reload();
    await c.getByTestId('viaje-conductor').waitFor({ timeout: 60_000 });
    // El mapa termina de cargar sus cuadros antes de la foto.
    await espera(4_000);
    await foto(c, 'pasajero-conductor', idioma);
    await arribaDe(c.getByTestId('viaje-codigo'));
    await c.evaluate(() => globalThis.scrollBy(0, -200));
    await espera(600);
    await foto(c, 'pasajero-codigo', idioma);

    await paso(viaje.id, 'llegue');
    const pin = (await pasajero('GET', `/datos/viajes/${viaje.id}`)).viaje.pin;
    // ───────── Driver: el código del pasajero para empezar
    await d.reload();
    await d.getByTestId('viaje-pin').waitFor({ timeout: 60_000 });
    await d.getByTestId('viaje-pin').fill(pin);
    await espera(600);
    await foto(d, 'driver-codigo', idioma);
    await paso(viaje.id, 'iniciar', { pin });
    await d.reload();
    if (M.pagoMovil) {
      await d.getByTestId('viaje-pago-movil').waitFor({ timeout: 60_000 });
      await d.getByTestId('viaje-pago-movil').scrollIntoViewIfNeeded();
    } else await d.getByTestId('viaje-terminar').waitFor({ timeout: 60_000 });
    await espera(800);
    await foto(d, 'driver-viaje', idioma);
    if (M.pagoMovil)
      await d.getByText(en ? 'Yes, it arrived' : 'Sí, me llegó', { exact: true }).click();
    await deslizar(d, 'viaje-terminar');
    await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
    await espera(800);
    await foto(d, 'driver-cobro', idioma);

    // ───────── Pasajero: llegó, califica y deja propina (la pantalla abierta se pone al día sola)
    await c.getByTestId('viaje-calificar').waitFor({ timeout: 60_000 });
    await c.getByTestId('estrella-5').click();
    await espera(600);
    await arribaDe(c.getByTestId('viaje-calificar'));
    await c.evaluate(() => globalThis.scrollBy(0, -160));
    await espera(600);
    await foto(c, 'pasajero-propina', idioma);
    await ctxC.close();

    // ───────── Pasajero: «Mis viajes», el recibo y «Olvidé algo en el vehículo»
    const ctxH = await telefono(tokens.cliente, IDS.cliente, idioma);
    const h = await ctxH.newPage();
    await h.goto('/app/ride?servicio=carro');
    await h.getByTestId('mis-viajes').waitFor({ timeout: 60_000 });
    await arribaDe(h.getByTestId('mis-viajes'));
    await espera(800);
    await foto(h, 'pasajero-mis-viajes', idioma);
    // C-MISMA-RUTA: el recibo y la ayuda van en los tres puntos de cada viaje.
    await h.locator('[data-testid^="viaje-opciones-"]').first().click();
    await h.getByTestId('viaje-opcion-recibo').click();
    await h.getByTestId('recibo-viaje').waitFor({ timeout: 30_000 });
    await arribaDe(h.getByTestId('recibo-viaje'));
    await espera(800);
    await foto(h, 'pasajero-recibo', idioma);
    await h
      .getByText(en ? 'I left something in the vehicle' : 'Olvidé algo en el vehículo', {
        exact: true,
      })
      .click();
    await espera(400);
    await h
      .getByText(en ? 'Help with this ride' : 'Ayuda con este viaje', { exact: true })
      .evaluate((x) => x.scrollIntoView({ block: 'start' }));
    await espera(600);
    await foto(h, 'pasajero-olvide', idioma);
    await ctxH.close();

    // ───────── Driver: viaje en efectivo (Carro XL no: el carro es de 4 plazas) y su cobro
    const cot2 = (
      await pasajero('POST', '/datos/viajes/cotizar', {
        servicio: 'carro',
        origen: ORIGEN,
        destino: DESTINO,
      })
    ).cotizacion;
    const v2 = (
      await pasajero('POST', '/datos/viajes', { cotizacionId: cot2.id, metodoPago: 'efectivo' })
    ).viaje;
    await paso(v2.id, 'aceptar');
    await paso(v2.id, 'llegue');
    await paso(v2.id, 'iniciar', {
      pin: (await pasajero('GET', `/datos/viajes/${v2.id}`)).viaje.pin,
    });
    await d.reload();
    await deslizar(d, 'viaje-terminar');
    await d.getByTestId('viaje-cobra-efectivo').waitFor({ timeout: 30_000 });
    await espera(800);
    await foto(d, 'driver-cobro-efectivo', idioma);

    // ───────── C-VIAJE-PARADAS: el pasajero agrega una parada antes de ver el precio
    await pedir(
      'PUT',
      `/datos/admin/viajes/dinamica/carro/${CIUDAD.id}`,
      {
        modo: 'auto',
        motivo: 'Capturas: precio normal',
      },
      tokens.equipo,
    );
    const borradorConParada = JSON.stringify({
      recogida: ORIGEN.direccion,
      recogidaLat: String(ORIGEN.lat),
      recogidaLng: String(ORIGEN.lng),
      destino: DESTINO.direccion,
      destinoLat: String(DESTINO.lat),
      destinoLng: String(DESTINO.lng),
      categoria: 'comfort',
      paradas: JSON.stringify([PARADA]),
    });
    const ctxP = await telefono(tokens.cliente, IDS.cliente, idioma);
    await ctxP.addInitScript(
      ([u, b]) => localStorage.setItem(`tumbite.borrador.carro.${u}`, b),
      [IDS.cliente, borradorConParada],
    );
    const q = await ctxP.newPage();
    // La sugerencia de la parada nueva (este servidor local no tiene la llave de direcciones).
    await q.route('**/datos/lugares/sugerencias*', (r) =>
      r.fulfill({ json: { sugerencias: [{ id: 'parada-2', texto: PARADA_2.direccion }] } }),
    );
    await q.route('**/datos/lugares/punto/*', (r) =>
      r.fulfill({
        json: { punto: { lat: PARADA_2.lat, lng: PARADA_2.lng }, direccion: PARADA_2.direccion },
      }),
    );
    await q.goto('/app/ride?servicio=carro');
    await q.getByTestId('parada-editor').waitFor({ timeout: 60_000 });
    await arribaDe(q.getByTestId('moto-recogida'));
    await q.evaluate(() => globalThis.scrollBy(0, -110));
    await espera(1_000);
    await foto(q, 'pasajero-paradas', idioma);
    // C-INICIO-NUEVO (borrador aprobado): ya no hay «Ver precio»; el precio sale solo con el destino.
    await q.getByTestId('moto-precio').waitFor({ timeout: 30_000 });
    await arribaDe(q.getByTestId('moto-precio'));
    await q.evaluate(() => globalThis.scrollBy(0, -140));
    await espera(800);
    await foto(q, 'pasajero-paradas-precio', idioma);

    // ───────── C-CARRO-DINAMICA: con la tarifa dinámica en 1,5, el aviso sale antes de pedir
    await pedir(
      'PUT',
      `/datos/admin/viajes/dinamica/carro/${CIUDAD.id}`,
      {
        modo: 'manual',
        multiplicadorPb: 15_000,
        minutos: 60,
        motivo: 'Capturas: mucha demanda',
      },
      tokens.equipo,
    );
    await q.reload();
    // C-INICIO-NUEVO (borrador aprobado): ya no hay «Ver precio»; el precio sale solo con el destino.
    await q.getByTestId('moto-dinamica').waitFor({ timeout: 30_000 });
    await arribaDe(q.getByTestId('moto-precio'));
    await q.evaluate(() => globalThis.scrollBy(0, -140));
    await espera(800);
    await foto(q, 'pasajero-dinamica', idioma);

    // El conductor sigue conectado en la recogida (su última posición ya tenía unos minutos).
    await sql(
      `UPDATE repartidores SET conectado = 1, lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${IDS.conductor}'`,
    );
    // Y con saldo para la comisión (C-SALDO-OFERTAS: sin saldo no le llega la oferta). Los viajes
    // anteriores de este guion ya gastaron el de la cuenta de prueba.
    if (M.pais === 'VE')
      await sql(
        `INSERT OR IGNORE INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia)
     VALUES ('capturas-carro-saldo-${idioma}', '${IDS.conductor}', 'prepago', 'VE', 'USD', 2000, 'recarga', 'capturas-carro:saldo:${idioma}')`,
      );
    // Viaje Comfort con una parada y tarifa dinámica: la oferta del conductor lo dice todo.
    const cot3 = (
      await pasajero('POST', '/datos/viajes/cotizar', {
        servicio: 'carro',
        categoria: 'comfort',
        origen: ORIGEN,
        paradas: [PARADA],
        destino: DESTINO,
      })
    ).cotizacion;
    const v3 = (
      await pasajero('POST', '/datos/viajes', { cotizacionId: cot3.id, metodoPago: 'efectivo' })
    ).viaje;
    await d.goto('/driver/');
    await d.getByTestId('oferta-viaje').waitFor({ timeout: 60_000 });
    await espera(800);
    await foto(d, 'driver-oferta-paradas', idioma);
    await paso(v3.id, 'aceptar');
    await q.reload();
    await q.getByTestId('viaje-conductor').waitFor({ timeout: 60_000 });
    await espera(4_000);
    await arribaDe(q.getByTestId('viaje-conductor'));
    await q.evaluate(() => globalThis.scrollBy(0, -330));
    await espera(600);
    await foto(q, 'pasajero-conductor-comfort', idioma);
    await paso(v3.id, 'llegue');
    await paso(v3.id, 'iniciar', {
      pin: (await pasajero('GET', `/datos/viajes/${v3.id}`)).viaje.pin,
    });

    // ───────── Pasajero: las paradas del viaje y el cambio con el precio nuevo
    await q.reload();
    await q.getByTestId('viaje-paradas').waitFor({ timeout: 60_000 });
    await espera(4_000);
    await arribaDe(q.getByTestId('viaje-paradas'));
    await q.evaluate(() => globalThis.scrollBy(0, -330));
    await espera(600);
    await foto(q, 'pasajero-paradas-viaje', idioma);
    await q.getByTestId('viaje-paradas-cambiar').click();
    await q.getByTestId('viaje-parada-nueva-agregar').click();
    await q.getByTestId('viaje-parada-nueva-2').fill(M.pais === 'US' ? 'Library' : 'Farmacia');
    await q.getByTestId('sugerencia-direccion-0').click({ timeout: 30_000 });
    await q.getByRole('button', { name: en ? 'See new price' : 'Ver precio nuevo' }).click();
    await q.getByTestId('viaje-paradas-precio').waitFor({ timeout: 30_000 });
    await arribaDe(q.getByTestId('viaje-paradas'));
    await q.evaluate(() => globalThis.scrollBy(0, -70));
    await espera(800);
    await foto(q, 'pasajero-paradas-cambio', idioma);
    await ctxP.close();

    // ───────── Driver: la parada que sigue y la espera en la parada
    await d.reload();
    await d
      .getByText(en ? 'Slide when you reach the stop' : 'Desliza al llegar a la parada', {
        exact: true,
      })
      .waitFor({
        timeout: 60_000,
      });
    await espera(800);
    await foto(d, 'driver-parada', idioma);
    // El conductor llega a la parada (su posición se pone directo: el servidor no reescribe la ficha
    // por cada lectura de GPS seguida).
    await sql(
      `UPDATE repartidores SET lat = ${PARADA.lat}, lng = ${PARADA.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${IDS.conductor}'`,
    );
    await paso(v3.id, 'paradas/1/llegue');
    await d.reload();
    await d.getByTestId('viaje-parada-espera').waitFor({ timeout: 60_000 });
    await espera(800);
    await foto(d, 'driver-parada-espera', idioma);
    await paso(v3.id, 'paradas/1/seguir');
    await paso(v3.id, 'terminar');
    await sql(
      `UPDATE repartidores SET lat = ${ORIGEN.lat}, lng = ${ORIGEN.lng}, ubicacion_en = datetime('now') WHERE usuario_id = '${IDS.conductor}'`,
    );
    await ctxD.close();
  }
  // La tarifa dinámica vuelve a precio normal.
  await pedir(
    'PUT',
    `/datos/admin/viajes/dinamica/carro/${CIUDAD.id}`,
    {
      modo: 'auto',
      motivo: 'Capturas: fin',
    },
    tokens.equipo,
  );
  // Vuelve a dejarlo con su moto para el guion de Moto.
  await intentar(
    conductor('PUT', '/datos/conductor/preferencias', { servicioId: 'carro', activa: false }),
  );
  await conductor('POST', '/datos/repartidor/conectar', { conectado: false });
}

// Español en El Vigía; inglés en Novi, Michigan (C-CAPTURAS-POR-IDIOMA).
const SOLO = process.env.SOLO_IDIOMA;
// Los servicios de pasajeros de Estados Unidos vuelven a quedar apagados en este servidor local: el
// país no está abierto y, encendidos, el canario de servicios se pone en rojo y frena la pasada de
// Venezuela (su guion de punta a punta exige la salud en verde).
const apagarPasajerosUs = async () => {
  await sql(
    "UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id IN ('moto', 'carro') AND zona_id IN (SELECT id FROM zonas WHERE pais = 'US')",
  ).catch(() => null);
  // Y el servicio que no quedó encendido en ninguna ciudad vuelve a «próximamente».
  await sql(
    "UPDATE servicios SET estado = 'proximamente' WHERE id IN ('moto', 'carro') AND NOT EXISTS (SELECT 1 FROM servicios_zona z WHERE z.servicio_id = servicios.id AND z.estado = 'disponible')",
  ).catch(() => null);
};
try {
  if (SOLO !== 'en') await correr(LUGARES.ve, ['es']).finally(() => restaurarCiudad());
  if (SOLO !== 'es') await correr(LUGARES.us, ['en']).finally(() => restaurarCiudad());
} finally {
  await apagarPasajerosUs();
  await navegador.close();
}
console.log('capturas de Carro listas en docs/capturas/recorrido/carro-*.png');

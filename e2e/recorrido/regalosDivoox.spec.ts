import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices, expect, test } from './fixtures';
import { sqlLocal } from './sqlLocal';
import { SQL_TASA_EJEMPLO } from './tasaEjemplo';

/**
 * C-CUPON-DIVOOX (17 nov 2026): el regalo que paga Divoox en las apps web de verdad. El equipo crea el
 * cupón (nace apagado) y lo enciende; el pasajero agrega el código, ve el precio tachado y paga en
 * mano solo la diferencia; el conductor ve «Cobra X · Divoox te paga Y»; el superadmin ve el gasto en
 * vivo. En español con El Vigía y en inglés con Novi (C-CAPTURAS-POR-IDIOMA). Solo en esta computadora.
 * Con CAPTURAS=1 guarda las capturas de Docs (docs/capturas/regalos-divoox/).
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as {
      url: string;
      clave: string;
    });
test.skip(STAGING, 'solo en esta computadora');
const CAPTURAS = process.env.CAPTURAS === '1';
const CARPETA = join(RAIZ, 'docs', 'capturas', 'regalos-divoox');
if (CAPTURAS) mkdirSync(CARPETA, { recursive: true });
const sql = sqlLocal;

/** Capturas de la ficha de Google Play del Driver (CAPTURAS_TIENDA=1, fuera de git). */
const TIENDA = process.env.CAPTURAS_TIENDA === '1';
const tiendaDriver = (idioma: 'es' | 'en', nombre: string) => {
  const carpeta = join(
    process.env.CARPETA_TIENDAS ?? '/Users/windocellc/Divoox/capturas-tiendas',
    'Divoox Driver (repartidor)',
    'Google Play',
    idioma === 'es' ? 'Español' : 'English',
    'Celular',
  );
  mkdirSync(carpeta, { recursive: true });
  return join(carpeta, nombre);
};

const CIUDADES = {
  es: {
    zona: {
      id: 'VE-MER-ELVIGIA',
      nombre: 'El Vigía',
      pais: 'VE',
      lat: 8.6219,
      lng: -71.6506,
      tz: 'America/Caracas',
    },
    codigo: 'EJEMPLO',
    nombreEs: 'Regalo de bienvenida',
    nombreEn: 'Welcome gift',
    recogida: { lat: 8.6219, lng: -71.6506, direccion: 'Calle Principal 123' },
    destino: { lat: 8.6345, lng: -71.6611, direccion: 'Avenida Central 456' },
    pasajero: 'María Pasajera',
    conductor: 'José Conductor',
    telefono: '+584145550123',
    textos: {
      tienesCodigo: '¿Tienes un código de regalo?',
      agregar: 'Agregar',
      // C-INICIO-NUEVO (borrador aprobado): el precio sale solo y el botón dice «Solicitar moto».
      pedir: 'Solicitar moto',
    },
  },
  en: {
    zona: {
      id: 'US-MI-NOVI',
      nombre: 'Novi',
      pais: 'US',
      lat: 42.4806,
      lng: -83.4755,
      tz: 'America/Detroit',
    },
    codigo: 'SAMPLE',
    nombreEs: 'Regalo de bienvenida',
    nombreEn: 'Welcome gift',
    recogida: { lat: 42.4806, lng: -83.4755, direccion: '123 Main Street' },
    destino: { lat: 42.4935, lng: -83.4612, direccion: '456 Central Avenue' },
    pasajero: 'Emily Rider',
    conductor: 'Michael Driver',
    telefono: '+12485550123',
    textos: {
      tienesCodigo: 'Have a gift code?',
      agregar: 'Add',
      pedir: 'Request moto',
    },
  },
} as const;

for (const idioma of ['es', 'en'] as const) {
  test(`regalo de Divoox de punta a punta (${idioma})`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    const C = CIUDADES[idioma];
    const id = `${Date.now().toString(36)}${idioma}`;
    let ip = 0;
    const cuenta = async (rol: string, nombre: string) => {
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.97.${Math.floor(Math.random() * 250)}.${++ip}` },
        data: {
          nombre,
          correo: `regalo.${rol}.${id}@recorrido.test`,
          clave: DATOS!.clave,
          rol: rol === 'admin' ? 'cliente' : rol,
          ...(rol === 'cliente' ? { telefono: C.telefono } : {}),
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return (await r.json()) as { token: string; usuario: { id: string } };
    };
    const h = (t: string, extra: Record<string, string> = {}) => ({
      authorization: `Bearer ${t}`,
      ...extra,
    });

    // La ciudad, con Moto encendido y su tarifa.
    const admin = await cuenta('admin', idioma === 'es' ? 'Soporte Divoox' : 'Divoox Support');
    sql(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.usuario.id}'`);
    const z = C.zona;
    sql(`INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, idioma)
         VALUES ('${z.id}', '${z.nombre}', '${z.pais}', 'USD', '${z.tz}', ${z.lat}, ${z.lng}, 15, 1, '${idioma}')`);
    // C-PRECIO-PROTAGONISTA: en Venezuela, la tasa del día del equipo, como en el sitio real: el
    // conductor ve los bolívares debajo de lo que cobra (sin ella saldría «Hoy no hay tasa»).
    if (z.pais === 'VE') sql(SQL_TASA_EJEMPLO);
    // El sitio local no es el de pruebas: Moto se declara construido y se enciende en su base (como
    // en las pruebas del servidor). En el sitio de pruebas lo hace el equipo desde el panel.
    sql(`INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('moto', 1)`);
    sql(`UPDATE servicios SET estado = 'disponible' WHERE id = 'moto'`);
    sql(`INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto', '${z.id}', 'disponible')
         ON CONFLICT(servicio_id, zona_id) DO UPDATE SET estado = 'disponible'`);
    const tarifa = await request.post('/datos/admin/viajes/tarifas', {
      headers: h(admin.token),
      data: {
        servicio: 'moto',
        zona: z.id,
        tarifa: { base: 50, porKm: 22, porMinuto: 3, minimo: 100 },
        dePrueba: false,
        motivo: 'Tarifa del recorrido',
      },
    });
    expect(tarifa.ok(), await tarifa.text()).toBe(true);

    // El equipo crea el cupón: nace apagado; lo enciende después.
    const crear = await request.post('/datos/admin/regalos-divoox', {
      headers: h(admin.token),
      data: {
        codigo: C.codigo,
        nombreEs: C.nombreEs,
        nombreEn: C.nombreEn,
        tipo: 'monto',
        valor: 100,
        servicios: ['moto', 'envios', 'comida'],
        zonas: [z.id],
        presupuesto: 10_000,
        topeDiarioConductor: 6,
      },
    });
    expect(crear.ok(), await crear.text()).toBe(true);
    expect(((await crear.json()) as { cupon: { activo: boolean } }).cupon.activo).toBe(false);
    const encender = await request.patch(`/datos/admin/regalos-divoox/${C.codigo}`, {
      headers: h(admin.token),
      data: { activo: true },
    });
    expect(encender.ok(), await encender.text()).toBe(true);

    // Un conductor de moto conectado en la recogida, con saldo para la comisión.
    const cond = await cuenta('repartidor', C.conductor);
    const c = cond.usuario.id;
    const v = `veh-regalo-${id}`;
    sql(`UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${z.id}'`);
    // Aquí se prueba el regalo, no el alta del conductor: los requisitos de Moto se apartan y vuelven
    // al final (sin ellos la base no deja encender Moto en otra ciudad).
    const requisitos = sql(
      `SELECT servicio_id, requisito, obligatorio FROM servicio_requisitos WHERE servicio_id = 'moto'`,
    );
    sql(`DELETE FROM servicio_requisitos WHERE servicio_id = 'moto'`);
    // Pase lo que pase en la prueba, los requisitos de Moto vuelven (finally): si se quedaban
    // borrados, las pruebas siguientes no podían encender Moto en otra ciudad.
    try {
      sql(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES ('${c}', 1, ${C.recogida.lat}, ${C.recogida.lng}, datetime('now'), '${z.id}')
         ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en, zona_id = excluded.zona_id`);
      sql(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
         VALUES ('${v}', '${c}', 'moto', 'Motos Divoox', 'M150', '${idioma === 'es' ? 'Negro' : 'Black'}', 'R${id.slice(-6).toUpperCase()}', '', 2022, 1, 'aprobado')`);
      for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
        sql(
          `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('doc-${t}-${id}', '${v}', '${t}', 'doc', 'aprobado', datetime('now', '+1 year'))`,
        );
      sql(`UPDATE repartidores SET vehiculo_activo_id = '${v}' WHERE usuario_id = '${c}'`);
      sql(
        `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', 'moto', 'aprobada', '${admin.usuario.id}', datetime('now'))`,
      );
      sql(
        `INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', 'moto', 1)`,
      );
      sql(
        `INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('recarga-${id}', '${c}', 'prepago', '${z.pais}', 'USD', 2000, 'recarga_recorrido', 'recarga-${id}')`,
      );

      // El pasajero: el formulario de Pedir viaje ya escrito (recogida y destino), en su celular.
      const cli = await cuenta('cliente', C.pasajero);
      // Aquí se enseña el regalo: el pasajero ya confirmó su celular, para que la franja de
      // «Confirma tu celular» no tape la captura (su prueba y sus fotos van en verificarCelular).
      sql(
        `UPDATE usuarios SET telefono_verificado_en = datetime('now') WHERE id = '${cli.usuario.id}'`,
      );
      const ctx = await browser.newContext({
        ...devices['Pixel 7'],
        baseURL: DATOS!.url,
        geolocation: { latitude: C.recogida.lat, longitude: C.recogida.lng },
        permissions: ['geolocation'],
      });
      await ctx.addInitScript(
        ([pase, idi, cuentaId, borrador]) => {
          localStorage.setItem('tumbite.idioma', idi);
          localStorage.setItem('tumbite.sesion', pase);
          localStorage.setItem(`tumbite.borrador.moto.${cuentaId}`, borrador);
        },
        [
          cli.token,
          idioma,
          cli.usuario.id,
          JSON.stringify({
            recogida: C.recogida.direccion,
            recogidaLat: String(C.recogida.lat),
            recogidaLng: String(C.recogida.lng),
            destino: C.destino.direccion,
            destinoLat: String(C.destino.lat),
            destinoLng: String(C.destino.lng),
            metodo: 'efectivo',
          }),
        ] as const,
      );
      const p = await ctx.newPage();
      await p.goto('/app/ride');
      const precio = p.getByTestId('moto-precio');
      await expect(precio).toBeVisible({ timeout: 30_000 });
      // Sin regalo todavía: «¿Tienes un código de regalo?» lo agrega a su cuenta.
      await p.getByText(C.textos.tienesCodigo).click();
      await p.getByTestId('regalo-codigo').fill(C.codigo.toLowerCase());
      if (CAPTURAS)
        await precio.screenshot({ path: join(CARPETA, `cliente-codigo-${idioma}.png`) });
      await p.getByText(C.textos.agregar, { exact: true }).click();
      // El precio se vuelve a calcular con el regalo: el de siempre tachado y lo que paga en mano.
      await expect(p.getByTestId('regalo-divoox')).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId('regalo-paga-en-mano')).toBeVisible();
      if (CAPTURAS)
        await precio.screenshot({ path: join(CARPETA, `cliente-precio-${idioma}.png`) });
      await p.getByText(C.textos.pedir, { exact: true }).click();
      // El viaje en curso muestra lo que paga Divoox y lo que paga en mano.
      await expect(p.getByTestId('regalo-divoox')).toBeVisible({ timeout: 30_000 });
      const op = String(
        sql(
          `SELECT operacion_id FROM usos_cupon_divoox WHERE cliente_id = '${cli.usuario.id}' AND estado = 'apartado'`,
        )[0]?.operacion_id ?? '',
      );
      expect(op).not.toBe('');

      // El conductor acepta (API) y su app le dice cuánto cobra y cuánto le paga Divoox.
      const paso = (nombre: string, data: object = {}) =>
        request.post(`/datos/conductor/operaciones/${op}/${nombre}`, {
          headers: h(cond.token, { 'idempotency-key': `regalo-${nombre}-${id}` }),
          data,
        });
      await expect
        .poll(async () => (await paso('aceptar')).status(), { timeout: 30_000 })
        .toBe(200);
      if (CAPTURAS) {
        await p.reload();
        await expect(p.getByTestId('regalo-divoox')).toBeVisible({ timeout: 30_000 });
        // La parte de la pantalla donde se ve lo que paga Divoox y lo que se paga en mano.
        await p.getByTestId('regalo-divoox').scrollIntoViewIfNeeded();
        await p.evaluate(() => window.scrollBy(0, 200));
        await p.screenshot({ path: join(CARPETA, `cliente-viaje-${idioma}.png`) });
      }
      const ctxRep = await browser.newContext({ ...devices['Pixel 7'], baseURL: DATOS!.url });
      await ctxRep.addInitScript(
        ([pase, idi, cuentaId]) => {
          localStorage.setItem('tumbite.idioma', idi);
          localStorage.setItem('tumbite.sesion', pase);
          localStorage.setItem(`divoox.permisos.${cuentaId}`, '1');
        },
        [cond.token, idioma, c] as const,
      );
      const pr = await ctxRep.newPage();
      await pr.goto('/driver');
      await expect(pr.getByTestId('viaje-divoox-paga')).toBeVisible({ timeout: 30_000 });
      if (CAPTURAS) await pr.screenshot({ path: join(CARPETA, `conductor-viaje-${idioma}.png`) });

      // Termina el viaje: el regalo entra a las ganancias del conductor una vez.
      expect((await paso('llegue')).status()).toBe(200);
      const pin = String(
        sql(`SELECT pin_recogida FROM viajes WHERE operacion_id = '${op}'`)[0]?.pin_recogida,
      );
      expect((await paso('iniciar', { pin })).status()).toBe(200);
      // C-REGALO-VIAJE-REAL: el conductor termina sin haberse movido. El viaje se cierra y el
      // pasajero paga solo su parte, pero el regalo queda en revisión: nada entra a sus ganancias.
      const fin = await paso('terminar');
      expect(fin.status()).toBe(200);
      const cuenta_ = (await fin.json()) as {
        regaloDivoox: number;
        regaloEnRevision: boolean;
        cobrarEnMano: number;
        totalFinal: number;
      };
      expect(cuenta_.regaloDivoox).toBe(100);
      expect(cuenta_.regaloEnRevision).toBe(true);
      expect(cuenta_.cobrarEnMano).toBe(cuenta_.totalFinal - 100);
      const regalosPagados = () =>
        Number(
          sql(
            `SELECT COUNT(*) AS n FROM movimientos WHERE usuario_id = '${c}' AND concepto = 'regalo'`,
          )[0]?.n,
        );
      expect(regalosPagados()).toBe(0);
      // El conductor lo ve en Ganancias como «Divoox está revisando este regalo».
      await pr.goto('/driver');
      await pr
        .getByText(idioma === 'es' ? 'Ganancias' : 'Earnings', { exact: true })
        .last()
        .click();
      await pr.getByTestId('segmento-billetera').click();
      const enRevision = pr.getByTestId('regalos-en-revision');
      await expect(enRevision).toBeVisible({ timeout: 30_000 });
      await expect(pr.getByTestId('regalos-por-cobrar')).toHaveCount(0);
      if (CAPTURAS) {
        await enRevision.scrollIntoViewIfNeeded();
        await pr
          .getByTestId('saldo-prepago')
          .screenshot({ path: join(CARPETA, `conductor-revision-${idioma}.png`) });
      }
      // El equipo lo ve en «Regalos en revisión» con el motivo, y lo aprueba.
      {
        const { ruta: rutaPanel } = (await (
          await request.get('/datos/admin/ruta', { headers: h(admin.token) })
        ).json()) as { ruta: string | null };
        const ctxRev = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await ctxRev.addCookies([
          { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
        ]);
        await ctxRev.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
        const rv = await ctxRev.newPage();
        await rv.goto(`/panel${rutaPanel ? `/${rutaPanel}` : ''}/gift-codes`);
        const tarjetaRev = rv.getByTestId('regalo-revision');
        await expect(tarjetaRev).toBeVisible({ timeout: 30_000 });
        await expect(tarjetaRev).toContainText(
          idioma === 'es' ? 'terminado sin moverse' : 'ended without moving',
        );
        if (CAPTURAS) {
          await tarjetaRev.scrollIntoViewIfNeeded();
          await rv
            .getByTestId('regalos-revisiones')
            .screenshot({ path: join(CARPETA, `super-revision-${idioma}.png`) });
        }
        // Rechazar sin motivo no pasa: lo dice en pantalla y no pierde nada.
        await tarjetaRev
          .getByRole('button', { name: idioma === 'es' ? 'Rechazar' : 'Reject' })
          .click();
        await expect(tarjetaRev.getByRole('alert')).toBeVisible();
        await expect(tarjetaRev).toBeVisible();
        await tarjetaRev
          .getByRole('textbox')
          .fill(
            idioma === 'es' ? 'Viaje confirmado con el pasajero' : 'Trip confirmed with the rider',
          );
        await tarjetaRev
          .getByRole('button', {
            name: idioma === 'es' ? 'Aprobar y acreditar' : 'Approve and credit',
          })
          .click();
        await expect(rv.getByTestId('regalo-revision')).toHaveCount(0, { timeout: 30_000 });
        await ctxRev.close();
      }
      // Aprobado: ahora sí, una sola vez, en sus ganancias.
      expect(regalosPagados()).toBe(1);

      // C-SALDO-CONDUCTOR: el equipo le carga saldo (regalo de arranque) y el conductor ve en
      // Ganancias su saldo, sus regalos por cobrar y sus cargas.
      const carga = await request.post(`/datos/admin/conductores-ciudad/${c}/saldo`, {
        headers: h(admin.token),
        data: { monto: 500, motivo: idioma === 'es' ? 'Regalo de arranque' : 'Starter gift' },
      });
      expect(carga.ok(), await carga.text()).toBe(true);
      await pr.goto('/driver');
      await pr
        .getByText(idioma === 'es' ? 'Ganancias' : 'Earnings', { exact: true })
        .last()
        .click();
      await pr.getByTestId('segmento-billetera').click();
      const saldoBloque = pr.getByTestId('saldo-prepago');
      await expect(saldoBloque).toBeVisible({ timeout: 30_000 });
      await expect(pr.getByTestId('regalos-por-cobrar')).toBeVisible();
      await expect(pr.getByTestId('cargas-saldo')).toBeVisible();
      if (CAPTURAS)
        await saldoBloque.screenshot({ path: join(CARPETA, `conductor-saldo-${idioma}.png`) });
      // El saldo y los regalos son el modelo de Venezuela: van SOLO en la ficha en español (tercera
      // auditoría de tiendas, 18 nov 2026); el total de hoy ya no cuenta el regalo como una entrega
      // (C-GANANCIAS-COHERENTES).
      await expect(pr.getByTestId('ganancias-incluye-regalos')).toBeVisible();
      // C-GANANCIAS-EN-MANO: lo que el pasajero pagó en mano entra en el total del conductor, con sus
      // bolívares, y la carrera sale en «Carreras cobradas en mano».
      await expect(pr.getByTestId('ganancias-incluye-en-mano')).toBeVisible({ timeout: 30_000 });
      await expect(pr.getByTestId('ganancias-total')).not.toHaveText(/^\$0[.,]00$/);
      await expect(pr.getByTestId('ganancias-viajes-en-mano')).toBeVisible({ timeout: 30_000 });
      // C-CUENTA-COBRO-VENEZUELA: la tarjeta habla de pago móvil y pide banco, teléfono y cédula.
      // En inglés el ejemplo es de Estados Unidos, donde no hay billeteras de celular: sin tarjeta.
      const cuentaCobro = pr.getByTestId('cuenta-cobro');
      if (idioma === 'es') {
        await expect(cuentaCobro).toBeVisible();
        await expect(cuentaCobro).toContainText('pago móvil');
        await expect(cuentaCobro).not.toContainText('tu número');
      } else await expect(cuentaCobro).toHaveCount(0);
      if (process.env.CARPETA_REVISION && idioma === 'es') {
        const carpetaRev = process.env.CARPETA_REVISION;
        await pr.screenshot({ path: join(carpetaRev, `ganancias-${idioma}.png`), fullPage: true });
        await pr.getByTestId('ganancias-total').scrollIntoViewIfNeeded();
        await pr.screenshot({ path: join(carpetaRev, `ganancias-total-${idioma}.png`) });
        const abrir = cuentaCobro.getByRole('button').last();
        await abrir.scrollIntoViewIfNeeded();
        await abrir.click();
        await expect(pr.getByTestId('cuenta-cobro-formulario')).toBeVisible();
        await cuentaCobro.screenshot({ path: join(carpetaRev, `cuenta-cobro-${idioma}.png`) });
        await pr.goto('/driver');
        await expect(pr.getByTestId('resumen-dia')).toBeVisible({ timeout: 30_000 });
        await expect(pr.getByTestId('resumen-dia')).not.toContainText('$0.00', { timeout: 30_000 });
        await pr.screenshot({ path: join(carpetaRev, `inicio-${idioma}.png`) });
        await pr
          .getByText(idioma === 'es' ? 'Ganancias' : 'Earnings', { exact: true })
          .last()
          .click();
        await pr.getByTestId('segmento-billetera').click();
        await expect(pr.getByTestId('saldo-prepago')).toBeVisible({ timeout: 30_000 });
      }
      if (TIENDA && idioma === 'es') {
        // Auditor de tiendas (18 nov 2026): en la ficha nada que parezca una promesa de ingresos
        // («te alcanza para unas 124 carreras»); el saldo, los regalos y las cargas, arriba.
        await pr.evaluate(() => {
          for (const id of ['carreras-alcanzan', 'pedidos-alcanzan'])
            document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`).forEach((e) => {
              e.style.display = 'none';
            });
          document
            .querySelector('[data-testid="saldo-prepago"]')
            ?.scrollIntoView({ block: 'start' });
        });
        await pr.waitForTimeout(800);
        await pr.screenshot({ path: tiendaDriver(idioma, '05-saldo-y-regalos.png') });
      }

      // El superadmin: el cupón con su gasto en vivo y el crédito del conductor.
      const { ruta } = (await (
        await request.get('/datos/admin/ruta', { headers: h(admin.token) })
      ).json()) as { ruta: string | null };
      const panel = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await panel.addCookies([
        { name: 'tumbite_sesion', value: admin.token, domain: 'localhost', path: '/' },
      ]);
      await panel.addInitScript((idi) => localStorage.setItem('tumbite.idioma', idi), idioma);
      const sp = await panel.newPage();
      await sp.goto(`/panel${ruta ? `/${ruta}` : ''}/gift-codes`);
      const tarjeta = sp.getByTestId(`regalo-${C.codigo}`);
      await expect(tarjeta).toBeVisible({ timeout: 30_000 });
      await expect(tarjeta).toContainText(idioma === 'es' ? 'Encendido' : 'On');
      const sobra = await sp.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(sobra).toBeLessThanOrEqual(0);
      if (CAPTURAS) {
        await tarjeta.screenshot({ path: join(CARPETA, `super-cupon-${idioma}.png`) });
        await sp.getByTestId('regalos-crear').screenshot({
          path: join(CARPETA, `super-crear-${idioma}.png`),
        });
        await sp
          .locator('table')
          .first()
          .screenshot({
            path: join(CARPETA, `super-conductores-${idioma}.png`),
          });
      }
      // C-SALDO-CONDUCTOR: la vista de conductores por ciudad y la carga con revisión.
      await sp.goto(`/panel${ruta ? `/${ruta}` : ''}/driver-balance`);
      await sp.getByRole('tab', { name: z.nombre }).click();
      const tabla = sp.getByTestId('saldo-tabla');
      await expect(tabla).toContainText(C.conductor, { timeout: 30_000 });
      if (CAPTURAS)
        await sp.getByTestId('super-saldo-conductores').screenshot({
          path: join(CARPETA, `super-saldo-${idioma}.png`),
        });
      await tabla.getByRole('button').first().click();
      await sp.getByTestId('saldo-carga').locator('input[type="number"]').fill('5');
      await sp
        .getByRole('button', { name: idioma === 'es' ? 'Revisar la carga' : 'Review the top-up' })
        .click();
      await expect(sp.getByTestId('saldo-confirmar-texto')).toBeVisible();
      if (CAPTURAS)
        await sp.getByTestId('saldo-carga').screenshot({
          path: join(CARPETA, `super-saldo-carga-${idioma}.png`),
        });
      await sp
        .getByRole('button', {
          name: idioma === 'es' ? 'Confirmar la carga' : 'Confirm the top-up',
        })
        .click();
      await expect(sp.getByRole('status')).toBeVisible({ timeout: 30_000 });
      await ctx.close();
      await ctxRep.close();
      await panel.close();
    } finally {
      // Al terminar, se deja como estaba: el cupón apagado y Moto en construcción.
      await request.patch(`/datos/admin/regalos-divoox/${C.codigo}`, {
        headers: h(admin.token),
        data: { activo: false },
      });
      for (const r of requisitos)
        sql(
          `INSERT OR IGNORE INTO servicio_requisitos (servicio_id, requisito, obligatorio) VALUES ('${String(r.servicio_id)}', '${String(r.requisito)}', ${Number(r.obligatorio)})`,
        );
      sql(`UPDATE servicios_zona SET estado = 'proximamente' WHERE servicio_id = 'moto'`);
      sql(`UPDATE servicios SET estado = 'proximamente' WHERE id = 'moto'`);
      sql(`DELETE FROM servicios_implementados WHERE servicio_id = 'moto'`);
    }
  });
}

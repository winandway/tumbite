import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, devices, expect, test } from './fixtures';
import { TEXTOS } from './textos';

/**
 * C-RECORRIDO-INTERNACIONAL (19 oct 2026): el cobro en mano en PESOS y en BOLÍVARES, de punta a
 * punta. Tarifas y topes FICTICIOS, solo para esta prueba: no son cifras de Divoox. Las capturas
 * van a .recorrido/capturas-internacional (fuera de git, fuera de la web y de Docs).
 *
 * C-RECORRIDO-AISLADO (20 oct 2026): cada corrida usa SU propia ciudad de prueba (código con la
 * marca de la corrida) y solo toca lo suyo: apaga las ciudades de prueba anteriores con su mismo
 * prefijo (por la API del panel, sin SQL), guarda la configuración del país al empezar y la
 * devuelve tal cual al terminar, y al final desconecta a su repartidor, cierra su restaurante y
 * apaga su ciudad, también si la prueba falla. Nada de limpiezas que afecten a otros datos.
 *
 * Dónde corre: en esta computadora siempre. En el sitio de pruebas SOLO con
 * RECORRIDO_INTERNACIONAL=autorizado (crea allí una ciudad de prueba y cuentas de la corrida y
 * enciende por minutos el cobro en mano de ese país): espera la autorización específica de Richard
 * (docs/SOLICITUD-AUTORIZACIONES-2026-10-20.md). Sin ella, se salta y lo dice.
 *
 * En pantalla: el cliente pide con «Efectivo al recibir» y ve su moneda; el repartidor ve la oferta
 * con el adelanto, registra lo que pagó en el local escribiendo pesos o bolívares, y confirma el
 * cobro; soporte ve la bandeja en esa moneda. Por la API del producto: aceptar, listo, recoger,
 * entregar, transferencia, diferencias, excedentes, cancelación y conciliación.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const AUTORIZADO_STAGING = process.env.RECORRIDO_INTERNACIONAL === 'autorizado';
if (STAGING && !/staging\.tumbite\.com|tumbite-pruebas/.test(process.env.RECORRIDO_URL ?? ''))
  throw new Error('El recorrido internacional remoto solo corre contra el sitio de pruebas.');
test.skip(
  STAGING && !AUTORIZADO_STAGING,
  'NO EJECUTADA en staging: crear allí una ciudad de prueba espera la autorización específica',
);
const DATOS = (
  STAGING
    ? {
        correoEquipo: `soporte.internacional.${Date.now().toString(36)}@recorrido.test`,
        clave: `Recorrido-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`,
        semilla: '',
      }
    : JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8'))
) as { correoEquipo: string; clave: string; semilla: string };
/** En staging la cuenta del equipo se vuelve admin en SU base, como en el recorrido principal. */
function hacerAdminEnStaging(correo: string) {
  execFileSync(
    'curl',
    [
      '-s',
      '-f',
      '-X',
      'POST',
      `${process.env.RECORRIDO_URL}/datos/interno/diagnostico/sql`,
      '-H',
      'content-type: application/json',
      '-H',
      `x-reloj-secreto: ${process.env.RECORRIDO_SECRETO ?? ''}`,
      '--data',
      JSON.stringify({ sql: `UPDATE usuarios SET rol = 'admin' WHERE correo = '${correo}'` }),
    ],
    { encoding: 'utf8' },
  );
}
const CAPTURAS = join(RAIZ, '.recorrido', 'capturas-internacional');

const PAISES = [
  {
    pais: 'CO',
    moneda: 'COP',
    decimales: 0,
    zona: {
      prefijo: 'CO-DC-P',
      nombre: 'Bogotá (prueba)',
      zonaHoraria: 'America/Bogota',
      lat: 4.6533,
      lng: -74.0836,
    },
    casa: { latitude: 4.6551, longitude: -74.0812 },
    idioma: 'es' as const,
    plato: 25_000, // 25 000 pesos (ficticio)
    escribir: (n: number) => String(n),
    // Cómo se ve: «$ 25.000» (pesos sin decimales, punto de miles).
    visto: /25\.000/,
  },
  {
    pais: 'VE',
    moneda: 'VES',
    decimales: 2,
    zona: {
      prefijo: 'VE-DC-P',
      nombre: 'Caracas (prueba)',
      zonaHoraria: 'America/Caracas',
      lat: 10.4806,
      lng: -66.9036,
    },
    casa: { latitude: 10.4823, longitude: -66.9011 },
    idioma: 'en' as const,
    plato: 1_250_00, // 1250,00 bolívares (ficticio)
    escribir: (n: number) => (n / 100).toFixed(2),
    visto: /1[.,]250[.,]00/,
  },
];

/** Cifras FICTICIAS: solo existen en esta prueba y en la base local. */
const tarifasFicticias = (k: number) => ({
  comisionPb: { inicial: 1500, crece: 1500, elite: 1500 },
  envioBase: 400 * k,
  envioKmIncluidos: 4,
  envioPorKm: 100 * k,
  envioMaximo: 1200 * k,
  servicioPb: 500,
  servicioMinimo: 150 * k,
  servicioMaximo: 500 * k,
  pedidoMinimo: 0,
  cargoPedidoPequeno: 0,
  pagoMinimoRepartidor: 300 * k,
  impuestoPb: 0,
});
const topesFicticios = (k: number) => ({
  bonoOfertaAbierta: 200 * k,
  opcionPrecioMax: 20_000 * k,
  propinaMax: 10_000 * k,
  propinaExtraMin: 100 * k,
  propinaExtraMax: 5000 * k,
  cuponMontoMax: 2000 * k,
  quejaReembolsoMax: 3000 * k,
});

for (const P of PAISES) {
  test(`cobro en mano en ${P.moneda}, en pantalla y por API`, async ({ browser, request }) => {
    test.setTimeout(600_000);
    const L = TEXTOS[P.idioma];
    const corrida = Date.now().toString(36);
    const id = `${P.moneda.toLowerCase()}${corrida}`;
    // La ciudad de ESTA corrida (C-RECORRIDO-AISLADO).
    const { prefijo, ...zonaBase } = P.zona;
    const ZONA = { ...zonaBase, id: `${prefijo}${corrida.toUpperCase()}` };
    const correo = (q: string) => `${q}.${id}@internacional.test`;
    const clave = DATOS.clave;
    // Multiplicador para que las cifras ficticias tengan sentido en cada moneda.
    const k = P.decimales === 0 ? 10 : 100;
    let ip = 0;
    const desde = () => ({ 'cf-connecting-ip': `10.88.${Math.floor(++ip / 250)}.${ip % 250}` });
    const hdr = (t: string) => ({ authorization: `Bearer ${t}`, ...desde() });
    const fotos = (pg: Page, nombre: string) => {
      mkdirSync(CAPTURAS, { recursive: true });
      return pg.screenshot({ path: join(CAPTURAS, `${nombre}-${P.moneda}.png`) });
    };

    // ── Equipo (admin) y país de prueba con tarifas y topes ficticios ──
    const entrar = await request.post('/datos/cuentas/entrar', {
      headers: desde(),
      data: { correo: DATOS.correoEquipo, clave },
    });
    let admin: string;
    if (entrar.ok()) admin = ((await entrar.json()) as { token: string }).token;
    else {
      const r = await request.post('/datos/cuentas/registro', {
        headers: desde(),
        data: { nombre: 'Soporte Recorrido', correo: DATOS.correoEquipo, clave, rol: 'cliente' },
      });
      admin = ((await r.json()) as { token: string }).token;
      if (STAGING) hacerAdminEnStaging(DATOS.correoEquipo);
      else
        await request.post('/datos/cuentas/hacer-admin', {
          headers: hdr(admin),
          data: { semilla: DATOS.semilla },
        });
    }
    // Lo que se deshace al final, pase lo que pase (en orden inverso).
    const limpiezas: { que: string; hacer: () => Promise<unknown> }[] = [];
    try {
      // La configuración del país tal como estaba: se devuelve igual al terminar.
      const previo = (await (
        await request.get(`/datos/admin/paises/${P.pais}`, { headers: hdr(admin) })
      ).json()) as { config: Record<string, unknown> };
      expect(previo.config).toBeTruthy();
      limpiezas.push({
        que: 'configuración del país',
        hacer: () =>
          request.put(`/datos/admin/paises/${P.pais}`, {
            headers: hdr(admin),
            data: previo.config,
          }),
      });
      // Un país incompleto no se enciende (lo dice el servidor).
      const incompleto = await request.put(`/datos/admin/paises/${P.pais}`, {
        headers: hdr(admin),
        data: { efectivoActivo: true, tarifas: null, topes: null },
      });
      expect(incompleto.status()).toBe(409);
      const pais = await request.put(`/datos/admin/paises/${P.pais}`, {
        headers: hdr(admin),
        data: {
          tarifas: tarifasFicticias(k),
          topes: topesFicticios(k),
          efectivoActivo: true,
          transferenciaRepartidorActiva: true,
          recargasPuntoVentaActivas: true,
          comisionPb: 1000,
          cargoFijo: 0,
        },
      });
      expect(pais.status(), await pais.text()).toBe(200);
      // Aislamiento sin SQL: se apagan solo las ciudades de prueba anteriores de este país (mismo
      // prefijo; también la vieja «…-PRUEBA»). El despacho nunca cruza de ciudad, así que sus
      // repartidores y pedidos colgados no tocan esta corrida, y no se cambia ni un dato suyo.
      const zonas = (await (
        await request.get('/datos/admin/zonas', { headers: hdr(admin) })
      ).json()) as { zonas: { id: string; activa: boolean }[] };
      for (const z of zonas.zonas.filter((z) => z.id.startsWith(prefijo) && z.activa)) {
        const r = await request.patch(`/datos/admin/zonas/${z.id}`, {
          headers: hdr(admin),
          data: { activa: false },
        });
        expect(r.ok(), `apagar ${z.id}`).toBe(true);
      }
      const zona = await request.put('/datos/admin/zonas', {
        headers: hdr(admin),
        data: {
          ...ZONA,
          pais: P.pais,
          moneda: P.moneda,
          radioKm: 30,
          activa: true,
          idioma: P.idioma,
        },
      });
      expect(zona.status(), await zona.text()).toBe(200);
      limpiezas.push({
        que: 'ciudad de la corrida',
        hacer: () =>
          request.patch(`/datos/admin/zonas/${ZONA.id}`, {
            headers: hdr(admin),
            data: { activa: false },
          }),
      });

      // ── Restaurante en la ciudad de prueba (por la API, como lo deja listo su panel) ──
      const cuenta = async (q: string, rol: string) => {
        const r = await request.post('/datos/cuentas/registro', {
          headers: desde(),
          data: { nombre: `Prueba ${q}`, correo: correo(q), clave, rol, telefono: '3000000000' },
        });
        expect(r.ok(), await r.text()).toBe(true);
        return (await r.json()) as { token: string; usuario: { id: string } };
      };
      const dueno = await cuenta('restaurante', 'restaurante');
      const nombreRest = `Arepería ${id.slice(-5)}`;
      const rest = await request.put('/datos/mi-restaurante', {
        headers: hdr(dueno.token),
        data: {
          nombre: nombreRest,
          categoria: 'Arepas',
          telefono: '3000000001',
          direccion: 'Calle de prueba 1',
          lat: ZONA.lat,
          lng: ZONA.lng,
        },
      });
      expect(rest.ok(), await rest.text()).toBe(true);
      const rid = ((await rest.json()) as { restaurante: { id: string } }).restaurante.id;
      await request.patch(`/datos/admin/restaurantes/${rid}`, {
        headers: hdr(admin),
        data: { estado: 'aprobado' },
      });
      await request.put('/datos/mi-restaurante/horarios', {
        headers: hdr(dueno.token),
        data: {
          turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
        },
      });
      // Una opción por encima del tope de EE. UU. (100 dólares) pero dentro del tope del país.
      const plato = await request.post('/datos/mi-restaurante/platos', {
        headers: hdr(dueno.token),
        data: { nombreEs: 'Arepa de prueba', nombreEn: 'Test arepa', precioCentavos: P.plato },
      });
      expect(plato.ok(), await plato.text()).toBe(true);
      const abierto = await request.patch('/datos/mi-restaurante/abierto', {
        headers: hdr(dueno.token),
        data: { abierto: true },
      });
      expect(abierto.ok(), await abierto.text()).toBe(true);
      limpiezas.push({
        que: 'restaurante de la corrida',
        hacer: () =>
          request.patch('/datos/mi-restaurante/abierto', {
            headers: hdr(dueno.token),
            data: { abierto: false },
          }),
      });

      const ctx = (donde: { latitude: number; longitude: number }) =>
        browser
          .newContext({
            ...devices['Pixel 7'],
            geolocation: donde,
            permissions: ['geolocation'],
            locale: P.idioma === 'en' ? 'en-US' : 'es-US',
          })
          .then(async (c) => {
            await c.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), P.idioma);
            return c;
          });

      // ── Repartidor en pantalla: alta, foto de control y conexión ──
      const repCtx = await ctx({ latitude: ZONA.lat, longitude: ZONA.lng });
      const rep = await repCtx.newPage();
      await rep.goto('/driver/');
      await rep.getByText(L.appCrear).click();
      await rep.getByLabel(L.nombreCompleto).fill('Repartidor Prueba');
      await rep.getByLabel(L.correo).fill(correo('repartidor'));
      await rep.getByLabel(L.celular).fill('3000000002');
      await rep.getByLabel(L.clave, { exact: true }).fill(clave);
      await rep.getByRole('button', { name: L.crearCuenta }).click();
      const conectar = () =>
        rep
          .getByRole('switch')
          .or(rep.getByRole('button', { name: L.conectarme }))
          .first()
          .click();
      await conectar();
      await expect(rep.getByRole('button', { name: L.tomarSelfie })).toBeVisible({
        timeout: 20_000,
      });
      const [sel] = await Promise.all([
        rep.waitForEvent('filechooser'),
        rep.getByRole('button', { name: L.tomarSelfie }).click(),
      ]);
      await sel.setFiles(join(__dirname, 'fotos', 'bolsa-recogida.jpg'));
      await expect(rep.getByText(L.selfieLista)).toBeVisible({ timeout: 20_000 });
      await conectar();
      const paseRep = await rep.evaluate(() => localStorage.getItem('tumbite.sesion') ?? '');
      limpiezas.push({
        que: 'repartidor de la corrida',
        hacer: () =>
          request.post('/datos/repartidor/conectar', {
            headers: hdr(paseRep),
            data: { conectado: false },
          }),
      });

      // Saldo para comisiones: un punto de venta del país emite un código y el repartidor lo canjea.
      const puntoDueno = await cuenta('punto', 'cliente');
      const punto = (await (
        await request.post('/datos/admin/puntos-venta', {
          headers: hdr(admin),
          data: { nombre: `Punto ${id.slice(-4)}`, pais: P.pais, usuarioId: puntoDueno.usuario.id },
        })
      ).json()) as { punto: { id: string } };
      await request.post(`/datos/admin/puntos-venta/${punto.punto.id}/fondo`, {
        headers: hdr(admin),
        data: { monto: 100_000 * k, comprobante: `prueba-${id}` },
      });
      const codigo = (await (
        await request.post('/datos/punto-venta/codigos', {
          headers: hdr(puntoDueno.token),
          data: { monto: 20_000 * k },
        })
      ).json()) as { codigo: string };
      const canje = await request.post('/datos/repartidor/recargar', {
        headers: hdr(paseRep),
        data: { codigo: codigo.codigo },
      });
      expect(canje.ok(), await canje.text()).toBe(true);
      await rep.reload();
      await expect(rep.getByTestId('saldo-prepago'))
        .toBeVisible({ timeout: 20_000 })
        .catch(() => undefined);

      // ── Cliente en pantalla: ve la moneda, pide con «Efectivo al recibir» ──
      const cliCtx = await ctx(P.casa);
      const cli = await cliCtx.newPage();
      await cli.goto('/app/');
      await cli.getByText(L.appCrear).click();
      await cli.getByLabel(L.nombreCompleto).fill('Cliente Prueba');
      await cli.getByLabel(L.correo).fill(correo('cliente'));
      await cli.getByLabel(L.celular).fill('3000000003');
      await cli.getByLabel(L.clave, { exact: true }).fill(clave);
      await cli.getByRole('button', { name: L.crearCuenta }).click();
      await expect(cli.getByText(nombreRest).first()).toBeVisible({ timeout: 30_000 });
      await cli.getByText(nombreRest).first().click();
      await expect(cli.getByText(P.visto).first()).toBeVisible({ timeout: 20_000 });
      await fotos(cli, 'cliente-menu');
      await cli
        .getByRole('button', { name: L.agregar === 'Add' ? /^Add / : /^Agregar / })
        .filter({ visible: true })
        .first()
        .click();
      await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
      await cli.getByRole('radio', { name: L.enPuerta }).click();
      await cli.getByLabel(L.direccionEntrega).fill('Calle de prueba 200, apto 3');
      // La tarjeta solo cobra en dólares: en esta moneda no se ofrece.
      await expect(cli.getByRole('radio', { name: /^(Card|Tarjeta)$/ })).toHaveCount(0);
      await cli.getByRole('radio', { name: /^(Cash on delivery|Efectivo al recibir)$/ }).click();
      await fotos(cli, 'cliente-carrito');
      const [resp] = await Promise.all([
        cli.waitForResponse(
          (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
        ),
        cli
          .getByText(/^(Order and pay on delivery|Pedir y pagar al recibir) · /)
          .filter({ visible: true })
          .click(),
      ]);
      const cuerpo = await resp.text();
      expect(resp.status(), cuerpo).toBe(201);
      const pedido = JSON.parse(cuerpo) as {
        pedidoId: string;
        moneda: string;
        desglose: { totalCliente: number; subtotal: number; propina: number };
      };
      expect(pedido.moneda).toBe(P.moneda);
      expect(pedido.desglose.subtotal).toBe(P.plato);

      // ── El restaurante acepta; el repartidor ve la oferta en su moneda y la acepta en pantalla ──
      await request.post(`/datos/restaurante/pedidos/${pedido.pedidoId}/aceptar`, {
        headers: hdr(dueno.token),
        data: { minutos: 5 },
      });
      await expect(rep.getByTestId('oferta-cobro-en-mano')).toBeVisible({ timeout: 40_000 });
      const adelanto = await rep.getByTestId('oferta-cobro-en-mano').innerText();
      expect(adelanto).toMatch(P.decimales === 0 ? /\d\.\d{3}/ : /\d[.,]\d{2}/);
      await fotos(rep, 'repartidor-oferta');
      await rep.getByRole('button', { name: L.aceptarOferta, exact: true }).click();
      const reservado = (await (
        await request.get('/datos/repartidor/saldo-prepago', { headers: hdr(paseRep) })
      ).json()) as { reservado: number; moneda: string };
      expect(reservado.moneda).toBe(P.moneda);
      // Comisión ficticia del país: 10 % de la comida, en la unidad menor de su moneda.
      expect(reservado.reservado).toBe(Math.round(P.plato * 0.1));

      // ── Pago en el local, en pantalla, escribiendo la moneda del país ──
      await request.post(`/datos/restaurante/pedidos/${pedido.pedidoId}/listo`, {
        headers: hdr(dueno.token),
        data: {},
      });
      const bloque = rep.getByTestId('pago-en-local');
      await expect(bloque).toBeVisible({ timeout: 30_000 });
      const local = (await (
        await request.get(`/datos/repartidor/pedidos/${pedido.pedidoId}/pago-local`, {
          headers: hdr(paseRep),
        })
      ).json()) as { montoEsperado: number; subtotal: number; moneda: string };
      expect(local.moneda, JSON.stringify(local)).toBe(P.moneda);
      const pagado = bloque.getByRole('textbox').first();
      await pagado.fill(P.escribir(local.montoEsperado));
      await fotos(rep, 'repartidor-pago-local');
      await rep.getByRole('button', { name: /^(Record the payment|Registrar el pago)$/ }).click();
      await expect(rep.getByText(/^(Payment recorded\.|Pago registrado\.)$/)).toBeVisible({
        timeout: 20_000,
      });
      const filaLocal = (await (
        await request.get(`/datos/repartidor/pedidos/${pedido.pedidoId}/pago-local`, {
          headers: hdr(paseRep),
        })
      ).json()) as { registrado: { montoPagado: number; diferenciaPago: number } };
      // Lo escrito en pantalla llegó en la unidad menor correcta (sin multiplicar por 100 los pesos).
      expect(filaLocal.registrado).toMatchObject({
        montoPagado: local.montoEsperado,
        diferenciaPago: 0,
      });

      // ── Recogida y entrega (por la API) y «Cobré» en pantalla con la moneda del país ──
      const bolsa = readFileSync(join(__dirname, 'fotos', 'bolsa-entrega.jpg'));
      const subir = (ruta: string, donde: { lat: number; lng: number }) =>
        request.post(`${ruta}${ruta.includes('?') ? '&' : '?'}lat=${donde.lat}&lng=${donde.lng}`, {
          headers: { ...hdr(paseRep), 'content-type': 'image/jpeg' },
          data: bolsa,
        });
      const enRest = { lat: ZONA.lat, lng: ZONA.lng };
      const enCasa = { lat: P.casa.latitude, lng: P.casa.longitude };
      const recogerYLlegar = async (pid: string) => {
        expect((await subir(`/datos/repartidor/pedidos/${pid}/foto-recogida`, enRest)).ok()).toBe(
          true,
        );
        await request.post(`/datos/restaurante/pedidos/${pid}/confirmar-recogida`, {
          headers: hdr(dueno.token),
          data: {},
        });
        await repCtx.setGeolocation(P.casa);
        await expect
          .poll(
            async () => {
              for (let n = 0; n < 2; n++)
                await request.post('/datos/repartidor/ubicacion', {
                  headers: hdr(paseRep),
                  data: { lat: enCasa.lat, lng: enCasa.lng, precision: 10 },
                });
              const e = (await (
                await request.get('/datos/repartidor/estado', { headers: hdr(paseRep) })
              ).json()) as { activo?: { llegoCliente?: boolean } };
              return Boolean(e.activo?.llegoCliente);
            },
            { timeout: 60_000, intervals: [2_000] },
          )
          .toBe(true);
      };
      const entregar = async (pid: string) => {
        const r = await subir(`/datos/repartidor/pedidos/${pid}/entregado`, enCasa);
        expect(r.status(), await r.text()).toBe(200);
      };
      const recogerYEntregar = async (pid: string) => {
        await recogerYLlegar(pid);
        await entregar(pid);
      };
      // En la puerta, ANTES de marcar entregado (así lo pide la app): el repartidor confirma el cobro.
      await recogerYLlegar(pedido.pedidoId);
      await rep.reload();
      const esperado = pedido.desglose.totalCliente - pedido.desglose.propina;
      const campoCobro = rep
        .getByLabel(/^(What you received \(without the tip\)|Lo que recibiste \(sin la propina\))$/)
        .filter({ visible: true })
        .first();
      await expect(campoCobro).toBeVisible({ timeout: 30_000 });
      await campoCobro.fill(P.escribir(esperado));
      await fotos(rep, 'repartidor-cobre');
      await rep
        .getByRole('button', { name: /^(Collected|Cobré)$/ })
        .filter({ visible: true })
        .first()
        .click();
      await entregar(pedido.pedidoId);
      await expect
        .poll(
          async () => {
            const f = (await (
              await request.get(`/datos/admin/libro/pedido/${pedido.pedidoId}`, {
                headers: hdr(admin),
              })
            ).json()) as { movimientos: { concepto: string; monto: number; moneda: string }[] };
            return f.movimientos
              .filter((m) => m.concepto === 'comision_cobrada' && m.monto > 0)
              .map((m) => m.moneda);
          },
          { timeout: 20_000 },
        )
        .toEqual([P.moneda]);

      // ── Más casos por la API: diferencia, excedente, transferencia, cliente ausente ──
      const tokenCli = await cli.evaluate(() => localStorage.getItem('tumbite.sesion') ?? '');
      const pedirApi = async (
        metodoPago: 'efectivo' | 'transferencia_repartidor',
        token = tokenCli,
      ) => {
        const r = await request.post('/datos/pedidos', {
          headers: hdr(token),
          data: {
            restauranteId: rid,
            lineas: [
              {
                platoId: ((await plato.json()) as { plato: { id: string } }).plato.id,
                cantidad: 1,
              },
            ],
            propinaCentavos: 0,
            direccion: 'Calle de prueba 200',
            lat: enCasa.lat,
            lng: enCasa.lng,
            entrega: 'puerta',
            metodoPago,
          },
        });
        expect(r.status(), await r.text()).toBe(201);
        const p = (await r.json()) as { pedidoId: string; desglose: { totalCliente: number } };
        await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/aceptar`, {
          headers: hdr(dueno.token),
          data: { minutos: 5 },
        });
        // Lista ya: el despacho la ofrece enseguida (con el reloj, sale cuando falta poco para estar lista).
        await request.post(`/datos/restaurante/pedidos/${p.pedidoId}/listo`, {
          headers: hdr(dueno.token),
          data: {},
        });
        await expect
          .poll(
            async () => {
              const o = (await (
                await request.get('/datos/repartidor/ofertas', { headers: hdr(paseRep) })
              ).json()) as {
                ofertas: { id: string }[];
              };
              return o.ofertas.some((x) => x.id === p.pedidoId);
            },
            { timeout: 40_000 },
          )
          .toBe(true);
        await request.post(`/datos/repartidor/ofertas/${p.pedidoId}/aceptar`, {
          headers: hdr(paseRep),
          data: {},
        });
        const l = (await (
          await request.get(`/datos/repartidor/pedidos/${p.pedidoId}/pago-local`, {
            headers: hdr(paseRep),
          })
        ).json()) as { montoEsperado: number; subtotal: number };
        await request.post(`/datos/repartidor/pedidos/${p.pedidoId}/pago-local`, {
          headers: hdr(paseRep),
          data: { montoPagado: l.montoEsperado, importeTicket: l.subtotal, metodo: 'efectivo' },
        });
        return { id: p.pedidoId, total: p.desglose.totalCliente };
      };
      const cobre = (pid: string, monto: number) =>
        request.post(`/datos/repartidor/pedidos/${pid}/cobre`, {
          headers: hdr(paseRep),
          data: { montoRecibido: monto, nota: 'prueba' },
        });
      // Excedente: transferencia repetida.
      const x = await pedirApi('transferencia_repartidor');
      await recogerYEntregar(x.id);
      expect(
        (
          await request.post(`/datos/repartidor/pedidos/${x.id}/transferencia-pendiente`, {
            headers: hdr(paseRep),
            data: { nota: 'prueba' },
          })
        ).ok(),
      ).toBe(true);
      expect((await cobre(x.id, x.total * 2)).ok()).toBe(true);
      // Diferencia: el cliente paga de menos.
      const d = await pedirApi('efectivo');
      await recogerYEntregar(d.id);
      expect((await cobre(d.id, d.total - 100 * k)).ok()).toBe(true);
      // Cliente ausente después de comprar la comida (otro cliente: el anterior ya quedó con deuda
      // por pagar de menos y, con razón, no puede volver a pedir en efectivo).
      const otroCliente = await cuenta('cliente2', 'cliente');
      const a = await pedirApi('efectivo', otroCliente.token);
      expect((await subir(`/datos/repartidor/pedidos/${a.id}/foto-recogida`, enRest)).ok()).toBe(
        true,
      );
      await request.post(`/datos/restaurante/pedidos/${a.id}/confirmar-recogida`, {
        headers: hdr(dueno.token),
        data: {},
      });
      expect(
        (
          await request.post(`/datos/repartidor/pedidos/${a.id}/no-pago`, {
            headers: hdr(paseRep),
            data: { motivo: 'no aparece' },
          })
        ).ok(),
      ).toBe(true);

      // ── Bandeja de soporte en su moneda, en pantalla ──
      const bandeja = (await (
        await request.get('/datos/admin/bandeja-dinero', { headers: hdr(admin) })
      ).json()) as { casos: { clave: string; moneda: string; tipo: string }[] };
      const mios = bandeja.casos.filter((c) => [d.id, x.id, a.id].some((p) => c.clave.endsWith(p)));
      expect(new Set(mios.map((c) => c.tipo))).toEqual(
        new Set(['diferencia', 'excedente', 'comida']),
      );
      expect(mios.every((c) => c.moneda === P.moneda)).toBe(true);
      const ruta = (
        (await (await request.get('/datos/admin/ruta', { headers: hdr(admin) })).json()) as {
          ruta: string;
        }
      ).ruta;
      const supCtx = await browser.newContext({
        viewport: { width: 1100, height: 900 },
        locale: P.idioma === 'en' ? 'en-US' : 'es-US',
      });
      await supCtx.addInitScript((i) => localStorage.setItem('tumbite.idioma', i), P.idioma);
      const sup = await supCtx.newPage();
      await sup.goto('/panel');
      await sup.getByLabel(L.correo).fill(DATOS.correoEquipo);
      await sup.getByLabel(L.clave, { exact: true }).fill(clave);
      await sup.getByRole('button', { name: P.idioma === 'en' ? 'Sign in' : 'Entrar' }).click();
      await sup.waitForLoadState('networkidle');
      await sup.goto(`/panel/${ruta}/cash/${encodeURIComponent(`excedente:${x.id}`)}`);
      await expect(sup.getByTestId('caso-dinero')).toBeVisible({ timeout: 20_000 });
      await expect(sup.getByText(P.decimales === 0 ? /\d\.\d{3}/ : /Bs|VES/).first()).toBeVisible();
      await fotos(sup, 'super-bandeja');

      // ── Conciliación del día: los pedidos en mano van aparte y en su moneda ──
      const dia = new Date().toISOString().slice(0, 10);
      const conc = (await (
        await request.get(`/datos/admin/conciliacion?dia=${dia}`, { headers: hdr(admin) })
      ).json()) as { conciliaciones: { dia: string; detalle: Record<string, unknown> }[] };
      const hoy = conc.conciliaciones.find((c) => c.dia === dia);
      expect(
        Number(new Map(Object.entries(hoy?.detalle ?? {})).get(`directos_${P.moneda}`) ?? 0),
      ).toBeGreaterThanOrEqual(3);

      await Promise.all([repCtx.close(), cliCtx.close(), supCtx.close()]);
    } finally {
      // Se deshace todo lo de esta corrida, también si falló a mitad (C-RECORRIDO-AISLADO).
      const fallos: string[] = [];
      for (const l of limpiezas.reverse()) {
        const r = (await l.hacer().catch((e: unknown) => e)) as { ok?: () => boolean };
        if (typeof r?.ok !== 'function' || !r.ok()) fallos.push(l.que);
      }
      expect(fallos, 'limpieza de la corrida').toEqual([]);
    }
  });
}

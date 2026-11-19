import { join } from 'node:path';
import { TEXTOS_RUTA } from '../../apps/repartidor/src/flex/textos';
import { type Page, expect, test } from './fixtures';
import { sqlLocal, sqlLocalTexto } from './sqlLocal';

/**
 * C-FLEX-BLOQUE-COMPLETO y C-FLEX-EXCLUSIVO (Richard, 16 nov 2026, al probar Driver: «la ruta del
 * bloque no se ha terminado al cien por ciento» y «Flex es exclusivo»). El bloque de Divoox Flex de
 * punta a punta en la app web del Driver, como Amazon Flex, en Novi (Michigan):
 *   la empresa asigna el bloque (3 h 30 min, con su pago) → todo lo demás se desconecta solo y no se
 *   puede volver a conectar → el inicio cambia entero al modo bloque → acepta → llega al centro y
 *   carga → sale a la ruta → parada 1: «Cómo llegar», escanea, «Ya estacioné», foto, dónde lo dejó y
 *   desliza → parada 2: no se pudo entregar, se devuelve → vuelve al centro y entrega la devolución →
 *   cierra el bloque: resumen con el pago → vuelve al inicio y ya se puede conectar otra vez.
 * Todos los países (la exclusividad); el ejemplo es de EE. UU.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

// C-CAPTURAS-POR-IDIOMA: en inglés, Novi (Michigan) con nombres de EE. UU.; en español, Doral (Miami).
const LUGARES = {
  en: {
    empresa: 'Great Lakes Supply',
    dueno: 'Pat Morgan',
    conductor: 'Alex Turner',
    ruta: 'Walled Lake route',
    centro: {
      nombre: 'Novi Warehouse',
      direccion: '43000 Grand River Ave, Novi, MI 48375',
      ciudad: 'Novi',
      lat: 42.4775,
      lng: -83.4766,
    },
    paradas: [
      {
        direccion: '1499 E West Maple Rd, Walled Lake, MI 48390',
        lat: 42.5373,
        lng: -83.4583,
        nombre: 'Jamie Lee',
      },
      {
        direccion: '100 N Pontiac Trl, Walled Lake, MI 48390',
        lat: 42.5377,
        lng: -83.4811,
        nombre: 'Chris Miller',
      },
    ],
    caja: 'Box',
  },
  es: {
    empresa: 'Distribuidora del Sol',
    dueno: 'Lucía Méndez',
    conductor: 'Carlos Rivera',
    ruta: 'Ruta Doral',
    centro: {
      nombre: 'Centro Doral',
      direccion: '8400 NW 36th St, Doral, FL 33166',
      ciudad: 'Doral',
      lat: 25.8098,
      lng: -80.3345,
    },
    paradas: [
      {
        direccion: '3500 NW 87th Ave, Doral, FL 33172',
        lat: 25.8076,
        lng: -80.3378,
        nombre: 'María Gómez',
      },
      {
        direccion: '8250 NW 36th St, Doral, FL 33166',
        lat: 25.81,
        lng: -80.332,
        nombre: 'José Martínez',
      },
    ],
    caja: 'Caja',
  },
} as const;
const FOTO = join(__dirname, 'fotos', 'bolsa-entrega.jpg');
const SALIDA = 'docs/capturas/recorrido';
const B = '/datos/v1/flex';
const iso = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

for (const idioma of ['es', 'en'] as const)
  test(`el bloque de Flex de punta a punta, exclusivo y con su pago (${idioma})`, async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const T = TEXTOS_RUTA[idioma];
    const L = LUGARES[idioma];
    const CENTRO = { lat: L.centro.lat, lng: L.centro.lng };
    const PARADAS = L.paradas;
    const id = Date.now().toString(36);
    let ip = 0;
    const ctxApi = await browser.newContext();
    const api = ctxApi.request;
    const pedir = async (metodo: 'GET' | 'POST', ruta: string, token: string, data?: unknown) => {
      const r = await api.fetch(ruta, {
        method: metodo,
        headers: {
          authorization: `Bearer ${token}`,
          'cf-connecting-ip': `10.98.${Math.floor(++ip / 250) % 90}.${ip % 250}`,
          ...(metodo === 'POST' ? { 'idempotency-key': crypto.randomUUID() } : {}),
        },
        data,
      });
      return { estado: r.status(), datos: (await r.json().catch(() => ({}))) as any };
    };
    const cuenta = async (rol: 'cliente' | 'repartidor', nombre: string) => {
      const correo = `bloque.${rol}.${idioma}.${id}@recorrido.test`;
      const r = await api.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.98.200.${++ip % 250}` },
        data: { nombre, correo, clave: `Bloque-${id}-Flex9`, rol },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const d = (await r.json()) as { token: string; usuario: { id: string } };
      sqlLocalTexto(
        `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
      );
      return { token: d.token, id: d.usuario.id, correo };
    };

    // ───── La empresa de EE. UU. con su centro en Novi y su conductor propio
    const dueno = await cuenta('cliente', L.dueno);
    const cond = await cuenta('repartidor', L.conductor);
    // La foto de control al conectarse no es parte de esta prueba: ya está tomada esta semana.
    sqlLocalTexto(
      `INSERT INTO selfies_control (id, usuario_id, pedida_en, tomada_en) VALUES ('sc-${id}', '${cond.id}', datetime('now'), datetime('now'))`,
    );
    const empresa = (
      await pedir('POST', `${B}/empresas`, dueno.token, {
        nombre: L.empresa,
        pais: 'US',
        moneda: 'USD',
      })
    ).datos.empresa as { id: string };
    const E = `${B}/empresas/${empresa.id}`;
    const centro = (
      await pedir('POST', `${E}/centros`, dueno.token, {
        nombre: L.centro.nombre,
        direccion: L.centro.direccion,
        pais: 'US',
        ciudad: L.centro.ciudad,
        ...CENTRO,
      })
    ).datos.centro as { id: string };
    expect(
      (
        await pedir('POST', `${E}/conductores`, dueno.token, {
          correo: cond.correo,
          vinculo: 'propio',
        })
      ).estado,
    ).toBeLessThan(300);
    const envios: string[] = [];
    for (const [i, p] of PARADAS.entries())
      envios.push(
        (
          await pedir('POST', `${E}/envios`, dueno.token, {
            centroId: centro.id,
            direccion: p.direccion,
            lat: p.lat,
            lng: p.lng,
            referenciaExterna: `ORD-${id}-${i + 1}`,
            destinatarioNombre: p.nombre,
            destinatarioTelefono: `+1248555017${i}`,
            paquetes: [{ descripcion: L.caja, pesoG: 1500 }],
          })
        ).datos.envio.id as string,
      );
    const ruta = (
      await pedir('POST', `${E}/rutas`, dueno.token, {
        nombre: L.ruta,
        centroId: centro.id,
        envioIds: envios,
      })
    ).datos.ruta as { id: string };

    // ───── Conectado a comida/envíos/viajes ANTES del bloque
    const conectar = (conectado: boolean) =>
      pedir('POST', '/datos/repartidor/conectar', cond.token, { conectado, ...CENTRO });
    expect((await conectar(true)).estado).toBe(200);

    // Un bloque fuera de 1 h 30 min a 5 horas no se acepta.
    const desde = new Date(Date.now() + 5 * 60_000);
    const corto = await pedir('POST', `${E}/rutas/${ruta.id}/asignar`, dueno.token, {
      conductorId: cond.id,
      bloqueDesde: iso(desde),
      bloqueHasta: iso(new Date(desde.getTime() + 45 * 60_000)),
    });
    expect(corto.estado).toBe(400);
    // El bloque de verdad: 3 h 30 min y 54 dólares de pago.
    const asignada = await pedir('POST', `${E}/rutas/${ruta.id}/asignar`, dueno.token, {
      conductorId: cond.id,
      bloqueDesde: iso(desde),
      bloqueHasta: iso(new Date(desde.getTime() + 210 * 60_000)),
      pagoBloque: 5400,
    });
    expect(asignada.estado, JSON.stringify(asignada.datos)).toBe(200);

    // ───── Exclusivo: al tomar el bloque se desconecta todo lo demás y no se puede volver a conectar
    const conectadoAhora = () =>
      Number(
        sqlLocal(`SELECT conectado FROM repartidores WHERE usuario_id = '${cond.id}'`)[0]
          ?.conectado,
      );
    expect(conectadoAhora()).toBe(0);
    const intento = await conectar(true);
    expect(intento.estado).toBe(409);
    expect(String(intento.datos.error)).toMatch(/Flex block/);

    // ───── La app del Driver, en el celular, en el centro de Novi
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
      timezoneId: idioma === 'en' ? 'America/Detroit' : 'America/New_York',
      geolocation: { latitude: CENTRO.lat, longitude: CENTRO.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [cond.token, cond.id, idioma],
    );
    const p = await ctx.newPage();
    const foto = async (nombre: string) => {
      if (process.env.CAPTURAS === '1')
        await p.screenshot({ path: `${SALIDA}/flex-bloque-${nombre}-${idioma}.png` });
    };
    const visible = (texto: string | RegExp) =>
      p.getByText(texto).filter({ visible: true }).first();
    const boton = (texto: string | RegExp) =>
      p.getByRole('button', { name: texto }).filter({ visible: true }).first();
    await p.goto('/driver/');

    // El inicio cambió entero al modo bloque: la banda lo dice y no hay botón de conectarse.
    const banda = p.getByTestId('banda-bloque');
    await expect(banda).toBeVisible({ timeout: 60_000 });
    await expect(banda).toContainText(T.modoBloqueAsignadoTitulo);
    await expect(banda).toContainText(T.modoBloqueAsignadoTexto);
    // C-SERVICIOS-CONECTADOS: sin el panel de servicios; abajo, los servicios con candado.
    await expect(p.getByTestId('estado-servicios')).toHaveCount(0);
    await expect(p.getByTestId('servicios-bloqueados')).toBeVisible();
    await abrirRuta(p, L.ruta);
    await expect(visible('$54.00')).toBeVisible();
    await expect(visible('3 h 30 min')).toBeVisible();
    await expect(p.getByTestId('aviso-exclusivo')).toBeVisible();
    await foto('oferta');

    // Acepta; llega al centro y carga los dos paquetes.
    await boton(T.aceptar).click();
    await expect(banda).toContainText(T.modoBloqueTitulo, { timeout: 20_000 });
    await expect(banda).toContainText(/\d h \d+ min/);
    await deslizar(p, T.deslizarLlegueCentro);
    const codigos = sqlLocal(
      `SELECT p.codigo_seguimiento AS c FROM ruta_paquetes rq JOIN paquetes p ON p.id = rq.paquete_id
      JOIN ruta_paradas rp ON rp.ruta_id = rq.ruta_id AND rp.envio_id = p.envio_id
      WHERE rq.ruta_id = '${ruta.id}' ORDER BY rp.orden`,
    ).map((f) => String(f.c));
    expect(codigos).toHaveLength(2);
    for (const c of codigos) {
      await p.getByPlaceholder(T.escribirCodigo).fill(c);
      await boton(T.cargar).click();
      await expect(visible(T.paqueteCargado)).toBeVisible({ timeout: 20_000 });
      await boton(T.volverRuta).click();
    }
    await foto('carga');
    await deslizar(p, T.deslizarSalir);
    await expect(visible(T.paradasCompletadas(0, 2))).toBeVisible({ timeout: 20_000 });
    await foto('ruta');

    // ───── Parada 1: «Cómo llegar» a la vista, escanear, estacionar, foto, dónde y deslizar
    await boton(T.paradaActual).click();
    await expect(boton(T.comoLlegar)).toBeVisible();
    await foto('parada');
    await ctx.setGeolocation({ latitude: PARADAS[0]!.lat, longitude: PARADAS[0]!.lng });
    await p.getByPlaceholder(T.escribirCodigo).fill(codigos[0]!);
    await boton(T.agregar).click();
    await expect(visible(T.escaneadosDe(1, 1))).toBeVisible({ timeout: 20_000 });
    await deslizar(p, T.deslizarLlegue);
    const [selector] = await Promise.all([
      p.waitForEvent('filechooser'),
      boton(T.tomarFoto).click(),
    ]);
    await selector.setFiles(FOTO);
    await expect(visible(T.fotoLista)).toBeVisible({ timeout: 20_000 });
    await visible(T.lugares.puerta).click();
    await deslizar(p, T.deslizarFinalizar);
    await expect(visible(T.entregaCompleta)).toBeVisible({ timeout: 30_000 });
    await foto('entregada');

    // ───── Parada 2: no se pudo entregar; se devuelve al remitente
    await boton(T.siguienteParada).click();
    await ctx.setGeolocation({ latitude: PARADAS[1]!.lat, longitude: PARADAS[1]!.lng });
    await p.getByPlaceholder(T.escribirCodigo).fill(codigos[1]!);
    await boton(T.agregar).click();
    await expect(visible(T.escaneadosDe(1, 1))).toBeVisible({ timeout: 20_000 });
    await deslizar(p, T.deslizarLlegue);
    await boton(T.registrarIncidenciaBoton).click();
    await visible(T.motivos.ausente!).click();
    await visible(T.acciones.devolver!).click();
    await p
      .getByRole('button', { name: T.registrarIncidencia, exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await expect(visible(T.estadosParada.fallida!)).toBeVisible({ timeout: 30_000 });
    await foto('no-entregada');
    await boton(T.volverRuta).click();
    await expect(visible(T.paradasCompletadas(2, 2))).toBeVisible({ timeout: 30_000 });

    // ───── Vuelve al centro, entrega la devolución y cierra el bloque
    await ctx.setGeolocation({ latitude: CENTRO.lat, longitude: CENTRO.lng });
    await boton(T.devolucion).click();
    await p.getByPlaceholder(T.escribirCodigo).fill(codigos[1]!);
    await boton(T.cargar).click();
    await expect(visible(T.devolucionRegistrada)).toBeVisible({ timeout: 30_000 });
    await boton(T.volverRuta).click();
    await expect(visible(T.entregadoCentro)).toBeVisible({ timeout: 30_000 });
    await foto('devolucion');
    await deslizar(p, T.deslizarCerrar);

    // El cierre: resumen, el pago del bloque y todo lo demás disponible otra vez.
    const cierre = p.getByTestId('bloque-terminado');
    await expect(cierre).toBeVisible({ timeout: 30_000 });
    await expect(cierre).toContainText('$54.00');
    await expect(cierre).toContainText(T.yaPuedesConectarte);
    await expect(banda).toHaveCount(0, { timeout: 20_000 });
    await foto('cierre');
    // El cierre con el pago se queda en pantalla (el estado se consulta cada 5 s): no salta solo al
    // inicio cuando el bloque ya terminó; sale cuando el conductor toca «Volver al inicio».
    await p.waitForTimeout(7_000);
    await expect(cierre).toBeVisible();
    await boton(T.volverInicio).click();
    await expect(p.getByTestId('estado-servicios')).toBeVisible({ timeout: 20_000 });
    expect((await conectar(true)).estado).toBe(200);
    expect(conectadoAhora()).toBe(1);
    await ctx.close();
    await ctxApi.close();
  });

/** Abre la ruta del bloque desde «Mis rutas» (el modo bloque ya llevó a esa pantalla). */
async function abrirRuta(p: Page, nombre: string) {
  const detalles = p
    .getByRole('button', { name: /Ver detalles|Continuar ruta|View details|Continue route/ })
    .first();
  if (await detalles.isVisible().catch(() => false)) await detalles.click();
  await expect(p.getByText(nombre).filter({ visible: true }).first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Desliza «Desliza para finalizar» de punta a punta, como con el dedo. */
async function deslizar(p: Page, texto: string) {
  const barra = p.getByLabel(texto).filter({ visible: true }).first();
  await barra.scrollIntoViewIfNeeded();
  const caja = (await barra.boundingBox())!;
  const y = caja.y + caja.height / 2;
  await p.mouse.move(caja.x + 30, y);
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(caja.x + 30 + ((caja.width - 40) * i) / 12, y);
  await p.mouse.up();
}

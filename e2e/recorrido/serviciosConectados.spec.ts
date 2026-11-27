import { deslizar, tocarPulgar } from './deslizar';
import { textosServicios } from '../../apps/repartidor/src/servicios/textos';
import { type Page, expect, test } from './fixtures';
import { sqlLocal, sqlLocalTexto } from './sqlLocal';

/**
 * C-SERVICIOS-CONECTADOS (Richard, 16 nov 2026; diseño en DRIVER.md de Gerencia) — todos los
 * países. El inicio del Driver con varios servicios conectados a la vez, en la app web real contra
 * el servidor local:
 *   tres servicios conectados (Comida, Envíos en moto y Moto con pasajero) y Carro para agregar →
 *   deslizar un poco no desconecta; deslizar hasta el final sí, con «Deshacer» → al llevar algo, los
 *   demás quedan en pausa → «Agregar este servicio» muestra lo ya verificado y lo que falta → el
 *   perfil en acordeón con la moto, sus papeles (aprobado, pendiente, rechazado con su motivo) y los
 *   documentos compartidos.
 * Con CAPTURAS=1 guarda las capturas de las guías de Docs (inglés y español).
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

const SALIDA = 'docs/capturas/recorrido';
// C-CAPTURAS-POR-IDIOMA: en inglés, nombre y placa de EE. UU. (Michigan); en español, datos neutros.
const PERSONA = {
  en: { nombre: 'Alex Turner', placa: '8KM-214', estado: 'MI' },
  es: { nombre: 'Carlos Rivera', placa: 'FLX-482', estado: 'FL' },
} as const;
const MIAMI = { lat: 25.7617, lng: -80.1918 };
const ZONA = 'US-FL-MIAMI';

/**
 * Lo que esta prueba enciende (Envíos, Moto y Carro en Miami) se devuelve como estaba al final,
 * pase lo que pase, para no ensuciar las pruebas siguientes (revisión del 18 nov).
 */
let antes: {
  servicios: Record<string, unknown>[];
  zona: Record<string, unknown>[];
  implementados: Record<string, unknown>[];
} | null = null;
// C-SERVICIO-SIN-OFERTA: Comida solo se ofrece donde hay un restaurante aprobado. Si esta prueba corre
// antes que las que crean uno en Miami, deja uno de ejemplo (cerrado) y lo borra al terminar.
const restaurantesTemporales: string[] = [];
test.beforeAll(() => {
  if (process.env.RECORRIDO_URL) return;
  const lista = "('envios', 'moto', 'carro')";
  antes = {
    servicios: sqlLocal(`SELECT id, estado FROM servicios WHERE id IN ${lista}`),
    zona: sqlLocal(
      `SELECT servicio_id, estado FROM servicios_zona WHERE zona_id = '${ZONA}' AND servicio_id IN ${lista}`,
    ),
    implementados: sqlLocal(
      `SELECT servicio_id FROM servicios_implementados WHERE servicio_id IN ${lista}`,
    ),
  };
});
test.afterAll(() => {
  for (const r of restaurantesTemporales)
    sqlLocalTexto(`DELETE FROM restaurantes WHERE id = '${r}'`);
  if (!antes) return;
  for (const s of antes.servicios)
    sqlLocalTexto(
      `UPDATE servicios SET estado = '${String(s.estado)}' WHERE id = '${String(s.id)}'`,
    );
  for (const z of antes.zona)
    sqlLocalTexto(
      `UPDATE servicios_zona SET estado = '${String(z.estado)}' WHERE servicio_id = '${String(z.servicio_id)}' AND zona_id = '${ZONA}'`,
    );
  const tenia = new Set(antes.implementados.map((x) => String(x.servicio_id)));
  for (const s of ['envios', 'moto', 'carro'])
    if (!tenia.has(s))
      sqlLocalTexto(`DELETE FROM servicios_implementados WHERE servicio_id = '${s}'`);
});

for (const idioma of ['es', 'en'] as const)
  test(`varios servicios conectados a la vez, deslizar para desconectar y perfil compartido (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(240_000);
    const t = textosServicios(idioma);
    const P = PERSONA[idioma];
    const id = Date.now().toString(36);
    let ip = 0;
    const cuenta = async (rol: 'cliente' | 'repartidor', nombre: string) => {
      const correo = `servicios.${rol}.${idioma}.${id}@recorrido.test`;
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.97.${Math.floor(++ip / 250)}.${ip % 250}` },
        data: { nombre, correo, clave: `Servicios-${id}-Driver9`, rol },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const d = (await r.json()) as { token: string; usuario: { id: string } };
      sqlLocalTexto(
        `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
      );
      return { token: d.token, id: d.usuario.id };
    };

    // ───── Un repartidor con identidad aprobada, una moto y Comida, Envíos y Moto aprobados
    const admin = await cuenta('cliente', 'Soporte Divoox');
    sqlLocalTexto(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
    if (
      !process.env.RECORRIDO_URL &&
      !sqlLocal(
        `SELECT 1 AS hay FROM restaurantes WHERE zona_id = '${ZONA}' AND estado = 'aprobado' LIMIT 1`,
      ).length
    ) {
      const r = `rest-servicios-${idioma}-${id}`;
      sqlLocalTexto(`INSERT INTO restaurantes (id, dueno_id, nombre, telefono, direccion, lat, lng, estado, abierto, zona_id)
        VALUES ('${r}', '${admin.id}', 'Restaurante de Ejemplo', '+13055550100', 'Dirección de ejemplo', ${MIAMI.lat}, ${MIAMI.lng}, 'aprobado', 0, '${ZONA}')`);
      restaurantesTemporales.push(r);
    }
    const cond = await cuenta('repartidor', P.nombre);
    const c = cond.id;
    const v = `veh-sc-${idioma}-${id}`;
    for (const s of ['envios', 'moto', 'carro']) {
      sqlLocalTexto(
        `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('${s}', 1)`,
      );
      sqlLocalTexto(`UPDATE servicios SET estado = 'disponible' WHERE id = '${s}'`);
      sqlLocalTexto(
        `UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = '${s}' AND zona_id = '${ZONA}'`,
      );
    }
    // C-RECORRIDO-NO-PISA: nadie más conectado en Miami recibe lo de esta prueba.
    sqlLocalTexto(
      `UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${ZONA}'`,
    );
    sqlLocalTexto(
      `INSERT INTO selfies_control (id, usuario_id, pedida_en, tomada_en) VALUES ('sc-${idioma}-${id}', '${c}', datetime('now'), datetime('now'))`,
    );
    sqlLocalTexto(`INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por, proxima_revision)
      VALUES ('${c}', 'aprobado', 'licencia', 'kyc/doc', 'kyc/selfie', datetime('now','-3 days'), datetime('now','-2 days'), '${admin.id}', date('now','+1 year'))`);
    sqlLocalTexto(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
      VALUES ('${v}', '${c}', 'moto', 'Honda', 'PCX 160', 'Blanco', '${P.placa}', '${P.estado}', 2024, 1, 'aprobado')`);
    for (const [tipo, estado, motivo] of [
      ['registro', 'aprobado', ''],
      ['seguro', 'aprobado', ''],
      ['seguro_pasajeros', 'aprobado', ''],
      ['foto_frente', 'pendiente', ''],
      [
        'foto_placa',
        'rechazado',
        idioma === 'en'
          ? 'The photo is blurry and the plate numbers can’t be read. Take it in daylight, straight on, one step away.'
          : 'La foto está borrosa y no se leen los números de la placa. Tómala de día, de frente y a un paso de distancia.',
      ],
    ] as const)
      sqlLocalTexto(
        `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, motivo, vence_en) VALUES ('doc-${tipo}-${idioma}-${id}', '${v}', '${tipo}', 'doc', '${estado}', '${motivo.replace(/'/g, "''")}', ${estado === 'aprobado' ? "datetime('now','+1 year')" : 'NULL'})`,
      );
    sqlLocalTexto(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id, vehiculo_activo_id)
      VALUES ('${c}', 0, ${MIAMI.lat}, ${MIAMI.lng}, datetime('now'), '${ZONA}', '${v}')
      ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id, vehiculo_activo_id = excluded.vehiculo_activo_id`);
    // Lo que piden Comida, Envíos y Moto, cumplido y revisado por el equipo.
    sqlLocalTexto(`INSERT OR IGNORE INTO cumplimientos (conductor_id, vehiculo_id, requisito, estado, fuente, aprobado_por, vence_en)
      SELECT '${c}', CASE rd.nivel WHEN 'vehiculo' THEN '${v}' ELSE '' END, r.requisito, 'aprobado',
             CASE r.requisito WHEN 'identidad' THEN 'kyc' ELSE 'revision_manual' END, '${admin.id}', datetime('now','+1 year')
        FROM (SELECT requisito FROM servicio_requisitos WHERE servicio_id IN ('comida','envios','moto')
              UNION SELECT requisito FROM servicio_vehiculo_requisitos WHERE servicio_id IN ('comida','envios','moto') AND vehiculo_tipo = 'moto') r
        JOIN requisitos_def rd ON rd.requisito = r.requisito`);
    for (const s of ['envios', 'moto'])
      sqlLocalTexto(
        `INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES ('${c}', '${s}', 'aprobada', '${admin.id}', datetime('now'))`,
      );
    for (const s of ['comida', 'envios', 'moto'])
      sqlLocalTexto(
        `INSERT OR REPLACE INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES ('${c}', '${s}', 1)`,
      );
    const conectar = await request.post('/datos/repartidor/conectar', {
      headers: { authorization: `Bearer ${cond.token}` },
      data: { conectado: true, ...MIAMI },
    });
    expect(conectar.ok(), await conectar.text()).toBe(true);
    const panel = async () =>
      (await (
        await request.get('/datos/conductor/panel-servicios', {
          headers: { authorization: `Bearer ${cond.token}`, 'x-idioma': idioma },
        })
      ).json()) as { conectados: number; servicios: { servicioId: string; estado: string }[] };
    const estados = await panel();
    expect(estados.conectados, JSON.stringify(estados)).toBe(3);
    expect(estados.servicios.find((s) => s.servicioId === 'carro')?.estado).toBe('agregar');

    // ───── La app del Driver en el celular
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
      timezoneId: idioma === 'en' ? 'America/Detroit' : 'America/New_York',
      geolocation: { latitude: MIAMI.lat, longitude: MIAMI.lng },
      permissions: ['geolocation'],
    });
    await ctx.addInitScript(
      ([pase, u, i]) => {
        localStorage.setItem('tumbite.idioma', i);
        localStorage.setItem('tumbite.sesion', pase);
        localStorage.setItem(`divoox.permisos.${u}`, '1');
      },
      [cond.token, c, idioma],
    );
    const p = await ctx.newPage();
    const foto = async (nombre: string, completa = false) => {
      if (process.env.CAPTURAS === '1')
        await p.screenshot({
          path: `${SALIDA}/servicios-${nombre}-${idioma}.png`,
          fullPage: completa,
        });
    };
    await p.goto('/driver/');

    // Estado 1: la tarjeta tinta con el radar y los tres conectados en verde.
    const estado = p.getByTestId('estado-servicios');
    await expect(estado).toContainText(t.conectadoA(3), { timeout: 60_000 });
    await expect(estado).toContainText(t.esperando);
    for (const s of ['comida', 'envios', 'moto'])
      await expect(p.getByTestId(`servicio-${s}`)).toBeVisible();
    await expect(p.getByTestId('servicio-carro')).toContainText(t.agregar);
    await expect(p.getByText(t.pista)).toBeVisible();
    await p.waitForTimeout(700);
    await foto('conectados');

    // Deslizar un poco (menos del 85 %) no desconecta: la tarjeta vuelve sola.
    const pulgar = p.getByTestId('servicio-comida-pulgar');
    const tarjeta = p.getByTestId('servicio-comida');
    const caja = (await tarjeta.boundingBox())!;
    const inicio = (await pulgar.boundingBox())!;
    const y = inicio.y + inicio.height / 2;
    const x0 = inicio.x + inicio.width / 2;
    const recorrido = caja.width - inicio.width - 12;
    await p.mouse.move(x0, y);
    await p.mouse.down();
    for (let i = 1; i <= 10; i++) await p.mouse.move(x0 + (recorrido * 0.55 * i) / 10, y);
    await expect(tarjeta).toContainText(t.soltar);
    await foto('deslizando');
    await p.mouse.up();
    await p.waitForTimeout(600);
    expect((await panel()).conectados).toBe(3);
    await expect(tarjeta).toContainText(t.esperandoDe.comida!);

    // Deslizar hasta el final sí desconecta Comida; lo demás sigue conectado y sale el aviso.
    await p.mouse.move(x0, y);
    await p.mouse.down();
    for (let i = 1; i <= 14; i++) await p.mouse.move(x0 + (recorrido * i) / 12, y);
    await p.mouse.up();
    const aviso = p.getByTestId('aviso-deshacer');
    await expect(aviso).toBeVisible({ timeout: 20_000 });
    await expect(aviso).toContainText(t.avisoTitulo(idioma === 'en' ? 'Food' : 'Comida', 'comida'));
    await expect(estado).toContainText(t.conectadoA(2), { timeout: 20_000 });
    // C-CONECTAR-DESLIZANDO: la tarjeta desconectada se conecta deslizando, nunca con un toque.
    await expect(tarjeta).toContainText(t.deslizarConectar);
    await foto('deshacer');
    // C-CONECTAR-DESLIZANDO (revisor): el aviso solo informa; ningún toque reconecta.
    await expect(aviso).toContainText(t.avisoVolver);
    await expect(p.getByTestId('aviso-deshacer-boton')).toHaveCount(0);
    await aviso.click();
    await p.waitForTimeout(800);
    expect((await panel()).conectados).toBe(2);
    await deslizar(p, 'servicio-comida');
    await expect(estado).toContainText(t.conectadoA(3), { timeout: 20_000 });
    expect((await panel()).conectados).toBe(3);
    // Otra vez fuera: un toque no la conecta, soltar a medio camino tampoco; deslizar entero, sí.
    await deslizar(p, 'servicio-comida');
    await expect(estado).toContainText(t.conectadoA(2), { timeout: 20_000 });
    await expect(tarjeta).toContainText(t.deslizarConectar);
    await tocarPulgar(p, 'servicio-comida');
    await p.waitForTimeout(800);
    expect((await panel()).conectados).toBe(2);
    await deslizar(p, 'servicio-comida', 0.5);
    await p.waitForTimeout(800);
    expect((await panel()).conectados).toBe(2);
    await deslizar(p, 'servicio-comida');
    await expect(estado).toContainText(t.conectadoA(3), { timeout: 20_000 });
    expect((await panel()).conectados).toBe(3);

    // Estado 2: lleva una comida. Lo demás queda en pausa (sin desconectarse) y vuelve solo.
    sqlLocalTexto(
      `INSERT INTO conductor_ocupacion (conductor_id, tipo, pedidos) VALUES ('${c}', 'comida', 1)`,
    );
    await expect(p.getByTestId('aviso-llevando')).toContainText(t.llevando.comida!, {
      timeout: 20_000,
    });
    await expect(p.getByTestId('franja-pausa')).toContainText(t.hastaEntregar.comida!);
    await p.waitForTimeout(500);
    await foto('en-pausa');
    sqlLocalTexto(`DELETE FROM conductor_ocupacion WHERE conductor_id = '${c}'`);
    await expect(estado).toContainText(t.conectadoA(3), { timeout: 20_000 });

    // Agregar Carro con pasajero: lo ya verificado en verde y solo lo que falta para el carro.
    await p.getByTestId('servicio-carro').click();
    const agregar = p.getByTestId('agregar-servicio');
    await expect(agregar).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('ya-verificado')).toContainText(t.yaVerificado);
    await expect(p.getByTestId('ya-verificado')).toContainText(t.verificado);
    await expect(p.getByTestId('falta-servicio')).toBeVisible();
    await p.waitForTimeout(400);
    await foto('agregar');
    await fotoDesde(p, 'falta-servicio', `${SALIDA}/servicios-agregar-falta-${idioma}.png`);
    await p.getByRole('button', { name: /^(Empezar|Start)/ }).click();
    await expect(p.getByRole('button', { name: t.volver })).toBeVisible({ timeout: 20_000 });
    // C-AGREGA-TU-VEHICULO: el paso abre «Agrega tu vehículo» (tipo, datos y fotos en el mismo flujo).
    await expect(p.getByTestId('agregar-vehiculo')).toBeVisible({ timeout: 20_000 });
    await p.waitForTimeout(300);
    await foto('agregar-paso');
    // «Agrega tu vehículo» también tiene su «Atrás»: la flecha de arriba es la primera.
    await p.getByRole('button', { name: t.volver }).first().click();
    await p.getByRole('button', { name: t.volver }).first().click();
    await expect(estado).toBeVisible({ timeout: 20_000 });

    // Perfil en acordeón: Mi vehículo → Mi moto con sus papeles; Documentos compartidos.
    await p.getByTestId('pestana-cuenta').click();
    await p.getByTestId('cuenta-vehiculo').click();
    await expect(p.getByTestId('perfil-acordeon')).toBeVisible({ timeout: 20_000 });
    await p.getByTestId('seccion-vehiculo').click();
    await p.getByTestId('vehiculo-moto').getByRole('button').first().click();
    await expect(p.getByTestId('vehiculo-moto')).toContainText(t.estados.rechazado!);
    await expect(p.getByTestId('vehiculo-moto')).toContainText(t.estados.pendiente!);
    await expect(p.getByTestId('vehiculo-moto')).toContainText(t.tomarFoto);
    await expect(p.getByTestId('vehiculo-moto')).toContainText(t.subirArchivo);
    await p.waitForTimeout(400);
    await fotoDesde(p, 'perfil-acordeon', `${SALIDA}/servicios-perfil-vehiculo-${idioma}.png`);
    await expect(p.getByTestId('papel-foto_placa')).toContainText(t.motivo);
    await fotoDesde(p, 'papel-foto_placa', `${SALIDA}/servicios-perfil-rechazado-${idioma}.png`);
    await p.getByTestId('seccion-documentos').click();
    await expect(p.getByTestId('perfil-acordeon')).toContainText(t.docsAyuda);
    await expect(p.getByTestId('perfil-acordeon')).toContainText(t.estados.aprobado!);
    await p.waitForTimeout(400);
    await fotoDesde(p, 'perfil-acordeon', `${SALIDA}/servicios-perfil-documentos-${idioma}.png`);
    // La moto sigue sin ningún botón de borrar a la vista: solo dentro de los tres puntos.
    expect(sqlLocal(`SELECT estado FROM vehiculos WHERE id = '${v}'`)[0]?.estado).toBe('aprobado');

    // Que no quede nadie conectado para las pruebas que siguen.
    await request.post('/datos/repartidor/conectar', {
      headers: { authorization: `Bearer ${cond.token}` },
      data: { conectado: false },
    });
    await ctx.close();
  });

/** Captura desde la parte de arriba de un bloque (la cabecera del perfil), a lo alto del celular. */
async function fotoDesde(p: Page, testId: string, ruta: string) {
  if (process.env.CAPTURAS !== '1') return;
  await p.getByTestId(testId).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(300);
  await p.screenshot({ path: ruta });
}

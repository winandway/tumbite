import { textosServicios } from '../../apps/repartidor/src/servicios/textos';
import { deslizar, tocarPulgar } from './deslizar';
import { expect, test } from './fixtures';
import { sqlLocal, sqlLocalTexto } from './sqlLocal';

/**
 * C-CONECTAR-DESLIZANDO (Richard, 18 nov 2026; todos los países). En Driver, conectarse es deslizar
 * de izquierda a derecha, nunca un toque: un toque simple NO conecta, soltar a medio camino NO
 * conecta, deslizar completo SÍ (y queda «Conectado» en verde). Cada servicio también se conecta
 * deslizando, con el mismo dibujo que el cliente (la moto es una moto). Guarda capturas en
 * CARPETA_DESLIZAR si viene (para mostrárselas a Richard) y en docs/capturas/recorrido con CAPTURAS=1.
 */
test.skip(Boolean(process.env.RECORRIDO_URL), 'solo en esta computadora');

const ZONA = 'US-FL-MIAMI';
const MIAMI = { lat: 25.7617, lng: -80.1918 };
const PERSONA = {
  en: { nombre: 'Alex Turner', placa: '8KM-215', estado: 'MI' },
  es: { nombre: 'Carlos Rivera', placa: 'FLX-483', estado: 'FL' },
} as const;

let antes: { servicios: Record<string, unknown>[]; zona: Record<string, unknown>[] } | null = null;
test.beforeAll(() => {
  if (process.env.RECORRIDO_URL) return;
  antes = {
    servicios: sqlLocal("SELECT id, estado FROM servicios WHERE id IN ('envios', 'moto')"),
    zona: sqlLocal(
      `SELECT servicio_id, estado FROM servicios_zona WHERE zona_id = '${ZONA}' AND servicio_id IN ('envios', 'moto')`,
    ),
  };
});
test.afterAll(() => {
  if (!antes) return;
  for (const s of antes.servicios)
    sqlLocalTexto(
      `UPDATE servicios SET estado = '${String(s.estado)}' WHERE id = '${String(s.id)}'`,
    );
  for (const z of antes.zona)
    sqlLocalTexto(
      `UPDATE servicios_zona SET estado = '${String(z.estado)}' WHERE servicio_id = '${String(z.servicio_id)}' AND zona_id = '${ZONA}'`,
    );
});

for (const idioma of ['es', 'en'] as const)
  test(`conectarse deslizando: un toque y medio camino no conectan; entero, sí (${idioma})`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(180_000);
    const t = textosServicios(idioma);
    const P = PERSONA[idioma];
    const id = Date.now().toString(36);
    let ip = 0;
    const cuenta = async (rol: 'cliente' | 'repartidor', nombre: string) => {
      const correo = `deslizar.${rol}.${idioma}.${id}@recorrido.test`;
      const r = await request.post('/datos/cuentas/registro', {
        headers: { 'cf-connecting-ip': `10.96.${Math.floor(++ip / 250)}.${ip % 250}` },
        data: { nombre, correo, clave: `Deslizar-${id}-Driver9`, rol },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const d = (await r.json()) as { token: string; usuario: { id: string } };
      sqlLocalTexto(
        `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
      );
      return { token: d.token, id: d.usuario.id };
    };
    const admin = await cuenta('cliente', 'Soporte Divoox');
    sqlLocalTexto(`UPDATE usuarios SET rol = 'admin' WHERE id = '${admin.id}'`);
    const cond = await cuenta('repartidor', P.nombre);
    const c = cond.id;
    const v = `veh-dz-${idioma}-${id}`;
    for (const s of ['envios', 'moto']) {
      sqlLocalTexto(
        `INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('${s}', 1)`,
      );
      sqlLocalTexto(`UPDATE servicios SET estado = 'disponible' WHERE id = '${s}'`);
      sqlLocalTexto(
        `UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = '${s}' AND zona_id = '${ZONA}'`,
      );
    }
    sqlLocalTexto(
      `UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = '${ZONA}'`,
    );
    sqlLocalTexto(
      `INSERT INTO selfies_control (id, usuario_id, pedida_en, tomada_en) VALUES ('dz-${idioma}-${id}', '${c}', datetime('now'), datetime('now'))`,
    );
    sqlLocalTexto(`INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en, revisado_por, proxima_revision)
      VALUES ('${c}', 'aprobado', 'licencia', 'kyc/doc', 'kyc/selfie', datetime('now','-3 days'), datetime('now','-2 days'), '${admin.id}', date('now','+1 year'))`);
    sqlLocalTexto(`INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado)
      VALUES ('${v}', '${c}', 'moto', 'Honda', 'PCX 160', 'Blanco', '${P.placa}', '${P.estado}', 2024, 1, 'aprobado')`);
    for (const tipo of ['registro', 'seguro', 'seguro_pasajeros'])
      sqlLocalTexto(
        `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES ('dz-${tipo}-${idioma}-${id}', '${v}', '${tipo}', 'doc', 'aprobado', datetime('now','+1 year'))`,
      );
    sqlLocalTexto(`INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id, vehiculo_activo_id)
      VALUES ('${c}', 0, ${MIAMI.lat}, ${MIAMI.lng}, datetime('now'), '${ZONA}', '${v}')
      ON CONFLICT(usuario_id) DO UPDATE SET conectado = 0, zona_id = excluded.zona_id, vehiculo_activo_id = excluded.vehiculo_activo_id`);
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
    const conectado = async () =>
      (
        (await (
          await request.get('/datos/repartidor/estado', {
            headers: { authorization: `Bearer ${cond.token}` },
          })
        ).json()) as { conectado: boolean }
      ).conectado;

    const ctx = await browser.newContext({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 3,
      locale: idioma === 'en' ? 'en-US' : 'es-US',
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
    const carpeta = process.env.CARPETA_DESLIZAR;
    const foto = async (nombre: string, completa = false) => {
      if (carpeta)
        await p.screenshot({ path: `${carpeta}/${nombre}-${idioma}.png`, fullPage: completa });
      if (process.env.CAPTURAS === '1')
        await p.screenshot({ path: `docs/capturas/recorrido/conectar-${nombre}-${idioma}.png` });
    };
    await p.goto('/driver/');
    const deslizador = p.getByTestId('conectarme');
    await expect(deslizador).toContainText(t.deslizarConectarme, { timeout: 60_000 });
    // La moto lleva el dibujo de moto del cliente y la tarjeta se conecta deslizando.
    await expect(p.getByTestId('servicio-moto')).toContainText(t.deslizarConectar);
    await p.waitForTimeout(600);
    await foto('desconectado', true);

    // Un toque simple NO conecta.
    await tocarPulgar(p, 'conectarme');
    await p.waitForTimeout(1500);
    expect(await conectado()).toBe(false);
    // Soltar a medio camino NO conecta (y se ve a medio deslizar).
    const caja = (await deslizador.boundingBox())!;
    const pulgar = (await p.getByTestId('conectarme-pulgar').boundingBox())!;
    const y = pulgar.y + pulgar.height / 2;
    const x0 = pulgar.x + pulgar.width / 2;
    await p.mouse.move(x0, y);
    await p.mouse.down();
    for (let i = 1; i <= 10; i++)
      await p.mouse.move(x0 + ((caja.width - pulgar.width) * 0.5 * i) / 10, y);
    await foto('a-medio-deslizar');
    await p.mouse.up();
    await p.waitForTimeout(1500);
    expect(await conectado()).toBe(false);
    // Revisor (18 nov 2026): si el servidor falla, el círculo vuelve al inicio, se ve el mensaje y
    // sigue desconectado.
    const ERROR = idioma === 'en' ? 'Server down for a moment.' : 'El servidor no respondió.';
    let pedidos = 0;
    await p.route('**/datos/repartidor/conectar', async (r) => {
      if (r.request().method() !== 'POST') return r.continue();
      pedidos++;
      await r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: ERROR }),
      });
    });
    await deslizar(p, 'conectarme');
    await expect(p.getByText(ERROR)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => (await p.getByTestId('conectarme-pulgar').boundingBox())!.x)
      .toBeLessThan(pulgar.x + 4);
    expect(await conectado()).toBe(false);
    expect(pedidos).toBe(1);
    await p.unroute('**/datos/repartidor/conectar');
    // Dos deslizamientos seguidos mientras espera la red mandan UNA sola petición.
    pedidos = 0;
    await p.route('**/datos/repartidor/conectar', async (r) => {
      if (r.request().method() === 'POST') {
        pedidos++;
        await new Promise((listo) => setTimeout(listo, 2500));
      }
      await r.continue();
    });
    // Deslizar completo SÍ: queda conectado (en verde).
    await deslizar(p, 'conectarme');
    await deslizar(p, 'conectarme').catch(() => undefined);
    await expect(p.getByTestId('estado-servicios')).toContainText(/Online for|Conectado a/, {
      timeout: 30_000,
    });
    expect(await conectado()).toBe(true);
    expect(pedidos).toBe(1);
    await p.unroute('**/datos/repartidor/conectar');
    await p.waitForTimeout(600);
    await foto('conectado');
    // Y desconectarse también se desliza.
    await deslizar(p, 'desconectarme');
    await expect(deslizador).toBeVisible({ timeout: 30_000 });
    expect(await conectado()).toBe(false);
    await ctx.close();
  });

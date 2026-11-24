import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { medidorDeLecturas, sembrarVolumen } from '../pruebas/lecturas';
import { usarTransporteCorreo } from '../correo';
import { avisarVerificacionLista, telefonosDelEquipo } from '../avisoVerificacion';

/**
 * C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard) — todos los países. «Que suene cuando llegue una
 * persona completa para hacer ya el KYC, y que yo no tenga que estar actualizando… y en mi teléfono
 * que me llegue un correo cuando haya un KYC listo».
 *
 * - La marca: una lectura barata «¿cambió algo?» que el panel pide cada pocos segundos; mirar no escribe.
 * - El correo al equipo: UNO por persona cuando queda lista para revisar, con su nombre, su ciudad y el
 *   enlace a su ficha; el resultado del envío queda anotado (antes, si fallaba, no quedaba rastro).
 * - El silencio y el aviso al teléfono se guardan por cuenta en el servidor.
 */
type Correo = { para: string; asunto: string; texto: string };

async function armar() {
  const correos: Correo[] = [];
  usarTransporteCorreo(
    async (_url, init) => {
      const c = JSON.parse(String(init?.body)) as {
        to: { address: string }[];
        subject: string;
        text: string;
      };
      // Solo los avisos de verificación (las cuentas nuevas también reciben su confirmación).
      if (c.subject.startsWith('Verificación lista'))
        correos.push({ para: c.to[0]?.address ?? '', asunto: c.subject, texto: c.text });
      return new Response(JSON.stringify({ success: true, message_id: 'm1' }), { status: 200 });
    },
    { omitirDePrueba: false },
  );
  const env = {
    YAD_TOKEN: 'x'.repeat(40),
    ADMIN_CORREOS: 'equipo@ejemplo.com',
    SITIO_URL: 'https://panel.ejemplo.com',
  };
  const m = mundo(env);
  const admin = await m.cuenta('admin');
  const ana = await m.cuenta('repartidor', 'Ana Conductora');
  const beto = await m.cuenta('repartidor', 'Beto Conductor');
  // Ana ya dijo su ciudad; Beto todavía no.
  await m.DB.prepare(
    `INSERT INTO repartidores (usuario_id, zona_id, ciudad_elegida_en) VALUES (?, 'US-FL-MIAMI', datetime('now'))
     ON CONFLICT(usuario_id) DO UPDATE SET zona_id = 'US-FL-MIAMI', ciudad_elegida_en = datetime('now')`,
  )
    .bind(ana.id)
    .run();
  const listo = (id: string) =>
    m.DB.prepare(
      `INSERT INTO kyc (usuario_id, estado, enviado_en) VALUES (?, 'pendiente', datetime('now'))
       ON CONFLICT(usuario_id) DO UPDATE SET estado = 'pendiente', enviado_en = datetime('now')`,
    )
      .bind(id)
      .run();
  const envCompleto = { DB: m.DB, ...env } as never;
  return { m, admin, ana, beto, listo, correos, envCompleto };
}

const cambios = async (db: D1Database) =>
  (await db.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0;

describe('C-VERIFICACIONES-EN-VIVO · la marca barata del panel', () => {
  afterEach(() => usarTransporteCorreo(null));

  it('cambia cuando alguien queda listo para revisar, y dice cuántas esperan', async () => {
    const e = await armar();
    const marca = async () =>
      (await e.m.llamar('GET', '/datos/admin/kyc/marca', undefined, e.admin.token)).datos as {
        firma: string;
        pendientes: number;
        ultimaEnviada: string | null;
      };
    const antes = await marca();
    expect(antes.pendientes).toBe(0);
    await e.listo(e.ana.id);
    const despues = await marca();
    expect(despues.pendientes).toBe(1);
    expect(despues.ultimaEnviada).toBeTruthy();
    expect(despues.firma).not.toBe(antes.firma);
    // Sin cambios, la misma firma (el panel no vuelve a traer la lista).
    expect((await marca()).firma).toBe(despues.firma);
  });

  it('solo el equipo la lee, y mirarla no escribe nada', async () => {
    const e = await armar();
    expect((await e.m.llamar('GET', '/datos/admin/kyc/marca', undefined, e.ana.token)).estado).toBe(
      403,
    );
    await e.m.sesionLista(e.admin.token);
    const c0 = await cambios(e.m.DB);
    await e.m.llamar('GET', '/datos/admin/kyc/marca', undefined, e.admin.token);
    await e.m.llamar('GET', '/datos/admin/kyc/marca', undefined, e.admin.token);
    expect(await cambios(e.m.DB)).toBe(c0);
  });
});

describe('C-VERIFICACIONES-EN-VIVO · el correo al equipo', () => {
  afterEach(() => usarTransporteCorreo(null));

  it('UNO por persona: con su nombre, su ciudad y el enlace a su ficha; repetirlo no manda otro', async () => {
    const e = await armar();
    await e.listo(e.ana.id);
    await avisarVerificacionLista(e.envCompleto, e.ana.id);
    await avisarVerificacionLista(e.envCompleto, e.ana.id);
    expect(e.correos).toHaveLength(1);
    const c = e.correos[0];
    expect(c?.para).toBe('equipo@ejemplo.com');
    expect(c?.asunto).toContain('Ana Conductora');
    expect(c?.texto).toContain('Miami');
    expect(c?.texto).toContain(`https://panel.ejemplo.com/panel/verifications/${e.ana.id}`);
    // Queda anotado si salió (antes un fallo no dejaba rastro).
    const f = await e.m.DB.prepare(
      'SELECT ok, destinos FROM avisos_verificacion WHERE usuario_id = ?',
    )
      .bind(e.ana.id)
      .first<{ ok: number; destinos: number }>();
    expect(f).toEqual({ ok: 1, destinos: 1 });
  });

  it('si llegan varias seguidas, cada correo dice cuántas más esperan', async () => {
    const e = await armar();
    await e.listo(e.ana.id);
    await avisarVerificacionLista(e.envCompleto, e.ana.id);
    await e.listo(e.beto.id);
    await avisarVerificacionLista(e.envCompleto, e.beto.id);
    expect(e.correos).toHaveLength(2);
    expect(e.correos[1]?.texto).toMatch(/2 verificaciones esperan/);
  });

  it('si el correo no sale, queda anotado con el motivo (nunca en silencio)', async () => {
    const e = await armar();
    usarTransporteCorreo(
      async () =>
        new Response(JSON.stringify({ success: false, error: 'cupo agotado' }), { status: 429 }),
      { omitirDePrueba: false },
    );
    await e.listo(e.ana.id);
    await avisarVerificacionLista(e.envCompleto, e.ana.id);
    const f = await e.m.DB.prepare(
      'SELECT ok, motivo FROM avisos_verificacion WHERE usuario_id = ?',
    )
      .bind(e.ana.id)
      .first<{ ok: number; motivo: string }>();
    expect(f?.ok).toBe(0);
    expect(f?.motivo).toContain('cupo agotado');
  });

  it('el aviso al teléfono es por cuenta: solo a quien lo encendió', async () => {
    const e = await armar();
    expect(await telefonosDelEquipo(e.m.DB)).toEqual([]);
    const r = await e.m.llamar(
      'PUT',
      '/datos/admin/preferencias/avisos',
      { valor: { aparato: 'si', sonido: 'no' } },
      e.admin.token,
    );
    expect(r.estado).toBe(200);
    expect(await telefonosDelEquipo(e.m.DB)).toEqual([e.admin.id]);
    // El silencio también queda guardado en el servidor, para esa cuenta.
    const g = await e.m.llamar('GET', '/datos/admin/preferencias/avisos', undefined, e.admin.token);
    expect(g.datos.valor).toEqual({ aparato: 'si', sonido: 'no' });
  });
});

describe('C-VERIFICACIONES-EN-VIVO · lo que lee el panel abierto', () => {
  it('con el volumen de un sitio con uso, la marca lee poquísimo (se pide cada 5 s)', async () => {
    let medidor!: ReturnType<typeof medidorDeLecturas>;
    const m = mundo({}, { envolver: (db) => (medidor = medidorDeLecturas(db)).db });
    await sembrarVolumen(m.DB);
    const admin = await m.cuenta('admin');
    await m.sesionLista(admin.token);
    await m.llamar('GET', '/datos/admin/kyc/marca', undefined, admin.token);
    const marca = await medidor.medir(() =>
      m.llamar('GET', '/datos/admin/kyc/marca', undefined, admin.token),
    );
    const cabecera = await medidor.medir(() =>
      m.llamar('GET', '/datos/panel/avisos', undefined, admin.token),
    );
    console.warn(
      `lecturas: marca ${marca.total} filas · cabecera (campana y menú) ${cabecera.total} filas`,
    );
    // Por minuto con el panel abierto y alguien trabajando: 12 marcas + 2 cabeceras.
    console.warn(`lecturas por minuto: ${12 * marca.total + 2 * cabecera.total}`);
    for (const l of [...marca.lecturas, ...cabecera.lecturas].filter((x) => x.filas > 20))
      console.warn(
        `  ${l.filas} (${l.escaneos.join(', ')}): ${l.sql.replace(/\s+/g, ' ').slice(0, 160)}`,
      );
    expect(marca.resultado.estado).toBe(200);
    expect(marca.total).toBeLessThanOrEqual(40);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { usarTransporteCorreo } from './correo';
import { mundo } from './pruebas/ayuda';

/**
 * C-INVITAR-LIDER-UN-PASO (21 nov 2026): crear la línea de un líder sin cuenta lo invita en el mismo
 * paso; si se escribió su correo, le llega en ese momento un correo con su enlace personal; el enlace
 * abre la página de su invitación (línea, ciudad y el correo con que crea la cuenta) y la línea se une
 * sola al registrarse con ese correo.
 */
const VIGIA = 'VE-MER-ELVIGIA';
afterEach(() => {
  vi.unstubAllGlobals();
  usarTransporteCorreo(null);
});

async function escenario() {
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
  const enviados: { para: string; asunto: string; texto: string }[] = [];
  usarTransporteCorreo(async (_e, init) => {
    const c = JSON.parse(String(init.body)) as {
      to: { address: string }[];
      subject: string;
      text: string;
    };
    enviados.push({ para: c.to[0]!.address, asunto: c.subject, texto: c.text });
    return new Response('{"success":true,"message_id":"m1"}', { status: 200 });
  });
  const m = mundo({ YAD_TOKEN: 'x'.repeat(40) }, { host: 'staging.tumbite.com' });
  // La primera petición migra la base (las columnas nuevas de zonas llegan ahí).
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  await m.DB.prepare(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa, idioma)
     VALUES (?, 'Ciudad de ejemplo', 'VE', 'USD', 'America/Caracas', 8.6219, -71.6506, 15, 1, 'es')`,
  )
    .bind(VIGIA)
    .run();
  const crear = (lider: string) =>
    m.llamar(
      'POST',
      '/datos/admin/lineas',
      {
        nombre: 'Línea Ejemplo',
        zonaId: VIGIA,
        tipo: 'mototaxi',
        lider,
        contacto2Nombre: 'Contacto Dos',
        contacto2Telefono: '+584120000002',
      },
      admin.token,
    );
  return { m, admin, crear, enviados };
}

describe('C-INVITAR-LIDER-UN-PASO', () => {
  it('por correo: un solo paso, le llega el correo con su enlace personal y la página dice su línea', async () => {
    const { m, crear, enviados } = await escenario();
    const r = await crear('lider.ejemplo@ejemplo.com');
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    expect(r.datos.invitacion.correoEnviado).toBe(true);
    const enlace = String(r.datos.invitacion.enlace);
    expect(enlace).toMatch(/\/driver\/lead\/[\w-]{32}$/);
    const correo = enviados.find((x) => x.para === 'lider.ejemplo@ejemplo.com');
    expect(correo?.asunto).toContain('Línea Ejemplo');
    expect(correo?.texto).toContain(enlace);
    // La página del enlace (sin sesión) dice la línea, la ciudad y el correo para crear la cuenta.
    const token = enlace.split('/').pop();
    const p = await m.llamar('GET', `/datos/lineas/invitacion/${token}`);
    expect(p.estado).toBe(200);
    expect(p.datos.invitacion).toMatchObject({
      linea: 'Línea Ejemplo',
      ciudad: 'Ciudad de ejemplo',
      correo: 'lider.ejemplo@ejemplo.com',
      idioma: 'es',
    });
    // Un enlace inventado no dice nada.
    expect(
      (await m.llamar('GET', '/datos/lineas/invitacion/inventado-0000000000000000')).estado,
    ).toBe(404);
  });

  it('se registra con ese correo: la línea se une sola y el enlace deja de valer', async () => {
    const { m, crear } = await escenario();
    const r = await crear('lider.ejemplo@ejemplo.com');
    const token = String(r.datos.invitacion.enlace).split('/').pop();
    const reg = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Líder Ejemplo',
      correo: 'lider.ejemplo@ejemplo.com',
      clave: 'clave-segura-1',
      rol: 'repartidor',
    });
    expect(reg.estado).toBe(201);
    const linea = await m.DB.prepare('SELECT e.nombre FROM equipos e WHERE e.lider_id = ?')
      .bind(reg.datos.usuario.id)
      .first<{ nombre: string }>();
    expect(linea?.nombre).toBe('Línea Ejemplo');
    expect((await m.llamar('GET', `/datos/lineas/invitacion/${token}`)).estado).toBe(404);
  });

  it('el equipo le vuelve a mandar el correo; sin correo (solo celular) lo dice', async () => {
    const { m, admin, crear, enviados } = await escenario();
    const r = await crear('lider.ejemplo@ejemplo.com');
    const antes = enviados.length;
    const re = await m.llamar(
      'POST',
      `/datos/admin/lineas-invitaciones/${r.datos.invitacion.id}/reenviar`,
      {},
      admin.token,
    );
    expect(re.estado).toBe(200);
    expect(enviados.length).toBe(antes + 1);
    const tel = await crear('+584240000001');
    expect(tel.datos.invitacion.correoEnviado).toBe(false);
    const sin = await m.llamar(
      'POST',
      `/datos/admin/lineas-invitaciones/${tel.datos.invitacion.id}/reenviar`,
      {},
      admin.token,
    );
    expect(sin.estado).toBe(409);
    // La lista del panel trae el enlace personal de cada invitación.
    const lista = await m.llamar('GET', '/datos/admin/lineas-invitaciones', undefined, admin.token);
    for (const i of lista.datos.invitaciones) expect(i.enlace).toMatch(/\/driver\/lead\//);
    expect(
      lista.datos.invitaciones.some((i: { correoEnviadoEn: string | null }) => i.correoEnviadoEn),
    ).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { aHtml, usarTransporteCorreo } from './correo';
import { mundo } from './pruebas/ayuda';

/**
 * C-EDITAR-LINEA (21 nov 2026, Gerencia): «Editar» el nombre y los datos de una línea y de una
 * invitación de líder pendiente. Si cambia el correo del líder, el mismo enlace le llega al nuevo.
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

describe('C-INVITAR-LIDER-UN-PASO · el botón del correo', () => {
  it('el enlace personal del líder sale como botón «Crear mi cuenta de líder»', () => {
    const html = aHtml('Toca aquí:\n\nhttps://divoox.com/driver/lead/abc', 'es');
    expect(html).toContain('Crear mi cuenta de líder');
    expect(aHtml('Tap here:\n\nhttps://divoox.com/driver/lead/abc', 'en')).toContain(
      'Create my leader account',
    );
  });
});

describe('C-EDITAR-LINEA', () => {
  it('la invitación pendiente se edita: nombre, tipo, conductores y el correo nuevo recibe su enlace', async () => {
    const { m, admin, crear, enviados } = await escenario();
    const r = await crear('lider.ejemplo@ejemplo.com');
    const id = String(r.datos.invitacion.id);
    const enlace = String(r.datos.invitacion.enlace);
    const e = await m.llamar(
      'PATCH',
      `/datos/admin/lineas-invitaciones/${id}`,
      {
        nombre: 'Línea Ejemplo Norte',
        tipo: 'taxi',
        conductores: 30,
        lider: 'otro.lider@ejemplo.com',
      },
      admin.token,
    );
    expect(e.estado, JSON.stringify(e.datos)).toBe(200);
    expect(e.datos.correoEnviado).toBe(true);
    const correo = enviados.find((x) => x.para === 'otro.lider@ejemplo.com');
    expect(correo?.asunto).toContain('Línea Ejemplo Norte');
    expect(correo?.texto).toContain(enlace);
    const lista = await m.llamar('GET', '/datos/admin/lineas-invitaciones', undefined, admin.token);
    expect(lista.datos.invitaciones[0]).toMatchObject({
      nombre: 'Línea Ejemplo Norte',
      tipo: 'taxi',
    });
    const aud = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion = 'invitacion_lider_editar' AND objeto = ?",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(aud?.n).toBe(1);
  });

  it('no deja poner un celular como nombre ni un líder sin correo ni celular válido', async () => {
    const { m, admin, crear } = await escenario();
    const id = String((await crear('lider.ejemplo@ejemplo.com')).datos.invitacion.id);
    const ruta = `/datos/admin/lineas-invitaciones/${id}`;
    expect((await m.llamar('PATCH', ruta, { nombre: '04121234567' }, admin.token)).estado).toBe(
      422,
    );
    expect((await m.llamar('PATCH', ruta, { lider: 'no-es-nada' }, admin.token)).estado).toBe(422);
  });

  it('la línea ya creada se edita (nombre, tipo y conductores) y queda en la auditoría', async () => {
    const { m, admin } = await escenario();
    const lider = await m.cuenta('repartidor', 'Líder Ejemplo');
    await m.DB.prepare(
      "UPDATE usuarios SET telefono = '+584120000001', telefono_canonico = '584120000001' WHERE id = ?",
    )
      .bind(lider.id)
      .run();
    const r = await m.llamar(
      'POST',
      '/datos/admin/lineas',
      {
        nombre: 'Línea Ejemplo',
        zonaId: VIGIA,
        tipo: 'mototaxi',
        lider: '+584120000001',
        contacto2Nombre: 'Contacto Dos',
        contacto2Telefono: '+584120000002',
      },
      admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const id = String(r.datos.linea.id);
    const e = await m.llamar(
      'PATCH',
      `/datos/admin/lineas/${id}`,
      { nombre: 'Línea Ejemplo Sur', tipo: 'ambos', conductores: 12 },
      admin.token,
    );
    expect(e.estado, JSON.stringify(e.datos)).toBe(200);
    expect(e.datos.linea).toMatchObject({ nombre: 'Línea Ejemplo Sur', tipo: 'ambos' });
    const aud = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion = 'linea_editar' AND objeto = ?",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(aud?.n).toBe(1);
  });

  it('solo el equipo edita', async () => {
    const { m, crear } = await escenario();
    const id = String((await crear('lider.ejemplo@ejemplo.com')).datos.invitacion.id);
    const otro = await m.cuenta('repartidor', 'Conductor Ejemplo');
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/admin/lineas-invitaciones/${id}`,
          { nombre: 'Otra' },
          otro.token,
        )
      ).estado,
    ).toBe(403);
  });
});

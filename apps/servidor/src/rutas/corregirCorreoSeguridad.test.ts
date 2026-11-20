import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import {
  correoRebotado,
  enviarCorreo,
  esFalloDeDestinatario,
  usarTransporteCorreo,
} from '../correo';
import { olvidarSegundoFactor } from '../segundoFactor';

/**
 * C-CORREGIR-CORREO, segunda vuelta (20 nov 2026, devuelto por el revisor de calidad). Todos los
 * países.
 * 1. Cambiar el correo de una cuenta YA CONFIRMADA era una toma de cuenta: un empleado (o su cuenta
 *    robada) ponía un correo suyo, pedía «Olvidé mi contraseña» y se quedaba con la cuenta, sus
 *    ganancias y sus pagos. Solo se corrige si la cuenta no confirmó o si su correo rebotó.
 * 2. Un error del sistema («El sitio no existe», «token no existe») se tomaba como rebote: la
 *    dirección buena quedaba bloqueada para siempre y el canario no se enteraba de la caída.
 * 3. Tope de correos por cuenta, motivo sin direcciones, carrera del cambio y mayúsculas.
 */
type Mundo = ReturnType<typeof mundo>;
const ENV = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') };
const ES = { 'x-idioma': 'es' };
const nuevo = () => `bien-${Math.random().toString(36).slice(2)}@ejemplo.com`;

afterEach(() => {
  usarTransporteCorreo(null);
  olvidarSegundoFactor();
});

function buzon() {
  const enviados: string[] = [];
  usarTransporteCorreo(async (_u, init) => {
    const b = JSON.parse(String(init.body)) as { to: { address: string }[] };
    enviados.push(b.to[0]?.address ?? '');
    return new Response(JSON.stringify({ success: true, message_id: 'm', rebotados: [] }));
  });
  return enviados;
}

async function empleado(m: Mundo, token: string, plantillas: string[]) {
  const correo = `emp-${Math.random().toString(36).slice(2)}@ejemplo.com`;
  const inv = await m.llamar(
    'POST',
    '/datos/admin/equipo/invitaciones',
    { correo, nombre: 'Persona Equipo', plantillas, motivo: 'Alta de prueba' },
    token,
  );
  expect(inv.estado, JSON.stringify(inv.datos)).toBe(201);
  const codigo = new URL(inv.datos.enlace as string).searchParams.get('code');
  const a = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
    codigo,
    nombre: 'Persona Equipo',
    clave: 'clave-segura-1',
  });
  expect(a.estado, JSON.stringify(a.datos)).toBe(201);
  return { token: a.datos.token as string };
}

const correoActual = async (m: Mundo, id: string) =>
  (await m.DB.prepare('SELECT correo, correo_confirmado_en AS conf FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ correo: string; conf: string | null }>()) ?? { correo: '', conf: null };

async function rebotar(m: Mundo, correo: string, haceDias = 0) {
  await m.DB.prepare(
    `INSERT OR REPLACE INTO correos_rebotados (correo, motivo, creado_en)
     VALUES (?, 'Rebote permanente', datetime('now', ?))`,
  )
    .bind(correo.toLowerCase(), `-${haceDias} days`)
    .run();
}

describe('C-CORREGIR-CORREO: no se puede tomar una cuenta confirmada cambiándole el correo', () => {
  it('cuenta confirmada: 409 con el mensaje para soporte y el correo no cambia', async () => {
    const m = mundo(ENV);
    const enviados = buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    await m.confirmarCorreo(cli.id);
    const antes = await correoActual(m, cli.id);
    enviados.length = 0; // los de las altas no cuentan
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: nuevo() },
      total.token,
      ES,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.error).toBe(
      'Esta cuenta ya confirmó su correo; el cambio lo hace la persona desde su app.',
    );
    expect(await correoActual(m, cli.id)).toEqual(antes);
    expect(enviados).toHaveLength(0);
    // En inglés también se entiende.
    const en = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: nuevo() },
      total.token,
    );
    expect(en.datos.error).toBe(
      'This account already confirmed its email; the person changes it from their app.',
    );
  });

  it('sin confirmar y rebotado: se corrige (el caso real)', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    await rebotar(m, (await correoActual(m, cli.id)).correo);
    const ficha = await m.llamar('GET', `/datos/admin/clientes/${cli.id}`, undefined, total.token);
    expect(ficha.datos.cliente.correoEstado).toBe('rebotado');
    const correo = nuevo();
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo },
      total.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(await correoActual(m, cli.id)).toEqual({ correo, conf: null });
  });

  it('confirmada pero su correo rebotó después: se corrige y la ficha dice «rebotado»', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    await m.confirmarCorreo(cli.id);
    await rebotar(m, (await correoActual(m, cli.id)).correo);
    const ficha = await m.llamar('GET', `/datos/admin/clientes/${cli.id}`, undefined, total.token);
    expect(ficha.datos.cliente.correoEstado).toBe('rebotado');
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: nuevo() },
      total.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
  });
});

describe('C-CORREO-HONESTO: solo es rebote lo que de verdad dice que la dirección no existe', () => {
  it('distingue el rebote de los errores del sistema', () => {
    expect(esFalloDeDestinatario('email.sending.error.email.recipient_suppressed')).toBe(true);
    expect(esFalloDeDestinatario('x', 'recipient_suppressed')).toBe(true);
    expect(
      esFalloDeDestinatario('550 5.1.1 The email account that you tried to reach does not exist.'),
    ).toBe(true);
    expect(esFalloDeDestinatario('El sitio no existe.')).toBe(false);
    expect(esFalloDeDestinatario('Ese token no existe o ya no sirve.')).toBe(false);
    expect(esFalloDeDestinatario('The site does not exist')).toBe(false);
    expect(esFalloDeDestinatario('Sending suppressed for this account')).toBe(false);
  });

  it('«El sitio no existe» pinta el canario de rojo y no bloquea la dirección', async () => {
    const m = mundo(ENV);
    usarTransporteCorreo(
      async () =>
        new Response(JSON.stringify({ success: false, error: 'El sitio no existe.' }), {
          status: 404,
        }),
    );
    const env = { ...ENV, DB: m.DB } as never;
    const r = await enviarCorreo(env, {
      de: 'avisos',
      para: 'persona@gmail.com',
      asunto: 'a',
      texto: 'b',
    });
    expect(r).toMatchObject({ ok: false, rebotado: false });
    expect(await correoRebotado(env, 'persona@gmail.com')).toBe(false);
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.correo).toBe('error');
    expect(salud.datos.correo.fallos24h).toBe(1);
  });

  it('un rebote de hace más de 30 días ya no cuenta', async () => {
    const m = mundo(ENV);
    const env = { DB: m.DB } as never;
    await rebotar(m, 'viejo@gmail.com', 31);
    await rebotar(m, 'reciente@gmail.com', 2);
    expect(await correoRebotado(env, 'viejo@gmail.com')).toBe(false);
    expect(await correoRebotado(env, 'reciente@gmail.com')).toBe(true);
  });

  it('Soporte quita un rebote desde la ficha, con permiso y registro', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const n1 = await empleado(m, total.token, ['soporte_1']);
    const n2 = await empleado(m, total.token, ['soporte_2']);
    const cli = await m.cuenta('cliente');
    const { correo } = await correoActual(m, cli.id);
    await rebotar(m, correo);
    const ruta = `/datos/admin/usuarios/${cli.id}/rebote/quitar`;
    expect((await m.llamar('POST', ruta, {}, n1.token)).estado).toBe(403);
    const r = await m.llamar('POST', ruta, { motivo: 'Lo revisé con la persona' }, n2.token);
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(r.datos.estado).toBe('sin_confirmar');
    expect(await correoRebotado({ DB: m.DB } as never, correo)).toBe(false);
    const a = await m.DB.prepare(
      "SELECT despues_json FROM auditoria_admin WHERE accion = 'rebote_quitado' AND objeto = ?",
    )
      .bind(`usuario:${cli.id}`)
      .first<{ despues_json: string }>();
    expect(a?.despues_json).toBeTruthy();
    expect(a?.despues_json).not.toContain(correo);
  });
});

describe('C-CORREGIR-CORREO: tope, motivo, carrera y mayúsculas', () => {
  it('como mucho 3 correos por hora a la misma cuenta desde el superadmin', async () => {
    const m = mundo(ENV);
    const enviados = buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    enviados.length = 0; // los de las altas no cuentan
    const conf = `/datos/admin/usuarios/${cli.id}/confirmacion`;
    expect((await m.llamar('POST', conf, {}, total.token)).estado).toBe(200);
    expect((await m.llamar('POST', conf, {}, total.token)).estado).toBe(200);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/usuarios/${cli.id}/correo`,
          { correo: nuevo() },
          total.token,
        )
      ).estado,
    ).toBe(200);
    const cuarto = await m.llamar('POST', conf, {}, total.token, ES);
    expect(cuarto.estado).toBe(429);
    const cambio = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: nuevo() },
      total.token,
    );
    expect(cambio.estado).toBe(429);
    expect(enviados).toHaveLength(3);
  });

  it('el motivo se guarda sin direcciones de correo', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: nuevo(), motivo: 'La persona escribió desde privado@gmail.com' },
      total.token,
    );
    const a = await m.DB.prepare(
      "SELECT despues_json FROM auditoria_admin WHERE accion = 'correo_corregido'",
    ).first<{ despues_json: string }>();
    expect(a?.despues_json).not.toContain('privado@gmail.com');
    expect(JSON.parse(a?.despues_json ?? '{}').motivo).toBe('La persona escribió desde <correo>');
  });

  it('un correo de otra cuenta con otras mayúsculas también choca', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    await m.DB.prepare("UPDATE usuarios SET correo = 'Mayus.Otra@Ejemplo.com' WHERE id = ?")
      .bind(otro.id)
      .run();
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: 'mayus.otra@ejemplo.com' },
      total.token,
      ES,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.error).toBe('Ya existe una cuenta con ese correo.');
  });

  it('la carrera (otra cuenta toma el correo entre la revisión y el cambio) da 409, no 500', async () => {
    // Se simula la carrera: la revisión de duplicados no ve a la otra cuenta.
    const m = mundo(ENV, {
      envolver: (db) =>
        new Proxy(db, {
          get(t, p) {
            if (p !== 'prepare') return Reflect.get(t, p) as unknown;
            return (sql: string) =>
              /SELECT 1 FROM usuarios WHERE correo = \?/.test(sql)
                ? t.prepare('SELECT 1 WHERE 0 AND ? IS NOT NULL AND ? IS NOT NULL')
                : t.prepare(sql);
          },
        }),
    });
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    const { correo } = await correoActual(m, otro.id);
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo },
      total.token,
      ES,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(409);
    expect(r.datos.error).toBe('Ya existe una cuenta con ese correo.');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { usarTransporteCorreo } from '../correo';
import { olvidarSegundoFactor } from '../segundoFactor';
import { DISCULPA_CONFIRMACION } from '../avisos';

/**
 * C-CORREGIR-CORREO (20 nov 2026, pedido de Richard): soporte corrige desde la ficha el correo de
 * una cuenta que lo escribió mal (pasó en producción: una letra cambiada en un Gmail) y reenvía la
 * confirmación. La cuenta queda sin confirmar, sale el enlace al correo nuevo por el mismo camino
 * del producto y queda escrito quién lo hizo (enmascarado). Todos los países.
 */
type Mundo = ReturnType<typeof mundo>;
const ENV = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') };
const ES = { 'x-idioma': 'es' };

afterEach(() => {
  usarTransporteCorreo(null);
  olvidarSegundoFactor();
});

function buzon() {
  const enviados: { para: string; texto: string }[] = [];
  usarTransporteCorreo(async (_u, init) => {
    const b = JSON.parse(String(init.body)) as { to: { address: string }[]; text: string };
    enviados.push({ para: b.to[0]?.address ?? '', texto: b.text });
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
  return { token: a.datos.token as string, id: a.datos.usuario.id as string };
}

const nuevo = () => `bien-${Math.random().toString(36).slice(2)}@ejemplo.com`;

describe('C-CORREGIR-CORREO: corregir el correo de una cuenta desde el superadmin', () => {
  it('cambia el correo, la deja sin confirmar, manda la confirmación y lo anota enmascarado', async () => {
    const m = mundo(ENV);
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente', 'Jhon');
    const enviados = buzon();
    const correo = nuevo();
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: ` ${correo.toUpperCase()} `, motivo: 'Lo escribió con una letra cambiada' },
      total.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(r.datos).toMatchObject({ correoEnviado: true, estado: 'sin_confirmar' });
    const u = await m.DB.prepare('SELECT correo, correo_confirmado_en FROM usuarios WHERE id = ?')
      .bind(cli.id)
      .first<{ correo: string; correo_confirmado_en: string | null }>();
    expect(u).toEqual({ correo, correo_confirmado_en: null });
    // El enlace sale al correo nuevo y sirve para confirmar (el mismo camino del producto).
    const c = enviados.find((e) => e.para === correo);
    const token = c?.texto.match(/confirm-email\?token=(\S+)/)?.[1] ?? '';
    expect((await m.llamar('POST', '/datos/cuentas/confirmar', { token })).estado).toBe(200);
    // Registro: quién y el antes y el después enmascarados (nunca el correo completo).
    const a = await m.DB.prepare(
      "SELECT actor_id, antes_json, despues_json FROM auditoria_admin WHERE accion = 'correo_corregido'",
    ).first<{ actor_id: string; antes_json: string; despues_json: string }>();
    expect(a?.actor_id).toBe(total.id);
    expect(a?.despues_json).not.toContain(correo);
    expect(JSON.parse(a?.despues_json ?? '{}').correo).toBe(`${correo.slice(0, 2)}…@ejemplo.com`);
    // La ficha muestra el estado y la línea de tiempo.
    const ficha = await m.llamar('GET', `/datos/admin/clientes/${cli.id}`, undefined, total.token);
    expect(ficha.datos.cliente.correoEstado).toBe('confirmado');
    expect(ficha.datos.cliente.historialCorreo[0]).toMatchObject({
      accion: 'correo_corregido',
      quien: 'Soporte Total',
    });
    // Ya confirmada, soporte NO puede cambiarle el correo (sería una toma de cuenta): lo hace la
    // persona desde su app (segunda vuelta, devuelta por el revisor el 20 nov).
    const otraVez = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: nuevo() },
      total.token,
    );
    expect(otraVez.estado).toBe(409);
    expect(
      (
        await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
          .bind(cli.id)
          .first<{ correo: string }>()
      )?.correo,
    ).toBe(correo);
  });

  it('no deja usar un correo de otra cuenta ni uno mal escrito', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    const correoOtro = (await m.llamar('GET', '/datos/cuentas/yo', undefined, otro.token)).datos
      .usuario.correo as string;
    const ruta = `/datos/admin/usuarios/${cli.id}/correo`;
    const r = await m.llamar('POST', ruta, { correo: correoOtro }, total.token, ES);
    expect(r.estado).toBe(409);
    expect(r.datos.error).toBe('Ya existe una cuenta con ese correo.');
    expect((await m.llamar('POST', ruta, { correo: 'sin-arroba' }, total.token)).estado).toBe(400);
  });

  it('la ficha dice «rebotó» y reenviar dice la verdad', async () => {
    const m = mundo(ENV);
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    usarTransporteCorreo(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: 'email.sending.error.email.recipient_suppressed',
          }),
          { status: 502 },
        ),
    );
    const re = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/confirmacion`,
      {},
      total.token,
      ES,
    );
    expect(re.estado).toBe(422);
    const ficha = await m.llamar('GET', `/datos/admin/clientes/${cli.id}`, undefined, total.token);
    // C-REBOTE-TEMPORAL: «recipient_suppressed» sin 5.1.1 es un freno temporal, no un buzón muerto.
    expect(ficha.datos.cliente.correoEstado).toBe('frenado');
    // Corregido a uno bueno, vuelve a «sin confirmar» y el enlace sale.
    buzon();
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${cli.id}/correo`,
      { correo: nuevo() },
      total.token,
    );
    expect(r.datos).toMatchObject({ correoEnviado: true, estado: 'sin_confirmar' });
  });

  it('Soporte nivel 1 no puede; Soporte nivel 2 sí', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const n1 = await empleado(m, total.token, ['soporte_1']);
    const n2 = await empleado(m, total.token, ['soporte_2']);
    const cli = await m.cuenta('cliente');
    const ruta = `/datos/admin/usuarios/${cli.id}/correo`;
    expect((await m.llamar('POST', ruta, { correo: nuevo() }, n1.token)).estado).toBe(403);
    expect(
      (await m.llamar('POST', `/datos/admin/usuarios/${cli.id}/confirmacion`, {}, n1.token)).estado,
    ).toBe(403);
    expect((await m.llamar('POST', ruta, { correo: nuevo() }, n2.token)).estado).toBe(200);
  });

  it('también en la ficha del conductor y del restaurante', async () => {
    const m = mundo(ENV);
    buzon();
    const total = await m.cuenta('admin', 'Soporte Total');
    const rep = await m.cuenta('repartidor');
    await m.DB.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)')
      .bind(rep.id)
      .run();
    const r = await m.llamar(
      'POST',
      `/datos/admin/usuarios/${rep.id}/correo`,
      { correo: nuevo() },
      total.token,
    );
    expect(r.estado).toBe(200);
    const ficha = await m.llamar(
      'GET',
      `/datos/admin/repartidores/${rep.id}`,
      undefined,
      total.token,
    );
    expect(ficha.estado, JSON.stringify(ficha.datos)).toBe(200);
    expect(ficha.datos.repartidor.correoEstado).toBe('sin_confirmar');
    expect(ficha.datos.repartidor.historialCorreo).toHaveLength(1);
    // El dueño del restaurante: la ficha del restaurante trae su cuenta y el estado de su correo.
    const dueno = await m.cuenta('restaurante');
    const rest = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    expect(rest.estado, JSON.stringify(rest.datos)).toBeLessThan(300);
    const rid = (
      await m.DB.prepare('SELECT id FROM restaurantes WHERE dueno_id = ?')
        .bind(dueno.id)
        .first<{ id: string }>()
    )?.id;
    const fr = await m.llamar('GET', `/datos/admin/restaurantes/${rid}`, undefined, total.token);
    expect(fr.datos.restaurante).toMatchObject({
      duenoId: dueno.id,
      correoEstado: 'sin_confirmar',
    });
  });
  it('reenviar con disculpa la pone arriba; el reenvío normal no', async () => {
    const m = mundo(ENV);
    const total = await m.cuenta('admin', 'Soporte Total');
    const cli = await m.cuenta('cliente');
    const enviados = buzon();
    const ruta = `/datos/admin/usuarios/${cli.id}/confirmacion`;
    expect((await m.llamar('POST', ruta, {}, total.token)).estado).toBe(200);
    expect((await m.llamar('POST', ruta, { disculpa: true }, total.token)).estado).toBe(200);
    const [normal, conDisculpa] = enviados;
    expect(normal?.texto).not.toContain(DISCULPA_CONFIRMACION.en);
    expect(normal?.texto).not.toContain(DISCULPA_CONFIRMACION.es);
    // La cuenta de prueba está en inglés: la disculpa sale en su idioma.
    expect(conDisculpa?.texto.startsWith(DISCULPA_CONFIRMACION.en)).toBe(true);
  });
});

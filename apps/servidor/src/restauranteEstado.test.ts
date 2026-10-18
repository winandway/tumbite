import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';

const raiz = join(__dirname, '..', '..', '..');

/** F13 y F14 de la auditoría final (C-RESTAURANTE-ESTADO). */
describe('el dueño se entera por correo y el ítem de cobro mira los pagos activos (C-RESTAURANTE-ESTADO)', () => {
  afterEach(() => usarTransporteCorreo(null));

  function captura() {
    const enviados: { to: string; subject: string; text: string }[] = [];
    usarTransporteCorreo(async (_e, init) => {
      const c = JSON.parse(String(init.body)) as {
        to: { address: string }[];
        subject: string;
        text: string;
      };
      enviados.push({ to: c.to[0]!.address, subject: c.subject, text: c.text });
      return new Response('{"ok":true}', { status: 200 });
    });
    return enviados;
  }

  it('al aprobar, pausar o rechazar llega un correo al dueño, con el motivo', async () => {
    const enviados = captura();
    const m = mundo({ YAD_TOKEN: 'x'.repeat(40) });
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const id = r.datos.restaurante.id as string;
    enviados.length = 0;
    await m.llamar('PATCH', `/datos/admin/restaurantes/${id}`, { estado: 'aprobado' }, admin.token);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.subject).toMatch(/aprobado|approved/);
    await m.llamar('PATCH', `/datos/admin/restaurantes/${id}`, { plan: 'crece' }, admin.token);
    expect(enviados).toHaveLength(1);
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${id}`,
      { estado: 'rechazado', motivo: 'Falta el permiso sanitario' },
      admin.token,
    );
    expect(enviados).toHaveLength(2);
    expect(enviados[1]?.text).toContain('Falta el permiso sanitario');
  });

  it('el ítem «cobro» de la activación solo queda listo con los pagos activos en Stripe', async () => {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const item = async () =>
      (
        (await m.llamar('GET', '/datos/mi-restaurante', undefined, dueno.token)).datos.restaurante
          .activacion.items as { clave: string; listo: boolean }[]
      ).find((i) => i.clave === 'cobro')?.listo;
    await m.DB.prepare(
      "INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta, pagos_activos) VALUES (?, 'acct_x', 0)",
    )
      .bind(dueno.id)
      .run();
    expect(await item()).toBe(false);
    await m.DB.prepare('UPDATE cuentas_stripe SET pagos_activos = 1 WHERE usuario_id = ?')
      .bind(dueno.id)
      .run();
    expect(await item()).toBe(true);
  });

  it('«Recibiendo pedidos» sale solo si de verdad está recibiendo (abiertoAhora), en la app y en el panel', () => {
    const app = readFileSync(join(raiz, 'apps/restaurante/src/Inicio.tsx'), 'utf8');
    const panel = readFileSync(join(raiz, 'apps/panel/src/panel/MiRestaurante.tsx'), 'utf8');
    expect(app).toMatch(/rest\.abiertoAhora \? t\.abierto : t\.fueraHorario/);
    expect(panel).toMatch(/rest\.abiertoAhora \? t\.abierto : t\.fueraHorario/);
  });
});

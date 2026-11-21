import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-REBOTE-TEMPORAL (21 nov 2026, el primer líder de El Vigía): Gmail le dio un rechazo TEMPORAL,
 * Cloudflare congeló su dirección 24 horas y el siguiente envío volvió `recipient_suppressed`. El
 * sistema lo guardaba como buzón muerto 30 días y la ficha decía «el buzón no existe». Ahora un freno
 * así vale un día y se dice como lo que es; un 5.1.1 sigue siendo un buzón que no existe.
 */
afterEach(() => vi.unstubAllGlobals());

async function conRebote(motivo: string) {
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const c = await m.cuenta('repartidor', 'Conductor Ejemplo');
  await m.llamar('GET', '/datos/repartidor/estado', undefined, c.token);
  const correo = (
    await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(c.id)
      .first<{ correo: string }>()
  )?.correo;
  await m.DB.prepare('INSERT INTO correos_rebotados (correo, motivo) VALUES (?, ?)')
    .bind(correo, motivo)
    .run();
  return { m, admin, c };
}

describe('C-REBOTE-TEMPORAL', () => {
  it('«recipient_suppressed» solo es un freno temporal: la ficha no dice que el buzón no existe y la app no pide cambiarlo', async () => {
    const { m, admin, c } = await conRebote(
      'El proveedor de correo rechazó el envío: email.sending.error.email.recipient_suppressed',
    );
    const f = await m.llamar('GET', `/datos/admin/repartidores/${c.id}`, undefined, admin.token);
    expect(f.datos.repartidor.correoEstado).toBe('frenado');
    const p = await m.llamar('GET', '/datos/cuentas/perfil', undefined, c.token);
    expect(p.datos.perfil.correoRebotado).toBe(false);
    // Al día siguiente ya no frena nada.
    await m.DB.prepare(
      "UPDATE correos_rebotados SET creado_en = datetime('now', '-25 hours')",
    ).run();
    const g = await m.llamar('GET', `/datos/admin/repartidores/${c.id}`, undefined, admin.token);
    expect(g.datos.repartidor.correoEstado).toBe('sin_confirmar');
  });

  it('un 5.1.1 sigue siendo un buzón que no existe, por 30 días', async () => {
    const { m, admin, c } = await conRebote(
      '550 5.1.1 The email account that you tried to reach does not exist',
    );
    await m.DB.prepare(
      "UPDATE correos_rebotados SET creado_en = datetime('now', '-25 hours')",
    ).run();
    const f = await m.llamar('GET', `/datos/admin/repartidores/${c.id}`, undefined, admin.token);
    expect(f.datos.repartidor.correoEstado).toBe('rebotado');
    const p = await m.llamar('GET', '/datos/cuentas/perfil', undefined, c.token);
    expect(p.datos.perfil.correoRebotado).toBe(true);
  });
});

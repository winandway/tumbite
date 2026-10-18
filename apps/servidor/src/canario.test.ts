import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import { alertarCanario } from './canario';

/**
 * F11 de la auditoría final: cuando una pieza del canario se pone en rojo, el equipo recibe UN
 * correo (y otro cuando se recupera), sin repetirlo en cada consulta de la salud. C-CANARIO-AVISA.
 */
describe('el canario avisa al equipo al ponerse en rojo (C-CANARIO-AVISA)', () => {
  afterEach(() => usarTransporteCorreo(null));

  function captura() {
    const enviados: { to: string; subject: string }[] = [];
    usarTransporteCorreo(async (_e, init) => {
      const c = JSON.parse(String(init.body)) as { to: { address: string }[]; subject: string };
      enviados.push({ to: c.to[0]!.address, subject: c.subject });
      return new Response('{"ok":true}', { status: 200 });
    });
    return enviados;
  }

  it('avisa una sola vez por pieza en rojo y una vez al recuperarse', async () => {
    const enviados = captura();
    const m = mundo({ YAD_TOKEN: 'x'.repeat(40), ADMIN_CORREOS: 'equipo@ejemplo.com' });
    await m.cuenta('cliente');
    enviados.length = 0; // el registro de la cuenta manda su propio correo de confirmación
    await alertarCanario(m.extra as never, m.DB, { reloj: 'error', base: 'ok' });
    await alertarCanario(m.extra as never, m.DB, { reloj: 'error', base: 'ok' });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.to).toBe('equipo@ejemplo.com');
    expect(enviados[0]?.subject).toMatch(/rojo/i);
    expect(enviados[0]?.subject).toContain('reloj');
    await alertarCanario(m.extra as never, m.DB, { reloj: 'ok', base: 'ok' });
    expect(enviados).toHaveLength(2);
    expect(enviados[1]?.subject).toMatch(/recuper/i);
    // Una pieza «pendiente» o «atrasado» no es rojo: no avisa.
    await alertarCanario(m.extra as never, m.DB, { reloj: 'atrasado', sms: 'pendiente' });
    expect(enviados).toHaveLength(2);
  });

  it('la salud completa llama al canario: una pieza en error deja su registro', async () => {
    captura();
    const m = mundo({ YAD_TOKEN: 'x'.repeat(40), ADMIN_CORREOS: 'equipo@ejemplo.com' });
    await m.cuenta('cliente');
    await m.DB.prepare(
      "INSERT INTO conciliaciones (dia, cuadra, detalle) VALUES (date('now'), 0, 'x')",
    )
      .run()
      .catch(() => undefined);
    await m.crudo('/datos/salud', { method: 'GET' });
    const filas = await m.DB.prepare('SELECT pieza, estado FROM alertas_canario').all<{
      pieza: string;
      estado: string;
    }>();
    expect(filas.results.length).toBeGreaterThan(0);
  });
});

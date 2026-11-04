import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-CORREO-OBLIGATORIO (4 nov 2026, Richard grabando el video para Apple): la app del cliente no
 * deja entrar hasta que la persona confirma su correo. El servidor dice en el perfil si la cuenta
 * todavía debe confirmarlo (`debeConfirmarCorreo`), y al confirmar devuelve el rol para que la página
 * del enlace ofrezca volver a la app. En pruebas, las cuentas de dominios que no existen (las del
 * recorrido) no pasan por la puerta, salvo las que empiezan por «verificar.» (las que prueban la
 * puerta); en producción pasan todas. Todos los países.
 */
async function registrar(m: ReturnType<typeof mundo>, correo: string) {
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Ana García',
    correo,
    clave: 'clave-segura-1',
    rol: 'cliente',
  });
  expect(r.estado).toBe(201);
  return { token: r.datos.token as string, id: r.datos.usuario.id as string };
}
const debe = async (m: ReturnType<typeof mundo>, token: string) =>
  (await m.llamar('GET', '/datos/cuentas/perfil', undefined, token)).datos.perfil
    .debeConfirmarCorreo as boolean;

describe('el correo se confirma antes de entrar a la app', () => {
  it('una cuenta nueva debe confirmar su correo; confirmada, ya no', async () => {
    const m = mundo({}, { host: 'divoox.com' });
    const c = await registrar(m, 'ana.garcia@gmail.com');
    expect(await debe(m, c.token)).toBe(true);
    await m.confirmarCorreo(c.id);
    expect(await debe(m, c.token)).toBe(false);
  });

  it('en producción, una dirección de prueba también tiene que confirmarse', async () => {
    const m = mundo({}, { host: 'divoox.com' });
    const c = await registrar(m, 'ana@ejemplo.com');
    expect(await debe(m, c.token)).toBe(true);
  });

  it('fuera de producción, las cuentas del recorrido no pasan por la puerta, salvo «verificar.»', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    expect(await debe(m, (await registrar(m, 'cliente.1@recorrido.test')).token)).toBe(false);
    expect(await debe(m, (await registrar(m, 'verificar.1@recorrido.test')).token)).toBe(true);
  });

  it('al confirmar con el enlace, la página sabe que es una cuenta de cliente', async () => {
    const m = mundo({}, { host: 'divoox.com' });
    const c = await registrar(m, 'ana.garcia@gmail.com');
    const token = 'enlace-de-prueba-'.padEnd(40, 'x');
    const { sha256 } = await import('../cripto');
    await m.DB.prepare(
      "INSERT INTO confirmaciones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+1 day'))",
    )
      .bind(await sha256(token), c.id)
      .run();
    const r = await m.llamar('POST', '/datos/cuentas/confirmar', { token });
    expect(r.estado).toBe(200);
    expect(r.datos.rol).toBe('cliente');
    expect(await debe(m, c.token)).toBe(false);
  });
});

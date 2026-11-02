import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * C-PUENTE-PANEL (2 nov 2026): el panel web se abre dentro de la app con la sesión ya iniciada, por
 * un código de un solo uso que vence en 60 segundos y nunca lleva a otro sitio.
 */
describe('puente de la app al panel web', () => {
  it('el código sirve una vez, deja la sesión y lleva a la página del propio sitio', async () => {
    const m = mundo();
    const u = await m.cuenta('cliente', 'Ana Puente');
    expect((await m.llamar('POST', '/datos/cuentas/puente', { a: '/panel/settings' })).estado).toBe(
      401,
    );
    const r = await m.llamar('POST', '/datos/cuentas/puente', { a: '/panel/settings' }, u.token);
    expect(r.estado).toBe(200);
    const url = new URL(r.datos.url as string);
    expect(url.pathname.startsWith('/datos/cuentas/puente/')).toBe(true);
    const ruta = `${url.pathname}${url.search}`;
    const uno = await m.crudo(ruta, { redirect: 'manual' });
    expect(uno.status).toBe(302);
    expect(uno.headers.get('location')).toBe('/panel/settings');
    const galleta = uno.headers.get('set-cookie') ?? '';
    expect(galleta).toMatch(/^tumbite_sesion=[^;]+; Path=\/; HttpOnly; Secure/);
    // Con esa cookie el panel ya sabe quién es.
    const yo = await m.crudo('/datos/cuentas/yo', {
      headers: { cookie: galleta.split(';')[0]! },
    });
    expect(((await yo.json()) as { usuario: { id: string } }).usuario.id).toBe(u.id);
    // Usado una vez: no vuelve a abrir sesión.
    const dos = await m.crudo(ruta, { redirect: 'manual' });
    expect(dos.status).toBe(302);
    expect(dos.headers.get('set-cookie')).toBeNull();
  });

  it('vencido o inventado no abre sesión, y nunca redirige afuera', async () => {
    const m = mundo();
    const u = await m.cuenta('cliente');
    for (const a of ['https://malo.com', '//malo.com', 'panel']) {
      expect((await m.llamar('POST', '/datos/cuentas/puente', { a }, u.token)).estado).toBe(400);
    }
    const r = await m.llamar('POST', '/datos/cuentas/puente', { a: '/panel' }, u.token);
    await m.DB.prepare("UPDATE puentes_sesion SET expira_en = datetime('now', '-1 second')").run();
    const url = new URL(r.datos.url as string);
    const vencido = await m.crudo(`${url.pathname}?a=//malo.com`, { redirect: 'manual' });
    expect(vencido.headers.get('set-cookie')).toBeNull();
    expect(vencido.headers.get('location')).toBe('/');
    const inventado = await m.crudo('/datos/cuentas/puente/xyz?a=/panel', { redirect: 'manual' });
    expect(inventado.headers.get('set-cookie')).toBeNull();
  });
});

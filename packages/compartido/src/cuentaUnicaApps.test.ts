import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crearApi } from './api';
import { textosActivarPapel } from './appDeCuenta';

/**
 * C-CUENTA-UNICA (24 nov 2026, Richard; todos los países). La app de clientes y Driver dicen que saben
 * ofrecer el papel que falta (cabecera x-cuenta-unica). Divoox Merchant NO, a propósito: tiene un
 * caso abierto con Apple y su app y la cuenta de revisión «Divoox Review Kitchen» se comportan igual
 * que hoy. Comprobado en rojo quitando el filtro por app de la cabecera.
 */
async function cabecerasDe(app: string) {
  let vistas: Record<string, string> = {};
  const api = crearApi({
    base: '',
    app: () => app,
    fetch: async (_u, init) => {
      vistas = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ token: 't', usuario: {} }), { status: 200 });
    },
  });
  await api.entrar({ correo: 'a@ejemplo.com', clave: 'x' }).catch(() => undefined);
  return vistas;
}

describe('C-CUENTA-UNICA: qué apps ofrecen el papel que falta', () => {
  it('cliente y Driver lo dicen; Restaurants no', async () => {
    expect((await cabecerasDe('cliente/0.1.70 ios'))['x-cuenta-unica']).toBe('1');
    expect((await cabecerasDe('repartidor/0.1.70 android'))['x-cuenta-unica']).toBe('1');
    expect((await cabecerasDe('restaurante/0.1.70 ios'))['x-cuenta-unica']).toBeUndefined();
  });

  it('la pantalla de entrar solo ofrece activar el papel en la app de clientes y en Driver', () => {
    const acceso = readFileSync(resolve(__dirname, '../../movil/src/Acceso.tsx'), 'utf8');
    expect(acceso).toContain(
      "const papelApp = rolRegistro === 'cliente' || rolRegistro === 'repartidor' ? rolRegistro : null;",
    );
    // La app de Restaurants sigue aceptando solo cuentas de restaurante.
    const layout = readFileSync(
      resolve(__dirname, '../../../apps/restaurante/src/app/_layout.tsx'),
      'utf8',
    );
    expect(layout).toContain("roles={['restaurante']}");
  });

  it('los textos de activar dicen «conductor», en los dos idiomas', () => {
    expect(textosActivarPapel('repartidor', 'es').titulo).toBe('Empezar mi registro de conductor');
    expect(textosActivarPapel('cliente', 'en').titulo).toBe('Activate my customer account');
    expect(textosActivarPapel('repartidor', 'es').cuerpo).toContain('conductor');
  });
});

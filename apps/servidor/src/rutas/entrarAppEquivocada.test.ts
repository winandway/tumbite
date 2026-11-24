import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APPS_DE_CELULAR, ROL_DE_APP, mensajeCuentaDeOtraApp } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';

/**
 * C-ENTRAR-APP-EQUIVOCADA (23 nov 2026, conductor real de Venezuela). Puso su correo de conductor en la
 * app de clientes: el servidor le abría sesión, y como al repartidor entrar le borra las demás, cada
 * intento le cerraba Divoox Driver. La app de clientes lo rechazaba sola y, al querer registrarse con
 * ese correo, lo mandaban a «Entrar»: un círculo cerrado.
 */
const CLAVE = 'clave-segura-1';
const es = (app: string) => ({ 'x-tumbite-app': `${app}/0.1.60 ios`, 'x-idioma': 'es' });

async function preparar() {
  const m = mundo({});
  const nueva = async (rol: 'cliente' | 'repartidor') => {
    const correo = `${rol}-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: `Persona ${rol}`, correo, clave: CLAVE, rol },
      undefined,
      es(rol),
    );
    expect(r.estado).toBe(201);
    return { correo, id: r.datos.usuario.id as string, token: r.datos.token as string };
  };
  const sesiones = async (id: string) =>
    Number(
      (
        await m.DB.prepare('SELECT count(*) AS n FROM sesiones WHERE usuario_id = ?')
          .bind(id)
          .first<{ n: number }>()
      )?.n,
    );
  const entrar = (correo: string, clave: string, cabeceras: Record<string, string>) =>
    m.llamar('POST', '/datos/cuentas/entrar', { correo, clave }, undefined, cabeceras);
  const yo = (token: string) => m.llamar('GET', '/datos/cuentas/yo', undefined, token);
  return { m, nueva, sesiones, entrar, yo };
}

describe('C-ENTRAR-APP-EQUIVOCADA: una cuenta en la app que no es la suya', () => {
  it('el conductor con Driver abierto entra desde la app de clientes: aviso claro, ninguna sesión nueva y Driver sigue', async () => {
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    expect((await p.yo(conductor.token)).estado).toBe(200);
    expect(await p.sesiones(conductor.id)).toBe(1);
    const r = await p.entrar(conductor.correo, CLAVE, es('cliente'));
    expect(r.estado).toBe(409);
    expect(r.datos.codigo).toBe('cuenta_de_otra_app');
    expect(r.datos.error).toBe(
      'Este correo ya es de una cuenta de conductor de Divoox y no sirve en esta app. Para pedir, crea una cuenta de cliente con otro correo; puedes usar el mismo celular. Tu cuenta de conductor sigue igual en Divoox Driver.',
    );
    expect(r.datos.token).toBeUndefined();
    expect(await p.sesiones(conductor.id)).toBe(1);
    expect((await p.yo(conductor.token)).estado).toBe(200);
    // En inglés, el mismo aviso traducido.
    const en = await p.entrar(conductor.correo, CLAVE, { 'x-tumbite-app': 'cliente/0.1.60 ios' });
    expect(en.datos.error).toBe(
      'This email already belongs to a Divoox driver account and doesn’t work in this app. To order, create a customer account with a different email; you can use the same phone number. Your driver account stays the same in Divoox Driver.',
    );
  });

  it('al revés: una cuenta de cliente en Driver tampoco abre sesión', async () => {
    const p = await preparar();
    const cliente = await p.nueva('cliente');
    const r = await p.entrar(cliente.correo, CLAVE, es('repartidor'));
    expect(r.estado).toBe(409);
    expect(r.datos.codigo).toBe('cuenta_de_otra_app');
    expect(r.datos.error).toContain('cuenta de cliente');
    expect(r.datos.error).toContain('crea una cuenta de conductor');
    expect(await p.sesiones(cliente.id)).toBe(1);
  });

  it('sin cabecera de app (panel web y demás) todo sigue como hoy', async () => {
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    const r = await p.entrar(conductor.correo, CLAVE, { 'x-idioma': 'es' });
    expect(r.estado).toBe(200);
    expect(r.datos.token).toBeTruthy();
    // Y en su propia app, como hoy: entra y el teléfono anterior se cierra (C-REPARTIDOR-UN-TELEFONO).
    const propia = await p.entrar(conductor.correo, CLAVE, es('repartidor'));
    expect(propia.estado).toBe(200);
    expect(await p.sesiones(conductor.id)).toBe(1);
  });

  it('con la contraseña mala se dice solo eso (no se revela de qué tipo es la cuenta)', async () => {
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    const r = await p.entrar(conductor.correo, 'otra-clave-9', es('cliente'));
    expect(r.estado).toBe(401);
    // C-MENSAJES-ACCESO (24 nov 2026): el mensaje específico de la contraseña, nunca el de otra app.
    expect(r.datos.error).toBe('La contraseña no es correcta.');
    expect(r.datos.codigo).toBe('clave_incorrecta');
    expect(await p.sesiones(conductor.id)).toBe(1);
  });

  it('registrarse con el correo de una cuenta de otro tipo da el aviso útil; del mismo tipo, como hoy', async () => {
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    const r = await p.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Persona cliente', correo: conductor.correo, clave: CLAVE, rol: 'cliente' },
      undefined,
      es('cliente'),
    );
    expect(r.estado).toBe(409);
    expect(r.datos.codigo).toBe('cuenta_de_otra_app');
    expect(r.datos.campo).toBe('correo');
    expect(r.datos.error).toBe(mensajeCuentaDeOtraApp('repartidor', 'cliente'));
    const mismo = await p.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Otra persona', correo: conductor.correo, clave: CLAVE, rol: 'repartidor' },
      undefined,
      es('repartidor'),
    );
    expect(mismo.estado).toBe(409);
    expect(mismo.datos.error).toBe('Ya existe una cuenta con ese correo. Entra con tu contraseña.');
    // C-MENSAJES-ACCESO: con su código, para que la app ofrezca «Entrar».
    expect(mismo.datos.codigo).toBe('correo_con_cuenta');
  });

  it('la tabla de apps es la misma que acepta cada app de celular', () => {
    for (const app of APPS_DE_CELULAR) {
      const layout = readFileSync(
        resolve(__dirname, `../../../${app}/src/app/_layout.tsx`),
        'utf8',
      );
      expect(layout).toContain(`roles={['${ROL_DE_APP.get(app)}']}`);
    }
  });
});

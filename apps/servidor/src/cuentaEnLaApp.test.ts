import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CORREO-OBLIGATORIO y C-BORRAR-EN-LA-APP (4 nov 2026, Richard grabando el video para Apple):
 * 1) sin cuenta se miran restaurantes y menús (Apple 5.1.1 v, como DoorDash); al ir a pagar (y en todo
 *    lo que es de la cuenta) se pide entrar y el correo confirmado: «Confirma tu correo», que se da
 *    cuenta sola cuando la persona toca el enlace y dice «Tu correo quedó verificado»;
 * 2) «Borrar mi cuenta» del menú de tres puntos se hace DENTRO de la app (escribir DELETE / BORRAR),
 *    nunca abriendo la página web (Apple 5.1.1 v). La app no corre en vitest: el candado mira su código.
 * Todos los países.
 */
const PROTEGIDAS = [
  'account',
  'business',
  'cart',
  'favorites',
  'gift-cards',
  'group/[codigo]',
  'invite',
  'notifications',
  'order/[id]',
  'orders',
  'packages',
  'plus',
  'ride',
];
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('cuenta del cliente dentro de la app', () => {
  it('sin cuenta se mira; la cuenta y el correo confirmado se piden al ir a pagar', () => {
    // 5.1.1(v): mirar restaurantes y menús no necesita cuenta (como DoorDash).
    expect(leer('apps', 'cliente', 'src', 'app', '_layout.tsx')).not.toMatch(/<ConSesion/);
    expect(leer('apps', 'cliente', 'src', 'app', 'index.tsx')).not.toMatch(/<Acceso/);
    // Lo que es de la cuenta (carrito y pago, pedidos, Mi cuenta…) la pide ahí mismo, con el correo.
    for (const pantalla of PROTEGIDAS)
      expect(leer('apps', 'cliente', 'src', 'app', `${pantalla}.tsx`), pantalla).toMatch(
        /export default conCuenta\(/,
      );
    expect(leer('apps', 'cliente', 'src', 'ConCuenta.tsx')).toMatch(/<ConSesion[^>]*exigeCorreo/);
    // Entrar o crear la cuenta desde la portada vuelve a la portada.
    expect(leer('apps', 'cliente', 'src', 'app', 'sign-in.tsx')).toMatch(/router\.replace/);
    // Al crear la cuenta, la portada avisa que falta confirmar el correo (sin bloquear).
    expect(leer('apps', 'cliente', 'src', 'Inicio.tsx')).toMatch(/<AvisoCorreo/);
    const con = leer('packages', 'movil', 'src', 'ConSesion.tsx');
    expect(con).toMatch(/exigeCorreo \? <PuertaCorreo/);
    const puerta = leer('packages', 'movil', 'src', 'VerificarCorreo.tsx');
    expect(puerta).toMatch(/debeConfirmarCorreo/);
    expect(puerta).toMatch(/\/datos\/cuentas\/confirmar\/reenviar/);
    expect(puerta).toMatch(/AppState\.addEventListener\('change'/);
    expect(puerta).toMatch(/verificado/);
    expect(puerta).toMatch(/export function AvisoCorreo/);
    // Una cuenta sin confirmar también se puede borrar sin salir de la app.
    expect(puerta).toMatch(/<ConfirmarBorrado/);
  });

  it('borrar la cuenta desde los tres puntos no saca de la app', () => {
    const menu = leer('packages', 'movil', 'src', 'BorrarCuenta.tsx');
    expect(menu).not.toMatch(/\/delete-account/);
    expect(menu).toMatch(/<ConfirmarBorrado/);
    const confirmar = leer('packages', 'movil', 'src', 'OpcionesCuenta.tsx');
    expect(confirmar).toMatch(/export function ConfirmarBorrado/);
    expect(confirmar).toMatch(/'DELETE', '\/datos\/cuentas\/yo'/);
  });
});

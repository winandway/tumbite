import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CORREO-OBLIGATORIO y C-BORRAR-EN-LA-APP (4 nov 2026, Richard grabando el video para Apple):
 * 1) la app del cliente no deja entrar hasta confirmar el correo: muestra «Confirma tu correo», se
 *    da cuenta sola cuando la persona toca el enlace (al volver a la app y cada pocos segundos) y dice
 *    «Tu correo quedó verificado» antes de entrar;
 * 2) «Borrar mi cuenta» del menú de tres puntos se hace DENTRO de la app (escribir DELETE / BORRAR),
 *    nunca abriendo la página web (Apple 5.1.1 v). La app no corre en vitest: el candado mira su código.
 * Todos los países.
 */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('cuenta del cliente dentro de la app', () => {
  it('la app del cliente exige el correo confirmado antes de entrar', () => {
    expect(leer('apps', 'cliente', 'src', 'app', '_layout.tsx')).toMatch(
      /<ConSesion[^>]*exigeCorreo/,
    );
    const con = leer('packages', 'movil', 'src', 'ConSesion.tsx');
    expect(con).toMatch(/exigeCorreo \? <PuertaCorreo/);
    const puerta = leer('packages', 'movil', 'src', 'VerificarCorreo.tsx');
    expect(puerta).toMatch(/debeConfirmarCorreo/);
    expect(puerta).toMatch(/\/datos\/cuentas\/confirmar\/reenviar/);
    expect(puerta).toMatch(/AppState\.addEventListener\('change'/);
    expect(puerta).toMatch(/verificado/);
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

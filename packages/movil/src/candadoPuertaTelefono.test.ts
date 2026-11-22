import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-TELEFONO-AL-REGISTRARSE (22 nov 2026): la puerta del celular está en las dos apps que crean cuentas
 * (cliente y Driver), la app avisa al servidor que la trae, y la casilla del código se llena sola con el
 * SMS. Si alguien la quita de una app, esta prueba se pone en rojo.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-TELEFONO-AL-REGISTRARSE · la puerta del celular en las apps', () => {
  it('el registro de las apps le dice al servidor que trae la pantalla del código', () => {
    expect(leer('packages/movil/src/Acceso.tsx')).toMatch(/verificaTelefono: true/);
  });

  it('la app del cliente y Driver pasan por la puerta', () => {
    expect(leer('apps/cliente/src/ConCuenta.tsx')).toMatch(/\bexigeTelefono\b/);
    expect(leer('packages/movil/src/ConSesion.tsx')).toMatch(/<PuertaTelefono/);
    expect(leer('apps/repartidor/src/app/index.tsx')).toMatch(/<PuertaTelefono[\s\S]*<Inicio \/>/);
  });

  it('el código se pega solo, no se guarda en el borrador y nadie queda atrapado', () => {
    const s = leer('packages/movil/src/PuertaTelefono.tsx');
    expect(s).toMatch(/textContentType="oneTimeCode"/);
    expect(s).toMatch(/autoComplete="sms-otp"/);
    // El borrador guarda el número nuevo, nunca el código de un solo uso.
    expect(s).toMatch(/inicial: \{ telefono: '', paisTelefono: '' \}/);
    // Salidas a la vista: cambiar el número, soporte y cerrar sesión.
    expect(s).toMatch(/'\/datos\/cuentas\/telefono'/);
    expect(s).toMatch(/mailto:/);
    expect(s).toMatch(/salir\(\)/);
    // Las cuentas viejas: franja que se cierra, nunca una ventana.
    expect(s).toMatch(/franja-celular/);
    expect(s).not.toMatch(/<Modal/);
  });
});

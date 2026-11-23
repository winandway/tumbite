import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CORREO-FRANJA (23 nov 2026, decisión de Richard: el correo en segundo plano). La franja del correo
 * está en la portada del cliente y en el inicio de Driver, es una sola pieza, nunca una ventana ni algo
 * que tape la pantalla, y trae «Mandar el enlace otra vez» y «¿Correo equivocado? Cámbialo». La app no
 * corre en vitest: el candado mira su código. Si alguien la quita o la vuelve ventana, se pone en rojo.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
const pieza = leer('packages/movil/src/VerificarCorreo.tsx');
/** El código de la franja, desde su función hasta la siguiente pieza. */
const franja = pieza.slice(
  pieza.indexOf('export function AvisoCorreo'),
  pieza.indexOf('export function CambiarCorreo'),
);

describe('C-CORREO-FRANJA · el correo se pide con una franja suave en las dos apps', () => {
  it('la franja está en la portada del cliente y en el inicio de Driver', () => {
    expect(leer('apps/cliente/src/Inicio.tsx')).toMatch(/<AvisoCorreo \/>/);
    expect(leer('apps/repartidor/src/Inicio.tsx')).toMatch(/<AvisoCorreo margenLateral=\{0\} \/>/);
    // Driver no tiene puerta del correo: nunca la tuvo y no la tiene.
    expect(leer('apps/repartidor/src/app/index.tsx')).not.toMatch(/PuertaCorreo|exigeCorreo/);
  });

  it('pide en segundo plano (correoPorConfirmar), con reenviar y cambiar, sin ventana ni tapar nada', () => {
    expect(franja.length).toBeGreaterThan(500);
    expect(franja).toMatch(/correoPorConfirmar/);
    expect(franja).toMatch(/'\/datos\/cuentas\/confirmar\/reenviar'/);
    expect(franja).toMatch(/aviso-correo-reenviar/);
    expect(franja).toMatch(/aviso-correo-cambiar/);
    expect(franja).toMatch(/<CambiarCorreo/);
    // Si rebotó, lo dice y abre el cambio.
    expect(franja).toMatch(/correoRebotado/);
    expect(franja).toMatch(/aviso-correo-rebotado/);
    // Nunca una ventana ni algo encima de la pantalla.
    expect(franja).not.toMatch(/<Modal|position: 'absolute'|zIndex/);
    // El texto no dice que no se puede pedir: se puede seguir usando todo.
    const textos = pieza.slice(
      pieza.indexOf('const TA = {'),
      pieza.indexOf('export function AvisoCorreo'),
    );
    expect(textos).not.toMatch(/para poder pedir|to order/);
    expect(textos).toMatch(/Puedes seguir usando la app/);
    expect(textos).toMatch(/You can keep using the app/);
  });

  it('cambiar el correo es una sola pieza, con sesión y contraseña; la contraseña nunca va al borrador', () => {
    const cambiar = pieza.slice(pieza.indexOf('export function CambiarCorreo'));
    expect(cambiar).toMatch(/'POST', '\/datos\/cuentas\/correo'/);
    expect(cambiar).toMatch(/clave: b\.valores\.clave/);
    expect(cambiar).toMatch(/sensibles: \['clave'\]/);
    // La puerta del correo usa la misma pieza (nada de dos formularios iguales).
    const puerta = pieza.slice(0, pieza.indexOf('export function AvisoCorreo'));
    expect(puerta).toMatch(/<CambiarCorreo/);
    expect(pieza.match(/'\/datos\/cuentas\/correo'/g)).toHaveLength(1);
  });
});

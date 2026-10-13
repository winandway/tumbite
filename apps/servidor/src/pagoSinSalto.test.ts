import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-PAGO-SIN-SALTO: regla de Richard, el pago queda dentro de la app.
 * El carrito nunca abre una página de pago afuera; usa el formulario de Stripe incrustado.
 */
const CLIENTE = join(__dirname, '..', '..', 'cliente', 'src');
const leer = (r: string) => readFileSync(join(CLIENTE, r), 'utf8');

describe('pago dentro de la app', () => {
  it('el carrito no salta a una página de pago', () => {
    const carrito = leer('app/cart.tsx');
    expect(carrito).not.toMatch(/Linking\.openURL|urlPago/);
    expect(carrito).toMatch(/<PagoTarjeta/);
  });

  it('la web usa el formulario incrustado y el celular la hoja de pago', () => {
    expect(leer('PagoTarjeta.web.tsx')).toMatch(/PaymentElement[\s\S]*redirect: 'if_required'/);
    expect(leer('PagoTarjeta.tsx')).toMatch(/presentPaymentSheet/);
  });
});

describe('el botón de pagar nunca gira para siempre', () => {
  it('no depende de una consulta aparte de la clave pública', () => {
    const carrito = leer('app/cart.tsx');
    expect(carrito).not.toMatch(/datos\/publico/);
    expect(carrito).toMatch(/cargando=\{pagando\}/);
  });
});

describe('si Stripe no pinta el formulario, se ve el error', () => {
  it('la web escucha loaderror y no deja el botón sin formulario', () => {
    const web = leer('PagoTarjeta.web.tsx');
    expect(web).toMatch(/onLoadError=/);
    expect(web).toMatch(/onReady=/);
  });
});

describe('la app del cliente no funciona sin sesión (C-SESION-APP)', () => {
  it('todas sus pantallas van dentro de ConSesion y la sesión revisa el papel', () => {
    expect(leer('app/_layout.tsx')).toMatch(/<ConSesion[\s\S]*<Stack[\s\S]*<\/ConSesion>/);
    const sesion = readFileSync(
      join(CLIENTE, '..', '..', '..', 'packages', 'movil', 'src', 'sesion.tsx'),
      'utf8',
    );
    expect(sesion).toMatch(/roles\.includes\(r\.usuario\.rol\)/);
  });
});

describe('ensayo general del 12 oct: lo que se arregló no vuelve (C-ENSAYO-CALLE)', () => {
  it('la web tiene mapa de verdad (no coordenadas sueltas)', () => {
    expect(leer('MapaEntrega.web.tsx')).toMatch(/crearMapa/);
    expect(leer('ElegirEnMapa.web.tsx')).toMatch(/crearMapa/);
    expect(leer('MapaEntrega.web.tsx')).not.toMatch(/toFixed\(4\)/);
  });
  it('Enter en la contraseña entra', () => {
    const acceso = readFileSync(
      join(CLIENTE, '..', '..', '..', 'packages', 'movil', 'src', 'Acceso.tsx'),
      'utf8',
    );
    expect(acceso).toMatch(/alEnviar=\{/);
  });
});

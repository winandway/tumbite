import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, confirmar, llamar } from '../pruebas/flex';

/**
 * C-EMPRESA-LEGAL y C-PASE-WEB (31 oct 2026, LG1): la empresa de logística se registra desde la app
 * con sus datos legales (número fiscal validado por país) y la app abre su panel con un pase de un
 * solo uso, sin volver a escribir la clave.
 */
describe('registro legal de la empresa', () => {
  it('guarda el número fiscal, la dirección fiscal, el representante y el teléfono', async () => {
    const m = mundo();
    const d = await m.cuenta('cliente', 'Dueña Legal');
    await confirmar(m, d.id);
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas`,
      {
        nombre: 'Paquetes Legales',
        razonSocial: 'Paquetes Legales LLC',
        pais: 'US',
        moneda: 'USD',
        numeroFiscal: '12-3456789',
        direccionFiscal: '1 NW 1st St, Miami, FL',
        representante: 'Ana Pérez',
        telefono: '+13055550100',
      },
      d.token,
    );
    expect(r.estado).toBe(201);
    expect(r.datos.empresa.numeroFiscal).toBe('12-3456789');
    expect(r.datos.empresa.representante).toBe('Ana Pérez');
  });
  it('rechaza un número fiscal que no es del país', async () => {
    const m = mundo();
    const d = await m.cuenta('cliente', 'Dueño Mal');
    await confirmar(m, d.id);
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas`,
      { nombre: 'X', pais: 'US', moneda: 'USD', numeroFiscal: 'J-12345678-9' },
      d.token,
    );
    expect(r.estado).toBe(400);
    expect(r.datos.campo).toBe('numeroFiscal');
  });
});

describe('pase web de un solo uso', () => {
  it('abre la sesión en la vista web y no se puede usar dos veces', async () => {
    const m = mundo();
    const d = await m.cuenta('cliente', 'Dueña Pase');
    const p = await m.llamar('POST', '/datos/cuentas/pase-web', {}, d.token);
    expect(p.estado).toBe(200);
    const ir = await m.crudo(`/datos/cuentas/pase-web/${p.datos.codigo}?ir=/panel/business`, {
      redirect: 'manual',
    });
    expect(ir.status).toBe(302);
    expect(ir.headers.get('location')).toBe('/panel/business');
    expect(ir.headers.get('set-cookie')).toContain('tumbite_sesion=');
    const otra = await m.crudo(`/datos/cuentas/pase-web/${p.datos.codigo}`, { redirect: 'manual' });
    expect(otra.headers.get('set-cookie')).toBeNull();
  });
  it('nunca manda a otro sitio', async () => {
    const m = mundo();
    const d = await m.cuenta('cliente', 'Dueño Desvío');
    const p = await m.llamar('POST', '/datos/cuentas/pase-web', {}, d.token);
    const ir = await m.crudo(`/datos/cuentas/pase-web/${p.datos.codigo}?ir=https://otro.com`, {
      redirect: 'manual',
    });
    expect(ir.headers.get('location')).toBe('/panel');
  });
});

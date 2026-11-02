import { afterEach, describe, expect, it } from 'vitest';
import { enviarCorreo, esCorreoDePrueba, usarTransporteCorreo } from './correo';

/**
 * C-CORREO-RESERVADO (2 nov 2026): el sitio de pruebas creó 333 cuentas de recorrido en
 * «recorrido.test» y «prueba.invalid» y les mandó correo; se gastó el cupo diario de 1000 de la cuenta
 * y la respuesta de soporte a un restaurante real no salió. Las direcciones de dominios reservados
 * (que no existen) nunca llegan al servicio de correo.
 */
describe('correos a dominios reservados', () => {
  afterEach(() => usarTransporteCorreo(null));
  it('reconoce los dominios que no existen', () => {
    for (const c of [
      'a@recorrido.test',
      'b@prueba.invalid',
      'c@example.com',
      'd@sub.example.org',
      'e@ejemplo.com',
      'f@algo.example',
      'g@x.localhost',
    ])
      expect(esCorreoDePrueba(c)).toBe(true);
    for (const c of ['richard@gmail.com', 'soporte@divoox.com', 'x@test.com', 'y@examples.com'])
      expect(esCorreoDePrueba(c)).toBe(false);
  });
  it('no gasta un envío en una dirección de prueba, y el flujo sigue', async () => {
    let llamadas = 0;
    usarTransporteCorreo(
      () => {
        llamadas++;
        return Promise.resolve(new Response(JSON.stringify({ success: true, message_id: 'm' })));
      },
      { omitirDePrueba: true },
    );
    const env = { YAD_TOKEN: 'x'.repeat(40) } as never;
    const r = await enviarCorreo(env, {
      de: 'avisos',
      para: 'a@recorrido.test',
      asunto: 'A',
      texto: 'A',
    });
    expect(r.ok).toBe(true);
    expect(llamadas).toBe(0);
    await enviarCorreo(env, { de: 'avisos', para: 'richard@gmail.com', asunto: 'A', texto: 'A' });
    expect(llamadas).toBe(1);
  });
});

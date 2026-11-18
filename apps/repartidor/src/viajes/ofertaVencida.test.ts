import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claveOferta, ofertaParaMostrar } from './ofertaTiempo';

/**
 * C-OFERTA-VENCIDA-SE-CIERRA (robot de Android, 18 nov 2026): una oferta de Moto se quedó en «0 s»
 * más de 20 segundos (hasta que el sondeo la quitó), y la tarjeta iba con la llave del viaje: una
 * reoferta del MISMO viaje habría heredado la cuenta atrás vieja (en 0 s) sin volver a sonar.
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8');

describe('la oferta vencida se cierra y la reoferta es otra tarjeta', () => {
  const a = { operacionId: 'op-1', expiraEn: '2026-11-18 16:36:30' };
  const reoferta = { operacionId: 'op-1', expiraEn: '2026-11-18 16:37:30' };
  it('la reoferta del mismo viaje tiene otra llave', () => {
    expect(claveOferta(reoferta)).not.toBe(claveOferta(a));
  });
  it('lo que llegó a 0 s en este teléfono no se vuelve a pintar; la reoferta sí', () => {
    const vistas = new Set([claveOferta(a)]);
    expect(ofertaParaMostrar([a], vistas)).toBeNull();
    expect(ofertaParaMostrar([a, reoferta], vistas)).toBe(reoferta);
    expect(ofertaParaMostrar([reoferta], vistas)).toBe(reoferta);
  });
  it('las dos tarjetas se montan por oferta y avisan al llegar a 0 s', () => {
    const inicio = leer('Inicio.tsx');
    expect(inicio).toMatch(/key=\{claveOferta\(ofertaViaje\)\}/);
    expect(inicio).toMatch(/<Oferta\s+key=\{ofertaComida\.id\}/);
    expect(inicio).toMatch(/alVencer=/);
    expect(leer('viajes/OfertaViaje.tsx')).toMatch(/if \(quedan === 0\) alVencer\(\)/);
    expect(leer('grandes/Oferta.tsx')).toMatch(/if \(quedan === 0\) alVencer\?\.\(\)/);
  });
  // Revisor (18 nov 2026): la de comida sin `ofertaEn` nunca llegaba a 0; si la primera vencía
  // aquí, la siguiente no salía; y nadie paraba la alarma al cerrar sesión.
  it('comida: cuenta hasta 0 aunque no venga su hora, pasa a la siguiente y la alarma se para al salir', () => {
    expect(leer('grandes/Oferta.tsx')).toMatch(
      /const quedan = Math\.max\(0, Math\.ceil\(\(vence - ahora\) \/ 1000\)\)/,
    );
    const inicio = leer('Inicio.tsx');
    expect(inicio).toMatch(/ofertas\.find\(\(o\) => !vencidasAqui\.has\(`comida@\$\{o\.id\}`\)\)/);
    expect(inicio).toMatch(/useEffect\(\(\) => \(\) => pararAlarmaOferta\('sesion'\), \[\]\)/);
  });
  it('al volver la app al frente, el inicio pregunta ya (no espera la vuelta del sondeo)', () => {
    expect(leer('Inicio.tsx')).toMatch(
      /AppState\.addEventListener\('change'[\s\S]{0,160}void cargar\(\)/,
    );
  });
});

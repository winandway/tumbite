import { describe, expect, it } from 'vitest';
import {
  esVisitaCamila,
  nombreAutorCamila,
  nuevaVisitaCamila,
  visitaCamila,
  LLAVE_VISITA_CAMILA,
} from './camilaChat';

/**
 * C-CAMILA-CHAT (17 nov 2026) — todos los países. El chat de soporte de la web, el de Divoox Driver
 * y el buzón del superadmin dicen lo mismo de cada autor y comparten la ficha del navegador.
 */
describe('C-CAMILA-CHAT', () => {
  it('cada autor con su nombre en los dos idiomas', () => {
    expect(nombreAutorCamila('camila', 'es')).toBe(
      'Camila Montes, del equipo de soporte de Divoox',
    );
    expect(nombreAutorCamila('camila', 'en')).toBe('Camila Montes, Divoox Support Team');
    expect(nombreAutorCamila('equipo', 'es')).toBe('Equipo de soporte de Divoox');
    expect(nombreAutorCamila('equipo', 'en')).toBe('Divoox Support Team');
    expect(nombreAutorCamila('persona', 'es')).toBe('Tú');
    expect(nombreAutorCamila('persona', 'en')).toBe('You');
  });

  it('la ficha del navegador cumple lo que pide el servidor y se guarda una sola vez', () => {
    const f = nuevaVisitaCamila();
    expect(esVisitaCamila(f)).toBe(true);
    expect(f).toHaveLength(43);
    expect(nuevaVisitaCamila()).not.toBe(f);
    const mapa = new Map<string, string>();
    const almacen = {
      getItem: (k: string) => mapa.get(k) ?? null,
      setItem: (k: string, v: string) => void mapa.set(k, v),
    };
    const primera = visitaCamila(almacen);
    expect(mapa.get(LLAVE_VISITA_CAMILA)).toBe(primera);
    expect(visitaCamila(almacen)).toBe(primera);
    // Una ficha guardada que no sirve se reemplaza.
    mapa.set(LLAVE_VISITA_CAMILA, 'corta');
    expect(esVisitaCamila(visitaCamila(almacen))).toBe(true);
  });

  it('sin almacenamiento (ventana privada) igual hay ficha válida', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(esVisitaCamila(visitaCamila(roto))).toBe(true);
    expect(esVisitaCamila(visitaCamila(null))).toBe(true);
  });
});

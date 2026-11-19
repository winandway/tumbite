import { describe, expect, it } from 'vitest';
import {
  esVisitaCamila,
  nombreAutorCamila,
  nuevaVisitaCamila,
  visitaCamila,
  LLAVE_VISITA_CAMILA,
  esMarcaDeCaptura,
} from './camilaChat';

/**
 * C-CAMILA-CHAT (17 nov 2026) — todos los países. El chat de soporte de la web, el de Divoox Driver
 * y el buzón del superadmin dicen lo mismo de cada autor y comparten la ficha del navegador.
 */
describe('C-CAMILA-CHAT', () => {
  it('cada autor con su nombre en los dos idiomas', () => {
    // En cada mensaje va solo «Camila»: quién es ya lo dice el encabezado (no se repite).
    expect(nombreAutorCamila('camila', 'es')).toBe('Camila');
    expect(nombreAutorCamila('camila', 'en')).toBe('Camila');
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

describe('C-CAMILA-FALLOS: la captura antes de subirla', () => {
  it('acepta imágenes de hasta 10 MB y dice en palabras por qué no', async () => {
    const { problemaDeCaptura, TEXTOS_CHAT_SOPORTE } = await import('./camilaChat');
    expect(problemaDeCaptura({ size: 500_000, type: 'image/png' }, 'es')).toBeNull();
    expect(problemaDeCaptura({ size: 500_000, type: 'image/HEIC' }, 'en')).toBeNull();
    // El iPhone a veces no dice el tipo: el servidor revisa los bytes.
    expect(problemaDeCaptura({ size: 500_000, type: '' }, 'es')).toBeNull();
    expect(problemaDeCaptura({ size: 11 * 1024 * 1024, type: 'image/jpeg' }, 'es')).toBe(
      'La captura pesa demasiado. El máximo es 10 MB.',
    );
    expect(problemaDeCaptura({ size: 100, type: 'application/pdf' }, 'en')).toBe(
      'Send a JPG, PNG, WebP or HEIC image.',
    );
    expect(Object.keys(TEXTOS_CHAT_SOPORTE.en).sort()).toEqual(
      Object.keys(TEXTOS_CHAT_SOPORTE.es).sort(),
    );
    // C-CAMILA-REPORTE-CONVERSADO: la captura queda en el borrador y se envía con el mensaje.
    expect(TEXTOS_CHAT_SOPORTE.es.capturaLista).toBe('Captura lista. Se envía con tu mensaje.');
    expect(esMarcaDeCaptura('[Captura enviada]')).toBe(true);
    expect(esMarcaDeCaptura('[Screenshot sent]')).toBe(true);
    expect(esMarcaDeCaptura('una captura enviada')).toBe(false);
  });
});

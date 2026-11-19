import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type CierreViaje,
  cierreConRespuesta,
  cierreVigente,
  empezarCierre,
  ofertasEncimaDelCierre,
  pantallaViaje,
  viajeEnPantalla,
} from './cierreViaje';

/**
 * C-CIERRE-VIAJE-QUEDA (paquete 13, 19 nov 2026) — todos los países. «Viaje terminado» (y «Envío
 * entregado»), con el cobro en efectivo y la calificación del pasajero, volvía solo al inicio a los
 * tres segundos: el sondeo dejaba de ver el viaje y desmontaba la pantalla de cierre.
 *
 * Segunda vuelta (revisor, mismo día): el primer arreglo guardaba el viaje al LLEGAR la respuesta
 * del paso final. Si el sondeo (cada 5 s) traía `null` antes, `ViajeActivo` se desmontaba, la
 * respuesta tardía guardaba el viaje y el inicio montaba otro `ViajeActivo` SIN cierre sobre un viaje
 * terminado: «llegué / iniciar / deslizar» que daban error y nada lo limpiaba. Ahora el cierre vive
 * en el inicio, se guarda ANTES de mandar el paso, se suelta si falla, y una pantalla vuelta a montar
 * sobre un viaje en cierre arranca en el cierre. Mientras se ve el cierre, las ofertas nuevas van
 * encima (el servidor ya no lo cuenta ocupado).
 *
 * Prueba vista en ROJO antes del arreglo: con el `cierreViaje.ts` anterior fallaba todo el archivo
 * (no existían `empezarCierre` ni `pantallaViaje`) y el inicio no pintaba ofertas sobre el cierre.
 */
const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8');
type V = { id: string; estado: string };
const viaje: V = { id: 'a', estado: 'en_curso' };

describe('C-CIERRE-VIAJE-QUEDA: la secuencia completa', () => {
  it('el sondeo trae null ANTES de la respuesta del paso final: el conductor nunca ve el viaje como en curso', () => {
    let enCurso: V | null = viaje;
    let cierre: CierreViaje<V, { total: number }> | null = null;
    expect(pantallaViaje(enCurso, cierre)).toEqual({ modo: 'activo', viaje });
    // 1. Desliza «terminar»: el cierre se guarda antes de mandar el paso.
    cierre = empezarCierre(viaje, 'terminado');
    expect(pantallaViaje(enCurso, cierre)?.modo).toBe('enviando');
    // 2. El servidor ya cerró y el sondeo lo ve antes que la respuesta: sigue en pantalla.
    enCurso = null;
    expect(pantallaViaje(enCurso, cierre)).toEqual({ modo: 'enviando', viaje });
    // 3. Llega la respuesta tardía: se ve el cierre con el cobro del servidor.
    cierre = cierreConRespuesta(cierre, { total: 141 });
    expect(pantallaViaje(enCurso, cierre)).toEqual({ modo: 'cierre', viaje });
    expect(cierre.respuesta).toEqual({ total: 141 });
    // 4. Más sondeos con null: sigue el cierre (no vuelve solo al inicio).
    expect(pantallaViaje(null, cierre)?.modo).toBe('cierre');
    // 5. «Listo»: se suelta y vuelve el inicio.
    cierre = null;
    expect(pantallaViaje(enCurso, cierre)).toBeNull();
  });

  it('si el paso final falla, se suelta y vuelve el viaje en curso (o el inicio si ya no hay)', () => {
    let cierre: CierreViaje<V> | null = empezarCierre(viaje, 'terminado');
    expect(pantallaViaje(viaje, cierre)?.modo).toBe('enviando');
    cierre = null;
    expect(pantallaViaje(viaje, cierre)).toEqual({ modo: 'activo', viaje });
    expect(pantallaViaje(null, cierre)).toBeNull();
  });

  it('una oferta nueva aceptada manda sobre el cierre y lo suelta', () => {
    const cierre = cierreConRespuesta(empezarCierre<V, null>(viaje, 'terminado'), null);
    const nuevo: V = { id: 'b', estado: 'asignado' };
    expect(pantallaViaje(nuevo, cierre)).toEqual({ modo: 'activo', viaje: nuevo });
    expect(viajeEnPantalla(nuevo, viaje)).toEqual(nuevo);
  });

  it('las ofertas van encima del cierre ya respondido, nunca de un viaje en curso', () => {
    const enviando = empezarCierre<V, null>(viaje, 'terminado');
    expect(ofertasEncimaDelCierre(null, enviando)).toBe(false);
    expect(ofertasEncimaDelCierre(null, cierreConRespuesta(enviando, null))).toBe(true);
    expect(ofertasEncimaDelCierre(viaje, null)).toBe(false);
  });
});

describe('C-CIERRE-VIAJE-QUEDA: el inicio y la pantalla del viaje la usan', () => {
  it('el inicio guarda el cierre, pinta según `pantallaViaje`, sube arriba y pone las ofertas encima', () => {
    const i = leer('Inicio.tsx');
    expect(i).toMatch(
      /useState<CierreViaje<\s*ViajeConductor,\s*RespuestaCierre\s*> \| null>\(null\)/,
    );
    expect(i).toMatch(/pantallaViaje\(viajeActivo, cierreViaje\)/);
    expect(i).toMatch(/<ViajeActivo\s+key=\{viajeMostrado\.id\}/);
    expect(i).toMatch(/cierre=\{/);
    expect(i).toMatch(/scrollLienzo\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/);
    // Sobre el cierre, la hoja de la oferta (con su sonido).
    const ramaViaje = i.slice(i.indexOf("if (viajeMostrado && vista === 'inicio')"));
    expect(ramaViaje.slice(0, 4000)).toMatch(/ofertasSobreCierre \? hojasDeOferta : null/);
  });

  // Segunda devolución del revisor (19 nov 2026): al tocar Aceptar NO se suelta el cierre. Soltarlo
  // ahí mudaba la hoja de sitio mientras la aceptación iba de camino: la oferta reaparecía, la
  // alarma volvía a sonar y un segundo toque mandaba otra aceptación. Lo suelta el trabajo nuevo
  // cuando el sondeo lo trae (otro viaje, o un pedido de comida activo). En ROJO antes del cambio:
  // `alAceptar` llevaba `setCierreViaje(null)` y `cierreVigente` no miraba el pedido de comida.
  it('aceptar una oferta sobre el cierre no lo suelta al tocar; lo suelta el trabajo nuevo', () => {
    const i = leer('Inicio.tsx');
    const hojas = i.slice(
      i.indexOf('const hojasDeOferta = ('),
      i.indexOf('// ───────── Divoox Moto (M4)'),
    );
    expect(hojas).toContain('alAceptar');
    expect(hojas).not.toMatch(/setCierreViaje/);
    expect(i).toMatch(/cierreVigente\(c, v\.operacion, Boolean\(s\.activo\)\)/);
    const cierre = cierreConRespuesta(empezarCierre(viaje, 'terminado'), null);
    expect(cierreVigente(cierre, null)).toBe(cierre);
    expect(cierreVigente(cierre, null, false)).toBe(cierre);
    expect(cierreVigente(cierre, null, true)).toBeNull();
    expect(cierreVigente(cierre, { ...viaje, id: 'otro' })).toBeNull();
  });

  it('ViajeActivo guarda el cierre ANTES de mandar el paso final, lo suelta si falla, y arranca en el cierre si lo hay', () => {
    const a = leer('viajes/ViajeActivo.tsx');
    const paso = a.slice(a.indexOf('const paso = useCallback('));
    expect(paso).toMatch(
      /const enCierre = final \? empezarCierre<ViajeConductor, RespuestaCierre>\(viaje, final\) : null;/,
    );
    const antes = paso.indexOf('if (enCierre) alCierre(enCierre);');
    const post = paso.indexOf('await api.pedir');
    expect(antes).toBeGreaterThan(0);
    expect(post).toBeGreaterThan(antes);
    expect(paso.slice(0, 2500)).toMatch(/if \(final\) alCierre\(null\);/);
    expect(a).toMatch(/if \(cierre\?\.respondido && cierre\.viaje\.id === viaje\.id\)/);
    expect(a).toMatch(/alCierre\(null\);\s*alCambiar\(\);/);
  });
});

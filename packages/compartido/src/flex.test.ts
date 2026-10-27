import { describe, expect, it } from 'vitest';
import {
  PERMISOS_CLAVE_API,
  PERMISOS_POR_ROL,
  TRANSICIONES_PAQUETE,
  barrasCode128,
  code128B,
  codigoDesdeQr,
  contenidoQrEtiqueta,
  leerCsv,
  mapearEncabezados,
  nuevoCodigoEtiqueta,
  nuevoCodigoSeguimiento,
  puedeTransitar,
} from './flex';

const aleatorioFijo = (n: number) => new Uint8Array(Array.from({ length: n }, (_, i) => i * 7));

describe('Divoox Flex · compartido (C-FLEX-COMPARTIDO)', () => {
  it('la máquina de estados del paquete no admite saltos arbitrarios', () => {
    expect(puedeTransitar('creado', 'preparado')).toBe(true);
    expect(puedeTransitar('creado', 'entregado')).toBe(false);
    expect(puedeTransitar('en_transito', 'entregado')).toBe(true);
    expect(puedeTransitar('entregado', 'en_transito')).toBe(false);
    expect(puedeTransitar('entrega_fallida', 'en_devolucion')).toBe(true);
    for (const final of ['entregado', 'devuelto', 'cancelado'] as const)
      expect(TRANSICIONES_PAQUETE[final]).toEqual([]);
  });

  it('una clave de API nunca puede gestionar miembros, claves ni dinero', () => {
    expect(PERMISOS_CLAVE_API).not.toContain('miembros.gestionar');
    expect(PERMISOS_CLAVE_API).not.toContain('claves.gestionar');
    expect(PERMISOS_CLAVE_API).not.toContain('finanzas.ver');
    expect(PERMISOS_POR_ROL.operador).not.toContain('miembros.gestionar');
    expect(PERMISOS_POR_ROL.dueno).toContain('miembros.gestionar');
  });

  it('los códigos son opacos, sin letras confusas y con el formato esperado', () => {
    const s = nuevoCodigoSeguimiento(aleatorioFijo);
    const e = nuevoCodigoEtiqueta(aleatorioFijo);
    expect(s).toMatch(/^DVX[A-HJ-NP-Z2-9]{10}$/);
    expect(e).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    expect(codigoDesdeQr(contenidoQrEtiqueta(e))).toBe(e);
    expect(codigoDesdeQr('https://otro.sitio/x')).toBeNull();
  });

  it('Code 128 B: inicio, suma de control y STOP correctos (ejemplo conocido "A")', () => {
    // "A" = 33 → suma = 104 + 33*1 = 137 → 137 % 103 = 34. Patrones: 104, 33, 34, STOP.
    const esperado = ['211214', '131123', '131321', '2331112']
      .join('')
      .split('')
      .flatMap((a, i) => Array.from({ length: Number(a) }, () => i % 2 === 0));
    // Como cada patrón empieza en barra y tiene 6 (o 7) elementos, alternan barra/espacio seguidos.
    const modulos = code128B('A');
    expect(modulos.length).toBe(esperado.length);
    const barras = barrasCode128('A');
    expect(barras[0]).toEqual({ x: 0, ancho: 2 });
    expect(() => code128B('ñ')).toThrow();
  });

  it('lee CSV con comas, punto y coma, comillas y BOM; y mapea encabezados en los dos idiomas', () => {
    const texto =
      '\uFEFFreference;name;address;packages\n"A-1";"Ana, López";"Calle 1 ""B""";2\nA-2;Luis;Calle 2;1\n';
    const filas = leerCsv(texto);
    expect(filas).toEqual([
      ['reference', 'name', 'address', 'packages'],
      ['A-1', 'Ana, López', 'Calle 1 "B"', '2'],
      ['A-2', 'Luis', 'Calle 2', '1'],
    ]);
    expect(mapearEncabezados(filas[0] as string[])).toEqual({
      referencia: 0,
      destinatario: 1,
      direccion: 2,
      paquetes: 3,
    });
    expect(mapearEncabezados(['Referencia', 'Destinatario', 'Dirección', 'Teléfono'])).toEqual({
      referencia: 0,
      destinatario: 1,
      direccion: 2,
      telefono: 3,
    });
  });
});

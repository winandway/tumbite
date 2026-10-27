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

describe('Divoox Flex · Fase 2 · compartido (C-FLEX-RUTAS)', () => {
  it('la ruta no salta estados y una ruta cerrada no se mueve', async () => {
    const { TRANSICIONES_RUTA, ESTADOS_RUTA_ACTIVA } = await import('./flex');
    expect(TRANSICIONES_RUTA.borrador).toContain('asignada');
    expect(TRANSICIONES_RUTA.en_curso).not.toContain('cancelada');
    expect(TRANSICIONES_RUTA.completada).toEqual([]);
    expect(ESTADOS_RUTA_ACTIVA).toEqual(['asignada', 'aceptada', 'en_carga', 'en_curso']);
  });

  it('pruebas exigidas: el envío manda sobre la empresa; sin contacto reemplaza PIN y firma pero exige foto', async () => {
    const { configEntrega, pruebasFaltantes } = await import('./flex');
    const c = configEntrega('{"pin":true,"sinContacto":true}', '{"firma":true}');
    expect(c).toMatchObject({ foto: true, pin: true, firma: true, sinContacto: true });
    expect(pruebasFaltantes(c, { foto: true, pin: true, firma: true, sinContacto: false })).toEqual(
      [],
    );
    expect(
      pruebasFaltantes(c, { foto: false, pin: true, firma: false, sinContacto: false }),
    ).toEqual(['foto', 'firma']);
    expect(
      pruebasFaltantes(c, { foto: true, pin: false, firma: false, sinContacto: true }),
    ).toEqual([]);
    expect(
      pruebasFaltantes(configEntrega('{"foto":false,"sinContacto":true}'), {
        foto: false,
        pin: false,
        firma: false,
        sinContacto: true,
      }),
    ).toEqual(['foto']);
    expect(configEntrega('no es json', null)).toMatchObject({ foto: true, pin: false });
  });

  it('el escáner reconoce el QR, el Code 128 y el código de seguimiento; lo demás no', async () => {
    const { leerCodigoEscaneado } = await import('./flex');
    expect(leerCodigoEscaneado('dvx:ABCDEFGHJKMN')).toEqual({
      tipo: 'etiqueta',
      codigo: 'ABCDEFGHJKMN',
    });
    expect(leerCodigoEscaneado(' abcdefghjkmn ')).toEqual({
      tipo: 'etiqueta',
      codigo: 'ABCDEFGHJKMN',
    });
    expect(leerCodigoEscaneado('DVXABCDEFGHJK')).toEqual({
      tipo: 'seguimiento',
      codigo: 'DVXABCDEFGHJK',
    });
    expect(leerCodigoEscaneado('tumbite:pedido:123')).toBeNull();
    expect(leerCodigoEscaneado('ABCDEFGHIJKL')).toBeNull(); // la I no existe en el alfabeto
  });

  it('la cola sin conexión sincroniza en orden, se detiene sin red, marca conflictos y no repite', async () => {
    const { crearColaFlex } = await import('./flex');
    let guardado: string | null = null;
    let n = 0;
    const cola = crearColaFlex(
      { leer: async () => guardado, escribir: async (v) => void (guardado = v) },
      () => `a${++n}`,
    );
    for (const tipo of ['escaneo', 'escaneo', 'llegada', 'entrega'] as const)
      await cola.agregar({ tipo, rutaId: 'r1', ruta: `/x/${tipo}`, cuerpo: {} });
    const vistos: string[] = [];
    // Primer intento: la segunda acción no tiene red → se detiene y no toca las siguientes.
    let r = await cola.sincronizar(async (a) => {
      vistos.push(a.id);
      return a.id === 'a2' ? { ok: false, sinRed: true, error: 'sin red' } : { ok: true };
    });
    expect(r.confirmadas.map((a) => a.id)).toEqual(['a1']);
    expect(vistos).toEqual(['a1', 'a2']);
    expect((await cola.listar()).map((a) => [a.id, a.estado, a.intentos])).toEqual([
      ['a2', 'pendiente', 1],
      ['a3', 'pendiente', 0],
      ['a4', 'pendiente', 0],
    ]);
    // Segundo: la llegada choca (conflicto): queda en «error», visible, y la entrega sigue.
    r = await cola.sincronizar(async (a) =>
      a.id === 'a3' ? { ok: false, sinRed: false, error: 'La parada ya se cerró.' } : { ok: true },
    );
    expect(r.confirmadas.map((a) => a.id)).toEqual(['a2', 'a4']);
    expect(r.rechazadas.map((a) => a.error)).toEqual(['La parada ya se cerró.']);
    expect((await cola.listar()).map((a) => [a.id, a.estado])).toEqual([['a3', 'error']]);
    // Un error no se reenvía solo; se descarta a mano.
    const otra = await cola.sincronizar(async () => ({ ok: true }));
    expect(otra.confirmadas).toEqual([]);
    await cola.descartar('a3');
    expect(await cola.listar()).toEqual([]);
    // Dos sincronizaciones a la vez no mandan la misma acción dos veces.
    await cola.agregar({ tipo: 'escaneo', rutaId: 'r1', ruta: '/x', cuerpo: {} });
    let envios = 0;
    const lenta = async () => {
      envios++;
      await new Promise((ok) => setTimeout(ok, 5));
      return { ok: true } as const;
    };
    await Promise.all([cola.sincronizar(lenta), cola.sincronizar(lenta)]);
    expect(envios).toBe(1);
  });
});

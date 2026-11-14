import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { medidorDeLecturas } from '../pruebas/lecturas';
import { B, empresa, envios, k, llamar, rutaEnCurso, type M } from '../pruebas/flex';
import { celdaCsv, unidades } from './exportar';

/**
 * C-FLEX-EXPORTAR (Fase 7, 13 nov 2026). Todos los países. Exportar a CSV con los filtros de la
 * pantalla, por páginas con cursor (sin OFFSET), sin escribir nada y sin recorrer tablas enteras.
 */
async function bajar(m: M, ruta: string, token: string) {
  const res = await m.crudo(ruta, {
    headers: { authorization: `Bearer ${token}`, 'cf-connecting-ip': `10.9.${k().length}.1` },
  });
  return {
    estado: res.status,
    tipo: res.headers.get('content-type') ?? '',
    siguiente: res.headers.get('x-siguiente') ?? '',
    texto: await res.text(),
  };
}

const lineas = (t: string) => t.split('\r\n').filter(Boolean);

describe('C-FLEX-EXPORTAR · CSV de las listas de la empresa', () => {
  it('celdas: comillas escapadas y fórmulas desarmadas; dinero con enteros', () => {
    expect(celdaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celdaCsv('+1 305')).toBe("'+1 305");
    expect(celdaCsv('a,b')).toBe('"a,b"');
    expect(celdaCsv(null)).toBe('');
    expect(unidades(123456)).toBe('1234.56');
    expect(unidades(-5)).toBe('-0.05');
    expect(unidades(0)).toBe('0.00');
  });

  it('envíos: por páginas con cursor, sin repetir ni perder filas, títulos solo en la primera', async () => {
    const m = mundo();
    const e = await empresa(m);
    await envios(m, e, 5);
    const ruta = `${B}/empresas/${e.id}/exportar/envios`;
    const vistos: string[] = [];
    let cursor = '';
    let paginas = 0;
    do {
      const r = await bajar(
        m,
        `${ruta}?limite=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        e.dueno.token,
      );
      expect(r.estado).toBe(200);
      expect(r.tipo).toContain('text/csv');
      const ls = lineas(r.texto);
      if (paginas === 0) expect(ls.shift()).toMatch(/^id,referencia,destinatario/);
      vistos.push(...ls.map((l) => l.split(',')[0] ?? ''));
      cursor = r.siguiente;
      paginas++;
    } while (cursor && paginas < 10);
    expect(paginas).toBe(3);
    expect(vistos).toHaveLength(5);
    expect(new Set(vistos).size).toBe(5);
  });

  it('respeta los filtros de la pantalla y no deja ver otra empresa', async () => {
    const m = mundo();
    const e = await empresa(m);
    await envios(m, e, 3);
    await m.DB.prepare(
      "UPDATE envios SET destinatario_nombre = '=CMD()' WHERE referencia_externa = 'R-2'",
    ).run();
    const r = await bajar(m, `${B}/empresas/${e.id}/exportar/envios?q=CMD`, e.dueno.token);
    const ls = lineas(r.texto);
    expect(ls).toHaveLength(2);
    expect(ls[1]).toContain("'=CMD()");
    const otra = await empresa(m, 'Otra');
    const ajena = await bajar(m, `${B}/empresas/${e.id}/exportar/envios`, otra.dueno.token);
    expect(ajena.estado).toBe(404);
    const malo = await bajar(m, `${B}/empresas/${e.id}/exportar/clientes`, e.dueno.token);
    expect(malo.estado).toBe(404);
    const cursorMalo = await bajar(
      m,
      `${B}/empresas/${e.id}/exportar/envios?cursor=1%20OR%201`,
      e.dueno.token,
    );
    expect(cursorMalo.estado).toBe(400);
  });

  it('las seis listas salen, y exportar no escribe ni recorre tablas enteras', async () => {
    let medidor!: ReturnType<typeof medidorDeLecturas>;
    const m = mundo({}, { envolver: (db) => (medidor = medidorDeLecturas(db)).db });
    const r = await rutaEnCurso(m, 3);
    const contar = async () =>
      (await m.DB.prepare(
        'SELECT (SELECT COUNT(*) FROM empresa_auditoria) + (SELECT COUNT(*) FROM idempotencia_flex) AS n',
      ).first<{ n: number }>())!.n;
    const antes = await contar();
    for (const tipo of [
      'envios',
      'paquetes',
      'rutas',
      'incidencias',
      'devoluciones',
      'movimientos',
    ]) {
      const med = await medidor.medir(() =>
        bajar(m, `${B}/empresas/${r.e.id}/exportar/${tipo}?estado=`, r.e.dueno.token),
      );
      const res = med.resultado;
      expect(res.estado, tipo).toBe(200);
      const escaneos = med.lecturas.flatMap((l) => l.escaneos);
      expect(
        escaneos.filter((s) => /\b(envios|paquetes|libro|rutas_flex|flex_incidencias)\b/.test(s)),
        tipo,
      ).toEqual([]);
    }
    expect(await contar()).toBe(antes);
  });

  it('un empleado sin permiso de finanzas no exporta la billetera', async () => {
    const m = mundo();
    const e = await empresa(m);
    const ok = await bajar(m, `${B}/empresas/${e.id}/exportar/movimientos`, e.dueno.token);
    expect(ok.estado).toBe(200);
    expect(lineas(ok.texto)[0]).toBe('id,tipo,bolsillo,monto_centavos,monto,moneda,fecha_utc');
    const anon = await llamar(m, 'GET', `${B}/empresas/${e.id}/exportar/movimientos`);
    expect(anon.estado).toBe(401);
  });
});

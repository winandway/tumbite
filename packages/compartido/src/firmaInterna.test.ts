import { describe, expect, it } from 'vitest';
import {
  CABECERAS_FIRMA,
  DURACION_PASE_S,
  emitirPase,
  firmarPeticion,
  verificarFirma,
  verificarPase,
} from './firmaInterna';

const ACTUAL = { id: 'v2', secreto: 'a'.repeat(40) };
const ANTERIOR = { id: 'v1', secreto: 'b'.repeat(40) };
const ahora = 1_800_000_000;
const leerDe = (h: Record<string, string>) => (k: string) => h[k as keyof typeof h];

describe('firma entre servidores', () => {
  it('acepta la firma correcta con la llave actual y con la anterior (rotación)', async () => {
    for (const llave of [ACTUAL, ANTERIOR]) {
      const h = await firmarPeticion(llave, 'POST', '/datos/interno/reloj', '{"a":1}', ahora);
      const r = await verificarFirma(
        [ACTUAL, ANTERIOR],
        'POST',
        '/datos/interno/reloj',
        '{"a":1}',
        leerDe(h),
        ahora,
      );
      expect(r.ok).toBe(true);
    }
  });

  it('rechaza cuerpo, ruta o método cambiados, llave retirada, reloj desfasado y cabeceras que faltan', async () => {
    const h = await firmarPeticion(ACTUAL, 'POST', '/datos/interno/reloj', '{"a":1}', ahora);
    const v = (m: string, ruta: string, cuerpo: string, cab = h, t = ahora, llaves = [ACTUAL]) =>
      verificarFirma(llaves, m, ruta, cuerpo, leerDe(cab), t);
    expect(await v('POST', '/datos/interno/reloj', '{"a":2}')).toMatchObject({
      motivo: 'firma_invalida',
    });
    expect(await v('POST', '/datos/interno/otra', '{"a":1}')).toMatchObject({
      motivo: 'firma_invalida',
    });
    expect(await v('PUT', '/datos/interno/reloj', '{"a":1}')).toMatchObject({
      motivo: 'firma_invalida',
    });
    expect(await v('POST', '/datos/interno/reloj', '{"a":1}', h, ahora + 61)).toMatchObject({
      motivo: 'fuera_de_tiempo',
    });
    expect(await v('POST', '/datos/interno/reloj', '{"a":1}', h, ahora - 61)).toMatchObject({
      motivo: 'fuera_de_tiempo',
    });
    const conAnterior = await firmarPeticion(ANTERIOR, 'POST', '/x', '', ahora);
    expect(await v('POST', '/x', '', conAnterior)).toMatchObject({ motivo: 'llave_desconocida' });
    const sinNonce = Object.fromEntries(
      Object.entries(h).filter(([k]) => k !== CABECERAS_FIRMA.nonce),
    );
    expect(await v('POST', '/datos/interno/reloj', '{"a":1}', sinNonce)).toMatchObject({
      motivo: 'faltan_cabeceras',
    });
  });

  it('una llave corta o vacía nunca vale', async () => {
    const corta = { id: 'v2', secreto: 'corta' };
    const h = await firmarPeticion(corta, 'POST', '/x', '', ahora);
    expect(await verificarFirma([corta], 'POST', '/x', '', leerDe(h), ahora)).toMatchObject({
      ok: false,
    });
    expect(
      await verificarFirma([null, undefined], 'POST', '/x', '', leerDe(h), ahora),
    ).toMatchObject({ ok: false });
  });
});

describe('pase corto del tiempo real', () => {
  it('se verifica sin llamar al servidor y vence a los 15 minutos', async () => {
    const { pase, vence } = await emitirPase(
      ACTUAL,
      { u: 'rep1', rol: 'repartidor', zona: 'US-FL-MIAMI' },
      ahora,
    );
    expect(vence).toBe(ahora + DURACION_PASE_S);
    expect(await verificarPase([ACTUAL], pase, ahora + 10)).toMatchObject({
      u: 'rep1',
      rol: 'repartidor',
    });
    expect(await verificarPase([ACTUAL], pase, ahora + DURACION_PASE_S)).toBeNull();
  });

  it('un pase alterado, de otra llave o mal formado no vale', async () => {
    const { pase } = await emitirPase(
      ACTUAL,
      { u: 'rep1', rol: 'repartidor', zona: 'US-FL-MIAMI' },
      ahora,
    );
    const [cuerpo, firma] = pase.split('.') as [string, string];
    const otro = JSON.parse(atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/'))) as Record<
      string,
      unknown
    >;
    otro.zona = 'US-NY-NYC';
    const falso = `${btoa(JSON.stringify(otro)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.${firma}`;
    expect(await verificarPase([ACTUAL], falso, ahora)).toBeNull();
    expect(await verificarPase([{ id: 'v2', secreto: 'c'.repeat(40) }], pase, ahora)).toBeNull();
    for (const malo of ['', 'a.b.c', 'sinpunto', `${cuerpo}.`, 'x'.repeat(3000)])
      expect(await verificarPase([ACTUAL], malo, ahora)).toBeNull();
  });

  it('el pase de cliente exige el pedido que sigue', async () => {
    const sin = await emitirPase(ACTUAL, { u: 'c1', rol: 'cliente', zona: 'US-FL-MIAMI' }, ahora);
    expect(await verificarPase([ACTUAL], sin.pase, ahora)).toBeNull();
    const con = await emitirPase(
      ACTUAL,
      { u: 'c1', rol: 'cliente', zona: 'US-FL-MIAMI', p: 'ped1', r: 'rep1' },
      ahora,
    );
    expect(await verificarPase([ACTUAL, ANTERIOR], con.pase, ahora)).toMatchObject({
      p: 'ped1',
      r: 'rep1',
    });
  });
});

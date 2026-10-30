import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServidor, firmar, firmaValida } from './servidor';
import { decidir, type Entrada, type Resultado } from './verificar';

/** C-KYC-MOTOR (29 oct 2026): la puerta firmada del motor y la regla de la decisión. */
const CLAVE = 'k'.repeat(40);
let recibida: Entrada | null = null;
const motorFalso = async (e: Entrada): Promise<Resultado> => {
  recibida = e;
  return {
    decision: 'verificado',
    motivos: [],
    datos: null,
    huella: null,
    similitud: 0.8,
    parecidas: [],
  };
};
const servidor = crearServidor(CLAVE, motorFalso);
let url = '';
beforeAll(async () => {
  await new Promise<void>((r) => servidor.listen(0, r));
  url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => servidor.close(() => r())));

const cuerpo = JSON.stringify({
  docTipo: 'licencia',
  frente: Buffer.from('frente').toString('base64'),
  reverso: Buffer.from('reverso').toString('base64'),
  selfie: Buffer.from('selfie').toString('base64'),
  giros: [Buffer.from('g1').toString('base64'), Buffer.from('g2').toString('base64')],
});
const pedir = (hora: string, firma: string, body = cuerpo) =>
  fetch(`${url}/verificar`, {
    method: 'POST',
    body,
    headers: { 'x-hora': hora, 'x-firma': firma },
  });

describe('puerta firmada del motor (C-KYC-MOTOR)', () => {
  it('con la firma buena responde la decisión y recibe las fotos', async () => {
    const hora = String(Date.now());
    const r = await pedir(hora, firmar(CLAVE, hora, cuerpo));
    expect(r.status).toBe(200);
    expect(((await r.json()) as Resultado).decision).toBe('verificado');
    expect(recibida?.reverso?.toString()).toBe('reverso');
    expect(recibida?.giros?.[1].toString()).toBe('g2');
  });

  it('sin firma, con otra clave, con el cuerpo cambiado o vieja, no mira nada', async () => {
    recibida = null;
    const hora = String(Date.now());
    expect((await pedir(hora, '')).status).toBe(401);
    expect((await pedir(hora, firmar('otra'.repeat(10), hora, cuerpo))).status).toBe(401);
    expect(
      (await pedir(hora, firmar(CLAVE, hora, cuerpo), cuerpo.replace('licencia', 'pasaporte')))
        .status,
    ).toBe(401);
    const vieja = String(Date.now() - 10 * 60 * 1000);
    expect((await pedir(vieja, firmar(CLAVE, vieja, cuerpo))).status).toBe(401);
    expect(recibida).toBeNull();
    expect(firmaValida(CLAVE, hora, 'zz', cuerpo)).toBe(false);
  });

  it('la salud responde sin firma; lo demás no existe', async () => {
    expect(await (await fetch(`${url}/salud`)).json()).toEqual({ ok: true });
    expect((await fetch(`${url}/otra`)).status).toBe(404);
  });

  it('datos malos con firma buena: 400', async () => {
    const malo = JSON.stringify({ docTipo: 'carnet', frente: 'x', selfie: 'y' });
    const hora = String(Date.now());
    expect((await pedir(hora, firmar(CLAVE, hora, malo), malo)).status).toBe(400);
  });
});

describe('la decisión (C-KYC-MOTOR)', () => {
  it('todo bien, verificado; lo que se arregla con fotos nuevas, repetir; lo dudoso, revisión', () => {
    expect(decidir([])).toBe('verificado');
    expect(decidir(['vencido'])).toBe('repetir');
    expect(decidir(['cara_distinta', 'menor_de_edad'])).toBe('repetir');
    expect(decidir(['menor_de_edad'])).toBe('revision');
    expect(decidir(['documento_sin_codigo'])).toBe('revision');
    expect(decidir(['cara_parecida_a_cuenta_cerrada'])).toBe('revision');
  });
});

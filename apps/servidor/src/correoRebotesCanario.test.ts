import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import {
  MINIMO_ENLACES_TASA,
  TASA_REBOTE_AMARILLA,
  TASA_REBOTE_ROJA,
  estadoRebotes,
} from './correo';

/**
 * C-CORREO-REBOTES-CANARIO (23 nov 2026): con el correo en segundo plano (C-CORREO-NO-FRENA), una ola de
 * direcciones mal escritas ya no frena a nadie y podría pasar sin que nadie la viera. La pieza
 * «correoRebotes» de /datos/salud se pone amarilla o roja si la tasa de rebote de 24 h se dispara (con
 * un mínimo de volumen: dos cuentas no hacen una alarma). Una sola lectura, por índice. Todos los países.
 */
type Mundo = ReturnType<typeof mundo>;
async function sembrar(m: Mundo, enlaces: number, rebotes: number) {
  const usuario = await m.cuenta('cliente', 'Persona Prueba');
  for (let i = 0; i < enlaces; i++)
    await m.DB.prepare(
      "INSERT INTO confirmaciones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+2 days'))",
    )
      .bind(`enlace-${i}`, usuario.id)
      .run();
  for (let i = 0; i < rebotes; i++)
    await m.DB.prepare('INSERT INTO correos_rebotados (correo, motivo) VALUES (?, ?)')
      .bind(`rebote-${i}@correo-real.com`, '550 5.1.1')
      .run();
}
const pieza = async (m: Mundo) =>
  ((await m.llamar('GET', '/datos/salud')).datos as { piezas: Record<string, string> }).piezas
    .correoRebotes;

describe('C-CORREO-REBOTES-CANARIO · la tasa de rebote del correo, a la vista', () => {
  it('pieza pura: poco volumen nunca alarma; amarilla desde el 10 %, roja desde el 25 %', () => {
    expect(estadoRebotes(5, 5)).toBe('ok');
    expect(estadoRebotes(0, MINIMO_ENLACES_TASA - 1)).toBe('ok');
    expect(estadoRebotes(1, 100)).toBe('ok');
    expect(estadoRebotes(TASA_REBOTE_AMARILLA * 100, 100)).toBe('atrasado');
    expect(estadoRebotes(TASA_REBOTE_ROJA * 100, 100)).toBe('error');
    // Más rebotes que enlaces (correos que no son de confirmación) no pasan del 100 %.
    expect(estadoRebotes(40, 10)).toBe('error');
  });

  it('/datos/salud dice «ok» con poco volumen, aunque todos reboten', async () => {
    const m = mundo();
    await sembrar(m, 3, 3);
    expect(await pieza(m)).toBe('ok');
  });

  it('/datos/salud se pone amarilla con una tasa alta y roja con una muy alta', async () => {
    const amarilla = mundo();
    await sembrar(amarilla, 40, 6);
    expect(await pieza(amarilla)).toBe('atrasado');
    const roja = mundo();
    await sembrar(roja, 40, 15);
    expect(await pieza(roja)).toBe('error');
    const salud = await roja.llamar('GET', '/datos/salud');
    expect(salud.datos.correo).toMatchObject({ rebotes24h: 15 });
    expect(salud.datos.correo.enlaces24h).toBeGreaterThanOrEqual(40);
    // Nada personal en la salida.
    expect(JSON.stringify(salud.datos)).not.toContain('rebote-0@');
  });

  it('los rebotes de hace más de un día ya no cuentan', async () => {
    const m = mundo();
    await sembrar(m, 40, 15);
    await m.DB.prepare("UPDATE correos_rebotados SET creado_en = datetime('now', '-2 days')").run();
    expect(await pieza(m)).toBe('ok');
  });
});

/* eslint-disable security/detect-non-literal-fs-filename -- íconos fijos del repositorio */
// C-LAMINA-PLAY-COLOR-APP (26 nov 2026): la lámina de Google Play de cada app lleva el color de su
// app. Estas pruebas fallan si alguien vuelve a pintar las tres en negro o cambia un color a mano.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALTO,
  ANCHO,
  LAMINAS,
  colorDeApp,
  comprobarIcono,
  comprobarLamina,
} from './lamina-play.mjs';

const lisa = (hex, { ancho = ANCHO, alto = ALTO, alfa = false } = {}) =>
  sharp({
    create: {
      width: ancho,
      height: alto,
      channels: alfa ? 4 : 3,
      background: alfa ? { r: 0, g: 0, b: 0, alpha: 0.5 } : hex,
    },
  })
    .png()
    .toBuffer();

describe('C-LAMINA-PLAY-COLOR-APP', () => {
  it('cada app tiene su color, el de su ícono: cliente rojo, Driver azul petróleo, Restaurants negro', () => {
    expect(colorDeApp('cliente')).toBe('#F20D20');
    expect(colorDeApp('repartidor')).toBe('#1F4D69');
    expect(colorDeApp('restaurante')).toBe('#101010');
    expect(LAMINAS.map((l) => l.app)).toEqual(['cliente', 'repartidor', 'restaurante']);
  });

  it('una lámina negra no pasa como lámina del cliente ni de Driver (lo que se subió el 26 oct)', async () => {
    const negra = await lisa('#101010');
    await expect(comprobarLamina(negra, colorDeApp('cliente'))).rejects.toThrow(/color de su app/);
    await expect(comprobarLamina(negra, colorDeApp('repartidor'))).rejects.toThrow(
      /color de su app/,
    );
    await expect(comprobarLamina(negra, colorDeApp('restaurante'))).resolves.toBeTruthy();
  });

  it('la lámina del color de su app pasa', async () => {
    for (const { app } of LAMINAS)
      await expect(
        comprobarLamina(await lisa(colorDeApp(app)), colorDeApp(app)),
      ).resolves.toBeTruthy();
  });

  it('rechaza el tamaño equivocado y la transparencia', async () => {
    const rojo = colorDeApp('cliente');
    await expect(comprobarLamina(await lisa(rojo, { ancho: 1000 }), rojo)).rejects.toThrow(
      /1024×500/,
    );
    await expect(comprobarLamina(await lisa(rojo, { alfa: true }), rojo)).rejects.toThrow(
      /transparencia/,
    );
  });

  it('el resalte de la frase no es el mismo color del fondo (no desaparece)', () => {
    for (const { app, resalte } of LAMINAS) expect(resalte.toUpperCase()).not.toBe(colorDeApp(app));
  });

  it('el ícono de cada app lleva su color; un ícono negro no pasa como el de Driver', async () => {
    for (const { app } of LAMINAS) {
      const png = await sharp(
        readFileSync(join(import.meta.dirname, '..', '..', 'apps', app, 'assets', 'icon.png')),
      )
        .resize(512, 512)
        .ensureAlpha(1)
        .png()
        .toBuffer();
      await expect(comprobarIcono(png, colorDeApp(app))).resolves.toBeUndefined();
    }
    const sinAlfa = await lisa(colorDeApp('repartidor'), { ancho: 512, alto: 512 });
    await expect(comprobarIcono(sinAlfa, colorDeApp('repartidor'))).rejects.toThrow(/32 bits/);
    const negro = await sharp(await lisa('#101010', { ancho: 512, alto: 512 }))
      .ensureAlpha(1)
      .png()
      .toBuffer();
    await expect(comprobarIcono(negro, colorDeApp('repartidor'))).rejects.toThrow(
      /color de su app/,
    );
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fotoSirveDeAvatar } from './servicios/logica';

/**
 * C-MODO-DESTINO-UN-LUGAR y C-AVATAR-SIN-LINEA (robot de Android, 18 nov 2026). La tarjeta «Modo
 * destino» salía en Inicio, Perfil y Ganancias porque iba dentro de `mensajes`, que se pinta en
 * todas las vistas. Como en Uber Driver y DoorDash, va solo en el inicio.
 */
const fuente = readFileSync(join(import.meta.dirname, 'Inicio.tsx'), 'utf8');

describe('«Modo destino» en un solo lugar: el inicio', () => {
  it('no va dentro de los mensajes comunes a todas las vistas', () => {
    const desde = fuente.indexOf('const mensajes = (');
    const hasta = fuente.indexOf('\n  );', desde);
    expect(desde).toBeGreaterThan(0);
    expect(fuente.slice(desde, hasta)).not.toContain('<ModoDestino');
  });
  it('se dibuja una sola vez: en la hoja «Modo destino» del inicio (C-REDISENO-DRIVER)', () => {
    expect(fuente.match(/<ModoDestino\b/g)).toHaveLength(1);
    const desde = fuente.indexOf('testID="hoja-modo-destino"');
    expect(desde).toBeGreaterThan(fuente.indexOf('C-REDISENO-DRIVER: el inicio del borrador'));
    expect(fuente.slice(desde, fuente.indexOf('</HojaDriver>', desde))).toContain('<ModoDestino');
  });
});

describe('el avatar no estira una foto diminuta', () => {
  it('menos de 32 px por lado (o sin medidas) no sirve: van las iniciales', () => {
    expect(fotoSirveDeAvatar(1, 1)).toBe(false);
    expect(fotoSirveDeAvatar(undefined, undefined)).toBe(false);
    expect(fotoSirveDeAvatar(400, 400)).toBe(true);
  });
});

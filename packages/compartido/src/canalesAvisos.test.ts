import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAPACIDADES_AVISOS,
  canalParaAparato,
  capacidadesDeCanales,
  canalesExtra,
} from './avisosCanal';

/**
 * C-CANALES-AVISOS (24 nov 2026) — todos los países. Cada aviso urgente o de dinero tiene su canal y
 * su sonido; el teléfono que no los declaró (las apps ya publicadas) sigue recibiendo como siempre.
 */
const app = (nombre: string) =>
  JSON.parse(readFileSync(new URL(`../../../apps/${nombre}/app.json`, import.meta.url), 'utf8'))
    .expo.extra as Record<string, unknown>;
const IMP = { max: 5, normal: 3 };

describe('C-CANALES-AVISOS · qué canal y qué sonido le toca a cada teléfono', () => {
  it('con la capacidad: el canal propio y su sonido', () => {
    expect(canalParaAparato({ canal: 'panico' }, ['canal-panico'])).toEqual({
      channelId: 'panico',
      sound: 'panico.wav',
    });
    expect(
      canalParaAparato({ canal: 'pedido_nuevo', sonido: 'alarma.wav' }, ['canal-pedido-nuevo']),
    ).toEqual({ channelId: 'pedido_nuevo', sound: 'pedido_nuevo_largo.wav' });
  });

  it('sin la capacidad (app ya publicada): el canal de siempre y su sonido de siempre', () => {
    expect(canalParaAparato({ canal: 'panico' }, [])).toEqual({
      channelId: 'pedidos',
      sound: 'default',
    });
    expect(canalParaAparato({ canal: 'pedido_nuevo', sonido: 'alarma.wav' }, [])).toEqual({
      channelId: 'pedidos',
      sound: 'alarma.wav',
    });
  });

  it('en Restaurants nuevo, lo común va por «avisos» con el tono normal (no suena a alarma)', () => {
    const caps = ['canal-avisos', 'canal-pedido-nuevo'];
    expect(canalParaAparato({}, caps)).toEqual({ channelId: 'avisos', sound: 'default' });
    expect(canalParaAparato({ canal: 'pedido_nuevo', sonido: 'alarma.wav' }, caps).channelId).toBe(
      'pedido_nuevo',
    );
  });

  it('el servidor entiende todas las capacidades que declaran las apps', () => {
    for (const nombre of ['cliente', 'repartidor', 'restaurante'])
      for (const c of capacidadesDeCanales(app(nombre), 'android', IMP).capacidades)
        expect(CAPACIDADES_AVISOS).toContain(c);
  });
});

describe('C-CANALES-AVISOS · los canales de cada app', () => {
  it('clientes: llegó tu conductor, dinero y pánico', () => {
    expect(canalesExtra(app('cliente'), IMP).map((c) => c.id)).toEqual([
      'panico',
      'dinero',
      'llego',
    ]);
  });
  it('Driver: pánico y dinero', () => {
    expect(canalesExtra(app('repartidor'), IMP).map((c) => c.id)).toEqual(['panico', 'dinero']);
  });
  it('Restaurants: pedido nuevo (largo), pánico, dinero y lo común aparte, con importancia normal', () => {
    const c = canalesExtra(app('restaurante'), IMP);
    expect(c.map((x) => x.id)).toEqual(['pedido_nuevo', 'panico', 'dinero', 'avisos']);
    expect(c.find((x) => x.id === 'avisos')?.importance).toBe(3);
    expect(c.find((x) => x.id === 'pedido_nuevo')?.sound).toBe('pedido_nuevo_largo.wav');
    expect(c.find((x) => x.id === 'panico')?.bypassDnd).toBe(true);
  });
  it('Restaurants en iPhone no declara nada: queda exactamente como Apple lo revisa', () => {
    expect(capacidadesDeCanales(app('restaurante'), 'ios', IMP)).toEqual({
      crear: [],
      capacidades: [],
    });
    expect(capacidadesDeCanales(app('cliente'), 'ios', IMP).capacidades).toContain('canal-llego');
    expect(capacidadesDeCanales(app('cliente'), 'ios', IMP).crear).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { listaActivacion, textoActivacion } from './activacion';

const completo = {
  telefono: '3055550100',
  lat: 25.77,
  lng: -80.19,
  turnos: 7,
  platosVendibles: 6,
  platosConFoto: 6,
  cobroConectado: true,
};

describe('lista de activación del restaurante (C-ACTIVACION)', () => {
  it('con todo cargado está lista', () => {
    expect(listaActivacion(completo).lista).toBe(true);
  });
  it('sin teléfono, sin pin, sin horario o sin un plato vendible NO se abre', () => {
    expect(listaActivacion({ ...completo, telefono: '' }).lista).toBe(false);
    expect(listaActivacion({ ...completo, lat: null }).lista).toBe(false);
    expect(listaActivacion({ ...completo, turnos: 0 }).lista).toBe(false);
    expect(listaActivacion({ ...completo, platosVendibles: 0 }).lista).toBe(false);
  });
  it('las fotos y la cuenta de cobro se recomiendan pero no bloquean', () => {
    const a = listaActivacion({ ...completo, platosConFoto: 0, cobroConectado: false });
    expect(a.lista).toBe(true);
    expect(a.items.filter((i) => !i.listo).map((i) => i.clave)).toEqual(['fotos', 'cobro']);
  });
  it('cada punto tiene su texto en los dos idiomas', () => {
    for (const i of listaActivacion(completo).items) {
      expect(textoActivacion(i.clave, 'es')).toBeTruthy();
      expect(textoActivacion(i.clave, 'en')).toBeTruthy();
    }
  });
});

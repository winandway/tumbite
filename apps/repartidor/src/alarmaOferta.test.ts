import { describe, expect, it, vi } from 'vitest';
import { TOPE_MS, crearAlarmaOferta, type MotorAlarma } from './alarmaOferta';

/**
 * C-OFERTA-SUENA-EN-BUCLE: la oferta suena en bucle mientras está en pantalla y NUNCA se queda
 * sonando: se calla al aceptar, rechazar, vencer, retirarse, salir de la pantalla, cerrar sesión o
 * irse la app al fondo, y tiene su propio tope por si nadie la para.
 */
function preparar() {
  let t = 1_000_000;
  const tareas: { fn: () => void; cuando: number; id: number }[] = [];
  let sig = 0;
  const reloj = {
    ahora: () => t,
    programar: (fn: () => void, ms: number) => {
      const id = ++sig;
      tareas.push({ fn, cuando: t + ms, id });
      return id;
    },
    cancelar: (id: unknown) => {
      const i = tareas.findIndex((x) => x.id === id);
      if (i >= 0) tareas.splice(i, 1);
    },
  };
  const avanzar = (ms: number) => {
    t += ms;
    for (const x of [...tareas].filter((x) => x.cuando <= t)) {
      reloj.cancelar(x.id);
      x.fn();
    }
  };
  let suena = false;
  let vibra = false;
  const motor: MotorAlarma = {
    sonar: vi.fn(() => {
      suena = true;
    }),
    callar: vi.fn(() => {
      suena = false;
    }),
    vibrar: vi.fn(() => {
      vibra = true;
    }),
    dejarDeVibrar: vi.fn(() => {
      vibra = false;
    }),
    quitarAviso: vi.fn(),
  };
  const alarma = crearAlarmaOferta(motor, reloj);
  return {
    alarma,
    motor,
    avanzar,
    ahora: () => t,
    estado: () => ({ suena, vibra }),
    pendientes: () => tareas.length,
  };
}

describe('alarma de la oferta (C-OFERTA-SUENA-EN-BUCLE)', () => {
  for (const motivo of ['aceptada', 'rechazada', 'retirada', 'salio', 'sesion', 'fondo'] as const)
    it(`se calla y deja de vibrar: ${motivo}`, () => {
      const p = preparar();
      p.alarma.empezar('of-1', p.ahora() + 30_000);
      expect(p.estado()).toEqual({ suena: true, vibra: true });
      p.avanzar(5_000);
      expect(p.alarma.parar(motivo)).toBe(true);
      expect(p.estado()).toEqual({ suena: false, vibra: false });
      expect(p.motor.quitarAviso).toHaveBeenCalledWith('of-1');
      expect(p.alarma.sonando()).toBeNull();
      expect(p.pendientes()).toBe(0);
    });

  it('se calla sola cuando la oferta vence, aunque nadie la pare', () => {
    const p = preparar();
    p.alarma.empezar('of-1', p.ahora() + 30_000);
    p.avanzar(29_000);
    expect(p.estado().suena).toBe(true);
    p.avanzar(3_100);
    expect(p.estado()).toEqual({ suena: false, vibra: false });
    expect(p.alarma.ultimaParada()).toBe('tope');
  });

  it('nunca suena más que el tope, aunque el vencimiento venga mal', () => {
    const p = preparar();
    p.alarma.empezar('of-1', p.ahora() + 10 * 60_000);
    p.avanzar(TOPE_MS);
    expect(p.estado().suena).toBe(false);
  });

  it('una oferta ya vencida no suena, pero se quita de la bandeja', () => {
    const p = preparar();
    p.alarma.empezar('of-1', p.ahora() - 1_000);
    expect(p.motor.sonar).not.toHaveBeenCalled();
    expect(p.motor.quitarAviso).toHaveBeenCalledWith('of-1');
  });

  it('una oferta nueva calla la anterior: nunca dos a la vez', () => {
    const p = preparar();
    p.alarma.empezar('of-1', p.ahora() + 30_000);
    p.alarma.empezar('of-2', p.ahora() + 30_000);
    expect(p.motor.callar).toHaveBeenCalledTimes(1);
    expect(p.alarma.sonando()).toBe('of-2');
    // El tope viejo no calla la nueva.
    expect(p.pendientes()).toBe(1);
  });

  it('volver a pintar la misma oferta no la reinicia', () => {
    const p = preparar();
    p.alarma.empezar('of-1', p.ahora() + 30_000);
    p.alarma.empezar('of-1', p.ahora() + 30_000);
    expect(p.motor.sonar).toHaveBeenCalledTimes(1);
  });

  it('parar con el id de otra oferta no calla la que suena', () => {
    const p = preparar();
    p.alarma.empezar('of-2', p.ahora() + 30_000);
    expect(p.alarma.parar('salio', 'of-1')).toBe(false);
    expect(p.estado().suena).toBe(true);
  });

  it('si callar falla, igual deja de vibrar y suelta el tope', () => {
    const p = preparar();
    p.motor.callar = () => {
      throw new Error('sin audio');
    };
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    p.alarma.empezar('of-1', p.ahora() + 30_000);
    p.alarma.parar('aceptada');
    expect(p.estado().vibra).toBe(false);
    expect(p.pendientes()).toBe(0);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

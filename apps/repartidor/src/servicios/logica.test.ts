import { describe, expect, it } from 'vitest';
import { puedeConectar } from '../../../../packages/movil/src/serviciosLogica';
import {
  destinoDePaso,
  detalleServicio,
  franjaPausa,
  hayConectables,
  nombreServicio,
  ordenarServicios,
  textoLlevando,
  textoTrasDesconectar,
  tituloLlevando,
  unirLista,
  type ServicioPanel,
} from './logica';

// C-SERVICIOS-CONECTADOS (DRIVER.md §2 y §6): lo que dice el panel de servicios del Driver.
const s = (
  servicioId: ServicioPanel['servicioId'],
  estado: ServicioPanel['estado'],
  extra: Partial<ServicioPanel> = {},
): ServicioPanel => ({
  servicioId,
  nombre: servicioId,
  vehiculo: null,
  estado,
  motivo: 'habilitado',
  requisitosFaltantes: [],
  ...extra,
});

describe('texto de pausa según lo que lleva', () => {
  it('comida, envío y viaje tienen su título y su «hasta cuándo»', () => {
    expect(tituloLlevando('comida', 'es')).toBe('Estás llevando una comida');
    expect(tituloLlevando('envio', 'es')).toBe('Estás llevando un envío');
    expect(tituloLlevando('viaje', 'es')).toBe('Estás llevando un pasajero');
    expect(tituloLlevando('comida', 'en')).toBe('You’re delivering a food order');
    expect(textoLlevando('comida', 'es')).toBe(
      'Lo demás está en pausa. Vuelve solo cuando entregues.',
    );
    expect(textoLlevando('viaje', 'es')).toContain('termine el viaje');
  });

  it('la franja nombra los servicios en pausa y dice hasta cuándo', () => {
    const panel = {
      lleva: { servicioId: 'comida', tipo: 'comida' as const },
      servicios: [
        s('comida', 'haciendo'),
        s('envios', 'en_pausa', { vehiculo: 'moto' }),
        s('moto', 'en_pausa'),
        s('carro', 'desconectado'),
      ],
    };
    const f = franjaPausa(panel, 'es')!;
    expect(f.titulo).toBe('En pausa: Envíos en moto y Moto con pasajero');
    expect(f.texto).toBe('No te llegan ofertas hasta entregar esta comida.');
    expect(
      franjaPausa({ ...panel, lleva: { servicioId: 'envios', tipo: 'envio' } }, 'es')!.texto,
    ).toBe('No te llegan ofertas hasta entregar este envío.');
    expect(franjaPausa(panel, 'en')!.titulo).toBe('Paused: Deliveries by moto and Moto rides');
  });

  it('sin nada que lleve o sin servicios en pausa, no hay franja', () => {
    expect(franjaPausa({ lleva: null, servicios: [s('moto', 'en_pausa')] }, 'es')).toBeNull();
    expect(
      franjaPausa(
        { lleva: { servicioId: 'comida', tipo: 'comida' }, servicios: [s('comida', 'haciendo')] },
        'es',
      ),
    ).toBeNull();
  });
});

describe('la tarjeta según el servidor', () => {
  it('un servicio que no está aprobado nunca ofrece conectar', () => {
    for (const estado of ['en_revision', 'agregar', 'bloqueado_flex', 'en_pausa'] as const)
      expect(puedeConectar(estado), estado).toBe(false);
    expect(puedeConectar('desconectado')).toBe(true);
    expect(hayConectables([s('carro', 'en_revision'), s('envios', 'agregar')])).toBe(false);
    expect(hayConectables([s('comida', 'desconectado')])).toBe(true);
  });

  it('cada estado tiene su segunda línea', () => {
    expect(detalleServicio(s('comida', 'conectado'), 'es')).toBe('Esperando pedidos');
    expect(detalleServicio(s('envios', 'conectado'), 'es')).toBe('Esperando envíos');
    expect(detalleServicio(s('moto', 'conectado'), 'en')).toBe('Waiting for rides');
    expect(detalleServicio(s('carro', 'bloqueado_flex'), 'es')).toBe('Hasta terminar el bloque');
    expect(detalleServicio(s('carro', 'agregar'), 'es')).toBe('Agregar este servicio');
    expect(
      detalleServicio(
        s('carro', 'en_revision', { requisitosFaltantes: ['seguro', 'registro'] }),
        'es',
      ),
    ).toBe('Faltan 2 papeles');
  });

  it('Envíos dice con qué vehículo; lo conectado va arriba', () => {
    expect(nombreServicio(s('envios', 'conectado', { vehiculo: 'carro' }), 'es')).toBe(
      'Envíos en carro',
    );
    expect(nombreServicio(s('comida', 'conectado', { vehiculo: 'moto' }), 'es')).toBe('Comida');
    expect(
      ordenarServicios([
        s('carro', 'agregar'),
        s('moto', 'desconectado'),
        s('comida', 'conectado'),
      ]).map((x) => x.servicioId),
    ).toEqual(['comida', 'moto', 'carro']);
  });

  it('a igual estado, el orden del diseño: Comida, Envíos, Moto y Carro', () => {
    expect(
      ordenarServicios([
        s('moto', 'conectado'),
        s('envios', 'conectado'),
        s('comida', 'conectado'),
      ]).map((x) => x.servicioId),
    ).toEqual(['comida', 'envios', 'moto']);
  });

  it('une listas en palabras', () => {
    expect(unirLista(['A'], 'es')).toBe('A');
    expect(unirLista(['A', 'B', 'C'], 'en')).toBe('A, B and C');
  });

  it('cada paso que falta lleva a la pantalla de alta que ya existe', () => {
    expect(destinoDePaso('carro', 'identidad', 'perfil')).toBe('identidad');
    expect(destinoDePaso('carro', 'seguro_vehiculo', 'vehiculo')).toBe('alta-carro');
    expect(destinoDePaso('moto', 'antecedentes_pasajeros', 'perfil')).toBe('alta-moto');
    expect(destinoDePaso('envios', 'seguro_vehiculo', 'vehiculo')).toBe('datos-reparto');
    expect(destinoDePaso('envios', 'antecedentes', 'perfil')).toBe('identidad');
  });
});

describe('C-ULTIMO-SERVICIO: el aviso al desconectar dice la verdad', () => {
  it('si quedan otros conectados, «Lo demás sigue conectado»', () => {
    const lista = [s('comida', 'desconectado'), s('moto', 'conectado')];
    expect(textoTrasDesconectar(lista, 'comida', 'es')).toBe('Lo demás sigue conectado.');
  });
  it('al desconectar el ÚLTIMO, no dice que lo demás sigue conectado', () => {
    const lista = [
      s('comida', 'desconectado'),
      s('moto', 'conectado'),
      s('envios', 'no_disponible' as never),
    ];
    for (const idioma of ['es', 'en'] as const) {
      const t = textoTrasDesconectar(lista, 'moto', idioma);
      expect(t).not.toMatch(/sigue conectado|still on/);
    }
    expect(textoTrasDesconectar(lista, 'moto', 'es')).toBe('Ya no te llegan ofertas.');
  });
});

// C-CAMBIAR-VEHICULO (robot, 18 nov 2026): la tarjeta decía «Falta 1 papel» cuando lo que faltaba
// era usar el otro vehículo (el Corolla tenía todo).
describe('la tarjeta dice con qué vehículo funciona el servicio', () => {
  it('«Usa tu Toyota Corolla» en vez de «Falta 1 papel»', () => {
    const carro = s('carro', 'en_revision', {
      motivo: 'requisitos_faltantes',
      requisitosFaltantes: ['inspeccion_vehiculo'],
      cambiarA: { id: 'v1', nombre: 'Toyota Corolla', tipo: 'carro' },
    });
    expect(detalleServicio(carro, 'es')).toBe('Usa tu Toyota Corolla');
    expect(detalleServicio(carro, 'en')).toBe('Use your Toyota Corolla');
  });
});

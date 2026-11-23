import { describe, expect, it } from 'vitest';
import {
  FORMULARIO_VACIO,
  SENSIBLES_RUTINA,
  type ConductorConfianza,
  type Rutina,
  cuerpoConfianza,
  cuerpoRutina,
  diasDeTexto,
  diasATexto,
  formularioDe,
  horaTexto,
  letrasDias,
  paraServicio,
  proximaSalida,
  textoDias,
  textoVehiculo,
  conductorPorDefecto,
} from './fijos';

const conductor = (x: Partial<ConductorConfianza> = {}): ConductorConfianza => ({
  id: 'c-00000001',
  nombre: 'Juan',
  foto: false,
  conectado: true,
  viajes: 4,
  aceptaMenores: true,
  servicios: ['moto'],
  vehiculo: {
    tipo: 'moto',
    marca: 'Motos Divoox',
    modelo: 'M150',
    color: 'Rojo',
    placa: 'AB1C23D',
  },
  desde: '2026-11-10 12:00:00',
  ...x,
});

const rutina = (x: Partial<Rutina> = {}): Rutina => ({
  id: 'r1',
  nombre: 'Escuela de Sofía',
  servicio: 'moto',
  categoria: 'estandar',
  origen: { direccion: 'Avenida Bolívar, El Vigía', lat: 8.62, lng: -71.65 },
  destino: { direccion: 'Calle 5, El Vigía', lat: 8.63, lng: -71.64 },
  dias: [1, 2, 3, 4, 5],
  horaIda: '07:00',
  horaVuelta: '12:30',
  metodoPago: 'efectivo',
  zonaHoraria: 'America/Caracas',
  estado: 'activa',
  pausadaHasta: null,
  conductor: { id: 'c-00000001', nombre: 'Juan' },
  menor: { nombre: 'Sofía', pin: '4821' },
  paquete: null,
  proximas: [{ fecha: '2026-11-17', sentido: 'ida', hora: '2026-11-17T11:00:00.000Z' }],
  salidas: [],
  ...x,
});

describe('conductores de confianza', () => {
  it('al pedir solo se ofrecen los que hacen ese servicio', () => {
    const lista = [
      conductor(),
      conductor({ id: 'c-00000002', nombre: 'Ana', servicios: ['carro'] }),
      conductor({ id: 'c-00000003', nombre: 'Luis', servicios: ['moto', 'envios'] }),
    ];
    expect(paraServicio(lista, 'moto').map((c) => c.nombre)).toEqual(['Juan', 'Luis']);
    expect(paraServicio(lista, 'envios').map((c) => c.nombre)).toEqual(['Luis']);
    expect(paraServicio(lista, 'carro').map((c) => c.nombre)).toEqual(['Ana']);
  });

  it('manda «confianza» solo cuando la persona eligió', () => {
    const lista = [conductor()];
    expect(cuerpoConfianza('', lista)).toEqual({});
    expect(cuerpoConfianza('ninguno', lista)).toEqual({ confianza: 'ninguno' });
    expect(cuerpoConfianza('c-00000001', lista)).toEqual({ confianza: 'c-00000001' });
    // Uno que ya no está entre los suyos (lo quitó en otra pantalla): el servidor elige solo.
    expect(cuerpoConfianza('c-99999999', lista)).toEqual({});
  });

  it('por defecto se muestra el conectado; si no hay, el primero', () => {
    expect(
      conductorPorDefecto([
        conductor({ conectado: false }),
        conductor({ id: 'c-2', nombre: 'Ana', conectado: true }),
      ])?.nombre,
    ).toBe('Ana');
    expect(conductorPorDefecto([conductor({ conectado: false })])?.nombre).toBe('Juan');
    expect(conductorPorDefecto([])).toBeNull();
  });

  it('el vehículo se dice con marca, modelo, color y placa', () => {
    expect(textoVehiculo(conductor().vehiculo)).toBe('Motos Divoox M150 · Rojo · AB1C23D');
    expect(textoVehiculo(null)).toBe('');
  });
});

describe('días y horas de un viaje fijo', () => {
  it('las letras de los días en los dos idiomas', () => {
    expect(letrasDias('es')).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    expect(letrasDias('en')).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('los días se dicen como los diría una persona', () => {
    expect(textoDias([1, 2, 3, 4, 5], 'es')).toBe('De lunes a viernes');
    expect(textoDias([1, 2, 3, 4, 5], 'en')).toBe('Weekdays');
    expect(textoDias([1, 2, 3, 4, 5, 6, 7], 'es')).toBe('Todos los días');
    expect(textoDias([6, 7], 'en')).toBe('Weekends');
    expect(textoDias([1, 3, 5], 'es')).toBe('Lun, mié, vie');
    expect(textoDias([2, 4], 'en')).toBe('Tue, Thu');
  });

  it('la hora en 12 horas', () => {
    expect(horaTexto('07:00', 'en')).toBe('7:00 AM');
    expect(horaTexto('12:30', 'en')).toBe('12:30 PM');
    expect(horaTexto('19:05', 'es')).toBe('7:05 p. m.');
    expect(horaTexto('00:15', 'es')).toBe('12:15 a. m.');
  });

  it('los días van y vienen del borrador en texto', () => {
    expect(diasATexto([5, 1, 3])).toBe('1,3,5');
    expect(diasDeTexto('1,3,5')).toEqual([1, 3, 5]);
    expect(diasDeTexto('')).toEqual([]);
    expect(diasDeTexto('9,x,2')).toEqual([2]);
  });

  it('la próxima salida que no está saltada', () => {
    expect(proximaSalida(rutina())).toEqual({
      fecha: '2026-11-17',
      sentido: 'ida',
      hora: '2026-11-17T11:00:00.000Z',
    });
    expect(proximaSalida(rutina({ proximas: [] }))).toBeNull();
  });
});

describe('formulario del viaje fijo', () => {
  it('el PIN del menor nunca se guarda en el borrador', () => {
    expect(SENSIBLES_RUTINA).toContain('pin');
  });

  it('al editar, se llena con lo guardado (también el PIN, que solo ve el responsable)', () => {
    const f = formularioDe(rutina());
    expect(f.nombre).toBe('Escuela de Sofía');
    expect(f.dias).toBe('1,2,3,4,5');
    expect(f.conVuelta).toBe(true);
    expect(f.horaVuelta).toBe('12:30');
    expect(f.esMenor).toBe(true);
    expect(f.menorNombre).toBe('Sofía');
    expect(f.pin).toBe('4821');
    expect(f.conductorId).toBe('c-00000001');
    expect(f.origenLat).toBe('8.62');
  });

  const lleno = {
    ...FORMULARIO_VACIO,
    nombre: 'Al trabajo',
    servicio: 'moto',
    origen: 'Avenida Bolívar, El Vigía',
    origenLat: '8.62',
    origenLng: '-71.65',
    destino: 'Calle 5, El Vigía',
    destinoLat: '8.63',
    destinoLng: '-71.64',
    dias: '1,2,3,4,5',
    horaIda: '07:00',
  };

  it('arma el cuerpo que espera el servidor', () => {
    const r = cuerpoRutina(lleno, 'USD');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cuerpo).toMatchObject({
      nombre: 'Al trabajo',
      servicio: 'moto',
      origen: { direccion: 'Avenida Bolívar, El Vigía', lat: 8.62, lng: -71.65 },
      dias: [1, 2, 3, 4, 5],
      horaIda: '07:00',
      horaVuelta: null,
      conductorId: null,
      menor: null,
    });
    expect(r.cuerpo).not.toHaveProperty('paquete');
  });

  it('dice qué falta, en palabras, antes de mandar', () => {
    expect(cuerpoRutina({ ...lleno, nombre: 'A' }, 'USD')).toEqual({
      ok: false,
      falta: 'nombre',
    });
    expect(cuerpoRutina({ ...lleno, origenLat: '' }, 'USD')).toEqual({
      ok: false,
      falta: 'origen',
    });
    expect(cuerpoRutina({ ...lleno, dias: '' }, 'USD')).toEqual({ ok: false, falta: 'dias' });
    expect(cuerpoRutina({ ...lleno, horaIda: '7' }, 'USD')).toEqual({
      ok: false,
      falta: 'horaIda',
    });
    expect(cuerpoRutina({ ...lleno, conVuelta: true, horaVuelta: '06:00' }, 'USD')).toEqual({
      ok: false,
      falta: 'horaVuelta',
    });
    expect(
      cuerpoRutina({ ...lleno, esMenor: true, menorNombre: 'Sofía', pin: '12' }, 'USD'),
    ).toEqual({ ok: false, falta: 'pin' });
  });

  it('con menor manda su nombre y su PIN; con conductor, su id', () => {
    const r = cuerpoRutina(
      { ...lleno, esMenor: true, menorNombre: 'Sofía', pin: '4821', conductorId: 'c-00000001' },
      'USD',
    );
    expect(r.ok && r.cuerpo.menor).toEqual({ nombre: 'Sofía', pin: '4821' });
    expect(r.ok && r.cuerpo.conductorId).toBe('c-00000001');
  });

  it('un envío lleva su paquete, va solo de ida y nunca lleva menor', () => {
    const envio = {
      ...lleno,
      servicio: 'envios',
      conVuelta: true,
      horaVuelta: '18:00',
      esMenor: true,
      menorNombre: 'Sofía',
      pin: '4821',
      paqueteDescripcion: 'Documentos',
      paqueteTamano: 'sobre',
      paqueteValor: '10',
      destinatarioNombre: 'María',
      destinatarioTelefono: '+58 412 000 0000',
      sinProhibidos: true,
    };
    const r = cuerpoRutina(envio, 'USD');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cuerpo.horaVuelta).toBeNull();
    expect(r.cuerpo.menor).toBeNull();
    expect(r.cuerpo.paquete).toEqual({
      descripcion: 'Documentos',
      tamano: 'sobre',
      valorDeclarado: 1000,
      destinatario: { nombre: 'María', telefono: '+58 412 000 0000' },
      sinProhibidos: true,
    });
    expect(cuerpoRutina({ ...envio, sinProhibidos: false }, 'USD')).toEqual({
      ok: false,
      falta: 'prohibidos',
    });
    expect(cuerpoRutina({ ...envio, paqueteDescripcion: '' }, 'USD')).toEqual({
      ok: false,
      falta: 'paquete',
    });
  });
});

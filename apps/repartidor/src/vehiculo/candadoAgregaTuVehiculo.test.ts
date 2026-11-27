import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fotosQueFaltan, papelesDeAlta, tiposDisponibles } from './tiposVehiculo';

/**
 * C-AGREGA-TU-VEHICULO (27 nov 2026, Richard lo vio en su Android: «el paso de la moto es confuso: no
 * se entiende dónde está el perfil, ni cómo agregar la moto, ni cómo elegir el tipo») — todos los
 * países. Una sola entrada, «Agrega tu vehículo», para todo conductor: con qué vas a trabajar, datos
 * con el nombre arriba y fotos en el mismo recorrido, y al terminar el vehículo REAL queda guardado
 * (`/datos/conductor/vehiculos`). «Datos para Comida y Envíos» ya no escribe el vehículo (eran datos
 * sueltos que no creaban el vehículo y el panel decía que no había ninguno).
 */
const raiz = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-AGREGA-TU-VEHICULO', () => {
  const agregar = leer('vehiculo/AgregarVehiculo.tsx');
  const misDatos = leer('MisDatos.tsx');
  const perfil = leer('servicios/PerfilAcordeon.tsx');
  const textos = leer('servicios/textos.ts');
  const agregarServicio = leer('servicios/AgregarServicio.tsx');

  it('«Datos para Comida y Envíos» ya no tiene casillas del vehículo', () => {
    expect(misDatos).not.toMatch(/campo\('(marca|modelo|anio|color|placa)'/);
    expect(misDatos).not.toMatch(/t\.(marca|modelo|placa)\b/);
    expect(misDatos).toContain('<AgregarVehiculo');
    expect(misDatos).toContain('misdatos-tu-vehiculo');
    // El servidor sigue exigiendo el tipo: los campos del vehículo se mandan tal como vinieron.
    expect(misDatos).toContain("api.pedir('PUT', '/datos/repartidor/datos', v)");
    expect(textos).not.toContain('tu vehículo de reparto');
  });

  it('el perfil ofrece «Agrega tu vehículo» a todos, también a quien solo hace Comida', () => {
    expect(textos).toContain("agregaTuVehiculo: 'Agrega tu vehículo'");
    expect(perfil).toContain('t.agregaTuVehiculo');
    // Sin condición de «ofrece Moto o Carro»: el botón ya no depende del servicio.
    expect(perfil).not.toMatch(/ofrece\('(moto|carro)'\)/);
    expect(perfil).not.toContain('t.agregarMoto');
    expect(perfil).not.toContain('t.agregarCarro');
    expect(perfil).toContain('<AgregarVehiculo');
  });

  it('un vehículo en revisión se ve en gris con «En revisión»', () => {
    expect(perfil).toMatch(/v\.estado === 'en_revision' \? COLOR\.superficie/);
    expect(perfil).toContain('t.enRevisionVehiculo');
  });

  it('«Agregar servicio» abre el mismo recorrido para el vehículo', () => {
    expect(agregarServicio).toContain('<AgregarVehiculo');
  });

  it('el recorrido pide las fotos del frente y de la placa ANTES de terminar', () => {
    expect(agregar).toContain('fotosQueFaltan(');
    expect(agregar).toContain("'foto_frente'");
    // La validación va en el paso de fotos, antes de `return true` que dispara terminar.
    expect(agregar).toMatch(/fotosQueFaltan\([\s\S]{0,400}return false[\s\S]{0,200}return true/);
    expect(agregar).toContain('/documentos?tipo=');
  });

  it('el recorrido guarda el vehículo REAL en el servidor y lo envía a revisión', () => {
    expect(agregar).toContain("'/datos/conductor/vehiculos'");
    expect(agregar).toContain('/datos/conductor/vehiculos/${guardado.id}');
    expect(agregar).toContain('/enviar');
    expect(agregar).toContain('<FormularioPorPasos');
    expect(agregar).toContain('useBorrador');
    // El borrador solo se limpia cuando el servidor confirmó el envío.
    expect(agregar).toMatch(/\/enviar[\s\S]{0,600}await b\.limpiar\(\)/);
  });

  it('cada casilla lleva su nombre arriba y su tipo (año y placa)', () => {
    expect(agregar).toContain("tipo={campo === 'anio' ? 'anioVehiculo'");
    expect(agregar).toContain('etiqueta={etiqueta}');
  });
});

describe('tipos y fotos del recorrido', () => {
  it('Comida y Envíos aceptan los cinco tipos; Moto y Carro, solo el suyo', () => {
    expect(tiposDisponibles(['comida'])).toEqual([
      'moto',
      'carro',
      'scooter',
      'bicicleta',
      'a_pie',
    ]);
    expect(tiposDisponibles(['moto'])).toEqual(['moto']);
    expect(tiposDisponibles(['carro'])).toEqual(['carro']);
    expect(tiposDisponibles(['moto', 'carro'])).toEqual(['moto', 'carro']);
    expect(tiposDisponibles(undefined)).toHaveLength(5);
  });

  it('las fotos del frente y la placa van primero y obligan a terminar', () => {
    expect(papelesDeAlta(['registro', 'foto_frente', 'seguro'], 'moto', []).slice(0, 3)).toEqual([
      'foto_frente',
      'foto_placa',
      'registro',
    ]);
    expect(papelesDeAlta(undefined, 'scooter', [])).toEqual([
      'foto_frente',
      'foto_placa',
      'registro',
      'seguro',
    ]);
    expect(fotosQueFaltan([])).toEqual(['foto_frente', 'foto_placa']);
    expect(fotosQueFaltan([{ tipo: 'foto_frente', estado: 'pendiente' }])).toEqual(['foto_placa']);
    expect(
      fotosQueFaltan([
        { tipo: 'foto_frente', estado: 'pendiente' },
        { tipo: 'foto_placa', estado: 'aprobado' },
      ]),
    ).toEqual([]);
    // Una foto rechazada no cuenta: hay que subir otra.
    expect(fotosQueFaltan([{ tipo: 'foto_frente', estado: 'rechazado' }])).toContain('foto_frente');
  });
});

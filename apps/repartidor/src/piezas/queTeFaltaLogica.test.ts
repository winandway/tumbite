import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { avisoDeFalta, faltaPlaca, primeraFalta } from './queTeFaltaLogica';

/**
 * C-QUE-TE-FALTA (23 nov 2026): Driver dice lo que el servidor calculó, una cosa a la vez, con su
 * botón directo; lo que está en manos del equipo va sin botón. Y el vehículo guardado se corrige.
 */
describe('C-QUE-TE-FALTA · lo que ve el conductor', () => {
  it('una cosa a la vez, la primera de la lista; «desconectado» lo dice la barra', () => {
    const p = primeraFalta(
      [
        { clave: 'desconectado', quien: 'conductor' },
        { clave: 'sin_placa', quien: 'conductor', vehiculoTipo: 'moto', vehiculoId: 'v1' },
        { clave: 'sin_pago_movil', quien: 'conductor' },
      ],
      'es',
    );
    expect(p?.aviso.titulo).toBe('A tu moto le falta la placa');
    expect(p?.aviso.accion).toBe('vehiculo');
    expect(p?.despues).toBe(1);
    expect(primeraFalta([{ clave: 'desconectado', quien: 'conductor' }], 'es')).toBeNull();
  });
  it('lo que hacemos nosotros va sin botón y lo dice así', () => {
    const a = avisoDeFalta(
      { clave: 'vehiculo_en_revision', quien: 'divoox', vehiculoTipo: 'moto' },
      'es',
    );
    expect(a?.titulo).toBe('Estamos revisando tu moto');
    expect(a?.boton).toBeNull();
    expect(a?.nuestro).toBe(true);
    const en = avisoDeFalta(
      { clave: 'vehiculo_en_revision', quien: 'divoox', vehiculoTipo: 'carro' },
      'en',
    );
    expect(en?.titulo).toBe('We’re reviewing your car');
    // C-SERVICIO-SIN-OFERTA: sin restaurantes en la zona, se dice la verdad y sin botón.
    const sr = avisoDeFalta({ clave: 'sin_restaurantes', quien: 'divoox' }, 'es');
    expect(sr?.titulo).toBe('Todavía no hay restaurantes en tu zona');
    expect(sr?.boton).toBeNull();
  });
  it('cada cosa que hace el conductor tiene botón directo, en los dos idiomas', () => {
    for (const clave of [
      'cara',
      'sin_vehiculo',
      'sin_placa',
      'vehiculo_sin_enviar',
      'vehiculo_sin_activar',
      'sin_servicio_encendido',
      'sin_saldo',
      'sin_pago_movil',
      'ubicacion_vieja',
      'papeles_sin_enviar',
    ])
      for (const idioma of ['es', 'en'] as const) {
        const a = avisoDeFalta({ clave, quien: 'conductor', vehiculoTipo: 'moto' }, idioma);
        expect(a?.boton, `${clave} ${idioma}`).toBeTruthy();
        expect(a?.accion).toBeTruthy();
      }
  });
  it('el género en español: «Activa tu carro», «Actívalo»; «tu moto», «Actívala»', () => {
    expect(
      avisoDeFalta(
        { clave: 'vehiculo_sin_activar', quien: 'conductor', vehiculoTipo: 'carro' },
        'es',
      )?.detalle,
    ).toContain('Actívalo');
    expect(
      avisoDeFalta(
        { clave: 'vehiculo_sin_activar', quien: 'conductor', vehiculoTipo: 'moto' },
        'es',
      )?.detalle,
    ).toContain('Actívala');
  });
  it('el vehículo guardado sin placa se detecta (con motor; el estado solo donde la placa no es nacional)', () => {
    const v = {
      id: 'v',
      tipo: 'moto',
      marca: '',
      modelo: '',
      anio: null,
      color: '',
      placa: '',
      plazas: null,
      estado: 'registrado',
    };
    expect(faltaPlaca(v, true)).toBe(true);
    expect(faltaPlaca({ ...v, placa: 'AB123CD' }, true)).toBe(false);
    expect(faltaPlaca({ ...v, placa: 'AB123CD' }, false)).toBe(true);
    expect(faltaPlaca({ ...v, tipo: 'bicicleta' }, true)).toBe(false);
  });
  it('la pantalla de la moto llama a la ruta de editar (antes Driver no la llamaba)', () => {
    const codigo = readFileSync(join(__dirname, '..', 'viajes', 'EditarVehiculo.tsx'), 'utf8');
    expect(codigo).toContain("'PUT', `/datos/conductor/vehiculos/${vehiculo.id}`");
    expect(codigo).toContain('useBorrador');
    expect(readFileSync(join(__dirname, '..', 'viajes', 'AltaPasajeros.tsx'), 'utf8')).toContain(
      '<EditarVehiculo',
    );
  });
});

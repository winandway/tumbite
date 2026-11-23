import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detallePapelVehiculo, faltaParaEnviar } from './papelesVehiculo';

/**
 * C-PAPEL-DICE-LA-VERDAD (23 nov 2026, conductor real): cada foto subida de la moto decía «Pendiente ·
 * Enviado · suele tardar 1 día» con la moto todavía «registrada» y nadie revisándola. Ahora el texto
 * sale del estado del VEHÍCULO, con una sola pieza para el perfil y para «Registrar mi moto».
 */
describe('C-PAPEL-DICE-LA-VERDAD', () => {
  it('subida con la moto sin enviar: lo dice así (no «en revisión»)', () => {
    const d = detallePapelVehiculo(
      { docEstado: 'pendiente', vehiculoEstado: 'registrado', vehiculoTipo: 'moto' },
      'es',
    );
    expect(d.texto).toBe('Subida. Falta enviar tu moto a revisión');
    expect(d.pildora).toBe('Subida');
    expect(d.texto).not.toMatch(/suele tardar/);
  });
  it('«En revisión · suele tardar 1 día» solo con el vehículo en revisión', () => {
    expect(
      detallePapelVehiculo(
        { docEstado: 'pendiente', vehiculoEstado: 'en_revision', vehiculoTipo: 'moto' },
        'es',
      ).texto,
    ).toBe('En revisión · suele tardar 1 día');
    expect(
      detallePapelVehiculo(
        { docEstado: 'pendiente', vehiculoEstado: 'registrado', vehiculoTipo: 'carro' },
        'en',
      ).texto,
    ).toBe('Uploaded. You still need to send your car for review');
  });
  it('dice exactamente qué falta para poder enviarla (placa, registro, seguro)', () => {
    const v = { tipo: 'moto', placa: '', documentos: [{ tipo: 'registro', estado: 'pendiente' }] };
    expect(faltaParaEnviar(v, true, 'es')).toEqual(['la placa', 'la póliza de seguro']);
    expect(
      faltaParaEnviar(
        {
          tipo: 'moto',
          placa: 'AB123CD',
          documentos: [
            { tipo: 'registro', estado: 'pendiente' },
            { tipo: 'seguro', estado: 'aprobado' },
          ],
        },
        true,
        'es',
      ),
    ).toEqual([]);
    expect(faltaParaEnviar({ tipo: 'bicicleta', placa: '', documentos: [] }, true, 'es')).toEqual(
      [],
    );
  });
  it('las dos pantallas usan la misma pieza', () => {
    for (const f of [
      join(__dirname, 'PerfilAcordeon.tsx'),
      join(__dirname, '..', 'viajes', 'AltaPasajeros.tsx'),
    ]) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).toContain('detallePapelVehiculo(');
      expect(s, f).toContain('faltaParaEnviar(');
    }
    expect(readFileSync(join(__dirname, 'PerfilAcordeon.tsx'), 'utf8')).not.toContain(
      't.enviadoHoy',
    );
  });
});

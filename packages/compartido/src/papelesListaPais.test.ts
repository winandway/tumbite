import { describe, expect, it } from 'vitest';
import {
  documentosDeLista,
  faltanEnLista,
  listaPapelesDeFabrica,
  nombresDeLista,
  normalizarLista,
} from './papelesListaPais';
import { politicaPlazoDeFabrica } from './plazoPapeles';
import { perfilPasajeros } from './perfilPasajeros';

/** C-PAPELES-POR-PAIS, segunda parte (24 nov 2026): la lista de papeles por país. */
describe('C-PAPELES-POR-PAIS: la lista de papeles de cada país', () => {
  const ve = perfilPasajeros('VE');
  const exentosVe = politicaPlazoDeFabrica('VE').exentos;

  it('Venezuela trae su lista lista para encender, APAGADA, y no deja fuera nada que el reparto exija', () => {
    const l = normalizarLista(listaPapelesDeFabrica(ve), ve, exentosVe);
    expect(l.activa).toBe(false);
    expect(l.papeles.map((p) => p.es)).toEqual(
      expect.arrayContaining([
        'Licencia de conducir',
        'Certificado médico',
        'Título de propiedad o carnet de circulación',
        'Póliza RCV',
        'Foto de la moto con la placa visible',
      ]),
    );
    expect(faltanEnLista(l, ve, exentosVe)).toEqual([]);
    const docs = documentosDeLista(l);
    expect(docs.documentosPorServicio.moto).toEqual(['licencia_moto', 'certificado_medico']);
    expect(docs.documentosVehiculo.moto).toEqual(['registro', 'seguro', 'foto_placa']);
    expect(docs.documentosVehiculo.carro).toContain('inspeccion');
    expect(nombresDeLista(l).moto.seguro).toEqual({
      es: 'Póliza RCV',
      en: 'RCV liability insurance policy',
    });
  });

  it('«frena» es la verdad del reparto: lo que ya frena sigue frenando y lo nuevo solo se pide', () => {
    const l = normalizarLista(listaPapelesDeFabrica(ve), ve, exentosVe);
    const frena = (tipo: string) => l.papeles.find((p) => p.tipo === tipo)?.frena;
    expect(frena('licencia_moto')).toBe(true);
    expect(frena('registro')).toBe(true);
    expect(frena('seguro')).toBe(true);
    expect(frena('certificado_medico')).toBe(false);
    expect(frena('foto_placa')).toBe(false);
    // Aunque alguien mande lo contrario, se guarda la verdad.
    const torcida = normalizarLista(
      {
        activa: true,
        papeles: l.papeles.map((p) => ({ ...p, frena: !p.frena })),
      },
      ve,
      exentosVe,
    );
    expect(torcida.papeles.map((p) => p.frena)).toEqual(l.papeles.map((p) => p.frena));
  });

  it('una lista que deja fuera la póliza (y su copia de pasajeros) no se puede encender', () => {
    const l = listaPapelesDeFabrica(ve);
    const sinPoliza = { ...l, papeles: l.papeles.filter((p) => p.tipo !== 'seguro') };
    const faltan = faltanEnLista(normalizarLista(sinPoliza, ve, exentosVe), ve, exentosVe);
    expect(faltan.map((f) => f.tipo)).toEqual(
      expect.arrayContaining(['seguro', 'seguro_pasajeros']),
    );
  });

  it('Estados Unidos queda apagado y su lista es la de hoy', () => {
    const us = perfilPasajeros('US');
    const l = listaPapelesDeFabrica(us);
    expect(l.activa).toBe(false);
    expect(documentosDeLista(l).documentosPorServicio).toEqual({ moto: [], carro: [] });
  });
});

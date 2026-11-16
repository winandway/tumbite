import { describe, expect, it } from 'vitest';
import {
  ALCANCE_TOTAL,
  CONFIG_PERMISOS,
  PERMISOS_INTERNOS,
  PLANTILLAS_SISTEMA,
  alcanceDentroDe,
  calcularAcceso,
  nombreCumpleSoporte,
  permisosFuera,
  plantillaSistema,
  puedeVer,
  topesDentroDe,
  unirAlcances,
} from './permisosInternos';
import { LISTA_RUTAS_ADMIN } from './rutasAdmin';

const base = {
  dueno: false,
  perfilViejo: null,
  estado: 'activo' as const,
  ajustes: [],
  rutas: LISTA_RUTAS_ADMIN,
};
const asignar = (
  id: string,
  extra: Partial<{ alcance: typeof ALCANCE_TOTAL; venceEn: string | null }> = {},
) => {
  const p = plantillaSistema(id)!;
  return {
    plantillaId: id,
    nombre: p.nombre.es,
    permisos: p.permisos,
    topes: p.topes ?? null,
    alcance: extra.alcance ?? ALCANCE_TOTAL,
    venceEn: extra.venceEn ?? null,
  };
};

describe('C-PERMISOS-FINOS: el modelo de permisos', () => {
  it('las plantillas de fábrica traen las decisiones recomendadas (fotos desde nivel 1, datos desde nivel 2)', () => {
    expect(CONFIG_PERMISOS.fotosDesde).toBe('soporte_1');
    expect(plantillaSistema('monitor')?.permisos).not.toContain('pedidos.fotos');
    expect(plantillaSistema('soporte_1')?.permisos).toContain('pedidos.fotos');
    expect(plantillaSistema('soporte_1')?.permisos).not.toContain('clientes.datos_personales');
    expect(plantillaSistema('soporte_2')?.permisos).toContain('clientes.datos_personales');
    expect(plantillaSistema('auditor')?.permisos).not.toContain('pedidos.fotos');
    expect(
      plantillaSistema('auditor')?.permisos.every((p) => !/\.(gestionar|aprobar|editar)$/.test(p)),
    ).toBe(true);
    for (const p of PLANTILLAS_SISTEMA) {
      expect(p.nombre.es && p.nombre.en && p.descripcion.es && p.descripcion.en, p.id).toBeTruthy();
      expect(
        p.permisos.every((x) => (PERMISOS_INTERNOS as readonly string[]).includes(x)),
        p.id,
      ).toBe(true);
    }
  });

  it('varias plantillas se suman; el alcance se une; el tope es el mayor', () => {
    const a = calcularAcceso({
      ...base,
      asignaciones: [
        asignar('soporte_2', {
          alcance: { paises: null, zonas: ['US-FL-MIAMI'], servicios: null },
        }),
        asignar('supervisor', {
          alcance: { paises: null, zonas: ['US-MI-NOVI'], servicios: null },
        }),
        asignar('verificador', {
          alcance: { paises: null, zonas: ['US-MI-NOVI'], servicios: null },
        }),
      ],
    });
    expect(a.permisos).toEqual(
      expect.arrayContaining(['dinero.aprobar', 'kyc.decidir', 'pedidos.devolver']),
    );
    expect(a.fuentes['pedidos.devolver']).toEqual(['soporte_2', 'supervisor']);
    expect(a.alcance.zonas).toEqual(['US-FL-MIAMI', 'US-MI-NOVI']);
    expect(a.topes?.USD).toBe(CONFIG_PERMISOS.topes.supervisor?.USD);
  });

  it('extra suma y quitado resta, con su fuente; todo vencido = «vencido» sin permisos', () => {
    const a = calcularAcceso({
      ...base,
      asignaciones: [asignar('monitor')],
      ajustes: [
        { permiso: 'tickets.ver', tipo: 'extra' },
        { permiso: 'monitoreo.buscar', tipo: 'quitado' },
      ],
    });
    expect(a.fuentes['tickets.ver']).toEqual(['extra']);
    expect(puedeVer(a, 'monitoreo.buscar')).toBe(false);
    const vencido = calcularAcceso({
      ...base,
      asignaciones: [asignar('monitor', { venceEn: '2020-01-01 00:00:00' })],
    });
    expect(vencido.estado).toBe('vencido');
    expect(puedeVer(vencido, 'libre')).toBe(false);
  });

  it('el dueño es Total aunque esté suspendido o tenga una plantilla chica', () => {
    const a = calcularAcceso({
      ...base,
      dueno: true,
      estado: 'suspendido',
      asignaciones: [asignar('monitor')],
    });
    expect(a.estado).toBe('activo');
    expect(a.permisos).toEqual([...PERMISOS_INTERNOS]);
  });

  it('sin asignaciones: el perfil viejo (sin perfil = Total)', () => {
    expect(calcularAcceso({ ...base, asignaciones: [] }).permisos).toEqual([...PERMISOS_INTERNOS]);
    const lectura = calcularAcceso({ ...base, perfilViejo: 'lectura', asignaciones: [] });
    expect(lectura.permisos).toContain('pedidos.ver');
    expect(lectura.permisos).not.toContain('pedidos.cancelar');
    expect(lectura.origen).toBe('legado:lectura');
  });

  it('nadie da más de lo que tiene: permisos, alcance y topes', () => {
    expect(permisosFuera(['a', 'b'], ['a'])).toEqual(['b']);
    const miami = { paises: null, zonas: ['US-FL-MIAMI'], servicios: null };
    expect(alcanceDentroDe(miami, ALCANCE_TOTAL)).toBe(true);
    expect(alcanceDentroDe(ALCANCE_TOTAL, miami)).toBe(false);
    expect(
      alcanceDentroDe({ ...miami, servicios: ['comida'] }, { ...miami, servicios: ['moto'] }),
    ).toBe(false);
    expect(topesDentroDe({ USD: 100 }, { USD: 200 })).toBe(true);
    expect(topesDentroDe({ USD: 300 }, { USD: 200 })).toBe(false);
    expect(topesDentroDe(null, { USD: 200 })).toBe(false);
    expect(topesDentroDe({ USD: 1 }, null)).toBe(true);
    expect(unirAlcances([])).toEqual(ALCANCE_TOTAL);
  });

  it('cuentas de @windoce.com llevan «Soporte» en el nombre', () => {
    expect(nombreCumpleSoporte('jose@windoce.com', 'José')).toBe(false);
    expect(nombreCumpleSoporte('jose@windoce.com', 'José (Soporte)')).toBe(true);
    expect(nombreCumpleSoporte('ana@empresa.com', 'Ana')).toBe(true);
  });
});

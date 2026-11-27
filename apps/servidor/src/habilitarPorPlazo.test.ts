import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, escenarioVe } from './pruebas/motoVe';

/**
 * C-HABILITAR-IGUAL-LETRERO (27 nov 2026, caso real de Richard en Verificaciones): la ficha de un
 * conductor de El Vigía decía «Habilitación para Moto: Habilitado por su plazo · No le falta nada»,
 * con sus papeles «En plazo · quedan 29 días», y al tocar «Habilitar para Moto» salía «Todavía no se
 * puede habilitar. Le falta: Historial de manejo, Licencia de moto». El disparador de la base no
 * conocía el plazo. Una sola regla: lo que el letrero da por habilitado, el botón lo habilita, y dice
 * hasta cuándo tiene para los papeles. Todos los países con plazo (hoy Venezuela y Perú).
 */
async function escenario() {
  const e = await escenarioVe();
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, e.admin.token);
  const conductor = async (nombre: string, plazo: string) => {
    const rep = await e.m.cuenta('repartidor', nombre);
    const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
      e.m.llamar(metodo, ruta, cuerpo, rep.token);
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
    await e.m.DB.prepare("UPDATE usuarios SET fecha_nacimiento = '1990-05-10' WHERE id = ?")
      .bind(rep.id)
      .run();
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Motos Divoox',
      modelo: 'M150',
      anio: 2023,
      color: 'Negro',
      placa: `AB${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
      placaEstado: 'VE',
    });
    expect(v.estado).toBe(201);
    await e.m.DB.prepare(
      `INSERT OR REPLACE INTO plazo_papeles (conductor_id, pais, vence_en, origen)
       VALUES (?, 'VE', datetime('now', ?), 'equipo')`,
    )
      .bind(rep.id, plazo)
      .run();
    return rep;
  };
  const ficha = async (id: string) => {
    const r = await equipo('GET', `/datos/admin/conductores/${id}/pasajeros`);
    expect(r.estado).toBe(200);
    return (
      r.datos.servicios as {
        servicioId: string;
        habilitacion: string | null;
        habilitacionGuardada: string | null;
        requisitosFaltantes: string[];
      }[]
    ).find((s) => s.servicioId === 'moto');
  };
  return { e, equipo, conductor, ficha };
}

describe('C-HABILITAR-IGUAL-LETRERO: el botón «Habilitar» usa la misma regla que el letrero', () => {
  it('en plazo y sin licencia: el letrero dice «por su plazo» y el botón lo habilita, con la fecha', async () => {
    const s = await escenario();
    const rep = await s.conductor('Conductor en plazo', '+29 days');
    const antes = await s.ficha(rep.id);
    // El letrero: habilitado por su plazo, aunque el equipo no guardó nada.
    expect(antes?.habilitacion).toBe('aprobada');
    expect(antes?.habilitacionGuardada).toBeNull();
    const r = await s.equipo('PUT', `/datos/admin/habilitaciones/${rep.id}/moto`, {
      estado: 'aprobada',
    });
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(r.datos.habilitacion.estado).toBe('aprobada');
    // Dice claro que es por su plazo, hasta cuándo, y qué tiene que subir.
    expect(r.datos.porPlazo?.venceEn).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(r.datos.porPlazo?.pendientes).toContain('licencia_moto');
    const despues = await s.ficha(rep.id);
    expect(despues?.habilitacionGuardada).toBe('aprobada');
  });

  it('con el plazo vencido: el letrero no lo da por habilitado y el botón tampoco', async () => {
    const s = await escenario();
    const rep = await s.conductor('Conductor con plazo vencido', '-1 hour');
    const antes = await s.ficha(rep.id);
    expect(antes?.habilitacion).not.toBe('aprobada');
    const r = await s.equipo('PUT', `/datos/admin/habilitaciones/${rep.id}/moto`, {
      estado: 'aprobada',
    });
    expect(r.estado).toBe(409);
    expect(r.datos.requisitosFaltantes).toContain('licencia_moto');
  });

  it('habilitado por plazo, al vencer el plazo el reparto le vuelve a exigir los papeles', async () => {
    const s = await escenario();
    const rep = await s.conductor('Conductor que deja vencer', '+29 days');
    expect(
      (await s.equipo('PUT', `/datos/admin/habilitaciones/${rep.id}/moto`, { estado: 'aprobada' }))
        .estado,
    ).toBe(200);
    await s.e.m.DB.prepare(
      "UPDATE plazo_papeles SET vence_en = datetime('now', '-1 hour') WHERE conductor_id = ?",
    )
      .bind(rep.id)
      .run();
    const f = await s.ficha(rep.id);
    expect(f?.requisitosFaltantes).toContain('licencia_moto');
  });
});

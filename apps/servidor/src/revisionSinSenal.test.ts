import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-REVISION-SIN-SENAL (3 nov 2026, meta urgente de Gerencia): el restaurante de la cuenta de
 * revisión de las tiendas («Divoox Review Kitchen») sale abierto sin que nadie tenga abierta su app
 * o su panel, porque el revisor de Apple no la va a tener abierta. Solo ese restaurante, marcado
 * `revision_sin_senal = 1`; cualquier otro sigue la pausa sin señal (C-PAUSA-SIN-SENAL). Todos los países.
 */
describe('el restaurante de revisión no se pausa sin señal', () => {
  async function restaurante(m: ReturnType<typeof mundo>, nombre: string) {
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre },
      dueno.token,
    );
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.llamar(
      'POST',
      '/datos/mi-restaurante/platos',
      { nombreEs: 'Pizza', precioCentavos: 1400 },
      dueno.token,
    );
    expect((await m.abrir(dueno.token)).estado).toBe(200);
    // Su app o su panel dejaron de preguntar hace una hora.
    await m.DB.prepare(
      "UPDATE restaurantes SET senal_en = datetime('now', '-60 minutes') WHERE id = ?",
    )
      .bind(rid)
      .run();
    return rid;
  }
  const abierto = async (m: ReturnType<typeof mundo>, rid: string) =>
    (await m.llamar('GET', `/datos/restaurantes/${rid}`)).datos.restaurante.abiertoAhora as boolean;

  it('sale abierto y se le puede pedir; uno normal sin señal sigue en pausa', async () => {
    const m = mundo();
    const revision = await restaurante(m, 'Divoox Review Kitchen');
    const normal = await restaurante(m, 'Restaurante Normal');
    await m.DB.prepare('UPDATE restaurantes SET revision_sin_senal = 1 WHERE id = ?')
      .bind(revision)
      .run();
    expect(await abierto(m, revision)).toBe(true);
    expect(await abierto(m, normal)).toBe(false);
    const lista = await m.llamar('GET', '/datos/restaurantes?lat=25.77&lng=-80.19');
    const enLista = (lista.datos.restaurantes as { id: string; abiertoAhora: boolean }[]).find(
      (r) => r.id === revision,
    );
    expect(enLista?.abiertoAhora).toBe(true);
  });
});

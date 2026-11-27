import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS, politicaPlazoDeFabrica } from '@tumbite/compartido';
import { abrirCaracas, subirA } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';

/**
 * C-DOCUMENTO-SIN-REVERSO (23 nov 2026, Richard: «si seleccionó Venezuela, debe eliminar que el
 * documento venezolano se tome por la parte de atrás»). La cédula venezolana no tiene nada útil por
 * detrás (una lámina en blanco con un número de serie): en Venezuela se fotografía solo por delante.
 * C-LICENCIA-SIN-REVERSO (26 nov 2026, Richard: «la licencia de Venezuela tiene una sola cara… si la
 * parte trasera no está, entonces que sea conforme con el frente»): la licencia venezolana también va
 * solo por delante (la carta médica ya era una sola foto en «Tus papeles»). Estados
 * Unidos y los demás países siguen pidiendo los dos lados de todo. La app ya publicada recibe los pasos del servidor,
 * así que el arreglo vale para ella sin compilar nada.
 */
type Pais = 'VE' | 'US' | 'CO';

async function conductor(pais: Pais) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  if (pais === 'VE') expect((await abrirCaracas(e)).estado).toBe(201);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  if (pais === 'VE')
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  if (pais === 'CO') {
    await m.DB.prepare(
      "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('CO-ANT-MEDELLIN', 'Medellín', 'CO', 'COP', 'America/Bogota', 6.2442, -75.5812, 20, 1)",
    ).run();
    await m.DB.prepare("UPDATE usuarios SET zona_id = 'CO-ANT-MEDELLIN' WHERE id = ?")
      .bind(rep.id)
      .run();
  }
  const foto = (paso: string) =>
    subirA(e, `/datos/conductor/verificacion/foto/${paso}?origen=camara`, rep.token);
  const kycFoto = (pieza: string) => subirA(e, `/datos/kyc/foto/${pieza}`, rep.token);
  const verificacion = async () =>
    (await yo('GET', '/datos/conductor/verificacion')).datos as {
      pais: string;
      pasos: { paso: string; foto: { estado: string } | null }[];
      papeles: { papel: string; estado: string }[];
      listos: number;
      total: number;
      puedeEnviar: boolean;
    };
  const moto = async () => {
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Motos Divoox',
      modelo: 'M150',
      anio: 2023,
      color: 'Negro',
      placa: `AB${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
    });
    expect(v.estado).toBe(201);
  };
  const estadoKyc = async () =>
    (
      await m.DB.prepare('SELECT estado FROM kyc WHERE usuario_id = ?')
        .bind(rep.id)
        .first<{ estado: string }>()
    )?.estado;
  return { m, rep, yo, equipo, foto, kycFoto, verificacion, moto, estadoKyc };
}

describe('C-DOCUMENTO-SIN-REVERSO: en Venezuela la cédula va solo por delante', () => {
  it('la política de fábrica de Venezuela no pide el reverso de la cédula ni el de la licencia; los demás países sí', () => {
    expect(politicaPlazoDeFabrica('VE').sinReverso).toEqual(['doc_reverso', 'licencia_reverso']);
    // C-LICENCIA-REVERSO-OPCIONAL: el de la licencia se sigue ofreciendo; el de la cédula, no.
    expect(politicaPlazoDeFabrica('VE').reversoOpcional).toEqual(['licencia_reverso']);
    for (const p of ['US', 'PE', 'CO', null]) {
      expect(politicaPlazoDeFabrica(p).sinReverso).toEqual([]);
      expect(politicaPlazoDeFabrica(p).reversoOpcional).toEqual([]);
    }
  });

  it('con moto: cara, documento y licencia solo por delante, y seguro; el total cuadra y se envía', async () => {
    const c = await conductor('VE');
    await c.moto();
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    const antes = await c.verificacion();
    expect(antes.pais).toBe('VE');
    expect(antes.pasos.map((p) => p.paso).sort()).toEqual(
      ['cara', 'doc_frente', 'licencia_frente', 'seguro'].sort(),
    );
    expect(antes.total).toBe(4);
    for (const p of ['doc_frente', 'licencia_frente', 'seguro', 'cara'])
      expect((await c.foto(p)).estado).toBe(201);
    const listo = await c.verificacion();
    expect(listo.listos).toBe(4);
    // C-LLEGA-SOLO-A-REVISION: con la última foto ya llegó sola a revisión; el botón responde bien.
    expect(listo.papeles.every((p) => p.estado === 'en_revision')).toBe(true);
    expect((await c.yo('POST', '/datos/conductor/verificacion/enviar')).estado).toBe(200);
    expect(await c.estadoKyc()).toBe('pendiente');
    const despues = await c.verificacion();
    expect(despues.papeles.every((p) => p.estado === 'en_revision')).toBe(true);
    // La ficha del equipo tampoco muestra un hueco de reverso.
    const ficha = (await c.equipo('GET', `/datos/admin/verificacion/${c.rep.id}`)).datos;
    expect(ficha.fotos.map((f: { paso: string }) => f.paso)).not.toContain('doc_reverso');
    expect(ficha.fotos.map((f: { paso: string }) => f.paso)).not.toContain('licencia_reverso');
    // Y no se le puede pedir de nuevo una foto que su país no pide.
    for (const paso of ['doc_reverso', 'licencia_reverso'])
      expect(
        (
          await c.equipo('POST', `/datos/admin/verificacion/${c.rep.id}/pedir-foto`, {
            paso,
            motivo: 'Prueba de candado',
          })
        ).estado,
      ).toBe(409);
    // «Lo que te falta» (la de Driver, la de WhatsApp y la de Camila salen de aquí) no nombra ningún reverso.
    const falta = await c.yo('GET', '/datos/conductor/que-te-falta');
    expect(falta.estado).toBe(200);
    expect(JSON.stringify(falta.datos)).not.toMatch(/revers/i);
    // C-LICENCIA-REVERSO-OPCIONAL: la app nueva (?opcionales=1) ve el reverso de la licencia como
    // opcional (el de la cédula nunca); lo puede subir y no cambia la cuenta de papeles.
    const conOpcional = (await c.yo('GET', '/datos/conductor/verificacion?opcionales=1')).datos as {
      pasos: { paso: string; opcional: boolean }[];
      total: number;
      listos: number;
    };
    expect(conOpcional.pasos.filter((p) => p.opcional).map((p) => p.paso)).toEqual([
      'licencia_reverso',
    ]);
    expect(conOpcional.pasos.map((p) => p.paso)).not.toContain('doc_reverso');
    expect(conOpcional.total).toBe(4);
    expect((await c.foto('licencia_reverso')).estado).toBe(201);
    const conReverso = await c.verificacion();
    expect(conReverso.listos).toBe(4);
    expect(conReverso.pasos.map((p) => p.paso)).not.toContain('licencia_reverso');
    const ficha2 = (await c.equipo('GET', `/datos/admin/verificacion/${c.rep.id}`)).datos;
    expect(
      ficha2.fotos.find((f: { paso: string }) => f.paso === 'licencia_reverso')?.opcional,
    ).toBe(true);
  });

  it('sin vehículo: documento por delante y cara (dos papeles)', async () => {
    const c = await conductor('VE');
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    const v = await c.verificacion();
    expect(v.pasos.map((p) => p.paso).sort()).toEqual(['cara', 'doc_frente']);
    expect(v.total).toBe(2);
    expect((await c.foto('doc_frente')).estado).toBe(201);
    expect((await c.foto('cara')).estado).toBe(201);
    expect((await c.yo('POST', '/datos/conductor/verificacion/enviar')).estado).toBe(200);
    expect(await c.estadoKyc()).toBe('pendiente');
  });

  it('cinturón: si una app vieja manda igual el reverso de la cédula, se guarda y se da por buena', async () => {
    const c = await conductor('VE');
    const r = await c.foto('doc_reverso');
    expect(r.estado).toBe(201);
    expect((r.datos as unknown as { ia: unknown }).ia).toEqual({ color: 'verde', aviso: '' });
    const guardada = await c.m.DB.prepare(
      "SELECT estado, ia_color FROM verificacion_fotos WHERE conductor_id = ? AND paso = 'doc_reverso'",
    )
      .bind(c.rep.id)
      .first();
    expect(guardada).toEqual({ estado: 'vigente', ia_color: 'sin_ia' });
    // Sigue sin contarse ni exigirse.
    const v = await c.verificacion();
    expect(v.pasos.map((p) => p.paso)).not.toContain('doc_reverso');
  });

  it('el flujo viejo de «Mis datos» también envía sin reverso', async () => {
    const c = await conductor('VE');
    await c.kycFoto('doc_frente');
    await c.kycFoto('selfie');
    const r = await c.yo('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' });
    expect(r.estado).toBe(200);
    expect(await c.estadoKyc()).toBe('pendiente');
  });

  it('el que ya subió un reverso en blanco y quedó en «repetir» queda libre; el equipo no lo ve', async () => {
    const c = await conductor('VE');
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    // Lo que dejó la app 0.1.69: un reverso en blanco que la comprobación mandó a repetir.
    await c.kycFoto('doc_reverso');
    await c.m.DB.prepare(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, pais, estado, motivo, ia_color, ia_clase)
       VALUES ('foto-reverso-en-blanco', ?, 'doc_reverso', 'verificacion/reverso-en-blanco', 'VE', 'repetir', 'No se lee bien', 'rojo', 'otra_cosa')`,
    )
      .bind(c.rep.id)
      .run();
    expect((await c.foto('doc_frente')).estado).toBe(201);
    expect((await c.foto('cara')).estado).toBe(201);
    const v = await c.verificacion();
    const identidad = v.papeles.find((p) => p.papel === 'identidad');
    // C-LLEGA-SOLO-A-REVISION: con la cédula por delante y la cara, ya llegó sola a revisión.
    expect(identidad?.estado).toBe('en_revision');
    expect((await c.yo('POST', '/datos/conductor/verificacion/enviar')).estado).toBe(200);
    // La foto sobrante no se borra: se ignora.
    const sigue = await c.m.DB.prepare(
      "SELECT estado FROM verificacion_fotos WHERE id = 'foto-reverso-en-blanco'",
    ).first<{ estado: string }>();
    expect(sigue?.estado).toBe('repetir');
    // En la bandeja y en la ficha del equipo no aparece un «reverso».
    const cola = await c.equipo('GET', '/datos/admin/kyc');
    const fila = cola.datos.solicitudes.find((s: { id: string }) => s.id === c.rep.id);
    expect(fila).toBeTruthy();
    expect(fila.comprobaciones.map((x: { pieza: string }) => x.pieza)).not.toContain('doc_reverso');
    const ficha = (await c.equipo('GET', `/datos/admin/kyc/${c.rep.id}`)).datos;
    expect(ficha.kyc.tiene.doc_reverso).toBe(false);
    expect(ficha.lecturas.map((x: { paso: string }) => x.paso)).not.toContain('doc_reverso');
  });

  for (const pais of ['US', 'CO'] as const)
    it(`${pais === 'US' ? 'Estados Unidos' : 'Colombia'} sigue igual: pide el reverso en los dos flujos`, async () => {
      const c = await conductor(pais);
      const v = await c.verificacion();
      expect(v.pais).toBe(pais);
      expect(v.pasos.map((p) => p.paso)).toEqual(['doc_frente', 'doc_reverso', 'cara']);
      expect(v.total).toBe(2);
      await c.kycFoto('doc_frente');
      await c.kycFoto('selfie');
      const r = await c.yo('POST', '/datos/kyc/enviar', { docTipo: 'identificacion' });
      expect(r.estado).toBe(422);
      expect(r.datos.campo).toBe('doc_reverso');
    });
});

import { afterEach, describe, expect, it } from 'vitest';
import {
  CIUDAD_PRUEBAS_VENEZUELA as CCS,
  PASOS_VERIFICACION,
  avisoNoCoincide,
  diasRestantes,
  hitoQueToca,
  politicaPlazoDeFabrica,
  soloEnVivo,
} from '@tumbite/compartido';
import { ORIGEN_CCS, abrirCaracas, subirA } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';
import { recordarPlazos } from '../plazoPapeles';
import { fotoSoloEnVivo } from './verificacionConductor';
import {
  type LlamadaIa,
  SALIDA_MAXIMA_GEMINI,
  colorDeCaras,
  colorDeFoto,
  cuerpoGemini,
  leerRespuestaGemini,
  saludVerificacionIa,
  usarModeloVerificacion,
} from '../verificacionIa';

/**
 * C-PLAZO-PAPELES, C-VERIFICACION-ASISTENTE y C-VERIFICACION-IA (19 nov 2026, decisiones de Richard).
 * El modelo es SIEMPRE de mentira: ninguna prueba llama a Gemini.
 */
const LLAVE = { GEMINI_API_KEY: 'llave-de-mentira-para-pruebas-000000' };

afterEach(() => usarModeloVerificacion(null));

/** Un modelo de mentira que contesta lo que se le diga y cuenta cuántas veces lo llamaron. */
function modelo(respuestas: unknown[] | (() => unknown)) {
  const estado = { llamadas: 0 };
  const f: LlamadaIa = async () => {
    const r = typeof respuestas === 'function' ? respuestas() : respuestas[estado.llamadas];
    estado.llamadas++;
    if (r instanceof Error) throw r;
    return { texto: JSON.stringify(r), entrada: 1300, salida: 150 };
  };
  usarModeloVerificacion(f);
  return estado;
}
const lectura = (clase: string, extra: Record<string, unknown> = {}) => ({
  clase,
  legible: true,
  vencido: 'no_se_ve',
  confianza: 95,
  ...extra,
});

async function conductorNuevo(pais: 'VE' | 'US' = 'VE', extra: Record<string, unknown> = LLAVE) {
  const m = mundo(extra, { host: 'staging.tumbite.com' });
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
  const foto = (paso: string, origen = 'camara') =>
    subirA(e, `/datos/conductor/verificacion/foto/${paso}?origen=${origen}`, rep.token) as Promise<{
      estado: number;
      datos: { id: string; ia: { color: string; aviso: string }; campo?: string; error?: string };
    }>;
  const moto = async () => {
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Bera',
      modelo: 'SBR',
      anio: 2023,
      color: 'Negro',
      placa: `AB${Math.floor(Math.random() * 1e6)}`,
    });
    expect(v.estado).toBe(201);
    return v.datos.id as string;
  };
  const servicioMoto = async () =>
    (await yo('GET', '/datos/conductor/servicios')).datos.servicios.find(
      (s: { servicioId: string }) => s.servicioId === 'moto',
    ) as { puedeActivar: boolean; motivo: string; requisitosFaltantes: string[] };
  return { e, m, admin, rep, yo, equipo, foto, moto, servicioMoto };
}

describe('C-PLAZO-PAPELES: la política de cada país', () => {
  it('Venezuela da 30 días y pide solo la cara para empezar', () => {
    const ve = politicaPlazoDeFabrica('VE');
    expect(ve.dias).toBe(30);
    expect(ve.paraEmpezar).toEqual(['cara']);
    expect(ve.aprobacionAutomatica).toBe(false);
  });
  it('Perú pide licencia y seguro para empezar; Estados Unidos no tiene plazo', () => {
    expect(politicaPlazoDeFabrica('PE').paraEmpezar).toEqual(['cara', 'licencia', 'seguro']);
    expect(politicaPlazoDeFabrica('US').dias).toBe(0);
    expect(politicaPlazoDeFabrica(null).dias).toBe(0);
  });
  it('los recordatorios salen a 15, 10, 5 y 1 día, una vez cada uno, y al vencer', () => {
    expect(hitoQueToca(20, null)).toBeNull();
    expect(hitoQueToca(15, null)).toBe(15);
    expect(hitoQueToca(13, 15)).toBeNull();
    expect(hitoQueToca(10, 15)).toBe(10);
    expect(hitoQueToca(4, 10)).toBe(5);
    expect(hitoQueToca(1, 5)).toBe(1);
    expect(hitoQueToca(1, 1)).toBeNull();
    expect(hitoQueToca(0, 1)).toBe(0);
    expect(hitoQueToca(0, 0)).toBeNull();
  });
  it('los días que quedan se cuentan hacia arriba y nunca bajan de cero', () => {
    const ahora = new Date('2026-11-20T12:00:00Z');
    expect(diasRestantes('2026-11-21 11:00:00', ahora)).toBe(1);
    expect(diasRestantes('2026-12-20 12:00:00', ahora)).toBe(30);
    expect(diasRestantes('2026-11-01 00:00:00', ahora)).toBe(0);
  });
});

describe('C-PLAZO-PAPELES: el conductor de Venezuela trabaja desde que crea la cuenta', () => {
  it('con su moto declarada y la foto de su cara se conecta y Moto queda habilitado, sin esperar al equipo', async () => {
    const c = await conductorNuevo();
    modelo(() => lectura('cara'));
    const v = await c.moto();
    // Antes de la cara: la lista «Tus papeles» ya existe y el plazo corre.
    const antes = (await c.yo('GET', '/datos/conductor/verificacion')).datos;
    expect(antes.plazo.estado).toBe('en_plazo');
    expect(antes.plazo.dias).toBe(30);
    expect(antes.papeles.map((p: { papel: string }) => p.papel)).toEqual([
      'identidad',
      'licencia',
      'seguro',
      'cara',
    ]);
    expect((await c.yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: v })).estado).toBe(
      200,
    );
    await c.yo('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true });
    // Sin la cara no se conecta: es lo único que Venezuela pide para empezar.
    const sinCara = await c.yo('POST', '/datos/repartidor/conectar', {
      conectado: true,
      ...ORIGEN_CCS,
    });
    expect(sinCara.estado).toBe(403);
    expect(sinCara.datos.campo).toBe('cara');
    expect((await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true })).estado).toBe(200);
    expect((await c.foto('cara')).estado).toBe(201);
    const s = await c.servicioMoto();
    expect(s.requisitosFaltantes).toEqual([]);
    expect(s.puedeActivar).toBe(true);
    expect(
      (await c.yo('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN_CCS })).estado,
    ).toBe(200);
  });

  it('al vencer el plazo deja de poder trabajar, no se borra nada, y recibe el aviso una sola vez', async () => {
    const c = await conductorNuevo();
    const v = await c.moto();
    await c.yo('GET', '/datos/conductor/verificacion');
    await c.yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: v });
    expect((await c.servicioMoto()).puedeActivar).toBe(true);
    await c.m.DB.prepare(
      "UPDATE plazo_papeles SET vence_en = datetime('now', '-1 hour') WHERE conductor_id = ?",
    )
      .bind(c.rep.id)
      .run();
    const s = await c.servicioMoto();
    expect(s.puedeActivar).toBe(false);
    const env = { DB: c.m.DB } as never;
    const vuelta = await recordarPlazos(env, c.m.DB, async () => 'falta');
    expect(vuelta.vencidos).toBe(1);
    const fila = await c.m.DB.prepare(
      'SELECT estado, ultimo_aviso FROM plazo_papeles WHERE conductor_id = ?',
    )
      .bind(c.rep.id)
      .first<{ estado: string; ultimo_aviso: number }>();
    expect(fila).toEqual({ estado: 'vencido', ultimo_aviso: 0 });
    // La cuenta y su vehículo siguen ahí.
    expect((await c.yo('GET', '/datos/conductor/verificacion')).datos.plazo.estado).toBe('vencido');
    // La segunda vuelta no lo vuelve a tocar.
    expect((await recordarPlazos(env, c.m.DB, async () => 'falta')).vistos).toBe(0);
  });

  it('a 10 días se le recuerda una vez; a quien ya envió todo no se le pausa por una demora nuestra', async () => {
    const c = await conductorNuevo();
    await c.yo('GET', '/datos/conductor/verificacion');
    const env = { DB: c.m.DB } as never;
    const poner = (cuando: string) =>
      c.m.DB.prepare('UPDATE plazo_papeles SET vence_en = datetime(?, ?) WHERE conductor_id = ?')
        .bind('now', cuando, c.rep.id)
        .run();
    await poner('+10 days');
    expect((await recordarPlazos(env, c.m.DB, async () => 'falta')).avisados).toBe(1);
    expect((await recordarPlazos(env, c.m.DB, async () => 'falta')).avisados).toBe(0);
    await poner('-1 hour');
    const vuelta = await recordarPlazos(env, c.m.DB, async () => 'subio_todo');
    expect(vuelta).toMatchObject({ vencidos: 0, extendidos: 1 });
    expect((await c.yo('GET', '/datos/conductor/verificacion')).datos.plazo.estado).toBe(
      'en_plazo',
    );
    // Y quien ya cumple la regla entera cierra su plazo.
    await poner('-1 hour');
    expect((await recordarPlazos(env, c.m.DB, async () => 'completo')).completos).toBe(1);
  });

  it('un conductor que ya existía conserva su estado: sin plazo hasta que el equipo se lo dé', async () => {
    const c = await conductorNuevo();
    await c.m.DB.prepare("UPDATE usuarios SET creado_en = '2026-10-01 00:00:00' WHERE id = ?")
      .bind(c.rep.id)
      .run();
    const v = await c.moto();
    expect((await c.yo('GET', '/datos/conductor/verificacion')).datos.plazo.estado).toBe(
      'sin_plazo',
    );
    expect((await c.yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: v })).estado).toBe(
      409,
    );
    expect((await c.servicioMoto()).puedeActivar).toBe(false);
    expect(
      (await c.equipo('POST', `/datos/admin/verificacion/${c.rep.id}/plazo`, {})).datos.dias,
    ).toBe(30);
    expect((await c.yo('GET', '/datos/conductor/verificacion')).datos.plazo.estado).toBe(
      'en_plazo',
    );
  });

  it('Estados Unidos no cambia: sin plazo, todo aprobado antes de empezar', async () => {
    const c = await conductorNuevo('US');
    const d = (await c.yo('GET', '/datos/conductor/verificacion')).datos;
    expect(d.plazo.estado).toBe('sin_plazo');
    expect(d.asistente).toBe(false);
    const fila = await c.m.DB.prepare('SELECT count(*) AS n FROM plazo_papeles').first<{
      n: number;
    }>();
    expect(fila?.n).toBe(0);
  });

  it('el equipo cambia la política del país y queda en el registro de cambios', async () => {
    const c = await conductorNuevo();
    const r = await c.equipo('PUT', '/datos/admin/paises/VE', {
      plazoPapeles: {
        dias: 45,
        paraEmpezar: ['cara', 'licencia'],
        exentos: ['antecedentes', 'antecedentes_pasajeros'],
        asistente: true,
        aprobacionAutomatica: false,
      },
    });
    expect(r.estado).toBe(200);
    await c.moto();
    expect((await c.yo('GET', '/datos/conductor/verificacion')).datos.plazo.dias).toBe(45);
    // Con la licencia exigida para empezar, ya no basta con declarar la moto.
    expect((await c.servicioMoto()).requisitosFaltantes).toEqual(['licencia_moto']);
    const registro = await c.m.DB.prepare(
      "SELECT count(*) AS n FROM auditoria_admin WHERE objeto = 'config-pais:VE'",
    ).first<{ n: number }>();
    expect(registro?.n).toBe(1);
  });
});

describe('C-VERIFICACION-ASISTENTE: una foto por paso y nada se envía solo', () => {
  it('la cara no se acepta desde archivos ni sin el consentimiento', async () => {
    const c = await conductorNuevo();
    modelo(() => lectura('cara'));
    const deArchivos = await c.foto('cara', 'archivos');
    expect(deArchivos.estado).toBe(422);
    const sinPermiso = await c.foto('cara');
    expect(sinPermiso.estado).toBe(409);
    expect(sinPermiso.datos.campo).toBe('consentimiento');
  });

  it('C-PAPELES-SOLO-CAMARA: con asistente, NINGUNA foto se acepta desde archivos (cada paso), en el idioma de la cuenta', async () => {
    const c = await conductorNuevo();
    await c.moto();
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    const ia = modelo(() => lectura('identidad_frente'));
    const pasos = (await c.yo('GET', '/datos/conductor/verificacion')).datos.pasos as {
      paso: string;
      soloEnVivo: boolean;
    }[];
    expect(pasos.map((p) => p.paso).sort()).toEqual([...PASOS_VERIFICACION].sort());
    expect(pasos.every((p) => p.soloEnVivo)).toBe(true);
    for (const { paso } of pasos) {
      for (const origen of ['archivos', 'galeria', '']) {
        const r = await c.foto(paso, origen);
        expect(r.estado, `${paso} ${origen}`).toBe(422);
        expect(r.datos.error, paso).toBe(
          paso === 'cara'
            ? 'Your face photo is taken live, with the camera. It can’t be picked from your files.'
            : 'Verification photos are taken live, with the app’s camera. They can’t be uploaded from your files.',
        );
      }
    }
    // Nada se guardó ni se le enseñó a la IA.
    expect(ia.llamadas).toBe(0);
    const n = await c.m.DB.prepare('SELECT count(*) AS n FROM verificacion_fotos').first<{
      n: number;
    }>();
    expect(n?.n).toBe(0);
    expect(fotoSoloEnVivo('licencia_frente', false)).toBe(
      'Las fotos de verificación se toman en vivo, con la cámara de la app. No se pueden subir desde tus archivos.',
    );
    // Tomada con la cámara, sí entra.
    expect((await c.foto('licencia_frente', 'camara')).estado).toBe(201);
  });

  it('C-PAPELES-SOLO-CAMARA: sin asistente (Estados Unidos) solo la cara exige la cámara, como siempre', () => {
    expect(politicaPlazoDeFabrica('US').asistente).toBe(false);
    expect(PASOS_VERIFICACION.filter((p) => soloEnVivo(p, false))).toEqual(['cara']);
    expect(PASOS_VERIFICACION.every((p) => soloEnVivo(p, true))).toBe(true);
    expect(soloEnVivo('cara', politicaPlazoDeFabrica('PE').asistente)).toBe(true);
    expect(soloEnVivo('seguro', politicaPlazoDeFabrica('PE').asistente)).toBe(true);
  });

  it('la IA avisa al momento si la foto no es la del paso, y deja insistir', async () => {
    const c = await conductorNuevo();
    modelo([lectura('cara'), lectura('identidad_frente')]);
    const mal = await c.foto('doc_frente');
    expect(mal.estado).toBe(201);
    expect(mal.datos.ia.color).toBe('rojo');
    // La cuenta de la prueba está en inglés (el idioma principal).
    expect(mal.datos.ia.aviso).toBe(
      'This looks like a photo of your face; this step needs the front of your ID.',
    );
    expect(avisoNoCoincide('cara', 'licencia_frente', 'VE', false)).toBe(
      'Esto parece una foto de tu cara; aquí va el frente de tu licencia.',
    );
    expect(
      (await c.yo('POST', '/datos/conductor/verificacion/foto/doc_frente/insistir')).estado,
    ).toBe(200);
    const bien = await c.foto('doc_frente');
    expect(bien.datos.ia).toEqual({ color: 'verde', aviso: '' });
    // Solo vale la última: la anterior quedó reemplazada.
    const d = (await c.yo('GET', '/datos/conductor/verificacion')).datos;
    expect(d.pasos.find((p: { paso: string }) => p.paso === 'doc_frente').foto.color).toBe('verde');
  });

  it('tomar las fotos NO las manda a revisión; solo «Enviar a revisión» lo hace, y exige todas', async () => {
    const c = await conductorNuevo();
    await c.moto();
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    const orden = [
      'identidad_frente',
      'identidad_reverso',
      'licencia_frente',
      'licencia_reverso',
      'seguro',
      'cara',
    ];
    const m = modelo([
      ...orden.map((clase) =>
        lectura(clase, clase === 'licencia_frente' ? { vence: '2031-05-10' } : {}),
      ),
      { resultado: 'misma', confianza: 93 },
    ]);
    const pasos = ['doc_frente', 'doc_reverso', 'licencia_frente', 'licencia_reverso', 'seguro'];
    for (const p of pasos) expect((await c.foto(p)).estado).toBe(201);
    const kyc = () =>
      c.m.DB.prepare('SELECT estado FROM kyc WHERE usuario_id = ?')
        .bind(c.rep.id)
        .first<{ estado: string }>();
    expect((await kyc())?.estado).toBe('sin_enviar');
    // Falta la cara: no se envía.
    const incompleto = await c.yo('POST', '/datos/conductor/verificacion/enviar');
    expect(incompleto.estado).toBe(422);
    expect(incompleto.datos.campo).toBe('cara');
    expect((await kyc())?.estado).toBe('sin_enviar');
    expect((await c.foto('cara')).estado).toBe(201);
    const antes = (await c.yo('GET', '/datos/conductor/verificacion')).datos;
    expect(antes.puedeEnviar).toBe(true);
    expect(antes.listos).toBe(4);
    expect((await c.yo('POST', '/datos/conductor/verificacion/enviar')).estado).toBe(200);
    expect((await kyc())?.estado).toBe('pendiente');
    const lic = await c.m.DB.prepare(
      "SELECT tipo, estado, vence_en FROM conductor_documentos WHERE conductor_id = ? AND estado = 'pendiente'",
    )
      .bind(c.rep.id)
      .first();
    expect(lic).toEqual({ tipo: 'licencia_moto', estado: 'pendiente', vence_en: '2031-05-10' });
    expect(m.llamadas).toBe(7);
    // El revisor ve cada comprobación con su color, lo leído y la comparación de la cara.
    const ficha = (await c.equipo('GET', `/datos/admin/verificacion/${c.rep.id}`)).datos;
    expect(ficha.caras).toMatchObject({ resultado: 'misma', color: 'verde' });
    expect(ficha.fotos.every((f: { foto: { color: string } }) => f.foto.color === 'verde')).toBe(
      true,
    );
    expect(ficha.papeles.every((p: { estado: string }) => p.estado === 'en_revision')).toBe(true);
    // Enviar otra vez sin nada nuevo no escribe nada.
    expect((await c.yo('POST', '/datos/conductor/verificacion/enviar')).datos.enviados).toBe(0);
  });

  it('el equipo pide de nuevo UNA sola foto, con motivo, y el conductor la cambia', async () => {
    const c = await conductorNuevo();
    modelo(() => lectura('identidad_reverso'));
    await c.foto('doc_reverso');
    const pedir = await c.equipo('POST', `/datos/admin/verificacion/${c.rep.id}/pedir-foto`, {
      paso: 'doc_reverso',
      motivo: 'Se ve cortada por un lado',
    });
    expect(pedir.estado).toBe(200);
    const d = (await c.yo('GET', '/datos/conductor/verificacion')).datos;
    const identidad = d.papeles.find((p: { papel: string }) => p.papel === 'identidad');
    expect(identidad).toMatchObject({ estado: 'repetir', motivo: 'Se ve cortada por un lado' });
    await c.foto('doc_reverso');
    const despues = (await c.yo('GET', '/datos/conductor/verificacion')).datos;
    expect(despues.pasos.find((p: { paso: string }) => p.paso === 'doc_reverso').foto.estado).toBe(
      'vigente',
    );
  });
});

describe('C-VERIFICACION-IA: la IA adelanta, nunca bloquea, y tiene tope', () => {
  it('los colores: verde solo si es lo que toca, se lee y hay confianza alta', () => {
    const base = {
      legible: true,
      vencido: 'no' as const,
      pais: 'VE',
      nombre: '',
      numero: '',
      vence: '',
      fotoDeOtraFoto: false,
    };
    expect(
      colorDeFoto('licencia_frente', { ...base, clase: 'licencia_frente', confianza: 92 }),
    ).toBe('verde');
    expect(colorDeFoto('licencia_frente', { ...base, clase: 'cara', confianza: 92 })).toBe('rojo');
    expect(colorDeFoto('licencia_frente', { ...base, clase: 'cara', confianza: 40 })).toBe(
      'amarillo',
    );
    expect(
      colorDeFoto('licencia_frente', { ...base, clase: 'licencia_frente', confianza: 70 }),
    ).toBe('amarillo');
    expect(
      colorDeFoto('licencia_frente', {
        ...base,
        clase: 'licencia_frente',
        confianza: 92,
        legible: false,
      }),
    ).toBe('amarillo');
    expect(
      colorDeFoto('licencia_frente', {
        ...base,
        clase: 'licencia_frente',
        confianza: 92,
        vencido: 'si',
      }),
    ).toBe('rojo');
    expect(
      colorDeFoto('cara', { ...base, clase: 'cara', confianza: 95, fotoDeOtraFoto: true }),
    ).toBe('amarillo');
    expect(colorDeCaras('misma', 90)).toBe('verde');
    expect(colorDeCaras('misma', 60)).toBe('amarillo');
    expect(colorDeCaras('dudoso', 99)).toBe('amarillo');
    expect(colorDeCaras('distinta', 95)).toBe('rojo');
  });

  it('si el modelo falla, la foto se guarda igual y la mira una persona; el fallo queda contado', async () => {
    const c = await conductorNuevo();
    modelo(() => new Error('Gemini respondió 503'));
    const r = await c.foto('doc_frente');
    expect(r.estado).toBe(201);
    expect(r.datos.ia).toEqual({ color: 'sin_ia', aviso: '' });
    const g = await c.m.DB.prepare('SELECT llamadas, fallos FROM verificacion_ia_gasto').first();
    expect(g).toEqual({ llamadas: 0, fallos: 1 });
  });

  it('C-VERIFICACION-IA-RESPONDE: la consulta va con el «pensar» apagado y salida de sobra', () => {
    const cuerpo = cuerpoGemini({ sistema: 's', texto: 't', imagenes: [], json: {} });
    expect(cuerpo.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(cuerpo.generationConfig.maxOutputTokens).toBe(SALIDA_MAXIMA_GEMINI);
    expect(SALIDA_MAXIMA_GEMINI).toBeGreaterThanOrEqual(1024);
  });

  it('C-VERIFICACION-IA-RESPONDE: una respuesta que no terminó se reconoce como cortada', () => {
    const cortada = leerRespuestaGemini({
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"cl' }] } }],
      usageMetadata: { promptTokenCount: 1149, candidatesTokenCount: 2, thoughtsTokenCount: 383 },
    });
    expect(cortada).toMatchObject({ cortada: true, entrada: 1149, salida: 385 });
    const entera = leerRespuestaGemini({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }],
    });
    expect(entera.cortada).toBe(false);
  });

  it('C-VERIFICACION-IA-RESPONDE: la respuesta cortada se paga, queda contada como sin respuesta y el canario avisa', async () => {
    const c = await conductorNuevo();
    usarModeloVerificacion(async () => ({
      texto: '{"cl',
      entrada: 1149,
      salida: 385,
      cortada: true,
    }));
    const r = await c.foto('doc_frente');
    expect(r.estado).toBe(201);
    expect(r.datos.ia).toEqual({ color: 'sin_ia', aviso: '' });
    const g = await c.m.DB.prepare('SELECT llamadas, fallos FROM verificacion_ia_gasto').first();
    expect(g).toEqual({ llamadas: 1, fallos: 1 });
    expect(await saludVerificacionIa({}, c.m.DB)).toBe('ok');
    // Lo que pasó el 20 nov: 33 consultas pagadas y 29 sin respuesta. El canario tiene que decirlo.
    await c.m.DB.prepare('UPDATE verificacion_ia_gasto SET llamadas = 33, fallos = 29').run();
    expect(await saludVerificacionIa({}, c.m.DB)).toBe('atrasado');
    await c.m.DB.prepare('UPDATE verificacion_ia_gasto SET llamadas = 33, fallos = 4').run();
    expect(await saludVerificacionIa({}, c.m.DB)).toBe('ok');
  });

  it('con el tope del día alcanzado no se llama al modelo', async () => {
    const c = await conductorNuevo('VE', { ...LLAVE, TOPE_VERIFICACION_IA_CENTAVOS: '1' });
    // Una llamada grande de mentira (13.000 fichas de entrada) pasa sola el tope de 1 centavo.
    let llamadas = 0;
    usarModeloVerificacion(async () => {
      llamadas++;
      return { texto: JSON.stringify(lectura('identidad_frente')), entrada: 13_000, salida: 150 };
    });
    expect((await c.foto('doc_frente')).datos.ia.color).toBe('verde');
    const segunda = await c.foto('doc_reverso');
    expect(segunda.estado).toBe(201);
    expect(segunda.datos.ia.color).toBe('sin_ia');
    expect(llamadas).toBe(1);
    expect((await c.m.llamar('GET', '/datos/salud')).datos.piezas.verificacion_ia).toBe('tope');
  });

  it('como mucho tres llamadas a la IA por cada foto de un conductor', async () => {
    const c = await conductorNuevo();
    const m = modelo(() => lectura('cara'));
    for (let k = 0; k < 5; k++) await c.foto('doc_frente');
    expect(m.llamadas).toBe(3);
  });

  it('sin llave no hay IA y todo sigue: las fotos pasan a revisión de una persona', async () => {
    const c = await conductorNuevo('VE', {});
    const m = modelo(() => lectura('identidad_frente'));
    expect((await c.foto('doc_frente')).datos.ia.color).toBe('sin_ia');
    expect(m.llamadas).toBe(0);
  });

  it('guarda lo que dijo la IA junto a lo que decidió la persona, y de ahí sale el acierto', async () => {
    const c = await conductorNuevo();
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    modelo([
      lectura('identidad_frente'),
      lectura('identidad_reverso'),
      lectura('cara'),
      { resultado: 'misma', confianza: 91 },
    ]);
    for (const p of ['doc_frente', 'doc_reverso', 'cara']) await c.foto(p);
    await c.yo('POST', '/datos/conductor/verificacion/enviar');
    await c.m.DB.prepare("UPDATE usuarios SET fecha_nacimiento = '1994-05-10' WHERE id = ?")
      .bind(c.rep.id)
      .run();
    expect(
      (await c.equipo('PATCH', `/datos/admin/kyc/${c.rep.id}`, { estado: 'aprobado' })).estado,
    ).toBe(200);
    const tablero = (await c.equipo('GET', '/datos/admin/verificacion-ia/tablero')).datos;
    expect(tablero.acierto).toHaveLength(3);
    expect(
      tablero.acierto.every(
        (a: { porcentaje: number; pais: string }) => a.porcentaje === 100 && a.pais === 'VE',
      ),
    ).toBe(true);
    expect(tablero.hoy.llamadas).toBe(4);
    // Sin moto ni carro solo se piden identidad y cara: con las dos aprobadas se le avisa una vez.
    const avisado = await c.m.DB.prepare('SELECT count(*) AS n FROM verificacion_avisos').first<{
      n: number;
    }>();
    expect(avisado?.n).toBe(1);
  });
});

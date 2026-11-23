import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Verificacion, accionDeMotivo, conFotosLocales, faltaCaraParaEmpezar } from './logica';
import { TEXTOS_AVISO_IA } from './textosAvisoIa';

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026) — todos los países. Conductores nuevos de Venezuela se
 * registraban y nunca tomaban la foto de la cara: en un celular chico (360×568) la tarjeta quedaba
 * cortada abajo, el motivo de «no te puedes conectar» se pintaba fuera de pantalla y en «Tu cara» el
 * botón «Acepto y sigo» quedaba detrás del pie. Este candado lee el código: el botón principal de cada
 * paso vive en el pie FIJO (nunca dentro de lo que se desliza), el motivo va pegado a la barra de
 * conectarse y la tarjeta de la cara va arriba de todo. La medida en pantalla la hace el guion
 * `scripts/recorrido/capturas-driver-foto-cara.mjs` (falla si algo queda fuera a 360×568).
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, ...r), 'utf8');

/** Los pedazos del archivo que van DENTRO de un ScrollView (lo que se desliza). */
function dentroDeScroll(codigo: string): string {
  const partes: string[] = [];
  let i = 0;
  for (;;) {
    const a = codigo.indexOf('<ScrollView', i);
    if (a < 0) break;
    const b = codigo.indexOf('</ScrollView>', a);
    if (b < 0) break;
    partes.push(codigo.slice(a, b));
    i = b + 1;
  }
  return partes.join('\n');
}

const base = (cara = false): Verificacion => ({
  pais: 'VE',
  asistente: true,
  plazo: { estado: 'en_plazo', venceEn: null, dias: 30, diasPolitica: 30, paraEmpezar: ['cara'] },
  perfil: { nombre: 'Ejemplo', tieneCara: cara },
  consentimiento: true,
  pasos: (['cara', 'doc_frente'] as const).map((paso) => ({
    paso,
    papel: paso === 'cara' ? 'cara' : 'identidad',
    soloEnVivo: true,
    foto: null,
  })),
  papeles: [{ papel: 'cara', pasos: ['cara'], estado: 'pendiente', motivo: '' }],
  listos: 0,
  total: 2,
  puedeEnviar: false,
});

describe('C-FOTO-CARA-A-LA-VISTA · la lógica', () => {
  it('la tarjeta de la cara sale arriba solo cuando la cara es lo que falta para empezar', () => {
    expect(faltaCaraParaEmpezar(base())).toBe(true);
    expect(faltaCaraParaEmpezar(base(true))).toBe(false);
    expect(faltaCaraParaEmpezar({ ...base(), asistente: false })).toBe(false);
    expect(faltaCaraParaEmpezar({ ...base(), plazo: { ...base().plazo, paraEmpezar: [] } })).toBe(
      false,
    );
    expect(faltaCaraParaEmpezar(null)).toBe(false);
  });
  it('una foto que ya subió cuenta como tomada aunque la relectura de «Tus papeles» falle', () => {
    const v = conFotosLocales(base(), new Map([['cara', '2026-11-23 10:00:00']]));
    expect(v.pasos.find((p) => p.paso === 'cara')?.foto?.estado).toBe('vigente');
    expect(v.perfil.tieneCara).toBe(true);
    expect(faltaCaraParaEmpezar(v)).toBe(false);
    // Sin fotos locales no cambia nada.
    expect(conFotosLocales(base(), new Map())).toEqual(base());
  });
  it('cada motivo de «no te puedes conectar» lleva a donde se arregla', () => {
    expect(accionDeMotivo('cara')).toBe('cara');
    expect(accionDeMotivo('kyc')).toBe('datos');
    expect(accionDeMotivo('papeles')).toBe('datos');
    expect(accionDeMotivo('terminos')).toBe('arriba');
    expect(accionDeMotivo('telefono')).toBe('arriba');
    expect(accionDeMotivo('selfie')).toBe('arriba');
    expect(accionDeMotivo(undefined)).toBeNull();
  });
});

describe('C-FOTO-CARA-A-LA-VISTA · nada importante queda fuera de pantalla', () => {
  it('asistente: el botón principal de cada paso va en el pie fijo, nunca dentro de lo que se desliza', () => {
    const codigo = leer('AsistentePapeles.tsx');
    const scroll = dentroDeScroll(codigo);
    for (const id of [
      'papeles-acepto',
      'papeles-tomar',
      'papeles-usar',
      'papeles-repetir',
      'papeles-siguiente',
      'papeles-enviar',
      'papeles-error',
    ]) {
      expect(codigo, `${id} existe`).toContain(`"${id}"`);
      expect(scroll, `${id} no se desliza`).not.toContain(`"${id}"`);
    }
    // «Guardar y seguir después» es secundario: va DESPUÉS del botón principal en el pie.
    const pie = codigo.slice(codigo.indexOf('function PieFijo'));
    expect(pie.indexOf('{principal}')).toBeLessThan(pie.indexOf('{secundario}'));
  });

  it('el aviso de IA: casilla y botón a la vista sin deslizar; el texto completo sigue en la pantalla', () => {
    const codigo = leer('AvisoIa.tsx');
    const scroll = dentroDeScroll(codigo);
    for (const id of ['aviso-ia-casilla', 'aviso-ia-aceptar'])
      expect(scroll, `${id} no se desliza`).not.toContain(`"${id}"`);
    expect(scroll).toContain('t.texto');
    expect(scroll).toContain('t.resumen');
    // El texto del dictamen no cambia; el resumen es aparte y nombra a Google (Gemini) y a la persona.
    expect(TEXTOS_AVISO_IA.es.texto).toContain('inteligencia artificial de Google (Gemini)');
    for (const r of [TEXTOS_AVISO_IA.es.resumen, TEXTOS_AVISO_IA.en.resumen]) {
      expect(r).toMatch(/Google \(Gemini\)/);
      expect(r.length).toBeLessThan(TEXTOS_AVISO_IA.es.texto.length / 2);
    }
  });

  it('inicio: el motivo de no conectarse va pegado a la barra y la tarjeta de la cara arriba de todo', () => {
    const panel = leer('..', 'servicios', 'PanelServicios.tsx');
    const conectarme = panel.indexOf('testID="conectarme"');
    const motivo = panel.indexOf('{motivoArriba}');
    expect(conectarme).toBeGreaterThan(0);
    // Pegado a la barra: justo encima de ella (después del resumen, antes de la lista de servicios).
    expect(motivo).toBeGreaterThan(panel.indexOf('{resumen}'));
    expect(motivo).toBeLessThan(conectarme);
    // Lo de arriba (la tarjeta de la cara y las puertas) va antes de la tarjeta del estado.
    expect(panel.indexOf('{arriba}')).toBeLessThan(panel.indexOf('<TarjetaEstado'));
    const inicio = leer('..', 'Inicio.tsx');
    // La tarjeta de la cara va DENTRO del único bloque de «lo que te falta» (no dos avisos compitiendo).
    expect(inicio).toContain('<QueTeFalta');
    expect(leer('..', 'piezas', 'QueTeFalta.tsx')).toContain('<TarjetaCara');
    expect(inicio).toMatch(/arriba=\{/);
    expect(inicio).toMatch(/motivo=\{/);
  });

  it('las subidas y la cámara nunca esperan para siempre ni fallan en silencio', () => {
    const camara = leer('CamaraConMarco.tsx');
    expect(camara).toContain('ESPERA_CAMARA_MS');
    expect(camara).toContain('camara-no-arranca');
    expect(camara).toContain('avisarFalloApp');
    const asistente = leer('AsistentePapeles.tsx');
    expect(asistente).toContain("'subida_fallida'");
    expect(asistente).toContain('t.reintentar');
  });

  it('pantallas hermanas: en el alta del vehículo, el error de cada botón va junto a ese botón', () => {
    const alta = leer('..', 'viajes', 'AltaPasajeros.tsx');
    for (const donde of ['guardar', 'enviar', 'usar', 'activar'])
      expect(alta, donde).toContain(`errorAqui('${donde}')`);
    // Arriba solo los errores de carga (no los de un botón del final de la pantalla).
    expect(alta).toContain('error && !errorEn ?');
  });
});

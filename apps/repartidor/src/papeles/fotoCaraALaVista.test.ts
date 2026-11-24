import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Verificacion, accionDeMotivo, conFotosLocales, faltaCaraParaEmpezar } from './logica';

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

  // El aviso de IA NO se toca hasta el dictamen del auditor de tiendas (Gerencia, 23 nov): su
  // rediseño quedó apartado en la rama fase-driver-aviso-ia-apartado.

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

  it('tramo 1: ningún texto del registro y del inicio se corta en un renglón (pantalla angosta)', () => {
    for (const r of [
      ['..', '..', '..', '..', 'packages', 'movil', 'src', 'TarjetaServicio.tsx'],
      ['..', '..', '..', '..', 'packages', 'movil', 'src', 'Deslizador.tsx'],
      ['..', 'servicios', 'PerfilAcordeon.tsx'],
      ['..', 'servicios', 'PanelServicios.tsx'],
      ['..', 'servicios', 'AgregarServicio.tsx'],
      ['TusPapeles.tsx'],
      ['AsistentePapeles.tsx'],
      ['..', 'viajes', 'AltaPasajeros.tsx'],
    ])
      expect(leer(...r), r.join('/')).not.toContain('numberOfLines={1}');
  });

  it('tramo 1: «Tomar foto / Subir desde archivos» es la hoja propia de Divoox, montada en las tres apps', () => {
    const raiz = ['..', '..', '..', '..'];
    const camara = leer(...raiz, 'packages', 'movil', 'src', 'camara.ts');
    expect(camara).not.toContain('Alert.alert');
    expect(camara).toContain('alertaDivoox');
    for (const app of ['cliente', 'repartidor', 'restaurante'])
      expect(leer(...raiz, 'apps', app, 'src', 'app', '_layout.tsx'), app).toContain(
        '<HojaFoto />',
      );
    expect(leer(...raiz, 'packages', 'movil', 'src', 'camaraLogica.ts')).toContain('t.consejo');
  });
  it('tramo 1: un solo diseño para la fila de un papel (perfil y alta de Moto y Carro)', () => {
    expect(leer('..', 'viajes', 'AltaPasajeros.tsx')).toContain('<FilaPapel');
    expect(leer('..', 'viajes', 'AltaPasajeros.tsx')).not.toMatch(/<Fila\s/);
    expect(leer('..', 'servicios', 'PerfilAcordeon.tsx')).toContain("from './FilaPapel'");
  });

  it('tramo 1: el perfil con el registro sin terminar muestra arriba solo lo que falta; «Datos para Comida y Envíos» solo a quien reparte', () => {
    const inicio = leer('..', 'Inicio.tsx');
    expect(inicio).toContain('registroIncompleto ? (');
    expect(inicio).toContain("'Más opciones'");
    expect(leer('..', 'servicios', 'PerfilAcordeon.tsx')).toContain('{haceReparto ? (');
    // UN resumen grande de cuántos pasos faltan, con el primero como botón.
    expect(leer('..', 'piezas', 'QueTeFalta.tsx')).toContain('pasos para empezar');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Verificacion,
  avisoDeLaIa,
  momentoDelPaso,
  pasoPendiente,
  pasosEnOrden,
  recorteAlMarco,
  siguientePaso,
  tarjetaPapeles,
} from './logica';

/**
 * C-ASISTENTE-DRIVER (20 nov 2026): el asistente de verificación de Driver. Un paso por foto, la
 * cara primero, cada foto con su horma y su miniatura, y NADA se manda a revisión sin el toque en
 * «Enviar a revisión».
 *
 * Visto en ROJO el 20 nov 2026 (a propósito, y restaurado): con `void enviar()` metido dentro de
 * `usar()` falla «/enviar solo se llama desde el botón»; con «Verificar mi identidad» abriendo la
 * verificación vieja aunque haya asistente, falla el de las entradas del perfil.
 */
const foto = (estado: 'vigente' | 'repetir' = 'vigente') => ({
  id: 'f',
  estado,
  motivo: estado === 'repetir' ? 'Salió movida' : '',
  color: 'verde',
  creadoEn: '2026-11-20 10:00:00',
});
const base = (tomadas: string[] = []): Verificacion => ({
  pais: 'VE',
  asistente: true,
  plazo: { estado: 'en_plazo', venceEn: null, dias: 30, diasPolitica: 30, paraEmpezar: ['cara'] },
  perfil: { nombre: 'Ejemplo', tieneCara: tomadas.includes('cara') },
  consentimiento: true,
  pasos: (
    ['doc_frente', 'doc_reverso', 'licencia_frente', 'licencia_reverso', 'seguro', 'cara'] as const
  ).map((paso) => ({
    paso,
    papel: paso === 'cara' ? 'cara' : paso === 'seguro' ? 'seguro' : 'identidad',
    soloEnVivo: paso === 'cara',
    foto: tomadas.includes(paso) ? foto() : null,
  })),
  papeles: [{ papel: 'cara', pasos: ['cara'], estado: 'pendiente', motivo: '' }],
  listos: 0,
  total: 4,
  puedeEnviar: false,
});

describe('C-ASISTENTE-DRIVER: el orden y el avance', () => {
  it('la cara va primero y el seguro al final', () => {
    const orden = pasosEnOrden(base()).map((p) => p.paso);
    expect(orden[0]).toBe('cara');
    expect(orden.at(-1)).toBe('seguro');
  });
  it('se retoma por la primera foto que falta y se termina en «Revisa tus papeles»', () => {
    expect(pasoPendiente(base())).toBe('cara');
    expect(pasoPendiente(base(['cara', 'doc_frente']))).toBe('doc_reverso');
    expect(siguientePaso(base(['cara']), 'cara')).toBe('doc_frente');
    const todas = [
      'cara',
      'doc_frente',
      'doc_reverso',
      'licencia_frente',
      'licencia_reverso',
      'seguro',
    ];
    expect(pasoPendiente(base(todas))).toBeNull();
    expect(siguientePaso(base(todas), 'seguro')).toBeNull();
  });
  it('una foto que el equipo pidió repetir vuelve a contar como pendiente', () => {
    const v = base(['cara']);
    v.pasos.find((p) => p.paso === 'cara')!.foto = foto('repetir');
    expect(pasoPendiente(v)).toBe('cara');
    expect(momentoDelPaso({ foto: foto('repetir'), fotoNueva: false, aviso: '' })).toBe('repetir');
  });
  it('los momentos: horma, vista previa, aviso de la IA y lista', () => {
    expect(momentoDelPaso({ foto: null, fotoNueva: false, aviso: '' })).toBe('horma');
    expect(momentoDelPaso({ foto: null, fotoNueva: true, aviso: '' })).toBe('vista_previa');
    expect(momentoDelPaso({ foto: foto(), fotoNueva: false, aviso: 'No parece' })).toBe('aviso');
    expect(momentoDelPaso({ foto: foto(), fotoNueva: false, aviso: '' })).toBe('lista');
    expect(avisoDeLaIa({ color: 'verde', aviso: 'x' })).toBe('');
    expect(avisoDeLaIa({ color: 'rojo', aviso: 'Esto parece tu cara' })).toBe(
      'Esto parece tu cara',
    );
    expect(avisoDeLaIa({ color: 'sin_ia' })).toBe('');
  });
});

describe('C-ASISTENTE-DRIVER: el recorte al marco de la cámara', () => {
  it('recorta el pedazo de la foto que quedó dentro del marco, con margen', () => {
    const r = recorteAlMarco(
      { width: 3000, height: 4000 },
      { width: 390, height: 844 },
      { x: 16, y: 200, width: 358, height: 226 },
    );
    expect(r).not.toBeNull();
    expect(r!.width / r!.height).toBeGreaterThan(1.3);
    expect(r!.originX).toBeGreaterThanOrEqual(0);
    expect(r!.originX + r!.width).toBeLessThanOrEqual(3000);
    expect(r!.originY + r!.height).toBeLessThanOrEqual(4000);
  });
  it('si la foto llega acostada y la pantalla está de pie, no recorta', () => {
    expect(
      recorteAlMarco(
        { width: 4000, height: 3000 },
        { width: 390, height: 844 },
        { x: 16, y: 200, width: 358, height: 226 },
      ),
    ).toBeNull();
  });
});

describe('C-ASISTENTE-DRIVER: «Tus papeles» en el inicio', () => {
  it('sin asistente en el país (Estados Unidos) no se muestra', () => {
    expect(tarjetaPapeles({ ...base(), asistente: false }, 'es')).toBeNull();
    expect(tarjetaPapeles(null, 'es')).toBeNull();
  });
  it('sin la cara, invita a tomarla para empezar; después cuenta los días', () => {
    expect(tarjetaPapeles(base(), 'es')?.titulo).toContain('cara');
    const t = tarjetaPapeles(base(['cara']), 'es');
    expect(t?.detalle).toContain('Te quedan 30 días');
    expect(tarjetaPapeles(base(['cara']), 'en')?.detalle).toContain('30 days left');
  });
  it('con el plazo vencido avisa de la pausa; con todo aprobado desaparece', () => {
    const v = base(['cara']);
    v.plazo.estado = 'vencido';
    expect(tarjetaPapeles(v, 'es')?.tono).toBe('problema');
    const ok = base(['cara']);
    ok.papeles = [{ papel: 'cara', pasos: ['cara'], estado: 'aprobado', motivo: '' }];
    expect(tarjetaPapeles(ok, 'es')).toBeNull();
  });
});

describe('C-ASISTENTE-DRIVER: nada se envía solo', () => {
  const codigo = readFileSync(join(__dirname, 'AsistentePapeles.tsx'), 'utf8');
  it('«/enviar» solo se llama desde la función del botón «Enviar a revisión»', () => {
    expect(codigo.match(/verificacion\/enviar/g)?.length).toBe(1);
    const enviar = codigo.slice(codigo.indexOf('async function enviar()'));
    expect(enviar.slice(0, 400)).toContain('/datos/conductor/verificacion/enviar');
    expect(codigo.match(/void enviar\(\)/g)?.length).toBe(1);
    expect(codigo).toContain('testID="papeles-enviar"');
  });
  it('la foto sube solo con «Usar esta», nunca al tomarla ni al elegirla', () => {
    expect(codigo.match(/subirFotoCon/g)?.length).toBe(1);
    expect(codigo.match(/void usar\(paso\)/g)?.length).toBe(1);
  });
  it('la cara no ofrece «Subir desde archivos»', () => {
    expect(codigo).toContain('dato.soloEnVivo ? null');
  });
});

describe('C-ASISTENTE-DRIVER: las entradas del perfil', () => {
  const perfil = readFileSync(join(__dirname, '..', 'servicios', 'PerfilAcordeon.tsx'), 'utf8');
  const inicio = readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8');
  it('con asistente, «Documento de identidad» y «Verificar mi identidad» abren el asistente', () => {
    expect(perfil).toContain("(f.clave === 'identidad' || f.clave === 'foto') && alAbrirAsistente");
    expect(perfil).toContain("alTocar={alAbrirAsistente ?? (() => setAbierto('identidad'))}");
  });
  it('sin asistente (Estados Unidos) siguen abriendo la verificación de siempre', () => {
    expect(inicio).toContain(
      "alAbrirAsistente={papeles.v?.asistente ? () => abrirPapeles('datos') : undefined}",
    );
    expect(perfil).toContain("abierto === 'identidad' ? (");
    expect(perfil).toContain('<Verificacion />');
  });
  it('«Tus papeles» está en el inicio y en el perfil, y el asistente vuelve a donde se abrió', () => {
    expect(inicio).toContain("alAbrir={() => abrirPapeles('inicio')}");
    expect(inicio).toContain("alAbrir={() => abrirPapeles('datos')}");
    expect(inicio).toContain('setVista(vueltaPapeles)');
  });
});

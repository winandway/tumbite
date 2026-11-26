import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Verificacion,
  avanceDeFotos,
  avisoDeLaIa,
  momentoDelPaso,
  pasoPendiente,
  pasosEnOrden,
  recorteAlMarco,
  siguientePaso,
  tarjetaPapeles,
  todasLasExigidas,
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

describe('C-LICENCIA-REVERSO-OPCIONAL: el reverso de la licencia se ofrece y nunca falta', () => {
  // Venezuela: sin reverso de cédula; el de la licencia llega marcado como opcional.
  const ve = (tomadas: string[]): Verificacion => {
    const v = base(tomadas);
    return {
      ...v,
      pasos: v.pasos
        .filter((p) => p.paso !== 'doc_reverso')
        .map((p) => (p.paso === 'licencia_reverso' ? { ...p, opcional: true } : p)),
    };
  };
  const exigidas = ['cara', 'doc_frente', 'licencia_frente', 'seguro'];
  it('se ofrece justo después del frente, pero no es «lo que falta»', () => {
    expect(siguientePaso(ve(['cara', 'doc_frente', 'licencia_frente']), 'licencia_frente')).toBe(
      'licencia_reverso',
    );
    expect(pasoPendiente(ve(exigidas))).toBeNull();
    expect(siguientePaso(ve(exigidas), 'seguro')).toBeNull();
  });
  it('sin el reverso: avance completo y se puede enviar', () => {
    expect(avanceDeFotos(ve(exigidas))).toEqual({ listas: 4, total: 4 });
    expect(todasLasExigidas(ve(exigidas))).toBe(true);
    expect(todasLasExigidas(ve(['cara', 'doc_frente']))).toBe(false);
  });
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
});

describe('C-PAPELES-SOLO-CAMARA: toda foto de verificación se toma en vivo con la cámara', () => {
  const carpeta = __dirname;
  const fuentes = readdirSync(carpeta)
    .filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n))
    .map((n) => ({ n, s: readFileSync(join(carpeta, n), 'utf8') }));
  const asistente = readFileSync(join(carpeta, 'AsistentePapeles.tsx'), 'utf8');
  it('ninguna pieza del asistente abre la galería, los archivos ni un selector de documentos', () => {
    const puertas =
      /launchImageLibraryAsync|requestMediaLibraryPermissionsAsync|getDocumentAsync|expo-document-picker|selectorDeCapturas|type="file"|papeles-subir|Subir desde archivos|Upload from files/;
    expect(fuentes.length).toBeGreaterThanOrEqual(4);
    expect(fuentes.filter((f) => puertas.test(f.s)).map((f) => f.n)).toEqual([]);
  });
  it('la foto siempre sube declarada como tomada con la cámara', () => {
    const subidas = [...asistente.matchAll(/verificacion\/foto\/\$\{paso\}\?origen=([a-z]+)/g)];
    expect(subidas.map((m) => m[1])).toEqual(['camara']);
    expect(asistente).not.toMatch(/origen: 'archivos'|'archivos'/);
  });
  it('«Tomar foto», «Repetir» y «Cambiar esta foto» abren la cámara', () => {
    expect(asistente).toContain('testID="papeles-tomar"');
    expect(asistente.match(/alTocar=\{abrirCamara\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(asistente).toContain('onPress={abrirCamara}');
    const repetirVista = asistente.slice(asistente.indexOf("momento === 'vista_previa'"));
    expect(repetirVista.slice(0, 900)).toMatch(/setNueva\(null\);\s*abrirCamara\(\);/);
  });
  it('sin permiso se explica cómo darlo y, en el teléfono, se abren los ajustes', () => {
    const camara = readFileSync(join(carpeta, 'CamaraConMarco.tsx'), 'utf8');
    expect(camara).toContain('canAskAgain === false');
    expect(camara).toContain('Linking.openSettings()');
    expect(camara).toContain('onMountError');
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

describe('C-AVISO-IA-UNICO: un solo aviso de IA, en su pantalla, antes de la primera foto', () => {
  it('solo iPhone ofrece «Prefiero revisión solo por una persona»; Android y la web, no', async () => {
    const { avisoConAlternativa, plataformaAviso } = await import('./textosAvisoIa');
    expect(avisoConAlternativa(plataformaAviso('ios'))).toBe(true);
    expect(avisoConAlternativa(plataformaAviso('android'))).toBe(false);
    expect(avisoConAlternativa(plataformaAviso('web'))).toBe(false);
    expect(plataformaAviso('windows')).toBe('web');
  });

  it('se muestra mientras el servidor lo marque pendiente; un servidor viejo no la inventa', async () => {
    const { hayQueMostrarAvisoIa } = await import('./textosAvisoIa');
    expect(hayQueMostrarAvisoIa({ avisoIaPendiente: true })).toBe(true);
    expect(hayQueMostrarAvisoIa({ avisoIaPendiente: false })).toBe(false);
    expect(hayQueMostrarAvisoIa({})).toBe(false);
    expect(hayQueMostrarAvisoIa(null)).toBe(false);
  });

  it('el texto es el del dictamen, en español y en inglés', async () => {
    const { TEXTOS_AVISO_IA } = await import('./textosAvisoIa');
    expect(TEXTOS_AVISO_IA.es.titulo).toBe('Cómo revisamos tus documentos');
    expect(TEXTOS_AVISO_IA.es.boton).toBe('Aceptar y continuar');
    expect(TEXTOS_AVISO_IA.es.alternativa).toBe('Prefiero revisión solo por una persona');
    expect(TEXTOS_AVISO_IA.es.texto).toContain('inteligencia artificial de Google (Gemini)');
    expect(TEXTOS_AVISO_IA.en.boton).toBe('Accept and continue');
    expect(TEXTOS_AVISO_IA.en.alternativa).toBe('I prefer review by a person only');
    // «No se vende / no se entrena» solo cuando la facturación de Gemini esté confirmada.
    for (const t of [TEXTOS_AVISO_IA.es.texto, TEXTOS_AVISO_IA.en.texto])
      expect(t).not.toMatch(/vend|entren|sold|train/i);
  });

  it('el «Sí / No» viejo ya no existe y la pantalla nueva va antes que cualquier foto', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const asistente = readFileSync(join(__dirname, 'AsistentePapeles.tsx'), 'utf8');
    const aviso = readFileSync(join(__dirname, 'AvisoIa.tsx'), 'utf8');
    const inicio = readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8');
    expect(asistente).not.toMatch(/papeles-permiso-ia-(si|no)|verificacion\/permiso-ia/);
    expect(asistente.indexOf('hayQueMostrarAvisoIa(v)')).toBeGreaterThan(0);
    expect(asistente.indexOf('hayQueMostrarAvisoIa(v)')).toBeLessThan(
      asistente.indexOf("pantalla.tipo === 'yaPuedes'"),
    );
    // Casilla sin marcar de entrada, y el enlace de la alternativa solo con la plataforma que la lleva.
    expect(aviso).toContain('useState(false)');
    expect(aviso).toContain('{conAlternativa ? (');
    expect(aviso).toContain("'/datos/conductor/aviso-ia'");
    // Cuentas que ya existen: la pantalla una vez al entrar (sin viaje ni pedido en curso).
    expect(inicio).toContain('<AvisoIa');
  });
});

/**
 * C-CHAT-WEB-SIN-MURO (23 nov 2026, decisión de Gerencia) — todos los países. Solo el chat de la web
 * pública pierde el muro. En Divoox Driver (iPhone, Android y también servido en el navegador) la
 * pantalla «Cómo revisamos tus documentos» sigue saliendo antes de la primera foto y al entrar, y es la
 * que da el permiso del chat de ayuda. Si alguien la condiciona por plataforma, esto se pone en rojo.
 */
describe('C-CHAT-WEB-SIN-MURO: Driver conserva su pantalla de permiso en todas las plataformas', () => {
  it('la pantalla depende solo de lo que diga el servidor, nunca de la plataforma', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const asistente = readFileSync(join(__dirname, 'AsistentePapeles.tsx'), 'utf8');
    const inicio = readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8');
    const chat = readFileSync(join(__dirname, '..', 'soporte', 'ChatSoporteApp.tsx'), 'utf8');
    expect(asistente).toMatch(/if \(hayQueMostrarAvisoIa\(v\)\)\s*return <AvisoIa/);
    expect(inicio).toMatch(/hayQueMostrarAvisoIa\(papeles\.v\) &&/);
    expect(inicio).toContain('<AvisoIa');
    // El chat de Driver no manda la marca de la línea de la web en ninguna plataforma.
    expect(chat).not.toMatch(/avisoIa:/);
    const { hayQueMostrarAvisoIa } = await import('./textosAvisoIa');
    expect(hayQueMostrarAvisoIa.length).toBe(1);
    expect(hayQueMostrarAvisoIa({ avisoIaPendiente: true })).toBe(true);
  });
});

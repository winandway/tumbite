import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXTOS_CHAT_SOPORTE } from '@tumbite/compartido';

/**
 * C-QUIEN-LO-VE (21 nov 2026, décimo dictamen del auditor de tiendas, bloqueo B1) — todos los países.
 * Al adjuntar una captura en el chat de ayuda la pantalla decía «Solo la ve el equipo de Divoox». Con
 * el permiso de IA dado, esa captura también la lee la asistente (Google Gemini): la frase era falsa
 * justo al lado del permiso. Google: «Don't provide misleading or inaccurate information about your
 * data practices». Todo texto que diga QUIÉN ve una captura del chat o una foto de verificación del
 * conductor dice la verdad según el permiso.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

describe('C-QUIEN-LO-VE: nadie dice «solo el equipo» de algo que también lee la asistente', () => {
  it('el aviso de la captura del chat lleva el texto exacto del dictamen, en los dos idiomas', () => {
    expect(TEXTOS_CHAT_SOPORTE.es.capturaPrivada).toBe(
      'Solo la ve el equipo de Divoox y, si diste tu permiso de IA, también nuestra asistente (Google Gemini). Se borra a los 90 días.',
    );
    expect(TEXTOS_CHAT_SOPORTE.en.capturaPrivada).toBe(
      'Only the Divoox team sees it and, if you gave your AI permission, our assistant (Google Gemini) too. It’s deleted after 90 days.',
    );
  });

  // Una frase que afirma «solo el equipo» sobre una captura (o sobre el documento y la cara del
  // conductor) sin decir que, con permiso, también la lee la asistente.
  const SOLO_EL_EQUIPO =
    /(solo|únicamente)[^.'"`]{0,40}(equipo|soporte)|only[^.'"`]{0,40}(team|support)|nadie más la ve|no one else sees it/i;
  const DICE_LA_VERDAD =
    /asistente|assistant|permiso|permission|inteligencia artificial|artificial intelligence/i;
  const frasesFalsas = (texto: string, deQue: RegExp) =>
    texto
      .split('\n')
      .filter((l) => deQue.test(l) && SOLO_EL_EQUIPO.test(l) && !DICE_LA_VERDAD.test(l))
      .map((l) => l.trim().slice(0, 140));

  it('ni la app ni la web dicen «solo el equipo» de una captura del chat', () => {
    const CAPTURA = /captura|screenshot/i;
    for (const archivo of [
      'packages/compartido/src/camilaChat.ts',
      'apps/repartidor/src/soporte/ChatSoporteApp.tsx',
      'apps/panel/src/sitio/ChatSoporte.tsx',
      'apps/panel/src/sitio/docs/guias.ts',
    ])
      expect(frasesFalsas(leer(archivo), CAPTURA), archivo).toEqual([]);
  });

  it('la guía de verificación del conductor no dice que el documento o la cara los ve solo el equipo', () => {
    const guias = leer('apps/panel/src/sitio/docs/guias.ts');
    // Los párrafos de la guía del conductor (documento y foto de la cara), en los dos idiomas.
    const DEL_CONDUCTOR =
      /Solo necesitas tu documento y una foto de tu cara|La foto de tu cara, una vez aprobada|All you need is your ID and a photo of your face|Once approved, the photo of your face/;
    expect(frasesFalsas(guias, DEL_CONDUCTOR)).toEqual([]);
    // Y los cuatro párrafos siguen existiendo (si se renombran, este candado no queda mudo).
    expect(guias.split('\n').filter((l) => DEL_CONDUCTOR.test(l))).toHaveLength(4);
  });
});

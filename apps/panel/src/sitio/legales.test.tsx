import { describe, expect, it } from 'vitest';
import {
  BORRAR_CUENTA,
  PRIVACIDAD,
  SOPORTE,
  TERMINOS,
  TERMINOS_REPARTIDORES,
  TERMINOS_RESTAURANTES,
} from './legales';

/**
 * Candado C-LEGALES-TIENDAS: lo que Apple (5.1.1) y Google Play (datos de usuario y borrado
 * de cuenta) revisan. Si alguien recorta un texto y quita una pieza exigida, esto se pone rojo.
 */
const texto = (d: { secciones: { titulo: string; parrafos: string[] }[]; intro?: string }) =>
  [d.intro ?? '', ...d.secciones.flatMap((s) => [s.titulo, ...s.parrafos])].join(' ');

describe('política de privacidad lista para las tiendas', () => {
  for (const idioma of ['es', 'en'] as const) {
    const p = texto(PRIVACIDAD[idioma]);
    it(`(${idioma}) nombra a la empresa y un contacto de privacidad`, () => {
      expect(p).toContain('Windoce, LLC');
      expect(p).toContain('soporte+divoox@windoce.com');
    });
    it(`(${idioma}) dice cuánto tiempo se guardan los datos y cómo borrarlos`, () => {
      expect(PRIVACIDAD[idioma].secciones.some((s) => s.id && /tiempo|long/i.test(s.titulo))).toBe(
        true,
      );
      expect(p).toContain('/delete-account');
      expect(p).toMatch(/30 (días|days)/);
    });
    it(`(${idioma}) explica ubicación, terceros con igual protección y que no se venden datos`, () => {
      expect(p).toMatch(/Stripe/);
      expect(p).toMatch(/igual o mayor|at least as well/);
      expect(p).toMatch(/no vendemos|don’t sell/i);
      expect(p).toMatch(/ubicación|location/i);
    });
  }
});

describe('mensajes de texto (verificación de Twilio y CTIA), C-SMS-LEGAL', () => {
  for (const idioma of ['es', 'en'] as const) {
    // C-SMS-CONSENTIMIENTO (9 nov 2026, Twilio 30513): Privacidad Y Términos llevan la sección
    // completa: casilla aparte y sin marcar, qué se envía, frecuencia, tarifas, STOP/HELP y que el
    // número no se vende ni se comparte para publicidad.
    for (const doc of [PRIVACIDAD, TERMINOS]) {
      const p = texto(doc[idioma]);
      it(`(${idioma}) ${doc[idioma].titulo}: cómo se aceptan, STOP/HELP, tarifas y que el número no se comparte`, () => {
        expect(doc[idioma].secciones.some((s) => s.id === 'sms')).toBe(true);
        expect(p).toMatch(/STOP/);
        expect(p).toMatch(/HELP/);
        expect(p).toMatch(/tarifas de mensajes y datos|Msg & data rates|Message and data rates/);
        expect(p).toMatch(/sin marcar|unchecked by default/);
        expect(p).toMatch(/no es una condición para comprar|not a condition of purchase/);
        expect(p).toMatch(/no compartimos|ni compartimos|do not sell or share|do not share/i);
        expect(p).toContain('sms-consent');
      });
    }
  }
});

describe('página pública para borrar la cuenta (Google Play)', () => {
  for (const idioma of ['es', 'en'] as const) {
    const b = BORRAR_CUENTA[idioma];
    it(`(${idioma}) tiene el botón directo, el pedido por correo y qué se borra y qué se guarda`, () => {
      expect(b.accion?.href).toBe('/panel/settings');
      const t = texto(b);
      expect(t).toContain('Divoox');
      expect(t).toContain('soporte+divoox@windoce.com');
      expect(b.secciones.length).toBeGreaterThanOrEqual(4);
    });
  }
});

describe('términos para cada público, en los dos idiomas', () => {
  it('existen y tienen contenido', () => {
    for (const doc of [TERMINOS, TERMINOS_RESTAURANTES, TERMINOS_REPARTIDORES, SOPORTE])
      for (const idioma of ['es', 'en'] as const)
        expect(doc[idioma].secciones.length).toBeGreaterThanOrEqual(3);
  });
  it('el repartidor queda como contratista independiente', () => {
    expect(texto(TERMINOS_REPARTIDORES.es)).toMatch(/contratista independiente/);
    expect(texto(TERMINOS_REPARTIDORES.en)).toMatch(/independent contractor/);
  });
});

/**
 * C-LEGALES-COHERENTES (18 nov 2026, auditor de tiendas): la política no se contradice entre
 * secciones y dice lo que el código hace de verdad.
 */
describe('la privacidad no se contradice', () => {
  const seccion = (idioma: 'es' | 'en', n: number) =>
    (PRIVACIDAD[idioma].secciones.find((s) => s.titulo.startsWith(`${n}.`))?.parrafos ?? []).join(
      ' ',
    );
  it('la contraseña: hash de una vía en la sección 2 y en la 9, nunca «cifrada»', () => {
    expect(seccion('es', 2)).toContain('hash de una vía');
    expect(seccion('es', 9)).toContain('hash de una vía');
    expect(seccion('es', 2)).not.toContain('la guardamos cifrada');
    expect(seccion('en', 2)).toContain('one-way hash');
    expect(seccion('en', 9)).toContain('one-way hash');
    expect(seccion('en', 2)).not.toContain('stored encrypted');
  });
  it('Flex: lo que se guarda tras borrar la cuenta lo dicen igual la sección 2 y la 6', () => {
    expect(seccion('es', 6)).toMatch(/Divoox Flex[^.]*siete años/);
    expect(seccion('en', 6)).toMatch(/Divoox Flex[^.]*seven years/);
    expect(seccion('es', 6)).toContain('tu posición en vivo en las rutas de Divoox Flex');
    expect(seccion('en', 6)).toContain('your live position on Divoox Flex routes');
  });
  it('Stripe: se borra lo que escribiste para cobrar; de Stripe solo guardamos la referencia', () => {
    expect(seccion('es', 6)).toContain('la referencia de tu cuenta de Stripe');
    expect(seccion('en', 6)).toContain('the reference to your Stripe account');
  });
});

describe('borrar la cuenta lista todo lo que se borra', () => {
  const que = (idioma: 'es' | 'en') =>
    (
      BORRAR_CUENTA[idioma].secciones.find((s) => /Qué se borra|What gets deleted/.test(s.titulo))
        ?.parrafos ?? []
    ).join(' ');
  it('el chat con la asistente virtual, los lugares guardados y los códigos de invitación', () => {
    expect(que('es')).toContain('el chat con nuestra asistente virtual');
    expect(que('es')).toContain('tus lugares guardados');
    expect(que('es')).toContain('tus códigos de invitación');
    expect(que('en')).toContain('the chat with our virtual assistant');
    expect(que('en')).toContain('your saved places');
    expect(que('en')).toContain('your invite codes');
  });
});

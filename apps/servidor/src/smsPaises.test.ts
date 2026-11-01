import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import { destinoPermitido } from './sms';

/**
 * C-SMS-PAISES (31 oct 2026, EE. UU.): Twilio solo manda a los países encendidos. Un SMS a Venezuela
 * cuesta unos 0,23 dólares por mensaje; por eso, sin la variable, solo sale a +1 (EE. UU.).
 */
const env = (p?: string) => ({ SMS_PREFIJOS: p }) as unknown as Env;

describe('a qué países salen los SMS y las llamadas', () => {
  it('sin la variable, solo EE. UU.', () => {
    expect(destinoPermitido(env(), '+14085550100')).toBe(true);
    expect(destinoPermitido(env(), '+584165550100')).toBe(false);
    expect(destinoPermitido(env(), '+573005550100')).toBe(false);
  });
  it('con la variable, los prefijos que diga', () => {
    expect(destinoPermitido(env('+1,+57'), '+573005550100')).toBe(true);
    expect(destinoPermitido(env('+1,+57'), '+584165550100')).toBe(false);
  });
});

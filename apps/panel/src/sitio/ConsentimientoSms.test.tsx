import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { textoConsentimientoSms } from '@tumbite/compartido';
import { App } from '../App';
import { IMAGEN_CONSENTIMIENTO_SMS } from './ConsentimientoSms';

/**
 * C-SMS-CONSENTIMIENTO (9 nov 2026, Twilio 30513): la página pública /sms-consent existe en inglés
 * y en español, con la captura real de la casilla, el texto exacto, STOP/HELP y los legales.
 */
describe('C-SMS-CONSENTIMIENTO · página /sms-consent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
  });
  afterEach(() => vi.unstubAllGlobals());

  for (const [ruta, idioma] of [
    ['/sms-consent', 'en'],
    ['/es/sms-consent', 'es'],
  ] as const) {
    it(`${ruta}: explica el consentimiento con la captura y el texto exacto de la casilla`, () => {
      window.history.pushState(null, '', ruta);
      render(<App />);
      const main = screen.getByRole('main');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/SMS/);
      expect(main.querySelector(`img[src="${IMAGEN_CONSENTIMIENTO_SMS}"]`)).not.toBeNull();
      expect(screen.getByTestId('texto-casilla-sms').textContent).toBe(
        textoConsentimientoSms(idioma),
      );
      expect(main.textContent).toMatch(/STOP/);
      expect(main.textContent).toMatch(/HELP/);
      expect(main.textContent).toMatch(/Windoce, LLC/);
      const pre = idioma === 'es' ? '/es' : '';
      expect(main.querySelector(`a[href="${pre}/privacy"]`)).not.toBeNull();
      expect(main.querySelector(`a[href="${pre}/terms"]`)).not.toBeNull();
      expect(
        screen.getByRole('contentinfo').querySelector('a[href*="windoce.com"]'),
      ).not.toBeNull();
    });
  }
});

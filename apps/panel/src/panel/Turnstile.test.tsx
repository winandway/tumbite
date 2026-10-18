import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Turnstile, reiniciarTurnstile } from './Turnstile';

describe('escudo anti-robots en la web (C-TURNSTILE-APPS)', () => {
  afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    delete (window as unknown as { tumbitePase?: string }).tumbitePase;
  });

  it('pinta el widget con la clave del sitio y deja el pase donde la API lo lee', () => {
    const renderizar = vi.fn((_el: HTMLElement, op: { callback: (p: string) => void }) => {
      op.callback('pase-123');
      return 'w1';
    });
    const reset = vi.fn();
    (window as unknown as { turnstile: unknown }).turnstile = { render: renderizar, reset };
    render(<Turnstile sitio="0x4AAAA" idioma="es" />);
    expect(screen.getByTestId('turnstile')).toBeInTheDocument();
    expect(renderizar).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: '0x4AAAA', language: 'es' }),
    );
    expect((window as unknown as { tumbitePase?: string }).tumbitePase).toBe('pase-123');
    reiniciarTurnstile();
    expect((window as unknown as { tumbitePase?: string }).tumbitePase).toBeUndefined();
    expect(reset).toHaveBeenCalledWith('w1');
  });

  it('sin clave del sitio no pinta nada (el escudo está apagado)', () => {
    const { container } = render(<Turnstile sitio="" idioma="en" />);
    expect(container).toBeEmptyDOMElement();
  });
});

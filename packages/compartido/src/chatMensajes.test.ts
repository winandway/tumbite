import { describe, expect, it } from 'vitest';
import { unirMensajes } from './chatMensajes';

/**
 * C-CHAT-SIN-DOBLES (1 nov 2026, visto en el recorrido del sitio de pruebas): el chat consulta cada
 * 4 s y también al enviar; con la red lenta, dos consultas traían el mismo mensaje y se veía dos veces.
 */
describe('unir los mensajes del chat', () => {
  it('no repite un mensaje que ya está y deja el orden', () => {
    const a = [{ id: 1, texto: 'Hola' }];
    const b = [
      { id: 1, texto: 'Hola' },
      { id: 2, texto: 'Toca el timbre' },
    ];
    expect(unirMensajes(a, b)).toEqual([
      { id: 1, texto: 'Hola' },
      { id: 2, texto: 'Toca el timbre' },
    ]);
    expect(unirMensajes(unirMensajes(a, b), b)).toHaveLength(2);
  });
});

describe('el chat de las apps usa la unión sin dobles', () => {
  it('ChatPedido une con unirMensajes', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const chat = readFileSync(
      join(__dirname, '..', '..', 'movil', 'src', 'ChatPedido.tsx'),
      'utf8',
    );
    expect(chat).toContain('setMensajes((m) => unirMensajes(m, r.mensajes))');
  });
});

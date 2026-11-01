import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** C-AYUDA-EN-LA-APP: las tres apps tienen «Mis casos de ayuda» con el chat dentro de la app. */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');

describe('ayuda dentro de las tres apps', () => {
  it('cliente, conductor y restaurante muestran sus casos', () => {
    expect(leer('apps', 'cliente', 'src', 'app', 'account.tsx')).toContain('<MisCasos />');
    expect(leer('apps', 'repartidor', 'src', 'Inicio.tsx')).toContain('<MisCasos />');
    const r = leer('apps', 'restaurante', 'src', 'MasPantallas.tsx');
    expect(r).toContain('<MisCasos />');
    expect(r).toContain('<ReportarProblema />');
  });
  it('el chat usa el caso propio y responde sin salir de la app', () => {
    const p = leer('packages', 'movil', 'src', 'MisCasos.tsx');
    expect(p).toContain("'/datos/mis-tickets'");
    expect(p).toContain('/mensajes`');
    expect(p).not.toContain('Linking');
  });
});

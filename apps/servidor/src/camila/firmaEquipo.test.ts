import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { firmaDelEquipo } from './identidad';
import { AJUSTES_CAMILA_INICIALES, leerAjustes, limpiarNombreFirma } from './memoria';

/**
 * C-FIRMA-EQUIPO (Gerencia y Richard, 26 nov 2026: una respuesta del equipo llegó firmada «Soporte
 * Divoox, del equipo de soporte de Divoox») — todos los países y canales. Lo que escribe una PERSONA del
 * equipo firma con el nombre de atención de Camila › Ajustes (de fábrica «Samira»): «Samira, de Soporte
 * Divoox». Vacío o con «Soporte»/la marca: solo «Soporte Divoox». Lo de la IA sigue firmado por Camila.
 * La respuesta real por correo (ruta del equipo) se comprueba en correoEntrante.test.ts.
 */
describe('C-FIRMA-EQUIPO: la firma de una persona del equipo', () => {
  it('con el nombre de atención: «Samira, de Soporte Divoox», en una sola línea', () => {
    expect(firmaDelEquipo('Samira', 'es')).toBe('Samira, de Soporte Divoox');
    expect(firmaDelEquipo('Samira', 'en')).toBe('Samira, Divoox Support');
    expect(firmaDelEquipo('  María \n Pérez ', 'es')).toBe('María Pérez, de Soporte Divoox');
    expect(firmaDelEquipo('Samira', 'es')).not.toMatch(/\n/);
  });

  it('vacío o con «Soporte» o la marca: solo «Soporte Divoox», sin repetirse', () => {
    for (const nombre of ['', 'Soporte Divoox', 'Soporte', 'Ana (Soporte)', 'Soporte Tumbite'])
      expect(firmaDelEquipo(nombre, 'es')).toBe('Soporte Divoox');
    expect(firmaDelEquipo('', 'en')).toBe('Divoox Support');
  });

  it('el nombre de fábrica es «Samira» y el nombre se limpia (solo letras, hasta 40)', () => {
    expect(AJUSTES_CAMILA_INICIALES.nombreFirmaEquipo).toBe('Samira');
    expect(limpiarNombreFirma('  Samira  ')).toBe('Samira');
    expect(limpiarNombreFirma('Samira <b>')).toBe('');
    expect(limpiarNombreFirma('https://x.test')).toBe('');
    expect(limpiarNombreFirma('A'.repeat(60)).length).toBe(40);
  });

  it('el nombre se cambia en Camila › Ajustes y no se pierde al guardar lo demás', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    expect((await leerAjustes(m.DB)).nombreFirmaEquipo).toBe('Samira');
    const base = { ia: true, topeDiarioCentavos: 100, regalosPorDia: 20 };
    const r = await m.llamar(
      'PUT',
      '/datos/admin/camila/ajustes',
      { ...base, nombreFirmaEquipo: 'Laura' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect((await leerAjustes(m.DB)).nombreFirmaEquipo).toBe('Laura');
    // Un cliente viejo que no manda el nombre no lo borra.
    await m.llamar('PUT', '/datos/admin/camila/ajustes', base, admin.token);
    expect((await leerAjustes(m.DB)).nombreFirmaEquipo).toBe('Laura');
    const malo = await m.llamar(
      'PUT',
      '/datos/admin/camila/ajustes',
      { ...base, nombreFirmaEquipo: 'Laura <script>' },
      admin.token,
    );
    expect(malo.estado).toBe(400);
    expect((await leerAjustes(m.DB)).nombreFirmaEquipo).toBe('Laura');
  });
});

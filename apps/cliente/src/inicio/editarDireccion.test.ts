import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textosFotoPuerta } from '@tumbite/compartido';
import {
  ACCIONES_DE_DIRECCION,
  cuerpoDeEdicion,
  cuerpoDePunto,
  despuesDeConfirmarPunto,
  elegirTipo,
  formularioDe,
} from './editarDireccionLogica';
import { textosInicio } from './textos';

const GUARDADA = {
  id: 'd1',
  etiqueta: '',
  direccion: 'Calle de Ejemplo 123',
  lat: 1.5,
  lng: -2.5,
  apto: '4B',
  referencia: 'Frente al parque',
  instrucciones: '',
  entrega: 'mano' as const,
  icono: 'casa',
};

describe('C-EDITAR-ES-EDITAR: «Editar» edita la dirección; las fotos son otra acción', () => {
  it('«Editar» es la primera acción y las fotos van aparte, con su nombre', () => {
    expect(ACCIONES_DE_DIRECCION).toEqual(['editar', 'ajustar', 'fotos', 'borrar']);
    const es = textosInicio('es');
    const en = textosInicio('en');
    expect(es.editarDireccion).toBe('Editar');
    expect(en.editarDireccion).toBe('Edit');
    expect(es.fotosPuerta).toBe('Fotos de la entrada');
    expect(en.fotosPuerta).toBe('Entrance photos');
  });

  it('guarda el nombre que la persona quiera y conserva la dirección, el punto y lo demás', () => {
    const v = {
      ...formularioDe(GUARDADA),
      nombre: '  Casa de mi mamá  ',
      instrucciones: 'Tocar dos veces',
    };
    expect(cuerpoDeEdicion(GUARDADA, v)).toEqual({
      etiqueta: 'Casa de mi mamá',
      direccion: 'Calle de Ejemplo 123',
      lat: 1.5,
      lng: -2.5,
      apto: '4B',
      referencia: 'Frente al parque',
      instrucciones: 'Tocar dos veces',
      entrega: 'mano',
      icono: 'casa',
    });
    // El nombre nunca pasa de lo que acepta el servidor.
    expect(cuerpoDeEdicion(GUARDADA, { ...v, nombre: 'x'.repeat(80) }).etiqueta).toHaveLength(30);
    // Un ícono que el servidor no conoce no viaja (rompería el guardado).
    expect(cuerpoDeEdicion(GUARDADA, { ...v, icono: 'cohete' }).icono).toBe('');
  });

  it('elegir Casa o Trabajo pone su nombre solo si la persona no escribió uno propio', () => {
    const vacio = { ...formularioDe(GUARDADA), nombre: '', icono: '' };
    expect(elegirTipo(vacio, 'casa', 'es')).toMatchObject({ icono: 'casa', nombre: 'Casa' });
    expect(elegirTipo(vacio, 'trabajo', 'en')).toMatchObject({ icono: 'trabajo', nombre: 'Work' });
    // De Casa a Trabajo cambia también el nombre puesto por el botón.
    expect(elegirTipo({ ...vacio, nombre: 'Casa' }, 'trabajo', 'es').nombre).toBe('Trabajo');
    // Un nombre propio nunca se pisa.
    expect(elegirTipo({ ...vacio, nombre: 'Donde mi abuela' }, 'casa', 'es').nombre).toBe(
      'Donde mi abuela',
    );
    // Los demás íconos no inventan nombre.
    expect(elegirTipo(vacio, 'gimnasio', 'es')).toMatchObject({ icono: 'gimnasio', nombre: '' });
  });

  it('ajustar el punto de una guardada corrige ESA dirección (PUT) y conserva su nombre', () => {
    expect(
      cuerpoDePunto(
        { ...GUARDADA, etiqueta: 'Casa' },
        {
          direccion: 'Calle de Ejemplo 125',
          punto: { lat: 1.6, lng: -2.4 },
          referencia: 'Al lado del parque',
          apto: '5C',
        },
      ),
    ).toEqual({
      etiqueta: 'Casa',
      direccion: 'Calle de Ejemplo 125',
      lat: 1.6,
      lng: -2.4,
      apto: '5C',
      referencia: 'Al lado del parque',
      instrucciones: '',
      entrega: 'mano',
      icono: 'casa',
    });
  });

  it('ajustar una dirección ya guardada NUNCA termina en la hoja de las fotos', () => {
    expect(despuesDeConfirmarPunto({ eraGuardada: true, tieneFotos: false })).toBe('lista');
    expect(despuesDeConfirmarPunto({ eraGuardada: true, tieneFotos: true })).toBe('lista');
    // Una dirección nueva sí ofrece la hoja, una vez (ficha 5.3 de la foto de la puerta).
    expect(despuesDeConfirmarPunto({ eraGuardada: false, tieneFotos: false })).toBe('hoja');
    expect(despuesDeConfirmarPunto({ eraGuardada: false, tieneFotos: true })).toBe('cerrar');
  });

  it('el título de las fotos no habla solo del repartidor (también sirve para viajes)', () => {
    expect(textosFotoPuerta('es').titulo).not.toMatch(/repartidor/i);
    expect(textosFotoPuerta('en').titulo).not.toMatch(/courier/i);
  });

  it('la pantalla usa esas piezas: menú con «Editar» primero, borrador y PUT por id', () => {
    const lista = readFileSync(join(__dirname, 'ElegirDireccion.tsx'), 'utf8');
    const hoja = readFileSync(join(__dirname, 'EditarDireccion.tsx'), 'utf8');
    expect(lista).toContain('direccion-editar-');
    expect(lista.indexOf('direccion-editar-')).toBeLessThan(lista.indexOf('direccion-ajustar-'));
    expect(lista.indexOf('direccion-ajustar-')).toBeLessThan(lista.indexOf('direccion-fotos-'));
    expect(lista).toContain('despuesDeConfirmarPunto(');
    expect(lista).toContain('cuerpoDePunto(');
    // Ya no salta sola de «ajustar» a las fotos.
    expect(lista).not.toMatch(/tipo: 'fotos'/);
    expect(hoja).toContain('useBorrador<FormularioDireccion>(');
    expect(hoja).toContain('<AvisoBorrador');
    expect(hoja).toContain("'PUT'");
    expect(hoja).toContain('b.limpiar()');
    expect(hoja).toContain('editar-direccion-punto');
    expect(hoja).toContain('editar-direccion-fotos');
    // Las fotos van dentro de la misma hoja, nunca otra ventana encima.
    expect(hoja).toMatch(/<HojaFotosPuerta\b[^>]*\bseccion\b/);
  });
});

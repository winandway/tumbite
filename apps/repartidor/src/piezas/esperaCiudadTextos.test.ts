import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Idioma } from '@tumbite/compartido';
import { tarjetaPapeles } from '../papeles/logica';
import type { Verificacion } from '../papeles/logica';
import { estadoSinConectar, resumenPasos, textoCara, tituloActivacion } from './esperaCiudadTextos';
import { type FaltaServidor, avisoDeFalta, primeraFalta } from './queTeFaltaLogica';

/**
 * C-REGISTRO-TODO-EL-PAIS (26 nov 2026; Venezuela y Estados Unidos): el inicio de Driver de una cuenta
 * EN ESPERA de su ciudad ya no se contradice. Arriba decía «En tu ciudad todavía no hay viajes» y
 * debajo «Te faltan 2 pasos para empezar», «Con ella ya puedes conectarte y trabajar» y «Termina tus
 * papeles y te avisamos en cuanto tu cuenta quede activa».
 * Comprobado en ROJO: sin el `enEspera` en `avisoDeFalta` (cara, vehículo, placa) y en el estado.
 */

/** Lo que a quien espera nunca se le puede decir: que ya se conecta, trabaja o recibe hoy. */
const PROMESA = [
  /ya puedes/i,
  /para empezar/i,
  /recibir carreras/i,
  /empieces a recibir/i,
  /para conectarte/i,
  /quede activa/i,
  /you can go online/i,
  /to get started/i,
  /to start\b/i,
  /to get trips/i,
  /start getting trips/i,
  /to go online/i,
  /account is active/i,
];
const prometeYa = (t: string) => PROMESA.some((r) => r.test(t));

const IDIOMAS: Idioma[] = ['es', 'en'];
const DEL_REGISTRO: FaltaServidor[] = [
  { clave: 'cara', quien: 'conductor' },
  { clave: 'telefono', quien: 'conductor' },
  { clave: 'sin_vehiculo', quien: 'conductor' },
  { clave: 'sin_placa', quien: 'conductor', vehiculoTipo: 'moto' },
  { clave: 'vehiculo_sin_activar', quien: 'conductor', vehiculoTipo: 'carro' },
  { clave: 'vehiculo_sin_enviar', quien: 'conductor', vehiculoTipo: 'moto' },
  { clave: 'papeles_sin_enviar', quien: 'conductor' },
];

describe('C-REGISTRO-TODO-EL-PAIS · Driver en espera de su ciudad no promete trabajar ya', () => {
  it('lo que falta (cara, celular, vehículo, placa…) se dice para dejar la cuenta lista', () => {
    for (const idioma of IDIOMAS)
      for (const f of DEL_REGISTRO) {
        const a = avisoDeFalta(f, idioma, true);
        expect(a, f.clave).not.toBeNull();
        expect(prometeYa(`${a!.titulo} ${a!.detalle}`), `${idioma} ${f.clave}`).toBe(false);
      }
  });

  it('sin espera, los textos son exactamente los de siempre', () => {
    expect(avisoDeFalta({ clave: 'cara', quien: 'conductor' }, 'es')?.detalle).toBe(
      'Es la foto que ven los pasajeros. Con ella ya puedes conectarte y trabajar.',
    );
    expect(avisoDeFalta({ clave: 'cara', quien: 'conductor' }, 'es', false)?.titulo).toBe(
      'Tómate la foto de tu cara para empezar',
    );
    expect(avisoDeFalta({ clave: 'sin_vehiculo', quien: 'conductor' }, 'en')?.detalle).toBe(
      'Tell us what you drive (make, model and license plate) to get trips.',
    );
    expect(resumenPasos(2, 'es', false)).toEqual({
      titulo: 'Te faltan 2 pasos para empezar',
      nota: null,
    });
    expect(tituloActivacion('es', false)).toBe('Activa tu cuenta');
    expect(estadoSinConectar('es', { enEspera: false, registroIncompleto: true })).toEqual({
      titulo: 'Todavía no puedes conectarte',
      detalle: 'Termina tus papeles y te avisamos en cuanto tu cuenta quede activa.',
    });
    expect(estadoSinConectar('es', { enEspera: false, registroIncompleto: false })).toBeNull();
  });

  it('el título y la nota del bloque: «Deja tu cuenta lista» y empieza el mismo día que abramos', () => {
    expect(resumenPasos(2, 'es', true)).toEqual({
      titulo: 'Deja tu cuenta lista',
      nota: 'Te faltan 2 pasos. Con tu foto y tus papeles al día, empiezas el mismo día que abramos en tu ciudad.',
    });
    expect(resumenPasos(1, 'en', true)).toEqual({
      titulo: 'Get your account ready',
      nota: '1 step left. With your photo and documents up to date, you start the same day we open in your city.',
    });
    expect(tituloActivacion('es', true)).toBe('Deja tu cuenta lista');
    expect(tituloActivacion('en', true)).toBe('Get your account ready');
    for (const idioma of IDIOMAS) {
      const c = textoCara(idioma, true);
      expect(prometeYa(`${c.titulo} ${c.detalle}`)).toBe(false);
    }
  });

  it('el bloque de conectarse: no hay viajes en su ciudad y le avisamos; los papeles, después y solo si faltan', () => {
    const con = estadoSinConectar('es', { enEspera: true, registroIncompleto: true })!;
    expect(con.titulo).toBe('Aún no hay viajes en tu ciudad');
    expect(con.detalle).toBe(
      'Te avisamos apenas abramos. Mientras tanto, termina tus papeles para empezar ese mismo día.',
    );
    const lista = estadoSinConectar('es', { enEspera: true, registroIncompleto: false })!;
    expect(lista.detalle).toBe('Tu cuenta ya está lista. Te avisamos apenas abramos.');
    expect(lista.detalle).not.toMatch(/papeles/);
    const en = estadoSinConectar('en', { enEspera: true, registroIncompleto: true })!;
    expect(en.titulo).toBe('No trips in your city yet');
    expect(en.detalle).toMatch(/^We’ll let you know as soon as we open\. Meanwhile/);
    // Nada partido en dos renglones feos: los títulos caben en una línea de un celular chico.
    for (const t of [con.titulo, en.titulo, resumenPasos(2, 'es', true).titulo])
      expect(t.length).toBeLessThanOrEqual(30);
  });

  it('«Tus papeles» con la cara pendiente tampoco promete trabajar ya', () => {
    const v = {
      pais: 'VE',
      asistente: true,
      plazo: {
        estado: 'sin_plazo',
        venceEn: null,
        dias: 0,
        diasPolitica: 30,
        paraEmpezar: ['cara'],
      },
      perfil: { nombre: 'Ana', tieneCara: false },
      consentimiento: true,
      pasos: [{ paso: 'cara', papel: 'cara', soloEnVivo: true, foto: null }],
      papeles: [{ papel: 'cara', pasos: ['cara'], estado: 'pendiente', motivo: '' }],
      listos: 0,
      total: 1,
      puedeEnviar: false,
    } as unknown as Verificacion;
    expect(tarjetaPapeles(v, 'es')?.titulo).toBe('Tómate la foto de tu cara para empezar');
    for (const idioma of IDIOMAS) {
      const t = tarjetaPapeles(v, idioma, true)!;
      expect(prometeYa(`${t.titulo} ${t.detalle}`), idioma).toBe(false);
    }
  });

  it('primeraFalta cuenta los mismos pasos con o sin espera (solo cambian las palabras)', () => {
    const faltas: FaltaServidor[] = [
      { clave: 'cara', quien: 'conductor' },
      { clave: 'sin_vehiculo', quien: 'conductor' },
    ];
    expect(primeraFalta(faltas, 'es', true)?.despues).toBe(1);
    expect(primeraFalta(faltas, 'es', true)?.aviso.titulo).toBe('Tómate la foto de tu cara');
  });

  it('el inicio de Driver pasa `enEspera` a todas las piezas (bloque, cara, papeles, barra y estado)', () => {
    const inicio = readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8');
    expect(inicio.match(/<QueTeFalta[\s\S]*?enEspera=\{enEspera\}/g)?.length).toBe(2);
    expect(inicio.match(/<TusPapeles[\s\S]*?enEspera=\{enEspera\}/g)?.length).toBe(2);
    expect(inicio).toContain('tituloActivacion(idioma, enEspera)');
    expect(
      inicio.match(/estadoSinConectar\(idioma, \{ enEspera, registroIncompleto \}\)/g)?.length,
    ).toBe(1);
    expect(inicio).not.toMatch(/'Todavía no puedes conectarte'/);
    const bloque = readFileSync(join(__dirname, 'QueTeFalta.tsx'), 'utf8');
    expect(bloque).toContain('resumenPasos(total, idioma, enEspera)');
    expect(bloque).toContain('enEspera={enEspera}');
  });
});

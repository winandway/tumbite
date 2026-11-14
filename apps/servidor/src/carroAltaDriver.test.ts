import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CARRO-ALTA-DRIVER (13 nov 2026) — Venezuela y EE. UU. Las apps no corren en vitest: este candado
 * mira el código de Driver y se pone en rojo si el alta del taxista pierde una de sus piezas (la
 * pantalla en el perfil, la pieza común con Moto, el borrador, la cámara, las plazas y el interruptor).
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-CARRO-ALTA-DRIVER: el taxista se da de alta en Driver', () => {
  it('el perfil abre «Divoox Carro» con la pieza común de Moto', () => {
    expect(leer('apps/repartidor/src/Inicio.tsx')).toMatch(/<MiCarro \/>/);
    expect(leer('apps/repartidor/src/viajes/MiCarro.tsx')).toMatch(
      /<AltaPasajeros servicio="carro" \/>/,
    );
    expect(leer('apps/repartidor/src/viajes/MiMoto.tsx')).toMatch(
      /<AltaPasajeros servicio="moto" \/>/,
    );
  });

  it('la pieza guarda lo escrito, ofrece la cámara, pide plazas 4 o 6 y enciende el servicio que es', () => {
    const s = leer('apps/repartidor/src/viajes/AltaPasajeros.tsx');
    expect(s).toMatch(/useBorrador\(/);
    expect(s).toMatch(/'driver-mi-carro'/);
    expect(s).toMatch(/fotoConCamara\(/);
    expect(s).toMatch(/PLAZAS_CARRO = \[4, 6\]/);
    expect(s).toMatch(/plazas: Number\(v\.plazas\)/);
    expect(s).toMatch(/servicioId: servicio,/);
    expect(s).toMatch(/tipo: servicio,/);
    // Español e inglés.
    expect(s).toMatch(/Divoox Carro/);
    expect(s).toMatch(/Divoox Car'/);
  });
});

/** C-CARRO-VIAJE-PASAJERO: la app del pasajero dice lo de cada servicio (candado sobre el código). */
describe('C-CARRO-VIAJE-PASAJERO: el pasajero ve lo de su servicio', () => {
  it('«Pedir» dice Moto, Carro o Carro XL; el casco solo en Moto', () => {
    const s = leer('apps/cliente/src/viajes/PedirMoto.tsx');
    expect(s).toMatch(/t\.pedirCarroXl/);
    expect(s).toMatch(/t\.pedirCarro\b/);
    expect(s).toMatch(
      /servicio === 'carro' \? t\.avisoCarro : servicio === 'envios' \? t\.avisoEnvio : t\.casco/,
    );
  });

  it('el viaje rotula el vehículo por servicio y muestra foto, plazas y llegada estimada', () => {
    const s = leer('apps/cliente/src/viajes/ViajeEnCurso.tsx');
    expect(s).not.toMatch(/\{t\.moto\}:/);
    expect(s).toMatch(/nombreVehiculo/);
    expect(s).toMatch(/<FotoConductor/);
    expect(s).toMatch(/t\.plazas\(moto\.plazas\)/);
    expect(s).toMatch(/t\.llegaEn\(llegada\)/);
  });
});

/** C-VIAJES-HISTORIAL: «Mis viajes» en las dos apps (candado sobre el código). */
describe('C-VIAJES-HISTORIAL: Mis viajes en las apps', () => {
  it('el pasajero tiene su lista con recibo y ayuda (con borrador); el conductor la suya', () => {
    expect(leer('apps/cliente/src/app/ride.tsx')).toMatch(/<MisViajes \/>/);
    const p = leer('apps/cliente/src/viajes/MisViajes.tsx');
    expect(p).toMatch(/useBorrador\(/);
    expect(p).toMatch(/\/datos\/viajes\/\$\{id\}\/ayuda/);
    expect(p).toMatch(/objeto_olvidado/);
    expect(p).not.toMatch(/telefono/);
    expect(leer('apps/repartidor/src/Inicio.tsx')).toMatch(/<MisViajesConductor \/>/);
    expect(leer('apps/repartidor/src/viajes/MisViajesConductor.tsx')).toMatch(
      /\/datos\/conductor\/viajes\/historial/,
    );
  });
});

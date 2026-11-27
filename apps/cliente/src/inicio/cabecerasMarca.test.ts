import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CABECERAS-MARCA, C-CABECERA-ROTA y C-MOTO-SERIA (27 nov 2026, orden de Richard vía Gerencia) —
 * todos los países. La lógica pura vive en packages/compartido/src/inicioNuevo.test.ts; aquí se
 * revisa cómo la usa la pantalla y que la moto de juguete (la Vespa) no vuelva.
 */
const raiz = join(__dirname, '..', '..', '..', '..');
const leer = (...p: string[]) => readFileSync(join(raiz, ...p));
const huella = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** La Vespa roja que usaban el ícono de Moto y la cabecera hasta el 27 nov (prohibida). */
const VESPA = new Set([
  '0cda9e51f950a0512872b971c4e34385f32b881e0d5dc3202d4ab9a4353116a2', // heroe-moto.webp
  '48a07ceb82c7bb9716de6b2ad249846d661e948786574a05da30ef9aa3536274', // moto.webp
  '0474d2e1c4944eb6330defa6bda23e8424139b8266cb7339662f27b0c59f3d15', // servicio-moto.png
]);

/** La moto de trabajo de 150 cc aprobada (docs/disenos/cabeceras-27nov/FUENTES.md). */
const MOTO_SERIA: Record<string, string> = {
  'apps/cliente/assets/inicio-nuevo/heroe-moto.webp':
    '09c4f166a9e488994fd829257c008447018b90c4464ea69050a500a9d88fd11b',
  'apps/cliente/assets/inicio-nuevo/moto.webp':
    'c59b4431e546d0d147483ea504f68819c3b501a0341a0710c4bcbd9db6fbc4bc',
  'apps/repartidor/assets/servicios/moto.webp':
    'c59b4431e546d0d147483ea504f68819c3b501a0341a0710c4bcbd9db6fbc4bc',
  'apps/cliente/assets/inicio/servicio-moto.png':
    'aaed1becc813a13ef7e1213e44c04824500047eb7d69a9e043108a6c5b9b582d',
  'apps/repartidor/assets/driver/servicio-moto.png':
    'aaed1becc813a13ef7e1213e44c04824500047eb7d69a9e043108a6c5b9b582d',
};

function imagenes(dir: string): string[] {
  const fuera: string[] = [];
  for (const n of readdirSync(join(raiz, dir))) {
    const r = join(dir, n);
    if (statSync(join(raiz, r)).isDirectory()) fuera.push(...imagenes(r));
    else if (/\.(png|webp|jpe?g)$/i.test(n)) fuera.push(r);
  }
  return fuera;
}

describe('C-MOTO-SERIA: el ícono de Moto no vuelve a ser la Vespa', () => {
  it('los íconos y la cabecera de Moto son la moto de 150 cc aprobada', () => {
    for (const [archivo, esperada] of Object.entries(MOTO_SERIA))
      expect(huella(leer(archivo)), archivo).toBe(esperada);
  });

  it('ninguna imagen de las apps, la web ni el borrador es la Vespa', () => {
    const todas = [
      ...imagenes('apps/cliente/assets'),
      ...imagenes('apps/repartidor/assets'),
      ...imagenes('apps/restaurante/assets'),
      ...imagenes('progreso/borrador-inicio'),
    ];
    expect(todas.length).toBeGreaterThan(20);
    for (const f of todas) expect(VESPA.has(huella(leer(f))), f).toBe(false);
  });
});

describe('C-CABECERA-ROTA en la pantalla', () => {
  const inicio = leer('apps/cliente/src/Inicio.tsx').toString();

  it('la del panel solo sale si no es la misma de la vez anterior; si no, una de marca', () => {
    expect(inicio).toMatch(
      /delPanel && delPanel\.id !== ultima\s*\?\s*delPanel\s*:\s*cabeceraDeMarca\(/,
    );
    // Las de marca se eligen con los servicios ABIERTOS de la ciudad (C-CABECERA-SOLO-ABIERTOS).
    expect(inicio).toMatch(
      /cabeceraDeMarca\(idioma, ultima, serviciosAbiertos\(servicios\.servicios\)\)/,
    );
  });

  it('lo visto se guarda en el teléfono, nunca en la base', () => {
    expect(inicio).toMatch(/almacenTelefono\.guardar\(LLAVE_PORTADA, elegida\.id\)/);
    expect(inicio).not.toMatch(/'POST'[^\n]*banners/);
  });

  it('cada cabecera de marca tiene su imagen en la app', () => {
    const r = leer('apps/cliente/src/inicio/recursosNuevo.ts').toString();
    expect(r).toMatch(/satisfies Record<ImagenCabecera, number>/);
    for (const n of [
      'moto',
      'carro',
      'comida',
      'mercado',
      'farmacia',
      'licores',
      'ferreteria',
      'envios',
      'billetera',
      'aliados',
    ])
      expect(
        statSync(join(raiz, `apps/cliente/assets/inicio-nuevo/heroe-${n}.webp`)).size,
      ).toBeLessThan(60_000);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { VERSION_LINEA_IA, marcaLineaIa } from '@tumbite/compartido';
import { usarTransporteCorreo } from '../correo';
import { mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';
import { type LlamadaModelo, usarModeloCamila } from './modelo';

/**
 * C-CHAT-WEB-SIN-MURO (23 nov 2026, orden de Richard) — todos los países.
 * En la web el chat de ayuda no tiene muro: una línea debajo de la casilla informa y el
 * mensaje viaja con la marca de esa línea. El servidor guarda una vez cuándo y con qué versión se
 * informó, y con eso la persona es atendida como siempre. iPhone y las apps ya publicadas (que no
 * mandan la marca) siguen exactamente igual: sin un «sí» explícito, nada sale al proveedor.
 * Quien eligió «prefiero una persona» sigue sin pasar por la IA aunque la marca llegue.
 */
function modelo() {
  const llamadas: Parameters<LlamadaModelo>[1][] = [];
  usarModeloCamila(async (_env, p) => {
    llamadas.push(p);
    return { partes: [{ text: 'Respuesta del modelo de prueba.' }], entrada: 1000, salida: 200 };
  });
  return llamadas;
}
afterEach(() => {
  usarModeloCamila(null);
  usarTransporteCorreo(null);
});

async function escenario() {
  usarTransporteCorreo(
    async () => new Response(JSON.stringify({ success: true, message_id: 'm' })),
    { omitirDePrueba: false },
  );
  const m = mundo({
    BUCKET: crearAlmacenPruebas().bucket,
    ADMIN_CORREOS: 'equipo@windoce.com',
    GEMINI_API_KEY: 'llave-de-prueba-de-gemini-1234',
  });
  const cliente = await m.cuenta('cliente', 'Paula Persona');
  const decir = (texto: string, extra: object = {}, canal: 'web' | 'app' = 'web') =>
    m.llamar('POST', '/datos/camila/mensaje', { texto, canal, ...extra }, cliente.token);
  const fila = () =>
    m.DB.prepare(
      'SELECT permiso_ia, permiso_ia_en, permiso_ia_version FROM camila_personas WHERE usuario_id = ?',
    )
      .bind(cliente.id)
      .first<{
        permiso_ia: number | null;
        permiso_ia_en: string | null;
        permiso_ia_version: string | null;
      }>();
  return { m, cliente, decir, fila };
}

describe('C-CHAT-WEB-SIN-MURO: la web escribe de una vez', () => {
  it('web: con la marca de la línea, Camila contesta y queda guardado cuándo y con qué versión se informó', async () => {
    const llamadas = modelo();
    const e = await escenario();
    const r = await e.decir('¿Cómo cambio mi dirección de entrega?', {
      avisoIa: marcaLineaIa('web'),
    });
    expect(r.estado).toBe(200);
    expect(llamadas.length).toBeGreaterThan(0);
    expect(r.datos.permisoIa).toBe(true);
    const f = await e.fila();
    expect(f?.permiso_ia).toBe(1);
    expect(f?.permiso_ia_en).toBeTruthy();
    expect(f?.permiso_ia_version).toBe(`${VERSION_LINEA_IA}/web`);
  });

  it('el registro se escribe una sola vez: los mensajes siguientes no lo reescriben', async () => {
    modelo();
    const e = await escenario();
    await e.decir('Primero', { avisoIa: marcaLineaIa('web') });
    await e.m.DB.prepare(
      "UPDATE camila_personas SET permiso_ia_en = '2026-01-01 00:00:00' WHERE usuario_id = ?",
    )
      .bind(e.cliente.id)
      .run();
    await e.decir('Segundo', { avisoIa: marcaLineaIa('web') });
    expect((await e.fila())?.permiso_ia_en).toBe('2026-01-01 00:00:00');
  });

  it('quien eligió «prefiero una persona» sigue sin pasar por la IA aunque llegue la marca', async () => {
    const llamadas = modelo();
    const e = await escenario();
    await e.m.llamar('POST', '/datos/camila/permiso-ia', { acepto: false }, e.cliente.token);
    const r = await e.decir('¿Cómo agrego una propina?', { avisoIa: marcaLineaIa('web') });
    expect(llamadas).toHaveLength(0);
    expect(r.datos.respuesta).toMatch(/una persona de nuestro equipo/i);
    expect((await e.fila())?.permiso_ia).toBe(0);
  });
});

describe('C-CHAT-WEB-SIN-MURO: iPhone, Android y las apps publicadas no cambian', () => {
  it('sin marca (Driver 0.1.69, cliente 0.1.60, iPhone): como hoy, nada sale al proveedor', async () => {
    const llamadas = modelo();
    const e = await escenario();
    const r = await e.decir('¿Cómo cambio mi dirección de entrega?', {}, 'app');
    expect(llamadas).toHaveLength(0);
    expect(r.datos.respuesta).toMatch(/una persona de nuestro equipo/i);
    expect((await e.fila())?.permiso_ia).toBeNull();
  });

  it('una marca de Android, de iPhone o inventada no vale: las apps piden el permiso explícito', async () => {
    const llamadas = modelo();
    const e = await escenario();
    await e.decir(
      '¿Cómo cambio mi dirección de entrega?',
      { avisoIa: `${VERSION_LINEA_IA}/android` },
      'app',
    );
    await e.decir('¿Cómo agrego una propina?', { avisoIa: `${VERSION_LINEA_IA}/ios` }, 'app');
    await e.decir('¿Cómo cambio mi dirección?', { avisoIa: 'cualquier-cosa' }, 'app');
    expect(llamadas).toHaveLength(0);
    expect((await e.fila())?.permiso_ia).toBeNull();
  });

  it('candado de código: la marca solo se acepta para la web, y el corte sigue antes del modelo', () => {
    const cerebro = readFileSync(join(__dirname, 'cerebro.ts'), 'utf8');
    expect(cerebro).toMatch(/enPantalla && Number\(persona\.permiso_ia \?\? -1\) !== 1/);
    const ruta = readFileSync(join(__dirname, '..', 'rutas', 'camila.ts'), 'utf8');
    expect(ruta).toMatch(/esMarcaLineaIa\(/);
    expect(ruta).toMatch(/permiso_ia IS NULL/);
  });
});

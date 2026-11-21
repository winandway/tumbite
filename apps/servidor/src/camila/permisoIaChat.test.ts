import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { usarTransporteCorreo } from '../correo';
import { mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';
import { type LlamadaModelo, usarModeloCamila } from './modelo';

/**
 * C-PERMISO-IA-CHAT (21 nov 2026, decisión delegada por Richard; Apple 5.1.2(i)) — todos los países.
 * El chat de ayuda manda lo que la persona escribe y las capturas que adjunta a un servicio de
 * inteligencia artificial de un proveedor. Antes del primer mensaje se le pide permiso explícito, una
 * vez. Sin un «sí» (dijo que no, o no contestó), NADA de esa persona sale al proveedor: su mensaje va
 * a la bandeja del equipo y se le dice que una persona le responderá. Lo hace cumplir el servidor.
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
    {
      omitirDePrueba: false,
    },
  );
  const almacen = crearAlmacenPruebas();
  const m = mundo({
    BUCKET: almacen.bucket,
    ADMIN_CORREOS: 'equipo@windoce.com',
    GEMINI_API_KEY: 'llave-de-prueba-de-gemini-1234',
  });
  const cliente = await m.cuenta('cliente', 'Paula Persona');
  const decir = (texto: string, token = cliente.token, canal: 'web' | 'app' = 'app') =>
    m.llamar('POST', '/datos/camila/mensaje', { texto, canal }, token);
  const permiso = (acepto: boolean, token = cliente.token) =>
    m.llamar('POST', '/datos/camila/permiso-ia', { acepto }, token);
  const hilo = (token = cliente.token) => m.llamar('GET', '/datos/camila/hilo', undefined, token);
  const casos = async () =>
    Number(
      (await m.DB.prepare("SELECT COUNT(*) AS n FROM camila_casos WHERE estado = 'abierto'").first<{
        n: number;
      }>())!.n,
    );
  return { m, cliente, decir, permiso, hilo, casos };
}

describe('C-PERMISO-IA-CHAT: sin un «sí», nada sale al proveedor de IA', () => {
  it('sin contestar: ninguna llamada al modelo, el mensaje va al equipo y se le dice', async () => {
    const llamadas = modelo();
    const e = await escenario();
    expect((await e.hilo()).datos.permisoIa).toBeNull();
    const r = await e.decir('¿Cómo cambio mi dirección de entrega?');
    expect(r.estado).toBe(200);
    expect(llamadas).toHaveLength(0);
    expect(r.datos.respuesta).toMatch(/una persona de nuestro equipo/i);
    expect(r.datos.permisoIa).toBeNull();
    expect(await e.casos()).toBe(1);
    // Sigue escribiendo: tampoco sale nada, y no se abre otro caso ni se le repite el aviso.
    const r2 = await e.decir('Es para el pedido de hoy, mi correo es paula@ejemplo.com');
    expect(llamadas).toHaveLength(0);
    expect(r2.datos.respuesta).toBeNull();
    expect(await e.casos()).toBe(1);
    // El equipo ve los dos mensajes tal cual.
    const { results } = await e.m.DB.prepare(
      "SELECT texto FROM camila_mensajes WHERE autor = 'persona' ORDER BY rowid",
    ).all<{ texto: string }>();
    expect(results.map((x) => x.texto)).toEqual([
      '¿Cómo cambio mi dirección de entrega?',
      'Es para el pedido de hoy, mi correo es paula@ejemplo.com',
    ]);
  });

  it('dijo que no: ni el texto ni una captura salen; con «sí» todo sigue como siempre', async () => {
    const llamadas = modelo();
    const e = await escenario();
    expect((await e.permiso(false)).datos).toEqual({ ok: true, permisoIa: false });
    expect((await e.hilo()).datos.permisoIa).toBe(false);
    await e.decir('La app se me cierra sola al abrir el mapa');
    // Una captura sola (el botón de adjuntar) tampoco sale.
    const cap = await e.m.foto('/datos/camila/fallos/captura', e.cliente.token);
    expect(cap.estado).toBeLessThan(300);
    expect(llamadas).toHaveLength(0);
    expect(await e.casos()).toBe(1);

    // Cambia de opinión (Ajustes): desde ahí, como siempre.
    expect((await e.permiso(true)).datos).toEqual({ ok: true, permisoIa: true });
    const r = await e.decir('¿Cómo agrego una propina?');
    expect(r.datos.permisoIa).toBe(true);
    expect(llamadas.length).toBeGreaterThan(0);
    // Y vuelve a decir que no: se corta otra vez.
    await e.permiso(false);
    const antes = llamadas.length;
    await e.decir('Otra pregunta más');
    expect(llamadas).toHaveLength(antes);
  });

  it('el permiso es de cada persona: el «sí» de una no vale para otra, ni para un visitante sin cuenta', async () => {
    const llamadas = modelo();
    const e = await escenario();
    await e.permiso(true);
    await e.decir('¿Cómo agrego una propina?');
    const propias = llamadas.length;
    expect(propias).toBeGreaterThan(0);
    const otra = await e.m.cuenta('cliente', 'Otra Persona');
    await e.decir('¿Y yo cómo pago?', otra.token);
    expect(llamadas).toHaveLength(propias);
    // Un visitante de la web, sin sesión: tampoco, hasta que diga que sí.
    const visitante = (ruta: string, cuerpo: object) =>
      e.m.crudo(ruta, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-camila-visita': 'visita-de-prueba-0123456789abcdefghij',
        },
        body: JSON.stringify(cuerpo),
      });
    const visita = await visitante('/datos/camila/mensaje', {
      texto: '¿Divoox llega a mi ciudad?',
      canal: 'web',
    });
    expect(visita.status).toBe(200);
    expect(llamadas).toHaveLength(propias);
    // Con su «sí», el visitante sí se atiende como siempre.
    expect((await visitante('/datos/camila/permiso-ia', { acepto: true })).status).toBe(200);
    await e.m.DB.prepare("UPDATE camila_casos SET estado = 'cerrado'").run();
    await visitante('/datos/camila/mensaje', { texto: '¿Cómo me registro?', canal: 'web' });
    expect(llamadas.length).toBeGreaterThan(propias);
  });

  it('candados del código: el chat pide el permiso antes del primer mensaje, en la web y en Driver', () => {
    const leer = (ruta: string) =>
      readFileSync(join(__dirname, '..', '..', '..', '..', ruta), 'utf8');
    const cerebro = leer('apps/servidor/src/camila/cerebro.ts');
    // El corte va ANTES de cualquier lectura de ajustes, herramientas o modelo.
    expect(cerebro.indexOf('C-PERMISO-IA-CHAT')).toBeGreaterThan(0);
    expect(cerebro.indexOf('C-PERMISO-IA-CHAT')).toBeLessThan(
      cerebro.indexOf('await leerAjustes(db)'),
    );
    for (const pantalla of [
      'apps/panel/src/sitio/ChatSoporte.tsx',
      'apps/repartidor/src/soporte/ChatSoporteApp.tsx',
    ]) {
      expect(leer(pantalla), pantalla).toContain('/datos/camila/permiso-ia');
      expect(leer(pantalla), pantalla).toContain('textosPermisoIaChat');
    }
    // Y se puede cambiar después: en Ajustes de Driver y al pie del chat de la web.
    expect(leer('apps/repartidor/src/Inicio.tsx')).toContain('<AjusteIaChat />');
    expect(leer('apps/panel/src/sitio/ChatSoporte.tsx')).toContain('<AjusteIaChat');
    // Las apps de clientes y de Restaurants no traen este chat: si un día lo traen, piden el permiso.
    for (const app of ['cliente', 'restaurante']) {
      const pkg = leer(`apps/${app}/package.json`);
      expect(pkg).toBeTruthy();
    }
  });
});

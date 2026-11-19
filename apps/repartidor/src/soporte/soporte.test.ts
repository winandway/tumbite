import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textosSoporte } from './textos';

/**
 * C-CAMILA-CHAT en Divoox Driver (17 nov 2026) — todos los países. Candados de la
 * app (sin React Native, leyendo el código): Ayuda está en el menú y el chat habla por el canal de
 * la app, con borrador y los nombres de Camila y del equipo.
 */
const SRC = join(__dirname, '..');
const leer = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');

describe('C-CAMILA-CHAT en Driver', () => {
  it('los textos existen completos en los dos idiomas', () => {
    const es = textosSoporte('es');
    const en = textosSoporte('en');
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const t of [es, en])
      for (const [k, v] of Object.entries(t))
        if (typeof v === 'string') expect(v.trim(), k).not.toBe('');
    expect(es.hablar).toBe('Habla con soporte');
    expect(en.hablar).toBe('Talk to support');
  });

  it('Ayuda está en el menú y abre el chat con soporte por el canal de la app', () => {
    const inicio = leer('Inicio.tsx');
    expect(inicio).toMatch(/\['ayuda', textosSoporte\(idioma\)\.ayuda\]/);
    expect(inicio).toContain("vista === 'ayuda'");
    const chat = leer('soporte', 'ChatSoporteApp.tsx');
    expect(chat).toContain("canal: 'app'");
    expect(chat).toContain("'/datos/camila/hilo'");
    // Lo escrito se guarda como borrador del teléfono, por cuenta.
    expect(chat).toMatch(/useBorrador\(\{[\s\S]*?almacen: almacenTelefono/);
    // Los nombres de Camila y del equipo salen de la pieza compartida.
    expect(chat).toContain('nombreAutorCamila');
    expect(chat).toContain('equipoAtiende');
    // El botón va en fila y no parte su palabra.
    expect(chat).toMatch(/<Boton[\s\S]*?enFila\s*\/>/);
  });

  it('la casilla se vacía antes de la espera de «escribiendo»: lo que se escribe mientras tanto no se borra', () => {
    const chat = leer('soporte', 'ChatSoporteApp.tsx');
    expect(chat.indexOf('await b.limpiar();')).toBeGreaterThan(-1);
    expect(chat.indexOf('await b.limpiar();')).toBeLessThan(
      chat.indexOf('await esperar(r.respuesta);'),
    );
  });

  it('sin señal también saluda, y durante la espera el botón dice «Un momento…» en vez de quedarse mudo', () => {
    const chat = leer('soporte', 'ChatSoporteApp.tsx');
    // El saludo no depende de que el hilo haya cargado: con el aviso de error también sale.
    expect(chat).toContain('(hilo !== null || error) && mensajes.length === 0');
    // Al llegar el mensaje empieza la espera: el botón deja la ruedita y dice lo que pasa.
    expect(chat.indexOf('setRespondiendo(true);')).toBeGreaterThan(
      chat.indexOf('await b.limpiar();'),
    );
    expect(chat.indexOf('setRespondiendo(true);')).toBeLessThan(
      chat.indexOf('await esperar(r.respuesta);'),
    );
    expect(chat).toContain('texto={respondiendo ? t.unMomento : t.enviar}');
    expect(chat).toContain('cargando={enviando && !respondiendo}');
  });

  it('C-CAMILA-REPORTE-CONVERSADO: la captura queda en el borrador (miniatura con su equis) y viaja con el mensaje; nunca se envía sola', () => {
    const chat = leer('soporte', 'ChatSoporteApp.tsx');
    // El botón fijo «Adjuntar captura» abre el bloque para elegirla.
    expect(chat).toContain('testID="chat-adjuntar"');
    expect(chat).toContain('{t.adjuntar}');
    // Regla de la cámara: «Subir desde archivos» y «Tomar foto», con la pieza única.
    expect(chat).toContain("elegir('archivos')");
    expect(chat).toContain("elegir('camara')");
    expect(chat).toContain('fotoConOrigen(idioma, CAMARA, deArchivos, origen)');
    expect(chat).toContain('t.capturaAviso');
    expect(chat).toContain('problemaDeCaptura(');
    // Se sube al borrador (no a la puerta vieja, que la enviaba sola) y vuelve con su id.
    expect(chat).toContain("api.subirFoto(blob, '/datos/camila/adjunto')");
    expect(chat).not.toContain('/datos/camila/fallos/captura');
    // En el borrador: miniatura, «Captura lista» y la equis que la quita aquí y en el servidor.
    expect(chat).toContain('testID="chat-captura-lista"');
    expect(chat).toContain('testID="chat-captura-quitar"');
    expect(chat).toContain('`/datos/camila/adjunto/${a.id}`');
    // Viaja con el texto al tocar Enviar, y se puede enviar la captura sola.
    expect(chat).toContain('...(conAdjunto ? { adjunto: conAdjunto.id } : {})');
    expect(chat).toContain('if ((!texto && !conAdjunto) || enviando) return;');
    // Si la app se cierra, la captura del borrador vuelve con el hilo.
    expect(chat).toContain('h.adjuntoPendiente');
    // En el hilo, el mensaje muestra la imagen (no la marca de texto).
    expect(chat).toContain('esMarcaDeCaptura(m.texto)');
    // Si falla, se ve el motivo y se puede volver a intentar.
    expect(chat).toContain('t.reintentarCaptura');
    // El guion viejo ya no existe: nada de «sin captura» ni de esperar a que Camila la pida.
    expect(chat).not.toMatch(/pideCaptura|mensajeSinCaptura|sinCaptura/);
  });
});

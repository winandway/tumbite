import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SesionArmazon } from './armazon/Armazon';
import {
  ControlesAvisos,
  type Marca,
  ProveedorAvisosEnVivo,
  SONDEO_ACTIVO_MS,
  SONDEO_OCULTO_MS,
  SONDEO_QUIETO_MS,
  compararMarca,
  intervaloSondeo,
} from './avisosEnVivo';
import { SONIDOS, type Entorno, crearSonador } from './sonarEvento';
import { SuperKyc } from './SuperKyc';

/**
 * C-VERIFICACIONES-EN-VIVO (23 nov 2026, Richard): la lista de Verificaciones se actualiza sola, suena
 * UNA vez por verificación nueva (nunca al recargar ni por lo ya visto), el silencio se guarda por
 * cuenta en el servidor y el permiso del navegador se pide solo con el botón.
 */
const usuario = {
  id: 'u-equipo',
  nombre: 'Equipo Soporte',
  correo: 'equipo@ejemplo.com',
  rol: 'admin' as const,
  idioma: 'es' as const,
};

function navegadorDeMentira(oculta = false): Entorno & { sonidos: string[]; titulos: string[] } {
  const sonidos: string[] = [];
  const titulos: string[] = [];
  return {
    sonidos,
    titulos,
    reproducir: (src) => sonidos.push(src),
    oculta: () => oculta,
    avisoNavegador: () => undefined,
    avisarEnTitulo: (t) => titulos.push(t),
  };
}

const marca = (n: number, ultima: string | null): Marca => ({
  pendientes: n,
  ultimaEnviada: ultima,
  firma: `${n}|${ultima}`,
});

/** El servidor de mentira: las marcas en orden (la última se repite) y la preferencia guardada. */
function servidor(marcas: Marca[], pref: Record<string, string> = {}) {
  const guardadas: unknown[] = [];
  let i = 0;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/datos/admin/kyc/marca')) {
      const m = marcas[Math.min(i, marcas.length - 1)];
      i++;
      return new Response(JSON.stringify(m), { status: 200 });
    }
    if (u.includes('/datos/admin/preferencias/avisos')) {
      if (init?.method === 'PUT') guardadas.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ valor: pref, guardada: true }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  return { guardadas, pedidas: () => i };
}

function montar(entorno: Entorno, hijos: React.ReactNode = null) {
  return render(
    <SesionArmazon.Provider value={{ usuario, idioma: 'es', cambiar: vi.fn(), salir: vi.fn() }}>
      <ProveedorAvisosEnVivo activo idioma="es" entorno={entorno} intervalo={() => 15}>
        {hijos}
      </ProveedorAvisosEnVivo>
    </SesionArmazon.Provider>,
  );
}

describe('C-VERIFICACIONES-EN-VIVO · sonar por evento nuevo', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('la pieza suena UNA vez por evento, nunca por lo que ya estaba, y no suena silenciada', () => {
    const nav = navegadorDeMentira();
    let silencio = false;
    const s = crearSonador(nav, () => silencio);
    s.yaEstaba('verificacion', 'a');
    expect(s.sonar('verificacion', 'a', { titulo: 'x', cuerpo: 'y' })).toBe(false);
    expect(s.sonar('verificacion', 'b', { titulo: 'x', cuerpo: 'y' })).toBe(true);
    expect(s.sonar('verificacion', 'b', { titulo: 'x', cuerpo: 'y' })).toBe(false);
    silencio = true;
    expect(s.sonar('verificacion', 'c', { titulo: 'x', cuerpo: 'y' })).toBe(false);
    expect(nav.sonidos).toEqual([SONIDOS.verificacion]);
  });

  it('con la pestaña en segundo plano, además lo dice el título de la pestaña', () => {
    const nav = navegadorDeMentira(true);
    crearSonador(nav, () => false).sonar('verificacion', 'b', {
      titulo: 'Verificación',
      cuerpo: '',
    });
    expect(nav.titulos).toEqual(['Verificación']);
  });

  it('el sonido es original: lo genera un guion del repositorio', () => {
    const raiz = join(__dirname, '..', '..', '..', '..');
    expect(SONIDOS.verificacion).toBe('/sonidos/verificacion.wav');
    const guion = readFileSync(
      join(raiz, 'scripts/sonidos/generar-aviso-verificacion.mjs'),
      'utf8',
    );
    expect(guion).toContain('verificacion.wav');
    const wav = readFileSync(join(raiz, 'apps/panel/public/sonidos/verificacion.wav'));
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    // Corto: menos de un segundo a 22 050 Hz, 16 bits.
    expect(wav.length).toBeLessThan(22_050 * 2);
  });

  it('el panel abierto: la primera marca no suena; una verificación nueva suena una vez', async () => {
    const nav = navegadorDeMentira();
    const s = servidor([
      marca(1, '2026-11-23 10:00:00'),
      marca(1, '2026-11-23 10:00:00'),
      marca(2, '2026-11-23 10:05:00'),
      marca(2, '2026-11-23 10:05:00'),
    ]);
    const cambios: unknown[] = [];
    const oir = (e: Event) => cambios.push((e as CustomEvent).detail);
    window.addEventListener('divoox:cambio-verificaciones', oir);
    const r = montar(nav);
    await waitFor(() => expect(s.pedidas()).toBeGreaterThanOrEqual(5));
    expect(nav.sonidos).toEqual([SONIDOS.verificacion]);
    expect(cambios).toEqual([{ nueva: true }]);
    r.unmount();
    // Recargar: la primera marca de la página nueva es la base, no suena otra vez.
    const nav2 = navegadorDeMentira();
    servidor([marca(2, '2026-11-23 10:05:00')]);
    const r2 = montar(nav2);
    await new Promise((ok) => setTimeout(ok, 80));
    expect(nav2.sonidos).toEqual([]);
    r2.unmount();
    window.removeEventListener('divoox:cambio-verificaciones', oir);
  });

  it('silenciado (guardado por cuenta en el servidor) no suena', async () => {
    const nav = navegadorDeMentira();
    const s = servidor(
      [marca(0, null), marca(1, '2026-11-23 10:05:00'), marca(1, '2026-11-23 10:05:00')],
      { sonido: 'no' },
    );
    const r = montar(nav);
    await waitFor(() => expect(s.pedidas()).toBeGreaterThanOrEqual(4));
    expect(nav.sonidos).toEqual([]);
    r.unmount();
  });

  it('el interruptor de sonido guarda el silencio en el servidor, por cuenta', async () => {
    const nav = navegadorDeMentira();
    const s = servidor([marca(0, null)]);
    const r = montar(nav, <ControlesAvisos idioma="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sonido de avisos' }));
    expect(screen.getByTestId('interruptor-sonido')).toHaveTextContent('Sonido silenciado');
    await waitFor(() => expect(s.guardadas).toEqual([{ valor: { sonido: 'no', aparato: 'no' } }]), {
      timeout: 4_000,
    });
    r.unmount();
  });

  it('el sondeo pregunta cada 5 s trabajando, cada 30 s quieto y cada 60 s en segundo plano', () => {
    expect(intervaloSondeo(false, 0)).toBe(SONDEO_ACTIVO_MS);
    expect(intervaloSondeo(false, 11 * 60_000)).toBe(SONDEO_QUIETO_MS);
    expect(intervaloSondeo(true, 0)).toBe(SONDEO_OCULTO_MS);
    expect(compararMarca(null, marca(1, 'x'))).toEqual({ cambio: false, nueva: null });
    // Aprobar una (baja la cuenta) cambia la lista pero no suena.
    expect(compararMarca(marca(2, 'b'), marca(1, 'a'))).toEqual({ cambio: true, nueva: null });
  });

  it('el permiso del navegador nunca se pide al cargar (solo con el botón)', () => {
    const fuente = readFileSync(join(__dirname, 'avisosEnVivo.tsx'), 'utf8');
    const llamadas = [...fuente.matchAll(/activarAvisosWeb\(/g)];
    expect(llamadas).toHaveLength(1);
    expect(fuente.indexOf('activarAvisosWeb(api')).toBeGreaterThan(fuente.indexOf('cambiarFuera:'));
    expect(fuente).not.toMatch(/requestPermission/);
  });
});

describe('C-VERIFICACIONES-EN-VIVO · la bandeja se actualiza sola', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('al cambiar la marca, la lista se vuelve a traer sin recargar y la fila nueva se resalta', async () => {
    const fila = (id: string, nombre: string) => ({
      id,
      nombre,
      correo: `${id}@ejemplo.com`,
      rol: 'repartidor',
      estado: 'pendiente',
      enviado: '2026-11-23 10:00:00',
      miniatura: null,
    });
    let vuelta = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      const u = String(url);
      if (u.includes('/datos/admin/kyc?')) {
        vuelta++;
        const lista = vuelta === 1 ? [fila('a', 'Ana')] : [fila('b', 'Beto'), fila('a', 'Ana')];
        return new Response(
          JSON.stringify({ solicitudes: lista, siguiente: null, totales: null }),
          {
            status: 200,
          },
        );
      }
      return new Response('{}', { status: 200 });
    });
    render(
      <SesionArmazon.Provider value={{ usuario, idioma: 'es', cambiar: vi.fn(), salir: vi.fn() }}>
        <SuperKyc base="/panel/control-x" idioma="es" id={null} />
      </SesionArmazon.Provider>,
    );
    await screen.findByText('Ana');
    expect(document.querySelector('.kyc-fila-nueva')).toBeNull();
    act(() => {
      window.dispatchEvent(
        new CustomEvent('divoox:cambio-verificaciones', { detail: { nueva: true } }),
      );
    });
    await screen.findByText('Beto');
    const nuevas = [...document.querySelectorAll('.kyc-fila-nueva')];
    expect(nuevas).toHaveLength(1);
    expect(nuevas[0]).toHaveTextContent('Beto');
  });

  it('candado: el panel del equipo monta la vigía y la campana se relee al cambiar', () => {
    const app = readFileSync(join(__dirname, 'PanelApp.tsx'), 'utf8');
    expect(app).toContain('<ProveedorAvisosEnVivo activo');
    expect(app).toContain('window.addEventListener(EVENTO_CAMBIO, alCambiar)');
  });
});

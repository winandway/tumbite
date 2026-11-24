import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActividadCuenta, textoEvento } from './ActividadCuenta';
import { LineaTiempo, puntosDeLinea, type Paso } from './FichaPiezas';
import { SuperEmbudo, dondeSeQuedanMas } from './SuperEmbudo';

/**
 * C-RASTRO en el panel (22 nov 2026): la actividad de una cuenta en su ficha, la línea de tiempo del
 * viaje con metros, motivo y puntos en el mapa, y el embudo del registro. Datos de ejemplo neutros.
 */
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status });

const ACTIVIDAD = {
  rol: 'repartidor',
  alta: {
    fecha: '2026-11-22 10:00:00',
    app: 'repartidor',
    version: '0.9.4',
    plataforma: 'android',
    pais: 'VE',
    region: 'Región de ejemplo',
    ciudad: 'Ciudad de ejemplo',
    red: 'Operadora de ejemplo',
    conOrigen: true,
  },
  esPrueba: false,
  dondeQuedo: {
    ultimo: 'foto_cara',
    sigue: 'foto_documento',
    hechos: ['cuenta', 'correo', 'foto_cara'],
    falta: ['telefono', 'aviso_ia', 'foto_documento'],
  },
  linea: [
    {
      fecha: '2026-11-22 10:20:00',
      tipo: 'viaje',
      evento: 'viaje_conductor',
      detalle: 'moto · terminado',
      quien: null,
      enlace: '/rides/EJEMPLO01',
    },
    {
      fecha: '2026-11-22 10:10:00',
      tipo: 'equipo',
      evento: 'foto_rechazada:cara',
      detalle: 'No se ve la cara',
      quien: 'Soporte Ejemplo',
      enlace: null,
    },
    {
      fecha: '2026-11-22 10:05:00',
      tipo: 'verificacion',
      evento: 'foto:cara',
      detalle: 'amarillo',
      quien: null,
      enlace: null,
    },
    {
      fecha: '2026-11-22 10:02:00',
      tipo: 'paso',
      evento: 'correo',
      detalle: null,
      quien: null,
      enlace: null,
    },
    {
      fecha: '2026-11-22 10:00:00',
      tipo: 'alta',
      evento: 'alta',
      detalle: 'repartidor|0.9.4|android|Ciudad de ejemplo, VE|Operadora de ejemplo',
      quien: null,
      enlace: null,
    },
  ],
};

describe('C-RASTRO · la actividad de una cuenta en su ficha', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('dice de dónde vino el alta, qué pasos dio, cuál le falta y la línea de tiempo en palabras', async () => {
    const pedidas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      pedidas.push(String(url));
      return json({ actividad: ACTIVIDAD });
    });
    render(<ActividadCuenta ruta="/datos/admin/repartidores/u1/actividad" idioma="es" />);
    const caja = await screen.findByTestId('actividad');
    expect(pedidas[0]).toContain('/datos/admin/repartidores/u1/actividad');
    expect(screen.getByTestId('actividad-desde').textContent).toBe('Divoox Driver 0.9.4 · Android');
    expect(screen.getByTestId('actividad-red').textContent).toBe(
      'Ciudad de ejemplo, Región de ejemplo, VE · Operadora de ejemplo',
    );
    const sigue = screen.getByTestId('actividad-sigue');
    expect(sigue.textContent).toContain('Le falta: Foto del documento');
    expect(sigue.querySelector('[data-tono="pendiente"]')).toBeTruthy();
    // Lo hecho en verde y lo pendiente en gris (sistema de diseño), nunca en rojo.
    expect(caja.querySelectorAll('.actividad-pasos [data-tono="hecho"]')).toHaveLength(3);
    expect(caja.querySelectorAll('.actividad-pasos [data-tono="apagado"]')).toHaveLength(3);
    expect(caja.querySelector('[data-tono="problema"]')).toBeNull();
    const linea = within(caja)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    expect(
      linea.some((x) => x.includes('Foto rechazada: cara') && x.includes('por Soporte Ejemplo')),
    ).toBe(true);
    expect(linea.some((x) => x.includes('la comprobación automática tiene dudas'))).toBe(true);
    expect(
      linea.some((x) =>
        x.includes('Divoox Driver 0.9.4 · Android · Ciudad de ejemplo, VE · Operadora de ejemplo'),
      ),
    ).toBe(true);
    expect(within(caja).getByRole('link', { name: 'Abrir' }).getAttribute('href')).toContain(
      '/rides/EJEMPLO01',
    );
  });

  it('C-RASTRO-FUENTES: los pasos van en el orden de la persona y cada uno dice cómo se sabe y qué vio la comprobación', async () => {
    const paso = (p: string, estado: string, extra: Record<string, string | null> = {}) => ({
      paso: p,
      estado,
      fecha: null,
      fuente: null,
      comprobacion: null,
      nota: null,
      ...extra,
    });
    vi.stubGlobal('fetch', async () =>
      json({
        actividad: {
          ...ACTIVIDAD,
          dondeQuedo: {
            ultimo: 'aprobado',
            sigue: 'correo',
            hechos: ['cuenta', 'foto_cara', 'foto_documento', 'aprobado'],
            falta: ['correo'],
            pasos: [
              paso('cuenta', 'hecho', { fecha: '2026-11-01 10:00:00', fuente: 'cuenta' }),
              paso('correo', 'pendiente', { nota: 'correo_frenado' }),
              paso('telefono', 'no_aplica', { nota: 'solo_al_volver' }),
              paso('aviso_ia', 'no_aplica', { nota: 'verificacion_anterior' }),
              paso('foto_cara', 'hecho', { fuente: 'foto', comprobacion: 'amarillo' }),
              paso('foto_documento', 'hecho', {
                fuente: 'verificacion',
                nota: 'verificacion_anterior',
              }),
              paso('aprobado', 'hecho', { fuente: 'equipo' }),
            ],
          },
        },
      }),
    );
    render(<ActividadCuenta ruta="/datos/admin/repartidores/u2/actividad" idioma="es" />);
    const caja = await screen.findByTestId('actividad');
    const filas = [...caja.querySelectorAll('.actividad-pasos li')];
    // En el orden en que los hace la persona, no «lo hecho primero».
    expect(filas.map((li) => li.getAttribute('data-testid'))).toEqual([
      'paso-cuenta',
      'paso-correo',
      'paso-telefono',
      'paso-aviso_ia',
      'paso-foto_cara',
      'paso-foto_documento',
      'paso-aprobado',
    ]);
    const texto = (id: string) => screen.getByTestId(id).textContent ?? '';
    expect(texto('paso-foto_cara')).toContain('Hecho');
    expect(texto('paso-foto_cara')).toContain('la comprobación automática tiene dudas');
    expect(texto('paso-foto_documento')).toContain('entró por la verificación anterior');
    expect(texto('paso-correo')).toContain('Pendiente');
    expect(texto('paso-correo')).toContain('el correo rebotó y está frenado');
    // Lo que no le toca no se cuenta como pendiente.
    expect(texto('paso-telefono')).toContain('No le toca');
    expect(texto('paso-aviso_ia')).toContain('que no llevaba este aviso');
    expect(caja.querySelectorAll('.actividad-pasos [data-tono="hecho"]')).toHaveLength(4);
    expect(caja.querySelector('[data-tono="problema"]')).toBeNull();
  });

  it('una cuenta de antes del rastro lo dice, sin inventar el origen; y en inglés sale en inglés', async () => {
    vi.stubGlobal('fetch', async () =>
      json({
        actividad: {
          ...ACTIVIDAD,
          alta: {
            ...ACTIVIDAD.alta,
            app: null,
            version: null,
            plataforma: null,
            pais: null,
            region: null,
            ciudad: null,
            red: null,
            conOrigen: false,
          },
        },
      }),
    );
    render(<ActividadCuenta ruta="/datos/admin/clientes/u2/actividad" idioma="en" />);
    await screen.findByTestId('actividad');
    expect(screen.queryByTestId('actividad-desde')).toBeNull();
    expect(screen.getByText(/created before sign-up app and network were recorded/)).toBeTruthy();
    expect(screen.getAllByText('Email confirmation').length).toBeGreaterThan(0);
    expect(textoEvento('foto:doc_frente', 'verificacion', 'en')).toBe('Photo uploaded: ID (front)');
    expect(textoEvento('algo_nuevo', 'otro', 'es')).toBe('algo_nuevo');
    // C-FOTO-CARA-A-LA-VISTA: los hitos se dicen en palabras, con su motivo.
    expect(textoEvento('hito:conectar_rechazado', 'hito', 'es', 'cara')).toBe(
      'No lo dejamos conectarse · falta la foto de la cara',
    );
    expect(textoEvento('hito:subida_fallida', 'hito', 'en', 'tiempo')).toBe(
      'Photo upload failed · the upload took too long',
    );
    expect(textoEvento('hito:camara_abierta', 'hito', 'es', null)).toBe('Abrió la cámara');
  });

  it('si el servidor falla, lo dice en la tarjeta (no queda en blanco)', async () => {
    vi.stubGlobal('fetch', async () => json({ error: 'Esa cuenta no existe.' }, 404));
    render(<ActividadCuenta ruta="/datos/admin/clientes/x/actividad" idioma="es" />);
    expect((await screen.findByRole('alert')).textContent).toContain('Esa cuenta no existe.');
  });
});

describe('C-RASTRO · la línea de tiempo del viaje', () => {
  const pasos: Paso[] = [
    {
      tipo: 'estado',
      evento: 'creado',
      fecha: '2026-11-22 10:00:00',
      quien: 'Pasajera de Ejemplo',
      rol: 'cliente',
      detalle: null,
      capa: 'principal',
      desdeAnteriorS: null,
      lugar: null,
      desdeAnteriorM: null,
    },
    {
      tipo: 'estado',
      evento: 'asignado',
      fecha: '2026-11-22 10:01:00',
      quien: 'Conductor de Ejemplo',
      rol: 'conductor',
      detalle: null,
      capa: 'principal',
      desdeAnteriorS: 60,
      lugar: { lat: 1, lng: 1 },
      desdeAnteriorM: null,
    },
    {
      tipo: 'estado',
      evento: 'cancelado',
      fecha: '2026-11-22 10:06:00',
      quien: 'Pasajera de Ejemplo',
      rol: 'cliente',
      detalle: 'cambio_de_planes',
      capa: 'principal',
      desdeAnteriorS: 300,
      lugar: { lat: 1.01, lng: 1 },
      desdeAnteriorM: 1112,
    },
  ];
  it('muestra los metros desde el paso anterior y el motivo de la cancelación', () => {
    render(
      <LineaTiempo
        pasos={pasos}
        idioma="es"
        zona={null}
        eventos={{ asignado: 'Conductor asignado', cancelado: 'Cancelado' }}
        cuentaEliminada="Cuenta borrada"
      />,
    );
    const filas = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(filas[2]).toContain('1.1 km');
    expect(filas[2]).toContain('Motivo: cambio_de_planes');
    expect(screen.getByText(/pasos numerados en el mapa/)).toBeTruthy();
  });
  it('los pasos con lugar van al mapa numerados y en gris', () => {
    const puntos = puntosDeLinea(pasos, { asignado: 'Conductor asignado', cancelado: 'Cancelado' });
    expect(puntos.map((p) => p.etiqueta)).toEqual(['1. Conductor asignado', '2. Cancelado']);
    expect(new Set(puntos.map((p) => p.color))).toEqual(new Set(['#666b73']));
  });
});

describe('C-RASTRO · el embudo del registro', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('encuentra el paso donde se queda más gente; el último paso no cuenta como quedarse', () => {
    expect(
      dondeSeQuedanMas([
        { paso: 'a', seQuedan: 2 },
        { paso: 'b', seQuedan: 6 },
        { paso: 'c', seQuedan: null },
      ]),
    ).toEqual({ paso: 'b', seQuedan: 6 });
    expect(dondeSeQuedanMas([{ paso: 'a', seQuedan: 0 }])).toBeNull();
  });

  it('pinta la tabla, marca en ámbar dónde se queda la mayoría y vuelve a pedir al cambiar la app', async () => {
    const pedidas: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      const ruta = String(url);
      if (ruta.includes('/datos/admin/preferencias/')) return json({ valor: {}, guardada: false });
      if (ruta.includes('/datos/admin/zonas'))
        return json({ zonas: [{ id: 'Z1', nombre: 'Zona de ejemplo', pais: 'VE' }] });
      if (ruta.includes('/datos/admin/embudo')) {
        pedidas.push(ruta);
        return json({
          app: 'repartidor',
          desde: '2026-10-24',
          hasta: '2026-11-22',
          pasos: [
            { paso: 'abrio', personas: 40, seQuedan: 10 },
            { paso: 'formulario', personas: 30, seQuedan: 10 },
            { paso: 'cuenta', personas: 20, seQuedan: 15 },
            { paso: 'foto_cara', personas: 5, seQuedan: null },
          ],
          porPais: [{ pais: 'VE', cuentas: 20 }],
          hitos: [{ hito: 'conectar_rechazado', motivo: 'cara', personas: 7 }],
        });
      }
      return json({});
    });
    render(<SuperEmbudo idioma="es" />);
    const caja = await screen.findByTestId('embudo');
    await waitFor(() => expect(caja.querySelectorAll('tbody tr')).toHaveLength(4));
    const mayor = screen.getByTestId('embudo-mayor');
    expect(mayor.getAttribute('data-tono')).toBe('pendiente');
    expect(mayor.closest('tr')?.getAttribute('data-paso')).toBe('cuenta');
    expect(caja.querySelector('tr[data-paso="cuenta"]')?.textContent).toContain('15');
    // C-FOTO-CARA-A-LA-VISTA: dónde se traban, en palabras.
    expect(screen.getByTestId('embudo-hitos').textContent).toContain(
      'No lo dejamos conectarse · falta la foto de la cara: 7 personas',
    );
    // Quien llegó al último paso no «se queda»: va en verde.
    expect(caja.querySelector('tr[data-paso="foto_cara"] [data-tono="hecho"]')).toBeTruthy();
    expect(pedidas.at(-1)).toContain('app=repartidor');
    expect(pedidas.at(-1)).not.toContain('zona=');
    await userEvent.selectOptions(screen.getByLabelText('App'), 'cliente');
    await waitFor(() => expect(pedidas.at(-1)).toContain('app=cliente'));
    await userEvent.selectOptions(screen.getByLabelText('Zona'), 'Z1');
    await waitFor(() => expect(pedidas.at(-1)).toContain('zona=Z1'));
    expect(screen.getByText(/VE:/)).toBeTruthy();
  });
});

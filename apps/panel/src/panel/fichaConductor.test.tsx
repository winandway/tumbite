import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EsperaAlEquipo, RevisionConductor } from './RevisionConductor';
import { CambiarCiudadConductor } from './CambiarCiudadConductor';
import { EdadesPais } from './EdadesPais';
import { tonoFicha } from './diseno/EtiquetaEstado';
import { MOTIVOS_SERVICIO, codigoEnPalabras, palabra } from './diseno/palabras';
import { compararDatos } from './kycComparar';
import { llaveBorrador } from '@tumbite/compartido';

/**
 * Encargo de Richard en la ficha de un conductor de Verificaciones (25 nov 2026) — todos los países:
 * C-FICHA-VEHICULO-SIN-ENVIAR, C-NACIMIENTO-DEL-DOCUMENTO, C-SIN-CODIGOS-CRUDOS,
 * C-FICHA-HABILITACION-VERDAD, C-FICHA-ESTADOS-CON-COLOR y C-BORRADOR-SIN-AVISO-VACIO.
 */
type Llamada = { url: string; metodo: string; cuerpo?: unknown };
const ok = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });

const motoSinEnviar = (x: Record<string, unknown> = {}) => ({
  id: 'veh-9',
  conductor_id: 'con-1',
  conductor: 'Conductor Uno',
  tipo: 'moto',
  marca: 'Motos Ejemplo',
  modelo: 'M150',
  anio: 2023,
  color: 'Negro',
  placa: 'AB123CD',
  placa_estado: 'FL',
  estado: 'registrado',
  pais: 'VE',
  documentos: [
    { id: 'd1', tipo: 'foto_frente', estado: 'pendiente', venceEn: null },
    { id: 'd2', tipo: 'foto_placa', estado: 'pendiente', venceEn: null },
  ],
  faltaParaAprobar: ['registro'],
  ...x,
});

const servicio = (x: Record<string, unknown> = {}) => ({
  servicioId: 'moto',
  habilitacion: 'aprobada',
  habilitacionGuardada: 'aprobada',
  estadoServicio: 'disponible',
  vehiculoCompatible: false,
  requisitosFaltantes: [],
  puedeActivar: false,
  motivo: 'vehiculo_incompatible',
  tieneVehiculo: true,
  ...x,
});

function servidor(
  llamadas: Llamada[],
  op: {
    sinEnviar?: unknown[];
    servicios?: unknown[];
    detalle?: Record<string, unknown>;
    resultadoAviso?: string;
  } = {},
) {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    llamadas.push({
      url,
      metodo,
      cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    if (url.includes('/activacion'))
      return ok({
        pasos: [],
        listo: false,
        recibiendo: false,
        servicios: [],
        siguiente: null,
        hechos: 0,
        total: 0,
        vehiculo: null,
      });
    if (url.includes('/datos/admin/vehiculos?estado=registrado'))
      return ok({ vehiculos: op.sinEnviar ?? [], totales: null });
    if (url.includes('/datos/admin/vehiculos?')) return ok({ vehiculos: [], totales: null });
    if (url.includes('/papeles-conductor?')) return ok({ documentos: [] });
    if (url.includes('/recordatorios/'))
      return ok({ resultados: [{ canal: 'aviso', estado: op.resultadoAviso ?? 'enviado' }] });
    if (url.includes('/pasajeros'))
      return ok({
        nombre: 'Conductor Uno',
        fechaNacimiento: null,
        ciudad: { id: 'VE-ZZN', nombre: 'Ciudad Norte', pais: 'VE' },
        identidad: 'aprobado',
        documentos: [
          { id: 'p1', tipo: 'licencia_moto', estado: 'aprobado', motivo: '', venceEn: null },
          {
            id: 'p2',
            tipo: 'antecedentes_penales',
            estado: 'pendiente',
            motivo: '',
            venceEn: null,
          },
        ],
        vehiculoActivo: { id: 'veh-9', tipo: 'moto', estado: 'registrado' },
        servicios: op.servicios ?? [servicio()],
        cumplidos: [],
        ...op.detalle,
      });
    return ok({});
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('C-FICHA-VEHICULO-SIN-ENVIAR: el vehículo registrado y sin enviar sale en la ficha', () => {
  it('con fotos, placa y papeles, «Esperando que el conductor la envíe» y «Recordarle» con Camila', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, { sinEnviar: [motoSinEnviar()] });
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    const tarjeta = await screen.findByTestId('sin-enviar-veh-9');
    expect(within(tarjeta).getByText('Esperando que el conductor la envíe')).toBeTruthy();
    expect(within(tarjeta).getByText(/AB123CD/)).toBeTruthy();
    expect(screen.getByTestId('vehiculo-fotos-veh-9').querySelectorAll('img')).toHaveLength(2);
    // Le falta el registro: no hay «Aprobar», se dice qué falta.
    expect(within(tarjeta).queryByTestId('aprobar-sin-enviar-veh-9')).toBeNull();
    expect(within(tarjeta).getByTestId('falta-aprobar-veh-9').textContent).toMatch(/registro/);
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Recordarle' }));
    await waitFor(() =>
      expect(
        llamadas.find(
          (l) => l.metodo === 'POST' && l.url === '/datos/admin/camila/recordatorios/con-1/mensaje',
        )?.cuerpo,
      ).toEqual({ canales: ['aviso'], plantilla: 'vehiculo_enviar' }),
    );
    expect(await within(tarjeta).findByText(/Camila le mandó el aviso/)).toBeTruthy();
  });

  it('completo: «Aprobar» en el botón de la marca, aprueba lo mirado y después el vehículo', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, { sinEnviar: [motoSinEnviar({ faltaParaAprobar: [] })] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    const boton = await screen.findByTestId('aprobar-sin-enviar-veh-9');
    expect(boton.className).toBe('boton');
    expect(screen.getByTestId('puede-aprobar-veh-9').getAttribute('data-tono')).toBe('problema');
    await userEvent.click(boton);
    await waitFor(() =>
      expect(llamadas.filter((l) => l.metodo === 'PUT').map((l) => [l.url, l.cuerpo])).toEqual([
        ['/datos/admin/vehiculos/veh-9/documentos/d1', { estado: 'aprobado', venceEn: null }],
        ['/datos/admin/vehiculos/veh-9/documentos/d2', { estado: 'aprobado', venceEn: null }],
        ['/datos/admin/vehiculos/veh-9', { estado: 'aprobado' }],
      ]),
    );
  });

  it('lo que espera al equipo va arriba, en rojo y con su botón', async () => {
    servidor([], { sinEnviar: [motoSinEnviar({ faltaParaAprobar: [] })] });
    render(<EsperaAlEquipo id="con-1" idioma="es" identidad="#kyc-decision" />);
    const bloque = await screen.findByTestId('espera-equipo');
    await waitFor(() =>
      expect(bloque.textContent).toMatch(/1 vehículo sin enviar que ya puedes aprobar/),
    );
    expect(bloque.textContent).toMatch(/Su identidad, por aprobar o rechazar/);
    expect(within(bloque).getAllByRole('link', { name: 'Ir' })[0]?.className).toBe('boton chico');
    expect(bloque.querySelector('[data-tono="problema"]')).toBeTruthy();
  });
});

describe('C-SIN-CODIGOS-CRUDOS: ningún código del servidor sale crudo en la ficha', () => {
  const CRUDO = /\b[a-z]+_[a-z_]+\b|\bproximamente\b/;

  it('cada motivo del reparto se dice en palabras, en los dos idiomas', async () => {
    for (const idioma of ['es', 'en'] as const)
      for (const motivo of MOTIVOS_SERVICIO) {
        servidor([], {
          servicios: [servicio({ motivo, habilitacion: 'aprobada', puedeActivar: false })],
        });
        const { unmount } = render(
          <RevisionConductor id="con-1" base="/panel/x" idioma={idioma} enFicha />,
        );
        const ficha = await screen.findByTestId('servicio-moto');
        const texto = (await screen.findByTestId('detalle-conductor')).textContent ?? '';
        expect(texto, `${idioma} · ${motivo}`).not.toMatch(CRUDO);
        expect(ficha.textContent).not.toContain(motivo);
        unmount();
        vi.unstubAllGlobals();
      }
  });

  it('un código que ninguna tabla conoce también se dice en palabras', () => {
    expect(palabra({}, 'vehiculo_incompatible')).toBe('Vehiculo incompatible');
    expect(codigoEnPalabras('no_disponible_zona')).toBe('No disponible zona');
    expect(palabra({ x: 'Equis' }, 'x')).toBe('Equis');
  });

  it('las pantallas de la ficha no pintan un estado, motivo o tipo con «?? código»', () => {
    const archivos = [
      'SuperMoto.tsx',
      'RevisionConductor.tsx',
      'VehiculoSinEnviar.tsx',
      'VerificacionesVehiculos.tsx',
      'SuperKycFicha.tsx',
      'SuperPapeles.tsx',
      'SuperFichas.tsx',
    ];
    const peligro =
      /\?\?\s*[a-zA-Z_.?]*\.(estado|motivo|tipo|clave|paso|papel|clase|decision|resultado|falta)\s*\}/;
    for (const a of archivos) {
      const src = readFileSync(join(__dirname, a), 'utf8');
      const linea = src.split('\n').find((l) => peligro.test(l));
      expect(linea ?? '', a).toBe('');
    }
  });
});

describe('C-FICHA-HABILITACION-VERDAD: la habilitación dice lo que falta de verdad', () => {
  it('habilitado sin moto aprobada en uso: lo dice, y «Habilitar para Moto» no sale', async () => {
    servidor([]);
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    const frase = await screen.findByTestId('frase-servicio-moto');
    expect(frase.textContent).toBe('Habilitado, pero sin moto aprobada en uso.');
    expect(frase.className).not.toContain('texto-exito');
    expect(screen.queryByTestId('habilitar-moto')).toBeNull();
    expect(screen.queryByText('No le falta nada para Moto.')).toBeNull();
  });

  it('sin la habilitación del equipo (solo su plazo) el botón sí sale; «Aprobar la edad» solo con fecha', async () => {
    servidor([], {
      servicios: [servicio({ habilitacionGuardada: null, motivo: 'proximamente' })],
    });
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    expect(await screen.findByTestId('habilitar-moto')).toBeTruthy();
    expect(screen.getByTestId('frase-servicio-moto').textContent).toBe(
      'Moto todavía no está abierto en su ciudad.',
    );
    expect(screen.queryByTestId('aprobar-edad')).toBeNull();
    // C-FECHA-GUARDADA: sin fecha, en rojo y con el botón para escribirla a mano.
    expect(screen.getByTestId('sin-fecha').getAttribute('data-tono')).toBe('problema');
    expect(screen.getByTestId('escribir-fecha')).toBeTruthy();
  });

  it('con todo listo dice «No le falta nada» en verde', async () => {
    servidor([], {
      servicios: [servicio({ puedeActivar: true, motivo: 'habilitado', vehiculoCompatible: true })],
      detalle: { fechaNacimiento: '1994-05-10', cumplidos: ['edad_minima_21'] },
    });
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    const frase = await screen.findByTestId('frase-servicio-moto');
    expect(frase.textContent).toBe('No le falta nada para Moto.');
    expect(frase.className).toContain('texto-exito');
    expect(screen.queryByTestId('aprobar-edad')).toBeNull();
    expect(screen.getByText('Edad aprobada')).toBeTruthy();
  });
});

describe('C-FICHA-ESTADOS-CON-COLOR: verde lo hecho, rojo lo del equipo, gris lo del conductor', () => {
  it('la pieza decide el color por quién tiene que actuar', () => {
    expect(tonoFicha('aprobado')).toBe('hecho');
    expect(tonoFicha('habilitada')).toBe('hecho');
    expect(tonoFicha('pendiente', 'equipo')).toBe('problema');
    expect(tonoFicha('en_revision', 'equipo')).toBe('problema');
    expect(tonoFicha('pendiente', 'conductor')).toBe('apagado');
    expect(tonoFicha('sin_enviar', 'conductor')).toBe('apagado');
    expect(tonoFicha('rechazado', 'conductor')).toBe('problema');
  });

  it('en la ficha: identidad y licencia aprobadas en verde, el papel por revisar en rojo', async () => {
    servidor([]);
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    expect((await screen.findByTestId('ficha-identidad')).getAttribute('data-tono')).toBe('hecho');
    const ficha = screen.getByTestId('detalle-conductor');
    const tonos = [...ficha.querySelectorAll('.lista [data-tono]')].map((x) => [
      x.textContent,
      x.getAttribute('data-tono'),
    ]);
    expect(tonos).toContainEqual(['Aprobado', 'hecho']);
    expect(tonos).toContainEqual(['Por revisar', 'problema']);
  });
});

describe('C-NACIMIENTO-DEL-DOCUMENTO en la tabla de la ficha', () => {
  it('la fecha leída sale con su confianza frente a la de la cuenta', () => {
    const filas = compararDatos({
      lecturas: [
        {
          paso: 'doc_frente',
          lectura: { nombre: 'Conductor Uno', nacimiento: '1994-05-10', confianzaNacimiento: 88 },
        },
      ],
      nombre: 'Conductor Uno',
      declarado: null,
      nacimiento: null,
    });
    expect(filas.find((f) => f.clave === 'nacimiento')).toEqual({
      clave: 'nacimiento',
      leido: '1994-05-10',
      escrito: '',
      estado: 'sin_dato',
      confianza: 88,
    });
  });
});

describe('C-BORRADOR-SIN-AVISO-VACIO en «Cambiar ciudad»', () => {
  it('un borrador vacío no dice «Recuperamos…»; cancelar tira lo escrito', async () => {
    servidor([]);
    const llave = llaveBorrador('ciudad-conductor-con-1', 'superadmin');
    localStorage.setItem(llave, JSON.stringify({ zonaId: '', motivo: '' }));
    const cerrar = vi.fn();
    const { unmount } = render(
      <CambiarCiudadConductor id="con-1" idioma="es" alCerrar={cerrar} alCambiar={() => {}} />,
    );
    await waitFor(() => expect(localStorage.getItem(llave)).toBeNull());
    expect(screen.queryByText(/Recuperamos lo que estabas escribiendo/)).toBeNull();
    unmount();
    localStorage.setItem(llave, JSON.stringify({ zonaId: '', motivo: 'Se mudó' }));
    render(
      <CambiarCiudadConductor id="con-1" idioma="es" alCerrar={cerrar} alCambiar={() => {}} />,
    );
    expect(await screen.findByText(/Recuperamos lo que estabas escribiendo/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(localStorage.getItem(llave)).toBeNull());
    expect(cerrar).toHaveBeenCalled();
  });
});

describe('C-EDAD-POR-PAIS, C-FECHA-GUARDADA y C-CRUCES-DOCUMENTO en la ficha', () => {
  it('la edad dice la de su país (nunca 21 fijo), los cruces van en ámbar y la fecha se escribe a mano', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, {
      servicios: [
        servicio({ requisitosFaltantes: ['edad_minima_21'], motivo: 'requisitos_faltantes' }),
      ],
      detalle: {
        edades: [{ servicio: 'moto', minima: 18, edad: null, falta: 'sin_fecha' }],
        datosDocumento: { nacimiento: '1974-03-10', confianzaNacimiento: 55, estado: 'propuesta' },
        cruces: [
          { clave: 'nombre', leido: 'Otra Persona', escrito: 'Conductor Uno' },
          { clave: 'sin_fecha', leido: '', escrito: '' },
        ],
      },
    });
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    const ficha = await screen.findByTestId('detalle-conductor');
    await waitFor(() =>
      expect(ficha.textContent).toContain('Tener 18 años o más (la edad mínima de su país)'),
    );
    expect(ficha.textContent).not.toMatch(/21 años/);
    expect(screen.getByTestId('cruce-nombre').getAttribute('data-tono')).toBe('pendiente');
    expect(screen.getByTestId('cruce-nombre').textContent).toMatch(/Otra Persona/);
    expect(screen.queryByTestId('cruce-sin_fecha')).toBeNull();
    expect(screen.getByTestId('fecha-propuesta').textContent).toMatch(/1974-03-10/);
    await userEvent.click(screen.getByTestId('escribir-fecha'));
    const form = screen.getByTestId('form-fecha');
    await userEvent.type(
      within(form).getByLabelText('Motivo (queda en el registro)'),
      'Vista en su cédula',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar la fecha' }));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.url === '/datos/admin/conductores/con-1/fecha-nacimiento')?.cuerpo,
      ).toEqual({ fecha: '1974-03-10', motivo: 'Vista en su cédula' }),
    );
  });

  it('Países y servicios enseña la edad de cada país y guarda el cambio con su motivo', async () => {
    const llamadas: Llamada[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      llamadas.push({
        url,
        metodo: init?.method ?? 'GET',
        cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      const fila = (pais: string, moto: number) => ({
        pais,
        servicios: [{ servicio: 'moto', edad: moto, porDefecto: moto, fijada: false }],
      });
      return ok({ paises: [fila('US', 21), fila('VE', 18)], limites: { minima: 16, maxima: 30 } });
    });
    render(<EdadesPais idioma="es" />);
    expect((await screen.findByTestId('edad-VE-moto')).textContent).toMatch(/^18/);
    expect(screen.getByTestId('edad-US-moto').textContent).toMatch(/^21/);
    await userEvent.type(screen.getByLabelText('Edad mínima'), '19');
    await userEvent.type(
      screen.getByLabelText('Motivo del cambio de edad (queda en el registro)'),
      'Decisión del equipo',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar la edad' }));
    await waitFor(() =>
      expect(llamadas.find((l) => l.metodo === 'PUT')?.cuerpo).toEqual({
        pais: 'VE',
        servicio: 'moto',
        edad: 19,
        motivo: 'Decisión del equipo',
      }),
    );
  });
});

describe('«Usar esta fecha» y el borrador de una ciudad que ya no se puede elegir', () => {
  it('la fecha leída sale con «Usar esta fecha» y un toque la guarda (el servidor la toma de lo leído)', async () => {
    const llamadas: Llamada[] = [];
    servidor(llamadas, {
      detalle: {
        datosDocumento: { nacimiento: '1974-03-10', confianzaNacimiento: 60, estado: 'propuesta' },
      },
    });
    render(<RevisionConductor id="con-1" base="/panel/x" idioma="es" enFicha />);
    await userEvent.click(await screen.findByRole('button', { name: 'Usar esta fecha' }));
    await waitFor(() =>
      expect(
        llamadas.find((l) => l.url === '/datos/admin/conductores/con-1/fecha-nacimiento')?.cuerpo,
      ).toEqual({ usarLeida: true }),
    );
  });

  it('un borrador con una ciudad que ya no está no deja «Recuperamos…» sobre la casilla vacía', async () => {
    servidor([]);
    const llave = llaveBorrador('ciudad-conductor-con-1', 'superadmin');
    localStorage.setItem(llave, JSON.stringify({ zonaId: 'CIUDAD-CERRADA', motivo: '' }));
    render(
      <CambiarCiudadConductor id="con-1" idioma="es" alCerrar={() => {}} alCambiar={() => {}} />,
    );
    await waitFor(() => expect(localStorage.getItem(llave)).toBeNull());
    expect(screen.queryByText(/Recuperamos lo que estabas escribiendo/)).toBeNull();
  });
});

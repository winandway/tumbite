/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useState } from 'react';
import { almacenNavegador, useBorrador } from '@tumbite/compartido';
import { Campo } from '../CampoClave';
import { pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';

/**
 * Divoox Flex · Fase 3 en el panel de la empresa: indicadores de operación, integraciones (avisos
 * firmados a su sistema), capacidad de los vehículos, sugerencia de orden de paradas y aviso de
 * capacidad al asignar. Nada de dinero aquí.
 */

export const TEXTOS_FASE3 = {
  es: {
    operaciones: 'Operación',
    desde: 'Desde',
    hasta: 'Hasta',
    ver: 'Ver',
    ahora: 'Ahora mismo',
    enCurso: 'Rutas en la calle',
    ofertas: 'Ofertas abiertas',
    porSalir: 'Por salir',
    paquetesPeriodo: 'Paquetes del periodo',
    total: 'En rutas',
    entregados: 'Entregados',
    fallidos: 'No entregados',
    devueltos: 'Recibidos de vuelta',
    tasas: 'Tasas',
    entrega: 'Entregados',
    primerIntento: 'Al primer intento',
    aTiempo: 'Dentro de la ventana',
    sinDato: 'Sin dato',
    sinVentanas: 'Ninguna entrega del periodo tenía ventana horaria.',
    incidencias: 'Incidencias por motivo',
    sinIncidencias: 'Sin incidencias en el periodo.',
    rutasCerradas: 'Rutas cerradas',
    duracion: 'Duración media (salida a cierre)',
    paradasRuta: 'Paradas por ruta',
    conductores: 'Conductores',
    minutos: 'min',
    integracionesCola: 'Avisos a tu sistema pendientes',
    integracionesFallidas: 'Avisos que no llegaron',
    integraciones: 'Integraciones',
    integracionesAyuda:
      'Divoox avisa a tu sistema cada vez que cambia un paquete o una ruta. Cada aviso va firmado: verifica la firma con tu secreto.',
    noActivadas: 'Las integraciones todavía no están activadas en este servidor.',
    nueva: 'Nueva integración',
    url: 'Dirección HTTPS de tu sistema',
    descripcion: 'Descripción (opcional)',
    eventos: 'Eventos',
    todos: 'Todos los eventos',
    crear: 'Crear integración',
    secretoTitulo: 'Tu secreto de firma',
    secretoAyuda: 'Cópialo ahora y guárdalo en tu sistema. No se vuelve a mostrar.',
    entendido: 'Ya lo guardé',
    sinIntegraciones: 'Todavía no tienes integraciones.',
    estados: { activo: 'Activa', pausado: 'Pausada', desactivado: 'Desactivada' } as Record<
      string,
      string
    >,
    pendientes: 'pendientes',
    entregadosCola: 'entregados',
    fallidosCola: 'no llegaron',
    probar: 'Enviar prueba',
    pruebaOk: 'Tu sistema respondió bien',
    pruebaMal: 'Tu sistema no respondió bien',
    intentos: 'Últimos intentos',
    ocultar: 'Ocultar',
    sinIntentos: 'Todavía no hay intentos.',
    masOpciones: 'Más opciones',
    rotar: 'Cambiar el secreto',
    confirmarRotar:
      '¿Cambiar el secreto? El anterior sigue firmando 24 horas para que actualices tu sistema.',
    pausar: 'Pausar',
    reactivar: 'Reactivar',
    desactivar: 'Desactivar',
    confirmarDesactivar: '¿Desactivar esta integración? Dejará de recibir avisos.',
    prefijo: 'Secreto',
    ultimoExito: 'Último aviso entregado',
    vehiculos: 'Vehículos',
    vehiculosAyuda:
      'Declara cuánto carga cada vehículo. Divoox te avisa antes de asignar una ruta que no cabe. Lo que no declares queda «sin dato».',
    sinVehiculos: 'Tus conductores todavía no tienen vehículos registrados.',
    maxPaquetes: 'Máximo de paquetes',
    maxPeso: 'Peso máximo (kg)',
    maxVolumen: 'Volumen máximo (litros)',
    maxLado: 'Lado más largo de un paquete (cm)',
    guardar: 'Guardar',
    guardado: 'Guardado.',
    editar: 'Editar capacidad',
    capacidad: 'Capacidad',
    sinCapacidad: 'Sin capacidad declarada',
    vehiculo: 'Vehículo',
    sinVehiculo: 'Sin vehículo',
    capacidadOk: 'La ruta cabe en este vehículo.',
    capacidadExcede: 'La ruta no cabe en este vehículo:',
    capacidadDesconocida: 'No sabemos si cabe: faltan datos.',
    asignarIgual: 'Lo sé, asignar igual',
    excesos: {
      paquetes: 'paquetes',
      peso: 'peso (kg)',
      volumen: 'volumen (litros)',
      lado: 'lado más largo (cm)',
    } as Record<string, string>,
    de: 'de',
    desconocidos: {
      capacidad: 'el vehículo no tiene capacidad declarada',
      max_paquetes: 'máximo de paquetes',
      max_peso: 'peso máximo',
      max_volumen: 'volumen máximo',
      max_lado: 'lado máximo',
      peso: 'peso de algunos paquetes',
      medidas: 'medidas de algunos paquetes',
    } as Record<string, string>,
    faltaDato: 'Sin dato',
    sugerir: 'Sugerir orden',
    sugerencia: 'Orden sugerido',
    sugerenciaAyuda:
      'Es una sugerencia: nada cambia hasta que la apliques. La distancia es en línea recta, aproximada; no es la distancia de manejo.',
    actual: 'Orden actual',
    sugerida: 'Orden sugerido',
    km: 'km aprox.',
    mejora: 'Ahorro estimado',
    yaOptimo: 'Tu orden ya es el mejor que encontramos.',
    aplicar: 'Aplicar este orden',
    aplicado: 'Orden aplicado.',
    avisos: {
      sin_coordenadas: 'Hay paradas sin coordenadas: quedan al final.',
      sin_origen: 'El centro no tiene coordenadas: se ordenó sin punto de salida.',
      ventana_invalida: 'Alguna ventana horaria está al revés y no se tuvo en cuenta.',
      pocas_paradas: 'Con tan pocas paradas casi no hay nada que mejorar.',
    } as Record<string, string>,
    obligatoria: 'Primero',
    antes: 'antes',
    tipos: {
      carro: 'Carro',
      moto: 'Moto',
      scooter: 'Scooter',
      bicicleta: 'Bicicleta',
      a_pie: 'A pie',
    } as Record<string, string>,
    obligatoriasAyuda: 'Marca las paradas urgentes: el orden sugerido las pone primero.',
  },
  en: {
    operaciones: 'Operations',
    desde: 'From',
    hasta: 'To',
    ver: 'View',
    ahora: 'Right now',
    enCurso: 'Routes on the street',
    ofertas: 'Open offers',
    porSalir: 'About to leave',
    paquetesPeriodo: 'Packages in this period',
    total: 'On routes',
    entregados: 'Delivered',
    fallidos: 'Not delivered',
    devueltos: 'Received back',
    tasas: 'Rates',
    entrega: 'Delivered',
    primerIntento: 'On the first attempt',
    aTiempo: 'Within the time window',
    sinDato: 'No data',
    sinVentanas: 'No delivery in this period had a time window.',
    incidencias: 'Exceptions by reason',
    sinIncidencias: 'No exceptions in this period.',
    rutasCerradas: 'Closed routes',
    duracion: 'Average duration (start to close)',
    paradasRuta: 'Stops per route',
    conductores: 'Drivers',
    minutos: 'min',
    integracionesCola: 'Notifications to your system pending',
    integracionesFallidas: 'Notifications that didn’t arrive',
    integraciones: 'Integrations',
    integracionesAyuda:
      'Divoox notifies your system every time a package or a route changes. Each notification is signed: verify the signature with your secret.',
    noActivadas: 'Integrations aren’t enabled on this server yet.',
    nueva: 'New integration',
    url: 'Your system’s HTTPS address',
    descripcion: 'Description (optional)',
    eventos: 'Events',
    todos: 'All events',
    crear: 'Create integration',
    secretoTitulo: 'Your signing secret',
    secretoAyuda: 'Copy it now and store it in your system. It won’t be shown again.',
    entendido: 'I saved it',
    sinIntegraciones: 'You don’t have integrations yet.',
    estados: { activo: 'Active', pausado: 'Paused', desactivado: 'Disabled' } as Record<
      string,
      string
    >,
    pendientes: 'pending',
    entregadosCola: 'delivered',
    fallidosCola: 'didn’t arrive',
    probar: 'Send test',
    pruebaOk: 'Your system responded correctly',
    pruebaMal: 'Your system didn’t respond correctly',
    intentos: 'Latest attempts',
    ocultar: 'Hide',
    sinIntentos: 'No attempts yet.',
    masOpciones: 'More options',
    rotar: 'Change secret',
    confirmarRotar:
      'Change the secret? The previous one keeps signing for 24 hours so you can update your system.',
    pausar: 'Pause',
    reactivar: 'Reactivate',
    desactivar: 'Disable',
    confirmarDesactivar: 'Disable this integration? It will stop receiving notifications.',
    prefijo: 'Secret',
    ultimoExito: 'Last notification delivered',
    vehiculos: 'Vehicles',
    vehiculosAyuda:
      'Declare how much each vehicle carries. Divoox warns you before assigning a route that doesn’t fit. Anything you don’t declare stays “no data”.',
    sinVehiculos: 'Your drivers don’t have registered vehicles yet.',
    maxPaquetes: 'Maximum packages',
    maxPeso: 'Maximum weight (kg)',
    maxVolumen: 'Maximum volume (liters)',
    maxLado: 'Longest side of a package (cm)',
    guardar: 'Save',
    guardado: 'Saved.',
    editar: 'Edit capacity',
    capacidad: 'Capacity',
    sinCapacidad: 'No declared capacity',
    vehiculo: 'Vehicle',
    sinVehiculo: 'No vehicle',
    capacidadOk: 'The route fits this vehicle.',
    capacidadExcede: 'The route doesn’t fit this vehicle:',
    capacidadDesconocida: 'We can’t tell if it fits: data is missing.',
    asignarIgual: 'I know, assign anyway',
    excesos: {
      paquetes: 'packages',
      peso: 'weight (kg)',
      volumen: 'volume (liters)',
      lado: 'longest side (cm)',
    } as Record<string, string>,
    de: 'of',
    desconocidos: {
      capacidad: 'the vehicle has no declared capacity',
      max_paquetes: 'maximum packages',
      max_peso: 'maximum weight',
      max_volumen: 'maximum volume',
      max_lado: 'maximum side',
      peso: 'weight of some packages',
      medidas: 'dimensions of some packages',
    } as Record<string, string>,
    faltaDato: 'No data',
    sugerir: 'Suggest order',
    sugerencia: 'Suggested order',
    sugerenciaAyuda:
      'It’s a suggestion: nothing changes until you apply it. Distance is straight-line and approximate, not driving distance.',
    actual: 'Current order',
    sugerida: 'Suggested order',
    km: 'km approx.',
    mejora: 'Estimated savings',
    yaOptimo: 'Your order is already the best we found.',
    aplicar: 'Apply this order',
    aplicado: 'Order applied.',
    avisos: {
      sin_coordenadas: 'Some stops have no coordinates: they go last.',
      sin_origen: 'The hub has no coordinates: the order has no starting point.',
      ventana_invalida: 'A time window is reversed and was ignored.',
      pocas_paradas: 'With so few stops there’s little to improve.',
    } as Record<string, string>,
    obligatoria: 'First',
    antes: 'was',
    tipos: {
      carro: 'Car',
      moto: 'Motorcycle',
      scooter: 'Scooter',
      bicicleta: 'Bicycle',
      a_pie: 'On foot',
    } as Record<string, string>,
    obligatoriasAyuda: 'Mark urgent stops: the suggested order puts them first.',
  },
};
type T3 = (typeof TEXTOS_FASE3)['es'];
const textos = (ctx: Contexto): T3 => TEXTOS_FASE3[ctx.idioma === 'en' ? 'en' : 'es'];

function Aviso({ error }: { error: string }) {
  return error ? (
    <p className="error-general" role="alert">
      {error}
    </p>
  ) : null;
}

/** Números con el separador del idioma (19,5 en español; 19.5 en inglés). */
const numero = (v: number, t: T3) =>
  v.toLocaleString(t === TEXTOS_FASE3.en ? 'en-US' : 'es-ES', { maximumFractionDigits: 1 });
const pctTexto = (v: number | null, t: T3) => (v === null ? t.sinDato : `${numero(v, t)} %`);

// ───────────────────────────── Operación (indicadores) ─────────────────────────────

type Kpis = {
  periodo: { desde: string; hasta: string };
  ahora: { enCurso: number; ofertasAbiertas: number; porSalir: number };
  paquetes: { total: number; entregados: number; fallidos: number; devueltos: number };
  tasas: {
    entregaPct: number | null;
    primerIntentoPct: number | null;
    aTiempoPct: number | null;
    entregasConVentana: number;
  };
  incidenciasPorMotivo: { motivo: string; cantidad: number }[];
  rutasCerradas: {
    cantidad: number;
    duracionMediaMin: number | null;
    paradasPorRuta: number | null;
    conductores: number;
  };
  integraciones: { pendientes: number; fallidas: number };
};

function Tarjeta({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div className="flex-kpi">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

export function Operaciones({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const { empresa } = ctx;
  const b = useBorrador({
    formulario: `flex-operaciones-${empresa.id}`,
    inicial: { desde: '', hasta: '' },
    almacen: almacenNavegador,
  });
  const [k, setK] = useState<Kpis | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(
    (desde: string, hasta: string) => {
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      pedir<Kpis>('GET', `${BASE_FLEX}/empresas/${empresa.id}/operaciones?${q.toString()}`)
        .then((r) => {
          setK(r);
          setError('');
        })
        .catch((x: unknown) => setError(mensajeDe(x)));
    },
    [empresa.id],
  );
  useEffect(() => cargar('', ''), [cargar]);
  const motivos = ctx.t.motivos as Record<string, string> | undefined;
  return (
    <section className="super">
      <h1>{t.operaciones}</h1>
      {b.recuperado && (
        <p className="aviso-borrador">
          {ctx.t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {ctx.t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form
        className="flex-form flex-inline"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          cargar(b.valores.desde, b.valores.hasta);
        }}
      >
        <Campo
          etiqueta={t.desde}
          tipo="date"
          valor={b.valores.desde}
          cambiar={(v) => b.cambiar('desde', v)}
        />
        <Campo
          etiqueta={t.hasta}
          tipo="date"
          valor={b.valores.hasta}
          cambiar={(v) => b.cambiar('hasta', v)}
        />
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.ver}
          </button>
        </div>
      </form>
      <Aviso error={error} />
      {!k ? (
        <p role="status">{ctx.t.cargando}</p>
      ) : (
        <>
          <p className="pista">
            {k.periodo.desde} → {k.periodo.hasta}
          </p>
          <h2>{t.ahora}</h2>
          <div className="flex-kpis">
            <Tarjeta titulo={t.enCurso} valor={k.ahora.enCurso} />
            <Tarjeta titulo={t.ofertas} valor={k.ahora.ofertasAbiertas} />
            <Tarjeta titulo={t.porSalir} valor={k.ahora.porSalir} />
          </div>
          <h2>{t.paquetesPeriodo}</h2>
          <div className="flex-kpis">
            <Tarjeta titulo={t.total} valor={k.paquetes.total} />
            <Tarjeta titulo={t.entregados} valor={k.paquetes.entregados} />
            <Tarjeta titulo={t.fallidos} valor={k.paquetes.fallidos} />
            <Tarjeta titulo={t.devueltos} valor={k.paquetes.devueltos} />
          </div>
          <h2>{t.tasas}</h2>
          <div className="flex-kpis">
            <Tarjeta titulo={t.entrega} valor={pctTexto(k.tasas.entregaPct, t)} />
            <Tarjeta titulo={t.primerIntento} valor={pctTexto(k.tasas.primerIntentoPct, t)} />
            <Tarjeta titulo={t.aTiempo} valor={pctTexto(k.tasas.aTiempoPct, t)} />
          </div>
          {k.tasas.entregasConVentana === 0 ? <p className="pista">{t.sinVentanas}</p> : null}
          <h2>{t.rutasCerradas}</h2>
          <div className="flex-kpis">
            <Tarjeta titulo={t.rutasCerradas} valor={k.rutasCerradas.cantidad} />
            <Tarjeta
              titulo={t.duracion}
              valor={
                k.rutasCerradas.duracionMediaMin === null
                  ? t.sinDato
                  : `${k.rutasCerradas.duracionMediaMin} ${t.minutos}`
              }
            />
            <Tarjeta titulo={t.paradasRuta} valor={k.rutasCerradas.paradasPorRuta ?? t.sinDato} />
            <Tarjeta titulo={t.conductores} valor={k.rutasCerradas.conductores} />
          </div>
          <h2>{t.incidencias}</h2>
          {k.incidenciasPorMotivo.length === 0 ? (
            <p>{t.sinIncidencias}</p>
          ) : (
            <ul>
              {k.incidenciasPorMotivo.map((i) => (
                <li key={i.motivo}>
                  {motivos?.[i.motivo] ?? i.motivo}: <strong>{i.cantidad}</strong>
                </li>
              ))}
            </ul>
          )}
          {ctx.permisos.includes('integraciones.gestionar') ? (
            <div className="flex-kpis">
              <Tarjeta titulo={t.integracionesCola} valor={k.integraciones.pendientes} />
              <Tarjeta titulo={t.integracionesFallidas} valor={k.integraciones.fallidas} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

// ───────────────────────────── Integraciones ─────────────────────────────

type Integracion = {
  id: string;
  url: string;
  eventos: string[];
  descripcion: string;
  secretoPrefijo: string;
  estado: string;
  fallosSeguidos: number;
  ultimoExitoEn: string | null;
  motivo: string;
  cola: { pendientes: number; entregados: number; fallidos: number };
};
type Intento = {
  id: number;
  tipo: string;
  intento: number;
  http: number | null;
  error: string;
  duracionMs: number | null;
  creadoEn: string;
  prueba: boolean;
};

function FilaIntegracion({
  ctx,
  w,
  recargar,
  mostrarSecreto,
}: {
  ctx: Contexto;
  w: Integracion;
  recargar: () => void;
  mostrarSecreto: (s: string) => void;
}) {
  const t = textos(ctx);
  const base = `${BASE_FLEX}/empresas/${ctx.empresa.id}/integraciones/${w.id}`;
  const [menu, setMenu] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; http: number | null; error: string } | null>(
    null,
  );
  const [intentos, setIntentos] = useState<Intento[] | null>(null);
  const [error, setError] = useState('');
  async function accion(f: () => Promise<unknown>) {
    setError('');
    setMenu(false);
    try {
      await f();
      recargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <li className="flex-tarjeta">
      <p>
        <strong>{w.descripcion || w.url}</strong>{' '}
        <span
          className={`insignia ${w.estado === 'activo' ? 'insignia-aprobado' : w.estado === 'desactivado' ? 'insignia-rechazado' : ''}`}
        >
          {t.estados[w.estado] ?? w.estado}
        </span>
      </p>
      <p className="pista">
        {w.url} · {t.prefijo}: {w.secretoPrefijo}…
      </p>
      <p className="pista">{w.eventos.includes('*') ? t.todos : w.eventos.join(', ')}</p>
      <p>
        {w.cola.pendientes} {t.pendientes} · {w.cola.entregados} {t.entregadosCola} ·{' '}
        {w.cola.fallidos} {t.fallidosCola}
        {w.ultimoExitoEn ? ` · ${t.ultimoExito}: ${w.ultimoExitoEn}` : ''}
      </p>
      {w.motivo ? <p className="pista">{w.motivo}</p> : null}
      {prueba ? (
        <p className={prueba.ok ? 'texto-exito' : 'error-general'} role="status">
          {prueba.ok ? t.pruebaOk : t.pruebaMal}
          {prueba.http ? ` (HTTP ${prueba.http})` : ''}
          {prueba.error ? ` · ${prueba.error}` : ''}
        </p>
      ) : null}
      <Aviso error={error} />
      <div className="fila-botones">
        <button
          type="button"
          className="boton secundario"
          onClick={() =>
            void pedir<{ ok: boolean; http: number | null; error: string }>(
              'POST',
              `${base}/probar`,
              {},
            )
              .then((r) => {
                setPrueba(r);
                recargar();
              })
              .catch((x: unknown) => setError(mensajeDe(x)))
          }
        >
          {t.probar}
        </button>
        <button
          type="button"
          className="boton secundario"
          onClick={() =>
            intentos
              ? setIntentos(null)
              : void pedir<{ intentos: Intento[] }>('GET', `${base}/intentos?limite=20`)
                  .then((r) => setIntentos(r.intentos))
                  .catch((x: unknown) => setError(mensajeDe(x)))
          }
        >
          {intentos ? t.ocultar : t.intentos}
        </button>
        <div className="menu-tres-puntos">
          <button
            type="button"
            className="boton secundario"
            aria-label={t.masOpciones}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            ⋮
          </button>
          {menu ? (
            <div role="menu" className="cuenta-menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (window.confirm(t.confirmarRotar))
                    void accion(async () => {
                      const r = await pedir<{ secreto: string }>('POST', `${base}/rotar`, {
                        graciaHoras: 24,
                      });
                      mostrarSecreto(r.secreto);
                    });
                }}
              >
                {t.rotar}
              </button>
              {w.estado === 'activo' ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void accion(() => pedir('PATCH', base, { estado: 'pausado' }))}
                >
                  {t.pausar}
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void accion(() => pedir('PATCH', base, { estado: 'activo' }))}
                >
                  {t.reactivar}
                </button>
              )}
              {w.estado !== 'desactivado' ? (
                <button
                  type="button"
                  role="menuitem"
                  className="peligro"
                  onClick={() => {
                    if (window.confirm(t.confirmarDesactivar))
                      void accion(() => pedir('PATCH', base, { estado: 'desactivado' }));
                  }}
                >
                  {t.desactivar}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {intentos ? (
        intentos.length === 0 ? (
          <p className="pista">{t.sinIntentos}</p>
        ) : (
          <table className="tabla">
            <tbody>
              {intentos.map((i) => (
                <tr key={i.id}>
                  <td>{i.creadoEn}</td>
                  <td>{i.tipo}</td>
                  <td>#{i.intento}</td>
                  <td>{i.http ?? '—'}</td>
                  <td>{i.error || 'OK'}</td>
                  <td>{i.duracionMs ?? '—'} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </li>
  );
}

export function Integraciones({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const { empresa } = ctx;
  const [lista, setLista] = useState<Integracion[] | null>(null);
  const [disponibles, setDisponibles] = useState<string[]>([]);
  const [activadas, setActivadas] = useState(true);
  const [secreto, setSecreto] = useState('');
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: `flex-integracion-${empresa.id}`,
    inicial: { url: '', descripcion: '', eventos: '*' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ integraciones: Integracion[]; eventosDisponibles: string[]; activadas: boolean }>(
      'GET',
      `${BASE_FLEX}/empresas/${empresa.id}/integraciones`,
    )
      .then((r) => {
        setLista(r.integraciones);
        setDisponibles(r.eventosDisponibles);
        setActivadas(r.activadas);
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [empresa.id]);
  useEffect(cargar, [cargar]);
  const elegidos = b.valores.eventos ? b.valores.eventos.split(',') : [];
  function alternar(ev: string) {
    if (ev === '*') return b.cambiar('eventos', elegidos.includes('*') ? '' : '*');
    const sin = elegidos.filter((x) => x !== '*' && x !== ev);
    b.cambiar('eventos', (elegidos.includes(ev) ? sin : [...sin, ev]).join(','));
  }
  async function crearIntegracion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await pedir<{ secreto: string }>(
        'POST',
        `${BASE_FLEX}/empresas/${empresa.id}/integraciones`,
        { url: b.valores.url, descripcion: b.valores.descripcion, eventos: elegidos },
      );
      setSecreto(r.secreto);
      await b.limpiar();
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <section className="super">
      <h1>{t.integraciones}</h1>
      <p className="pista">{t.integracionesAyuda}</p>
      {!activadas ? <p className="pista">{t.noActivadas}</p> : null}
      {secreto ? (
        <div className="flex-tarjeta" role="status">
          <p>
            <strong>{t.secretoTitulo}</strong>
          </p>
          <p className="pista">{t.secretoAyuda}</p>
          <code className="flex-secreto">{secreto}</code>
          <div className="fila-botones">
            <button type="button" className="boton" onClick={() => setSecreto('')}>
              {t.entendido}
            </button>
          </div>
        </div>
      ) : null}
      <Aviso error={error} />
      {lista === null ? (
        <p role="status">{ctx.t.cargando}</p>
      ) : lista.length === 0 ? (
        <p>{t.sinIntegraciones}</p>
      ) : (
        <ul className="flex-lista-tarjetas">
          {lista.map((w) => (
            <FilaIntegracion
              key={w.id}
              ctx={ctx}
              w={w}
              recargar={cargar}
              mostrarSecreto={setSecreto}
            />
          ))}
        </ul>
      )}
      <h2>{t.nueva}</h2>
      {b.recuperado && (
        <p className="aviso-borrador">
          {ctx.t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {ctx.t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form className="flex-form" noValidate onSubmit={(e) => void crearIntegracion(e)}>
        <Campo
          etiqueta={t.url}
          valor={b.valores.url}
          cambiar={(v) => b.cambiar('url', v)}
          placeholder="https://"
        />
        <Campo
          etiqueta={t.descripcion}
          valor={b.valores.descripcion}
          cambiar={(v) => b.cambiar('descripcion', v)}
        />
        <fieldset className="flex-eventos">
          <legend>{t.eventos}</legend>
          <label>
            <input
              type="checkbox"
              checked={elegidos.includes('*')}
              onChange={() => alternar('*')}
            />{' '}
            {t.todos}
          </label>
          {elegidos.includes('*')
            ? null
            : disponibles.map((ev) => (
                <label key={ev}>
                  <input
                    type="checkbox"
                    checked={elegidos.includes(ev)}
                    onChange={() => alternar(ev)}
                  />{' '}
                  {ev}
                </label>
              ))}
        </fieldset>
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={!activadas}>
            {t.crear}
          </button>
        </div>
      </form>
    </section>
  );
}

// ───────────────────────────── Vehículos y capacidad ─────────────────────────────

type Vehiculo = {
  id: string;
  tipo: string;
  descripcion: string;
  placa: string;
  conductorId: string;
  conductor: string;
  capacidad: {
    maxPaquetes: number | null;
    maxPesoKg: number | null;
    maxVolumenLitros: number | null;
    maxLadoCm: number | null;
  } | null;
};

function EditarCapacidad({ ctx, v, listo }: { ctx: Contexto; v: Vehiculo; listo: () => void }) {
  const t = textos(ctx);
  const num = (x: number | null | undefined) => (x == null ? '' : String(x));
  const b = useBorrador({
    formulario: `flex-capacidad-${v.id}`,
    inicial: {
      maxPaquetes: num(v.capacidad?.maxPaquetes),
      maxPesoKg: num(v.capacidad?.maxPesoKg),
      maxVolumenLitros: num(v.capacidad?.maxVolumenLitros),
      maxLadoCm: num(v.capacidad?.maxLadoCm),
    },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const aNum = (s: string) => (s.trim() === '' ? null : Number(s));
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PUT', `${BASE_FLEX}/empresas/${ctx.empresa.id}/vehiculos/${v.id}/capacidad`, {
        maxPaquetes: aNum(b.valores.maxPaquetes),
        maxPesoKg: aNum(b.valores.maxPesoKg),
        maxVolumenLitros: aNum(b.valores.maxVolumenLitros),
        maxLadoCm: aNum(b.valores.maxLadoCm),
      });
      await b.limpiar();
      listo();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <>
      {b.recuperado && (
        <p className="aviso-borrador">
          {ctx.t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {ctx.t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form className="flex-form flex-inline" noValidate onSubmit={(e) => void guardar(e)}>
        <Campo
          etiqueta={t.maxPaquetes}
          tipo="number"
          valor={b.valores.maxPaquetes}
          cambiar={(x) => b.cambiar('maxPaquetes', x)}
        />
        <Campo
          etiqueta={t.maxPeso}
          tipo="number"
          valor={b.valores.maxPesoKg}
          cambiar={(x) => b.cambiar('maxPesoKg', x)}
        />
        <Campo
          etiqueta={t.maxVolumen}
          tipo="number"
          valor={b.valores.maxVolumenLitros}
          cambiar={(x) => b.cambiar('maxVolumenLitros', x)}
        />
        <Campo
          etiqueta={t.maxLado}
          tipo="number"
          valor={b.valores.maxLadoCm}
          cambiar={(x) => b.cambiar('maxLadoCm', x)}
        />
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.guardar}
          </button>
        </div>
        <Aviso error={error} />
      </form>
    </>
  );
}

export function Vehiculos({ ctx }: { ctx: Contexto }) {
  const t = textos(ctx);
  const [lista, setLista] = useState<Vehiculo[] | null>(null);
  const [editando, setEditando] = useState('');
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<{ vehiculos: Vehiculo[] }>('GET', `${BASE_FLEX}/empresas/${ctx.empresa.id}/vehiculos`)
      .then((r) => setLista(r.vehiculos))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [ctx.empresa.id]);
  useEffect(cargar, [cargar]);
  const dato = (v: number | null | undefined, unidad = '') =>
    v == null ? t.faltaDato : `${v}${unidad}`;
  return (
    <section className="super">
      <h1>{t.vehiculos}</h1>
      <p className="pista">{t.vehiculosAyuda}</p>
      <Aviso error={error} />
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      {lista === null ? (
        <p role="status">{ctx.t.cargando}</p>
      ) : lista.length === 0 ? (
        <p>{t.sinVehiculos}</p>
      ) : (
        <ul className="flex-lista-tarjetas">
          {lista.map((v) => (
            <li key={v.id} className="flex-tarjeta">
              <p>
                <strong>{v.conductor}</strong> · {t.tipos[v.tipo] ?? v.tipo} {v.descripcion}{' '}
                {v.placa}
              </p>
              <p className="pista">
                {v.capacidad
                  ? `${t.maxPaquetes}: ${dato(v.capacidad.maxPaquetes)} · ${t.maxPeso}: ${dato(v.capacidad.maxPesoKg)} · ${t.maxVolumen}: ${dato(v.capacidad.maxVolumenLitros)} · ${t.maxLado}: ${dato(v.capacidad.maxLadoCm)}`
                  : t.sinCapacidad}
              </p>
              {editando === v.id ? (
                <EditarCapacidad
                  ctx={ctx}
                  v={v}
                  listo={() => {
                    setEditando('');
                    setOk(t.guardado);
                    cargar();
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => {
                    setOk('');
                    setEditando(v.id);
                  }}
                >
                  {t.editar}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────────────────────────── En el detalle de la ruta ─────────────────────────────

type Capacidad = {
  estado: 'ok' | 'excede' | 'desconocida';
  paquetes: number;
  excesos: { campo: string; limite: number; valor: number }[];
  desconocidos: string[];
};

/** Elegir el vehículo del conductor y ver si la ruta cabe ANTES de asignar (C-FLEX-CAPACIDAD). */
export function CapacidadAlAsignar({
  ctx,
  rutaId,
  conductorId,
  vehiculoId,
  cambiarVehiculo,
  confirmada,
  confirmar,
}: {
  ctx: Contexto;
  rutaId: string;
  conductorId: string;
  vehiculoId: string;
  cambiarVehiculo: (v: string) => void;
  confirmada: boolean;
  confirmar: (v: boolean) => void;
}) {
  const t = textos(ctx);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cap, setCap] = useState<Capacidad | null>(null);
  useEffect(() => {
    if (!ctx.permisos.includes('conductores.gestionar')) return;
    void pedir<{ vehiculos: Vehiculo[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${ctx.empresa.id}/vehiculos`,
    )
      .then((r) => setVehiculos(r.vehiculos))
      .catch(() => undefined);
  }, [ctx.empresa.id, ctx.permisos]);
  useEffect(() => {
    if (!vehiculoId) return;
    let vivo = true;
    void pedir<{ capacidad: Capacidad }>(
      'GET',
      `${BASE_FLEX}/empresas/${ctx.empresa.id}/rutas/${rutaId}/capacidad?vehiculoId=${encodeURIComponent(vehiculoId)}`,
    )
      .then((r) => {
        if (vivo) setCap(r.capacidad);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [ctx.empresa.id, rutaId, vehiculoId]);
  const delConductor = vehiculos.filter((v) => v.conductorId === conductorId);
  if (!conductorId) return null;
  const unidad = (campo: string, valor: number) =>
    campo === 'peso' ? valor / 1000 : campo === 'volumen' ? valor / 1000 : valor;
  const vista = vehiculoId ? cap : null;
  return (
    <div className="flex-capacidad">
      <div className="campo">
        <label htmlFor="flex-vehiculo">{t.vehiculo}</label>
        <select
          id="flex-vehiculo"
          value={vehiculoId}
          onChange={(e) => {
            setCap(null);
            confirmar(false);
            cambiarVehiculo(e.target.value);
          }}
        >
          <option value="">{t.sinVehiculo}</option>
          {delConductor.map((v) => (
            <option key={v.id} value={v.id}>
              {t.tipos[v.tipo] ?? v.tipo} {v.descripcion} {v.placa}
            </option>
          ))}
        </select>
      </div>
      {vista ? (
        vista.estado === 'ok' ? (
          <p className="texto-exito">{t.capacidadOk}</p>
        ) : vista.estado === 'excede' ? (
          <div role="alert" className="flex-alerta">
            <p>
              {t.capacidadExcede}{' '}
              {vista.excesos
                .map(
                  (x) =>
                    `${t.excesos[x.campo] ?? x.campo} ${unidad(x.campo, x.valor)} ${t.de} ${unidad(x.campo, x.limite)}`,
                )
                .join(' · ')}
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmada}
                onChange={(e) => confirmar(e.target.checked)}
              />{' '}
              {t.asignarIgual}
            </label>
          </div>
        ) : (
          <p className="pista">
            {t.capacidadDesconocida}{' '}
            {vista.desconocidos.map((d) => t.desconocidos[d] ?? d).join(', ')}
          </p>
        )
      ) : null}
    </div>
  );
}

type Sugerencia = {
  orden: string[];
  distanciaActualM: number | null;
  distanciaSugeridaM: number | null;
  mejoraPct: number | null;
  cambia: boolean;
  avisos: string[];
};

/** Sugerencia de orden (C-FLEX-OPTIMIZAR): se calcula en el servidor y solo se aplica si la empresa quiere. */
export function SugerenciaOrden({
  ctx,
  rutaId,
  paradas,
  aplicado,
}: {
  ctx: Contexto;
  rutaId: string;
  paradas: { id: string; orden: number; referenciaExterna: string | null }[];
  aplicado: () => void;
}) {
  const t = textos(ctx);
  const [s, setS] = useState<Sugerencia | null>(null);
  const [obligatorias, setObligatorias] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const base = `${BASE_FLEX}/empresas/${ctx.empresa.id}/rutas/${rutaId}`;
  const km = (m: number | null) => (m === null ? t.sinDato : numero(m / 1000, t));
  const nombre = (id: string, i: number) => {
    const p = paradas.find((x) => x.id === id);
    return p
      ? `${i + 1}. ${p.referenciaExterna ?? '—'} (${t.antes} ${p.orden})`
      : `${i + 1}. ${id.slice(0, 6)}`;
  };
  async function sugerir() {
    setError('');
    setOk('');
    try {
      const r = await pedir<{ sugerencia: Sugerencia }>('POST', `${base}/optimizar`, {
        obligatorias,
      });
      setS(r.sugerencia);
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function aplicar() {
    if (!s) return;
    setError('');
    try {
      await pedir('PUT', `${base}/orden`, { paradaIds: s.orden });
      setS(null);
      setOk(t.aplicado);
      aplicado();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <div className="flex-sugerencia">
      <p className="pista">{t.obligatoriasAyuda}</p>
      <div className="fila-botones">
        {paradas.map((p) => (
          <label key={p.id} className="flex-chip">
            <input
              type="checkbox"
              aria-label={`${t.obligatoria}: ${p.orden}`}
              checked={obligatorias.includes(p.id)}
              onChange={(e) =>
                setObligatorias(
                  e.target.checked
                    ? [...obligatorias, p.id]
                    : obligatorias.filter((x) => x !== p.id),
                )
              }
            />{' '}
            {t.obligatoria}: {p.orden}
          </label>
        ))}
      </div>
      <div className="fila-botones">
        <button type="button" className="boton secundario" onClick={() => void sugerir()}>
          {t.sugerir}
        </button>
      </div>
      <Aviso error={error} />
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      {s ? (
        <div className="flex-tarjeta">
          <h3>{t.sugerencia}</h3>
          <p className="pista">{t.sugerenciaAyuda}</p>
          <p>
            {t.actual}: {km(s.distanciaActualM)} {t.km} · {t.sugerida}: {km(s.distanciaSugeridaM)}{' '}
            {t.km} · {t.mejora}: {pctTexto(s.mejoraPct, t)}
          </p>
          {s.avisos.map((a) => (
            <p key={a} className="pista">
              {t.avisos[a] ?? a}
            </p>
          ))}
          {s.cambia ? (
            <>
              <ul className="flex-paradas">
                {s.orden.map((id, i) => (
                  <li key={id}>{nombre(id, i)}</li>
                ))}
              </ul>
              <div className="fila-botones">
                <button type="button" className="boton" onClick={() => void aplicar()}>
                  {t.aplicar}
                </button>
              </div>
            </>
          ) : (
            <p className="texto-exito">{t.yaOptimo}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

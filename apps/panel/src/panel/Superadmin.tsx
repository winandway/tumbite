import { useCallback, useEffect, useState } from 'react';
import {
  correoEjemplo,
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  formatearDolares,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AvisoBorrador } from './AvisoBorrador';
import { GestionFranquicia, SolicitudesFranquicia } from './GestionFranquicia';
import { pedir } from './api';

const T = {
  es: {
    resumen: 'Resumen',
    dinero: 'Dinero de ayer',
    cuadra: 'Cuadra',
    noCuadra: 'NO cuadra: revisar',
    sinConciliar: 'Todavía sin conciliar',
    activarWallets: 'Activar Apple Pay y Google Pay en la web',
    walletsOk: 'Dominio registrado en Stripe. Apple Pay:',
    franquicias: 'Franquicias',
    vendidas: 'Vendidas',
    activas: 'Activas',
    interesados: 'Interesados en franquicia',
    tickets: 'Tickets abiertos',
    motos: 'Motos',
    ciudad: 'Ciudad',
    estado: 'Estado',
    pedidos30: 'Pedidos (30 días)',
    ventas30: 'Ventas (30 días)',
    ganancia30: 'Ganancia (30 días)',
    restaurantes: 'Restaurantes',
    repartidores: 'Repartidores',
    sinFranquicia: 'Ciudades sin franquicia',
    estados: {
      prospecto: 'Prospecto',
      vendida: 'Vendida',
      activa: 'Activa',
      pausada: 'Pausada',
      cerrada: 'Cerrada',
    },
    nombreFranquicia: 'Nombre de la franquicia (ej. Miami Norte)',
    gestionar: 'Territorio y equipo',
    ocultarGestion: 'Ocultar territorio y equipo',
    porCiudad: 'Resultados por ciudad',
    franquiciasCol: 'Franquicias',
    areasCol: 'Áreas',
    areasLibres: 'Áreas sin franquicia',
    nueva: 'Nueva franquicia',
    zona: 'Ciudad (zona)',
    elegir: 'Elige una ciudad',
    duenoCorreo: 'Correo del franquiciado',
    notas: 'Notas privadas',
    crear: 'Crear franquicia',
    guardar: 'Guardar',
    guardado: 'Guardado',
    suPanel: 'Su panel',
    bandeja: 'Bandeja de tickets',
    todos: 'Todos',
    abiertos: 'Abiertos',
    respondidos: 'Respondidos',
    cerrados: 'Cerrados',
    vacio: 'No hay tickets aquí.',
    tipos: {
      espera_comensal: 'Espera · cliente',
      espera_restaurante: 'Espera · restaurante',
      espera_repartidor: 'Espera · repartidor',
      franquicia: 'Franquicia',
      queja: 'Queja',
      soporte: 'Soporte',
    },
    estadosTicket: { abierto: 'Abierto', respondido: 'Respondido', cerrado: 'Cerrado' },
    volver: '← Bandeja',
    responder: 'Tu respuesta (le llega por correo)',
    enviar: 'Responder',
    cerrar: 'Cerrar ticket',
    reabrir: 'Reabrir',
    persona: 'Persona',
    equipo: 'Equipo',
    enlacePublico: 'Enlace de la persona',
    otros: 'Más herramientas',
  },
  en: {
    resumen: 'Overview',
    dinero: 'Yesterday’s money',
    cuadra: 'Adds up',
    noCuadra: 'Does NOT add up: review',
    sinConciliar: 'Not reconciled yet',
    activarWallets: 'Enable Apple Pay and Google Pay on the web',
    walletsOk: 'Domain registered with Stripe. Apple Pay:',
    franquicias: 'Franchises',
    vendidas: 'Sold',
    activas: 'Active',
    interesados: 'Franchise leads',
    tickets: 'Open tickets',
    motos: 'Motorbikes',
    ciudad: 'City',
    estado: 'Status',
    pedidos30: 'Orders (30 days)',
    ventas30: 'Sales (30 days)',
    ganancia30: 'Earnings (30 days)',
    restaurantes: 'Restaurants',
    repartidores: 'Drivers',
    sinFranquicia: 'Cities without a franchise',
    estados: {
      prospecto: 'Prospect',
      vendida: 'Sold',
      activa: 'Active',
      pausada: 'Paused',
      cerrada: 'Closed',
    },
    nombreFranquicia: 'Franchise name (e.g. Miami North)',
    gestionar: 'Territory and team',
    ocultarGestion: 'Hide territory and team',
    porCiudad: 'Results by city',
    franquiciasCol: 'Franchises',
    areasCol: 'Areas',
    areasLibres: 'Areas without a franchise',
    nueva: 'New franchise',
    zona: 'City (zone)',
    elegir: 'Choose a city',
    duenoCorreo: 'Franchisee email',
    notas: 'Private notes',
    crear: 'Create franchise',
    guardar: 'Save',
    guardado: 'Saved',
    suPanel: 'Their dashboard',
    bandeja: 'Ticket inbox',
    todos: 'All',
    abiertos: 'Open',
    respondidos: 'Answered',
    cerrados: 'Closed',
    vacio: 'No tickets here.',
    tipos: {
      espera_comensal: 'Waitlist · customer',
      espera_restaurante: 'Waitlist · restaurant',
      espera_repartidor: 'Waitlist · driver',
      franquicia: 'Franchise',
      queja: 'Complaint',
      soporte: 'Support',
    },
    estadosTicket: { abierto: 'Open', respondido: 'Answered', cerrado: 'Closed' },
    volver: '← Inbox',
    responder: 'Your reply (they get it by email)',
    enviar: 'Reply',
    cerrar: 'Close ticket',
    reabrir: 'Reopen',
    persona: 'Person',
    equipo: 'Team',
    enlacePublico: 'Their link',
    otros: 'More tools',
  },
};

type Metricas = {
  pedidosHoy: number;
  pedidos30: number;
  ventas30: number;
  ganancia30: number;
  restaurantes: number;
  restaurantesAbiertos: number;
  repartidores: number;
  repartidoresConectados: number;
  ticketsAbiertos: number;
};
type Franquicia = {
  id: string;
  nombre: string;
  areas: number;
  zonaId: string;
  ciudad: string;
  pais: string;
  estado: 'prospecto' | 'vendida' | 'activa' | 'pausada' | 'cerrada';
  duenoCorreo: string;
  motos: number;
  notas: string;
  ruta: string;
  metricas: Metricas;
};
type Resumen = {
  totales: {
    franquicias: number;
    vendidas: number;
    activas: number;
    interesados: number;
    ticketsAbiertos: number;
    motos: number;
  };
  franquicias: Franquicia[];
  ciudades: {
    id: string;
    ciudad: string;
    pais: string;
    activa: boolean;
    franquicias: number;
    areas: number;
    areasLibres: number;
    metricas: Metricas;
  }[];
  sinFranquicia: {
    id: string;
    ciudad: string;
    pais: string;
    activa: boolean;
    metricas: Metricas;
  }[];
};

/** Resumen del superadmin: franquicias, lo que produce cada una, motos y ciudades libres. */
export function SuperResumen({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState('');
  const [conciliacion, setConciliacion] = useState<{ dia: string; cuadra: boolean } | null>(null);
  const [wallets, setWallets] = useState('');
  useEffect(() => {
    pedir<Resumen>('GET', '/datos/admin/resumen')
      .then(setR)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
    pedir<{ conciliaciones: { dia: string; cuadra: boolean }[] }>(
      'GET',
      '/datos/admin/conciliacion',
    )
      .then((c) => setConciliacion(c.conciliaciones[0] ?? null))
      .catch(() => setConciliacion(null));
  }, []);
  async function activarWallets() {
    try {
      const w = await pedir<{ applePay: string; googlePay: string }>(
        'POST',
        '/datos/admin/stripe/dominio',
        { dominio: window.location.hostname.replace(/^www\./, '') },
      );
      setWallets(`${t.walletsOk} ${w.applePay} · Google Pay: ${w.googlePay}`);
    } catch (x) {
      setWallets(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  if (!r) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const tarjeta = (titulo: string, valor: string | number, a?: string) => (
    <li className="super-tarjeta">
      <span>{titulo}</span>
      <strong>{a ? <Enlace a={a}>{valor}</Enlace> : valor}</strong>
    </li>
  );
  const dinero = (c: number) => formatearDolares(c, idioma);
  return (
    <section className="super">
      <h1>{t.resumen}</h1>
      <ul className="super-tarjetas">
        {tarjeta(t.franquicias, r.totales.franquicias, `${base}/franchises`)}
        {tarjeta(t.vendidas, r.totales.vendidas)}
        {tarjeta(t.activas, r.totales.activas)}
        {tarjeta(t.interesados, r.totales.interesados, `${base}/tickets?tipo=franquicia`)}
        {tarjeta(t.tickets, r.totales.ticketsAbiertos, `${base}/tickets`)}
        {tarjeta(t.motos, r.totales.motos)}
        <li
          className={`super-tarjeta ${conciliacion && !conciliacion.cuadra ? 'super-tarjeta-alerta' : ''}`}
        >
          <span>{t.dinero}</span>
          <strong>
            {!conciliacion ? t.sinConciliar : conciliacion.cuadra ? t.cuadra : t.noCuadra}
          </strong>
          <button type="button" className="enlace" onClick={() => void activarWallets()}>
            {t.activarWallets}
          </button>
          {wallets ? <span className="suave">{wallets}</span> : null}
        </li>
      </ul>
      <h2>{t.franquicias}</h2>
      <div className="tabla-ancha">
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.ciudad}</th>
              <th>{t.estado}</th>
              <th>{t.pedidos30}</th>
              <th>{t.ventas30}</th>
              <th>{t.ganancia30}</th>
              <th>{t.restaurantes}</th>
              <th>{t.repartidores}</th>
              <th>{t.motos}</th>
              <th>{t.tickets}</th>
            </tr>
          </thead>
          <tbody>
            {r.franquicias.map((f) => (
              <tr key={f.id}>
                <td>
                  <Enlace a={`/panel/${f.ruta}`}>{f.nombre}</Enlace>
                  {f.nombre !== f.ciudad ? <small> · {f.ciudad}</small> : null}
                </td>
                <td>{t.estados[f.estado]}</td>
                <td>{f.metricas.pedidos30}</td>
                <td>{dinero(f.metricas.ventas30)}</td>
                <td>{dinero(f.metricas.ganancia30)}</td>
                <td>
                  {f.metricas.restaurantesAbiertos}/{f.metricas.restaurantes}
                </td>
                <td>
                  {f.metricas.repartidoresConectados}/{f.metricas.repartidores}
                </td>
                <td>{f.motos}</td>
                <td>{f.metricas.ticketsAbiertos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{t.porCiudad}</h2>
      <div className="tabla-ancha">
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.ciudad}</th>
              <th>{t.franquiciasCol}</th>
              <th>{t.areasCol}</th>
              <th>{t.areasLibres}</th>
              <th>{t.pedidos30}</th>
              <th>{t.ventas30}</th>
              <th>{t.restaurantes}</th>
              <th>{t.repartidores}</th>
            </tr>
          </thead>
          <tbody>
            {r.ciudades.map((z) => (
              <tr key={z.id}>
                <td>
                  {z.ciudad} <small>({z.pais})</small>
                </td>
                <td>{z.franquicias}</td>
                <td>{z.areas}</td>
                <td>{z.areasLibres}</td>
                <td>{z.metricas.pedidos30}</td>
                <td>{dinero(z.metricas.ventas30)}</td>
                <td>{z.metricas.restaurantes}</td>
                <td>{z.metricas.repartidores}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type FilaTicket = {
  id: string;
  tipo: keyof (typeof T)['es']['tipos'];
  estado: keyof (typeof T)['es']['estadosTicket'];
  nombre: string;
  correo: string;
  asunto: string;
  ciudad: string;
  pais: string;
  actualizado: string;
  ultimo: string;
};

/** Bandeja de tickets: lista con filtros, o un ticket con su conversación si viene el id. */
export function SuperTickets({
  base,
  idioma,
  ticketId,
}: {
  base: string;
  idioma: Idioma;
  ticketId: string | null;
}) {
  const t = enIdioma(T, idioma);
  const filtroTipo = new URLSearchParams(window.location.search).get('tipo') ?? '';
  const [estado, setEstado] = useState('abierto');
  const [lista, setLista] = useState<FilaTicket[] | null>(null);
  useEffect(() => {
    if (ticketId) return;
    const q = new URLSearchParams();
    if (estado) q.set('estado', estado);
    if (filtroTipo) q.set('tipo', filtroTipo);
    pedir<{ tickets: FilaTicket[] }>('GET', `/datos/admin/tickets?${q.toString()}`)
      .then((r) => setLista(r.tickets))
      .catch(() => setLista([]));
  }, [estado, filtroTipo, ticketId]);

  if (ticketId) return <SuperTicket base={base} idioma={idioma} id={ticketId} />;
  return (
    <section className="super">
      <h1>{t.bandeja}</h1>
      <div className="super-filtros" role="tablist">
        {(
          [
            ['abierto', t.abiertos],
            ['respondido', t.respondidos],
            ['cerrado', t.cerrados],
            ['', t.todos],
          ] as const
        ).map(([v, texto]) => (
          <button
            key={v || 'todos'}
            type="button"
            role="tab"
            aria-selected={estado === v}
            className={estado === v ? 'activa' : undefined}
            onClick={() => setEstado(v)}
          >
            {texto}
          </button>
        ))}
      </div>
      {lista === null ? (
        <p role="status">…</p>
      ) : lista.length === 0 ? (
        <p>{t.vacio}</p>
      ) : (
        <ul className="super-bandeja">
          {lista.map((x) => (
            <li key={x.id}>
              <Enlace a={`${base}/tickets/${x.id}`}>
                <span className="insignia">{t.tipos[x.tipo]}</span> <strong>{x.asunto}</strong> ·{' '}
                {x.nombre}
                <small>
                  {t.estadosTicket[x.estado]} · {x.actualizado} · {(x.ultimo ?? '').slice(0, 120)}
                </small>
              </Enlace>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Ticket = FilaTicket & {
  telefono: string;
  datos: Record<string, unknown>;
  enlace: string;
  mensajes: { autor: 'persona' | 'equipo'; texto: string; fecha: string }[];
};

function SuperTicket({ base, idioma, id }: { base: string; idioma: Idioma; id: string }) {
  const t = enIdioma(T, idioma);
  const [x, setX] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: 'respuesta-ticket',
    cuenta: id,
    inicial: { texto: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ ticket: Ticket }>('GET', `/datos/admin/tickets/${id}`)
      .then((r) => setX(r.ticket))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, [id]);
  useEffect(cargar, [cargar]);

  async function responder(e: React.FormEvent) {
    e.preventDefault();
    if (!b.valores.texto.trim()) return;
    setEnviando(true);
    setError('');
    try {
      await pedir('POST', `/datos/admin/tickets/${id}/mensajes`, { texto: b.valores.texto });
      await b.limpiar();
      cargar();
    } catch (er) {
      setError(er instanceof ErrorApi ? er.message : String(er));
    } finally {
      setEnviando(false);
    }
  }
  async function cambiarEstado(estado: string) {
    await pedir('PATCH', `/datos/admin/tickets/${id}`, { estado });
    cargar();
  }

  if (!x) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  return (
    <section className="super ticket">
      <Enlace a={`${base}/tickets`} className="docs-volver">
        {t.volver}
      </Enlace>
      <h1>{x.asunto}</h1>
      <p>
        <span className="insignia">{t.tipos[x.tipo]}</span> {t.estadosTicket[x.estado]} ·{' '}
        <strong>{x.nombre}</strong> · <a href={`mailto:${x.correo}`}>{x.correo}</a>
        {x.telefono ? ` · ${x.telefono}` : ''}
        {x.ciudad || x.pais ? ` · ${[x.ciudad, x.pais].filter(Boolean).join(', ')}` : ''}
      </p>
      <p>
        {t.enlacePublico}: <a href={x.enlace}>{x.enlace.slice(0, 18)}…</a>
      </p>
      <ol className="ticket-hilo">
        {x.mensajes.map((m, i) => (
          <li
            key={`${m.fecha}-${i}`}
            className={m.autor === 'equipo' ? 'del-equipo' : 'de-persona'}
          >
            <strong>{m.autor === 'equipo' ? t.equipo : t.persona}</strong>
            <time dateTime={m.fecha}>{m.fecha}</time>
            <p>{m.texto}</p>
          </li>
        ))}
      </ol>
      <form className="formulario ticket-responder" onSubmit={responder} noValidate>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.responder}</span>
          <textarea
            rows={5}
            value={b.valores.texto}
            onChange={(e) => b.cambiar('texto', e.target.value)}
          />
        </label>
        {error && (
          <p className="error-general" role="alert">
            {error}
          </p>
        )}
        <div className="fila-botones">
          <button type="submit" className="boton" disabled={enviando || !b.valores.texto.trim()}>
            {t.enviar}
          </button>
          {x.estado === 'cerrado' ? (
            <button
              type="button"
              className="boton secundario"
              onClick={() => void cambiarEstado('abierto')}
            >
              {t.reabrir}
            </button>
          ) : (
            <button
              type="button"
              className="boton secundario"
              onClick={() => void cambiarEstado('cerrado')}
            >
              {t.cerrar}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

type Zona = { id: string; nombre: string };

/** Alta y edición de franquicias. */
export function SuperFranquicias({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [r, setR] = useState<Resumen | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const b = useBorrador({
    formulario: 'nueva-franquicia',
    cuenta: usuario.id,
    inicial: {
      zonaId: '',
      nombre: '',
      estado: 'prospecto',
      duenoCorreo: '',
      motos: '0',
      notas: '',
    },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    void pedir<Resumen>('GET', '/datos/admin/resumen').then(setR);
    void pedir<{ zonas: Zona[] }>('GET', '/datos/admin/zonas')
      .then((z) => setZonas(z.zonas))
      .catch(() => setZonas([]));
  }, []);
  useEffect(cargar, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await pedir('POST', '/datos/admin/franquicias', {
        ...b.valores,
        motos: Number(b.valores.motos),
      });
      await b.limpiar();
      cargar();
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    }
  }
  async function guardar(f: Franquicia, cambios: Partial<Franquicia>) {
    setAviso('');
    await pedir('PATCH', `/datos/admin/franquicias/${f.id}`, cambios);
    setAviso(t.guardado);
    cargar();
  }

  return (
    <section className="super">
      <h1>{t.franquicias}</h1>
      {aviso && (
        <p className="ok" role="status">
          {aviso}
        </p>
      )}
      <ul className="super-franquicias">
        {r?.franquicias.map((f) => (
          <li key={f.id} className="tarjeta-form">
            <h2>
              {f.nombre}{' '}
              <small>
                ({f.ciudad}, {f.pais})
              </small>
            </h2>
            <label className="campo">
              <span>{t.nombreFranquicia}</span>
              <input
                defaultValue={f.nombre === f.ciudad ? '' : f.nombre}
                onBlur={(e) => void guardar(f, { nombre: e.target.value })}
              />
            </label>
            <label className="campo">
              <span>{t.estado}</span>
              <select
                value={f.estado}
                onChange={(e) =>
                  void guardar(f, { estado: e.target.value as Franquicia['estado'] })
                }
              >
                {Object.entries(t.estados).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>{t.motos}</span>
              <input
                type="number"
                min={0}
                defaultValue={f.motos}
                onBlur={(e) => void guardar(f, { motos: Number(e.target.value) })}
              />
            </label>
            <label className="campo">
              <span>{t.duenoCorreo}</span>
              <input
                type="email"
                defaultValue={f.duenoCorreo}
                placeholder={correoEjemplo(idioma)}
                onBlur={(e) => void guardar(f, { duenoCorreo: e.target.value })}
              />
            </label>
            <p>
              {t.suPanel}:{' '}
              <Enlace a={`/panel/${f.ruta}`}>{`/panel/${f.ruta.slice(0, 32)}…`}</Enlace>
            </p>
            <button
              type="button"
              className="boton secundario"
              aria-expanded={abierta === f.id}
              onClick={() => setAbierta(abierta === f.id ? null : f.id)}
            >
              {abierta === f.id ? t.ocultarGestion : t.gestionar}
            </button>
            {abierta === f.id && <GestionFranquicia id={f.id} usuario={usuario} idioma={idioma} />}
          </li>
        ))}
      </ul>

      <form onSubmit={crear} className="formulario tarjeta-form" noValidate>
        <h2>{t.nueva}</h2>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.zona}</span>
          <select value={b.valores.zonaId} onChange={(e) => b.cambiar('zonaId', e.target.value)}>
            <option value="">{t.elegir}</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>{t.nombreFranquicia}</span>
          <input value={b.valores.nombre} onChange={(e) => b.cambiar('nombre', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.estado}</span>
          <select value={b.valores.estado} onChange={(e) => b.cambiar('estado', e.target.value)}>
            {Object.entries(t.estados).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>{t.duenoCorreo}</span>
          <input
            type="email"
            value={b.valores.duenoCorreo}
            placeholder={correoEjemplo(idioma)}
            onChange={(e) => b.cambiar('duenoCorreo', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.motos}</span>
          <input
            type="number"
            min={0}
            value={b.valores.motos}
            onChange={(e) => b.cambiar('motos', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.notas}</span>
          <textarea
            rows={3}
            value={b.valores.notas}
            onChange={(e) => b.cambiar('notas', e.target.value)}
          />
        </label>
        {error && (
          <p className="error-general" role="alert">
            {error.mensaje}
          </p>
        )}
        <button type="submit" className="boton">
          {t.crear}
        </button>
      </form>
      <SolicitudesFranquicia zonas={zonas} idioma={idioma} alCrear={cargar} />
    </section>
  );
}

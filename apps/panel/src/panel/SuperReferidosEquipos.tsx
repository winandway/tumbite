import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-REFERIDOS-EQUIPOS (17 nov 2026): los programas de referidos (conductores y clientes, por país o
 * ciudad) con su presupuesto en vivo, y los equipos con su líder, su enlace y su QR. Todo nace
 * apagado con los montos por defecto; lo enciende una persona del equipo con «Encendido».
 */
const T = {
  es: {
    titulo: 'Referidos y equipos',
    ayuda:
      'Quien invita gana un premio cuando su invitado cumple (carreras de un conductor, o pedidos y viajes pagados de un cliente). Las carreras entre los dos no cuentan, nadie se invita a sí mismo y cada programa tiene su presupuesto: al gastarse, no se da nada más.',
    programas: 'Programas',
    conductor: 'Conductores',
    cliente: 'Clientes',
    porDefecto: 'Valores por defecto, todavía sin guardar',
    encendido: 'Encendido',
    apagado: 'Apagado',
    premio: 'Saldo para quien invita (dólares)',
    carreras: 'Carreras que debe completar el invitado',
    dias: 'En cuántos días',
    regaloInvitado: 'Regalo para el invitado: primer viaje gratis hasta (dólares)',
    premioInvitador: 'Premio para quien invita (dólares)',
    operaciones: 'Pedidos o viajes pagados del invitado',
    gastoMinimo: 'Gasto mínimo del invitado (dólares)',
    topeMes: 'Premios por persona al mes',
    presupuesto: 'Presupuesto total (dólares)',
    gastado: 'Dado',
    queda: 'Queda',
    guardar: 'Guardar',
    guardado: 'Guardado.',
    equipos: 'Equipos',
    crearEquipo: 'Crear un equipo',
    nombreEquipo: 'Nombre del equipo',
    ciudad: 'Ciudad',
    todas: 'Todas las ciudades',
    lider: 'Líder: correo o celular con el que entra a Divoox Driver',
    crear: 'Crear el equipo',
    sinEquipos: 'Todavía no hay equipos.',
    registrados: 'Registrados',
    aprobados: 'Aprobados',
    activos: 'Activos (7 días)',
    carrerasTotal: 'Carreras',
    ver: 'Ver',
    cerrar: 'Cerrar',
    enlace: 'Enlace del líder',
    codigo: 'Código',
    miembros: 'Miembros',
    persona: 'Nombre',
    desde: 'Desde',
    aprobado: 'Aprobado',
    si: 'Sí',
    no: 'No',
    alertas: 'Alertas (30 días)',
    sinAlertas: 'Sin alertas.',
    tiposAlerta: {
      referido_propio: 'Intentó invitarse a sí mismo',
      referido_entre_ellos: 'Carreras entre el que invita y su invitado',
      referido_mismo_pasajero: 'Siempre el mismo pasajero',
      referido_sin_premio: 'Premio no dado (presupuesto o tope del mes)',
    } as Record<string, string>,
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'Referrals and teams',
    ayuda:
      'The inviter earns a reward when the invitee qualifies (a driver’s trips, or a customer’s paid orders and rides). Trips between the two don’t count, nobody can invite themselves and each program has its budget: when it’s used up, nothing else is given.',
    programas: 'Programs',
    conductor: 'Drivers',
    cliente: 'Customers',
    porDefecto: 'Default values, not saved yet',
    encendido: 'On',
    apagado: 'Off',
    premio: 'Balance for the inviter (dollars)',
    carreras: 'Trips the invitee must complete',
    dias: 'Within how many days',
    regaloInvitado: 'Gift for the invitee: first ride free up to (dollars)',
    premioInvitador: 'Reward for the inviter (dollars)',
    operaciones: 'Paid orders or rides by the invitee',
    gastoMinimo: 'Invitee’s minimum spend (dollars)',
    topeMes: 'Rewards per person per month',
    presupuesto: 'Total budget (dollars)',
    gastado: 'Given',
    queda: 'Left',
    guardar: 'Save',
    guardado: 'Saved.',
    equipos: 'Teams',
    crearEquipo: 'Create a team',
    nombreEquipo: 'Team name',
    ciudad: 'City',
    todas: 'All cities',
    lider: 'Leader: email or cell phone they use in Divoox Driver',
    crear: 'Create the team',
    sinEquipos: 'There are no teams yet.',
    registrados: 'Signed up',
    aprobados: 'Approved',
    activos: 'Active (7 days)',
    carrerasTotal: 'Trips',
    ver: 'View',
    cerrar: 'Close',
    enlace: 'Leader’s link',
    codigo: 'Code',
    miembros: 'Members',
    persona: 'Name',
    desde: 'Since',
    aprobado: 'Approved',
    si: 'Yes',
    no: 'No',
    alertas: 'Alerts (30 days)',
    sinAlertas: 'No alerts.',
    tiposAlerta: {
      referido_propio: 'Tried to invite themselves',
      referido_entre_ellos: 'Trips between inviter and invitee',
      referido_mismo_pasajero: 'Always the same rider',
      referido_sin_premio: 'Reward not given (budget or monthly limit)',
    } as Record<string, string>,
    cargando: 'Loading…',
  },
};
type Textos = (typeof T)['es'];

type Programa = {
  tipo: 'conductor' | 'cliente';
  ambito: string;
  activo: boolean;
  reglas: Record<string, number>;
  presupuesto: number;
  gastado: number;
  porDefecto: boolean;
};
type Zona = { id: string; nombre: string; pais: string };
type Equipo = {
  id: string;
  nombre: string;
  ciudad: string;
  codigo: string;
  lider: string;
  registrados: number;
  aprobados: number;
  activos: number;
  carreras: number;
};
type Miembro = {
  id: string;
  nombre: string;
  desde: string;
  aprobado: boolean;
  activo: boolean;
  carreras: number;
};

const aDolares = (c: number) => String(c / 100);
const aCentavos = (s: string) => Math.round(Number(String(s).replace(',', '.') || 0) * 100);
const de = (textos: Record<string, string>, clave: string) =>
  new Map(Object.entries(textos)).get(clave) ?? clave;
/** Las reglas que van en dólares en el formulario (las demás son cantidades). */
const EN_DOLARES = new Set(['premio', 'regaloInvitado', 'premioInvitador', 'gastoMinimo']);

export function SuperReferidosEquipos({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [vuelta, setVuelta] = useState(0);
  const [programas, setProgramas] = useState<Programa[] | null>(null);
  const [alertas, setAlertas] = useState<
    { id: string; tipo: string; detalle: string; creadoEn: string }[]
  >([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [sitio, setSitio] = useState('');
  const [filtro, setFiltro] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    let vivo = true;
    void Promise.all([
      pedir<{ programas: Programa[]; alertas: typeof alertas }>(
        'GET',
        '/datos/admin/referidos-programas',
      ),
      pedir<{ equipos: Equipo[]; zonas: Zona[]; sitio: string }>(
        'GET',
        `/datos/admin/equipos${filtro ? `?zona=${encodeURIComponent(filtro)}` : ''}`,
      ),
    ])
      .then(([p, e]) => {
        if (!vivo) return;
        setProgramas(p.programas);
        setAlertas(p.alertas);
        setEquipos(e.equipos);
        setZonas(e.zonas);
        setSitio(e.sitio);
      })
      .catch((x: unknown) => {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [vuelta, filtro]);
  const recargar = (mensaje: string) => {
    setOk(mensaje);
    setVuelta((n) => n + 1);
  };
  const nombreAmbito = (a: string) => zonas.find((z) => z.id === a)?.nombre ?? a;
  return (
    <div className="super" data-testid="super-referidos-equipos">
      <h2>
        {t.titulo}
        <AyudaAqui guia="referrals-and-teams" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      <h3>{t.programas}</h3>
      {!programas ? <p className="pista">{t.cargando}</p> : null}
      <ul className="flex-lista-tarjetas" data-testid="referidos-programas">
        {(programas ?? []).map((p) => (
          <TarjetaPrograma
            key={`${p.tipo}:${p.ambito}`}
            p={p}
            t={t}
            idioma={idioma}
            titulo={`${p.tipo === 'conductor' ? t.conductor : t.cliente} · ${nombreAmbito(p.ambito)}`}
            alGuardar={() => recargar(t.guardado)}
            setError={setError}
          />
        ))}
      </ul>

      <h3>{t.equipos}</h3>
      <CrearEquipo
        t={t}
        idioma={idioma}
        zonas={zonas}
        alCrear={() => recargar(t.guardado)}
        setError={setError}
      />
      <label className="campo">
        {t.ciudad}
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          data-testid="equipos-filtro"
        >
          <option value="">{t.todas}</option>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </select>
      </label>
      {equipos.length === 0 ? (
        <p className="pista">{t.sinEquipos}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla" aria-label={t.equipos} data-testid="equipos-tabla">
            <thead>
              <tr>
                <th>{t.nombreEquipo}</th>
                <th>{t.ciudad}</th>
                <th>{t.registrados}</th>
                <th>{t.aprobados}</th>
                <th>{t.activos}</th>
                <th>{t.carrerasTotal}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {equipos.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.nombre}</strong>
                    <br />
                    <small className="pista">{e.lider}</small>
                  </td>
                  <td>{e.ciudad}</td>
                  <td>{e.registrados}</td>
                  <td>{e.aprobados}</td>
                  <td>{e.activos}</td>
                  <td>{e.carreras}</td>
                  <td>
                    <button
                      type="button"
                      className="boton secundario"
                      onClick={() => setAbierto(abierto === e.id ? null : e.id)}
                    >
                      {abierto === e.id ? t.cerrar : t.ver}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierto ? <FichaEquipo id={abierto} t={t} sitio={sitio} /> : null}

      <h3>{t.alertas}</h3>
      {alertas.length === 0 ? (
        <p className="pista">{t.sinAlertas}</p>
      ) : (
        <ul className="flex-lista-tarjetas">
          {alertas.map((a) => (
            <li key={a.id} className="flex-tarjeta">
              <strong>{de(t.tiposAlerta, a.tipo)}</strong>
              <p>{a.detalle}</p>
              <p className="pista">{a.creadoEn}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaPrograma({
  p,
  t,
  idioma,
  titulo,
  alGuardar,
  setError,
}: {
  p: Programa;
  t: Textos;
  idioma: Idioma;
  titulo: string;
  alGuardar: () => void;
  setError: (s: string) => void;
}) {
  const claves = Object.keys(p.reglas);
  const b = useBorrador({
    formulario: `referidos-${p.tipo}-${p.ambito}`,
    cuenta: 'superadmin',
    inicial: {
      activo: p.activo,
      presupuesto: aDolares(p.presupuesto),
      ...Object.fromEntries(
        claves.map((k) => {
          const v = new Map(Object.entries(p.reglas)).get(k) ?? 0;
          return [k, EN_DOLARES.has(k) ? aDolares(v) : String(v)];
        }),
      ),
    } as Record<string, string | boolean>,
    almacen: almacenNavegador,
  });
  const valor = (k: string) => String(new Map(Object.entries(b.valores)).get(k) ?? '');
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('PUT', `/datos/admin/referidos-programas/${p.tipo}/${p.ambito}`, {
        activo: Boolean(b.valores.activo),
        presupuesto: aCentavos(valor('presupuesto')),
        reglas: Object.fromEntries(
          claves.map((k) => [
            k,
            EN_DOLARES.has(k) ? aCentavos(valor(k)) : Math.round(Number(valor(k))),
          ]),
        ),
      });
      await b.limpiar();
      alGuardar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);
  const pct = `${Math.min(100, (p.gastado / Math.max(1, p.presupuesto)) * 100)}%`;
  return (
    <li className="flex-tarjeta" data-testid={`programa-${p.tipo}-${p.ambito}`}>
      <strong style={{ fontSize: 17 }}>{titulo}</strong>{' '}
      <span className={p.activo ? 'regalo-estado regalo-encendido' : 'regalo-estado'}>
        {p.activo ? t.encendido : t.apagado}
      </span>
      {p.porDefecto ? <p className="pista">{t.porDefecto}</p> : null}
      <div className="regalo-barra" role="img" aria-label={`${t.gastado} ${dinero(p.gastado)}`}>
        <i className="regalo-gastado" style={{ width: pct }} />
      </div>
      <p>
        {t.gastado}: {dinero(p.gastado)} · {t.queda}:{' '}
        {dinero(Math.max(0, p.presupuesto - p.gastado))}
      </p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={(e) => void guardar(e)}>
        {claves.map((k) => (
          <label key={k} className="campo">
            {de(t as unknown as Record<string, string>, k)}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={EN_DOLARES.has(k) ? '0.01' : '1'}
              value={valor(k)}
              onChange={(e) => b.cambiar(k, e.target.value)}
            />
          </label>
        ))}
        <label className="campo">
          {t.presupuesto}
          <input
            type="number"
            inputMode="decimal"
            min="1"
            value={valor('presupuesto')}
            onChange={(e) => b.cambiar('presupuesto', e.target.value)}
          />
        </label>
        <label className="casilla-fila">
          <input
            type="checkbox"
            checked={Boolean(b.valores.activo)}
            onChange={(e) => b.cambiar('activo', e.target.checked)}
          />
          {t.encendido}
        </label>
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
    </li>
  );
}

function CrearEquipo({
  t,
  idioma,
  zonas,
  alCrear,
  setError,
}: {
  t: Textos;
  idioma: Idioma;
  zonas: Zona[];
  alCrear: () => void;
  setError: (s: string) => void;
}) {
  const b = useBorrador({
    formulario: 'crear-equipo',
    cuenta: 'superadmin',
    inicial: { nombre: '', zonaId: '', lider: '' },
    almacen: almacenNavegador,
  });
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('POST', '/datos/admin/equipos', {
        nombre: b.valores.nombre,
        zonaId: b.valores.zonaId || zonas[0]?.id || '',
        lider: b.valores.lider,
      });
      await b.limpiar();
      alCrear();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="equipos-crear">
      <h3>{t.crearEquipo}</h3>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={(e) => void crear(e)}>
        <label className="campo">
          {t.nombreEquipo}
          <input value={b.valores.nombre} onChange={(e) => b.cambiar('nombre', e.target.value)} />
        </label>
        <label className="campo">
          {t.ciudad}
          <select value={b.valores.zonaId} onChange={(e) => b.cambiar('zonaId', e.target.value)}>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          {t.lider}
          <input value={b.valores.lider} onChange={(e) => b.cambiar('lider', e.target.value)} />
        </label>
        <button type="submit" className="boton">
          {t.crear}
        </button>
      </form>
    </div>
  );
}

function FichaEquipo({ id, t, sitio }: { id: string; t: Textos; sitio: string }) {
  const [datos, setDatos] = useState<{
    equipo: Equipo & { enlace: string };
    miembros: Miembro[];
  } | null>(null);
  const [qr, setQr] = useState('');
  useEffect(() => {
    let vivo = true;
    void pedir<{ equipo: Equipo & { enlace: string }; miembros: Miembro[] }>(
      'GET',
      `/datos/admin/equipos/${id}`,
    )
      .then(async (d) => {
        if (!vivo) return;
        setDatos(d);
        setQr(await QRCode.toDataURL(d.equipo.enlace, { margin: 1, width: 200 }));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [id, sitio]);
  if (!datos) return <p className="pista">{t.cargando}</p>;
  return (
    <div className="flex-tarjeta" data-testid="equipo-ficha">
      <h3>{datos.equipo.nombre}</h3>
      <div className="flex-inline" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {qr ? <img src={qr} alt={`QR ${datos.equipo.enlace}`} width={160} height={160} /> : null}
        <div>
          <p>
            {t.codigo}: <strong>{datos.equipo.codigo}</strong>
          </p>
          <p>
            {t.enlace}: <a href={datos.equipo.enlace}>{datos.equipo.enlace}</a>
          </p>
        </div>
      </div>
      <h4>{t.miembros}</h4>
      <div className="tabla-ancha">
        <table className="tabla">
          <thead>
            <tr>
              <th>{t.persona}</th>
              <th>{t.desde}</th>
              <th>{t.aprobado}</th>
              <th>{t.carrerasTotal}</th>
            </tr>
          </thead>
          <tbody>
            {datos.miembros.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td>
                <td>{m.desde.slice(0, 10)}</td>
                <td>{m.aprobado ? t.si : t.no}</td>
                <td>{m.carreras}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

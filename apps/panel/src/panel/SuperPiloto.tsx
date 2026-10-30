import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  correoEjemplo,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { MenuTresPuntos } from './MenuTresPuntos';
import { pedir } from './api';

/**
 * C-PILOTO (30 oct 2026): la lista de participantes del piloto en producción controlada. Lo que esté
 * «solo piloto» lo ven y lo usan únicamente estas personas. Cada alta y baja queda registrada.
 */
const T = {
  es: {
    titulo: 'Piloto',
    ayuda:
      'Las personas del grupo de prueba: clientes, restaurantes, repartidores y empresas. Lo que esté encendido «solo para el piloto» lo ven y lo usan únicamente ellas. La persona tiene que tener su cuenta creada en la app.',
    correo: 'Correo de la cuenta',
    nota: 'Nota (opcional)',
    notaEjemplo: 'Por ejemplo: grupo de WhatsApp',
    agregar: 'Agregar al piloto',
    agregado: 'Agregado al piloto.',
    yaEstaba: 'Esa persona ya estaba en el piloto.',
    participantes: (n: number) => `${n} ${n === 1 ? 'participante' : 'participantes'}`,
    vacio: 'Todavía no hay nadie en el piloto.',
    opciones: 'Más opciones',
    quitar: 'Quitar del piloto',
    confirmar: (n: string) =>
      `¿Quitar a ${n} del piloto? Dejará de ver lo que es solo para el piloto.`,
    topes: 'Topes de dinero del piloto',
    topesAyuda:
      'Lo máximo que un participante puede pedir. Así un error en una prueba cuesta poco. Quien no está en el piloto no tiene estos topes.',
    porPedido: 'Por pedido (USD)',
    porDia: 'Por día (USD)',
    guardarTopes: 'Guardar topes',
    topesGuardados: 'Topes guardados.',
    servicios: 'Servicios solo para el piloto',
    serviciosAyuda:
      'Lo marcado se enciende solo para los participantes en esa ciudad; el público lo sigue viendo «muy pronto». Moto y Carro no aparecen: llevan pasajeros y esperan la aprobación legal y el seguro.',
    registro: 'Últimos cambios',
    sinRegistro: 'Todavía no hay cambios.',
    alta: 'entró',
    baja: 'salió',
    por: 'por',
    roles: {
      cliente: 'Cliente',
      restaurante: 'Restaurante',
      repartidor: 'Repartidor',
      empresa: 'Empresa',
      admin: 'Equipo',
    },
  },
  en: {
    titulo: 'Pilot',
    ayuda:
      'The people in the test group: customers, restaurants, drivers and businesses. Anything turned on “pilot only” is seen and used only by them. The person must already have an account in the app.',
    correo: 'Account email',
    nota: 'Note (optional)',
    notaEjemplo: 'For example: WhatsApp group',
    agregar: 'Add to pilot',
    agregado: 'Added to the pilot.',
    yaEstaba: 'That person was already in the pilot.',
    participantes: (n: number) => `${n} ${n === 1 ? 'participant' : 'participants'}`,
    vacio: 'Nobody is in the pilot yet.',
    opciones: 'More options',
    quitar: 'Remove from pilot',
    confirmar: (n: string) =>
      `Remove ${n} from the pilot? They’ll stop seeing anything that is pilot only.`,
    topes: 'Pilot money limits',
    topesAyuda:
      'The most a participant can order, so a mistake during a test costs little. People outside the pilot don’t have these limits.',
    porPedido: 'Per order (USD)',
    porDia: 'Per day (USD)',
    guardarTopes: 'Save limits',
    topesGuardados: 'Limits saved.',
    servicios: 'Pilot-only services',
    serviciosAyuda:
      'What you check turns on only for participants in that city; the public still sees “coming soon”. Moto and Car aren’t listed: they carry passengers and are waiting for legal approval and insurance.',
    registro: 'Latest changes',
    sinRegistro: 'No changes yet.',
    alta: 'joined',
    baja: 'left',
    por: 'by',
    roles: {
      cliente: 'Customer',
      restaurante: 'Restaurant',
      repartidor: 'Driver',
      empresa: 'Business',
      admin: 'Team',
    },
  },
};

type Participante = {
  usuarioId: string;
  nombre: string;
  correo: string;
  rol: string;
  nota: string;
  creadoEn: string;
};
type Evento = {
  id: number;
  usuarioId: string;
  nombre: string | null;
  accion: 'alta' | 'baja';
  autor: string | null;
  creadoEn: string;
};

type ServiciosPiloto = {
  servicios: { id: string; nombreEs: string; nombreEn: string }[];
  zonas: { id: string; nombre: string }[];
  encendidos: { servicio: string; zona: string }[];
};

export function SuperPiloto({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const nombreRol = (r: string) => new Map(Object.entries(t.roles)).get(r) ?? r;
  const [lista, setLista] = useState<Participante[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [sp, setSp] = useState<ServiciosPiloto | null>(null);
  const [hayTopes, setHayTopes] = useState(false);
  const bt = useBorrador({
    formulario: 'piloto-topes',
    cuenta: 'superadmin',
    inicial: { porPedido: '', porDia: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = bt;
  const b = useBorrador({
    formulario: 'piloto-agregar',
    cuenta: 'superadmin',
    inicial: { correo: '', nota: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ participantes: Participante[]; eventos: Evento[] }>('GET', '/datos/admin/piloto')
      .then((r) => {
        setLista(r.participantes);
        setEventos(r.eventos);
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
    pedir<{ porPedidoCentavos: number; porDiaCentavos: number }>(
      'GET',
      '/datos/admin/piloto/limites',
    )
      .then((r) => {
        cargarBase({
          porPedido: String(r.porPedidoCentavos / 100),
          porDia: String(r.porDiaCentavos / 100),
        });
        setHayTopes(true);
      })
      .catch(() => setHayTopes(false));
    pedir<ServiciosPiloto>('GET', '/datos/admin/piloto/servicios')
      .then(setSp)
      .catch(() => setSp(null));
  }, [cargarBase]);
  useEffect(cargar, [cargar]);

  async function guardarTopes(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir('PUT', '/datos/admin/piloto/limites', {
        porPedidoCentavos: Math.round(Number(bt.valores.porPedido) * 100),
        porDiaCentavos: Math.round(Number(bt.valores.porDia) * 100),
      });
      await bt.limpiar();
      setOk(t.topesGuardados);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function cambiarServicio(servicio: string, zona: string, piloto: boolean) {
    setError('');
    try {
      await pedir('PUT', '/datos/admin/piloto/servicios', { servicio, zona, piloto });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const r = await pedir<{ nuevo: boolean }>('POST', '/datos/admin/piloto', {
        correo: b.valores.correo,
        nota: b.valores.nota,
      });
      setOk(r.nuevo ? t.agregado : t.yaEstaba);
      await b.limpiar();
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function quitar(p: Participante) {
    if (!window.confirm(t.confirmar(p.nombre))) return;
    setError('');
    setOk('');
    try {
      await pedir('DELETE', `/datos/admin/piloto/${p.usuarioId}`);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="super" data-testid="super-piloto">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario tarjeta-form" onSubmit={(e) => void agregar(e)} noValidate>
        <label>
          {t.correo}
          <input
            type="email"
            value={b.valores.correo}
            onChange={(e) => b.cambiar('correo', e.target.value)}
            placeholder={correoEjemplo(idioma)}
            autoComplete="off"
            required
          />
        </label>
        <label>
          {t.nota}
          <input
            value={b.valores.nota}
            onChange={(e) => b.cambiar('nota', e.target.value)}
            placeholder={t.notaEjemplo}
            maxLength={200}
          />
        </label>
        <button type="submit" className="boton" disabled={!b.valores.correo.trim()}>
          {t.agregar}
        </button>
      </form>
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
      <h2>{t.participantes(lista.length)}</h2>
      {lista.length === 0 ? <p className="pista">{t.vacio}</p> : null}
      <ul className="lista">
        {lista.map((p) => (
          <li key={p.usuarioId}>
            <div className="lista-texto">
              <strong>{p.nombre}</strong>
              <span>
                {nombreRol(p.rol)} · {p.correo}
                {p.nota ? ` · ${p.nota}` : ''}
              </span>
            </div>
            <MenuTresPuntos
              etiqueta={t.opciones}
              opciones={[{ texto: t.quitar, peligro: true, alTocar: () => void quitar(p) }]}
            />
          </li>
        ))}
      </ul>
      {hayTopes ? (
        <form className="formulario tarjeta-form" onSubmit={(e) => void guardarTopes(e)}>
          <h2>{t.topes}</h2>
          <AvisoBorrador
            visible={bt.recuperado}
            idioma={idioma}
            empezar={() => void bt.empezarDeNuevo()}
          />
          <p className="pista">{t.topesAyuda}</p>
          <label>
            {t.porPedido}
            <input
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={bt.valores.porPedido}
              onChange={(e) => bt.cambiar('porPedido', e.target.value)}
            />
          </label>
          <label>
            {t.porDia}
            <input
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={bt.valores.porDia}
              onChange={(e) => bt.cambiar('porDia', e.target.value)}
            />
          </label>
          <button type="submit" className="boton">
            {t.guardarTopes}
          </button>
        </form>
      ) : null}
      {sp ? (
        <>
          <h2>{t.servicios}</h2>
          <p className="pista">{t.serviciosAyuda}</p>
          {sp.zonas.map((z) => (
            <fieldset key={z.id} className="formulario">
              <legend>{z.nombre}</legend>
              {sp.servicios.map((s) => {
                const encendido = sp.encendidos.some((e) => e.servicio === s.id && e.zona === z.id);
                return (
                  <label key={s.id} className="casilla">
                    <input
                      type="checkbox"
                      checked={encendido}
                      onChange={(e) => void cambiarServicio(s.id, z.id, e.target.checked)}
                    />
                    {idioma === 'en' ? s.nombreEn : s.nombreEs}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </>
      ) : null}
      <h2>{t.registro}</h2>
      {eventos.length === 0 ? <p className="pista">{t.sinRegistro}</p> : null}
      <ul className="lista">
        {eventos.map((e) => (
          <li key={e.id}>
            <div className="lista-texto">
              <strong>
                {e.nombre ?? e.usuarioId} {e.accion === 'alta' ? t.alta : t.baja}
              </strong>
              <span>
                {e.creadoEn}
                {e.autor ? ` · ${t.por} ${e.autor}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

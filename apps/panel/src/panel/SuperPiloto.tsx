import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
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

export function SuperPiloto({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const nombreRol = (r: string) => new Map(Object.entries(t.roles)).get(r) ?? r;
  const [lista, setLista] = useState<Participante[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
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
  }, []);
  useEffect(cargar, [cargar]);

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
            placeholder="correo@ejemplo.com"
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

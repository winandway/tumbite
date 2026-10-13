import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Verificaciones (KYC)',
    pendientes: 'Pendientes',
    aprobadas: 'Aprobadas',
    rechazadas: 'Rechazadas',
    vacio: 'No hay verificaciones aquí.',
    repartidor: 'Repartidor',
    restaurante: 'Restaurante',
    lejos: 'El local está lejos de su dirección',
    volver: '← Verificaciones',
    piezas: {
      doc_frente: 'Documento (frente)',
      doc_reverso: 'Documento (reverso)',
      selfie: 'Cara',
      local: 'Local',
    },
    distancia: 'Distancia entre la foto del local y la dirección registrada',
    metros: 'metros',
    aprobar: 'Aprobar',
    rechazar: 'Rechazar',
    motivo: 'Motivo del rechazo (le llega a la persona)',
    compara:
      'Compara la cara con la foto del documento, el nombre y la fecha de nacimiento, y que el documento no esté vencido.',
  },
  en: {
    titulo: 'Verifications (KYC)',
    pendientes: 'Pending',
    aprobadas: 'Approved',
    rechazadas: 'Rejected',
    vacio: 'No verifications here.',
    repartidor: 'Driver',
    restaurante: 'Restaurant',
    lejos: 'The storefront is far from its address',
    volver: '← Verifications',
    piezas: {
      doc_frente: 'Document (front)',
      doc_reverso: 'Document (back)',
      selfie: 'Face',
      local: 'Storefront',
    },
    distancia: 'Distance between the storefront photo and the registered address',
    metros: 'meters',
    aprobar: 'Approve',
    rechazar: 'Reject',
    motivo: 'Rejection reason (the person receives it)',
    compara:
      'Compare the face with the document photo, the name and date of birth, and check the document isn’t expired.',
  },
};

type Solicitud = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  codigo: string | null;
  restaurante: string | null;
  enviado: string;
  lejos: boolean;
};

/** Cola de verificaciones del superadmin (paginada) y, con id, la revisión lado a lado. */
export function SuperKyc({
  base,
  idioma,
  id,
}: {
  base: string;
  idioma: Idioma;
  id: string | null;
}) {
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState('pendiente');
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  useEffect(() => {
    if (id) return;
    pedir<{ solicitudes: Solicitud[] }>('GET', `/datos/admin/kyc?estado=${estado}`)
      .then((r) => setLista(r.solicitudes))
      .catch(() => setLista([]));
  }, [estado, id]);
  if (id) return <RevisarKyc base={base} idioma={idioma} id={id} />;
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <div className="super-filtros" role="tablist">
        {(
          [
            ['pendiente', t.pendientes],
            ['aprobado', t.aprobadas],
            ['rechazado', t.rechazadas],
          ] as const
        ).map(([v, n]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={estado === v}
            className={estado === v ? 'activa' : undefined}
            onClick={() => setEstado(v)}
          >
            {n}
          </button>
        ))}
      </div>
      {lista?.length === 0 && <p>{t.vacio}</p>}
      <ul className="super-bandeja">
        {lista?.map((s) => (
          <li key={s.id}>
            <Enlace a={`${base}/verifications/${s.id}`}>
              <span className="insignia">
                {s.rol === 'repartidor' ? t.repartidor : t.restaurante}
              </span>{' '}
              <strong>{s.nombre}</strong>{' '}
              {s.codigo ? <span className="super-id">{s.codigo}</span> : null}
              {s.restaurante ? ` · ${s.restaurante}` : ''}
              <small>
                {s.correo} · {s.enviado}
                {s.lejos ? ` · ${t.lejos}` : ''}
              </small>
            </Enlace>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Detalle = {
  persona: {
    nombre: string;
    correo: string;
    telefono: string;
    fecha_nacimiento: string | null;
    rol: string;
    restaurante: string | null;
    direccion: string | null;
  };
  kyc: {
    estado: string;
    docTipo: string;
    tiene: Record<string, boolean>;
    localDistanciaM: number | null;
    lejos: boolean;
  };
};

function RevisarKyc({ base, idioma, id }: { base: string; idioma: Idioma; id: string }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: 'kyc-motivo',
    cuenta: id,
    inicial: { motivo: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<Detalle>('GET', `/datos/admin/kyc/${id}`)
      .then(setD)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [id]);
  useEffect(cargar, [cargar]);

  async function decidir(estado: 'aprobado' | 'rechazado') {
    setError('');
    try {
      await pedir('PATCH', `/datos/admin/kyc/${id}`, { estado, motivo: b.valores.motivo });
      await b.limpiar();
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!d) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const tiene = new Map(Object.entries(d.kyc.tiene));
  return (
    <section className="super">
      <Enlace a={`${base}/verifications`} className="docs-volver">
        {t.volver}
      </Enlace>
      <h1>{d.persona.nombre}</h1>
      <p>
        {d.persona.correo} · {d.persona.telefono || '—'} · {d.persona.fecha_nacimiento ?? '—'}
        {d.persona.restaurante ? ` · ${d.persona.restaurante} · ${d.persona.direccion ?? ''}` : ''}
      </p>
      <p className="como-nota">{t.compara}</p>
      <div className="kyc-fotos">
        {Object.entries(t.piezas)
          .filter(([p]) => tiene.get(p))
          .map(([p, nombre]) => (
            <figure key={p}>
              <img src={`/datos/admin/kyc/${id}/foto/${p}`} alt={nombre} loading="lazy" />
              <figcaption>{nombre}</figcaption>
            </figure>
          ))}
      </div>
      {d.kyc.localDistanciaM != null && (
        <p className={d.kyc.lejos ? 'error-general' : 'ok'}>
          {t.distancia}: {d.kyc.localDistanciaM} {t.metros}
        </p>
      )}
      {d.kyc.estado === 'pendiente' && (
        <form className="formulario tarjeta-form" onSubmit={(e) => e.preventDefault()} noValidate>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <label className="campo">
            <span>{t.motivo}</span>
            <textarea
              rows={3}
              value={b.valores.motivo}
              onChange={(e) => b.cambiar('motivo', e.target.value)}
            />
          </label>
          {error && (
            <p className="error-general" role="alert">
              {error}
            </p>
          )}
          <div className="fila-botones">
            <button type="button" className="boton" onClick={() => void decidir('aprobado')}>
              {t.aprobar}
            </button>
            <button
              type="button"
              className="boton secundario"
              onClick={() => void decidir('rechazado')}
            >
              {t.rechazar}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

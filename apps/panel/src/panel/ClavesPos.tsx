import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Campo } from './CampoClave';
import { pedir } from './api';

/**
 * C-API-POS (29 oct 2026): las llaves para conectar el sistema de punto de venta del restaurante.
 * Solo el dueño las crea y revoca; la llave completa se muestra una sola vez.
 */
const T = {
  es: {
    titulo: 'Conectar tu punto de venta',
    ayuda:
      'Crea una llave para que tu sistema de caja lea los pedidos de Divoox y los acepte o marque listos. Pásasela a quien instala tu sistema.',
    nombre: 'Nombre de la llave (por ejemplo, «Caja principal»)',
    crear: 'Crear llave',
    unaVez: 'Copia esta llave ahora: no se vuelve a mostrar.',
    copiar: 'Copiar',
    copiada: 'Copiada.',
    vacio: 'Todavía no tienes llaves.',
    usada: 'Último uso',
    nunca: 'nunca',
    revocada: 'Revocada',
    revocar: 'Revocar',
    seguro: '¿Revocar esta llave? El sistema que la use deja de recibir pedidos.',
  },
  en: {
    titulo: 'Connect your point of sale',
    ayuda:
      'Create a key so your POS system can read Divoox orders and accept them or mark them ready. Give it to whoever sets up your system.',
    nombre: 'Key name (for example, “Front register”)',
    crear: 'Create key',
    unaVez: 'Copy this key now: it won’t be shown again.',
    copiar: 'Copy',
    copiada: 'Copied.',
    vacio: 'No keys yet.',
    usada: 'Last used',
    nunca: 'never',
    revocada: 'Revoked',
    revocar: 'Revoke',
    seguro: 'Revoke this key? The system using it stops receiving orders.',
  },
};

type Clave = {
  id: string;
  nombre: string;
  prefijo: string;
  usadaEn: string | null;
  revocadaEn: string | null;
};

export function ClavesPos({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [claves, setClaves] = useState<Clave[] | null>(null);
  const [nueva, setNueva] = useState('');
  const [copiada, setCopiada] = useState(false);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: 'claves-pos',
    inicial: { nombre: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ claves: Clave[] }>('GET', '/datos/mi-restaurante/claves-api')
      .then((r) => setClaves(Array.isArray(r.claves) ? r.claves : null))
      .catch(() => setClaves(null));
  }, []);
  useEffect(cargar, [cargar]);
  // Solo el dueño las ve: a un manager o al staff el servidor le dice que no, y la sección no sale.
  if (claves === null) return null;
  async function crear(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    try {
      const r = await pedir<{ llave: string }>('POST', '/datos/mi-restaurante/claves-api', {
        nombre: b.valores.nombre,
      });
      setNueva(r.llave);
      setCopiada(false);
      await b.limpiar();
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function revocar(id: string) {
    if (!window.confirm(t.seguro)) return;
    try {
      await pedir('POST', `/datos/mi-restaurante/claves-api/${id}/revocar`, {});
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div className="tarjeta-form">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {nueva ? (
        <div className="aviso-borrador" role="status">
          <p>{t.unaVez}</p>
          <code style={{ wordBreak: 'break-all' }}>{nueva}</code>{' '}
          <button
            type="button"
            className="boton secundario"
            onClick={() => void navigator.clipboard?.writeText(nueva).then(() => setCopiada(true))}
          >
            {copiada ? t.copiada : t.copiar}
          </button>
        </div>
      ) : null}
      {claves.length === 0 ? <p>{t.vacio}</p> : null}
      <ul className="lista">
        {claves.map((k) => (
          <li key={k.id}>
            <div className="lista-texto">
              <strong>
                {k.nombre} · {k.prefijo}…
              </strong>
              <span>{k.revocadaEn ? t.revocada : `${t.usada}: ${k.usadaEn ?? t.nunca}`}</span>
            </div>
            {!k.revocadaEn ? (
              <details className="menu-tres-puntos">
                <summary aria-label="⋮">⋮</summary>
                <button type="button" className="enlace" onClick={() => void revocar(k.id)}>
                  {t.revocar}
                </button>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      <form className="formulario" noValidate onSubmit={(ev) => void crear(ev)}>
        <Campo
          etiqueta={t.nombre}
          valor={b.valores.nombre}
          cambiar={(x) => b.cambiar('nombre', x)}
        />
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="boton">
          {t.crear}
        </button>
      </form>
    </div>
  );
}

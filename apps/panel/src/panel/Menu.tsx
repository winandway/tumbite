import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type Plato,
  type Usuario,
  almacenNavegador,
  centavosATexto,
  dolaresACentavos,
  enIdioma,
  formatearDolares,
  nombrePlato,
  useBorrador,
} from '@tumbite/compartido';
import { Campo } from './CampoClave';
import { MenuTresPuntos } from './MenuTresPuntos';
import { pedir } from './api';

const T = {
  es: {
    titulo: 'Menú',
    nuevo: 'Agregar plato',
    editar: 'Editar',
    eliminar: 'Eliminar',
    confirmar: '¿Eliminar este plato del menú?',
    nombreEs: 'Nombre en español',
    nombreEn: 'Nombre en inglés',
    descEs: 'Descripción en español',
    descEn: 'Descripción en inglés',
    categoria: 'Categoría (por ejemplo: Entradas)',
    precio: 'Precio en dólares',
    guardar: 'Guardar plato',
    cancelar: 'Cancelar',
    disponible: 'Disponible',
    agotado: 'Agotado',
    vacio: 'Tu menú está vacío. Agrega tu primer plato.',
    precioMal: 'Escribe un precio como 12.50',
    sinRest: 'Primero completa «Mi restaurante».',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    opciones: 'Más opciones',
  },
  en: {
    titulo: 'Menu',
    nuevo: 'Add item',
    editar: 'Edit',
    eliminar: 'Delete',
    confirmar: 'Delete this item from the menu?',
    nombreEs: 'Name in Spanish',
    nombreEn: 'Name in English',
    descEs: 'Description in Spanish',
    descEn: 'Description in English',
    categoria: 'Category (for example: Starters)',
    precio: 'Price in dollars',
    guardar: 'Save item',
    cancelar: 'Cancel',
    disponible: 'Available',
    agotado: 'Sold out',
    vacio: 'Your menu is empty. Add your first item.',
    precioMal: 'Enter a price like 12.50',
    sinRest: 'First complete “My restaurant”.',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
    opciones: 'More options',
  },
};

const VACIO = {
  id: '',
  nombreEs: '',
  nombreEn: '',
  descripcionEs: '',
  descripcionEn: '',
  categoria: '',
  precio: '',
};

export function Menu({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [platos, setPlatos] = useState<Plato[] | null>(null);
  const [hayRest, setHayRest] = useState(true);
  const [editando, setEditando] = useState(false);
  const b = useBorrador({
    formulario: 'plato',
    cuenta: usuario.id,
    inicial: VACIO,
    almacen: almacenNavegador,
  });
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);

  useEffect(() => {
    pedir<{ restaurante: unknown; platos: Plato[] }>('GET', '/datos/mi-restaurante')
      .then((r) => {
        setHayRest(Boolean(r.restaurante));
        setPlatos(r.platos);
      })
      .catch((e: unknown) => setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) }));
  }, []);

  // Si había un plato a medio escribir, se vuelve a abrir el formulario.
  const abierto = editando || b.recuperado;
  const v = b.valores;

  function editar(p: Plato) {
    b.setValores({
      id: p.id,
      nombreEs: p.nombreEs,
      nombreEn: p.nombreEn,
      descripcionEs: p.descripcionEs,
      descripcionEn: p.descripcionEn,
      categoria: p.categoria,
      precio: centavosATexto(p.precioCentavos),
    });
    setEditando(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const precioCentavos = dolaresACentavos(v.precio);
    if (precioCentavos === null) return setError({ mensaje: t.precioMal, campo: 'precioCentavos' });
    const cuerpo = {
      nombreEs: v.nombreEs,
      nombreEn: v.nombreEn,
      descripcionEs: v.descripcionEs,
      descripcionEn: v.descripcionEn,
      categoria: v.categoria,
      precioCentavos,
    };
    try {
      const r = v.id
        ? await pedir<{ plato: Plato }>('PUT', `/datos/mi-restaurante/platos/${v.id}`, cuerpo)
        : await pedir<{ plato: Plato }>('POST', '/datos/mi-restaurante/platos', cuerpo);
      setPlatos((ps) =>
        v.id
          ? (ps ?? []).map((p) => (p.id === r.plato.id ? r.plato : p))
          : [...(ps ?? []), r.plato],
      );
      await b.limpiar();
      setEditando(false);
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    }
  }

  async function cancelar() {
    await b.limpiar();
    setEditando(false);
    setError(null);
  }

  async function alternar(p: Plato) {
    try {
      await pedir('PATCH', `/datos/mi-restaurante/platos/${p.id}/disponible`, {
        disponible: !p.disponible,
      });
      setPlatos((ps) =>
        (ps ?? []).map((x) => (x.id === p.id ? { ...x, disponible: !p.disponible } : x)),
      );
    } catch (x) {
      setError({ mensaje: x instanceof ErrorApi ? x.message : String(x) });
    }
  }

  async function eliminar(p: Plato) {
    if (!window.confirm(t.confirmar)) return;
    try {
      await pedir('DELETE', `/datos/mi-restaurante/platos/${p.id}`);
      setPlatos((ps) => (ps ?? []).filter((x) => x.id !== p.id));
    } catch (x) {
      setError({ mensaje: x instanceof ErrorApi ? x.message : String(x) });
    }
  }

  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);
  if (!hayRest)
    return (
      <section>
        <h1>{t.titulo}</h1>
        <p>{t.sinRest}</p>
      </section>
    );
  if (!platos) return null;

  return (
    <section>
      <div className="titulo-fila">
        <h1>{t.titulo}</h1>
        {!abierto && (
          <button type="button" className="boton" onClick={() => setEditando(true)}>
            + {t.nuevo}
          </button>
        )}
      </div>
      {abierto && (
        <form onSubmit={guardar} className="formulario tarjeta-form" noValidate>
          {b.recuperado && (
            <p className="aviso-borrador">
              {t.recuperado}{' '}
              <button type="button" className="enlace" onClick={() => void cancelar()}>
                {t.empezar}
              </button>
            </p>
          )}
          <Campo
            etiqueta={t.nombreEs}
            valor={v.nombreEs}
            cambiar={(x) => b.cambiar('nombreEs', x)}
            placeholder={t.nombreEs}
            error={errorDe('nombreEs')}
          />
          <Campo
            etiqueta={t.nombreEn}
            valor={v.nombreEn}
            cambiar={(x) => b.cambiar('nombreEn', x)}
            placeholder={t.nombreEn}
          />
          <Campo
            etiqueta={t.descEs}
            valor={v.descripcionEs}
            cambiar={(x) => b.cambiar('descripcionEs', x)}
            placeholder={t.descEs}
          />
          <Campo
            etiqueta={t.descEn}
            valor={v.descripcionEn}
            cambiar={(x) => b.cambiar('descripcionEn', x)}
            placeholder={t.descEn}
          />
          <Campo
            etiqueta={t.categoria}
            valor={v.categoria}
            cambiar={(x) => b.cambiar('categoria', x)}
            placeholder={t.categoria}
          />
          <Campo
            etiqueta={t.precio}
            valor={v.precio}
            cambiar={(x) => b.cambiar('precio', x)}
            placeholder="0.00"
            error={errorDe('precioCentavos')}
          />
          {error && !error.campo && (
            <p className="error-general" role="alert">
              {error.mensaje}
            </p>
          )}
          <div className="fila-botones">
            <button type="submit" className="boton">
              {t.guardar}
            </button>
            <button type="button" className="boton secundario" onClick={() => void cancelar()}>
              {t.cancelar}
            </button>
          </div>
        </form>
      )}
      {platos.length === 0 ? (
        <p>{t.vacio}</p>
      ) : (
        <ul className="lista">
          {platos.map((p) => (
            <li key={p.id} className={p.disponible ? '' : 'apagado'}>
              <div className="lista-texto">
                <strong>{nombrePlato(p, idioma)}</strong>
                <span>
                  {p.categoria} · {formatearDolares(p.precioCentavos, idioma)}
                </span>
              </div>
              <label className="interruptor">
                <input type="checkbox" checked={p.disponible} onChange={() => void alternar(p)} />
                {p.disponible ? t.disponible : t.agotado}
              </label>
              <MenuTresPuntos
                etiqueta={t.opciones}
                opciones={[
                  { texto: t.editar, alTocar: () => editar(p) },
                  { texto: t.eliminar, peligro: true, alTocar: () => void eliminar(p) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
  categoriaPlato,
  type GrupoOpciones,
} from '@tumbite/compartido';
import { Campo } from './CampoClave';
import { MenuTresPuntos } from './MenuTresPuntos';
import { pedir } from './api';
import { SubirFoto } from './SubirFoto';

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
    categoria: 'Categoría en español (por ejemplo: Entradas)',
    categoriaEn: 'Categoría en inglés (por ejemplo: Starters)',
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
    foto: 'Foto del plato',
    grupos: 'Opciones del plato (tamaño, extras, sin…)',
    gruposAyuda:
      'Cada grupo es una pregunta al cliente. «Tamaño» con mínimo 1 y máximo 1 obliga a elegir uno; «Extras» con mínimo 0 y máximo 3 deja elegir hasta tres. El precio es lo que suma cada opción.',
    nuevoGrupo: '+ Grupo de opciones',
    nombreGrupoEs: 'Nombre del grupo (español)',
    nombreGrupoEn: 'Nombre del grupo (inglés)',
    minimo: 'Mínimo',
    maximo: 'Máximo',
    nuevaOpcion: '+ Opción',
    opcionEs: 'Opción (español)',
    opcionEn: 'Opción (inglés)',
    precioExtra: 'Precio extra',
    quitar: 'Quitar',
    conOpciones: 'con opciones',
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
    categoria: 'Category in Spanish (for example: Entradas)',
    categoriaEn: 'Category in English (for example: Starters)',
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
    foto: 'Item photo',
    grupos: 'Item options (size, extras, no…)',
    gruposAyuda:
      'Each group is a question for the customer. “Size” with min 1 and max 1 forces one choice; “Extras” with min 0 and max 3 allows up to three. The price is what each option adds.',
    nuevoGrupo: '+ Option group',
    nombreGrupoEs: 'Group name (Spanish)',
    nombreGrupoEn: 'Group name (English)',
    minimo: 'Min',
    maximo: 'Max',
    nuevaOpcion: '+ Option',
    opcionEs: 'Option (Spanish)',
    opcionEn: 'Option (English)',
    precioExtra: 'Extra price',
    quitar: 'Remove',
    conOpciones: 'with options',
  },
};

const VACIO = {
  id: '',
  nombreEs: '',
  nombreEn: '',
  descripcionEs: '',
  descripcionEn: '',
  categoria: '',
  categoriaEn: '',
  precio: '',
  imagen: '',
  grupos: '',
};

type GrupoForm = {
  nombreEs: string;
  nombreEn: string;
  minimo: string;
  maximo: string;
  opciones: { nombreEs: string; nombreEn: string; precio: string; disponible: boolean }[];
};
const leerGrupos = (texto: string): GrupoForm[] => {
  try {
    const v = JSON.parse(texto) as unknown;
    return Array.isArray(v) ? (v as GrupoForm[]) : [];
  } catch {
    return [];
  }
};
const gruposAForm = (grupos: GrupoOpciones[] | undefined): GrupoForm[] =>
  (grupos ?? []).map((g) => ({
    nombreEs: g.nombreEs,
    nombreEn: g.nombreEn,
    minimo: String(g.minimo),
    maximo: String(g.maximo),
    opciones: g.opciones.map((o) => ({
      nombreEs: o.nombreEs,
      nombreEn: o.nombreEn,
      precio: centavosATexto(o.precioCentavos),
      disponible: o.disponible,
    })),
  }));

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
    b.cargar({
      id: p.id,
      nombreEs: p.nombreEs,
      nombreEn: p.nombreEn,
      descripcionEs: p.descripcionEs,
      descripcionEn: p.descripcionEn,
      categoria: p.categoria,
      categoriaEn: p.categoriaEn,
      precio: centavosATexto(p.precioCentavos),
      imagen: p.imagen ?? '',
      grupos: JSON.stringify(gruposAForm(p.grupos)),
    });
    setEditando(true);
  }
  const grupos = leerGrupos(v.grupos);
  const ponerGrupos = (gs: GrupoForm[]) => b.cambiar('grupos', JSON.stringify(gs));

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
      categoriaEn: v.categoriaEn,
      precioCentavos,
      imagen: v.imagen || null,
    };
    try {
      let r = v.id
        ? await pedir<{ plato: Plato }>('PUT', `/datos/mi-restaurante/platos/${v.id}`, cuerpo)
        : await pedir<{ plato: Plato }>('POST', '/datos/mi-restaurante/platos', cuerpo);
      // Las opciones van aparte, todas de una vez (si el plato ya las tenía, se reemplazan).
      const gruposLimpios = grupos
        .filter((g) => g.nombreEs.trim())
        .map((g) => ({
          nombreEs: g.nombreEs.trim(),
          nombreEn: g.nombreEn.trim(),
          minimo: Number(g.minimo) || 0,
          maximo: Math.max(1, Number(g.maximo) || 1),
          opciones: g.opciones
            .filter((o) => o.nombreEs.trim())
            .map((o) => ({
              nombreEs: o.nombreEs.trim(),
              nombreEn: o.nombreEn.trim(),
              precioCentavos: dolaresACentavos(o.precio || '0') ?? 0,
              disponible: o.disponible,
            })),
        }));
      if (gruposLimpios.length || (r.plato.grupos?.length ?? 0) > 0)
        r = await pedir<{ plato: Plato }>(
          'PUT',
          `/datos/mi-restaurante/platos/${r.plato.id}/opciones`,
          { grupos: gruposLimpios },
        );
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
            etiqueta={t.categoriaEn}
            valor={v.categoriaEn}
            cambiar={(x) => b.cambiar('categoriaEn', x)}
            placeholder={t.categoriaEn}
          />
          <Campo
            etiqueta={t.precio}
            valor={v.precio}
            cambiar={(x) => b.cambiar('precio', x)}
            placeholder="0.00"
            error={errorDe('precioCentavos')}
          />
          <SubirFoto
            etiqueta={t.foto}
            valor={v.imagen}
            cambiar={(url) => b.cambiar('imagen', url)}
            idioma={idioma}
            formato="cuadrado"
          />
          <fieldset className="grupos-opciones">
            <legend>{t.grupos}</legend>
            <p className="suave">{t.gruposAyuda}</p>
            {grupos.map((g, gi) => (
              <div key={gi} className="grupo-opciones">
                <div className="fila-campos">
                  <Campo
                    etiqueta={t.nombreGrupoEs}
                    valor={g.nombreEs}
                    cambiar={(x) =>
                      ponerGrupos(grupos.map((y, j) => (j === gi ? { ...y, nombreEs: x } : y)))
                    }
                    placeholder="Tamaño"
                  />
                  <Campo
                    etiqueta={t.nombreGrupoEn}
                    valor={g.nombreEn}
                    cambiar={(x) =>
                      ponerGrupos(grupos.map((y, j) => (j === gi ? { ...y, nombreEn: x } : y)))
                    }
                    placeholder="Size"
                  />
                  <Campo
                    etiqueta={t.minimo}
                    tipo="number"
                    valor={g.minimo}
                    cambiar={(x) =>
                      ponerGrupos(grupos.map((y, j) => (j === gi ? { ...y, minimo: x } : y)))
                    }
                  />
                  <Campo
                    etiqueta={t.maximo}
                    tipo="number"
                    valor={g.maximo}
                    cambiar={(x) =>
                      ponerGrupos(grupos.map((y, j) => (j === gi ? { ...y, maximo: x } : y)))
                    }
                  />
                  <button
                    type="button"
                    className="enlace"
                    onClick={() => ponerGrupos(grupos.filter((_, j) => j !== gi))}
                  >
                    {t.quitar}
                  </button>
                </div>
                {g.opciones.map((o, oi) => (
                  <div key={oi} className="fila-campos opcion">
                    <Campo
                      etiqueta={t.opcionEs}
                      valor={o.nombreEs}
                      cambiar={(x) =>
                        ponerGrupos(
                          grupos.map((y, j) =>
                            j === gi
                              ? {
                                  ...y,
                                  opciones: y.opciones.map((z, k) =>
                                    k === oi ? { ...z, nombreEs: x } : z,
                                  ),
                                }
                              : y,
                          ),
                        )
                      }
                      placeholder="Grande"
                    />
                    <Campo
                      etiqueta={t.opcionEn}
                      valor={o.nombreEn}
                      cambiar={(x) =>
                        ponerGrupos(
                          grupos.map((y, j) =>
                            j === gi
                              ? {
                                  ...y,
                                  opciones: y.opciones.map((z, k) =>
                                    k === oi ? { ...z, nombreEn: x } : z,
                                  ),
                                }
                              : y,
                          ),
                        )
                      }
                      placeholder="Large"
                    />
                    <Campo
                      etiqueta={t.precioExtra}
                      valor={o.precio}
                      cambiar={(x) =>
                        ponerGrupos(
                          grupos.map((y, j) =>
                            j === gi
                              ? {
                                  ...y,
                                  opciones: y.opciones.map((z, k) =>
                                    k === oi ? { ...z, precio: x } : z,
                                  ),
                                }
                              : y,
                          ),
                        )
                      }
                      placeholder="0.00"
                    />
                    <label className="interruptor">
                      <input
                        type="checkbox"
                        checked={o.disponible}
                        onChange={() =>
                          ponerGrupos(
                            grupos.map((y, j) =>
                              j === gi
                                ? {
                                    ...y,
                                    opciones: y.opciones.map((z, k) =>
                                      k === oi ? { ...z, disponible: !z.disponible } : z,
                                    ),
                                  }
                                : y,
                            ),
                          )
                        }
                      />
                      {o.disponible ? t.disponible : t.agotado}
                    </label>
                    <button
                      type="button"
                      className="enlace"
                      onClick={() =>
                        ponerGrupos(
                          grupos.map((y, j) =>
                            j === gi
                              ? { ...y, opciones: y.opciones.filter((_, k) => k !== oi) }
                              : y,
                          ),
                        )
                      }
                    >
                      {t.quitar}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="boton secundario chico"
                  onClick={() =>
                    ponerGrupos(
                      grupos.map((y, j) =>
                        j === gi
                          ? {
                              ...y,
                              opciones: [
                                ...y.opciones,
                                { nombreEs: '', nombreEn: '', precio: '', disponible: true },
                              ],
                            }
                          : y,
                      ),
                    )
                  }
                >
                  {t.nuevaOpcion}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="boton secundario chico"
              onClick={() =>
                ponerGrupos([
                  ...grupos,
                  {
                    nombreEs: '',
                    nombreEn: '',
                    minimo: '1',
                    maximo: '1',
                    opciones: [{ nombreEs: '', nombreEn: '', precio: '', disponible: true }],
                  },
                ])
              }
            >
              {t.nuevoGrupo}
            </button>
          </fieldset>
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
              {p.imagen ? (
                <img className="miniatura" src={p.imagen} alt="" loading="lazy" />
              ) : (
                <span className="miniatura miniatura-vacia" aria-hidden="true" />
              )}
              <div className="lista-texto">
                <strong>{nombrePlato(p, idioma)}</strong>
                <span>
                  {[
                    categoriaPlato(p, idioma),
                    formatearDolares(p.precioCentavos, idioma),
                    (p.grupos?.length ?? 0) > 0 ? t.conOpciones : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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

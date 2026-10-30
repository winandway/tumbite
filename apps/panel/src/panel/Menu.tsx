import { useEffect, useState } from 'react';
import { ImportarMenu } from './ImportarMenu';
import { HorariosMenu } from './HorariosMenu';
import {
  ErrorApi,
  type Idioma,
  type Plato,
  type Usuario,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  montoATexto,
  montoEscrito,
  nombrePlato,
  useBorrador,
  categoriaPlato,
  type GrupoOpciones,
  ETIQUETAS_DIETA,
  nombreEtiquetaDieta,
  leerEtiquetasDieta,
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
    mayores21: 'Solo para mayores de 21 (se entrega en mano con documento)',
    dieta: 'Marcas del plato (el cliente las ve y puede filtrar por ellas)',
    agotado: 'Agotado',
    agotadoHoy: 'Agotado por hoy',
    agotadoHastaManana: 'Agotado hasta mañana',
    vacio: 'Tu menú está vacío. Agrega tu primer plato.',
    precioMal: 'Escribe un precio como 12.50',
    // C-MONEDA-RECORRIDO: fuera del dólar, la moneda del restaurante.
    precioMoneda: 'Precio en {m}',
    precioMalMoneda: 'Escribe un precio como {ej}',
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
    abreGrupo: 'Al elegirla, pide también',
    copiarDe: 'Copiar las opciones de otro plato',
    elegirPlato: 'Elige un plato',
    ninguno: 'Nada más',
    opcionEs: 'Opción (español)',
    opcionEn: 'Opción (inglés)',
    precioExtra: 'Precio extra',
    quitar: 'Quitar',
    conOpciones: 'con opciones',
    subir: 'Subir',
    bajar: 'Bajar',
    ordenCategorias: 'Orden de las categorías',
    ordenAyuda:
      'Así ve el cliente tu menú: las categorías en este orden y, dentro, los platos como los subas o bajes.',
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
    mayores21: '21+ only (handed over in person with an ID check)',
    dieta: 'Dish labels (customers see them and can filter by them)',
    agotado: 'Sold out',
    agotadoHoy: 'Sold out for today',
    agotadoHastaManana: 'Sold out until tomorrow',
    vacio: 'Your menu is empty. Add your first item.',
    precioMal: 'Enter a price like 12.50',
    precioMoneda: 'Price in {m}',
    precioMalMoneda: 'Enter a price like {ej}',
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
    abreGrupo: 'When chosen, also ask for',
    copiarDe: 'Copy the options from another item',
    elegirPlato: 'Choose an item',
    ninguno: 'Nothing else',
    opcionEs: 'Option (Spanish)',
    opcionEn: 'Option (English)',
    precioExtra: 'Extra price',
    quitar: 'Remove',
    conOpciones: 'with options',
    subir: 'Move up',
    bajar: 'Move down',
    ordenCategorias: 'Category order',
    ordenAyuda:
      'This is how customers see your menu: categories in this order and, within each, the items as you move them up or down.',
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
  /** «si» cuando el plato es solo para mayores de 21 (se guarda como texto en el borrador). */
  requiereEdad: '',
  /** C-FILTROS-DIETA: marcas separadas por coma («vegano,halal»), como texto en el borrador. */
  etiquetas: '',
};

type GrupoForm = {
  nombreEs: string;
  nombreEn: string;
  minimo: string;
  maximo: string;
  opciones: {
    nombreEs: string;
    nombreEn: string;
    precio: string;
    disponible: boolean;
    /** C-OPCIONES-ANIDADAS: el número del grupo que abre («» = ninguno). */
    abreGrupo?: string;
  }[];
};
const leerGrupos = (texto: string): GrupoForm[] => {
  try {
    const v = JSON.parse(texto) as unknown;
    return Array.isArray(v) ? (v as GrupoForm[]) : [];
  } catch {
    return [];
  }
};
const gruposAForm = (grupos: GrupoOpciones[] | undefined, moneda: string): GrupoForm[] =>
  (grupos ?? []).map((g, _gi, todos) => ({
    nombreEs: g.nombreEs,
    nombreEn: g.nombreEn,
    minimo: String(g.minimo),
    maximo: String(g.maximo),
    opciones: g.opciones.map((o) => ({
      nombreEs: o.nombreEs,
      nombreEn: o.nombreEn,
      precio: montoATexto(o.precioCentavos, moneda),
      disponible: o.disponible,
      abreGrupo: o.abreGrupoId ? String(todos.findIndex((x) => x.id === o.abreGrupoId)) : '',
    })),
  }));

export function Menu({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [platos, setPlatos] = useState<Plato[] | null>(null);
  /** Reordenar (auditoría final, punto 20): dentro de la categoría; el servidor guarda el orden completo. */
  async function moverPlato(p: Plato, dir: -1 | 1) {
    const lista = platos ?? [];
    const i = lista.findIndex((x) => x.id === p.id);
    let j = i + dir;
    while (j >= 0 && j < lista.length && lista.at(j)?.categoria !== p.categoria) j += dir;
    if (i < 0 || j < 0 || j >= lista.length) return;
    const nueva = lista.map((x, k) => (k === i ? lista.at(j)! : k === j ? lista.at(i)! : x));
    setPlatos(nueva);
    try {
      await pedir('PUT', '/datos/mi-restaurante/orden-platos', { ids: nueva.map((x) => x.id) });
    } catch (e) {
      setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) });
      setPlatos(lista);
    }
  }
  async function moverCategoria(cat: string, dir: -1 | 1) {
    const lista = platos ?? [];
    const cats = [...new Set(lista.map((x) => x.categoria))];
    const i = cats.indexOf(cat);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cats.length) return;
    const reordenadas = cats.map((x, k) => (k === i ? cats.at(j)! : k === j ? cats.at(i)! : x));
    const pos = new Map(reordenadas.map((c, k) => [c, k]));
    const nueva = [...lista].sort(
      (a, b) => (pos.get(a.categoria) ?? 0) - (pos.get(b.categoria) ?? 0),
    );
    setPlatos(nueva);
    try {
      await pedir('PUT', '/datos/mi-restaurante/orden-categorias', { categorias: reordenadas });
    } catch (e) {
      setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) });
      setPlatos(lista);
    }
  }
  const [hayRest, setHayRest] = useState(true);
  // C-MONEDA-RECORRIDO: los precios se escriben y se muestran en la moneda del restaurante.
  const [moneda, setMoneda] = useState('USD');
  const etiquetaPrecio = moneda === 'USD' ? t.precio : t.precioMoneda.replace('{m}', moneda);
  const precioMal =
    moneda === 'USD' ? t.precioMal : t.precioMalMoneda.replace('{ej}', montoATexto(35000, moneda));
  const [editando, setEditando] = useState(false);
  const b = useBorrador({
    formulario: 'plato',
    cuenta: usuario.id,
    inicial: VACIO,
    almacen: almacenNavegador,
  });
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);

  const [recarga, setRecarga] = useState(0);
  const [ventanas, setVentanas] = useState<{ categoria: string; abre: string; cierra: string }[]>(
    [],
  );
  useEffect(() => {
    pedir<{
      restaurante: { moneda?: string } | null;
      platos: Plato[];
      horariosCategoria?: { categoria: string; abre: string; cierra: string }[];
    }>('GET', '/datos/mi-restaurante')
      .then((r) => {
        setHayRest(Boolean(r.restaurante));
        setMoneda(r.restaurante?.moneda ?? 'USD');
        setPlatos(r.platos);
        setVentanas(r.horariosCategoria ?? []);
      })
      .catch((e: unknown) => setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) }));
  }, [recarga]);

  // Si había un plato a medio escribir, se vuelve a abrir el formulario.
  const abierto = editando || b.recuperado;
  const v = b.valores;

  function editar(p: Plato) {
    b.cargar({
      id: p.id,
      nombreEs: p.nombreEs,
      requiereEdad: p.requiereEdad ? 'si' : '',
      etiquetas: (p.etiquetas ?? []).join(','),
      nombreEn: p.nombreEn,
      descripcionEs: p.descripcionEs,
      descripcionEn: p.descripcionEn,
      categoria: p.categoria,
      categoriaEn: p.categoriaEn,
      precio: montoATexto(p.precioCentavos, moneda),
      imagen: p.imagen ?? '',
      grupos: JSON.stringify(gruposAForm(p.grupos, moneda)),
    });
    setEditando(true);
  }
  const grupos = leerGrupos(v.grupos);
  const ponerGrupos = (gs: GrupoForm[]) => b.cambiar('grupos', JSON.stringify(gs));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const precioCentavos = montoEscrito(v.precio, moneda);
    if (precioCentavos === null) return setError({ mensaje: precioMal, campo: 'precioCentavos' });
    const cuerpo = {
      nombreEs: v.nombreEs,
      nombreEn: v.nombreEn,
      descripcionEs: v.descripcionEs,
      descripcionEn: v.descripcionEn,
      categoria: v.categoria,
      categoriaEn: v.categoriaEn,
      precioCentavos,
      imagen: v.imagen || null,
      requiereEdad: v.requiereEdad === 'si',
      etiquetas: leerEtiquetasDieta(v.etiquetas),
    };
    try {
      let r = v.id
        ? await pedir<{ plato: Plato }>('PUT', `/datos/mi-restaurante/platos/${v.id}`, cuerpo)
        : await pedir<{ plato: Plato }>('POST', '/datos/mi-restaurante/platos', cuerpo);
      // Las opciones van aparte, todas de una vez (si el plato ya las tenía, se reemplazan).
      // C-OPCIONES-ANIDADAS: los números de grupo se recalculan sin los grupos vacíos.
      const nuevoIndice = new Map<number, number>();
      grupos.forEach((g, i) => {
        if (g.nombreEs.trim()) nuevoIndice.set(i, nuevoIndice.size);
      });
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
              precioCentavos: montoEscrito(o.precio || '0', moneda) ?? 0,
              disponible: o.disponible,
              abreGrupo: o.abreGrupo ? (nuevoIndice.get(Number(o.abreGrupo)) ?? null) : null,
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

  /** C-AGOTADO-HOY: «hoy» vuelve solo a medianoche; sin «hasta», queda agotado hasta reactivarlo. */
  async function alternar(p: Plato, hasta: 'hoy' | 'reactivar' = 'reactivar') {
    try {
      const r = await pedir<{ agotadoHasta?: string | null }>(
        'PATCH',
        `/datos/mi-restaurante/platos/${p.id}/disponible`,
        { disponible: !p.disponible, hasta },
      );
      setPlatos((ps) =>
        (ps ?? []).map((x) =>
          x.id === p.id
            ? { ...x, disponible: !p.disponible, agotadoHasta: r.agotadoHasta ?? null }
            : x,
        ),
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
            etiqueta={etiquetaPrecio}
            valor={v.precio}
            cambiar={(x) => b.cambiar('precio', x)}
            placeholder={montoATexto(0, moneda)}
            error={errorDe('precioCentavos')}
          />
          <label className="interruptor">
            <input
              type="checkbox"
              checked={v.requiereEdad === 'si'}
              onChange={(ev) => b.cambiar('requiereEdad', ev.target.checked ? 'si' : '')}
            />
            {t.mayores21}
          </label>
          <fieldset className="etiquetas-dieta">
            <legend>{t.dieta}</legend>
            {ETIQUETAS_DIETA.map((e) => {
              const marcadas = leerEtiquetasDieta(v.etiquetas);
              return (
                <label key={e} className="interruptor">
                  <input
                    type="checkbox"
                    checked={marcadas.includes(e)}
                    onChange={(ev) =>
                      b.cambiar(
                        'etiquetas',
                        (ev.target.checked
                          ? [...marcadas, e]
                          : marcadas.filter((x) => x !== e)
                        ).join(','),
                      )
                    }
                  />
                  {nombreEtiquetaDieta(e, idioma)}
                </label>
              );
            })}
          </fieldset>
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
            {/* Los mismos grupos en varios platos (DoorDash y Uber los reutilizan): se copian de otro. */}
            {(platos ?? []).some((x) => x.id !== v.id && (x.grupos?.length ?? 0) > 0) ? (
              <label className="campo">
                <span>{t.copiarDe}</span>
                <select
                  value=""
                  onChange={(e) => {
                    const origen = (platos ?? []).find((x) => x.id === e.target.value);
                    if (origen) ponerGrupos(gruposAForm(origen.grupos, moneda));
                  }}
                >
                  <option value="">{t.elegirPlato}</option>
                  {(platos ?? [])
                    .filter((x) => x.id !== v.id && (x.grupos?.length ?? 0) > 0)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {nombrePlato(x, idioma)}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
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
                      placeholder={montoATexto(0, moneda)}
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
                    {grupos.length > 1 ? (
                      <label className="campo">
                        <span>{t.abreGrupo}</span>
                        <select
                          value={o.abreGrupo ?? ''}
                          onChange={(e) =>
                            ponerGrupos(
                              grupos.map((y, j) =>
                                j === gi
                                  ? {
                                      ...y,
                                      opciones: y.opciones.map((z, k) =>
                                        k === oi ? { ...z, abreGrupo: e.target.value } : z,
                                      ),
                                    }
                                  : y,
                              ),
                            )
                          }
                        >
                          <option value="">{t.ninguno}</option>
                          {grupos.map((y, j) =>
                            j === gi || !y.nombreEs.trim() ? null : (
                              <option key={j} value={String(j)}>
                                {y.nombreEs}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    ) : null}
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
      {platos.length > 1 ? (
        <div className="tarjeta-form" aria-label={t.ordenCategorias}>
          <h2>{t.ordenCategorias}</h2>
          <p className="suave">{t.ordenAyuda}</p>
          <ol className="lista">
            {[...new Set(platos.map((x) => x.categoria))].map((cat, i, arr) => (
              <li key={cat || '—'}>
                <div className="lista-texto">
                  <strong>{cat || '—'}</strong>
                </div>
                <button
                  type="button"
                  className="enlace"
                  onClick={() => void moverCategoria(cat, -1)}
                  disabled={i === 0}
                  aria-label={`${t.subir}: ${cat}`}
                >
                  ↑ {t.subir}
                </button>
                <button
                  type="button"
                  className="enlace"
                  onClick={() => void moverCategoria(cat, 1)}
                  disabled={i === arr.length - 1}
                  aria-label={`${t.bajar}: ${cat}`}
                >
                  ↓ {t.bajar}
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
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
                    formatearMonto(p.precioCentavos, moneda, idioma),
                    (p.grupos?.length ?? 0) > 0 ? t.conOpciones : '',
                    ...(p.etiquetas ?? []).map((e) => nombreEtiquetaDieta(e, idioma)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <button
                type="button"
                className="enlace"
                onClick={() => void moverPlato(p, -1)}
                aria-label={`${t.subir}: ${nombrePlato(p, idioma)}`}
              >
                ↑
              </button>
              <button
                type="button"
                className="enlace"
                onClick={() => void moverPlato(p, 1)}
                aria-label={`${t.bajar}: ${nombrePlato(p, idioma)}`}
              >
                ↓
              </button>
              <label className="interruptor">
                <input type="checkbox" checked={p.disponible} onChange={() => void alternar(p)} />
                {p.disponible ? t.disponible : p.agotadoHasta ? t.agotadoHastaManana : t.agotado}
              </label>
              <MenuTresPuntos
                etiqueta={t.opciones}
                opciones={[
                  { texto: t.editar, alTocar: () => editar(p) },
                  ...(p.disponible
                    ? [{ texto: t.agotadoHoy, alTocar: () => void alternar(p, 'hoy') }]
                    : []),
                  { texto: t.eliminar, peligro: true, alTocar: () => void eliminar(p) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      {/* C-MENU-HORARIO: franja de cada categoría (desayuno, almuerzo). */}
      {hayRest && platos ? (
        <HorariosMenu
          key={JSON.stringify(ventanas)}
          categorias={[...new Set(platos.map((p) => p.categoria).filter(Boolean))]}
          iniciales={ventanas}
          idioma={idioma}
        />
      ) : null}
      {/* C-MENU-PLANILLA: el menú completo desde una hoja de cálculo. */}
      {hayRest ? (
        <ImportarMenu
          ruta="/datos/mi-restaurante/platos/importar"
          idioma={idioma}
          alGuardar={() => setRecarga((n) => n + 1)}
        />
      ) : null}
    </section>
  );
}

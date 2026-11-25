import { useEffect, useState } from 'react';
import {
  type Idioma,
  type ListaPapelesPais,
  type PapelDeLista,
  TIPOS_PAPEL_CONDUCTOR,
  TIPOS_PAPEL_VEHICULO,
  almacenNavegador,
  enIdioma,
  nombreDePapel,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { MenuTresPuntos } from './MenuTresPuntos';
import './superPapeles.css';

/**
 * C-PAPELES-POR-PAIS (24 nov 2026) — todos los países por configuración. En Ajustes → país, junto al
 * plazo de papeles: qué papeles se le piden al conductor, su nombre en español e inglés, si vencen, si
 * llevan foto y si frenan las carreras o solo se piden. «Frena» no se elige: lo dice el reparto (lo
 * pone el servidor al guardar). Nace APAGADA: apagada, el conductor ve lo de siempre. Guarda lo
 * escrito mientras se edita (borrador) y solo lo borra cuando el servidor confirmó.
 */

const T = {
  es: {
    titulo: 'Papeles que se le piden al conductor en este país',
    ayuda:
      'Con la lista apagada, el conductor ve lo de siempre. Encendida, Driver pide estos papeles con estos nombres, y la barra de activación, Verificaciones, los recordatorios y el plazo de papeles la usan.',
    activa: 'Encender la lista de este país',
    apagadaAviso: 'Apagada: el conductor ve los papeles de siempre.',
    papel: 'Papel',
    deConductor: 'Del conductor',
    deVehiculo: 'Del vehículo',
    servicios: 'Para',
    moto: 'Moto',
    carro: 'Carro',
    nombreEs: 'Nombre en español',
    nombreEn: 'Nombre en inglés',
    vence: 'Vence',
    foto: 'Lleva foto',
    frena: 'Frena las carreras',
    soloPide: 'Solo se pide',
    frenaAyuda:
      '«Frena» lo dice el reparto: los papeles que hoy frenan siguen frenando y los nuevos solo se piden (el reparto no los mira).',
    tambien: (x: string) => `Se guarda también como: ${x}`,
    opciones: 'Más opciones',
    quitar: 'Quitar de la lista',
    agregar: 'Agregar papel',
    elegir: 'Elige un papel',
    guardar: 'Guardar los papeles del país',
    guardado: 'Guardado.',
    sinPapeles: 'La lista está vacía.',
  },
  en: {
    titulo: 'Documents drivers are asked for in this country',
    ayuda:
      'With the list off, drivers see the usual documents. On, Driver asks for these documents with these names, and the activation bar, Verifications, reminders and the documents grace period use it.',
    activa: 'Turn on this country’s list',
    apagadaAviso: 'Off: drivers see the usual documents.',
    papel: 'Document',
    deConductor: 'Driver’s',
    deVehiculo: 'Vehicle’s',
    servicios: 'For',
    moto: 'Moto',
    carro: 'Car',
    nombreEs: 'Name in Spanish',
    nombreEn: 'Name in English',
    vence: 'Expires',
    foto: 'Needs a photo',
    frena: 'Blocks trips',
    soloPide: 'Requested only',
    frenaAyuda:
      '“Blocks” comes from dispatch: documents that block today keep blocking, and new ones are requested only (dispatch does not check them).',
    tambien: (x: string) => `Also saved as: ${x}`,
    opciones: 'More options',
    quitar: 'Remove from the list',
    agregar: 'Add document',
    elegir: 'Pick a document',
    guardar: 'Save the country’s documents',
    guardado: 'Saved.',
    sinPapeles: 'The list is empty.',
  },
};

const mensaje = (x: unknown) => (x instanceof Error ? x.message : String(x));
const OPCIONES = [
  ...TIPOS_PAPEL_CONDUCTOR.map((tipo) => ({ tipo, donde: 'conductor' as const })),
  ...TIPOS_PAPEL_VEHICULO.map((tipo) => ({ tipo, donde: 'vehiculo' as const })),
];

export function PapelesDelPais({
  pais,
  lista,
  guardar,
  idioma,
  cuenta,
}: {
  pais: string;
  lista: ListaPapelesPais;
  /** Guarda y devuelve la lista como quedó en el servidor (con la verdad del reparto). */
  guardar: (l: ListaPapelesPais) => Promise<ListaPapelesPais>;
  idioma: Idioma;
  cuenta?: string | null;
}) {
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [nuevo, setNuevo] = useState('');
  const b = useBorrador<ListaPapelesPais>({
    formulario: `papeles-pais-${pais}`,
    cuenta: cuenta ?? null,
    inicial: lista,
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  useEffect(() => cargarBase(lista), [cargarBase, lista]);
  const v = b.valores;
  const cambiarPapel = (i: number, p: Partial<PapelDeLista>) =>
    b.setValores({ ...v, papeles: v.papeles.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const conServicio = (p: PapelDeLista, s: 'moto' | 'carro', si: boolean) =>
    si ? [...new Set([...p.servicios, s])] : p.servicios.filter((x) => x !== s);

  function agregar() {
    const o = OPCIONES.find((x) => `${x.donde}:${x.tipo}` === nuevo);
    if (!o) {
      setEstado({ error: t.elegir });
      return;
    }
    b.setValores({
      ...v,
      papeles: [
        ...v.papeles,
        {
          tipo: o.tipo,
          donde: o.donde,
          servicios: ['moto'],
          es: nombreDePapel(o.tipo, 'es'),
          en: nombreDePapel(o.tipo, 'en'),
          vence: false,
          foto: true,
          frena: false,
        },
      ],
    });
    setNuevo('');
  }

  async function enviar() {
    setEstado({});
    try {
      const quedo = await guardar(v);
      // Solo con la confirmación del servidor se tira el borrador.
      b.cargar(quedo);
      setEstado({ ok: t.guardado });
    } catch (x) {
      setEstado({ error: mensaje(x) });
    }
  }

  return (
    <fieldset className="papeles-politica" data-testid="papeles-pais">
      <legend>{t.titulo}</legend>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <p className="suave">{t.ayuda}</p>
      <label className="casilla">
        <input
          type="checkbox"
          checked={v.activa}
          onChange={(e) => b.setValores({ ...v, activa: e.target.checked })}
          data-testid="papeles-pais-activa"
        />{' '}
        <strong>{t.activa}</strong>
      </label>
      {!v.activa ? <p className="pista">{t.apagadaAviso}</p> : null}
      <p className="suave">{t.frenaAyuda}</p>
      {v.papeles.length === 0 ? <p className="suave">{t.sinPapeles}</p> : null}
      <ul className="papeles-pais-lista">
        {v.papeles.map((p, i) => (
          <li
            key={`${p.donde}-${p.tipo}-${p.servicios.join('-')}-${i}`}
            className="papeles-pais-fila"
            data-testid={`papel-pais-${p.tipo}`}
          >
            <p className="papeles-grupo">
              <strong>{idioma === 'en' ? p.en : p.es}</strong>{' '}
              <span className="suave">
                · {p.donde === 'vehiculo' ? t.deVehiculo : t.deConductor} ·{' '}
                <span data-testid={`papel-pais-frena-${p.tipo}`}>
                  {p.frena ? t.frena : t.soloPide}
                </span>
              </span>
            </p>
            {p.tambien?.length ? (
              <p className="suave">
                {t.tambien(p.tambien.map((x) => nombreDePapel(x, idioma)).join(', '))}
              </p>
            ) : null}
            <span className="papeles-grupo">{t.servicios}:</span>{' '}
            {(['moto', 'carro'] as const).map((s) => (
              <label key={s} className="casilla">
                <input
                  type="checkbox"
                  checked={p.servicios.includes(s)}
                  onChange={(e) =>
                    cambiarPapel(i, { servicios: conServicio(p, s, e.target.checked) })
                  }
                />{' '}
                {s === 'moto' ? t.moto : t.carro}
              </label>
            ))}
            <label className="campo">
              <span>{t.nombreEs}</span>
              <input
                value={p.es}
                maxLength={120}
                onChange={(e) => cambiarPapel(i, { es: e.target.value })}
                aria-label={`${t.nombreEs} · ${p.tipo}`}
              />
            </label>
            <label className="campo">
              <span>{t.nombreEn}</span>
              <input
                value={p.en}
                maxLength={120}
                onChange={(e) => cambiarPapel(i, { en: e.target.value })}
                aria-label={`${t.nombreEn} · ${p.tipo}`}
              />
            </label>
            <label className="casilla">
              <input
                type="checkbox"
                checked={p.vence}
                onChange={(e) => cambiarPapel(i, { vence: e.target.checked })}
              />{' '}
              {t.vence}
            </label>{' '}
            <label className="casilla">
              <input
                type="checkbox"
                checked={p.foto}
                onChange={(e) => cambiarPapel(i, { foto: e.target.checked })}
              />{' '}
              {t.foto}
            </label>
            <MenuTresPuntos
              etiqueta={t.opciones}
              opciones={[
                {
                  texto: t.quitar,
                  peligro: true,
                  alTocar: () =>
                    b.setValores({ ...v, papeles: v.papeles.filter((_, j) => j !== i) }),
                },
              ]}
            />
          </li>
        ))}
      </ul>
      <label className="campo">
        <span>{t.agregar}</span>
        <select
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          aria-label={t.agregar}
          data-testid="papeles-pais-nuevo"
        >
          <option value="">{t.elegir}</option>
          {OPCIONES.map((o) => (
            <option key={`${o.donde}:${o.tipo}`} value={`${o.donde}:${o.tipo}`}>
              {nombreDePapel(o.tipo, idioma)} ·{' '}
              {o.donde === 'vehiculo' ? t.deVehiculo : t.deConductor}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="boton secundario" onClick={agregar}>
        {t.agregar}
      </button>{' '}
      <button
        type="button"
        className="boton"
        data-testid="papeles-pais-guardar"
        onClick={() => void enviar()}
      >
        {t.guardar}
      </button>
      {estado.ok ? <p className="exito-general">{estado.ok}</p> : null}
      {estado.error ? (
        <p className="error-general" role="alert">
          {estado.error}
        </p>
      ) : null}
    </fieldset>
  );
}

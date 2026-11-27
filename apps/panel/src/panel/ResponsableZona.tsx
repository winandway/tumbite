import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';
import { Campo } from './CampoClave';

/**
 * C-PANICO-ZONA (16 nov 2026): la persona responsable de cada zona. Cuando un conductor, un
 * repartidor o un pasajero toca el botón de pánico en esa zona, le llega un SMS a este celular con
 * quién es, dónde está (enlace del mapa) y el viaje o pedido.
 */
const T = {
  es: {
    titulo: 'Responsable de la zona (recibe el SMS de pánico)',
    actual: 'Hoy:',
    nadie: 'nadie. Si alguien toca el botón de pánico aquí, solo le llega el correo al equipo.',
    nombre: 'Nombre',
    telefono: 'Celular con código del país (+58 412 0000000)',
    guardar: 'Guardar responsable',
    guardado: 'Responsable guardado',
  },
  en: {
    titulo: 'Zone lead (gets the panic text)',
    actual: 'Now:',
    nadie: 'nobody. If someone taps the panic button here, only the team email goes out.',
    nombre: 'Name',
    telefono: 'Cell phone with country code (+1 248 000 0000)',
    guardar: 'Save zone lead',
    guardado: 'Zone lead saved',
  },
};

export function ResponsableZona({
  zona,
  cuenta,
  idioma,
  alGuardar,
}: {
  zona: { id: string; responsableNombre?: string; responsableTelefono?: string };
  cuenta: string;
  idioma: Idioma;
  alGuardar: () => Promise<unknown>;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: `responsable-zona-${zona.id}`,
    cuenta,
    inicial: { nombre: zona.responsableNombre ?? '', telefono: '' },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    try {
      await pedir('PATCH', `/datos/admin/zonas/${zona.id}`, {
        responsableNombre: b.valores.nombre,
        responsableTelefono: b.valores.telefono,
      });
      setAviso(t.guardado);
      await b.limpiar();
      await alGuardar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <form
      onSubmit={guardar}
      className="formulario"
      style={{ flexBasis: '100%' }}
      data-testid={`responsable-zona-${zona.id}`}
    >
      <strong>{t.titulo}</strong>
      <span>
        {t.actual}{' '}
        {zona.responsableTelefono
          ? `${zona.responsableNombre || '—'} · ${zona.responsableTelefono}`
          : t.nadie}
      </span>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <Campo
        etiqueta={t.nombre}
        casilla="nombre"
        valor={b.valores.nombre}
        cambiar={(x) => b.cambiar('nombre', x)}
      />
      <Campo
        etiqueta={t.telefono}
        tipo="tel"
        casilla="celular"
        obligatorio
        valor={b.valores.telefono}
        cambiar={(x) => b.cambiar('telefono', x)}
      />
      {error && <p className="error">{error}</p>}
      {aviso && <p className="exito">{aviso}</p>}
      <button type="submit" className="boton secundario chico">
        {t.guardar}
      </button>
    </form>
  );
}

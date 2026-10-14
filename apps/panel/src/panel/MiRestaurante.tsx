import { useEffect, useState } from 'react';
import { Icono } from '../sitio/Icono';
import {
  ErrorApi,
  type Idioma,
  type Restaurante,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { Campo } from './CampoClave';
import { Horarios } from './Horarios';
import { pedir } from './api';
import { SubirFoto } from './SubirFoto';

const T = {
  es: {
    titulo: 'Mi restaurante',
    nombre: 'Nombre del restaurante',
    categoria: 'Tipo de comida',
    telefono: 'Teléfono del restaurante',
    direccion: 'Dirección',
    descEs: 'Descripción en español',
    descEn: 'Descripción en inglés',
    prep: 'Minutos de preparación promedio',
    ubicacion: 'Usar la ubicación de esta computadora',
    ubicacionOk: 'Ubicación guardada',
    guardar: 'Guardar',
    guardado: 'Guardado',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    abierto: 'Recibiendo pedidos',
    cerrado: 'Cerrado',
    abrir: 'Abrir y recibir pedidos',
    cerrar: 'Cerrar por ahora',
    estados: {
      pendiente: 'En revisión: te avisamos al aprobarlo.',
      aprobado: 'Aprobado',
      pausado: 'Pausado por Tumbite. Escríbenos.',
      rechazado: 'No aprobado. Escríbenos para revisarlo.',
    },
    sinUbicacion: 'Sin ubicación: los clientes no verán la distancia.',
    foto: 'Foto de portada del restaurante',
  },
  en: {
    titulo: 'My restaurant',
    nombre: 'Restaurant name',
    categoria: 'Cuisine',
    telefono: 'Restaurant phone',
    direccion: 'Address',
    descEs: 'Description in Spanish',
    descEn: 'Description in English',
    prep: 'Average prep time (minutes)',
    ubicacion: 'Use this computer’s location',
    ubicacionOk: 'Location saved',
    guardar: 'Save',
    guardado: 'Saved',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
    abierto: 'Taking orders',
    cerrado: 'Closed',
    abrir: 'Open and take orders',
    cerrar: 'Close for now',
    estados: {
      pendiente: 'Under review: we’ll let you know when it’s approved.',
      aprobado: 'Approved',
      pausado: 'Paused by Tumbite. Contact us.',
      rechazado: 'Not approved. Contact us to review it.',
    },
    sinUbicacion: 'No location: customers won’t see the distance.',
    foto: 'Restaurant cover photo',
  },
};

const INICIAL = {
  nombre: '',
  categoria: '',
  telefono: '',
  direccion: '',
  descripcionEs: '',
  descripcionEn: '',
  tiempoPrepMin: '20',
  lat: '',
  lng: '',
  imagen: '',
};

export function MiRestaurante({ usuario, idioma }: { usuario: Usuario; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [rest, setRest] = useState<Restaurante | null>(null);
  const [cargado, setCargado] = useState(false);
  const b = useBorrador({
    formulario: 'mi-restaurante',
    cuenta: usuario.id,
    inicial: INICIAL,
    almacen: almacenNavegador,
  });
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const { cargar, cargarBase } = b;

  useEffect(() => {
    pedir<{ restaurante: Restaurante | null }>('GET', '/datos/mi-restaurante')
      .then((r) => {
        setRest(r.restaurante);
        if (r.restaurante) {
          const x = r.restaurante;
          cargarBase({
            nombre: x.nombre,
            categoria: x.categoria,
            telefono: x.telefono,
            direccion: x.direccion,
            descripcionEs: x.descripcionEs,
            descripcionEn: x.descripcionEn,
            tiempoPrepMin: String(x.tiempoPrepMin),
            lat: x.lat == null ? '' : String(x.lat),
            lng: x.lng == null ? '' : String(x.lng),
            imagen: x.imagen ?? '',
          });
        }
      })
      .catch((e: unknown) => setError({ mensaje: e instanceof ErrorApi ? e.message : String(e) }))
      .finally(() => setCargado(true));
    // Solo al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const v = b.valores;
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso('');
    try {
      const r = await pedir<{ restaurante: Restaurante }>('PUT', '/datos/mi-restaurante', {
        nombre: v.nombre,
        categoria: v.categoria,
        telefono: v.telefono,
        direccion: v.direccion,
        descripcionEs: v.descripcionEs,
        descripcionEn: v.descripcionEn,
        tiempoPrepMin: Number(v.tiempoPrepMin) || 20,
        lat: v.lat === '' ? null : Number(v.lat),
        lng: v.lng === '' ? null : Number(v.lng),
        imagen: v.imagen || null,
      });
      setRest(r.restaurante);
      const x = r.restaurante;
      cargar({
        nombre: x.nombre,
        categoria: x.categoria,
        telefono: x.telefono,
        direccion: x.direccion,
        descripcionEs: x.descripcionEs,
        descripcionEn: x.descripcionEn,
        tiempoPrepMin: String(x.tiempoPrepMin),
        lat: x.lat == null ? '' : String(x.lat),
        lng: x.lng == null ? '' : String(x.lng),
        imagen: x.imagen ?? '',
      });
      setAviso(t.guardado);
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    }
  }

  function ubicar() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        b.cambiar('lat', p.coords.latitude.toFixed(6));
        b.cambiar('lng', p.coords.longitude.toFixed(6));
        setAviso(t.ubicacionOk);
      },
      (e) => setError({ mensaje: e.message }),
    );
  }

  async function alternarAbierto() {
    if (!rest) return;
    try {
      const r = await pedir<{ abierto: boolean }>('PATCH', '/datos/mi-restaurante/abierto', {
        abierto: !rest.abierto,
      });
      setRest({ ...rest, abierto: r.abierto });
    } catch (x) {
      setError({ mensaje: x instanceof ErrorApi ? x.message : String(x) });
    }
  }

  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);
  if (!cargado) return null;

  return (
    <section>
      <h1>{t.titulo}</h1>
      {rest && (
        <div className={`estado estado-${rest.estado}`}>
          <span>{t.estados[rest.estado]}</span>
          {rest.estado === 'aprobado' && (
            <button
              type="button"
              className={rest.abierto ? 'boton secundario' : 'boton'}
              onClick={() => void alternarAbierto()}
            >
              {rest.abierto ? `${t.abierto} · ${t.cerrar}` : t.abrir}
            </button>
          )}
        </div>
      )}
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}
      <form onSubmit={guardar} className="formulario" noValidate>
        <SubirFoto
          etiqueta={t.foto}
          valor={v.imagen}
          cambiar={(url) => b.cambiar('imagen', url)}
          idioma={idioma}
        />
        <Campo
          etiqueta={t.nombre}
          valor={v.nombre}
          cambiar={(x) => b.cambiar('nombre', x)}
          placeholder={t.nombre}
          error={errorDe('nombre')}
        />
        <Campo
          etiqueta={t.categoria}
          valor={v.categoria}
          cambiar={(x) => b.cambiar('categoria', x)}
          placeholder={t.categoria}
        />
        <Campo
          etiqueta={t.telefono}
          tipo="tel"
          valor={v.telefono}
          cambiar={(x) => b.cambiar('telefono', x)}
          placeholder={t.telefono}
        />
        <Campo
          etiqueta={t.direccion}
          valor={v.direccion}
          cambiar={(x) => b.cambiar('direccion', x)}
          placeholder={t.direccion}
          error={errorDe('direccion')}
        />
        <div className="fila-ubicacion">
          <button type="button" className="boton secundario" onClick={ubicar}>
            <Icono nombre="pin" tamano={18} /> {t.ubicacion}
          </button>
          <span>{v.lat && v.lng ? `${v.lat}, ${v.lng}` : t.sinUbicacion}</span>
        </div>
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
          etiqueta={t.prep}
          tipo="number"
          valor={v.tiempoPrepMin}
          cambiar={(x) => b.cambiar('tiempoPrepMin', x)}
        />
        {error && !error.campo && (
          <p className="error-general" role="alert">
            {error.mensaje}
          </p>
        )}
        {aviso && (
          <p className="ok" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
      {rest ? (
        <Horarios restaurante={rest} cuenta={usuario.id} idioma={idioma} alGuardar={setRest} />
      ) : null}
    </section>
  );
}

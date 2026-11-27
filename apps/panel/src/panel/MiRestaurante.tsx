import { useEffect, useState } from 'react';
import { CuentaSaldoRestaurante } from './CuentaSaldoRestaurante';
import { Icono } from '../sitio/Icono';
import {
  ErrorApi,
  type Idioma,
  type Restaurante,
  type Usuario,
  almacenNavegador,
  enIdioma,
  esTipoComercio,
  nombreTipoComercio,
  palabrasComercio,
  TIPOS_ALTA,
  useBorrador,
  textoActivacion,
} from '@tumbite/compartido';
import { CampoDireccion } from '../sitio/CampoDireccion';
import { TraerDivoox } from './TraerDivoox';
import { Campo } from './CampoClave';
import { Horarios } from './Horarios';
import { Cierres } from './Cierres';
import { pedir } from './api';
import { SubirFoto } from './SubirFoto';
import { ClavesPos } from './ClavesPos';

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
    fueraHorario: 'Abierto, fuera de horario',
    cerrado: 'Cerrado',
    abrir: 'Abrir y recibir pedidos',
    cerrar: 'Cerrar por ahora',
    activacion: 'Lista para abrir',
    activacionAyuda:
      'Antes de recibir pedidos hace falta lo marcado como obligatorio. Lo recomendado ayuda a vender más.',
    activacionLista: 'Todo listo para abrir.',
    estados: {
      pendiente: 'En revisión: te avisamos al aprobarlo.',
      aprobado: 'Aprobado',
      pausado: 'Pausado por Divoox. Escríbenos.',
      rechazado: 'No aprobado. Escríbenos para revisarlo.',
    },
    sinUbicacion: 'Sin ubicación: los clientes no verán la distancia.',
    foto: 'Foto de portada del restaurante',
    tipo: '¿Qué tipo de negocio tienes?',
    tipoAyuda: 'Con esto sabemos dónde te buscan tus clientes y qué palabras ves en tu app.',
    tipoFalta: 'Elige el tipo de negocio.',
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
    fueraHorario: 'Open, outside hours',
    cerrado: 'Closed',
    abrir: 'Open and take orders',
    cerrar: 'Close for now',
    activacion: 'Ready to open',
    activacionAyuda:
      'Before taking orders you need everything marked as required. The recommended items help you sell more.',
    activacionLista: 'Everything is ready to open.',
    estados: {
      pendiente: 'Under review: we’ll let you know when it’s approved.',
      aprobado: 'Approved',
      pausado: 'Paused by Divoox. Contact us.',
      rechazado: 'Not approved. Contact us to review it.',
    },
    sinUbicacion: 'No location: customers won’t see the distance.',
    foto: 'Restaurant cover photo',
    tipo: 'What kind of business do you have?',
    tipoAyuda:
      'This tells us where your customers look for you and which words you see in your app.',
    tipoFalta: 'Choose your business type.',
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
  // C-MERCHANT-TIPO: vacío a propósito. Un comercio nuevo elige su tipo; nunca nace restaurante solo.
  tipoComercio: '',
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
  const [cobertura, setCobertura] = useState('');
  const { cargar, cargarBase } = b;

  useEffect(() => {
    pedir<{ restaurante: Restaurante | null; cobertura?: string }>('GET', '/datos/mi-restaurante')
      .then((r) => {
        setRest(r.restaurante);
        setCobertura(r.cobertura ?? '');
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
            tipoComercio: x.tipoComercio ?? 'restaurante',
          });
        } else if (usuario.correo.endsWith('@negocio.divoox.invalid'))
          // C-CUENTA-UNICA-RESTAURANTE: el restaurante nuevo de una persona arranca con lo ya
          // conocido: el nombre que eligió y el celular de su dueño (solo si no hay borrador).
          void pedir<{ persona: { telefono?: string | null } }>('GET', '/datos/cuentas/papeles')
            .then((p) =>
              cargarBase({
                ...INICIAL,
                nombre: usuario.nombre,
                telefono: p.persona.telefono ?? '',
              }),
            )
            .catch(() => cargarBase({ ...INICIAL, nombre: usuario.nombre }));
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
    // C-MERCHANT-TIPO: sin tipo no se crea el comercio (ni se manda al servidor).
    if (!esTipoComercio(v.tipoComercio)) {
      setError({ mensaje: t.tipoFalta, campo: 'tipoComercio' });
      document.getElementById('tipo-negocio')?.scrollIntoView?.({ block: 'center' });
      return;
    }
    try {
      const r = await pedir<{ restaurante: Restaurante; cobertura?: string }>(
        'PUT',
        '/datos/mi-restaurante',
        {
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
          tipoComercio: v.tipoComercio,
        },
      );
      setRest(r.restaurante);
      setCobertura(r.cobertura ?? '');
      window.dispatchEvent(new Event('divoox:tipo-comercio'));
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
        tipoComercio: x.tipoComercio ?? 'restaurante',
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
      const r = await pedir<{ abierto: boolean; abiertoAhora?: boolean }>(
        'PATCH',
        '/datos/mi-restaurante/abierto',
        {
          abierto: !rest.abierto,
        },
      );
      // F13: el servidor dice si de verdad está recibiendo (horario y señal); si no lo manda, se asume.
      setRest({ ...rest, abierto: r.abierto, abiertoAhora: r.abiertoAhora ?? r.abierto });
    } catch (x) {
      setError({ mensaje: x instanceof ErrorApi ? x.message : String(x) });
    }
  }

  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);
  // C-MERCHANT-PALABRAS: el texto sigue al tipo elegido (antes de elegir, palabras de comercio).
  const w = palabrasComercio(
    v.tipoComercio || rest?.tipoComercio || (rest ? 'restaurante' : 'otro'),
    idioma,
  );
  if (!cargado) return null;

  return (
    <section>
      <h1>{w.miNegocio}</h1>
      {rest && (
        <div className={`estado estado-${rest.estado}`}>
          <span>{t.estados[rest.estado]}</span>
          {rest.estado === 'aprobado' && (
            <button
              type="button"
              className={rest.abierto ? 'boton secundario' : 'boton'}
              onClick={() => void alternarAbierto()}
            >
              {rest.abierto
                ? `${rest.abiertoAhora ? t.abierto : t.fueraHorario} · ${t.cerrar}`
                : t.abrir}
            </button>
          )}
        </div>
      )}
      <CuentaSaldoRestaurante idioma={idioma} usuarioId={usuario.id} />
      {rest?.activacion && (
        <div className="activacion" aria-label={t.activacion}>
          <h2>{t.activacion}</h2>
          <p className="suave">{rest.activacion.lista ? t.activacionLista : t.activacionAyuda}</p>
          <ul>
            {rest.activacion.items.map((i) => (
              <li key={i.clave} className={i.listo ? 'activacion-ok' : 'activacion-falta'}>
                <span aria-hidden="true">{i.listo ? '✓' : '○'}</span>{' '}
                {textoActivacion(i.clave, idioma)}
              </li>
            ))}
          </ul>
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
        <fieldset
          id="tipo-negocio"
          className="tipos-negocio"
          aria-invalid={errorDe('tipoComercio') ? true : undefined}
          aria-describedby="tipo-negocio-ayuda"
        >
          <legend>{t.tipo}</legend>
          <p id="tipo-negocio-ayuda" className="suave">
            {t.tipoAyuda}
          </p>
          <div className="tipos-negocio-lista">
            {TIPOS_ALTA.map((tipo) => (
              <label key={tipo} className="opcion tipo-negocio">
                <input
                  type="radio"
                  name="tipoComercio"
                  value={tipo}
                  checked={v.tipoComercio === tipo}
                  onChange={() => b.cambiar('tipoComercio', tipo)}
                />
                <span>{nombreTipoComercio(tipo, idioma)}</span>
              </label>
            ))}
            {/* Un tipo que no está en la lista corta del alta (p. ej. «Farmacia» de antes o
                «Mascotas» puesto por Divoox) se muestra igual, marcado, para no perderlo. */}
            {v.tipoComercio && !(TIPOS_ALTA as readonly string[]).includes(v.tipoComercio) ? (
              <label className="opcion tipo-negocio">
                <input type="radio" name="tipoComercio" value={v.tipoComercio} checked readOnly />
                <span>{nombreTipoComercio(v.tipoComercio, idioma)}</span>
              </label>
            ) : null}
          </div>
          {errorDe('tipoComercio') ? (
            <p className="error-campo" role="alert">
              {errorDe('tipoComercio')}
            </p>
          ) : null}
        </fieldset>
        <SubirFoto
          etiqueta={w.fotoNegocio}
          valor={v.imagen}
          cambiar={(url) => b.cambiar('imagen', url)}
          idioma={idioma}
        />
        <Campo
          etiqueta={w.nombreNegocio}
          valor={v.nombre}
          cambiar={(x) => b.cambiar('nombre', x)}
          placeholder={w.nombreNegocio}
          error={errorDe('nombre')}
        />
        <Campo
          etiqueta={w.categoria}
          valor={v.categoria}
          cambiar={(x) => b.cambiar('categoria', x)}
          placeholder={w.categoria}
        />
        <Campo
          etiqueta={w.telefonoNegocio}
          tipo="tel"
          valor={v.telefono}
          cambiar={(x) => b.cambiar('telefono', x)}
          placeholder={w.telefonoNegocio}
        />
        <div className="campo">
          {/* C-DIRECCION-SUGERENCIAS: la dirección real del local, con su punto en el mapa. */}
          <CampoDireccion
            etiqueta={t.direccion}
            valor={v.direccion}
            cambiar={(x) => b.cambiar('direccion', x)}
            alElegir={(d) => {
              b.cambiar('lat', d.punto.lat.toFixed(6));
              b.cambiar('lng', d.punto.lng.toFixed(6));
            }}
            placeholder={t.direccion}
          />
          {errorDe('direccion') ? <p className="error-campo">{errorDe('direccion')}</p> : null}
        </div>
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
          etiqueta={w.prep}
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
      {rest && cobertura === 'fuera' ? (
        <TraerDivoox
          idioma={idioma}
          cuenta={usuario.id}
          nombre={usuario.nombre}
          correo={usuario.correo}
          negocio={rest.nombre}
          telefono={rest.telefono}
          punto={rest.lat != null && rest.lng != null ? { lat: rest.lat, lng: rest.lng } : null}
        />
      ) : null}
      {rest ? (
        <>
          <Horarios restaurante={rest} cuenta={usuario.id} idioma={idioma} alGuardar={setRest} />
          <Cierres idioma={idioma} />
          <ClavesPos idioma={idioma} />
        </>
      ) : null}
    </section>
  );
}

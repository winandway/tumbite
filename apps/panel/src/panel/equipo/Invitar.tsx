import { useId, useState } from 'react';
import {
  type Idioma,
  ErrorApi,
  almacenNavegador,
  correoEjemplo,
  nombreCumpleSoporte,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from '../api';
import { usePermisos } from '../permisosPanel';
import { ElegirAcceso, alcanceDe, type EleccionAcceso } from './Piezas';
import { type Plantilla, type Zona, textosEquipo } from './textos';

const INICIAL = {
  correo: '',
  nombre: '',
  plantillas: [] as string[],
  paises: [] as string[],
  zonas: [] as string[],
  servicios: [] as EleccionAcceso['servicios'],
  venceEn: '',
  motivo: '',
  idioma: 'en' as 'es' | 'en',
};

/**
 * «Agregar empleado» (C-EQUIPO-INVITACION). Lo escrito se guarda solo mientras se escribe y vuelve
 * si se cierra la ventana (regla «ningún formulario pierde lo escrito»); se borra al mandar o al
 * cancelar. En el sitio de pruebas y en la computadora el correo no sale: el enlace se ve aquí,
 * solo para quien invitó.
 */
export function Invitar({
  idioma,
  plantillas,
  zonas,
  alTerminar,
  alCerrar,
}: {
  idioma: Idioma;
  plantillas: Plantilla[];
  zonas: Zona[];
  alTerminar: () => void;
  alCerrar: () => void;
}) {
  const t = textosEquipo(idioma);
  const id = useId();
  const { acceso } = usePermisos();
  const b = useBorrador({
    formulario: 'equipo-invitar',
    cuenta: acceso?.id,
    inicial: { ...INICIAL, idioma },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ enlace?: string; correoEnviado: boolean } | null>(
    null,
  );
  const [copiado, setCopiado] = useState(false);
  const soporteMal = v.correo.includes('@') && !nombreCumpleSoporte(v.correo, v.nombre);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (soporteMal) return setError({ mensaje: t.soporteRegla, campo: 'nombre' });
    setEnviando(true);
    try {
      const r = await pedir<{ enlace?: string; correoEnviado: boolean }>(
        'POST',
        '/datos/admin/equipo/invitaciones',
        {
          correo: v.correo,
          nombre: v.nombre,
          plantillas: v.plantillas,
          alcance: alcanceDe(v),
          venceEn: v.venceEn || null,
          motivo: v.motivo,
          idioma: v.idioma,
        },
      );
      await b.limpiar();
      setResultado(r);
      alTerminar();
    } catch (x) {
      // Si falla, lo escrito se queda en pantalla (y en el borrador) para reintentar.
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setEnviando(false);
    }
  }

  if (resultado)
    return (
      <section className="pd-tarjeta eq-invitar" aria-live="polite">
        <h2>{t.nuevo}</h2>
        {resultado.enlace ? (
          <div className="eq-enlace">
            <strong>{t.enlaceTitulo}</strong>
            <p className="pista">{t.enlaceAyuda}</p>
            <code>{resultado.enlace}</code>
            <button
              type="button"
              className="boton chico"
              onClick={() => {
                void navigator.clipboard?.writeText(resultado.enlace ?? '');
                setCopiado(true);
              }}
            >
              {copiado ? t.copiado : t.copiar}
            </button>
          </div>
        ) : (
          <p className="texto-exito">{t.correoMandado}</p>
        )}
        <button type="button" className="boton secundario" onClick={alCerrar}>
          {t.cerrar}
        </button>
      </section>
    );

  return (
    <form className="pd-tarjeta eq-invitar" onSubmit={enviar} noValidate>
      <h2>{t.nuevo}</h2>
      <p className="pista">{t.nuevoAyuda}</p>
      {b.recuperado ? (
        <p className="eq-recuperado" role="status">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.limpiar()}>
            {t.empezarDeNuevo}
          </button>
        </p>
      ) : null}
      <div className="eq-dos">
        <div className="campo">
          <label htmlFor={`${id}-correo`}>{t.correo}</label>
          <input
            id={`${id}-correo`}
            type="email"
            autoComplete="off"
            placeholder={correoEjemplo(idioma)}
            value={v.correo}
            onChange={(e) => b.cambiar('correo', e.target.value)}
            aria-invalid={error?.campo === 'correo'}
          />
          {error?.campo === 'correo' ? <p className="error-campo">{error.mensaje}</p> : null}
        </div>
        <div className="campo">
          <label htmlFor={`${id}-nombre`}>{t.nombre}</label>
          <input
            id={`${id}-nombre`}
            autoComplete="off"
            placeholder={t.nombre}
            value={v.nombre}
            onChange={(e) => b.cambiar('nombre', e.target.value)}
            aria-invalid={soporteMal || error?.campo === 'nombre'}
          />
          {soporteMal ? <p className="error-campo">{t.soporteRegla}</p> : null}
        </div>
      </div>
      <ElegirAcceso
        valor={v}
        cambiar={(x) => {
          b.cambiar('plantillas', x.plantillas);
          b.cambiar('paises', x.paises);
          b.cambiar('zonas', x.zonas);
          b.cambiar('servicios', x.servicios);
          b.cambiar('venceEn', x.venceEn);
        }}
        plantillas={plantillas}
        zonas={zonas}
        misPermisos={acceso?.permisos ?? []}
        idioma={idioma}
      />
      <div className="eq-dos">
        <div className="campo">
          <label htmlFor={`${id}-motivo`}>{t.motivo}</label>
          <input
            id={`${id}-motivo`}
            placeholder={t.motivoAyuda}
            value={v.motivo}
            onChange={(e) => b.cambiar('motivo', e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-idioma`}>{t.idiomaInvitacion}</label>
          <select
            id={`${id}-idioma`}
            value={v.idioma}
            onChange={(e) => b.cambiar('idioma', e.target.value === 'es' ? 'es' : 'en')}
          >
            <option value="en">English - EN</option>
            <option value="es">español - ES</option>
          </select>
        </div>
      </div>
      {error && error.campo !== 'correo' ? (
        <p className="error-general" role="alert">
          {error.mensaje}
        </p>
      ) : null}
      <div className="eq-dialogo-botones">
        <button
          type="button"
          className="boton secundario"
          onClick={() => {
            void b.limpiar();
            alCerrar();
          }}
        >
          {t.cancelar}
        </button>
        <button
          type="submit"
          className="boton"
          disabled={
            enviando || !v.correo || !v.nombre || !v.plantillas.length || v.motivo.trim().length < 5
          }
        >
          {enviando ? t.enviando : t.enviar}
        </button>
      </div>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { PaisTelefono } from './PaisTelefono';
import {
  correoEjemplo,
  correoLimpio,
  filasParaRevisar,
  pareceCorreo,
  ErrorApi,
  datosPais,
  soloNumerosTelefono,
  textosRevisar,
  validarRegistro,
  type CasillaRegistro,
  type FalloCasilla,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
  enIdiomaDireccion,
} from '@tumbite/compartido';
import { api } from './api';
import { ir } from '../ruta';
import { Campo, CampoClave } from './CampoClave';
import { Turnstile, reiniciarTurnstile } from './Turnstile';
import { TEXTOS_PANEL } from './textos';
import { CasillaSms } from './CasillaSms';
import { SugerenciaCorreo } from './SugerenciaCorreo';
import { RevisaTusDatos } from './RevisaTusDatos';

// C-TELEFONO-E164: `paisTelefono`, el país del celular (arranca en el país desde donde se abre).
const INICIAL = { nombre: '', correo: '', telefono: '', clave: '', sms: false, paisTelefono: '' };
/** Las casillas del registro web, en el orden de la pantalla y de «Revisa tus datos». */
const CASILLAS: CasillaRegistro[] = ['nombre', 'correo', 'telefono', 'clave'];

/**
 * Entrar y crear cuenta de restaurante o, desde el panel de empresas (C-FLEX-CUENTA-EMPRESA), de
 * empresa de logística. Lo escrito nunca se pierde (menos la contraseña).
 */
export function Acceso({
  idioma,
  alEntrar,
  tipo = 'restaurante',
}: {
  idioma: Idioma;
  alEntrar: (u: Usuario) => void;
  tipo?: 'restaurante' | 'empresa';
}) {
  const base = enIdioma(TEXTOS_PANEL, idioma);
  const empresa = tipo === 'empresa';
  const t = empresa ? { ...base, ...base.empresa } : base;
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const b = useBorrador({
    formulario: `panel-${modo}`,
    inicial: INICIAL,
    almacen: almacenNavegador,
    sensibles: ['clave'],
  });
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  // C-REVISA-TUS-DATOS: al crear la cuenta hay dos pasos, el formulario y «Revisa tus datos». La
  // cuenta solo se crea desde el segundo, con el toque en «Crear mi cuenta».
  const [paso, setPaso] = useState<'formulario' | 'revisar'>('formulario');
  const [enfocar, setEnfocar] = useState<CasillaRegistro | null>(null);
  const [fallos, setFallos] = useState<FalloCasilla[]>([]);
  const [enviando, setEnviando] = useState(false);
  // Casilla de aceptación de los términos al crear la cuenta (pedido de Richard, 27 oct 2026).
  const [acepto, setAcepto] = useState(false);
  const [turnstileSitio, setTurnstileSitio] = useState('');
  const v = b.valores;
  const r = textosRevisar(idioma);
  // Escudo anti-robots (F5): la clave pública la publica el servidor; vacía = apagado.
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ turnstileSitio?: string }>('GET', '/datos/publico')
      .then((p) => {
        if (vivo) setTurnstileSitio(p.turnstileSitio ?? '');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  /** Si falla, lo escrito se queda en pantalla; el error de una casilla se ve a su lado. */
  function alFallar(x: unknown) {
    // Un 403 del escudo pide otro pase.
    if (x instanceof ErrorApi && x.estado === 403) reiniciarTurnstile();
    if (x instanceof ErrorApi && x.campo && CASILLAS.some((c) => c === x.campo))
      setPaso('formulario');
    setError(
      x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
    );
  }

  /** El formulario: al entrar, entra; al crear la cuenta, solo lleva a «Revisa tus datos». */
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (modo === 'registro') {
      continuar();
      return;
    }
    if (!pareceCorreo(v.correo)) {
      setError({ mensaje: t.correoInvalido, campo: 'correo' });
      return;
    }
    setEnviando(true);
    try {
      const sesion = await api.entrar({ correo: v.correo, clave: v.clave });
      await b.limpiar();
      alEntrar(sesion.usuario);
    } catch (x) {
      alFallar(x);
    } finally {
      setEnviando(false);
    }
  }

  /** C-REVISA-TUS-DATOS: valida cada casilla y abre «Revisa tus datos». NUNCA crea la cuenta. */
  function continuar() {
    const malos = validarRegistro(v, idioma, CASILLAS);
    setFallos(malos);
    if (malos.length) return;
    if (!acepto) {
      setError({ mensaje: t.faltaAceptar });
      return;
    }
    setEnfocar(null);
    setPaso('revisar');
  }

  /** «Editar» en la revisión: de vuelta al formulario, con lo escrito y esa casilla abierta. */
  function editar(campo: CasillaRegistro | null) {
    setError(null);
    setEnfocar(campo);
    setPaso('formulario');
  }

  /**
   * Crea la cuenta. La llama SOLO el botón «Crear mi cuenta» de «Revisa tus datos» (candado
   * C-REVISA-TUS-DATOS): ni la tecla Enter, ni la última casilla, ni un efecto.
   */
  async function crearCuenta() {
    setError(null);
    setEnviando(true);
    try {
      const sesion = await api.registro({
        nombre: v.nombre.trim(),
        correo: correoLimpio(v.correo),
        clave: v.clave,
        telefono: v.telefono || undefined,
        ...(v.telefono && v.paisTelefono ? { paisTelefono: v.paisTelefono } : {}),
        // La empresa de logística es una cuenta de cliente que crea su empresa en el panel.
        rol: empresa ? 'cliente' : 'restaurante',
        idioma,
        // C-SMS-CONSENTIMIENTO: la casilla de SMS, aparte y sin marcar.
        smsConsentimiento: v.sms,
        canal: 'web',
      });
      await b.limpiar();
      alEntrar(sesion.usuario);
    } catch (x) {
      alFallar(x);
    } finally {
      setEnviando(false);
    }
  }

  const errorDe = (campo: CasillaRegistro) =>
    fallos.find((f) => f.campo === campo)?.mensaje ??
    (error?.campo === campo ? error.mensaje : undefined);
  // El error de una casilla se va en cuanto la persona la corrige.
  const cambiar = (campo: 'nombre' | 'correo' | 'telefono' | 'clave', valor: string) => {
    b.cambiar(campo, valor);
    setError((x) => (x?.campo === campo ? null : x));
    setFallos((f) => f.filter((x) => x.campo !== campo));
  };
  const revisar = modo === 'registro' && paso === 'revisar';

  return (
    <main className="acceso">
      <h1>{modo === 'entrar' ? t.tituloEntrar : t.registrarse}</h1>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezarDeNuevo}
          </button>
        </p>
      )}
      {revisar ? (
        <RevisaTusDatos
          idioma={idioma}
          correo={v.correo}
          filas={filasParaRevisar(v, idioma, CASILLAS)}
          enviando={enviando}
          error={error && !error.campo ? error.mensaje : null}
          alEditar={editar}
          alEditarDatos={() => editar(null)}
          alCrear={() => void crearCuenta()}
          aceptarCorreo={(x) => cambiar('correo', x)}
        >
          <Turnstile sitio={turnstileSitio} idioma={idioma} />
        </RevisaTusDatos>
      ) : (
        <form onSubmit={enviar} noValidate>
          {modo === 'registro' && (
            <Campo
              etiqueta={t.nombre}
              valor={v.nombre}
              cambiar={(x) => cambiar('nombre', x)}
              autoComplete="name"
              enfocar={enfocar === 'nombre'}
              placeholder={t.nombre}
              error={errorDe('nombre')}
            />
          )}
          <Campo
            etiqueta={t.correo}
            tipo="email"
            valor={v.correo}
            cambiar={(x) => cambiar('correo', x)}
            autoComplete="email"
            modoTeclado="email"
            enfocar={modo === 'registro' && enfocar === 'correo'}
            placeholder={correoEjemplo(idioma)}
            error={errorDe('correo')}
          />
          {modo === 'registro' ? (
            <SugerenciaCorreo
              correo={v.correo}
              idioma={idioma}
              aceptar={(x) => cambiar('correo', x)}
            />
          ) : null}
          {modo === 'registro' && (
            <PaisTelefono
              pais={v.paisTelefono}
              alCambiar={(x) => b.cambiar('paisTelefono', x)}
              idioma={idioma}
            />
          )}
          {modo === 'registro' && (
            <Campo
              etiqueta={t.telefono}
              tipo="tel"
              valor={v.telefono}
              // Solo números (y el + del país): las letras no entran.
              cambiar={(x) => cambiar('telefono', soloNumerosTelefono(x))}
              autoComplete="tel"
              modoTeclado="tel"
              enfocar={enfocar === 'telefono'}
              placeholder={datosPais(v.paisTelefono)?.ejemploCelular ?? t.telefono}
              error={errorDe('telefono')}
            />
          )}
          <CampoClave
            etiqueta={t.clave}
            valor={v.clave}
            cambiar={(x) => cambiar('clave', x)}
            textoVer={t.verClave}
            textoOcultar={t.ocultarClave}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            error={errorDe('clave')}
          />
          {error && !error.campo && (
            <p className="error-general" role="alert">
              {error.mensaje}
            </p>
          )}
          {modo === 'registro' && (
            <label className="nota-legal casilla-acepto">
              <input
                type="checkbox"
                checked={acepto}
                onChange={(x) => setAcepto(x.target.checked)}
              />{' '}
              {t.aceptas}{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                {t.terminos}
              </a>
              {empresa ? (
                ' '
              ) : (
                <>
                  ,{' '}
                  <a href="/restaurant-terms" target="_blank" rel="noopener noreferrer">
                    {t.terminosRestaurantes}
                  </a>{' '}
                </>
              )}
              {t.yLa}{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                {t.privacidad}
              </a>
              .
            </label>
          )}
          {modo === 'registro' && (
            <CasillaSms idioma={idioma} marcada={v.sms} cambiar={(x) => b.cambiar('sms', x)} />
          )}
          {/* En el registro, el escudo va en «Revisa tus datos», donde se crea la cuenta. */}
          {modo === 'entrar' && <Turnstile sitio={turnstileSitio} idioma={idioma} />}
          {/* C-REVISA-TUS-DATOS: al crear la cuenta, el botón lleva a revisar; todavía no la crea. */}
          <button
            type="submit"
            className="boton ancho"
            disabled={enviando}
            data-testid={modo === 'registro' ? 'registro-continuar' : undefined}
          >
            {enviando ? t.enviando : modo === 'entrar' ? t.entrar : r.continuar}
          </button>
        </form>
      )}
      <button
        type="button"
        className="enlace"
        onClick={() => {
          setError(null);
          setFallos([]);
          setPaso('formulario');
          setModo(modo === 'entrar' ? 'registro' : 'entrar');
        }}
      >
        {modo === 'entrar' ? t.noTengo : t.yaTengo}
      </button>
      {modo === 'entrar' && (
        <button type="button" className="enlace" onClick={() => ir('/forgot-password')}>
          {t.olvide}
        </button>
      )}
      {/* C-AYUDA-A-LA-VISTA: soporte sin tener que iniciar sesión. */}
      <a className="enlace" href={enIdiomaDireccion('/support', idioma)} data-testid="acceso-ayuda">
        {idioma === 'en' ? 'Need help?' : '¿Necesitas ayuda?'}
      </a>
    </main>
  );
}

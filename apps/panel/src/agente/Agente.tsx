import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Banknote,
  CircleHelp,
  History,
  House,
  LogOut,
  Printer,
  ScanLine,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  ErrorApi,
  type Idioma,
  MARCA,
  almacenNavegador,
  correoEjemplo,
  enIdioma,
  formatearMonto,
  pareceCorreo,
  textoLocal,
  useBorrador,
} from '@tumbite/compartido';
import { SelectorIdioma } from '../SelectorIdioma';
import { Campo, CampoClave } from '../panel/CampoClave';
import { Turnstile, reiniciarTurnstile } from '../panel/Turnstile';
import { pedir } from '../panel/api';
import { ir } from '../ruta';
import { conIdioma } from '../rutaIdioma';
import { TEXTOS_AGENTE } from './textos';
import './agente.css';

/**
 * C-AGENTE-DIVOOX (18 nov 2026): el panel del Agente Divoox (`/agent`, español en `/es/agent`).
 * Solo dos trabajos: «Pagar» (el conductor cobra sus ganancias con un código de un solo uso) y
 * «Vender saldo». Más su fondo, su historial y su guía. La sesión es propia y corta: entra con
 * correo y contraseña y confirma siempre con un código que llega a su correo.
 */
type T = (typeof TEXTOS_AGENTE)['es'];

type Yo = {
  nombre: string;
  ciudad: string;
  servicioActivo: boolean;
  moneda: string;
  pagaEn: 'USD' | 'VES';
  tasa: { tasa: number; fecha: string } | null;
  fondo: number;
  fondoBajo: boolean;
  deuda: number;
  pagadoHoy: number;
  vendidoHoy: number;
  topePago: number;
  topeDia: number;
  topeVenta: number;
  ventaMinima: number;
  topeDeuda: number;
  pagosBloqueados: boolean;
};
type Cobro = {
  id: string;
  monto: number;
  moneda: string;
  pagaEn: string;
  refTasa: number | null;
  refFecha: string | null;
  refMonto: number | null;
  expiraEn: string;
  conductor: { nombre: string; telefonoFinal: string; conFoto: boolean };
  alcanzaFondo: boolean;
  pasaTope: boolean;
};
type Recibo = {
  tipo: 'pago' | 'venta';
  numero: string;
  monto: number;
  moneda: string;
  pagaEn: string;
  refTasa: number | null;
  refMonto: number | null;
  cuando: string;
  conductor: string;
  fondo?: number;
  saldoConductor?: number;
  deuda?: number;
};
type Conductor = { id: string; nombre: string; telefonoFinal: string; conFoto: boolean };
type Movimiento = {
  tipo: string;
  numero: string;
  monto: number;
  refMonto: number | null;
  cuando: string;
  conductor: string;
  concepto: string;
};

const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
/** Las fechas del servidor vienen en UTC («2026-11-18 14:05:00»). */
const fecha = (sql: string, idioma: Idioma, soloHora = false) => {
  const d = new Date(`${sql.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return sql;
  return d.toLocaleString(
    idioma === 'es' ? 'es' : 'en-US',
    soloHora
      ? { hour: 'numeric', minute: '2-digit' }
      : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
  );
};
const bolivares = (monto: number | null, tasa: number | null, idioma: Idioma) =>
  monto == null ? '' : textoLocal({ moneda: 'VES', monto, tasa: tasa ?? 0, fecha: '' }, idioma);

export function Agente({
  ruta,
  idioma,
}: {
  /** La dirección sin el prefijo de idioma: `/agent` o `/agent/password`. */
  ruta: string;
  idioma: Idioma;
}) {
  const t = enIdioma(TEXTOS_AGENTE, idioma);
  const [yo, setYo] = useState<Yo | null>(null);
  const [paso, setPaso] = useState<'cargando' | 'entrar' | 'codigo' | 'dentro'>('cargando');
  const cargar = useCallback(async () => {
    try {
      const r = await pedir<{ agente: Yo }>('GET', '/datos/agent/me');
      setYo(r.agente);
      setPaso('dentro');
    } catch {
      setYo(null);
      setPaso((p) => (p === 'codigo' ? p : 'entrar'));
    }
  }, []);
  useEffect(() => {
    if (ruta === '/agent/password') return;
    let vivo = true;
    pedir<{ agente: Yo }>('GET', '/datos/agent/me')
      .then((r) => {
        if (!vivo) return;
        setYo(r.agente);
        setPaso('dentro');
      })
      .catch(() => {
        if (vivo) setPaso('entrar');
      });
    return () => {
      vivo = false;
    };
  }, [ruta]);
  const cambiarIdioma = (nuevo: Idioma) => {
    if (yo) void pedir('PUT', '/datos/agent/language', { idioma: nuevo }).catch(() => undefined);
    ir(conIdioma(ruta, nuevo) + window.location.search);
  };
  async function salir() {
    await pedir('POST', '/datos/agent/logout').catch(() => undefined);
    // Carga completa: nada de lo que estaba en pantalla queda en memoria.
    window.location.assign(conIdioma('/agent', idioma));
  }
  return (
    <div className="agente" data-testid="agente">
      <header className="agente-cabecera">
        <div className="agente-marca">
          <img src="/marca/divoox-logo-oscuro.svg" alt="Divoox" width="104" height="28" />
          <span>{t.marca}</span>
        </div>
        <div className="agente-cabecera-lado">
          {yo ? <span className="agente-quien">{`${yo.nombre} · ${yo.ciudad}`}</span> : null}
          <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
          {yo ? (
            <button type="button" className="agente-salir" onClick={() => void salir()}>
              <LogOut size={16} aria-hidden="true" />
              {t.salir}
            </button>
          ) : null}
        </div>
      </header>
      {ruta === '/agent/password' ? (
        <CrearClave t={t} idioma={idioma} />
      ) : paso === 'cargando' ? (
        <main className="agente-caja">
          <p className="pista" role="status">
            {t.cargando}
          </p>
        </main>
      ) : paso === 'entrar' ? (
        <Entrar t={t} idioma={idioma} alPasar={() => setPaso('codigo')} />
      ) : paso === 'codigo' ? (
        <SegundoPaso t={t} alEntrar={() => void cargar()} alVolver={() => setPaso('entrar')} />
      ) : yo ? (
        <Dentro t={t} idioma={idioma} yo={yo} recargar={cargar} />
      ) : null}
      <footer className="agente-pie sin-imprimir">
        © {new Date().getFullYear()} divoox.com | {t.derechos} {t.desarrollo}{' '}
        <a href={MARCA.sitioEmpresa} target="_blank" rel="noopener noreferrer">
          {MARCA.empresa}
        </a>
      </footer>
    </div>
  );
}

// ───────────────────────────── Entrar ─────────────────────────────

function Entrar({ t, idioma, alPasar }: { t: T; idioma: Idioma; alPasar: () => void }) {
  const b = useBorrador({
    formulario: 'agente-entrar',
    inicial: { correo: '', clave: '' },
    almacen: almacenNavegador,
    sensibles: ['clave'],
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [olvide, setOlvide] = useState(false);
  const [olvideListo, setOlvideListo] = useState(false);
  const [sitio, setSitio] = useState('');
  const v = b.valores;
  useEffect(() => {
    let vivo = true;
    pedir<{ turnstileSitio?: string }>('GET', '/datos/publico')
      .then((p) => {
        if (vivo) setSitio(p.turnstileSitio ?? '');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!pareceCorreo(v.correo)) {
      setError(idioma === 'es' ? 'Escribe un correo válido.' : 'Enter a valid email.');
      return;
    }
    setEnviando(true);
    try {
      if (olvide) {
        await pedir('POST', '/datos/agent/password/forgot', { correo: v.correo });
        setOlvideListo(true);
      } else {
        await pedir('POST', '/datos/agent/login', { correo: v.correo, clave: v.clave });
        await b.limpiar();
        alPasar();
      }
    } catch (x) {
      setError(mensaje(x));
    } finally {
      // C-TURNSTILE-LISTO: el pase del escudo sirve una sola vez; después de cada intento, otro.
      reiniciarTurnstile();
      setEnviando(false);
    }
  }
  return (
    <main className="agente-caja" data-testid="agente-entrar">
      <ShieldCheck className="agente-escudo" size={36} aria-hidden="true" />
      <h1>{olvide ? t.olvideTitulo : t.tituloEntrar}</h1>
      <p className="pista">{olvide ? t.olvideAyuda : t.ayudaEntrar}</p>
      {b.recuperado ? (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezarDeNuevo}
          </button>
        </p>
      ) : null}
      {olvideListo ? (
        <p className="texto-exito" role="status">
          {t.olvideListo}
        </p>
      ) : (
        <form onSubmit={enviar} noValidate>
          <Campo
            etiqueta={t.correo}
            tipo="email"
            valor={v.correo}
            cambiar={(x) => b.cambiar('correo', x)}
            autoComplete="username"
            placeholder={correoEjemplo(idioma)}
          />
          {olvide ? null : (
            <CampoClave
              etiqueta={t.clave}
              valor={v.clave}
              cambiar={(x) => b.cambiar('clave', x)}
              textoVer={t.verClave}
              textoOcultar={t.ocultarClave}
              autoComplete="current-password"
            />
          )}
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          {/* C-TURNSTILE-LISTO: también al recuperar la clave (el servidor lo pide en las dos). */}
          <Turnstile sitio={sitio} idioma={idioma} />
          <button type="submit" className="boton ancho" disabled={enviando}>
            {enviando ? t.enviando : olvide ? t.olvideEnviar : t.entrar}
          </button>
        </form>
      )}
      <button
        type="button"
        className="enlace"
        onClick={() => {
          setError('');
          setOlvideListo(false);
          setOlvide(!olvide);
        }}
      >
        {olvide ? t.volverEntrar : t.olvide}
      </button>
    </main>
  );
}

function SegundoPaso({
  t,
  alEntrar,
  alVolver,
}: {
  t: T;
  alEntrar: () => void;
  alVolver: () => void;
}) {
  // El código de un solo uso nunca se guarda en el navegador (regla de borradores: lo sensible no).
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await pedir('POST', '/datos/agent/verify', { codigo: codigo.trim() });
      alEntrar();
    } catch (x) {
      setError(mensaje(x));
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <main className="agente-caja" data-testid="agente-codigo">
      <ShieldCheck className="agente-escudo" size={36} aria-hidden="true" />
      <h1>{t.tituloCodigo}</h1>
      <p className="pista">{t.ayudaCodigo}</p>
      <form onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor="agente-codigo-entrada">{t.codigo}</label>
          <input
            id="agente-codigo-entrada"
            className="agente-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="boton ancho" disabled={enviando || codigo.length !== 6}>
          {enviando ? t.enviando : t.confirmar}
        </button>
      </form>
      <button type="button" className="enlace" onClick={alVolver}>
        {t.otroCodigo}
      </button>
    </main>
  );
}

function CrearClave({ t, idioma }: { t: T; idioma: Idioma }) {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  // Las contraseñas nunca se guardan como borrador.
  const [clave, setClave] = useState('');
  const [otra, setOtra] = useState('');
  const [error, setError] = useState('');
  const [lista, setLista] = useState(false);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (clave !== otra) {
      setError(t.claveDistinta);
      return;
    }
    setEnviando(true);
    try {
      await pedir('POST', '/datos/agent/password', { token, clave });
      setLista(true);
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <main className="agente-caja" data-testid="agente-clave">
      <ShieldCheck className="agente-escudo" size={36} aria-hidden="true" />
      <h1>{t.tituloClave}</h1>
      {lista ? (
        <>
          <p className="texto-exito" role="status">
            {t.claveLista}
          </p>
          <a className="boton ancho" href={conIdioma('/agent', idioma)}>
            {t.entrar}
          </a>
        </>
      ) : token.length < 20 ? (
        <p className="error-general" role="alert">
          {t.enlaceMalo}
        </p>
      ) : (
        <form onSubmit={enviar} noValidate>
          <p className="pista">{t.ayudaClave}</p>
          <CampoClave
            etiqueta={t.claveNueva}
            valor={clave}
            cambiar={setClave}
            textoVer={t.verClave}
            textoOcultar={t.ocultarClave}
            autoComplete="new-password"
          />
          <CampoClave
            etiqueta={t.claveRepetir}
            valor={otra}
            cambiar={setOtra}
            textoVer={t.verClave}
            textoOcultar={t.ocultarClave}
            autoComplete="new-password"
          />
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="boton ancho" disabled={enviando}>
            {enviando ? t.enviando : t.guardarClave}
          </button>
        </form>
      )}
    </main>
  );
}

// ───────────────────────────── Dentro ─────────────────────────────

function Dentro({
  t,
  idioma,
  yo,
  recargar,
}: {
  t: T;
  idioma: Idioma;
  yo: Yo;
  recargar: () => Promise<void>;
}) {
  const [vista, setVista] = useState<'inicio' | 'pagar' | 'vender' | 'historial' | 'ayuda'>(
    'inicio',
  );
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const dinero = (c: number) => formatearMonto(c, yo.moneda, idioma);
  const terminar = (r: Recibo) => {
    setRecibo(r);
    void recargar();
  };
  const pestanas = [
    ['inicio', t.inicio, House],
    ['historial', t.historial, History],
    ['ayuda', t.ayuda, CircleHelp],
  ] as const;
  return (
    <main className="agente-dentro">
      <nav className="agente-pestanas" aria-label={t.marca}>
        {pestanas.map(([clave, nombre, Icono]) => (
          <button
            key={clave}
            type="button"
            className={vista === clave ? 'activa' : undefined}
            aria-current={vista === clave ? 'page' : undefined}
            onClick={() => {
              setRecibo(null);
              setVista(clave);
            }}
          >
            <Icono size={18} aria-hidden="true" />
            {nombre}
          </button>
        ))}
      </nav>
      {recibo ? (
        <VerRecibo
          t={t}
          idioma={idioma}
          r={recibo}
          dinero={dinero}
          alCerrar={() => {
            setRecibo(null);
            setVista('inicio');
          }}
        />
      ) : vista === 'inicio' ? (
        <Inicio t={t} idioma={idioma} yo={yo} dinero={dinero} ir={setVista} />
      ) : vista === 'pagar' ? (
        <Pagar
          t={t}
          idioma={idioma}
          dinero={dinero}
          alTerminar={terminar}
          alVolver={() => {
            void recargar();
            setVista('inicio');
          }}
        />
      ) : vista === 'vender' ? (
        <Vender
          t={t}
          idioma={idioma}
          yo={yo}
          dinero={dinero}
          alTerminar={terminar}
          alVolver={() => setVista('inicio')}
        />
      ) : vista === 'historial' ? (
        <Historial t={t} idioma={idioma} dinero={dinero} />
      ) : (
        <Ayuda t={t} />
      )}
    </main>
  );
}

function Inicio({
  t,
  idioma,
  yo,
  dinero,
  ir: abrir,
}: {
  t: T;
  idioma: Idioma;
  yo: Yo;
  dinero: (c: number) => string;
  ir: (v: 'pagar' | 'vender') => void;
}) {
  const sinFondo = yo.fondo <= 0;
  return (
    <section data-testid="agente-inicio">
      {!yo.servicioActivo ? (
        <p className="agente-aviso" role="status">
          {t.apagado}
        </p>
      ) : null}
      {yo.pagosBloqueados ? (
        <p className="agente-aviso peligro" role="alert">
          {t.bloqueado}
        </p>
      ) : null}
      <div className="agente-trabajos">
        <button
          type="button"
          className="agente-trabajo pagar"
          data-testid="agente-ir-pagar"
          disabled={!yo.servicioActivo || yo.pagosBloqueados || sinFondo}
          onClick={() => abrir('pagar')}
        >
          <Banknote size={34} aria-hidden="true" />
          <strong>{t.pagar}</strong>
          <span>{t.pagarAyuda}</span>
        </button>
        <button
          type="button"
          className="agente-trabajo vender"
          data-testid="agente-ir-vender"
          disabled={!yo.servicioActivo}
          onClick={() => abrir('vender')}
        >
          <Wallet size={34} aria-hidden="true" />
          <strong>{t.vender}</strong>
          <span>{t.venderAyuda}</span>
        </button>
      </div>
      <div className="agente-tarjetas">
        <div
          className={`agente-tarjeta fondo${yo.fondoBajo ? ' bajo' : ''}`}
          data-testid="agente-fondo"
        >
          <span>
            <Wallet size={18} aria-hidden="true" />
            {t.fondo}
          </span>
          <strong>{dinero(yo.fondo)}</strong>
          {yo.fondoBajo ? <small>{sinFondo ? t.sinFondo : t.fondoBajo}</small> : null}
        </div>
        <div className="agente-tarjeta">
          <span>{t.deuda}</span>
          <strong>{dinero(yo.deuda)}</strong>
          <small>{`${t.de} ${dinero(yo.topeDeuda)}`}</small>
        </div>
        <div className="agente-tarjeta">
          <span>{t.pagadoHoy}</span>
          <strong>{dinero(yo.pagadoHoy)}</strong>
          <small>{`${t.de} ${dinero(yo.topeDia)}`}</small>
        </div>
        <div className="agente-tarjeta">
          <span>{t.vendidoHoy}</span>
          <strong>{dinero(yo.vendidoHoy)}</strong>
        </div>
      </div>
      {yo.pagaEn === 'VES' && yo.tasa ? (
        <p className="pista">
          {t.tasa(
            yo.tasa.tasa.toLocaleString(idioma === 'es' ? 'es' : 'en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            }),
          )}
        </p>
      ) : null}
    </section>
  );
}

function FotoConductor({ objeto, conFoto, t }: { objeto: string; conFoto: boolean; t: T }) {
  const [rota, setRota] = useState(false);
  if (!conFoto || rota) return <p className="agente-sin-foto">{t.sinFoto}</p>;
  return (
    <img
      className="agente-foto"
      src={`/datos/agent/photo/${encodeURIComponent(objeto)}`}
      alt={t.conductor}
      width="112"
      height="112"
      onError={() => setRota(true)}
    />
  );
}

/** Lee el código de 6 números de la foto de un QR (la toma la cámara del teléfono). */
async function leerQr(archivo: File): Promise<string | null> {
  const [{ default: jsQR }, imagen] = await Promise.all([
    import('jsqr'),
    createImageBitmap(archivo),
  ]);
  const escala = Math.min(1, 1400 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  const leido = jsQR(datos.data, datos.width, datos.height)?.data ?? '';
  return /(\d{6})\s*$/.exec(leido)?.[1] ?? null;
}

/** «Desliza para marcar pagado»: llega al final y confirma. Con el teclado, Enter o espacio. */
function Deslizar({
  texto,
  ocupado,
  alCompletar,
}: {
  texto: string;
  ocupado: boolean;
  alCompletar: () => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const arrastrando = useRef(false);
  const tope = () => Math.max(1, (pista.current?.clientWidth ?? 280) - 56);
  const mover = (clienteX: number) => {
    const caja = pista.current?.getBoundingClientRect();
    if (!caja) return;
    setX(Math.min(tope(), Math.max(0, clienteX - caja.left - 28)));
  };
  const soltar = () => {
    if (!arrastrando.current) return;
    arrastrando.current = false;
    if (x >= tope() * 0.92) alCompletar();
    else setX(0);
  };
  return (
    <div
      ref={pista}
      className={`agente-deslizar${ocupado ? ' ocupado' : ''}`}
      onPointerMove={(e) => {
        if (arrastrando.current && !ocupado) mover(e.clientX);
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
    >
      <span>{texto}</span>
      <button
        type="button"
        data-testid="agente-deslizar"
        aria-label={texto}
        disabled={ocupado}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => {
          arrastrando.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            alCompletar();
          }
        }}
      >
        ›
      </button>
    </div>
  );
}

function Pagar({
  t,
  idioma,
  dinero,
  alTerminar,
  alVolver,
}: {
  t: T;
  idioma: Idioma;
  dinero: (c: number) => string;
  alTerminar: (r: Recibo) => void;
  alVolver: () => void;
}) {
  // El código de cobro es de un solo uso: no se guarda como borrador.
  const [codigo, setCodigo] = useState('');
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState('');
  async function buscar(valor = codigo) {
    setError('');
    setOcupado('buscar');
    try {
      const r = await pedir<{ cobro: Cobro }>('POST', '/datos/agent/payouts/lookup', {
        codigo: valor,
      });
      setCobro(r.cobro);
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setOcupado('');
    }
  }
  async function escanear(archivo: File | undefined) {
    if (!archivo) return;
    setError('');
    setOcupado('qr');
    try {
      const leido = await leerQr(archivo);
      if (!leido) {
        setError(t.sinQr);
        return;
      }
      setCodigo(leido);
      await buscar(leido);
    } catch {
      setError(t.sinQr);
    } finally {
      setOcupado('');
    }
  }
  async function pagar() {
    if (!cobro || ocupado) return;
    setError('');
    setOcupado('pagar');
    try {
      const r = await pedir<{ recibo: Recibo }>(
        'POST',
        `/datos/agent/payouts/${encodeURIComponent(cobro.id)}/pay`,
        { codigo },
      );
      alTerminar(r.recibo);
    } catch (x) {
      setError(mensaje(x));
      setConfirmando(false);
    } finally {
      setOcupado('');
    }
  }
  const bs = cobro ? bolivares(cobro.refMonto, cobro.refTasa, idioma) : '';
  const entrega = cobro ? (cobro.pagaEn === 'VES' && bs ? bs : dinero(cobro.monto)) : '';
  return (
    <section className="agente-flujo" data-testid="agente-pagar">
      <h1>{t.pagarTitulo}</h1>
      {!cobro ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void buscar();
          }}
          noValidate
        >
          <p className="pista">{t.pagarPaso}</p>
          <div className="campo">
            <label htmlFor="agente-cobro-codigo">{t.codigoCobro}</label>
            <input
              id="agente-cobro-codigo"
              className="agente-codigo"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          <div className="agente-botones">
            <button
              type="submit"
              className="boton"
              disabled={codigo.length !== 6 || Boolean(ocupado)}
            >
              {ocupado === 'buscar' ? t.enviando : t.buscar}
            </button>
            <label className={`boton secundario agente-escanear${ocupado ? ' ocupado' : ''}`}>
              <ScanLine size={18} aria-hidden="true" />
              {ocupado === 'qr' ? t.escaneando : t.escanear}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={Boolean(ocupado)}
                onChange={(e) => {
                  void escanear(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <button type="button" className="enlace" onClick={alVolver}>
              {t.volver}
            </button>
          </div>
        </form>
      ) : (
        <div className="agente-ficha" data-testid="agente-cobro">
          <div className="agente-persona">
            <FotoConductor objeto={cobro.id} conFoto={cobro.conductor.conFoto} t={t} />
            <div>
              <small>{t.conductor}</small>
              <strong>{cobro.conductor.nombre}</strong>
              {cobro.conductor.telefonoFinal ? (
                <span>{t.telefonoFinal(cobro.conductor.telefonoFinal)}</span>
              ) : null}
              {cobro.conductor.conFoto ? <span className="pista">{t.revisaCara}</span> : null}
            </div>
          </div>
          <dl className="agente-montos">
            <div>
              <dt>{t.monto}</dt>
              <dd>{dinero(cobro.monto)}</dd>
            </div>
            <div className="entrega">
              <dt>{t.entregas}</dt>
              <dd data-testid="agente-entrega">{entrega}</dd>
            </div>
          </dl>
          <p className="pista">{t.vence(fecha(cobro.expiraEn, idioma))}</p>
          {!cobro.alcanzaFondo ? (
            <p className="error-general" role="alert">
              {t.noAlcanza}
            </p>
          ) : cobro.pasaTope ? (
            <p className="error-general" role="alert">
              {t.pasaTope}
            </p>
          ) : null}
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          {confirmando ? (
            <div className="agente-confirmar" data-testid="agente-confirmar">
              <p>{t.confirmaPago(entrega, cobro.conductor.nombre)}</p>
              <Deslizar
                texto={ocupado === 'pagar' ? t.pagando : t.desliza}
                ocupado={ocupado === 'pagar'}
                alCompletar={() => void pagar()}
              />
              <button type="button" className="enlace" onClick={() => setConfirmando(false)}>
                {t.volver}
              </button>
            </div>
          ) : (
            <div className="agente-botones">
              <button
                type="button"
                className="boton"
                data-testid="agente-ya-entregue"
                disabled={!cobro.alcanzaFondo || cobro.pasaTope}
                onClick={() => setConfirmando(true)}
              >
                {t.yaEntregue}
              </button>
              <button type="button" className="enlace" onClick={alVolver}>
                {t.cancelar}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Vender({
  t,
  idioma,
  yo,
  dinero,
  alTerminar,
  alVolver,
}: {
  t: T;
  idioma: Idioma;
  yo: Yo;
  dinero: (c: number) => string;
  alTerminar: (r: Recibo) => void;
  alVolver: () => void;
}) {
  const b = useBorrador({
    formulario: 'agente-vender',
    cuenta: yo.nombre,
    inicial: { telefono: '', codigo: '', monto: '' },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // Una llave por venta: repetir el toque (sin internet, doble clic) no vende dos veces.
  const idem = useRef(crypto.randomUUID());
  const centavos = Math.round(Number(v.monto.replace(',', '.')) * 100);
  const montoOk =
    Number.isSafeInteger(centavos) && centavos >= yo.ventaMinima && centavos <= yo.topeVenta;
  const bs =
    yo.pagaEn === 'VES' && yo.tasa && montoOk
      ? bolivares(Math.round(centavos * yo.tasa.tasa), yo.tasa.tasa, idioma)
      : '';
  const cobra = bs || (montoOk ? dinero(centavos) : '');
  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOcupado(true);
    try {
      const r = await pedir<{ conductor: Conductor }>('POST', '/datos/agent/drivers/find', {
        ...(v.codigo.trim() ? { codigo: v.codigo.trim() } : { telefono: v.telefono.trim() }),
      });
      setConductor(r.conductor);
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setOcupado(false);
    }
  }
  async function vender() {
    if (!conductor || !montoOk || ocupado) return;
    setError('');
    setOcupado(true);
    try {
      const r = await pedir<{ recibo: Recibo }>('POST', '/datos/agent/sales', {
        conductorId: conductor.id,
        monto: centavos,
        idem: idem.current,
      });
      await b.limpiar();
      alTerminar(r.recibo);
    } catch (x) {
      setError(mensaje(x));
      setRevisando(false);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="agente-flujo" data-testid="agente-vender">
      <h1>{t.venderTitulo}</h1>
      {b.recuperado ? (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezarDeNuevo}
          </button>
        </p>
      ) : null}
      {!conductor ? (
        <form onSubmit={buscar} noValidate>
          <p className="pista">{t.venderPaso}</p>
          <Campo
            etiqueta={t.telefono}
            tipo="tel"
            valor={v.telefono}
            cambiar={(x) => b.cambiar('telefono', x)}
            autoComplete="off"
            placeholder={t.telefono}
          />
          <Campo
            etiqueta={t.oCodigo}
            valor={v.codigo}
            cambiar={(x) => b.cambiar('codigo', x.toUpperCase())}
            autoComplete="off"
            placeholder={t.oCodigo}
          />
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          <div className="agente-botones">
            <button
              type="submit"
              className="boton"
              disabled={ocupado || (!v.telefono.trim() && !v.codigo.trim())}
            >
              {ocupado ? t.enviando : t.buscar}
            </button>
            <button type="button" className="enlace" onClick={alVolver}>
              {t.volver}
            </button>
          </div>
        </form>
      ) : (
        <div className="agente-ficha" data-testid="agente-venta">
          <div className="agente-persona">
            <FotoConductor objeto={conductor.id} conFoto={conductor.conFoto} t={t} />
            <div>
              <small>{t.conductor}</small>
              <strong>{conductor.nombre}</strong>
              {conductor.telefonoFinal ? (
                <span>{t.telefonoFinal(conductor.telefonoFinal)}</span>
              ) : null}
            </div>
          </div>
          {revisando ? (
            <div className="agente-confirmar" data-testid="agente-confirmar">
              <p>{t.confirmaVenta(cobra, conductor.nombre)}</p>
              {error ? (
                <p className="error-general" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="agente-botones">
                <button
                  type="button"
                  className="boton"
                  data-testid="agente-ya-cobre"
                  disabled={ocupado}
                  onClick={() => void vender()}
                >
                  {ocupado ? t.vendiendo : t.yaCobre}
                </button>
                <button type="button" className="enlace" onClick={() => setRevisando(false)}>
                  {t.volver}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (montoOk) setRevisando(true);
              }}
              noValidate
            >
              <Campo
                etiqueta={t.montoVenta}
                valor={v.monto}
                cambiar={(x) => b.cambiar('monto', x.replace(/[^\d.,]/g, ''))}
                autoComplete="off"
                placeholder="0.00"
              />
              <div className="agente-rapidos">
                {[500, 1000, 2000]
                  .filter((c) => c >= yo.ventaMinima && c <= yo.topeVenta)
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="boton secundario"
                      onClick={() => b.cambiar('monto', String(c / 100))}
                    >
                      {dinero(c)}
                    </button>
                  ))}
              </div>
              <p className="pista">{t.limites(dinero(yo.ventaMinima), dinero(yo.topeVenta))}</p>
              {cobra ? (
                <dl className="agente-montos">
                  <div className="entrega">
                    <dt>{t.cobras}</dt>
                    <dd data-testid="agente-cobra">{cobra}</dd>
                  </div>
                </dl>
              ) : null}
              {error ? (
                <p className="error-general" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="agente-botones">
                <button type="submit" className="boton" disabled={!montoOk}>
                  {t.revisar}
                </button>
                <button
                  type="button"
                  className="enlace"
                  onClick={() => {
                    setError('');
                    setConductor(null);
                  }}
                >
                  {t.otroConductor}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function VerRecibo({
  t,
  idioma,
  r,
  dinero,
  alCerrar,
}: {
  t: T;
  idioma: Idioma;
  r: Recibo;
  dinero: (c: number) => string;
  alCerrar: () => void;
}) {
  const bs = bolivares(r.refMonto, r.refTasa, idioma);
  return (
    <section className="agente-recibo" data-testid="agente-recibo">
      <h1>{r.tipo === 'pago' ? t.reciboPago : t.reciboVenta}</h1>
      <p className="agente-recibo-monto">{dinero(r.monto)}</p>
      {r.pagaEn === 'VES' && bs ? <p className="agente-recibo-bs">{bs}</p> : null}
      <dl>
        <div>
          <dt>{t.recibo}</dt>
          <dd>{r.numero}</dd>
        </div>
        <div>
          <dt>{t.conductor}</dt>
          <dd>{r.conductor}</dd>
        </div>
        <div>
          <dt>{t.fecha}</dt>
          <dd>{fecha(r.cuando, idioma)}</dd>
        </div>
        {r.fondo != null ? (
          <div>
            <dt>{t.fondoQueda}</dt>
            <dd>{dinero(r.fondo)}</dd>
          </div>
        ) : null}
        {r.saldoConductor != null ? (
          <div>
            <dt>{t.saldoConductor}</dt>
            <dd>{dinero(r.saldoConductor)}</dd>
          </div>
        ) : null}
        {r.deuda != null ? (
          <div>
            <dt>{t.deudaQueda}</dt>
            <dd>{dinero(r.deuda)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="pista">{t.avisoConductor}</p>
      <div className="agente-botones sin-imprimir">
        <button type="button" className="boton" onClick={alCerrar}>
          {t.listo}
        </button>
        <button type="button" className="boton secundario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> {t.imprimir}
        </button>
      </div>
    </section>
  );
}

function Historial({ t, idioma, dinero }: { t: T; idioma: Idioma; dinero: (c: number) => string }) {
  const [filas, setFilas] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    pedir<{ historial: Movimiento[] }>('GET', '/datos/agent/history')
      .then((r) => {
        if (vivo) setFilas(r.historial);
      })
      .catch((x: unknown) => {
        if (vivo) setError(mensaje(x));
      });
    return () => {
      vivo = false;
    };
  }, []);
  const nombre = (m: Movimiento) =>
    t.tipos[m.tipo === 'pago' || m.tipo === 'venta' ? m.tipo : m.concepto] ?? m.concepto;
  // Lo que sale del fondo (un pago) va con signo menos; lo que entra, sin signo.
  const monto = (m: Movimiento) =>
    m.tipo === 'pago' ? `−${dinero(m.monto)}` : dinero(Math.abs(m.monto));
  return (
    <section data-testid="agente-historial">
      <h1>{t.historial}</h1>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : !filas ? (
        <p className="pista">{t.cargando}</p>
      ) : filas.length === 0 ? (
        <p className="pista">{t.historialVacio}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla" aria-label={t.historial}>
            <thead>
              <tr>
                <th>{t.fecha}</th>
                <th>{t.tipo}</th>
                <th>{t.conductor}</th>
                <th>{t.monto}</th>
                <th>{t.recibo}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m, i) => (
                <tr key={`${m.tipo}-${m.numero}-${i}`}>
                  <td>{fecha(m.cuando, idioma)}</td>
                  <td>{nombre(m)}</td>
                  <td>{m.conductor}</td>
                  <td>{monto(m)}</td>
                  <td>{m.numero}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Ayuda({ t }: { t: T }) {
  return (
    <section className="agente-ayuda" data-testid="agente-ayuda">
      <h1>{t.ayudaTitulo}</h1>
      {t.guia.map((bloque) => (
        <article key={bloque.titulo}>
          <h2>{bloque.titulo}</h2>
          <ol>
            {bloque.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}

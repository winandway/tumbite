import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  PAISES_FLEX,
  REGISTRO_EMPRESA_VACIO,
  almacenNavegador,
  cuerposRegistro,
  enIdioma,
  faltaEnRegistro,
  numeroFiscalDe,
  paisFlex,
  useBorrador,
} from '@tumbite/compartido';
import { CampoDireccion } from '../../sitio/CampoDireccion';
import { Enlace } from '../../Enlace';
import { ir } from '../../ruta';
import { Campo } from '../CampoClave';
import { crear, pedir } from '../api';
import { TEXTOS_FLEX } from './textos';
import { Centros, Claves, Conductores, Equipo, Inicio, Perfil } from './Pantallas';
import {
  DetalleEnvio,
  DetallePaquete,
  Envios,
  Etiquetas,
  Importar,
  LotesRutas,
  NuevoEnvio,
  Paquetes,
} from './PantallasEnvios';
import { DetalleRutaOperativa, Devoluciones, Incidencias, RutasOperativas } from './PantallasRutas';
import { Integraciones, Operaciones, Vehiculos } from './PantallasFase3';
import { BilleteraEmpresa } from './PantallasBilletera';

export const BASE_FLEX = '/datos/v1/flex';
export type Empresa = {
  id: string;
  nombre: string;
  razonSocial: string;
  pais: string;
  moneda: string;
  estado: string;
  rol?: string;
  // C-EMPRESA-LEGAL: los datos legales (se editan en Perfil).
  numeroFiscal?: string | null;
  direccionFiscal?: string | null;
  representante?: string | null;
  telefono?: string | null;
};
export type Contexto = {
  empresa: Empresa;
  rol: string | null;
  permisos: string[];
  idioma: Idioma;
  t: (typeof TEXTOS_FLEX)['es'];
  raiz: string;
  recargar: () => void;
};

export const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

/**
 * Panel de Divoox Flex en /panel/business…: cualquier cuenta con sesión puede crear una empresa
 * o entrar a las que la invitaron. Lo que no es de la persona, el servidor lo responde 404 y
 * aquí se muestra como «no existe».
 */
export function PanelEmpresa({ ruta, idioma }: { ruta: string; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_FLEX, idioma);
  const sub = ruta.replace(/^\/panel\/business\/?/, '');
  if (sub === '') return <MisEmpresas idioma={idioma} />;
  const inv = /^invite\/([A-Za-z0-9_-]+)$/.exec(sub);
  if (inv?.[1]) return <AceptarInvitacion token={inv[1]} idioma={idioma} />;
  // eslint-disable-next-line security/detect-unsafe-regex -- id fijo de 36 caracteres y un resto opcional
  const m = /^([0-9a-f-]{36})(?:\/(.*))?$/.exec(sub);
  if (!m?.[1]) return <p role="alert">{t.noExiste}</p>;
  return <Empresa id={m[1]} sub={m[2] ?? ''} idioma={idioma} />;
}

function MisEmpresas({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(TEXTOS_FLEX, idioma);
  const [lista, setLista] = useState<Empresa[] | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const b = useBorrador({
    formulario: 'flex-empresa',
    inicial: REGISTRO_EMPRESA_VACIO,
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ empresas: Empresa[] }>('GET', `${BASE_FLEX}/empresas`)
      .then((r) => setLista(r.empresas))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, []);
  useEffect(cargar, [cargar]);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // C-FLEX-REGISTRO-UNICO: los mismos datos que pide la app, con la misma validación.
    const falta = faltaEnRegistro(b.valores, acepto);
    if (falta)
      return setError(
        falta.motivo === 'fiscal'
          ? t.registro.fiscalMal(falta.nombre ?? '', falta.ejemplo ?? '')
          : falta.motivo === 'centro'
            ? t.registro.elegirCentro
            : t.registro.falta,
      );
    setEnviando(true);
    try {
      const cuerpos = cuerposRegistro(b.valores);
      const r = await crear<{ empresa: Empresa }>(`${BASE_FLEX}/empresas`, cuerpos.empresa);
      await crear(`${BASE_FLEX}/empresas/${r.empresa.id}/centros`, cuerpos.centro);
      await b.limpiar();
      ir(`/panel/business/${r.empresa.id}`);
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }
  const v = b.valores;
  const fiscal = numeroFiscalDe(v.pais);
  return (
    <section className="super flex-panel">
      <h1>{t.flex}</h1>
      <h2>{t.misEmpresas}</h2>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {lista === null ? (
        <p>{t.cargando}</p>
      ) : lista.length === 0 ? (
        <p className="pista">{t.sinEmpresas}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((e) => (
            <li key={e.id}>
              <Enlace a={`/panel/business/${e.id}`}>
                <strong>{e.nombre}</strong>
              </Enlace>{' '}
              · {t.roles[e.rol ?? ''] ?? e.rol} · {e.pais} · {e.moneda}
            </li>
          ))}
        </ul>
      )}
      <h2>{t.crearEmpresa}</h2>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezarDeNuevo}
          </button>
        </p>
      )}
      <p className="pista">{t.registro.ayuda}</p>
      <form onSubmit={guardar} noValidate className="flex-form" data-testid="registro-empresa">
        <Campo
          etiqueta={t.nombreComercial}
          valor={v.nombre}
          cambiar={(x) => b.cambiar('nombre', x)}
          placeholder={t.nombreComercial}
        />
        <Campo
          etiqueta={t.razonSocial}
          valor={v.razonSocial}
          cambiar={(x) => b.cambiar('razonSocial', x)}
          placeholder={t.razonSocial}
        />
        <div className="campo">
          <label htmlFor="flex-pais">{t.pais}</label>
          <select
            id="flex-pais"
            value={v.pais}
            onChange={(e) => {
              b.cambiar('pais', e.target.value);
              b.cambiar('moneda', paisFlex(e.target.value).monedas[0]);
            }}
          >
            {PAISES_FLEX.map((p) => (
              <option key={p.id} value={p.id}>
                {idioma === 'en' ? p.en : p.es}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="flex-moneda">{t.moneda}</label>
          <select
            id="flex-moneda"
            value={v.moneda}
            onChange={(e) => b.cambiar('moneda', e.target.value)}
          >
            {paisFlex(v.pais).monedas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <Campo
          etiqueta={t.registro.fiscal(fiscal.nombre)}
          valor={v.numeroFiscal}
          cambiar={(x) => b.cambiar('numeroFiscal', x)}
          placeholder={fiscal.ejemplo}
        />
        <div className="campo">
          <label htmlFor="flex-direccion-fiscal">{t.registro.direccionFiscal}</label>
          <CampoDireccion
            id="flex-direccion-fiscal"
            valor={v.direccionFiscal}
            cambiar={(x) => b.cambiar('direccionFiscal', x)}
            alElegir={(d) => b.cambiar('direccionFiscal', d.direccion)}
            pais={v.pais}
            placeholder={t.registro.direccionFiscal}
          />
        </div>
        <Campo
          etiqueta={t.registro.representante}
          valor={v.representante}
          cambiar={(x) => b.cambiar('representante', x)}
          placeholder={t.registro.representante}
        />
        <Campo
          etiqueta={t.registro.telefono}
          tipo="tel"
          valor={v.telefono}
          cambiar={(x) => b.cambiar('telefono', x)}
          placeholder={t.registro.telefono}
        />
        <h3>{t.registro.centro}</h3>
        <Campo
          etiqueta={t.registro.centroNombre}
          valor={v.centroNombre}
          cambiar={(x) => b.cambiar('centroNombre', x)}
          placeholder={t.registro.centroNombre}
        />
        <div className="campo">
          <label htmlFor="flex-centro-direccion">{t.registro.centroDireccion}</label>
          <CampoDireccion
            id="flex-centro-direccion"
            valor={v.centroDireccion}
            cambiar={(x) => {
              b.cambiar('centroDireccion', x);
              // Si se cambia el texto, el punto elegido ya no vale.
              b.cambiar('centroLat', '');
              b.cambiar('centroLng', '');
            }}
            alElegir={(d) => {
              b.cambiar('centroDireccion', d.direccion);
              b.cambiar('centroLat', String(d.punto.lat));
              b.cambiar('centroLng', String(d.punto.lng));
            }}
            pais={v.pais}
            placeholder={t.registro.centroDireccion}
          />
        </div>
        <Campo
          etiqueta={t.registro.ciudad}
          valor={v.ciudad}
          cambiar={(x) => b.cambiar('ciudad', x)}
          placeholder={t.registro.ciudad}
        />
        <label className="casilla">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />{' '}
          {t.registro.acepto}
        </label>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? t.guardando : t.registro.crear}
        </button>
      </form>
    </section>
  );
}

function AceptarInvitacion({ token, idioma }: { token: string; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_FLEX, idioma);
  const [inv, setInv] = useState<{
    empresa: string;
    rol: string;
    estado: string;
    correoCoincide: boolean;
    correoConfirmado: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<string | null>(null);
  useEffect(() => {
    pedir<{ invitacion: typeof inv }>('GET', `${BASE_FLEX}/invitaciones/${token}`)
      .then((r) => setInv(r.invitacion))
      .catch((x: unknown) =>
        setError(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : mensajeDe(x)),
      );
  }, [token, t.noExiste]);
  async function aceptar() {
    setError('');
    try {
      const r = await pedir<{ empresaId: string }>(
        'POST',
        `${BASE_FLEX}/invitaciones/${token}/aceptar`,
        {},
      );
      setHecho(r.empresaId);
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <section className="super flex-panel">
      <h1>{t.invitacionTitulo}</h1>
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {hecho ? (
        <p>
          {t.invitacionAceptada}{' '}
          <Enlace a={`/panel/business/${hecho}`} className="boton">
            {t.irEmpresa}
          </Enlace>
        </p>
      ) : inv ? (
        <>
          <p>
            <strong>{inv.empresa}</strong> {t.invitacionDe}{' '}
            <strong>{t.roles[inv.rol] ?? inv.rol}</strong>.
          </p>
          {inv.estado !== 'pendiente' ? (
            <p className="pista">{t.estadosInvitacion[inv.estado] ?? inv.estado}</p>
          ) : !inv.correoCoincide ? (
            <p className="pista">{t.invitacionOtroCorreo}</p>
          ) : !inv.correoConfirmado ? (
            <p className="pista">
              {t.invitacionSinConfirmar}{' '}
              <button
                type="button"
                className="enlace"
                onClick={() => void pedir('POST', '/datos/cuentas/confirmar/reenviar', {})}
              >
                {t.reenviarConfirmacion}
              </button>
            </p>
          ) : (
            <button type="button" className="boton" onClick={() => void aceptar()}>
              {t.aceptar}
            </button>
          )}
        </>
      ) : (
        !error && <p>{t.cargando}</p>
      )}
    </section>
  );
}

type Ficha = {
  empresa: Empresa;
  rol: string | null;
  permisos: string[];
  resumen: Record<string, number>;
};

function Empresa({ id, sub, idioma }: { id: string; sub: string; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_FLEX, idioma);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<Ficha>('GET', `${BASE_FLEX}/empresas/${id}`)
      .then(setFicha)
      .catch((x: unknown) =>
        setError(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : mensajeDe(x)),
      );
  }, [id, t.noExiste]);
  useEffect(cargar, [cargar]);
  if (!ficha) return <p role={error ? 'alert' : 'status'}>{error || t.cargando}</p>;
  const raiz = `/panel/business/${id}`;
  const ctx: Contexto = {
    empresa: ficha.empresa,
    rol: ficha.rol,
    permisos: ficha.permisos,
    idioma,
    t,
    raiz,
    recargar: cargar,
  };
  const puede = (p: string) => ficha.permisos.includes(p);
  // C-FLEX-MENU-GRUPOS (1 nov 2026): el menú en tres grupos, como los paneles de Onfleet y Spoke:
  // lo de cada día arriba, la configuración aparte y lo demás al final.
  const item = (clave: string, permiso?: string): [string, string][] =>
    !permiso || puede(permiso)
      ? [[clave, new Map(Object.entries(t.menu)).get(clave) ?? clave]]
      : [];
  const grupos: [string, [string, string][]][] = [
    [
      'dia',
      [
        ...item('home'),
        ...item('shipments'),
        ...item('operativas'),
        ...item('labels'),
        ...item('returns'),
        ...item('incidents'),
      ],
    ],
    [
      'config',
      [
        ...item('hubs'),
        ...item('drivers', 'conductores.gestionar'),
        ...item('vehicles', 'conductores.gestionar'),
        ...item('team', 'miembros.gestionar'),
        ...item('profile'),
      ],
    ],
    [
      'mas',
      [
        ...item('packages'),
        ...item('import', 'importar'),
        ...item('operations'),
        ...item('integrations', 'integraciones.gestionar'),
        ...item('wallet', 'finanzas.ver'),
        ...item('keys', 'claves.gestionar'),
      ],
    ],
  ];

  const seccion = sub.split('/')[0] ?? '';
  let contenido: React.ReactNode;
  const envioId = /^shipments\/([0-9a-f-]{36})$/.exec(sub)?.[1];
  const paqueteId = /^packages\/([0-9a-f-]{36})$/.exec(sub)?.[1];
  const rutaOperativaId = /^operativas\/([0-9a-f-]{36})$/.exec(sub)?.[1];
  if (sub === '') contenido = <Inicio ctx={ctx} resumen={ficha.resumen} />;
  else if (sub === 'profile') contenido = <Perfil ctx={ctx} />;
  else if (sub === 'hubs') contenido = <Centros ctx={ctx} />;
  else if (sub === 'team') contenido = <Equipo ctx={ctx} />;
  else if (sub === 'drivers') contenido = <Conductores ctx={ctx} />;
  else if (sub === 'shipments') contenido = <Envios ctx={ctx} />;
  else if (sub === 'shipments/new') contenido = <NuevoEnvio ctx={ctx} />;
  else if (envioId) contenido = <DetalleEnvio ctx={ctx} envioId={envioId} />;
  else if (sub === 'packages') contenido = <Paquetes ctx={ctx} />;
  else if (paqueteId) contenido = <DetallePaquete ctx={ctx} paqueteId={paqueteId} />;
  else if (sub === 'import') contenido = <Importar ctx={ctx} />;
  else if (sub === 'labels') contenido = <Etiquetas ctx={ctx} />;
  else if (sub === 'routes') contenido = <LotesRutas ctx={ctx} />;
  else if (sub === 'operativas') contenido = <RutasOperativas ctx={ctx} />;
  else if (rutaOperativaId) contenido = <DetalleRutaOperativa ctx={ctx} rutaId={rutaOperativaId} />;
  else if (sub === 'returns') contenido = <Devoluciones ctx={ctx} />;
  else if (sub === 'incidents') contenido = <Incidencias ctx={ctx} />;
  else if (sub === 'operations') contenido = <Operaciones ctx={ctx} />;
  else if (sub === 'vehicles') contenido = <Vehiculos ctx={ctx} />;
  else if (sub === 'integrations') contenido = <Integraciones ctx={ctx} />;
  else if (sub === 'wallet' || sub.startsWith('wallet/'))
    contenido = <BilleteraEmpresa ctx={ctx} sub={sub} />;
  else if (sub === 'keys') contenido = <Claves ctx={ctx} />;
  else contenido = <p role="alert">{t.noExiste}</p>;
  return (
    <div className="panel-cuerpo flex-panel">
      <nav className="panel-menu" aria-label={t.flex}>
        <Enlace a="/panel/business" className="flex-volver">
          {t.volver}
        </Enlace>
        <p className="flex-nombre">
          <strong>{ficha.empresa.nombre}</strong>
          <br />
          <small>{t.roles[ficha.rol ?? ''] ?? ficha.rol}</small>
        </p>
        {grupos.map(([grupo, items]) => (
          <div key={grupo} className="flex-menu-grupo">
            <p className="flex-menu-titulo">{new Map(Object.entries(t.grupos)).get(grupo)}</p>
            {items.map(([clave, texto]) => {
              const destino = clave === 'home' ? raiz : `${raiz}/${clave}`;
              // «Nueva ruta» vive dentro de «Rutas».
              const activo =
                clave === 'home'
                  ? sub === ''
                  : seccion === clave || (clave === 'operativas' && seccion === 'routes');
              return (
                <Enlace key={clave} a={destino} className={activo ? 'activo' : undefined}>
                  {texto}
                </Enlace>
              );
            })}
          </div>
        ))}
      </nav>
      <main className="panel-contenido">{contenido}</main>
    </div>
  );
}

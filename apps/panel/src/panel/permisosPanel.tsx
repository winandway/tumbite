import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Alcance,
  type Idioma,
  LIBRE,
  type PermisoRuta,
  PERMISOS_DELICADOS,
  almacenNavegador,
  enIdioma,
  ErrorApi,
  useBorrador,
} from '@tumbite/compartido';
import type { GrupoMenu } from './armazon/menus';
import { pedir } from './api';

/**
 * C-PERMISOS-FINOS (MON-5, 15 nov 2026) — todos los países. El panel recibe del servidor los permisos
 * efectivos de quien entró (`GET /datos/admin/equipo/yo`) y esconde lo que no puede usar: menú,
 * botones de soporte, «Ver foto», «Ver dato». `puedeVer(permiso)` es la única pregunta que hacen las
 * pantallas. Esconder es comodidad: quien frena de verdad es el servidor.
 */
export type AccesoPanel = {
  id: string;
  permisos: string[];
  fuentes: Record<string, string[]>;
  alcance: Alcance;
  dueno: boolean;
  origen: string;
  segundoFactor: { activo: boolean; vigente: boolean };
};

type ValorPermisos = {
  acceso: AccesoPanel | null;
  cargando: boolean;
  puedeVer: (permiso: PermisoRuta) => boolean;
  recargar: () => void;
};

/**
 * Fuera del panel del equipo (sin proveedor) no se sabe nada de permisos: no se esconde nada y el
 * servidor decide. Dentro, `PanelApp` reparte los permisos efectivos de la sesión.
 */
const SIN_ACCESO: ValorPermisos = {
  acceso: null,
  cargando: false,
  puedeVer: () => true,
  recargar: () => undefined,
};
export const PermisosContexto = createContext<ValorPermisos>(SIN_ACCESO);

/** Lo usa PanelApp una vez por sesión del equipo y lo reparte con `PermisosContexto`. */
export function useAccesoInterno(activo: boolean): ValorPermisos {
  const [acceso, setAcceso] = useState<AccesoPanel | null>(null);
  const [cargando, setCargando] = useState(activo);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    pedir<AccesoPanel>('GET', '/datos/admin/equipo/yo')
      .then((a) => {
        if (vivo) setAcceso(a);
      })
      .catch((e: unknown) => {
        console.warn('equipo: no se pudieron leer mis permisos', e);
        if (vivo) setAcceso(null);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [activo, vuelta]);
  const puedeVer = useCallback(
    (permiso: PermisoRuta) => permiso === LIBRE || !!acceso?.permisos.includes(permiso),
    [acceso],
  );
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return useMemo(
    () => ({ acceso, cargando, puedeVer, recargar }),
    [acceso, cargando, puedeVer, recargar],
  );
}

/** `const { puedeVer } = usePermisos()` en cualquier pantalla del superadmin. */
export function usePermisos(): ValorPermisos {
  return useContext(PermisosContexto);
}

/**
 * Qué permiso pide cada sección del menú del superadmin. Una sección que no está aquí se muestra
 * (la ruta del servidor igual exige su permiso): así una sección nueva nunca desaparece por error.
 */
const PERMISO_DE_SECCION: Readonly<Record<string, PermisoRuta | PermisoRuta[]>> = {
  inicio: 'monitoreo.ver',
  orders: 'pedidos.ver',
  tickets: 'tickets.ver',
  // C-MODERACION: la bandeja de reportes de mensajes y reseñas.
  moderation: 'tickets.ver',
  approvals: ['dinero.solicitar', 'dinero.ver', 'dinero.aprobar'],
  verifications: 'kyc.ver',
  customers: 'clientes.ver',
  restaurants: 'restaurantes.ver',
  drivers: 'repartidores.ver',
  // «Equipo interno» guarda también «Mis avisos por correo»: lo ve quien elige sus avisos.
  team: ['equipo.ver', 'avisos.recibir'],
  money: 'dinero.ver',
  cash: 'dinero.ver',
  flexfinance: 'dinero.ver',
  reports: 'monitoreo.exportar',
  rides: 'viajes.ver',
  moto: 'viajes.ver',
  rewards: 'config.ver',
  pilot: 'config.ver',
  'test-city': 'config.ver',
  franchises: 'config.ver',
  cities: 'config.ver',
  zones: 'config.ver',
  waitlist: 'restaurantes.ver',
  settings: LIBRE,
};

export function seccionPermitida(clave: string, puedeVer: (p: PermisoRuta) => boolean): boolean {
  const pide = new Map(Object.entries(PERMISO_DE_SECCION)).get(clave);
  if (!pide) return true;
  return (Array.isArray(pide) ? pide : [pide]).some((p) => puedeVer(p));
}

export function filtrarMenu(
  grupos: GrupoMenu[],
  puedeVer: (p: PermisoRuta) => boolean,
): GrupoMenu[] {
  return grupos
    .map((g) => ({ ...g, items: g.items.filter((i) => seccionPermitida(i.clave, puedeVer)) }))
    .filter((g) => g.items.length > 0);
}

// ─────────────────────────────── Segundo factor ───────────────────────────────

const T2 = {
  es: {
    franja: 'Para ver fotos, datos personales o mover dinero, confirma que eres tú con un código.',
    pedir: 'Mandarme el código',
    codigo: 'Código de 6 números',
    confirmar: 'Confirmar',
    enviado: 'Te mandamos el código a tu correo. Vence en 10 minutos.',
    listo: 'Listo: confirmado por 12 horas en este navegador.',
    prueba: 'Sitio de pruebas: el código es',
  },
  en: {
    franja: 'To see photos, personal data or move money, confirm it’s you with a code.',
    pedir: 'Email me the code',
    codigo: '6-digit code',
    confirmar: 'Confirm',
    enviado: 'We emailed you the code. It expires in 10 minutes.',
    listo: 'Done: confirmed for 12 hours in this browser.',
    prueba: 'Test site: the code is',
  },
};

/** Pide y confirma el código del segundo factor (lo usan la franja, «Ver foto» y «Ver dato»). */
export function ConfirmarCodigo({
  idioma,
  alConfirmar,
}: {
  idioma: Idioma;
  alConfirmar: () => void;
}) {
  const t = enIdioma(T2, idioma);
  const [paso, setPaso] = useState<'inicio' | 'enviado'>('inicio');
  // El código es de un solo uso: el borrador lo marca sensible y no lo guarda nunca.
  const b = useBorrador({
    formulario: 'equipo-segundo-factor',
    inicial: { codigo: '' },
    almacen: almacenNavegador,
    sensibles: ['codigo'],
  });
  const codigo = b.valores.codigo;
  const setCodigo = (v: string) => b.cambiar('codigo', v);
  const [prueba, setPrueba] = useState('');
  const [error, setError] = useState('');
  async function pedirCodigo() {
    setError('');
    try {
      const r = await pedir<{ codigoPrueba?: string }>(
        'POST',
        '/datos/equipo-interno/segundo-factor/pedir',
        {},
      );
      setPrueba(r.codigoPrueba ?? '');
      setPaso('enviado');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await pedir('POST', '/datos/equipo-interno/segundo-factor/verificar', { codigo });
      alConfirmar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div className="eq-codigo">
      {paso === 'inicio' ? (
        <button type="button" className="boton chico" onClick={() => void pedirCodigo()}>
          {t.pedir}
        </button>
      ) : (
        <form onSubmit={confirmar} className="eq-codigo-form">
          <span className="pista">
            {t.enviado}
            {prueba ? ` ${t.prueba} ${prueba}.` : ''}
          </span>
          <input
            aria-label={t.codigo}
            placeholder={t.codigo}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="boton chico" disabled={codigo.length !== 6}>
            {t.confirmar}
          </button>
        </form>
      )}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Franja discreta arriba del contenido cuando el segundo factor está encendido, la persona tiene
 * algún permiso delicado y todavía no confirmó en esta sesión. Nunca una ventana que tape.
 */
export function FranjaSegundoFactor({ idioma }: { idioma: Idioma }) {
  const { acceso, recargar } = usePermisos();
  const t = enIdioma(T2, idioma);
  if (!acceso?.segundoFactor.activo || acceso.segundoFactor.vigente) return null;
  if (!acceso.permisos.some((p) => (PERMISOS_DELICADOS as readonly string[]).includes(p)))
    return null;
  return (
    <div className="eq-franja" role="status">
      <span>{t.franja}</span>
      <ConfirmarCodigo idioma={idioma} alConfirmar={recargar} />
    </div>
  );
}

import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  correoEjemplo,
  enIdioma,
  pareceCorreo,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { MenuTresPuntos } from './MenuTresPuntos';
import { AvisoBorrador } from './AvisoBorrador';
import { Campo } from './CampoClave';
import { ConfirmarCodigo, usePermisos } from './permisosPanel';
import { SugerenciaCorreo } from './SugerenciaCorreo';
import { AyudaAqui } from './AyudaAqui';
import { fechaSuper } from './horario';

/**
 * C-CORREGIR-CORREO (20 nov 2026, pedido de Richard): en la ficha de cliente, conductor y dueño de
 * restaurante, soporte ve el estado del correo (confirmado, sin confirmar o rebotado) y, en los tres
 * puntos, «Corregir correo» y «Reenviar confirmación». Lo usa quien tiene `clientes.corregir_correo`
 * (Soporte nivel 2, Supervisor y Total).
 */
export type EstadoCorreo = 'confirmado' | 'sin_confirmar' | 'rebotado' | 'frenado';
export type CambioCorreo = {
  accion: string;
  fecha: string;
  quien: string;
  antes: string;
  despues: string;
  enviado: boolean;
};

const T = {
  es: {
    confirmado: 'Confirmado',
    sin_confirmar: 'Sin confirmar',
    rebotado: 'El correo rebotó: el buzón no existe o está bloqueado',
    // C-REBOTE-TEMPORAL: el proveedor frenó la dirección por un rechazo temporal (no es un buzón muerto).
    frenado: 'Correo frenado unas horas por un rechazo temporal; se puede volver a mandar mañana',
    corregir: 'Corregir correo',
    reenviar: 'Reenviar confirmación',
    reenviarDisculpa: 'Reenviar con disculpa (si el fallo fue nuestro)',
    titulo: 'Corregir el correo de la cuenta',
    explica:
      'La cuenta queda sin confirmar y le mandamos el enlace de confirmación al correo nuevo. Queda en el registro con tu nombre.',
    correoNuevo: 'Correo nuevo',
    motivo: 'Motivo (queda en el registro)',
    guardar: 'Guardar y mandar la confirmación',
    cancelar: 'Cancelar',
    invalido: 'Escribe un correo válido, por ejemplo nombre@dominio.com.',
    listo: 'Correo corregido. Le mandamos el enlace de confirmación.',
    listoSinEnvio: 'Correo corregido, pero el enlace no salió:',
    reenviado: 'Le mandamos otra vez el enlace de confirmación.',
    historial: 'Cambios del correo',
    corregido: 'corrigió el correo',
    reenvio: 'reenvió la confirmación',
    noSalio: '(el enlace no salió)',
    quitarRebote: 'Quitar el rebote (el buzón ya recibe)',
    reboteQuitado: 'Quitamos el rebote. Ya puedes reenviar la confirmación.',
    quitoRebote: 'quitó el rebote',
    yaConfirmado:
      'Esta cuenta ya confirmó su correo; el cambio lo hace la persona desde su app, con su contraseña.',
  },
  en: {
    confirmado: 'Confirmed',
    sin_confirmar: 'Not confirmed',
    rebotado: 'The email bounced: the mailbox doesn’t exist or is blocked',
    frenado:
      'Email paused for a few hours after a temporary rejection; it can be sent again tomorrow',
    corregir: 'Fix email',
    reenviar: 'Resend confirmation',
    reenviarDisculpa: 'Resend with an apology (if the issue was ours)',
    titulo: 'Fix the account’s email',
    explica:
      'The account becomes unconfirmed and we send the confirmation link to the new email. It’s logged with your name.',
    correoNuevo: 'New email',
    motivo: 'Reason (kept in the log)',
    guardar: 'Save and send the confirmation',
    cancelar: 'Cancel',
    invalido: 'Enter a valid email, for example name@domain.com.',
    listo: 'Email fixed. We sent the confirmation link.',
    listoSinEnvio: 'Email fixed, but the link didn’t go out:',
    reenviado: 'We sent the confirmation link again.',
    historial: 'Email changes',
    corregido: 'fixed the email',
    reenvio: 'resent the confirmation',
    noSalio: '(the link didn’t go out)',
    quitarRebote: 'Remove the bounce (the mailbox receives now)',
    reboteQuitado: 'We removed the bounce. You can resend the confirmation now.',
    quitoRebote: 'removed the bounce',
    yaConfirmado:
      'This account already confirmed its email; the person changes it from their app, with their password.',
  },
};

/** La insignia del estado del correo, al lado del correo en la ficha. */
export function EstadoDelCorreo({ estado, idioma }: { estado?: EstadoCorreo; idioma: Idioma }) {
  if (!estado) return null;
  const t = enIdioma(T, idioma);
  const clase =
    estado === 'confirmado'
      ? 'insignia insignia-aprobado'
      : estado === 'rebotado'
        ? 'insignia insignia-rechazado'
        : estado === 'frenado'
          ? 'insignia insignia-pendiente'
          : 'insignia';
  return (
    <span className={clase} data-testid="estado-correo">
      {/* eslint-disable-next-line security/detect-object-injection -- llave fija del tipo */}
      {t[estado]}
    </span>
  );
}

/**
 * Las opciones de los tres puntos (solo con el permiso). «Corregir correo» sale solo si la cuenta no
 * confirmó o si su correo rebotó: cambiar el de una cuenta confirmada sería una toma de cuenta (el
 * servidor lo rechaza igual) y lo hace la persona desde su app. Con rebote, «Quitar el rebote».
 */
export function opcionesCorreo(
  puede: boolean,
  idioma: Idioma,
  abrir: () => void,
  reenviar: (disculpa: boolean) => void,
  estado?: EstadoCorreo,
  quitarRebote?: () => void,
) {
  if (!puede || estado === 'confirmado') return [];
  const t = enIdioma(T, idioma);
  return [
    { texto: t.corregir, alTocar: abrir },
    { texto: t.reenviar, alTocar: () => reenviar(false) },
    { texto: t.reenviarDisculpa, alTocar: () => reenviar(true) },
    ...(estado === 'rebotado' && quitarRebote
      ? [{ texto: t.quitarRebote, alTocar: quitarRebote }]
      : []),
  ];
}

export function usePuedeCorregirCorreo(): boolean {
  return usePermisos().puedeVer('clientes.corregir_correo');
}

/** Reenviar la confirmación; devuelve el texto para mostrar (éxito o el motivo del fallo). */
export async function reenviarConfirmacion(
  usuarioId: string,
  idioma: Idioma,
  disculpa = false,
): Promise<{ ok: boolean; texto: string; segundoFactor?: boolean }> {
  const t = enIdioma(T, idioma);
  try {
    await pedir('POST', `/datos/admin/usuarios/${usuarioId}/confirmacion`, { disculpa });
    return { ok: true, texto: t.reenviado };
  } catch (x) {
    if (x instanceof ErrorApi && x.campo === 'segundo_factor')
      return { ok: false, texto: '', segundoFactor: true };
    return { ok: false, texto: x instanceof ErrorApi ? x.message : String(x) };
  }
}

/** El formulario «Corregir correo», con borrador (la regla: ningún formulario pierde lo escrito). */
export function FormCorregirCorreo({
  usuarioId,
  idioma,
  alCerrar,
  alGuardar,
}: {
  usuarioId: string;
  idioma: Idioma;
  alCerrar: () => void;
  alGuardar: (texto: string) => void;
}) {
  const t = enIdioma(T, idioma);
  const { recargar } = usePermisos();
  const b = useBorrador({
    formulario: `corregir-correo-${usuarioId}`,
    inicial: { correo: '', motivo: '' },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [pideCodigo, setPideCodigo] = useState(false);

  async function guardar() {
    setError('');
    const correo = v.correo.trim().toLowerCase();
    if (!pareceCorreo(correo)) return setError(t.invalido);
    setOcupado(true);
    try {
      const r = await pedir<{ correoEnviado: boolean; aviso: string | null }>(
        'POST',
        `/datos/admin/usuarios/${usuarioId}/correo`,
        { correo, motivo: v.motivo.trim() },
      );
      await b.limpiar();
      alGuardar(r.correoEnviado ? t.listo : `${t.listoSinEnvio} ${r.aviso ?? ''}`);
    } catch (x) {
      // Si falla, lo escrito se queda para corregir y reintentar.
      if (x instanceof ErrorApi && x.campo === 'segundo_factor') setPideCodigo(true);
      else setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form
      className="formulario tarjeta-form"
      noValidate
      data-testid="form-corregir-correo"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <h3>
        {t.titulo} <AyudaAqui guia="fix-account-email" idioma={idioma} />
      </h3>
      <p className="pista">{t.explica}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <Campo
        casilla="correo"
        etiqueta={t.correoNuevo}
        tipo="email"
        valor={v.correo}
        cambiar={(x) => b.cambiar('correo', x)}
        autoComplete="off"
        placeholder={correoEjemplo(idioma)}
        error={error || undefined}
      />
      <SugerenciaCorreo correo={v.correo} idioma={idioma} aceptar={(x) => b.cambiar('correo', x)} />
      <Campo
        etiqueta={t.motivo}
        valor={v.motivo}
        cambiar={(x) => b.cambiar('motivo', x)}
        autoComplete="off"
      />
      {pideCodigo ? (
        <ConfirmarCodigo
          idioma={idioma}
          alConfirmar={() => {
            setPideCodigo(false);
            recargar();
            void guardar();
          }}
        />
      ) : null}
      <button type="submit" className="boton" disabled={ocupado}>
        {t.guardar}
      </button>{' '}
      <button type="button" className="enlace" onClick={alCerrar}>
        {t.cancelar}
      </button>
    </form>
  );
}

/** La línea de tiempo de los cambios del correo (quién, cuándo, antes y después enmascarados). */
export function HistorialCorreo({ lista, idioma }: { lista?: CambioCorreo[]; idioma: Idioma }) {
  if (!lista?.length) return null;
  const t = enIdioma(T, idioma);
  return (
    <div className="tarjeta-form" data-testid="historial-correo">
      <h2>{t.historial}</h2>
      <ul className="super-lista">
        {lista.map((h) => (
          <li key={`${h.fecha}-${h.accion}-${h.despues}`}>
            {fechaSuper(h.fecha, idioma)} · <strong>{h.quien}</strong>{' '}
            {h.accion === 'correo_corregido'
              ? t.corregido
              : h.accion === 'rebote_quitado'
                ? t.quitoRebote
                : t.reenvio}
            {h.antes ? ` · ${h.antes} → ${h.despues}` : h.despues ? ` · ${h.despues}` : ''}
            {h.enviado ? '' : ` ${t.noSalio}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Lo que va al lado del correo en la ficha: el estado y, en sus tres puntos, «Corregir correo» y
 * «Reenviar confirmación» (solo con el permiso). Lo usan las fichas de cliente, conductor y restaurante.
 */
export function AccionesCorreo({
  usuarioId,
  estado,
  idioma,
  recargar,
}: {
  usuarioId: string;
  estado?: EstadoCorreo;
  idioma: Idioma;
  recargar: () => void;
}) {
  const puede = usePuedeCorregirCorreo();
  const { recargar: recargarPermisos } = usePermisos();
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pideCodigo, setPideCodigo] = useState(false);
  const [conDisculpa, setConDisculpa] = useState(false);
  // Qué repetir después del segundo factor: el reenvío o quitar el rebote.
  const [repetir, setRepetir] = useState<'reenviar' | 'rebote'>('reenviar');
  async function reenviar(disculpa = conDisculpa) {
    setAviso(null);
    setConDisculpa(disculpa);
    const r = await reenviarConfirmacion(usuarioId, idioma, disculpa);
    if (r.segundoFactor) {
      setRepetir('reenviar');
      return setPideCodigo(true);
    }
    setAviso(r);
    recargar();
  }
  async function quitarRebote() {
    setAviso(null);
    const t = enIdioma(T, idioma);
    try {
      await pedir('POST', `/datos/admin/usuarios/${usuarioId}/rebote/quitar`, {});
      setAviso({ ok: true, texto: t.reboteQuitado });
      recargar();
    } catch (x) {
      if (x instanceof ErrorApi && x.campo === 'segundo_factor') {
        setRepetir('rebote');
        return setPideCodigo(true);
      }
      setAviso({ ok: false, texto: x instanceof ErrorApi ? x.message : String(x) });
    }
  }
  const opciones = opcionesCorreo(
    puede,
    idioma,
    () => setAbierto(true),
    (x) => void reenviar(x),
    estado,
    () => void quitarRebote(),
  );
  return (
    <>
      {' '}
      <EstadoDelCorreo estado={estado} idioma={idioma} />
      {opciones.length ? (
        <MenuTresPuntos etiqueta={enIdioma(T, idioma).corregir} opciones={opciones} />
      ) : null}
      {puede && estado === 'confirmado' ? (
        <span className="pista" data-testid="correo-ya-confirmado">
          {' '}
          {enIdioma(T, idioma).yaConfirmado}
        </span>
      ) : null}
      {aviso ? (
        <span className={aviso.ok ? 'pista' : 'error-campo'} role={aviso.ok ? 'status' : 'alert'}>
          {' '}
          {aviso.texto}
        </span>
      ) : null}
      {pideCodigo ? (
        <ConfirmarCodigo
          idioma={idioma}
          alConfirmar={() => {
            setPideCodigo(false);
            recargarPermisos();
            void (repetir === 'rebote' ? quitarRebote() : reenviar());
          }}
        />
      ) : null}
      {abierto ? (
        <VentanaCorreo alCerrar={() => setAbierto(false)}>
          <FormCorregirCorreo
            usuarioId={usuarioId}
            idioma={idioma}
            alCerrar={() => setAbierto(false)}
            alGuardar={(texto) => {
              setAbierto(false);
              setAviso({ ok: true, texto });
              recargar();
            }}
          />
        </VentanaCorreo>
      ) : null}
    </>
  );
}

/**
 * El formulario va en su propia capa, centrado y con velo: dentro de la columna del correo no cabía.
 * Se cierra con Escape o tocando fuera (lo escrito queda en el borrador).
 */
function VentanaCorreo({ alCerrar, children }: { alCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alCerrar]);
  return createPortal(
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16,16,16,0.4)',
          border: 0,
          zIndex: 1000,
          cursor: 'default',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          zIndex: 1001,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

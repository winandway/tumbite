import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Text } from './diseno';
import { ActivityIndicator, AppState, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enIdioma, useBorrador } from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { AvisoBorrador } from './AvisoBorrador';
import { SugerenciaCorreo } from './SugerenciaCorreo';
import { ConfirmarBorrado } from './OpcionesCuenta';
import { useSesion } from './sesion';
import { Boton, C, Campo, CampoClave } from './ui';

const T = {
  es: {
    titulo: 'Confirma tu correo',
    enviamos: 'Te mandamos un enlace a',
    abrelo: 'Ábrelo en este teléfono para activar tu cuenta. Esta pantalla se actualiza sola.',
    spam: '¿No te llegó? Mira en la carpeta de correo no deseado (spam) y revisa que el correo de arriba esté bien escrito.',
    rebotado:
      'No pudimos entregar el correo a esta dirección: no existe o no recibe mensajes. Revisa que esté bien escrita y cámbiala aquí abajo.',
    enviadoNuevo: 'Listo. Te mandamos el enlace a tu correo nuevo.',
    reenviar: 'Mandar el enlace otra vez',
    reenviado: 'Te lo mandamos otra vez. Puede tardar un minuto.',
    yaLoHice: 'Ya lo confirmé',
    todavia: 'Todavía no vemos tu correo confirmado. Toca el enlace del correo y vuelve aquí.',
    cambiar: '¿Correo equivocado? Cámbialo',
    correoNuevo: 'Correo nuevo',
    clave: 'Tu contraseña, para confirmar',
    guardar: 'Cambiar el correo y mandar el enlace',
    cancelar: 'Cancelar',
    salir: 'Cerrar sesión',
    borrar: 'Borrar esta cuenta',
    sinConexion:
      'No pudimos comprobar tu correo. Revisa tu conexión; lo intentamos de nuevo solos.',
    verificado: 'Tu correo quedó verificado',
    verificadoDetalle: 'Listo, tu cuenta está activa. Ya puedes pedir en Divoox.',
    continuar: 'Continuar',
  },
  en: {
    titulo: 'Confirm your email',
    enviamos: 'We sent a link to',
    abrelo: 'Open it on this phone to activate your account. This screen updates on its own.',
    spam: 'Don’t see it? Check your spam or junk folder, and make sure the email above is spelled right.',
    rebotado:
      'We couldn’t deliver the email to this address: it doesn’t exist or can’t receive mail. Check the spelling and change it below.',
    enviadoNuevo: 'Done. We sent the link to your new email.',
    reenviar: 'Send the link again',
    reenviado: 'We sent it again. It can take a minute.',
    yaLoHice: 'I already confirmed it',
    todavia: 'We don’t see your email confirmed yet. Tap the link in the email and come back here.',
    cambiar: 'Wrong email? Change it',
    correoNuevo: 'New email',
    clave: 'Your password, to confirm',
    guardar: 'Change email and send the link',
    cancelar: 'Cancel',
    salir: 'Sign out',
    borrar: 'Delete this account',
    sinConexion: 'We couldn’t check your email. Check your connection; we’ll keep trying.',
    verificado: 'Your email is verified',
    verificadoDetalle: 'You’re all set. Your account is active and you can start ordering.',
    continuar: 'Continue',
  },
};

/** Cada cuántos segundos se vuelve a mirar si la persona ya tocó el enlace. */
export const CADA_MS_COMPROBAR_CORREO = 4000;

type Perfil = {
  correo: string;
  /** La puerta que frena (desde C-CORREO-NO-FRENA, solo sin el celular confirmado). */
  debeConfirmarCorreo?: boolean;
  /** C-CORREO-NO-FRENA: falta confirmarlo (la franja lo pide sin frenar). */
  correoPorConfirmar?: boolean;
  correoRebotado?: boolean;
};

/**
 * C-CORREO-OBLIGATORIO (4 nov 2026, Richard grabando el video para Apple): la app del cliente no
 * deja entrar hasta que la persona confirma su correo. Muestra «Confirma tu correo» con la dirección,
 * mira sola si ya lo confirmó (al volver a la app desde el correo y cada pocos segundos), y al
 * confirmarlo dice «Tu correo quedó verificado» antes de entrar. Si el correo está mal escrito, se
 * cambia aquí mismo con la contraseña. Una cuenta ya confirmada entra directo, sin ver nada.
 *
 * C-CORREO-NO-FRENA (23 nov 2026, decisión de Richard): el servidor solo la cierra (`debeConfirmarCorreo`)
 * si la cuenta tampoco tiene el celular confirmado con el código; con el celular confirmado, el correo
 * se pide en segundo plano con la franja (`AvisoCorreo`) y no frena nada.
 */
export function PuertaCorreo({ children }: { children: ReactNode }) {
  const { api, usuario } = useSesion();
  const [estado, setEstado] = useState<'mirando' | 'falta' | 'verificado' | 'dentro'>('mirando');
  const [correo, setCorreo] = useState(usuario?.correo ?? '');
  // C-CORREO-HONESTO: el servidor sabe si esa dirección rebotó (no existe o no recibe).
  const [rebotado, setRebotado] = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  const comprobar = useCallback(async () => {
    try {
      const r = await api.pedir<{ perfil: Perfil }>('GET', '/datos/cuentas/perfil');
      setSinConexion(false);
      setCorreo(r.perfil.correo);
      setRebotado(r.perfil.correoRebotado === true);
      const debe = r.perfil.debeConfirmarCorreo === true;
      setEstado((e) => {
        if (!debe) return e === 'falta' ? 'verificado' : e === 'verificado' ? e : 'dentro';
        return e === 'dentro' ? e : 'falta';
      });
      return !debe;
    } catch {
      setSinConexion(true);
      return false;
    }
  }, [api]);

  useEffect(() => {
    const primero = setTimeout(() => void comprobar(), 0);
    const reloj = setInterval(() => {
      if (estadoRef.current === 'mirando' || estadoRef.current === 'falta') void comprobar();
    }, CADA_MS_COMPROBAR_CORREO);
    // Al volver a la app desde el correo (o desde la página del enlace), se mira enseguida.
    const sub = AppState.addEventListener('change', (a) => {
      if (a === 'active' && estadoRef.current !== 'dentro') void comprobar();
    });
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
      sub.remove();
    };
  }, [comprobar]);

  if (estado === 'dentro') return <>{children}</>;
  if (estado === 'mirando')
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
      >
        <ActivityIndicator color={C.primario} size="large" />
        {sinConexion ? <SinConexion /> : null}
      </View>
    );
  if (estado === 'verificado') return <Verificado alSeguir={() => setEstado('dentro')} />;
  return (
    <ConfirmaTuCorreo
      correo={correo}
      rebotado={rebotado}
      sinConexion={sinConexion}
      comprobar={comprobar}
      alCambiar={setCorreo}
    />
  );
}

function SinConexion() {
  const { idioma } = useSesion();
  return (
    <Text style={{ color: C.gris, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }}>
      {enIdioma(T, idioma).sinConexion}
    </Text>
  );
}

function Verificado({ alSeguir }: { alSeguir: () => void }) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  return (
    <View
      testID="correo-verificado"
      style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 14, backgroundColor: '#fff' }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: C.exito,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '700' }}>✓</Text>
      </View>
      <Text
        style={{ fontSize: 24, fontWeight: '700', color: C.secundario }}
        accessibilityRole="header"
      >
        {t.verificado}
      </Text>
      <Text style={{ fontSize: 16, color: '#666B73' }}>{t.verificadoDetalle}</Text>
      <Boton texto={t.continuar} exito alTocar={alSeguir} />
    </View>
  );
}

function ConfirmaTuCorreo({
  correo,
  rebotado,
  sinConexion,
  comprobar,
  alCambiar,
}: {
  correo: string;
  rebotado: boolean;
  sinConexion: boolean;
  comprobar: () => Promise<boolean>;
  alCambiar: (correo: string) => void;
}) {
  const { api, idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const arriba = useSafeAreaInsets().top;
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'reenviar' | 'mirar' | 'cambiar'>('');
  const [cambiando, setCambiando] = useState(false);
  // Si la dirección rebotó, el formulario para cambiarla se abre solo (una vez).
  const abiertoPorRebote = useRef(false);
  useEffect(() => {
    if (rebotado && !abiertoPorRebote.current) {
      abiertoPorRebote.current = true;
      setCambiando(true);
    }
  }, [rebotado]);
  const [borrando, setBorrando] = useState(false);

  async function reenviar() {
    setError('');
    setAviso('');
    setOcupado('reenviar');
    try {
      const r = await api.pedir<{ yaConfirmado: boolean }>(
        'POST',
        '/datos/cuentas/confirmar/reenviar',
      );
      if (r.yaConfirmado) await comprobar();
      else setAviso(t.reenviado);
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado('');
    }
  }

  async function yaLoHice() {
    setError('');
    setAviso('');
    setOcupado('mirar');
    const listo = await comprobar();
    setOcupado('');
    if (!listo) setAviso(t.todavia);
  }

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      testID="confirma-tu-correo"
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{ padding: 24, paddingTop: arriba + 32, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{ fontSize: 26, fontWeight: '700', color: C.secundario }}
        accessibilityRole="header"
      >
        {t.titulo}
      </Text>
      <Text style={{ fontSize: 16, color: '#666B73' }}>{t.enviamos}</Text>
      <Text
        style={{ fontSize: 17, fontWeight: '700', color: C.secundario }}
        testID="correo-a-confirmar"
      >
        {correo}
      </Text>
      <Text style={{ fontSize: 16, color: '#666B73' }}>{t.abrelo}</Text>
      <Text style={{ fontSize: 14, color: C.gris }}>{t.spam}</Text>
      {rebotado ? (
        <Text
          style={{ fontSize: 15, color: C.acento, fontWeight: '700' }}
          accessibilityRole="alert"
          testID="correo-rebotado"
        >
          {t.rebotado}
        </Text>
      ) : null}
      {sinConexion ? <SinConexion /> : null}
      {aviso ? (
        <Text style={{ fontSize: 14, color: C.secundario }} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ fontSize: 14, color: C.acento }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Boton texto={t.yaLoHice} cargando={ocupado === 'mirar'} alTocar={() => void yaLoHice()} />
      <Boton
        texto={t.reenviar}
        secundario
        cargando={ocupado === 'reenviar'}
        alTocar={() => void reenviar()}
      />
      {cambiando ? (
        <CambiarCorreo
          formulario="cambiar-correo-puerta"
          alCancelar={() => setCambiando(false)}
          alCambiar={(nuevo) => {
            alCambiar(nuevo);
            setCambiando(false);
            setAviso(t.enviadoNuevo);
          }}
        />
      ) : (
        <Boton texto={t.cambiar} secundario alTocar={() => setCambiando(true)} />
      )}
      <Boton texto={t.salir} secundario alTocar={() => void salir()} />
      {/* C-BORRAR-EN-LA-APP: una cuenta sin confirmar también se puede borrar (Apple 5.1.1 v). */}
      <Pressable
        onPress={() => setBorrando(true)}
        accessibilityRole="button"
        style={{ alignSelf: 'center', padding: 10 }}
        testID="puerta-borrar-cuenta"
      >
        <Text style={{ color: C.acento, fontWeight: '700' }}>{t.borrar}</Text>
      </Pressable>
      <ConfirmarBorrado visible={borrando} alCerrar={() => setBorrando(false)} />
    </ScrollView>
  );
}

const TA = {
  es: {
    titulo: 'Confirma tu correo',
    detalle: 'Te mandamos un enlace a',
    abrelo: 'Puedes seguir usando la app: confírmalo cuando quieras.',
    reenviar: 'Mandar el enlace otra vez',
    reenviado: 'Te mandamos un enlace nuevo. Puede tardar un minuto.',
    cambiar: '¿Correo equivocado? Cámbialo',
    rebotado:
      'No pudimos entregar el correo a esta dirección: no existe o no recibe mensajes. Revisa que esté bien escrita y cámbiala aquí.',
    enviadoNuevo: 'Listo. Te mandamos el enlace a tu correo nuevo.',
    verificado: 'Tu correo quedó verificado.',
  },
  en: {
    titulo: 'Confirm your email',
    detalle: 'We sent a link to',
    abrelo: 'You can keep using the app: confirm it whenever you like.',
    reenviar: 'Send the link again',
    reenviado: 'We sent you a new link. It can take a minute.',
    cambiar: 'Wrong email? Change it',
    rebotado:
      'We couldn’t deliver the email to this address: it doesn’t exist or can’t receive mail. Check the spelling and change it here.',
    enviadoNuevo: 'Done. We sent the link to your new email.',
    verificado: 'Your email is verified.',
  },
};

/** Cada cuánto mira la franja si el correo ya se confirmó (más calmado que la puerta: no frena nada). */
export const CADA_MS_FRANJA_CORREO = 15000;

/**
 * C-CORREO-NO-FRENA (23 nov 2026, decisión de Richard): «que el correo quede en un segundo plano… que no
 * por eso se tranque el registro… que le dé su oportunidad de verificarlo cuando le dé la gana». Franja
 * suave en la portada del cliente y en el inicio de Driver: nunca una ventana, no tapa nada y todo se
 * sigue usando. Trae «Mandar el enlace otra vez» (un enlace NUEVO, aunque el anterior haya vencido) y
 * «¿Correo equivocado? Cámbialo» (con la contraseña; el borrador guarda el correo, nunca la clave). Si
 * la dirección rebotó (C-CORREO-HONESTO), lo dice en rojo y abre el cambio. Al confirmarse, lo dice en
 * verde. Una sola pieza para las dos apps.
 */
export function AvisoCorreo({
  margenLateral = 16,
}: {
  /** Driver la pone dentro de una lista que ya lleva su margen: ahí va en 0. */
  margenLateral?: number;
} = {}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TA, idioma);
  const [estado, setEstado] = useState<'nada' | 'falta' | 'verificado'>('nada');
  const [correo, setCorreo] = useState('');
  const [aviso, setAviso] = useState('');
  const [rebotado, setRebotado] = useState(false);
  const [error, setError] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  const comprobar = useCallback(async () => {
    if (!usuario) return;
    try {
      const r = await api.pedir<{ perfil: Perfil }>('GET', '/datos/cuentas/perfil');
      setCorreo(r.perfil.correo);
      const reboto = r.perfil.correoRebotado === true;
      setRebotado(reboto);
      if (reboto) setCambiando(true);
      // Un servidor de antes no manda `correoPorConfirmar`: vale lo que decía la puerta.
      const falta = r.perfil.correoPorConfirmar ?? r.perfil.debeConfirmarCorreo === true;
      setEstado((e) => (falta ? 'falta' : e === 'falta' ? 'verificado' : e));
    } catch {
      // Sin conexión: la franja se queda como estaba y se vuelve a mirar después.
    }
  }, [api, usuario]);

  useEffect(() => {
    if (!usuario) return;
    const primero = setTimeout(() => void comprobar(), 0);
    const reloj = setInterval(() => {
      if (estadoRef.current === 'falta') void comprobar();
    }, CADA_MS_FRANJA_CORREO);
    const sub = AppState.addEventListener('change', (a) => {
      if (a === 'active' && estadoRef.current === 'falta') void comprobar();
    });
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
      sub.remove();
    };
  }, [comprobar, usuario]);

  async function reenviar() {
    // C-CORREO-HONESTO: «Te mandamos un enlace nuevo» solo si salió de verdad; si no, el motivo.
    setError('');
    setAviso('');
    setOcupado(true);
    try {
      const r = await api.pedir<{ yaConfirmado?: boolean }>(
        'POST',
        '/datos/cuentas/confirmar/reenviar',
      );
      if (r.yaConfirmado) await comprobar();
      else setAviso(t.reenviado);
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  if (!usuario || estado === 'nada') return null;
  if (estado === 'verificado')
    return (
      <View
        testID="aviso-correo-verificado"
        accessibilityRole="alert"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: margenLateral,
          marginVertical: 8,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: C.exito,
          backgroundColor: '#fff',
        }}
      >
        <Text style={{ color: C.exito, fontSize: 20, fontWeight: '700' }}>✓</Text>
        <Text style={{ flex: 1, color: C.secundario, fontWeight: '700' }}>{t.verificado}</Text>
      </View>
    );
  return (
    <View
      testID="aviso-correo"
      style={{
        marginHorizontal: margenLateral,
        marginVertical: 8,
        padding: 14,
        gap: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        backgroundColor: '#fff',
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 15, color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#666B73' }}>
        {t.detalle}{' '}
        <Text style={{ fontWeight: '700' }} testID="aviso-correo-direccion">
          {correo}
        </Text>
        . {t.abrelo}
      </Text>
      {rebotado ? (
        <Text
          style={{ color: C.acento, fontWeight: '700' }}
          accessibilityRole="alert"
          testID="aviso-correo-rebotado"
        >
          {t.rebotado}
        </Text>
      ) : null}
      {aviso ? (
        <Text style={{ color: C.secundario }} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ color: C.acento, fontWeight: '700' }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {cambiando ? (
        <CambiarCorreo
          formulario="cambiar-correo-franja"
          alCancelar={() => setCambiando(false)}
          alCambiar={(nuevo) => {
            setCorreo(nuevo);
            setRebotado(false);
            setCambiando(false);
            setError('');
            setAviso(t.enviadoNuevo);
          }}
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4 }}>
          {rebotado ? null : (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              disabled={ocupado}
              onPress={() => void reenviar()}
              testID="aviso-correo-reenviar"
            >
              <Text style={{ color: C.primario, fontWeight: '700', marginTop: 4 }}>
                {t.reenviar}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setCambiando(true)}
            testID="aviso-correo-cambiar"
          >
            <Text style={{ color: C.primario, fontWeight: '700', marginTop: 4 }}>{t.cambiar}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const TC = {
  es: {
    correoNuevo: 'Correo nuevo',
    clave: 'Tu contraseña, para confirmar',
    guardar: 'Cambiar el correo y mandar el enlace',
    cancelar: 'Cancelar',
  },
  en: {
    correoNuevo: 'New email',
    clave: 'Your password, to confirm',
    guardar: 'Change email and send the link',
    cancelar: 'Cancel',
  },
};

/**
 * Cambiar el correo de la cuenta (con sesión y su contraseña) y mandar el enlace al nuevo. La usan la
 * puerta del correo y la franja. NINGÚN FORMULARIO PIERDE LO ESCRITO: el correo nuevo se guarda solo; la
 * contraseña nunca. Si falla, lo escrito se queda para reintentar.
 */
export function CambiarCorreo({
  formulario,
  alCambiar,
  alCancelar,
}: {
  formulario: string;
  alCambiar: (correo: string) => void;
  alCancelar: () => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TC, idioma);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const b = useBorrador({
    formulario,
    cuenta: usuario?.id,
    inicial: { correo: '', clave: '' },
    sensibles: ['clave'],
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  async function cambiar() {
    setError('');
    setOcupado(true);
    try {
      const r = await api.pedir<{ usuario: { correo: string } }>('POST', '/datos/cuentas/correo', {
        correo: b.valores.correo.trim().toLowerCase(),
        clave: b.valores.clave,
      });
      await b.limpiar();
      alCambiar(r.usuario.correo);
    } catch (x) {
      // Si falla, lo escrito se queda en pantalla para reintentar.
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View style={{ gap: 4 }} testID="cambiar-correo">
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <Campo
        tipo="correo"
        etiqueta={t.correoNuevo}
        value={b.valores.correo}
        onChangeText={(x) => b.cambiar('correo', x)}
      />
      <SugerenciaCorreo
        correo={b.valores.correo}
        idioma={idioma}
        aceptar={(x) => b.cambiar('correo', x)}
      />
      <CampoClave
        etiqueta={t.clave}
        valor={b.valores.clave}
        cambiar={(x) => b.cambiar('clave', x)}
        alEnviar={() => void cambiar()}
      />
      {error ? (
        <Text style={{ fontSize: 14, color: C.acento }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Boton texto={t.guardar} cargando={ocupado} alTocar={() => void cambiar()} />
      <Boton texto={t.cancelar} secundario alTocar={alCancelar} />
    </View>
  );
}

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enIdioma, useBorrador } from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { AvisoBorrador } from './AvisoBorrador';
import { ConfirmarBorrado } from './OpcionesCuenta';
import { useSesion } from './sesion';
import { Boton, C, Campo, CampoClave } from './ui';

const T = {
  es: {
    titulo: 'Confirma tu correo',
    enviamos: 'Te mandamos un enlace a',
    abrelo: 'Ábrelo en este teléfono para activar tu cuenta. Esta pantalla se actualiza sola.',
    spam: '¿No te llegó? Mira en la carpeta de correo no deseado (spam).',
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
    spam: 'Don’t see it? Check your spam or junk folder.',
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

type Perfil = { correo: string; debeConfirmarCorreo?: boolean };

/**
 * C-CORREO-OBLIGATORIO (4 nov 2026, Richard grabando el video para Apple): la app del cliente no
 * deja entrar hasta que la persona confirma su correo. Muestra «Confirma tu correo» con la dirección,
 * mira sola si ya lo confirmó (al volver a la app desde el correo y cada pocos segundos), y al
 * confirmarlo dice «Tu correo quedó verificado» antes de entrar. Si el correo está mal escrito, se
 * cambia aquí mismo con la contraseña. Una cuenta ya confirmada entra directo, sin ver nada.
 */
export function PuertaCorreo({ children }: { children: ReactNode }) {
  const { api, usuario } = useSesion();
  const [estado, setEstado] = useState<'mirando' | 'falta' | 'verificado' | 'dentro'>('mirando');
  const [correo, setCorreo] = useState(usuario?.correo ?? '');
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
      <Text style={{ fontSize: 16, color: '#5E5E5E' }}>{t.verificadoDetalle}</Text>
      <Boton texto={t.continuar} exito alTocar={alSeguir} />
    </View>
  );
}

function ConfirmaTuCorreo({
  correo,
  sinConexion,
  comprobar,
  alCambiar,
}: {
  correo: string;
  sinConexion: boolean;
  comprobar: () => Promise<boolean>;
  alCambiar: (correo: string) => void;
}) {
  const { api, idioma, salir, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const arriba = useSafeAreaInsets().top;
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'reenviar' | 'mirar' | 'cambiar'>('');
  const [cambiando, setCambiando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  // NINGÚN FORMULARIO PIERDE LO ESCRITO: el correo nuevo se guarda solo; la contraseña nunca.
  const b = useBorrador({
    formulario: 'cambiar-correo-puerta',
    cuenta: usuario?.id,
    inicial: { correo: '', clave: '' },
    sensibles: ['clave'],
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

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

  async function cambiar() {
    setError('');
    setAviso('');
    setOcupado('cambiar');
    try {
      const r = await api.pedir<{ usuario: { correo: string } }>('POST', '/datos/cuentas/correo', {
        correo: b.valores.correo.trim().toLowerCase(),
        clave: b.valores.clave,
      });
      await b.limpiar();
      alCambiar(r.usuario.correo);
      setCambiando(false);
      setAviso(t.reenviado);
    } catch (x) {
      // Si falla, lo escrito se queda en pantalla para reintentar.
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado('');
    }
  }

  return (
    <ScrollView
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
      <Text style={{ fontSize: 16, color: '#5E5E5E' }}>{t.enviamos}</Text>
      <Text
        style={{ fontSize: 17, fontWeight: '700', color: C.secundario }}
        testID="correo-a-confirmar"
      >
        {correo}
      </Text>
      <Text style={{ fontSize: 16, color: '#5E5E5E' }}>{t.abrelo}</Text>
      <Text style={{ fontSize: 14, color: C.gris }}>{t.spam}</Text>
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
        <View style={{ gap: 4 }}>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <Campo
            etiqueta={t.correoNuevo}
            keyboardType="email-address"
            value={b.valores.correo}
            onChangeText={(x) => b.cambiar('correo', x)}
          />
          <CampoClave
            etiqueta={t.clave}
            valor={b.valores.clave}
            cambiar={(x) => b.cambiar('clave', x)}
            alEnviar={() => void cambiar()}
          />
          <Boton
            texto={t.guardar}
            cargando={ocupado === 'cambiar'}
            alTocar={() => void cambiar()}
          />
          <Boton texto={t.cancelar} secundario alTocar={() => setCambiando(false)} />
        </View>
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
    titulo: 'Confirma tu correo para poder pedir',
    detalle: 'Te mandamos un enlace a',
    abrelo: 'Ábrelo en este teléfono. Mientras tanto puedes mirar.',
    reenviar: 'Mandar el enlace otra vez',
    reenviado: 'Te lo mandamos otra vez.',
    verificado: 'Tu correo quedó verificado. Ya puedes pedir.',
  },
  en: {
    titulo: 'Confirm your email to order',
    detalle: 'We sent a link to',
    abrelo: 'Open it on this phone. You can keep browsing meanwhile.',
    reenviar: 'Send the link again',
    reenviado: 'We sent it again.',
    verificado: 'Your email is verified. You can order now.',
  },
};

/**
 * C-CORREO-OBLIGATORIO (4 nov 2026): en la portada, quien entró sin confirmar su correo ve este aviso
 * (no bloquea: se puede mirar). Se da cuenta sola cuando la persona toca el enlace y lo dice en verde.
 * La puerta que bloquea (PuertaCorreo) está al ir a pagar.
 */
export function AvisoCorreo() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TA, idioma);
  const [estado, setEstado] = useState<'nada' | 'falta' | 'verificado'>('nada');
  const [correo, setCorreo] = useState('');
  const [reenviado, setReenviado] = useState(false);
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  const comprobar = useCallback(async () => {
    if (!usuario) return;
    try {
      const r = await api.pedir<{ perfil: Perfil }>('GET', '/datos/cuentas/perfil');
      setCorreo(r.perfil.correo);
      const debe = r.perfil.debeConfirmarCorreo === true;
      setEstado((e) => (debe ? 'falta' : e === 'falta' ? 'verificado' : e));
    } catch {
      // Sin conexión: el aviso se queda como estaba; la puerta de pagar vuelve a mirar.
    }
  }, [api, usuario]);

  useEffect(() => {
    if (!usuario) return;
    const primero = setTimeout(() => void comprobar(), 0);
    const reloj = setInterval(() => {
      if (estadoRef.current === 'falta') void comprobar();
    }, CADA_MS_COMPROBAR_CORREO);
    const sub = AppState.addEventListener('change', (a) => {
      if (a === 'active' && estadoRef.current === 'falta') void comprobar();
    });
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
      sub.remove();
    };
  }, [comprobar, usuario]);

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
          marginHorizontal: 16,
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
        marginHorizontal: 16,
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
      <Text style={{ color: '#5E5E5E' }}>
        {t.detalle} <Text style={{ fontWeight: '700' }}>{correo}</Text>. {t.abrelo}
      </Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          void api
            .pedir('POST', '/datos/cuentas/confirmar/reenviar')
            .then(() => setReenviado(true))
            .catch(() => undefined);
        }}
      >
        <Text style={{ color: C.primario, fontWeight: '700', marginTop: 4 }}>
          {reenviado ? t.reenviado : t.reenviar}
        </Text>
      </Pressable>
    </View>
  );
}

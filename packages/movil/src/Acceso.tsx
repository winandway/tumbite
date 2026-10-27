import { useState, type ReactNode } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  correoEjemplo,
  pareceCorreo,
  ErrorApi,
  enIdioma,
  enIdiomaDireccion,
  useBorrador,
} from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { URL_SERVIDOR, useSesion } from './sesion';
import { TEXTOS_MOVIL } from './textos';
import { AvisoBorrador } from './AvisoBorrador';
import { Boton, C, Campo, CampoClave, Pantalla, e } from './ui';
import { SelectorIdioma } from './SelectorIdioma';
import { Turnstile, olvidarPaseTurnstile, useTurnstileSitio } from './Turnstile';

const INICIAL = { nombre: '', correo: '', telefono: '', fechaNacimiento: '', clave: '' };

/**
 * Entrar y crear cuenta. Si `rolRegistro` no viene, la app solo deja entrar
 * (la del restaurante: las cuentas se crean en el panel web).
 */
export function Acceso({
  rolRegistro,
  pideCumple,
  portada,
}: {
  rolRegistro?: 'cliente' | 'repartidor';
  pideCumple?: boolean;
  /**
   * Portada propia (logotipo, título): la usa solo la app del restaurante con su diseño blanco.
   * Sin ella, el acceso se ve como siempre en cliente y repartidor.
   */
  portada?: ReactNode;
}) {
  const { api, idioma, alEntrar, rolesPermitidos, cambiarIdioma } = useSesion();
  const t = enIdioma(TEXTOS_MOVIL, idioma);
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const b = useBorrador({
    formulario: `app-${modo}`,
    inicial: INICIAL,
    almacen: almacenTelefono,
    sensibles: ['clave'],
    alSalir: alSalirTelefono,
  });
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const v = b.valores;
  const errorDe = (c: string) => (error?.campo === c ? error.mensaje : undefined);
  const turnstileSitio = useTurnstileSitio(api);

  async function enviar() {
    setError(null);
    if (!pareceCorreo(v.correo)) {
      setError({ mensaje: t.correoInvalido, campo: 'correo' });
      return;
    }
    setEnviando(true);
    try {
      const r =
        modo === 'entrar' || !rolRegistro
          ? await api.entrar({ correo: v.correo, clave: v.clave })
          : await api.registro({
              nombre: v.nombre,
              correo: v.correo,
              clave: v.clave,
              telefono: v.telefono || undefined,
              fechaNacimiento: v.fechaNacimiento || undefined,
              rol: rolRegistro,
              idioma,
            });
      if (!rolesPermitidos.includes(r.usuario.rol)) {
        setError({ mensaje: t.rolEquivocado });
        return;
      }
      await b.limpiar();
      await alEntrar(r.token, r.usuario);
    } catch (x) {
      // Un 403 del escudo anti-robots: el pase ya no sirve, se pide otro.
      if (x instanceof ErrorApi && x.estado === 403) olvidarPaseTurnstile();
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setEnviando(false);
    }
  }

  const registro = modo === 'registro' && rolRegistro;
  // Inglés sin prefijo, español bajo /es: la misma página legal en el idioma de la app.
  const abrir = (ruta: string) =>
    void Linking.openURL(`${URL_SERVIDOR}${enIdiomaDireccion(ruta, idioma)}`);
  const marco = (cuerpo: ReactNode) =>
    portada ? (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ backgroundColor: C.primario, borderRadius: 999, paddingHorizontal: 4 }}>
            <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
          </View>
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: 24,
            width: '100%',
            maxWidth: 460,
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {portada}
          {cuerpo}
        </ScrollView>
      </SafeAreaView>
    ) : (
      <Pantalla titulo={registro ? t.crearCuenta : t.entrar}>{cuerpo}</Pantalla>
    );
  return marco(
    <>
      {rolRegistro ? (
        // Que se sepa siempre qué cuenta se crea o se usa: de cliente o de repartidor.
        <Text
          style={{ color: '#5E5E5E', fontSize: 15, marginBottom: 12 }}
          accessibilityRole="header"
        >
          {rolRegistro === 'repartidor' ? t.cuentaDe.repartidor : t.cuentaDe.cliente}
        </Text>
      ) : null}
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {registro && (
        <Campo
          etiqueta={t.nombre}
          value={v.nombre}
          onChangeText={(x) => b.cambiar('nombre', x)}
          autoComplete="name"
          placeholder={t.nombre}
          error={errorDe('nombre')}
        />
      )}
      <Campo
        etiqueta={t.correo}
        value={v.correo}
        onChangeText={(x) => b.cambiar('correo', x)}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder={correoEjemplo(idioma)}
        error={errorDe('correo')}
      />
      {registro && (
        <Campo
          etiqueta={t.telefono}
          value={v.telefono}
          onChangeText={(x) => b.cambiar('telefono', x)}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={t.telefono}
          error={errorDe('telefono')}
        />
      )}
      {registro && pideCumple && (
        <Campo
          etiqueta={t.cumple}
          value={v.fechaNacimiento}
          onChangeText={(x) => b.cambiar('fechaNacimiento', x)}
          placeholder="2000-01-31"
          error={errorDe('fechaNacimiento')}
        />
      )}
      <CampoClave
        etiqueta={t.clave}
        valor={v.clave}
        cambiar={(x) => b.cambiar('clave', x)}
        nueva={Boolean(registro)}
        alEnviar={() => void enviar()}
        error={errorDe('clave')}
      />
      <Turnstile sitio={turnstileSitio} idioma={idioma} />
      {error && !error.campo ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error.mensaje}
        </Text>
      ) : null}
      {registro ? (
        // Aceptación visible antes de crear la cuenta (Apple y Google la revisan).
        <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 10 }}>
          {t.aceptas}{' '}
          <Text style={e.enlaceLinea} onPress={() => abrir('/terms')} accessibilityRole="link">
            {t.terminos}
          </Text>
          {rolRegistro === 'repartidor' ? (
            <>
              ,{' '}
              <Text
                style={e.enlaceLinea}
                onPress={() => abrir('/driver-terms')}
                accessibilityRole="link"
              >
                {t.terminosRepartidores}
              </Text>
            </>
          ) : null}{' '}
          {t.yLa}{' '}
          <Text style={e.enlaceLinea} onPress={() => abrir('/privacy')} accessibilityRole="link">
            {t.privacidad}
          </Text>
          .
        </Text>
      ) : null}
      <Boton
        texto={enviando ? t.enviando : registro ? t.crearCuenta : t.entrar}
        alTocar={() => void enviar()}
        cargando={enviando}
      />
      {modo === 'entrar' ? (
        <Text
          style={e.enlace}
          onPress={() => void Linking.openURL(`${URL_SERVIDOR}/forgot-password`)}
          accessibilityRole="link"
        >
          {t.olvide}
        </Text>
      ) : null}
      {rolRegistro ? (
        <Text
          style={e.enlace}
          onPress={() => {
            setError(null);
            setModo(modo === 'entrar' ? 'registro' : 'entrar');
          }}
          accessibilityRole="button"
        >
          {modo === 'entrar' ? t.noTengo : t.yaTengo}
        </Text>
      ) : (
        <Text style={[e.enlace, { textDecorationLine: 'none' }]}>{t.soloPanel}</Text>
      )}
    </>,
  );
}

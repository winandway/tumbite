import { useState } from 'react';
import { Text } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { useSesion } from './sesion';
import { TEXTOS_MOVIL } from './textos';
import { Boton, Campo, CampoClave, Pantalla, e } from './ui';

const INICIAL = { nombre: '', correo: '', telefono: '', fechaNacimiento: '', clave: '' };

/**
 * Entrar y crear cuenta. Si `rolRegistro` no viene, la app solo deja entrar
 * (la del restaurante: las cuentas se crean en el panel web).
 */
export function Acceso({
  rolRegistro,
  pideCumple,
}: {
  rolRegistro?: 'cliente' | 'repartidor';
  pideCumple?: boolean;
}) {
  const { api, idioma, alEntrar, rolesPermitidos } = useSesion();
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

  async function enviar() {
    setError(null);
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
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setEnviando(false);
    }
  }

  const registro = modo === 'registro' && rolRegistro;
  return (
    <Pantalla titulo={registro ? t.crearCuenta : t.entrar}>
      {b.recuperado && (
        <Text style={e.aviso}>
          {t.recuperado}{' '}
          <Text style={{ textDecorationLine: 'underline' }} onPress={() => void b.empezarDeNuevo()}>
            {t.empezarDeNuevo}
          </Text>
        </Text>
      )}
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
        placeholder="correo@ejemplo.com"
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
        error={errorDe('clave')}
      />
      {error && !error.campo ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error.mensaje}
        </Text>
      ) : null}
      <Boton
        texto={enviando ? t.enviando : registro ? t.crearCuenta : t.entrar}
        alTocar={() => void enviar()}
        cargando={enviando}
      />
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
    </Pantalla>
  );
}

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  type Disponibilidad,
  ErrorApi,
  correoEjemplo,
  type Idioma,
  MARCA,
  enIdioma,
  fraseDisponibilidad,
  useBorrador,
} from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { AvisoBorrador } from './AvisoBorrador';
import { useSesion } from './sesion';
import { Boton, Campo, e } from './ui';

/**
 * C-DISPONIBLE-MUNDO (10 nov 2026) — todos los países. Dos piezas únicas para las tres apps:
 * «Dónde ya funciona Divoox» y «Avísame cuando llegue» (para el restaurante: «Quiero traer Divoox
 * a mi ciudad»). El registro nunca se limita por país: solo se informa y se ofrece anotarse.
 */
const T = {
  es: {
    yaFunciona: 'Divoox ya funciona en: {lista}.',
    proximas: 'Abrimos pronto en: {lista}.',
    otraCiudad:
      '¿Tu ciudad no está? Crea tu cuenta igual: te avisamos apenas lleguemos y tu cuenta ya queda lista.',
    tituloCliente: 'Avísame cuando llegue',
    tituloRestaurante: 'Quiero traer Divoox a mi ciudad',
    introCliente: 'Déjanos tu correo y tu ciudad. Te escribimos el día que Divoox llegue.',
    introRestaurante:
      'Cuéntanos de tu restaurante y tu ciudad. Abrimos primero donde más restaurantes nos lo piden.',
    correo: 'Correo electrónico',
    ciudad: 'Ciudad y país',
    ciudadEjemplo: 'Ciudad, país',
    negocio: 'Nombre del restaurante',
    telefono: 'Número de celular',
    enviar: 'Avísame cuando llegue',
    enviarRestaurante: 'Quiero traer Divoox a mi ciudad',
    enviando: 'Enviando…',
    listo: 'Listo. Te avisamos por correo cuando Divoox llegue a {ciudad}.',
    listoRestaurante: 'Recibido. Nuestro equipo te escribe para llevar Divoox a {ciudad}.',
  },
  en: {
    yaFunciona: 'Divoox already works in: {lista}.',
    proximas: 'Opening soon in: {lista}.',
    otraCiudad:
      'Don’t see your city? Create your account anyway: we’ll let you know the moment we arrive and your account will be ready.',
    tituloCliente: 'Notify me when it arrives',
    tituloRestaurante: 'Bring Divoox to my city',
    introCliente: 'Leave your email and city. We’ll write to you the day Divoox arrives.',
    introRestaurante:
      'Tell us about your restaurant and your city. We open first where the most restaurants ask.',
    correo: 'Email',
    ciudad: 'City and country',
    ciudadEjemplo: 'City, country',
    negocio: 'Restaurant name',
    telefono: 'Mobile number',
    enviar: 'Notify me when it arrives',
    enviarRestaurante: 'Bring Divoox to my city',
    enviando: 'Sending…',
    listo: 'Done. We’ll email you when Divoox arrives in {ciudad}.',
    listoRestaurante: 'Got it. Our team will write to you about bringing Divoox to {ciudad}.',
  },
};

const suave = { color: '#5E5E5E', fontSize: 14 } as const;

/** Lee una vez dónde funciona Divoox. Si falla, no estorba: la pantalla sigue sin la lista. */
export function useDisponibilidad(): Disponibilidad | null {
  const { api } = useSesion();
  const [d, setD] = useState<Disponibilidad | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<Disponibilidad>('GET', '/datos/disponibilidad')
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  return d;
}

/** «Divoox ya funciona en: Miami (Estados Unidos)». Va en el registro y junto a la dirección. */
export function DondeFunciona({
  idioma,
  conInvitacion,
}: {
  idioma: Idioma;
  conInvitacion?: boolean;
}) {
  const t = enIdioma(T, idioma);
  const d = useDisponibilidad();
  if (!d?.paises?.length) return null;
  const proximas = d.proximas.map((p) => p.ciudad).join(', ');
  return (
    <View testID="donde-funciona" accessibilityRole="summary" style={{ gap: 4, marginBottom: 12 }}>
      <Text style={suave}>{t.yaFunciona.replace('{lista}', fraseDisponibilidad(d, idioma))}</Text>
      {proximas ? <Text style={suave}>{t.proximas.replace('{lista}', proximas)}</Text> : null}
      {conInvitacion ? <Text style={suave}>{t.otraCiudad}</Text> : null}
    </View>
  );
}

/**
 * El formulario para quien todavía no tiene Divoox en su ciudad. Guarda correo y ciudad (y, del
 * restaurante, su nombre y su celular). Lo escrito no se pierde (regla de los formularios).
 */
export function AvisameCuandoLlegue({
  idioma,
  tipo = 'comensal',
  punto,
  ciudadInicial = '',
}: {
  idioma: Idioma;
  tipo?: 'comensal' | 'restaurante';
  punto?: { lat: number; lng: number } | null;
  ciudadInicial?: string;
}) {
  const t = enIdioma(T, idioma);
  const { api, usuario } = useSesion();
  const restaurante = tipo === 'restaurante';
  const b = useBorrador({
    formulario: `avisame-${tipo}`,
    cuenta: usuario?.id,
    inicial: { correo: usuario?.correo ?? '', ciudad: ciudadInicial, negocio: '', telefono: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const v = b.valores;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [hecho, setHecho] = useState('');
  const errorDe = (campo: string) => (error?.campo === campo ? error.mensaje : undefined);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      await api.pedir('POST', '/datos/lista-espera', {
        tipo,
        nombre: usuario?.nombre || v.correo.split('@')[0] || '',
        correo: v.correo,
        ciudad: v.ciudad,
        negocio: v.negocio,
        telefono: v.telefono,
        idioma,
        origen: 'app',
        lat: punto?.lat ?? null,
        lng: punto?.lng ?? null,
      });
      // Solo con la confirmación del servidor se suelta el borrador.
      setHecho(v.ciudad);
      await b.limpiar();
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setEnviando(false);
    }
  }

  if (hecho)
    return (
      <View
        testID="avisame-listo"
        accessibilityRole="summary"
        style={{
          borderWidth: 1,
          borderColor: MARCA.colores.exito,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <Text style={{ color: MARCA.colores.exito, fontSize: 15, fontWeight: '700' }}>
          {(restaurante ? t.listoRestaurante : t.listo).replace('{ciudad}', hecho)}
        </Text>
      </View>
    );

  return (
    <View
      testID={`avisame-${tipo}`}
      style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, gap: 4 }}
    >
      <Text style={{ fontSize: 17, fontWeight: '700' }} accessibilityRole="header">
        {restaurante ? t.tituloRestaurante : t.tituloCliente}
      </Text>
      <Text style={[suave, { marginBottom: 8 }]}>
        {restaurante ? t.introRestaurante : t.introCliente}
      </Text>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {restaurante ? (
        <Campo
          etiqueta={t.negocio}
          value={v.negocio}
          onChangeText={(x) => b.cambiar('negocio', x)}
          placeholder={t.negocio}
          error={errorDe('negocio')}
        />
      ) : null}
      <Campo
        etiqueta={t.correo}
        value={v.correo}
        onChangeText={(x) => b.cambiar('correo', x)}
        keyboardType="email-address"
        autoComplete="email"
        placeholder={correoEjemplo(idioma)}
        error={errorDe('correo')}
      />
      <Campo
        etiqueta={t.ciudad}
        value={v.ciudad}
        onChangeText={(x) => b.cambiar('ciudad', x)}
        placeholder={t.ciudadEjemplo}
        error={errorDe('ciudad')}
      />
      {restaurante ? (
        <Campo
          etiqueta={t.telefono}
          value={v.telefono}
          onChangeText={(x) => b.cambiar('telefono', x)}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder={t.telefono}
          error={errorDe('telefono')}
        />
      ) : null}
      {error && !error.campo ? <Text style={e.error}>{error.mensaje}</Text> : null}
      <Boton
        texto={enviando ? t.enviando : restaurante ? t.enviarRestaurante : t.enviar}
        alTocar={() => void enviar()}
        cargando={enviando}
      />
    </View>
  );
}

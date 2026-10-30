import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import { Tarjeta } from '../comida/piezas';
import { miUbicacion } from '../ubicacion';

/**
 * C-VIAJE-SEGURIDAD-2 (30 oct 2026), como el kit de seguridad de Uber: contactos de confianza que
 * reciben el viaje en vivo (siempre, solo de noche o nunca) y la pregunta «¿Todo bien?» si el viaje
 * se sale de la ruta.
 */
const T = {
  es: {
    titulo: 'Contactos de confianza',
    ayuda: 'Reciben por mensaje el enlace de tu viaje en vivo cuando empieza. Hasta 5.',
    nombre: 'Nombre',
    telefono: 'Número de celular',
    agregar: 'Agregar contacto',
    quitar: 'Quitar',
    compartir: 'Compartir mis viajes',
    modos: { nunca: 'Nunca', siempre: 'Siempre', noche: 'Solo de noche (9 p. m. a 6 a. m.)' },
    pregunta: '¿Todo bien?',
    preguntaAyuda: 'Tu viaje se salió de la ruta esperada.',
    bien: 'Estoy bien',
    ayudaBoton: 'Necesito ayuda',
  },
  en: {
    titulo: 'Trusted contacts',
    ayuda: 'They get a text with your live ride link when it starts. Up to 5.',
    nombre: 'Name',
    telefono: 'Mobile number',
    agregar: 'Add contact',
    quitar: 'Remove',
    compartir: 'Share my rides',
    modos: { nunca: 'Never', siempre: 'Always', noche: 'Only at night (9 p.m. to 6 a.m.)' },
    pregunta: 'Everything OK?',
    preguntaAyuda: 'Your ride went off the expected route.',
    bien: 'I’m OK',
    ayudaBoton: 'I need help',
  },
};

type Contacto = { id: string; nombre: string; telefono: string };
type Modo = 'nunca' | 'siempre' | 'noche';

export function ContactosConfianza() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [modo, setModo] = useState<Modo>('nunca');
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: 'contacto-confianza',
    cuenta: usuario?.id,
    inicial: { nombre: '', telefono: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  const cargar = useCallback(() => {
    api
      .pedir<{ contactos: Contacto[]; compartir: Modo }>('GET', '/datos/seguridad')
      .then((r) => {
        setContactos(r.contactos);
        setModo(r.compartir);
      })
      .catch(() => undefined);
  }, [api]);
  useEffect(cargar, [cargar]);

  async function hacer(f: () => Promise<unknown>) {
    setError('');
    try {
      await f();
      cargar();
      return true;
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      return false;
    }
  }

  return (
    <Tarjeta>
      <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.ayuda}</Text>
      {contactos.map((k) => (
        <View
          key={k.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: C.texto }}>
            {k.nombre} · {k.telefono}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void hacer(() => api.pedir('DELETE', `/datos/seguridad/contactos/${k.id}`))
            }
          >
            <Text style={{ color: C.secundario, fontWeight: '700' }}>{t.quitar}</Text>
          </Pressable>
        </View>
      ))}
      {contactos.length < 5 ? (
        <>
          <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
          <Campo
            etiqueta={t.nombre}
            value={b.valores.nombre}
            onChangeText={(x) => b.cambiar('nombre', x)}
          />
          <Campo
            etiqueta={t.telefono}
            value={b.valores.telefono}
            onChangeText={(x) => b.cambiar('telefono', x)}
            keyboardType="phone-pad"
            placeholder="(305) 000-0000"
          />
          <Boton
            texto={t.agregar}
            secundario
            alTocar={() =>
              void hacer(() =>
                api.pedir('POST', '/datos/seguridad/contactos', {
                  nombre: b.valores.nombre,
                  telefono: b.valores.telefono,
                }),
              ).then(async (ok) => {
                if (ok) await b.limpiar();
              })
            }
          />
        </>
      ) : null}
      <Text style={{ fontWeight: '700', marginTop: 10, marginBottom: 6 }}>{t.compartir}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['nunca', 'siempre', 'noche'] as Modo[]).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: modo === m }}
            onPress={() =>
              void hacer(() => api.pedir('PUT', '/datos/seguridad/compartir', { compartir: m }))
            }
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: modo === m ? C.secundario : '#D6D6D6',
              backgroundColor: modo === m ? C.secundario : '#FFFFFF',
            }}
          >
            <Text style={{ color: modo === m ? '#FFFFFF' : C.texto, fontWeight: '700' }}>
              {new Map(Object.entries(t.modos)).get(m)}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: '#B42200', marginTop: 6 }}>
          {error}
        </Text>
      ) : null}
    </Tarjeta>
  );
}

/** «¿Todo bien?» (RideCheck): «Estoy bien» lo cierra; «Necesito ayuda» llama y avisa al equipo. */
export function PreguntaTodoBien({
  viajeId,
  alResponder,
}: {
  viajeId: string;
  alResponder: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  async function responder(respuesta: 'bien' | 'ayuda') {
    const p = respuesta === 'ayuda' ? await miUbicacion().catch(() => null) : null;
    const r = await api
      .pedir<{ numero?: string }>('POST', `/datos/viajes/${viajeId}/alerta`, {
        respuesta,
        ...(p ?? {}),
      })
      .catch(() => (respuesta === 'ayuda' ? { numero: '911' } : {}));
    if (respuesta === 'ayuda') void Linking.openURL(`tel:${r.numero ?? '911'}`);
    alResponder();
  }
  return (
    <Tarjeta>
      <Text
        accessibilityRole="alert"
        style={{ fontWeight: '900', fontSize: 18, color: C.secundario }}
      >
        {t.pregunta}
      </Text>
      <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.preguntaAyuda}</Text>
      <View style={{ gap: 8 }}>
        <Boton texto={t.bien} secundario alTocar={() => void responder('bien')} />
        <Boton texto={t.ayudaBoton} alTocar={() => void responder('ayuda')} />
      </View>
    </Tarjeta>
  );
}

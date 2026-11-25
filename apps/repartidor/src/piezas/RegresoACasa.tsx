import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { ErrorApi, enIdioma, textoDistancia } from '@tumbite/compartido';
import { BloqueDriver, BotonDriver, DK, FUENTE, Text, useSesion, useSondeo } from '@tumbite/movil';

/**
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países; Android e iPhone con el mismo código). Después
 * de un viaje largo, lejos de su ciudad base, el conductor ve «Voy de regreso a <ciudad>»: con un
 * toque solo le llegan viajes y envíos que van hacia su ciudad y pasa primero en la fila para el
 * pasajero que pide en ese sentido. No cambia lo que gana por viaje. Dos usos al día, que se cuentan
 * al aceptar el primer viaje. Se apaga solo al llegar, a las 6 horas o al desconectarse.
 * Como «Driver Destinations» de Uber y el modo destino de Lyft y DiDi (ficha
 * docs/investigaciones-rea/2026-11-25-regreso-con-pasajero.md). Piezas del rediseño (driverKit):
 * borde fino gris, sin franjas de color.
 */
const T = {
  es: {
    titulo: 'Regreso a tu ciudad',
    lejos: (distancia: string, ciudad: string) => `Estás a ${distancia} de ${ciudad}.`,
    ayuda:
      'Con un toque te llegan solo viajes que van hacia tu ciudad, y vas primero en la fila para quien pide en ese sentido. Lo que ganas por viaje no cambia.',
    menos: 'Puedes recibir menos viajes mientras está encendido.',
    encender: (ciudad: string) => `Voy de regreso a ${ciudad}`,
    activo: (ciudad: string) => `Vas de regreso a ${ciudad}`,
    activoAyuda: (ciudad: string) =>
      `Solo te llegan viajes hacia ${ciudad}. Se apaga solo al llegar.`,
    hasta: (hora: string) => `Se apaga a más tardar a las ${hora}.`,
    apagar: 'Apagar',
    llegaste: (ciudad: string) => `Llegaste a ${ciudad}: el regreso se apagó.`,
    quedan: (n: number) =>
      n === 1
        ? 'Te queda 1 uso hoy. Se cuenta al aceptar el primer viaje.'
        : `Te quedan ${n} usos hoy. Se cuenta al aceptar el primer viaje.`,
  },
  en: {
    titulo: 'Back to your city',
    lejos: (distancia: string, ciudad: string) => `You’re ${distancia} from ${ciudad}.`,
    ayuda:
      'One tap and you only get trips heading to your city, and you go first in line for riders going that way. What you earn per trip doesn’t change.',
    menos: 'You may get fewer trips while it’s on.',
    encender: (ciudad: string) => `Heading home to ${ciudad}`,
    activo: (ciudad: string) => `Heading home to ${ciudad}`,
    activoAyuda: (ciudad: string) =>
      `You only get trips toward ${ciudad}. It turns off when you arrive.`,
    hasta: (hora: string) => `It turns off by ${hora} at the latest.`,
    apagar: 'Turn off',
    llegaste: (ciudad: string) => `You reached ${ciudad}: Heading home turned off.`,
    quedan: (n: number) =>
      n === 1
        ? '1 use left today. It counts when you accept the first trip.'
        : `${n} uses left today. It counts when you accept the first trip.`,
  },
};

type Regreso = {
  activo: boolean;
  disponible: boolean;
  ciudad: string | null;
  kmACasa: number | null;
  pais: string | null;
  motivo: string | null;
  usosRestantes: number;
  venceEn: string | null;
};

export function RegresoACasa() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<Regreso | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // «Llegaste» solo si en esta pantalla se vio encendido (no cada vez que abre la app en su ciudad).
  const [ibaDeRegreso, setIbaDeRegreso] = useState(false);
  const recibir = useCallback((d: Regreso) => {
    setEstado(d);
    if (d.activo) setIbaDeRegreso(true);
  }, []);
  const cargar = useCallback(
    () =>
      api
        .pedir<Regreso>('GET', '/datos/repartidor/regreso')
        .then((d) => {
          recibir(d);
          return true;
        })
        .catch(() => false),
    [api, recibir],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);
  // Encendido, se vuelve a mirar cada minuto (se apaga solo al llegar o a las 6 horas).
  useSondeo(cargar, 60_000, Boolean(estado?.activo), false);

  async function cambiar(metodo: 'POST' | 'DELETE') {
    setError('');
    setEnviando(true);
    try {
      recibir(await api.pedir<Regreso>(metodo, '/datos/repartidor/regreso'));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (!estado || !estado.ciudad) return null;
  const ciudad = estado.ciudad;
  const llego = !estado.activo && estado.motivo === 'llegada' && ibaDeRegreso;
  if (!estado.activo && !estado.disponible && !llego) return null;
  const nota = { fontFamily: FUENTE.texto, fontSize: 13, color: DK.gris, lineHeight: 18 };
  const hora = estado.venceEn
    ? new Date(estado.venceEn).toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  return (
    <BloqueDriver titulo={t.titulo} testID="regreso-a-casa">
      <View style={{ gap: 8, marginTop: 6 }}>
        {estado.activo ? (
          <>
            <Text
              style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16, color: DK.verde }}
              testID="regreso-activo"
            >
              {t.activo(ciudad)}
            </Text>
            <Text style={nota}>{t.activoAyuda(ciudad)}</Text>
            {hora ? <Text style={nota}>{t.hasta(hora)}</Text> : null}
            <BotonDriver
              texto={t.apagar}
              variante="borde"
              deshabilitado={enviando}
              alTocar={() => void cambiar('DELETE')}
              testID="regreso-apagar"
            />
          </>
        ) : llego ? (
          <Text style={{ fontFamily: FUENTE.textoFuerte, fontSize: 14, color: DK.verde }}>
            {t.llegaste(ciudad)}
          </Text>
        ) : (
          <>
            {estado.kmACasa != null ? (
              <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16, color: DK.negro }}>
                {t.lejos(textoDistancia(estado.kmACasa, idioma, estado.pais), ciudad)}
              </Text>
            ) : null}
            <Text style={nota}>{t.ayuda}</Text>
            <BotonDriver
              texto={t.encender(ciudad)}
              icono="home-outline"
              deshabilitado={enviando}
              alTocar={() => void cambiar('POST')}
              testID="regreso-encender"
            />
            <Text style={nota}>{t.menos}</Text>
          </>
        )}
        {!llego ? <Text style={nota}>{t.quedan(estado.usosRestantes)}</Text> : null}
        {error ? (
          <Text style={{ fontFamily: FUENTE.textoFuerte, fontSize: 13, color: DK.rojoOscuro }}>
            {error}
          </Text>
        ) : null}
      </View>
    </BloqueDriver>
  );
}

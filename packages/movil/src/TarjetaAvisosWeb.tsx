import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import {
  activarAvisosWeb,
  appDeRuta,
  entornoActual,
  estadoAvisosWeb,
  guardarLocal,
  leerLocal,
  llaveDescartada,
  textosAvisosWeb,
  textoTarjetaAvisosWeb,
  type EstadoAvisosWeb,
} from '@tumbite/compartido/src/avisosWeb';
import { Boton, e } from './ui';
import { useSesion } from './sesion';
import { LLAVE_VAPID_COMPILADA as LLAVE_COMPILADA } from './avisos';

/**
 * La explicación previa del permiso, en el momento útil (el restaurante al abrir sesión, el
 * repartidor al conectarse, el cliente después de su primer pedido). La ventana del navegador sale
 * SOLO al tocar «Activar avisos»; nunca al cargar. En iPhone sin agregar a inicio, explica en una
 * línea que primero se agrega. Se puede cerrar con «Ahora no» (se recuerda por cuenta y app).
 */
export function TarjetaAvisosWeb({ visible = true }: { visible?: boolean }) {
  const { api, usuario, idioma } = useSesion();
  const donde =
    Platform.OS === 'web'
      ? appDeRuta((globalThis as { location?: { pathname: string } }).location?.pathname ?? '')
      : null;
  const [estado, setEstado] = useState<EstadoAvisosWeb | 'error'>(() =>
    estadoAvisosWeb(Platform.OS === 'web' ? entornoActual() : null),
  );
  const [descartada, setDescartada] = useState(() =>
    usuario && donde ? leerLocal(llaveDescartada(usuario.id, donde.app)) === '1' : true,
  );
  const [ocupado, setOcupado] = useState(false);
  if (!visible || !usuario || !donde || descartada) return null;
  if (estado === 'no-aplica' || estado === 'sin-soporte' || estado === 'permitido') return null;
  const t = textosAvisosWeb(idioma);
  const texto = textoTarjetaAvisosWeb(idioma, donde.app);
  const quien = donde.app;
  const cerrar = () => {
    guardarLocal(llaveDescartada(usuario.id, quien), '1');
    setDescartada(true);
  };
  return (
    <View style={e.tarjeta} testID="tarjeta-avisos-web" accessibilityRole="summary">
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 4 }}>{texto.titulo}</Text>
      <Text style={{ color: '#444', marginBottom: 8 }}>
        {estado === 'iphone-sin-inicio'
          ? t.iphone
          : estado === 'bloqueado'
            ? t.bloqueado
            : estado === 'error'
              ? t.fallo
              : texto.cuerpo}
      </Text>
      {estado === 'pedir' || estado === 'error' ? (
        <Boton
          texto={t.activar}
          exito
          cargando={ocupado}
          alTocar={() => {
            setOcupado(true);
            // El permiso se pide dentro del toque (Safari lo exige).
            void activarAvisosWeb(api, usuario.id, LLAVE_COMPILADA).then((r) => {
              setOcupado(false);
              setEstado(r);
            });
          }}
        />
      ) : null}
      <Pressable onPress={cerrar} accessibilityRole="button" hitSlop={8}>
        <Text style={e.enlace}>{t.ahoraNo}</Text>
      </Pressable>
    </View>
  );
}

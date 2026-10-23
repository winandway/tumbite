import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { type Idioma, ORDEN_SERVICIOS, type ServicioCatalogo } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { ICONO_SERVICIO, IMG } from './recursos';
import { textosInicio } from './textos';

export type Servicio = keyof typeof IMG.servicios;

/**
 * Cuadrícula de servicios, como la de los grandes: cuatro por fila, ícono grande y nombre. El
 * orden lo fija ORDEN_SERVICIOS (Comida, Moto, Carro, Envíos, Mercado, Farmacia, Licores, Más) y
 * el estado lo dice el servidor: lo que no está disponible lleva una etiqueta discreta («Pronto»)
 * y abre su pantalla con la franja de «en construcción», nunca una ventana encima.
 */
export function Servicios({
  idioma,
  catalogo,
  alTocar,
}: {
  idioma: Idioma;
  catalogo: ServicioCatalogo[] | null;
  alTocar: (s: ServicioCatalogo) => void;
}) {
  const t = textosInicio(idioma);
  const nombres = new Map(Object.entries(t.servicios) as [Servicio, string][]);
  // Sin catálogo todavía, los ocho conocidos sin estado (cada pantalla vuelve a preguntar).
  const lista: ServicioCatalogo[] =
    catalogo ??
    ORDEN_SERVICIOS.map((id, i) => ({
      id,
      nombre: nombres.get(id) ?? id,
      descripcion: '',
      icono: `servicio-${id}`,
      orden: i,
      estado: 'proximamente',
      accion: 'muy_pronto',
    }));
  // Como en la pantalla aprobada: cuatro losetas por fila, el ícono 3D grande llenando la loseta
  // y el nombre adentro, todo dentro de un panel claro redondeado.
  const ancho = useWindowDimensions().width;
  const loseta = Math.floor((ancho - 32 - 16 - 3 * 8) / 4);
  // Los íconos ya vienen recortados al borde: ocupan tres cuartos de la loseta, como en la maqueta.
  const icono = Math.round(loseta * 0.74);
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        shadowColor: '#101010',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      {lista.map((s) => {
        // El nombre de la app manda si lo conoce (es/en ya resueltos); si no, el del servidor.
        const nombre = nombres.get(s.id as Servicio) ?? s.nombre;
        const etiqueta = catalogo ? t.etiquetaServicio[s.accion] : '';
        return (
          <Pressable
            key={s.id}
            onPress={() => alTocar(s)}
            accessibilityRole="button"
            accessibilityLabel={etiqueta ? `${nombre} (${etiqueta})` : nombre}
            testID={`servicio-${s.id}`}
            style={({ pressed }) => ({
              width: loseta,
              height: Math.round(loseta * 1.05),
              borderRadius: 18,
              backgroundColor: '#F4F7FB',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {etiqueta ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  zIndex: 1,
                  elevation: 3,
                  backgroundColor: '#E9ECF1',
                  borderRadius: 999,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#5E5E5E' }}>{etiqueta}</Text>
              </View>
            ) : null}
            <Image
              source={ICONO_SERVICIO.get(s.id as Servicio) ?? IMG.servicios.mas}
              style={{ width: icono, height: icono, marginBottom: 2 }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={{ fontWeight: '700', fontSize: 14, color: C.secundario }}>{nombre}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

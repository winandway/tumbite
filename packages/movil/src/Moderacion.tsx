import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import { Text } from './diseno';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { AvisoBorrador } from './AvisoBorrador';
import { useSesion } from './sesion';
import { Boton, C, Campo, e } from './ui';

/**
 * C-MODERACION (16 nov 2026, todos los países). Regla 1.2 de Apple para apps con chat y reseñas,
 * como Uber, DoorDash y Rappi: «Reportar» en cada mensaje y en cada reseña (motivo y nota), y
 * «Bloquear» a la otra persona del pedido o del viaje. Quien fue reportado o bloqueado no se entera.
 * Una sola pieza para las tres apps (Android, iPhone y web).
 */
export type TipoReporte = 'mensaje_pedido' | 'mensaje_viaje' | 'resena' | 'respuesta_resena';
const MOTIVOS = ['ofensivo', 'acoso', 'spam', 'otro'] as const;

/** Lee un texto de una lista por su clave (sin índices sueltos). */
const de = (o: Record<string, string>, k: string) => new Map(Object.entries(o)).get(k) ?? k;

const T = {
  es: {
    reportar: 'Reportar',
    titulo: {
      mensaje_pedido: 'Reportar este mensaje',
      mensaje_viaje: 'Reportar este mensaje',
      resena: 'Reportar esta reseña',
      respuesta_resena: 'Reportar esta respuesta',
    } as Record<TipoReporte, string>,
    ayuda:
      'Lo revisa una persona de nuestro equipo en menos de 24 horas. Nadie sabrá que fuiste tú.',
    motivo: '¿Qué pasa?',
    motivos: {
      ofensivo: 'Es ofensivo',
      acoso: 'Es acoso o una amenaza',
      spam: 'Es spam o publicidad',
      otro: 'Otra cosa',
    } as Record<string, string>,
    nota: 'Cuéntanos más (opcional)',
    enviar: 'Enviar reporte',
    cancelar: 'Cancelar',
    gracias: 'Gracias. Recibimos tu reporte y nuestro equipo lo revisa.',
    cerrar: 'Cerrar',
    masOpciones: 'Más opciones',
    bloquear: (n: string) => `Bloquear a ${n || 'esta persona'}`,
    bloquearTitulo: (n: string) => `¿Bloquear a ${n || 'esta persona'}?`,
    bloquearAyuda:
      'Dejarás de ver sus mensajes y de recibir sus avisos, y no volveremos a emparejarte con esta persona en pedidos ni viajes. No se le avisa. Puedes desbloquear cuando quieras en tu cuenta.',
    bloquearSi: 'Bloquear',
    bloqueado: (n: string) => `Bloqueaste a ${n || 'esta persona'}. Ya no verás sus mensajes.`,
    listaTitulo: 'Personas bloqueadas',
    listaVacia: 'No bloqueaste a nadie.',
    desbloquear: 'Desbloquear',
    desde: 'Desde',
  },
  en: {
    reportar: 'Report',
    titulo: {
      mensaje_pedido: 'Report this message',
      mensaje_viaje: 'Report this message',
      resena: 'Report this review',
      respuesta_resena: 'Report this reply',
    } as Record<TipoReporte, string>,
    ayuda: 'A person on our team reviews it within 24 hours. No one will know it was you.',
    motivo: 'What’s wrong?',
    motivos: {
      ofensivo: 'It’s offensive',
      acoso: 'It’s harassment or a threat',
      spam: 'It’s spam or advertising',
      otro: 'Something else',
    } as Record<string, string>,
    nota: 'Tell us more (optional)',
    enviar: 'Send report',
    cancelar: 'Cancel',
    gracias: 'Thanks. We got your report and our team will review it.',
    cerrar: 'Close',
    masOpciones: 'More options',
    bloquear: (n: string) => `Block ${n || 'this person'}`,
    bloquearTitulo: (n: string) => `Block ${n || 'this person'}?`,
    bloquearAyuda:
      'You’ll stop seeing their messages and getting their notifications, and we won’t match you with this person again on orders or rides. They aren’t notified. You can unblock anytime from your account.',
    bloquearSi: 'Block',
    bloqueado: (n: string) => `You blocked ${n || 'this person'}. You won’t see their messages.`,
    listaTitulo: 'Blocked people',
    listaVacia: 'You haven’t blocked anyone.',
    desbloquear: 'Unblock',
    desde: 'Since',
  },
};

/** El fondo oscuro y la tarjeta de abajo de las hojas de moderación. */
function Hoja({
  visible,
  alCerrar,
  etiqueta,
  children,
}: {
  visible: boolean;
  alCerrar: () => void;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={alCerrar}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={alCerrar}
        accessibilityLabel={etiqueta}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 20,
            paddingBottom: 34,
            maxHeight: '88%',
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** La hoja para reportar un mensaje, una reseña o una respuesta. Guarda la nota (C-BORRADOR). */
export function HojaReportar({
  visible,
  tipo,
  id,
  alCerrar,
}: {
  visible: boolean;
  tipo: TipoReporte;
  id: number | string;
  alCerrar: () => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]>('ofensivo');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: `reporte-${tipo}-${id}`,
    cuenta: usuario?.id,
    inicial: { nota: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cerrar = () => {
    setListo(false);
    setError('');
    alCerrar();
  };
  async function enviar() {
    setEnviando(true);
    setError('');
    try {
      await api.pedir('POST', '/datos/reportes', { tipo, id, motivo, nota: b.valores.nota });
      await b.limpiar();
      setListo(true);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Hoja visible={visible} alCerrar={cerrar} etiqueta={t.cerrar}>
      {listo ? (
        <View accessibilityRole="summary">
          <Text style={{ fontWeight: '700', fontSize: 17, marginBottom: 14 }}>{t.gracias}</Text>
          <Boton texto={t.cerrar} alTocar={cerrar} exito />
        </View>
      ) : (
        <View>
          <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 4 }}>
            {de(t.titulo, tipo)}
          </Text>
          <Text style={{ color: C.gris, marginBottom: 12 }}>{t.ayuda}</Text>
          <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>{t.motivo}</Text>
          <View style={{ marginBottom: 12 }} accessibilityRole="radiogroup">
            {MOTIVOS.map((m, i) => (
              <Pressable
                key={m}
                onPress={() => setMotivo(m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: motivo === m }}
                accessibilityLabel={de(t.motivos, m)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  borderTopWidth: i ? 1 : 0,
                  borderColor: '#ECEDEF',
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: motivo === m ? C.primario : '#9A9EA5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {motivo === m ? (
                    <View
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 6,
                        backgroundColor: C.primario,
                      }}
                    />
                  ) : null}
                </View>
                <Text style={{ flex: 1, fontSize: 16 }}>{de(t.motivos, m)}</Text>
              </Pressable>
            ))}
          </View>
          <Campo
            etiqueta={t.nota}
            value={b.valores.nota}
            onChangeText={(x) => b.cambiar('nota', x.slice(0, 500))}
            multiline
            numberOfLines={3}
          />
          {error ? (
            <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} />
          <Text style={e.enlace} onPress={cerrar} accessibilityRole="button">
            {t.cancelar}
          </Text>
        </View>
      )}
    </Hoja>
  );
}

/** El enlace chico «Reportar» que va debajo de un mensaje o de una reseña. */
export function BotonReportar({
  tipo,
  id,
  claro,
}: {
  tipo: TipoReporte;
  id: number | string;
  /** Sobre un fondo oscuro (la burbuja propia), en blanco. */
  claro?: boolean;
}) {
  const { idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  // Sin cuenta no se reporta (tampoco se escribe nada): el botón aparece al entrar.
  if (!usuario) return null;
  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={de(t.titulo, tipo)}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: claro ? '#fff' : C.gris,
            textDecorationLine: 'underline',
          }}
        >
          {t.reportar}
        </Text>
      </Pressable>
      <HojaReportar visible={abierto} tipo={tipo} id={id} alCerrar={() => setAbierto(false)} />
    </>
  );
}

/**
 * Los tres puntos del chat con «Bloquear a fulano». Bloquear no es borrar, pero se aleja de la mano
 * igual (regla de las acciones fuertes): menú y confirmación.
 */
export function MenuBloquear({
  pedidoId,
  viajeId,
  nombre,
  bloqueaste,
  alBloquear,
}: {
  pedidoId?: string;
  viajeId?: string;
  nombre: string;
  bloqueaste: boolean;
  alBloquear: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [menu, setMenu] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  if (bloqueaste)
    return (
      <Text style={{ color: C.gris, fontSize: 13, marginBottom: 6 }} accessibilityRole="text">
        {t.bloqueado(nombre)}
      </Text>
    );
  async function bloquear() {
    setEnviando(true);
    setError('');
    try {
      await api.pedir('POST', '/datos/bloqueos', pedidoId ? { pedidoId } : { viajeId });
      setConfirmar(false);
      alBloquear();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <>
      <Pressable
        onPress={() => setMenu(true)}
        accessibilityRole="button"
        accessibilityLabel={t.masOpciones}
        hitSlop={10}
        style={{ paddingHorizontal: 8, paddingVertical: 2 }}
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.secundario, lineHeight: 24 }}>
          ⋮
        </Text>
      </Pressable>
      <Hoja visible={menu} alCerrar={() => setMenu(false)} etiqueta={t.cerrar}>
        <Pressable
          onPress={() => {
            setMenu(false);
            setConfirmar(true);
          }}
          accessibilityRole="button"
          style={{ paddingVertical: 14 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.secundario }}>
            {t.bloquear(nombre)}
          </Text>
        </Pressable>
        <Text style={e.enlace} onPress={() => setMenu(false)} accessibilityRole="button">
          {t.cancelar}
        </Text>
      </Hoja>
      <Hoja visible={confirmar} alCerrar={() => setConfirmar(false)} etiqueta={t.cerrar}>
        <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 6 }}>
          {t.bloquearTitulo(nombre)}
        </Text>
        <Text style={{ color: C.gris, marginBottom: 16 }}>{t.bloquearAyuda}</Text>
        {error ? (
          <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Boton texto={t.bloquearSi} alTocar={() => void bloquear()} cargando={enviando} />
        <Text style={e.enlace} onPress={() => setConfirmar(false)} accessibilityRole="button">
          {t.cancelar}
        </Text>
      </Hoja>
    </>
  );
}

/** «Personas bloqueadas» en la cuenta: el nombre de pila, desde cuándo y «Desbloquear». */
export function PersonasBloqueadas() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<{ id: number; nombre: string; desde: string }[] | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    api
      .pedir<{ bloqueos: { id: number; nombre: string; desde: string }[] }>(
        'GET',
        '/datos/bloqueos',
      )
      .then((r) => setLista(r.bloqueos))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(() => cargar(), [cargar]);
  async function desbloquear(id: number) {
    setError('');
    try {
      await api.pedir('DELETE', `/datos/bloqueos/${id}`);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const fecha = (sql: string) => {
    const d = new Date(`${sql.replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es', { day: 'numeric', month: 'short' });
  };
  return (
    <View style={e.tarjeta} accessibilityLabel={t.listaTitulo}>
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>{t.listaTitulo}</Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {lista && !lista.length ? <Text style={{ color: C.gris }}>{t.listaVacia}</Text> : null}
      {(lista ?? []).map((b) => (
        <View
          key={b.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            borderTopWidth: 1,
            borderColor: '#ECEDEF',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{b.nombre}</Text>
            <Text style={{ color: C.gris, fontSize: 12 }}>
              {t.desde} {fecha(b.desde)}
            </Text>
          </View>
          <Pressable
            onPress={() => void desbloquear(b.id)}
            accessibilityRole="button"
            accessibilityLabel={`${t.desbloquear} ${b.nombre}`}
            style={{
              borderWidth: 1,
              borderColor: '#D6D8DC',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontWeight: '700' }}>{t.desbloquear}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

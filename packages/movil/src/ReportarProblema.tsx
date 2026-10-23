import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, formatearMonto, useBorrador } from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { URL_SERVIDOR, useSesion } from './sesion';
import { AvisoBorrador } from './AvisoBorrador';
import { Boton, Campo, e } from './ui';

const T = {
  es: {
    abrir: 'Tengo un problema',
    titulo: 'Cuéntanos qué pasó',
    ayuda: 'Lo lee una persona del equipo. Te respondemos por correo y en tu conversación.',
    texto: '¿Qué pasó?',
    enviar: 'Enviar',
    cancelar: 'Cancelar',
    listo: 'Recibimos tu mensaje. Te respondemos por correo.',
    ver: 'Ver mi conversación',
    motivo: '¿Qué pasó?',
    motivos: {
      articulo_faltante: 'Faltó algo',
      pedido_incorrecto: 'Me llegó otro pedido o algo distinto',
      frio_o_danado: 'Llegó frío o dañado',
      tarde: 'Llegó muy tarde',
      repartidor: 'Problema con el repartidor',
      otro: 'Otra cosa',
    } as Record<string, string>,
    queFalto: '¿Qué faltó? Marca los platos.',
    reembolsado: 'Te devolvimos {monto} a tu tarjeta por lo que faltó.',
    enRevision: 'Soporte revisa lo que faltó ({monto}) y te responde.',
  },
  en: {
    abrir: 'I have a problem',
    titulo: 'Tell us what happened',
    ayuda: 'A real person on our team reads it. We’ll reply by email and in your conversation.',
    texto: 'What happened?',
    enviar: 'Send',
    cancelar: 'Cancel',
    listo: 'We got your message. We’ll reply by email.',
    ver: 'See my conversation',
    motivo: 'What happened?',
    motivos: {
      articulo_faltante: 'Something was missing',
      pedido_incorrecto: 'I got the wrong order or item',
      frio_o_danado: 'It arrived cold or damaged',
      tarde: 'It arrived very late',
      repartidor: 'Problem with the driver',
      otro: 'Something else',
    } as Record<string, string>,
    queFalto: 'What was missing? Check the items.',
    reembolsado: 'We refunded {monto} to your card for what was missing.',
    enRevision: 'Support is reviewing what was missing ({monto}) and will reply.',
  },
};

/**
 * Quejas y pedidos de ayuda desde las tres apps: abre un ticket (con el pedido, si hay) y la
 * persona recibe su enlace privado. Lo ven el superadmin y el franquiciado de esa ciudad.
 * Nunca pierde lo escrito. Candado C-QUEJAS.
 */
export function ReportarProblema({
  pedidoId,
  textoBoton,
}: {
  pedidoId?: string;
  textoBoton?: string;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState('');
  // Queja guiada (auditoría final, punto 16): motivo y, si faltó algo, qué platos.
  const [motivo, setMotivo] = useState('otro');
  const [platos, setPlatos] = useState<Set<string>>(new Set());
  const [lineas, setLineas] = useState<
    { platoId: string; nombreEs: string; nombreEn: string; cantidad: number }[]
  >([]);
  // C-MONEDA-RECORRIDO: el reembolso se cuenta en la moneda del pedido.
  const [moneda, setMoneda] = useState('USD');
  useEffect(() => {
    if (!pedidoId || !abierto) return;
    let vivo = true;
    api
      .pedir<{
        pedido: {
          lineas: { platoId: string; nombreEs: string; nombreEn: string; cantidad: number }[];
          moneda?: string;
        };
      }>('GET', `/datos/pedidos/${pedidoId}`)
      .then((r) => {
        if (!vivo) return;
        setLineas(r.pedido.lineas ?? []);
        setMoneda(r.pedido.moneda ?? 'USD');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, pedidoId, abierto]);
  const b = useBorrador({
    formulario: `queja-${pedidoId ?? 'general'}`,
    cuenta: usuario?.id,
    inicial: { texto: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  async function enviar() {
    setError('');
    setEnviando(true);
    try {
      const r = await api.pedir<{ enlace: string; propuesta?: number; reembolso?: number }>(
        'POST',
        '/datos/quejas',
        {
          tipo: 'queja',
          pedidoId: pedidoId ?? null,
          texto: b.valores.texto,
          motivo: pedidoId ? motivo : 'otro',
          platoIds: pedidoId && motivo === 'articulo_faltante' ? [...platos] : [],
        },
      );
      await b.limpiar();
      if (r.reembolso)
        setResultado(t.reembolsado.replace('{monto}', formatearMonto(r.reembolso, moneda, idioma)));
      else if (r.propuesta)
        setResultado(t.enRevision.replace('{monto}', formatearMonto(r.propuesta, moneda, idioma)));
      setEnlace(r.enlace);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (enlace)
    return (
      <View style={e.tarjeta} accessibilityRole="summary">
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>{t.listo}</Text>
        {resultado ? (
          <Text style={{ color: '#0D7A3A', fontWeight: '700', marginBottom: 8 }}>{resultado}</Text>
        ) : null}
        <Boton
          texto={t.ver}
          alTocar={() => void Linking.openURL(`${URL_SERVIDOR}${enlace}`)}
          secundario
        />
      </View>
    );
  if (!abierto && !b.valores.texto)
    return <Boton texto={textoBoton ?? t.abrir} alTocar={() => setAbierto(true)} secundario />;
  return (
    <View style={e.tarjeta}>
      <Text style={{ fontWeight: '800', fontSize: 17, marginBottom: 4 }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.ayuda}</Text>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {pedidoId ? (
        <>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>{t.motivo}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {Object.entries(t.motivos).map(([clave, etiqueta]) => (
              <Pressable
                key={clave}
                onPress={() => setMotivo(clave)}
                accessibilityRole="radio"
                accessibilityState={{ checked: motivo === clave }}
                accessibilityLabel={etiqueta}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: motivo === clave ? '#F20D20' : '#DADADA',
                  backgroundColor: motivo === clave ? '#F20D20' : '#fff',
                }}
              >
                <Text style={{ color: motivo === clave ? '#fff' : '#101010', fontWeight: '700' }}>
                  {etiqueta}
                </Text>
              </Pressable>
            ))}
          </View>
          {motivo === 'articulo_faltante' && lineas.length ? (
            <View style={{ marginBottom: 10, gap: 6 }}>
              <Text style={{ fontWeight: '700' }}>{t.queFalto}</Text>
              {lineas.map((l) => {
                const marcado = platos.has(l.platoId);
                return (
                  <Pressable
                    key={l.platoId}
                    onPress={() =>
                      setPlatos((s) => {
                        const n = new Set(s);
                        if (marcado) n.delete(l.platoId);
                        else n.add(l.platoId);
                        return n;
                      })
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: marcado }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        borderWidth: 2,
                        borderColor: marcado ? '#F20D20' : '#8A8A8A',
                        backgroundColor: marcado ? '#F20D20' : '#fff',
                      }}
                    />
                    <Text style={{ flex: 1 }}>
                      {l.cantidad} × {idioma === 'en' ? l.nombreEn || l.nombreEs : l.nombreEs}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
      <Campo
        etiqueta={t.texto}
        value={b.valores.texto}
        onChangeText={(x) => b.cambiar('texto', x)}
        multiline
        numberOfLines={4}
      />
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} />
      <Text
        style={e.enlace}
        onPress={() => {
          setAbierto(false);
          void b.limpiar();
        }}
        accessibilityRole="button"
      >
        {t.cancelar}
      </Text>
    </View>
  );
}

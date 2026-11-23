import { IconoServicio } from './IconoServicio';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { ErrorApi } from '@tumbite/compartido';
import {
  Boton,
  COLOR,
  FUENTE,
  Icono,
  LETRA,
  MotivoRechazo,
  PildoraPapel,
  RADIO,
  Text,
  estadoPapel,
  useSesion,
} from '@tumbite/movil';
import { MisDatos } from '../MisDatos';
import { Verificacion } from '../Verificacion';
import { AltaPasajeros } from '../viajes/AltaPasajeros';
import { IMG } from '../piezas/recursos';
import {
  destinoDePaso,
  nombreServicio,
  unirLista,
  type Destino,
  type ServicioPanel,
} from './logica';
import { textosServicios } from './textos';

/**
 * C-SERVICIOS-CONECTADOS (pantalla 05 de DRIVER.md, «perfil compartido») — todos los países.
 * Agregar un servicio sin repetir los datos: arriba lo que ya está verificado (en verde, «no se
 * vuelve a pedir»), abajo solo lo que falta para ESTE servicio, numerado. Cada paso abre la pantalla
 * de alta que ya existe para ese papel (identidad, alta de moto o de carro, datos de reparto), que
 * ofrecen «Tomar foto» y «Subir archivo» y guardan lo escrito (borrador).
 */
type Papel = {
  requisito: string;
  grupo: 'perfil' | 'vehiculo';
  nombre: string;
  estado: 'aprobado' | 'pendiente' | 'rechazado' | 'falta';
  motivo?: string;
};
type Requisitos = { verificados: Papel[]; faltan: Papel[] };

export function AgregarServicio({
  servicio,
  aprobados,
  alVolver,
  alCambiar,
}: {
  servicio: ServicioPanel;
  /** Los nombres de los servicios que ya tiene aprobados («Comida y Moto»). */
  aprobados: string[];
  alVolver: () => void;
  /** Al pedir el servicio o al volver de un paso: el inicio vuelve a leer el panel. */
  alCambiar: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = textosServicios(idioma);
  const [req, setReq] = useState<Requisitos | null>(null);
  const [identidad, setIdentidad] = useState<string>('');
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [abierto, setAbierto] = useState<Destino | null>(null);
  const nombre = nombreServicio(servicio, idioma);

  const cargar = useCallback(async () => {
    try {
      const [r, k] = await Promise.all([
        api.pedir<Requisitos>(
          'GET',
          `/datos/conductor/servicios/${servicio.servicioId}/requisitos`,
        ),
        api.pedir<{ kyc: { estado: string } }>('GET', '/datos/kyc').catch(() => null),
      ]);
      setReq(r);
      setIdentidad(k?.kyc.estado ?? '');
      setError('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }, [api, servicio.servicioId]);
  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(primero);
  }, [cargar]);
  useEffect(() => {
    if (identidad !== 'aprobado') return;
    let vivo = true;
    api
      .verFoto('/datos/kyc/mi-foto')
      .then((u) => vivo && setFoto(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, identidad]);

  async function pedir() {
    setPidiendo(true);
    setError('');
    try {
      await api.pedir('POST', `/datos/conductor/servicios/${servicio.servicioId}/solicitar`, {});
      setAviso(t.pedido);
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setPidiendo(false);
    }
  }

  // ───── Un paso abierto: la pantalla de alta que ya existe para ese papel ─────
  if (abierto)
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Cabecera
          titulo={nombre}
          volver={t.volver}
          alVolver={() => {
            setAbierto(null);
            void cargar();
            alCambiar();
          }}
        />
        {abierto === 'identidad' ? (
          <Verificacion />
        ) : abierto === 'alta-moto' ? (
          <AltaPasajeros servicio="moto" />
        ) : abierto === 'alta-carro' ? (
          <AltaPasajeros servicio="carro" />
        ) : (
          <MisDatos />
        )}
      </View>
    );

  // La identidad va primero, como en el diseño (foto, nombre, documento y después lo demás).
  const verificados = [...(req?.verificados ?? [])].sort(
    (a, b) => Number(b.requisito === 'identidad') - Number(a.requisito === 'identidad'),
  );
  const faltan = req?.faltan ?? [];
  const identidadOk = identidad === 'aprobado';
  const vehiculo =
    servicio.servicioId === 'moto' ? 'moto' : servicio.servicioId === 'carro' ? 'carro' : null;
  const subtitulo = [
    aprobados.length ? t.yaVerificadoPara(unirLista(aprobados, idioma)) : '',
    faltan.length
      ? t.soloLoDe(
          (vehiculo ? new Map(Object.entries(t.loDelVehiculo)).get(vehiculo) : null) ??
            t.loQueFalta,
        )
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  const primero = faltan[0];

  async function usarVehiculo(vehiculoId: string) {
    setError('');
    try {
      await api.pedir('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId });
      alCambiar();
      alVolver();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : String(e));
    }
  }

  return (
    <View style={{ padding: 16, gap: 16 }} testID="agregar-servicio">
      <Cabecera titulo={t.agregarTitulo} volver={t.volver} alVolver={alVolver} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: RADIO.l,
            backgroundColor: COLOR.superficie,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {vehiculo ? (
            <Image
              source={vehiculo === 'moto' ? IMG.flotaMoto : IMG.flotaCarro}
              style={{ width: 60, height: 40 }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <IconoServicio id={servicio.servicioId} tamano={40} />
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={LETRA.titulo} accessibilityRole="header">
            {nombre}
          </Text>
          {subtitulo ? <Text style={LETRA.secundario}>{subtitulo}</Text> : null}
        </View>
      </View>

      {error ? (
        <Text style={{ color: COLOR.error }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {servicio.cambiarA ? (
        // C-CAMBIAR-VEHICULO (robot, 18 nov 2026): el servicio funciona con otro vehículo aprobado
        // suyo: se dice cuál y se cambia aquí mismo (como «Vehicles» de Uber Driver).
        <View
          testID="cambiar-vehiculo"
          style={{
            borderWidth: 1,
            borderColor: COLOR.borde,
            borderRadius: RADIO.l,
            padding: 16,
            gap: 12,
            backgroundColor: COLOR.blanco,
          }}
        >
          <Text style={LETRA.cuerpo}>
            {t.cambiarVehiculoAyuda(
              servicio.cambiarA.nombre || t.tuOtroVehiculo,
              t.tuVehiculoActual,
            )}
          </Text>
          <Boton
            texto={t.usarMiVehiculo(servicio.cambiarA.nombre || t.tuOtroVehiculo)}
            exito
            testID="usar-vehiculo"
            alTocar={() => void usarVehiculo(servicio.cambiarA!.id)}
          />
        </View>
      ) : null}

      {identidadOk || verificados.length ? (
        <View
          testID="ya-verificado"
          style={{
            borderWidth: 1,
            borderColor: COLOR.borde,
            borderRadius: RADIO.l,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: COLOR.exitoSuave,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icono nombre="shield-checkmark-outline" tamano={20} color={COLOR.exito} />
            <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 15, color: COLOR.exito }}>
              {t.yaVerificado}
            </Text>
          </View>
          {identidadOk ? (
            <>
              <FilaVerificada
                nombre={t.fotoPerfil}
                verificado={t.verificado}
                circulo={
                  foto ? (
                    <Image
                      source={{ uri: foto }}
                      style={{ width: 28, height: 28, borderRadius: 14 }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : undefined
                }
              />
              <FilaVerificada nombre={t.nombreCompleto} verificado={t.verificado} />
            </>
          ) : null}
          {verificados.map((p) => (
            <FilaVerificada key={p.requisito} nombre={p.nombre} verificado={t.verificado} />
          ))}
        </View>
      ) : null}

      {faltan.length ? (
        <View
          testID="falta-servicio"
          style={{ borderWidth: 1, borderColor: COLOR.borde, borderRadius: RADIO.l }}
        >
          <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 15, padding: 16 }}>
            {t.faltaParaServicio(faltan.length)}
          </Text>
          {faltan.map((p, i) => {
            const e = estadoPapel(p.estado);
            return (
              <Pressable
                key={p.requisito}
                onPress={() => setAbierto(destinoDePaso(servicio.servicioId, p.requisito, p.grupo))}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}. ${p.nombre}. ${new Map(Object.entries(t.estados)).get(e) ?? ''}`}
                style={({ pressed }) => ({
                  borderTopWidth: 1,
                  borderTopColor: COLOR.borde,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  gap: 10,
                  backgroundColor: pressed ? COLOR.superficie : 'transparent',
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: COLOR.bordeFuerte,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 13 }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>{p.nombre}</Text>
                  {e !== 'falta' ? (
                    <PildoraPapel
                      estado={e}
                      texto={new Map(Object.entries(t.estados)).get(e) ?? ''}
                    />
                  ) : (
                    <Icono nombre="chevron-forward" tamano={20} color={COLOR.textoSuave} />
                  )}
                </View>
                {e === 'rechazado' && p.motivo ? (
                  <MotivoRechazo etiqueta={t.motivo} texto={p.motivo} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : req ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: COLOR.borde,
            borderRadius: RADIO.l,
            padding: 16,
            gap: 6,
          }}
        >
          <Text style={LETRA.tarjeta}>
            {servicio.estado === 'en_revision' ? t.enRevision : t.todoListo}
          </Text>
          <Text style={LETRA.secundario}>
            {servicio.estado === 'en_revision' ? t.enRevisionTexto : t.todoListoTexto}
          </Text>
        </View>
      ) : null}

      {aviso ? (
        <Text
          style={{ color: COLOR.exito, fontFamily: FUENTE.textoFuerte }}
          accessibilityRole="alert"
        >
          {aviso}
        </Text>
      ) : null}

      {primero ? (
        <BotonRojo
          texto={t.empezar(faltan.length)}
          alTocar={() =>
            setAbierto(destinoDePaso(servicio.servicioId, primero.requisito, primero.grupo))
          }
        />
      ) : req && servicio.estado === 'agregar' && !aviso ? (
        <BotonRojo texto={t.pedirServicio} alTocar={() => void pedir()} cargando={pidiendo} />
      ) : null}
      <Text style={[LETRA.pequeno, { textAlign: 'center' }]}>{t.sirveParaTodos}</Text>
    </View>
  );
}

function Cabecera({
  titulo,
  volver,
  alVolver,
}: {
  titulo: string;
  volver: string;
  alVolver: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={alVolver}
        accessibilityRole="button"
        accessibilityLabel={volver}
        hitSlop={6}
        style={{
          width: 44,
          height: 44,
          borderRadius: RADIO.m,
          borderWidth: 1,
          borderColor: COLOR.borde,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre="chevron-back" tamano={22} />
      </Pressable>
      <Text style={[LETRA.titulo, { flex: 1 }]} accessibilityRole="header" numberOfLines={2}>
        {titulo}
      </Text>
    </View>
  );
}

function FilaVerificada({
  nombre,
  verificado,
  circulo,
}: {
  nombre: string;
  verificado: string;
  circulo?: ReactNode;
}) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: COLOR.borde,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {circulo ?? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: COLOR.exito,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="checkmark" tamano={16} color={COLOR.blanco} />
        </View>
      )}
      <Text style={{ flex: 1, fontSize: 16, lineHeight: 22 }} numberOfLines={2}>
        {nombre}
      </Text>
      <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 13, color: COLOR.exito }}>
        {verificado}
      </Text>
    </View>
  );
}

function BotonRojo({
  texto,
  alTocar,
  cargando,
}: {
  texto: string;
  alTocar: () => void;
  cargando?: boolean;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: RADIO.m,
        backgroundColor: pressed ? COLOR.marcaOscuro : COLOR.marca,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: cargando ? 0.7 : 1,
      })}
    >
      <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 17, color: COLOR.blanco }}>
        {texto}
      </Text>
    </Pressable>
  );
}

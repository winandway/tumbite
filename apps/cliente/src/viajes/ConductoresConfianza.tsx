import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import {
  Boton,
  COLOR,
  ESPACIO,
  EstadoVacio,
  FilaLista,
  Icono,
  LETRA,
  RADIO,
  SOMBRA,
  Text,
  useColores,
  useSesion,
} from '@tumbite/movil';
import { FotoRepartidor } from '../FotoRepartidor';
import { type ConductorConfianza, type RespuestaConfianza, textoVehiculo } from './fijos';
import { TEXTOS_FIJOS } from './textosFijos';

/** Hoja que sube desde abajo, con fondo oscuro que la cierra (la misma de los tres puntos de Mis viajes). */
export function HojaAbajo({
  abierta,
  alCerrar,
  etiquetaCerrar,
  children,
  testID,
}: {
  abierta: boolean;
  alCerrar: () => void;
  etiquetaCerrar: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const col = useColores();
  return (
    <Modal visible={abierta} transparent animationType="fade" onRequestClose={alCerrar}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(16,16,16,0.45)' }}
        onPress={alCerrar}
        accessibilityRole="button"
        accessibilityLabel={etiquetaCerrar}
      />
      <View
        style={[
          {
            backgroundColor: col.fondo,
            borderTopLeftRadius: RADIO.hoja,
            borderTopRightRadius: RADIO.hoja,
            paddingVertical: ESPACIO.s,
            paddingBottom: ESPACIO.xxxl,
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
          },
          SOMBRA.flotante,
        ]}
        testID={testID}
      >
        {children}
      </View>
    </Modal>
  );
}

/** La línea de error o de aviso bueno, igual en todas las pantallas de viajes fijos. */
export function Aviso({ texto, bueno }: { texto: string; bueno?: boolean }) {
  const col = useColores();
  if (!texto) return null;
  return (
    <View
      accessibilityRole={bueno ? 'summary' : 'alert'}
      style={{ flexDirection: 'row', gap: ESPACIO.s, alignItems: 'center' }}
    >
      <Icono
        nombre={bueno ? 'checkmark-circle-outline' : 'alert-circle-outline'}
        color={bueno ? col.exito : COLOR.error}
        tamano={20}
      />
      <Text style={[LETRA.secundario, { color: bueno ? col.exito : COLOR.error, flex: 1 }]}>
        {texto}
      </Text>
    </View>
  );
}

function TarjetaConductor({ c, alOpciones }: { c: ConductorConfianza; alOpciones: () => void }) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  return (
    <View
      testID={`confianza-${c.id}`}
      style={{
        flexDirection: 'row',
        gap: ESPACIO.m,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: col.borde,
        borderRadius: RADIO.l,
        padding: ESPACIO.l,
        backgroundColor: col.fondo,
      }}
    >
      <FotoRepartidor ruta={c.foto ? `/datos/confianza/${c.id}/foto` : null} nombre={c.nombre} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={[LETRA.tarjeta, { color: col.texto }]} numberOfLines={1}>
          {c.nombre}
        </Text>
        {c.vehiculo ? (
          <Text style={[LETRA.secundario, { color: col.textoSuave }]} numberOfLines={1}>
            {textoVehiculo(c.vehiculo)}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.conectado ? COLOR.exitoVivo : col.bordeFuerte,
            }}
          />
          <Text
            style={[
              LETRA.pequeno,
              { color: c.conectado ? col.exito : col.textoSuave, fontWeight: '700' },
            ]}
          >
            {c.conectado ? t.conectado : t.desconectado}
          </Text>
        </View>
        <Text style={[LETRA.pequeno, { color: col.textoSuave }]}>
          {[t.viajesJuntos(c.viajes), c.aceptaMenores ? t.llevaMenores : '']
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Pressable
        onPress={alOpciones}
        accessibilityRole="button"
        accessibilityLabel={t.masOpcionesConductor(c.nombre)}
        testID={`confianza-opciones-${c.id}`}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: RADIO.m,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? col.superficie : 'transparent',
        })}
      >
        <Icono nombre="ellipsis-vertical" color={col.texto} />
      </Pressable>
    </View>
  );
}

/**
 * C-CONDUCTOR-CONFIANZA (16 nov 2026) — todos los países. «Conductores de confianza»: la lista (foto,
 * nombre, vehículo y placa, si está conectado y cuántos viajes hicieron juntos) y quitar, que va
 * dentro de los tres puntos y con confirmación. Se marcan desde «Mis viajes».
 */
export function ConductoresConfianza({ alMisViajes }: { alMisViajes: () => void }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  const [datos, setDatos] = useState<RespuestaConfianza | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [menu, setMenu] = useState<ConductorConfianza | null>(null);
  const [confirmar, setConfirmar] = useState<ConductorConfianza | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(
    () =>
      api
        .pedir<RespuestaConfianza>('GET', '/datos/confianza')
        .then(setDatos)
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
    [api],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function quitar(c: ConductorConfianza) {
    setTrabajando(true);
    setError('');
    try {
      await api.pedir('DELETE', `/datos/confianza/${encodeURIComponent(c.id)}`);
      setOk(t.quitado(c.nombre));
      setConfirmar(null);
      await cargar();
    } catch (x) {
      setConfirmar(null);
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <View style={{ gap: ESPACIO.l }} testID="conductores-confianza">
      <View
        style={{
          flexDirection: 'row',
          gap: ESPACIO.m,
          padding: ESPACIO.l,
          borderRadius: RADIO.l,
          backgroundColor: col.superficie,
        }}
      >
        <Icono nombre="shield-checkmark-outline" color={col.texto} tamano={22} />
        <Text style={[LETRA.secundario, { color: col.texto, flex: 1 }]}>
          {t.conductoresAyuda}
          {datos ? ` ${t.hasta(datos.max)}` : ''}
        </Text>
      </View>
      <Aviso texto={error} />
      <Aviso texto={ok} bueno />
      {datos && datos.conductores.length === 0 ? (
        <EstadoVacio
          icono="people-outline"
          titulo={t.conductores}
          texto={t.conductoresVacio}
          accion={<Boton tipo="fuerte" texto={t.irMisViajes} alTocar={alMisViajes} />}
        />
      ) : null}
      {datos?.conductores.map((c) => (
        <TarjetaConductor key={c.id} c={c} alOpciones={() => setMenu(c)} />
      ))}
      <HojaAbajo
        abierta={menu != null}
        alCerrar={() => setMenu(null)}
        etiquetaCerrar={t.cerrar}
        testID="confianza-menu"
      >
        <FilaLista
          titulo={t.quitar}
          icono="trash-outline"
          peligro
          alTocar={() => {
            setConfirmar(menu);
            setMenu(null);
          }}
          testID="confianza-quitar"
        />
        <FilaLista titulo={t.cerrar} icono="close" alTocar={() => setMenu(null)} ultima />
      </HojaAbajo>
      <HojaAbajo
        abierta={confirmar != null}
        alCerrar={() => setConfirmar(null)}
        etiquetaCerrar={t.cancelar}
        testID="confianza-confirmar"
      >
        <View style={{ padding: ESPACIO.xl, gap: ESPACIO.m }}>
          <Text style={[LETRA.subtitulo, { color: col.texto }]}>
            {confirmar ? t.confirmarQuitar(confirmar.nombre) : ''}
          </Text>
          <Text style={[LETRA.secundario, { color: col.textoSuave }]}>
            {t.confirmarQuitarAyuda}
          </Text>
          <Boton
            texto={t.siQuitar}
            alTocar={() => confirmar && void quitar(confirmar)}
            cargando={trabajando}
            testID="confianza-si-quitar"
          />
          <Boton tipo="borde" texto={t.cancelar} alTocar={() => setConfirmar(null)} />
        </View>
      </HojaAbajo>
    </View>
  );
}

/**
 * C-CONDUCTOR-CONFIANZA: «Pedir primero a: Juan ▾» al pedir o reservar Moto, Carro o un envío. Solo
 * aparece si la persona tiene conductores de confianza para ese servicio. `valor` vacío = que elija
 * el servidor (el más cercano de los suyos conectado; en una reserva, el primero de los suyos).
 */
export function PedirPrimeroA({
  servicio,
  valor,
  cambiar,
  reserva,
}: {
  servicio: string;
  valor: string;
  cambiar: (v: string) => void;
  reserva: boolean;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  const [datos, setDatos] = useState<RespuestaConfianza | null>(null);
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<RespuestaConfianza>('GET', '/datos/confianza')
      .then((r) => vivo && setDatos(r))
      // Sin red, se pide como siempre (el servidor igual elige a uno de los suyos).
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  const lista = (datos?.conductores ?? []).filter((c) => c.servicios.includes(servicio));
  if (!lista.length) return null;
  const elegido = lista.find((c) => c.id === valor);
  const conectados = lista.filter((c) => c.conectado);
  const nombre =
    valor === 'ninguno'
      ? t.cualquierConductor
      : elegido
        ? elegido.nombre
        : reserva
          ? (lista[0]?.nombre ?? t.cualquierConductor)
          : conectados.length > 1
            ? t.elMasCercano
            : (conectados[0]?.nombre ?? t.cualquierConductor);
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={() => setAbierta(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t.pedirPrimeroA}: ${nombre}`}
        testID="pedir-primero-a"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACIO.s,
          minHeight: 52,
          paddingHorizontal: ESPACIO.l,
          borderRadius: RADIO.m,
          borderWidth: 1,
          borderColor: col.borde,
          backgroundColor: pressed ? col.superficie : col.fondo,
        })}
      >
        <Icono nombre="shield-checkmark-outline" tamano={20} color={col.texto} />
        <Text style={[LETRA.secundario, { color: col.textoSuave }]}>{t.pedirPrimeroA}:</Text>
        <Text style={[LETRA.cuerpoFuerte, { color: col.texto, flex: 1 }]} numberOfLines={1}>
          {nombre}
        </Text>
        <Icono nombre="chevron-down" tamano={18} color={col.texto} />
      </Pressable>
      {valor !== 'ninguno' ? (
        <Text style={[LETRA.pequeno, { color: col.textoSuave }]}>
          {t.pedirPrimeroAyuda(datos?.segundos ?? 60)}
        </Text>
      ) : null}
      <HojaAbajo
        abierta={abierta}
        alCerrar={() => setAbierta(false)}
        etiquetaCerrar={t.cerrar}
        testID="pedir-primero-a-lista"
      >
        <Text
          style={[
            LETRA.subtitulo,
            { color: col.texto, paddingHorizontal: ESPACIO.xl, paddingVertical: ESPACIO.s },
          ]}
        >
          {t.pedirPrimeroA}
        </Text>
        {lista.map((c) => (
          <FilaLista
            key={c.id}
            titulo={c.nombre}
            detalle={[c.conectado ? t.conectado : t.desconectado, textoVehiculo(c.vehiculo)]
              .filter(Boolean)
              .join(' · ')}
            icono={valor === c.id ? 'radio-button-on' : 'radio-button-off'}
            alTocar={() => {
              cambiar(c.id);
              setAbierta(false);
            }}
            derecha={<View />}
            testID={`pedir-primero-${c.id}`}
          />
        ))}
        <FilaLista
          titulo={t.cualquierConductor}
          icono={valor === 'ninguno' ? 'radio-button-on' : 'radio-button-off'}
          alTocar={() => {
            cambiar('ninguno');
            setAbierta(false);
          }}
          derecha={<View />}
          testID="pedir-primero-cualquiera"
          ultima
        />
      </HojaAbajo>
    </View>
  );
}

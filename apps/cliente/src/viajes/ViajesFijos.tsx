import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { ErrorApi, RUTINA, enIdioma, fechaLocalRutina } from '@tumbite/compartido';
import {
  Boton,
  COLOR,
  ESPACIO,
  EstadoVacio,
  FilaLista,
  Icono,
  LETRA,
  Pildora,
  RADIO,
  Text,
  useColores,
  useSesion,
} from '@tumbite/movil';
import { Aviso, HojaAbajo } from './ConductoresConfianza';
import { type Rutina, diaYHoraEn, horaTexto, proximaSalida, textoDias } from './fijos';
import { TEXTOS_FIJOS } from './textosFijos';

/** «2026-11-17» + n días. */
function masDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}

/** «17 nov» / «Nov 17» de una fecha local «2026-11-17». */
function fechaCorta(fecha: string, idioma: 'es' | 'en'): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(
    idioma === 'en' ? 'en-US' : 'es',
    { day: 'numeric', month: 'short', timeZone: 'UTC' },
  );
}

const ICONO_SERVICIO = { moto: 'bicycle-outline', carro: 'car-outline', envios: 'cube-outline' };

function TarjetaFijo({ r, alOpciones }: { r: Rutina; alOpciones: () => void }) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  const proxima = proximaSalida(r);
  const pausada = r.estado === 'pausada';
  const noPuede = (r.salidas ?? []).find((s) => s.conductorNoPuede && s.estado === 'creada');
  const icono =
    (new Map(Object.entries(ICONO_SERVICIO)).get(r.servicio) as 'car-outline' | undefined) ??
    'car-outline';
  return (
    <View
      testID={`fijo-${r.id}`}
      style={{
        borderWidth: 1,
        borderColor: col.borde,
        borderRadius: RADIO.l,
        padding: ESPACIO.l,
        gap: ESPACIO.s,
        backgroundColor: col.fondo,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.s }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: col.superficie,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre={icono} tamano={20} color={col.texto} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[LETRA.tarjeta, { color: col.texto }]} numberOfLines={1}>
            {r.nombre}
          </Text>
          <Text style={[LETRA.secundario, { color: col.textoSuave }]} numberOfLines={1}>
            {t.servicios[r.servicio] ?? r.servicio} · {textoDias(r.dias, idioma)}
          </Text>
        </View>
        <Pressable
          onPress={alOpciones}
          accessibilityRole="button"
          accessibilityLabel={t.masOpcionesFijo(r.nombre)}
          testID={`fijo-opciones-${r.id}`}
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
      <Text style={[LETRA.cuerpoFuerte, { color: col.texto, fontSize: 15 }]}>
        {t.ida} {horaTexto(r.horaIda, idioma)}
        {r.horaVuelta ? ` · ${t.vuelta} ${horaTexto(r.horaVuelta, idioma)}` : ''}
      </Text>
      <Text style={[LETRA.secundario, { color: col.texto }]} numberOfLines={2}>
        {r.origen.direccion} → {r.destino.direccion}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACIO.s }}>
        {r.conductor ? (
          <Pildora
            texto={`${t.conductor}: ${r.conductor.nombre}`}
            icono="shield-checkmark-outline"
          />
        ) : null}
        {r.menor ? <Pildora texto={t.menor(r.menor.nombre)} icono="happy-outline" /> : null}
        {pausada ? (
          <Pildora
            tono="aviso"
            texto={r.pausadaHasta ? t.pausadoHasta(fechaCorta(r.pausadaHasta, idioma)) : t.pausado}
            icono="pause-circle-outline"
          />
        ) : (
          <Pildora tono="exito" texto={t.activo} icono="checkmark-circle-outline" />
        )}
      </View>
      {noPuede && r.conductor ? (
        <Text style={[LETRA.pequeno, { color: COLOR.aviso }]}>{t.noPuede(r.conductor.nombre)}</Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACIO.s,
          borderTopWidth: 1,
          borderTopColor: col.borde,
          paddingTop: ESPACIO.s,
        }}
      >
        <Icono nombre="time-outline" tamano={18} color={col.textoSuave} />
        <Text style={[LETRA.secundario, { color: col.textoSuave, flex: 1 }]} numberOfLines={1}>
          {proxima
            ? `${t.proxima}: ${diaYHoraEn(proxima.hora, r.zonaHoraria, idioma)} · ${proxima.sentido === 'vuelta' ? t.vuelta : t.ida}`
            : t.sinProxima}
        </Text>
      </View>
    </View>
  );
}

type Hoja = 'menu' | 'pausar' | 'saltar' | 'pin' | 'borrar' | null;

/**
 * C-VIAJES-FIJOS (16 nov 2026) — todos los países. «Viajes fijos»: cada uno con su nombre, días,
 * horas, de dónde a dónde, el conductor, el menor y la próxima salida. En los tres puntos: editar,
 * saltar la próxima salida, pausar (con o sin fecha) o reanudar, cambiar el PIN y, al final y con
 * confirmación, borrar. Cada error del servidor se muestra tal cual.
 */
export function ViajesFijos({
  alNuevo,
  alEditar,
}: {
  alNuevo: () => void;
  alEditar: (id: string) => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const col = useColores();
  const [lista, setLista] = useState<Rutina[] | null>(null);
  const [max, setMax] = useState<number>(RUTINA.maxRutinas);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [elegida, setElegida] = useState<Rutina | null>(null);
  const [hoja, setHoja] = useState<Hoja>(null);
  const [pin, setPin] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  // Cada cambio suma una vuelta y la lista se vuelve a pedir (mirar no escribe en la base).
  const [vuelta, setVuelta] = useState(0);
  const cargar = () => setVuelta((n) => n + 1);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ max: number; rutinas: Rutina[] }>('GET', '/datos/rutinas')
      .then((r) => {
        if (!vivo) return;
        setLista(r.rutinas);
        setMax(r.max);
      })
      .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, [api, vuelta]);

  const cerrar = () => {
    setHoja(null);
    setPin('');
  };

  async function hacer(
    metodo: 'POST' | 'PUT' | 'DELETE',
    ruta: string,
    cuerpo: unknown,
    aviso: string,
  ) {
    if (!elegida) return;
    setTrabajando(true);
    setError('');
    setOk('');
    try {
      const r = await api.pedir<{ sinCambiar?: number }>(
        metodo,
        `/datos/rutinas/${elegida.id}${ruta}`,
        cuerpo,
      );
      setOk(r?.sinCambiar ? `${aviso} ${t.sinCambiar(r.sinCambiar)}` : aviso);
      cerrar();
      cargar();
    } catch (x) {
      cerrar();
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }

  const hoy = elegida ? fechaLocalRutina(new Date(), elegida.zonaHoraria) : '';
  const proxima = elegida ? proximaSalida(elegida) : null;
  const delMismoDia =
    elegida && proxima ? elegida.proximas.filter((s) => s.fecha === proxima.fecha) : [];
  const saltada = elegida
    ? (elegida.salidas ?? []).find((s) => s.estado === 'saltada' && s.fecha >= hoy)
    : undefined;

  return (
    <View style={{ gap: ESPACIO.l }} testID="viajes-fijos">
      <Text style={[LETRA.secundario, { color: col.textoSuave }]}>{t.fijosAyuda}</Text>
      <Aviso texto={error} />
      <Aviso texto={ok} bueno />
      {lista && lista.length === 0 ? (
        <EstadoVacio
          icono="repeat-outline"
          titulo={t.fijos}
          texto={t.fijosVacio}
          accion={<Boton texto={t.nuevo} icono="add" alTocar={alNuevo} testID="fijo-nuevo" />}
        />
      ) : null}
      {lista?.map((r) => (
        <TarjetaFijo
          key={r.id}
          r={r}
          alOpciones={() => {
            setElegida(r);
            setHoja('menu');
          }}
        />
      ))}
      {lista && lista.length > 0 ? (
        lista.length < max ? (
          <Boton tipo="fuerte" icono="add" texto={t.nuevo} alTocar={alNuevo} testID="fijo-nuevo" />
        ) : (
          <Text style={[LETRA.secundario, { color: col.textoSuave }]}>{t.hastaFijos(max)}</Text>
        )
      ) : null}

      <HojaAbajo
        abierta={hoja === 'menu'}
        alCerrar={cerrar}
        etiquetaCerrar={t.cerrar}
        testID="fijo-menu"
      >
        {elegida ? (
          <>
            <Text
              style={[
                LETRA.subtitulo,
                { paddingHorizontal: ESPACIO.xl, paddingVertical: ESPACIO.s, color: col.texto },
              ]}
            >
              {elegida.nombre}
            </Text>
            <FilaLista
              titulo={t.accEditar}
              icono="create-outline"
              alTocar={() => {
                cerrar();
                alEditar(elegida.id);
              }}
              testID="fijo-editar"
            />
            {elegida.estado === 'activa' && proxima ? (
              <FilaLista
                titulo={t.accSaltar}
                detalle={diaYHoraEn(proxima.hora, elegida.zonaHoraria, idioma)}
                icono="play-skip-forward-outline"
                alTocar={() => setHoja('saltar')}
                testID="fijo-saltar"
              />
            ) : null}
            {saltada ? (
              <FilaLista
                titulo={t.accNoSaltar}
                detalle={diaYHoraEn(saltada.hora, elegida.zonaHoraria, idioma)}
                icono="arrow-undo-outline"
                alTocar={() =>
                  void hacer('POST', '/no-saltar', { fecha: saltada.fecha }, t.noSaltado)
                }
                testID="fijo-no-saltar"
              />
            ) : null}
            {elegida.estado === 'pausada' ? (
              <FilaLista
                titulo={t.accReanudar}
                icono="play-circle-outline"
                alTocar={() => void hacer('POST', '/reanudar', {}, t.reanudadoOk)}
                testID="fijo-reanudar"
              />
            ) : (
              <FilaLista
                titulo={t.accPausar}
                icono="pause-circle-outline"
                alTocar={() => setHoja('pausar')}
                testID="fijo-pausar"
              />
            )}
            {elegida.menor ? (
              <FilaLista
                titulo={t.accPin}
                icono="keypad-outline"
                alTocar={() => setHoja('pin')}
                testID="fijo-pin"
              />
            ) : null}
            <FilaLista
              titulo={t.accBorrar}
              icono="trash-outline"
              peligro
              alTocar={() => setHoja('borrar')}
              testID="fijo-borrar"
            />
            <FilaLista titulo={t.cerrar} icono="close" alTocar={cerrar} ultima />
          </>
        ) : null}
      </HojaAbajo>

      <HojaAbajo
        abierta={hoja === 'pausar'}
        alCerrar={cerrar}
        etiquetaCerrar={t.cancelar}
        testID="fijo-hoja-pausar"
      >
        <Text
          style={[
            LETRA.subtitulo,
            { padding: ESPACIO.xl, paddingBottom: ESPACIO.s, color: col.texto },
          ]}
        >
          {t.pausarTitulo}
        </Text>
        {(
          [
            [t.pausarSinFecha, null],
            [t.pausarSemana, 7],
            [t.pausarDosSemanas, 14],
            [t.pausarMes, 30],
          ] as const
        ).map(([texto, dias]) => (
          <FilaLista
            key={texto}
            titulo={texto}
            detalle={dias ? t.pausadoHasta(fechaCorta(masDias(hoy, dias - 1), idioma)) : undefined}
            icono="pause-outline"
            alTocar={() =>
              void hacer(
                'POST',
                '/pausar',
                { hasta: dias ? masDias(hoy, dias - 1) : null },
                t.pausadoOk,
              )
            }
            testID={`fijo-pausar-${dias ?? 'sin-fecha'}`}
          />
        ))}
        <FilaLista titulo={t.cancelar} icono="close" alTocar={cerrar} ultima />
      </HojaAbajo>

      <HojaAbajo
        abierta={hoja === 'saltar'}
        alCerrar={cerrar}
        etiquetaCerrar={t.cancelar}
        testID="fijo-hoja-saltar"
      >
        <Text
          style={[
            LETRA.subtitulo,
            { padding: ESPACIO.xl, paddingBottom: ESPACIO.s, color: col.texto },
          ]}
        >
          {t.saltarQue}
        </Text>
        {elegida && proxima
          ? delMismoDia.map((s) => (
              <FilaLista
                key={s.sentido}
                titulo={
                  s.sentido === 'vuelta'
                    ? t.saltarSoloVuelta(diaYHoraEn(s.hora, elegida.zonaHoraria, idioma))
                    : t.saltarSoloIda(diaYHoraEn(s.hora, elegida.zonaHoraria, idioma))
                }
                icono="play-skip-forward-outline"
                alTocar={() =>
                  void hacer('POST', '/saltar', { fecha: s.fecha, sentido: s.sentido }, t.saltado)
                }
                testID={`fijo-saltar-${s.sentido}`}
              />
            ))
          : null}
        {proxima && delMismoDia.length > 1 ? (
          <FilaLista
            titulo={t.saltarAmbas}
            icono="play-skip-forward"
            alTocar={() =>
              void hacer('POST', '/saltar', { fecha: proxima.fecha, sentido: 'ambos' }, t.saltado)
            }
            testID="fijo-saltar-ambos"
          />
        ) : null}
        <FilaLista titulo={t.cancelar} icono="close" alTocar={cerrar} ultima />
      </HojaAbajo>

      <HojaAbajo
        abierta={hoja === 'pin'}
        alCerrar={cerrar}
        etiquetaCerrar={t.cancelar}
        testID="fijo-hoja-pin"
      >
        <View style={{ padding: ESPACIO.xl, gap: ESPACIO.m }}>
          <Text style={[LETRA.subtitulo, { color: col.texto }]}>{t.pinTitulo}</Text>
          <Text style={[LETRA.secundario, { color: col.textoSuave }]}>{t.pinAyuda}</Text>
          <TextInput
            value={pin}
            onChangeText={(x) => setPin(x.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry={false}
            autoComplete="off"
            placeholder={t.pinPlaceholder}
            placeholderTextColor={COLOR.textoTenue}
            accessibilityLabel={t.pin}
            testID="fijo-pin-nuevo"
            style={{
              borderWidth: 1,
              borderColor: col.bordeFuerte,
              borderRadius: RADIO.m,
              height: 56,
              fontSize: 24,
              letterSpacing: 12,
              textAlign: 'center',
              color: col.texto,
            }}
          />
          <Boton
            texto={t.guardarPin}
            cargando={trabajando}
            alTocar={() => {
              if (!/^\d{4}$/.test(pin)) return setError(t.falta.pin ?? '');
              void hacer('PUT', '/pin', { pin }, t.pinGuardado);
            }}
            testID="fijo-pin-guardar"
          />
          <Boton tipo="borde" texto={t.cancelar} alTocar={cerrar} />
        </View>
      </HojaAbajo>

      <HojaAbajo
        abierta={hoja === 'borrar'}
        alCerrar={cerrar}
        etiquetaCerrar={t.cancelar}
        testID="fijo-hoja-borrar"
      >
        <View style={{ padding: ESPACIO.xl, gap: ESPACIO.m }}>
          <Text style={[LETRA.subtitulo, { color: col.texto }]}>
            {elegida ? t.borrarTitulo(elegida.nombre) : ''}
          </Text>
          <Text style={[LETRA.secundario, { color: col.textoSuave }]}>{t.borrarAyuda}</Text>
          <Boton
            texto={t.siBorrar}
            cargando={trabajando}
            alTocar={() => void hacer('DELETE', '', undefined, t.borrado)}
            testID="fijo-si-borrar"
          />
          <Boton tipo="borde" texto={t.cancelar} alTocar={cerrar} />
        </View>
      </HojaAbajo>
    </View>
  );
}

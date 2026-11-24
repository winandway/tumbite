import { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import {
  type CotizacionViaje,
  ErrorApi,
  PAQUETE_MAX_KG,
  TAMANOS_PAQUETE,
  type TamanoPaquete,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  COLOR,
  Campo,
  CampoDireccion,
  ESPACIO,
  Icono,
  LETRA,
  RADIO,
  Text,
  alSalirTelefono,
  almacenTelefono,
  useColores,
  useSesion,
} from '@tumbite/movil';
import { Pildora } from '../comida/piezas';
import { TEXTOS_MOTO } from './textos';
import { Aviso } from './ConductoresConfianza';
import {
  FORMULARIO_VACIO,
  type FormularioRutina,
  type RespuestaConfianza,
  type Rutina,
  SENSIBLES_RUTINA,
  cuerpoRutina,
  diasATexto,
  diasDeTexto,
  formularioDe,
  letrasDias,
  nombreDia,
  paraServicio,
} from './fijos';
import { TEXTOS_FIJOS } from './textosFijos';

/** «0700» → «07:00» mientras se escribe (solo números; los dos puntos los pone la casilla). */
export function formatearHora(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}:${n.slice(2)}`;
}

function Etiqueta({ texto, ayuda }: { texto: string; ayuda?: string }) {
  const col = useColores();
  return (
    <View style={{ gap: 2 }}>
      <Text style={[LETRA.cuerpoFuerte, { color: col.texto, fontSize: 15 }]}>{texto}</Text>
      {ayuda ? <Text style={[LETRA.pequeno, { color: col.textoSuave }]}>{ayuda}</Text> : null}
    </View>
  );
}

function Interruptor({
  texto,
  ayuda,
  valor,
  cambiar,
  testID,
}: {
  texto: string;
  ayuda?: string;
  valor: boolean;
  cambiar: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.m }}>
      <View style={{ flex: 1 }}>
        <Etiqueta texto={texto} ayuda={ayuda} />
      </View>
      <Switch
        value={valor}
        onValueChange={cambiar}
        accessibilityLabel={texto}
        testID={testID}
        trackColor={{ true: COLOR.exito, false: COLOR.bordeFuerte }}
        thumbColor={COLOR.blanco}
        // En la web el interruptor pinta su bolita aparte.
        {...{ activeThumbColor: COLOR.blanco }}
      />
    </View>
  );
}

/**
 * C-VIAJES-FIJOS (16 nov 2026) — todos los países. Crear y editar un viaje fijo: nombre, servicio,
 * de dónde a dónde (siempre con sugerencias de direcciones reales, C-DIRECCION-SUGERENCIAS), días,
 * hora de ida y, si hay, de vuelta, forma de pago de la ciudad (sale de la cotización de esa ruta),
 * conductor de confianza, «Es para un menor» con su PIN, y en Envíos el paquete como un envío normal.
 * Lo escrito no se pierde (borrador), salvo el PIN, que nunca se guarda en el teléfono.
 */
export function FormularioViajeFijo({
  id,
  servicioInicial,
  alGuardar,
}: {
  /** null = nuevo. */
  id: string | null;
  servicioInicial?: string;
  alGuardar: () => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_FIJOS, idioma);
  const tm = enIdioma(TEXTOS_MOTO, idioma);
  const col = useColores();
  const b = useBorrador<FormularioRutina>({
    formulario: `viaje-fijo-${id ?? 'nuevo'}`,
    cuenta: usuario?.id,
    inicial: {
      ...FORMULARIO_VACIO,
      servicio: ['moto', 'carro', 'envios'].includes(servicioInicial ?? '')
        ? (servicioInicial as string)
        : 'moto',
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
    sensibles: SENSIBLES_RUTINA,
  });
  const v = b.valores;
  const cambiar = b.cambiar;
  const [confianza, setConfianza] = useState<RespuestaConfianza | null>(null);
  // La cotización de la ruta escrita ahora: solo vale si es de esa misma ruta (clave).
  const [cotizada, setCotizada] = useState<{
    clave: string;
    cotizacion: CotizacionViaje | null;
    error: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(id != null);
  const pinBase = useRef('');
  const envio = v.servicio === 'envios';

  useEffect(() => {
    let vivo = true;
    api
      .pedir<RespuestaConfianza>('GET', '/datos/confianza')
      .then((r) => vivo && setConfianza(r))
      .catch(() => undefined);
    if (id)
      api
        .pedir<{ rutinas: Rutina[] }>('GET', '/datos/rutinas')
        .then((r) => {
          if (!vivo) return;
          const rutina = r.rutinas.find((x) => x.id === id);
          if (!rutina) return setError(t.falta.nombre ?? '');
          const f = formularioDe(rutina);
          pinBase.current = f.pin;
          b.cargarBase(f);
        })
        .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)))
        .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, id]);

  // Un borrador recuperado no trae el PIN (nunca se guarda): vuelve el que ya estaba guardado.
  useEffect(() => {
    if (b.recuperado && v.esMenor && !v.pin && pinBase.current) cambiar('pin', pinBase.current);
  }, [b.recuperado, v.esMenor, v.pin, cambiar]);

  // Las formas de pago y el tipo de carro salen de la cotización de esa ruta en esa ciudad.
  const claveRuta =
    v.origenLat && v.destinoLat
      ? [v.servicio, v.categoria, v.origenLat, v.origenLng, v.destinoLat, v.destinoLng].join('|')
      : '';
  const cotizacion = cotizada && cotizada.clave === claveRuta ? cotizada.cotizacion : null;
  const sinCotizar = cotizada && cotizada.clave === claveRuta ? cotizada.error : '';
  useEffect(() => {
    if (!claveRuta) return;
    let vivo = true;
    const r = setTimeout(() => {
      api
        .pedir<{ cotizacion: CotizacionViaje }>('POST', '/datos/viajes/cotizar', {
          servicio: v.servicio,
          categoria: v.servicio === 'carro' ? v.categoria || 'estandar' : 'estandar',
          origen: { lat: Number(v.origenLat), lng: Number(v.origenLng), direccion: v.origen },
          destino: { lat: Number(v.destinoLat), lng: Number(v.destinoLng), direccion: v.destino },
          // C-QUIEN-PAGA-EN-TODAS-LAS-PANTALLAS: la tarifa de servicio se muestra aquí abajo.
          tarifaServicio: true,
        })
        .then((x) => {
          if (!vivo) return;
          setCotizada({ clave: claveRuta, cotizacion: x.cotizacion, error: '' });
          const metodos = x.cotizacion.metodosPago ?? ['efectivo'];
          if (!metodos.some((m) => m === b.valores.metodoPago))
            cambiar('metodoPago', metodos[0] ?? 'efectivo');
        })
        .catch((x: unknown) => {
          if (vivo)
            setCotizada({
              clave: claveRuta,
              cotizacion: null,
              error: x instanceof ErrorApi ? x.message : String(x),
            });
        });
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(r);
    };
    // Solo la ruta dispara otra cotización; la dirección escrita y el pago se leen al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, claveRuta]);

  const dias = diasDeTexto(v.dias);
  const letras = letrasDias(idioma);
  const misConductores = paraServicio(confianza?.conductores ?? [], v.servicio);
  const textoTamano = (x: TamanoPaquete) => {
    const kg = new Map(Object.entries(PAQUETE_MAX_KG)).get(x) ?? 0;
    const nombre = new Map(Object.entries(tm.tamanos)).get(x) ?? x;
    return `${nombre} · ${idioma === 'en' ? `${Math.round(kg * 2.2)} lb` : `${kg} kg`}`;
  };

  async function guardar() {
    setError('');
    const r = cuerpoRutina(v, cotizacion?.moneda ?? 'USD');
    if (!r.ok) return setError(new Map(Object.entries(t.falta)).get(r.falta) ?? '');
    setGuardando(true);
    try {
      await api.pedir(
        id ? 'PUT' : 'POST',
        id ? `/datos/rutinas/${id}` : '/datos/rutinas',
        r.cuerpo,
      );
      // Solo se borra lo escrito cuando el servidor confirmó que quedó guardado.
      await b.limpiar();
      alGuardar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <Text style={[LETRA.secundario, { color: col.textoSuave }]}>…</Text>;

  return (
    <View style={{ gap: ESPACIO.l }} testID="formulario-viaje-fijo">
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      <Campo
        etiqueta={t.nombre}
        value={v.nombre}
        onChangeText={(x) => cambiar('nombre', x)}
        placeholder={t.nombreAyuda}
        maxLength={40}
        testID="fijo-nombre"
      />

      <View style={{ gap: ESPACIO.s }}>
        <Etiqueta texto={t.servicio} />
        <View
          style={{ flexDirection: 'row', gap: ESPACIO.s, flexWrap: 'wrap' }}
          accessibilityRole="radiogroup"
        >
          {(['moto', 'carro', 'envios'] as const).map((s) => (
            <Pildora
              key={s}
              texto={new Map(Object.entries(t.servicios)).get(s) ?? s}
              activa={v.servicio === s}
              rol="radio"
              alTocar={() => {
                cambiar('servicio', s);
                if (
                  v.conductorId &&
                  !paraServicio(confianza?.conductores ?? [], s).some((c) => c.id === v.conductorId)
                )
                  cambiar('conductorId', '');
              }}
            />
          ))}
        </View>
      </View>

      {/* C-DIRECCION-SUGERENCIAS: de dónde sale y a dónde va, con su punto exacto. */}
      <CampoDireccion
        etiqueta={t.origen}
        placeholder={t.origenAyuda}
        valor={v.origen}
        cambiar={(x) => {
          cambiar('origen', x);
          cambiar('origenLat', '');
          cambiar('origenLng', '');
        }}
        alElegir={(d) => {
          cambiar('origenLat', String(d.punto.lat));
          cambiar('origenLng', String(d.punto.lng));
        }}
        testID="fijo-origen"
      />
      <CampoDireccion
        etiqueta={t.destino}
        placeholder={t.destinoAyuda}
        valor={v.destino}
        cambiar={(x) => {
          cambiar('destino', x);
          cambiar('destinoLat', '');
          cambiar('destinoLng', '');
        }}
        alElegir={(d) => {
          cambiar('destinoLat', String(d.punto.lat));
          cambiar('destinoLng', String(d.punto.lng));
        }}
        cerca={v.origenLat ? { lat: Number(v.origenLat), lng: Number(v.origenLng) } : null}
        testID="fijo-destino"
      />

      <View style={{ gap: ESPACIO.s }}>
        <Etiqueta texto={t.dias} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
          {letras.map((l, i) => {
            const d = i + 1;
            const activo = dias.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() =>
                  cambiar('dias', diasATexto(activo ? dias.filter((x) => x !== d) : [...dias, d]))
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: activo }}
                accessibilityLabel={nombreDia(d, idioma)}
                testID={`fijo-dia-${d}`}
                style={{
                  flex: 1,
                  maxWidth: 48,
                  aspectRatio: 1,
                  borderRadius: RADIO.pildora,
                  borderWidth: 1.5,
                  borderColor: activo ? col.texto : col.bordeFuerte,
                  backgroundColor: activo ? col.texto : col.fondo,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={[LETRA.cuerpoFuerte, { color: activo ? col.fondo : col.texto }]}>
                  {l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Campo
        etiqueta={t.horaIda}
        value={v.horaIda}
        onChangeText={(x) => cambiar('horaIda', formatearHora(x))}
        placeholder="07:00"
        keyboardType="number-pad"
        maxLength={5}
        testID="fijo-hora-ida"
      />
      {envio ? null : (
        <>
          <Interruptor
            texto={t.conVuelta}
            valor={v.conVuelta}
            cambiar={(x) => cambiar('conVuelta', x)}
            testID="fijo-con-vuelta"
          />
          {v.conVuelta ? (
            <Campo
              etiqueta={t.horaVuelta}
              value={v.horaVuelta}
              onChangeText={(x) => cambiar('horaVuelta', formatearHora(x))}
              placeholder="12:30"
              keyboardType="number-pad"
              maxLength={5}
              testID="fijo-hora-vuelta"
            />
          ) : null}
        </>
      )}
      <Text style={[LETRA.pequeno, { color: col.textoSuave, marginTop: -ESPACIO.m }]}>
        {t.horaAyuda}
      </Text>

      {v.servicio === 'carro' && (cotizacion?.opciones?.length ?? 0) > 1 ? (
        <View style={{ gap: ESPACIO.s }}>
          <Etiqueta texto={t.categoria} />
          <View
            style={{ flexDirection: 'row', gap: ESPACIO.s, flexWrap: 'wrap' }}
            accessibilityRole="radiogroup"
          >
            {(cotizacion?.opciones ?? []).map((o) => (
              <Pildora
                key={o.categoria}
                texto={tm.categorias[o.categoria]}
                activa={(v.categoria || 'estandar') === o.categoria}
                rol="radio"
                alTocar={() => cambiar('categoria', o.categoria)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: ESPACIO.s }}>
        <Etiqueta texto={t.pago} />
        {cotizacion ? (
          <>
            <View
              style={{ flexDirection: 'row', gap: ESPACIO.s, flexWrap: 'wrap' }}
              accessibilityRole="radiogroup"
            >
              {(cotizacion.metodosPago ?? ['efectivo']).map((m) => (
                <Pildora
                  key={m}
                  texto={new Map(Object.entries(t.pagos)).get(m) ?? m}
                  activa={v.metodoPago === m}
                  rol="radio"
                  alTocar={() => cambiar('metodoPago', m)}
                />
              ))}
            </View>
            <Text style={[LETRA.pequeno, { color: col.textoSuave }]}>
              {t.precioHoy}: {formatearMonto(cotizacion.total, cotizacion.moneda, idioma)} ·{' '}
              {(cotizacion.tarifaServicio ?? 0) > 0
                ? `${t.incluyeTarifa(formatearMonto(cotizacion.tarifaServicio ?? 0, cotizacion.moneda, idioma))} `
                : ''}
              {t.precioAyuda}
            </Text>
          </>
        ) : (
          <Text style={[LETRA.pequeno, { color: sinCotizar ? COLOR.error : col.textoSuave }]}>
            {sinCotizar || t.pagoSinRuta}
          </Text>
        )}
      </View>

      <View style={{ gap: ESPACIO.s }}>
        <Etiqueta
          texto={t.conductorFijo}
          ayuda={misConductores.length ? t.conductorFijoAyuda : t.sinConductores}
        />
        {misConductores.length ? (
          <View
            style={{ flexDirection: 'row', gap: ESPACIO.s, flexWrap: 'wrap' }}
            accessibilityRole="radiogroup"
          >
            {misConductores.map((c) => (
              <Pildora
                key={c.id}
                texto={c.nombre}
                activa={v.conductorId === c.id}
                rol="radio"
                alTocar={() => cambiar('conductorId', c.id)}
              />
            ))}
            <Pildora
              texto={t.cualquierConductor}
              activa={!v.conductorId}
              rol="radio"
              alTocar={() => cambiar('conductorId', '')}
            />
          </View>
        ) : null}
      </View>

      {envio ? (
        <View style={{ gap: ESPACIO.m }} testID="fijo-paquete">
          <Campo
            etiqueta={t.paquete}
            value={v.paqueteDescripcion}
            onChangeText={(x) => cambiar('paqueteDescripcion', x)}
            placeholder={t.paqueteAyuda}
          />
          <Etiqueta texto={t.tamano} />
          <View
            style={{ flexDirection: 'row', gap: ESPACIO.s, flexWrap: 'wrap' }}
            accessibilityRole="radiogroup"
          >
            {TAMANOS_PAQUETE.map((x) => (
              <Pildora
                key={x}
                texto={textoTamano(x)}
                activa={(v.paqueteTamano || 'pequeno') === x}
                rol="radio"
                alTocar={() => cambiar('paqueteTamano', x)}
              />
            ))}
          </View>
          <Campo
            etiqueta={t.valor}
            value={v.paqueteValor}
            onChangeText={(x) => cambiar('paqueteValor', x)}
            keyboardType="decimal-pad"
          />
          <Campo
            etiqueta={t.destinatarioNombre}
            value={v.destinatarioNombre}
            onChangeText={(x) => cambiar('destinatarioNombre', x)}
            autoComplete="name"
          />
          <Campo
            etiqueta={t.destinatarioTelefono}
            value={v.destinatarioTelefono}
            onChangeText={(x) => cambiar('destinatarioTelefono', x)}
            keyboardType="phone-pad"
            placeholder={t.destinatarioTelefonoAyuda}
          />
          <Pressable
            onPress={() => cambiar('sinProhibidos', !v.sinProhibidos)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: v.sinProhibidos }}
            style={{
              flexDirection: 'row',
              gap: ESPACIO.m,
              alignItems: 'center',
              paddingVertical: 4,
            }}
            testID="fijo-prohibidos"
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: v.sinProhibidos ? col.exito : col.textoSuave,
                backgroundColor: v.sinProhibidos ? col.exito : col.fondo,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {v.sinProhibidos ? (
                <Icono nombre="checkmark" tamano={16} color={COLOR.blanco} />
              ) : null}
            </View>
            <Text style={[LETRA.secundario, { flex: 1, color: col.texto }]}>{t.sinProhibidos}</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            gap: ESPACIO.m,
            borderWidth: 1,
            borderColor: col.borde,
            borderRadius: RADIO.l,
            padding: ESPACIO.l,
          }}
        >
          <Interruptor
            texto={t.esMenor}
            ayuda={t.esMenorAyuda}
            valor={v.esMenor}
            cambiar={(x) => cambiar('esMenor', x)}
            testID="fijo-es-menor"
          />
          {v.esMenor ? (
            <>
              <Campo
                etiqueta={t.menorNombre}
                value={v.menorNombre}
                onChangeText={(x) => cambiar('menorNombre', x)}
                placeholder={t.menorNombreAyuda}
                maxLength={40}
                testID="fijo-menor-nombre"
              />
              <View style={{ gap: ESPACIO.s }}>
                <Etiqueta texto={t.pin} ayuda={t.pinAyuda} />
                <TextInput
                  value={v.pin}
                  onChangeText={(x) => cambiar('pin', x.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoComplete="off"
                  placeholder={t.pinPlaceholder}
                  placeholderTextColor={COLOR.textoTenue}
                  accessibilityLabel={t.pin}
                  testID="fijo-pin"
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
              </View>
              <Text style={[LETRA.pequeno, { color: col.textoSuave }]}>{t.menorSoloConfianza}</Text>
            </>
          ) : null}
        </View>
      )}

      <Aviso texto={error} />
      <Boton
        texto={t.guardar}
        alTocar={() => void guardar()}
        cargando={guardando}
        testID="fijo-guardar"
      />
    </View>
  );
}

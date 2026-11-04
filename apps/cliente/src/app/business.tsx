import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import {
  ErrorApi,
  enIdioma,
  enIdiomaDireccion,
  numeroFiscalDe,
  PAISES_FLEX,
  cuerposRegistro,
  faltaEnRegistro,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  CampoDireccion,
  URL_SERVIDOR,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Pildora, Tarjeta } from '../comida/piezas';
import { conCuenta } from '../ConCuenta';

/**
 * C-BLOQUE-EN-LA-APP y C-EMPRESA-LEGAL (31 oct 2026, Richard en TestFlight; LG1): la empresa de
 * logística se conoce, se registra con sus datos legales y entra a su panel SIN salir de la app,
 * como Uber Direct y DoorDash Drive. El número fiscal se valida según el país (EIN, RIF, NIT, RFC).
 * El panel se abre en la misma app con un pase de un solo uso (sin volver a escribir la clave).
 */
// C-FLEX-REGISTRO-UNICO: la misma lista de países que el registro de la web.
const PAISES = PAISES_FLEX;

const T = {
  es: {
    titulo: 'Divoox Flex',
    sub: 'Logística para tu empresa',
    queEs:
      'La tecnología para que tu empresa reparta sus paquetes con sus propios conductores: cargas los envíos, armas la ruta (te sugerimos el orden), tu conductor la recoge en tu centro con Divoox Driver y entrega con foto, firma o PIN.',
    pasos: [
      ['Registra tu empresa', 'Con sus datos legales, tu país y tu centro de carga.'],
      ['Carga tus envíos', 'Uno por uno, desde una hoja de cálculo o por la API.'],
      ['Arma y asigna la ruta', 'Te sugerimos el orden de las paradas; la asignas a tu conductor.'],
      ['Sigue cada entrega', 'En vivo, con la prueba de entrega de cada paquete.'],
    ],
    paraQuien:
      'Para tiendas en línea, farmacias, distribuidores y cualquier negocio que entrega todos los días.',
    registrar: 'Registrar mi empresa',
    volver: 'Volver',
    datosEmpresa: 'Datos de la empresa',
    nombre: 'Nombre comercial',
    razon: 'Razón social (como aparece en sus papeles)',
    pais: 'País de la empresa',
    moneda: 'Moneda',
    fiscal: (n: string) => `Número fiscal (${n})`,
    direccionFiscal: 'Dirección fiscal',
    representante: 'Representante legal',
    telefono: 'Teléfono de la empresa',
    centro: 'Tu centro de carga',
    centroAyuda: 'El lugar donde el conductor recoge los paquetes.',
    centroNombre: 'Nombre del centro',
    centroDireccion: 'Dirección del centro',
    ciudad: 'Ciudad',
    acepto: 'Declaro que los datos son reales y que tengo permiso para registrar esta empresa.',
    crear: 'Crear mi empresa',
    falta: 'Completa todos los datos y marca la casilla.',
    fiscalMal: (n: string, ej: string) => `Ese ${n} no tiene la forma correcta. Ejemplo: ${ej}`,
    elegirCentro: 'Elige la dirección del centro de la lista, para guardar su punto exacto.',
    abrirPanel: 'Abrir el panel de mi empresa',
    misEmpresas: 'Tus empresas',
  },
  en: {
    titulo: 'Divoox Flex',
    sub: 'Logistics for your business',
    queEs:
      'The technology for your company to deliver its packages with its own drivers: you load the shipments, build the route (we suggest the order), your driver picks it up at your hub with Divoox Driver and delivers with a photo, signature or PIN.',
    pasos: [
      ['Register your company', 'With its legal details, your country and your loading hub.'],
      ['Load your shipments', 'One by one, from a spreadsheet, or through the API.'],
      ['Build and assign the route', 'We suggest the stop order; you assign it to your driver.'],
      ['Follow every delivery', 'Live, with proof of delivery for each package.'],
    ],
    paraQuien:
      'For online stores, pharmacies, distributors and any business that delivers every day.',
    registrar: 'Register my company',
    volver: 'Back',
    datosEmpresa: 'Company details',
    nombre: 'Business name',
    razon: 'Legal name (as on its documents)',
    pais: 'Company country',
    moneda: 'Currency',
    fiscal: (n: string) => `Tax ID (${n})`,
    direccionFiscal: 'Registered address',
    representante: 'Legal representative',
    telefono: 'Company phone',
    centro: 'Your loading hub',
    centroAyuda: 'Where the driver picks up the packages.',
    centroNombre: 'Hub name',
    centroDireccion: 'Hub address',
    ciudad: 'City',
    acepto: 'I confirm the details are true and that I’m authorized to register this company.',
    crear: 'Create my company',
    falta: 'Fill in every field and check the box.',
    fiscalMal: (n: string, ej: string) => `That ${n} doesn’t look right. Example: ${ej}`,
    elegirCentro: 'Pick the hub address from the list so we save its exact location.',
    abrirPanel: 'Open my company dashboard',
    misEmpresas: 'Your companies',
  },
};

const INICIAL = {
  nombre: '',
  razonSocial: '',
  pais: 'US',
  moneda: 'USD',
  numeroFiscal: '',
  direccionFiscal: '',
  representante: '',
  telefono: '',
  centroNombre: '',
  centroDireccion: '',
  centroLat: '',
  centroLng: '',
  ciudad: '',
  acepto: false,
};

const clave = () => `empresa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function PantallaEmpresas() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [vista, setVista] = useState<'info' | 'registro' | 'panel'>('info');
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  const [pase, setPase] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const b = useBorrador({
    formulario: 'app-empresa-flex',
    cuenta: usuario?.id,
    inicial: INICIAL,
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const v = b.valores;
  const pais = PAISES.find((p) => p.id === v.pais) ?? PAISES[0];
  const fiscal = numeroFiscalDe(v.pais);
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const cargar = useCallback(() => {
    if (!usuario) return;
    api
      .pedir<{ empresas: { id: string; nombre: string }[] }>('GET', '/datos/v1/flex/empresas')
      .then((r) => setEmpresas(r.empresas))
      .catch(() => undefined);
  }, [api, usuario]);
  useEffect(cargar, [cargar]);

  async function abrirPanel() {
    setError('');
    try {
      const r = await api.pedir<{ codigo: string }>('POST', '/datos/cuentas/pase-web', {});
      setPase(r.codigo);
      setVista('panel');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function crear() {
    setError('');
    // C-FLEX-REGISTRO-UNICO: la misma validación que el registro de la web.
    const falta = faltaEnRegistro(v, v.acepto);
    if (falta)
      return setError(
        falta.motivo === 'fiscal'
          ? t.fiscalMal(falta.nombre ?? '', falta.ejemplo ?? '')
          : falta.motivo === 'centro'
            ? t.elegirCentro
            : t.falta,
      );
    setTrabajando(true);
    try {
      const cuerpos = cuerposRegistro(v);
      const e = await api.pedir<{ empresa: { id: string } }>(
        'POST',
        '/datos/v1/flex/empresas',
        cuerpos.empresa,
        { cabeceras: { 'idempotency-key': clave() } },
      );
      await api.pedir('POST', `/datos/v1/flex/empresas/${e.empresa.id}/centros`, cuerpos.centro, {
        cabeceras: { 'idempotency-key': clave() },
      });
      await b.limpiar();
      cargar();
      await abrirPanel();
    } catch (x) {
      // Lo escrito se queda en pantalla (regla de formularios).
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }

  if (vista === 'panel' && pase)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
        <Encabezado titulo={t.titulo} alVolver={() => setVista('info')} etiquetaVolver={t.volver} />
        <WebView
          source={{
            uri: `${URL_SERVIDOR}/datos/cuentas/pase-web/${pase}?ir=${enIdiomaDireccion('/panel/business', idioma)}`,
          }}
          sharedCookiesEnabled
          style={{ flex: 1 }}
          testID="empresas-panel"
        />
      </SafeAreaView>
    );

  const avisoError = error ? (
    <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
      {error}
    </Text>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.fondo }} edges={['top']}>
      <Encabezado
        titulo={t.titulo}
        alVolver={vista === 'registro' ? () => setVista('info') : volver}
        etiquetaVolver={t.volver}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
        testID="empresas"
      >
        {vista === 'info' ? (
          <>
            <View style={{ backgroundColor: C.logistica, borderRadius: 18, padding: 18, gap: 6 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{t.sub}</Text>
              <Text style={{ color: '#E7F1F8', fontSize: 15, lineHeight: 21 }}>{t.queEs}</Text>
            </View>
            <Tarjeta>
              {t.pasos.map(([titulo, ayuda], i) => (
                <View key={titulo} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: C.logisticaAccion,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: C.logisticaTexto, fontWeight: '700' }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontWeight: '700', color: C.secundario, fontSize: 16 }}>
                      {titulo}
                    </Text>
                    <Text style={{ color: '#5E5E5E', lineHeight: 20 }}>{ayuda}</Text>
                  </View>
                </View>
              ))}
            </Tarjeta>
            <Text style={{ color: '#5E5E5E', lineHeight: 20 }}>{t.paraQuien}</Text>
            {avisoError}
            {empresas.length ? (
              <Tarjeta>
                <Text style={{ fontWeight: '700', color: C.secundario, marginBottom: 6 }}>
                  {t.misEmpresas}
                </Text>
                {empresas.map((e) => (
                  <Text key={e.id} style={{ color: C.secundario, paddingVertical: 2 }}>
                    {e.nombre}
                  </Text>
                ))}
              </Tarjeta>
            ) : null}
            {empresas.length ? (
              <Boton texto={t.abrirPanel} logistica alTocar={() => void abrirPanel()} />
            ) : null}
            <Boton
              texto={t.registrar}
              logistica={!empresas.length}
              secundario={empresas.length > 0}
              alTocar={() => (usuario ? setVista('registro') : router.push('/account'))}
            />
          </>
        ) : (
          <View style={{ gap: 4 }} testID="empresa-registro">
            <AvisoBorrador
              visible={b.recuperado}
              idioma={idioma}
              empezar={() => void b.empezarDeNuevo()}
            />
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.secundario }}>
              {t.datosEmpresa}
            </Text>
            <Text style={{ fontWeight: '600', color: C.secundario, marginTop: 8 }}>{t.pais}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 }}>
              {PAISES.map((p) => (
                <Pildora
                  key={p.id}
                  texto={idioma === 'en' ? p.en : p.es}
                  activa={v.pais === p.id}
                  rol="radio"
                  alTocar={() => {
                    b.cambiar('pais', p.id);
                    b.cambiar('moneda', p.monedas[0]);
                  }}
                />
              ))}
            </View>
            {pais.monedas.length > 1 ? (
              <>
                <Text style={{ fontWeight: '600', color: C.secundario }}>{t.moneda}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
                  {pais.monedas.map((m) => (
                    <Pildora
                      key={m}
                      texto={m}
                      activa={v.moneda === m}
                      rol="radio"
                      alTocar={() => b.cambiar('moneda', m)}
                    />
                  ))}
                </View>
              </>
            ) : null}
            <Campo
              etiqueta={t.nombre}
              value={v.nombre}
              onChangeText={(x) => b.cambiar('nombre', x)}
            />
            <Campo
              etiqueta={t.razon}
              value={v.razonSocial}
              onChangeText={(x) => b.cambiar('razonSocial', x)}
            />
            <Campo
              etiqueta={t.fiscal(fiscal.nombre)}
              value={v.numeroFiscal}
              placeholder={fiscal.ejemplo}
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={(x) => b.cambiar('numeroFiscal', x)}
            />
            <CampoDireccion
              etiqueta={t.direccionFiscal}
              valor={v.direccionFiscal}
              cambiar={(x) => b.cambiar('direccionFiscal', x)}
              alElegir={(d) => b.cambiar('direccionFiscal', d.direccion)}
              pais={v.pais}
              testID="empresa-direccion-fiscal"
            />
            <Campo
              etiqueta={t.representante}
              value={v.representante}
              autoComplete="name"
              onChangeText={(x) => b.cambiar('representante', x)}
            />
            <Campo
              etiqueta={t.telefono}
              value={v.telefono}
              keyboardType="phone-pad"
              onChangeText={(x) => b.cambiar('telefono', x)}
            />
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.secundario, marginTop: 12 }}>
              {t.centro}
            </Text>
            <Text style={{ color: '#5E5E5E', marginBottom: 6 }}>{t.centroAyuda}</Text>
            <Campo
              etiqueta={t.centroNombre}
              value={v.centroNombre}
              onChangeText={(x) => b.cambiar('centroNombre', x)}
            />
            <CampoDireccion
              etiqueta={t.centroDireccion}
              valor={v.centroDireccion}
              cambiar={(x) => {
                b.cambiar('centroDireccion', x);
                b.cambiar('centroLat', '');
                b.cambiar('centroLng', '');
              }}
              alElegir={(d) => {
                b.cambiar('centroDireccion', d.direccion);
                b.cambiar('centroLat', String(d.punto.lat));
                b.cambiar('centroLng', String(d.punto.lng));
              }}
              pais={v.pais}
              testID="empresa-centro"
            />
            <Campo
              etiqueta={t.ciudad}
              value={v.ciudad}
              onChangeText={(x) => b.cambiar('ciudad', x)}
            />
            <Pressable
              onPress={() => b.cambiar('acepto', !v.acepto)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: v.acepto }}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8 }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: v.acepto ? C.exito : '#8A8A8A',
                  backgroundColor: v.acepto ? C.exito : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {v.acepto ? <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text> : null}
              </View>
              <Text style={{ flex: 1, color: C.secundario }}>{t.acepto}</Text>
            </Pressable>
            {avisoError}
            <Boton texto={t.crear} logistica cargando={trabajando} alTocar={() => void crear()} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default conCuenta(PantallaEmpresas);

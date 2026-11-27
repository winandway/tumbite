import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
  numeroFiscalValido,
  pasoVigente,
  useBorrador,
  type PasoDeFormulario,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  CampoDireccion,
  FormularioPorPasos,
  URL_SERVIDOR,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
  Text,
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
    // C-FORMULARIO-POR-PASOS: el registro de la empresa en tres pasos.
    pasoEmpresa: 'Tu empresa',
    pasoLegal: 'Datos legales',
    pasoLegalAyuda: 'Como aparecen en los papeles de la empresa.',
    completa: 'Completa esta casilla.',
    marcaCasilla: 'Marca la casilla para crear tu empresa.',
    revisa: 'Para seguir, revisa lo marcado en rojo.',
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
    pasoEmpresa: 'Your company',
    pasoLegal: 'Legal details',
    pasoLegalAyuda: 'As they appear on the company’s documents.',
    completa: 'Fill in this field.',
    marcaCasilla: 'Check the box to create your company.',
    revisa: 'To continue, check what’s marked in red.',
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
  // C-FORMULARIO-POR-PASOS: el paso en el que iba (vuelve al reabrir).
  pasoRegistro: '',
};

/** C-FORMULARIO-POR-PASOS: los pasos del registro de la empresa, en orden. */
const PASOS: readonly PasoDeFormulario[] = [
  { clave: 'empresa', casillas: ['nombre', 'razonSocial'] },
  { clave: 'legal', casillas: ['numeroFiscal', 'direccionFiscal', 'representante', 'telefono'] },
  { clave: 'centro', casillas: ['centroNombre', 'centroDireccion', 'ciudad', 'acepto'] },
];

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
  // C-FORMULARIO-POR-PASOS: el error de cada casilla, a su lado; junto al botón, por qué no avanza.
  const [fallos, setFallos] = useState<Map<string, string>>(new Map());
  const [porQue, setPorQue] = useState('');
  const paso = pasoVigente(PASOS, v.pasoRegistro);
  type Casilla = Exclude<keyof typeof INICIAL, 'acepto' | 'pasoRegistro'>;
  const poner = (campo: Casilla, x: string) => {
    b.cambiar(campo, x);
    setFallos((f) => {
      if (!f.has(campo)) return f;
      const n = new Map(f);
      n.delete(campo);
      if (!n.size) setPorQue('');
      return n;
    });
  };
  /** Valida las casillas de un paso; el error va al lado de cada una. */
  function validarPaso(clave: string): boolean {
    const f = new Map<string, string>();
    const casillas = PASOS.find((p) => p.clave === clave)?.casillas ?? [];
    for (const c of casillas) {
      if (c === 'acepto') continue;
      const valor = new Map(Object.entries(v)).get(c);
      if (typeof valor === 'string' && !valor.trim()) f.set(c, t.completa);
    }
    if (casillas.includes('numeroFiscal') && v.numeroFiscal.trim()) {
      if (!numeroFiscalValido(v.pais, v.numeroFiscal))
        f.set('numeroFiscal', t.fiscalMal(fiscal.nombre, fiscal.ejemplo));
    }
    if (casillas.includes('centroDireccion') && v.centroDireccion.trim() && !v.centroLat)
      f.set('centroDireccion', t.elegirCentro);
    setFallos(f);
    const sinMarcar = casillas.includes('acepto') && !v.acepto;
    setPorQue(f.size ? t.revisa : sinMarcar ? t.marcaCasilla : '');
    return !f.size && !sinMarcar;
  }
  const irAlPaso = (clave: string) => {
    setFallos(new Map());
    setPorQue('');
    setError('');
    b.cambiar('pasoRegistro', clave);
  };
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
    // C-FORMULARIO-POR-PASOS: algo de un paso anterior quedó mal: se vuelve a ese paso.
    if (falta) {
      const malo = PASOS.find((p) => !validarPaso(p.clave));
      if (malo) return b.cambiar('pasoRegistro', malo.clave);
    }
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
                    <Text style={{ color: '#666B73', lineHeight: 20 }}>{ayuda}</Text>
                  </View>
                </View>
              ))}
            </Tarjeta>
            <Text style={{ color: '#666B73', lineHeight: 20 }}>{t.paraQuien}</Text>
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
            {avisoError}
            <FormularioPorPasos
              idioma={idioma}
              paso={paso}
              alCambiarPaso={irAlPaso}
              alSiguiente={validarPaso}
              alTerminar={() => void crear()}
              alSalir={() => setVista('info')}
              textoTerminar={t.crear}
              testIDTerminar="empresa-crear"
              porQue={porQue || null}
              cargando={trabajando}
              testID="empresa-por-pasos"
              logistica
              pasos={[
                {
                  clave: 'empresa',
                  casillas: PASOS[0]?.casillas ?? [],
                  titulo: t.pasoEmpresa,
                  contenido: (
                    <>
                      <Text style={{ fontWeight: '600', color: C.secundario }}>{t.pais}</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginVertical: 6,
                        }}
                      >
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
                        onChangeText={(x) => poner('nombre', x)}
                        placeholder={t.nombre}
                        error={fallos.get('nombre')}
                      />
                      <Campo
                        etiqueta={t.razon}
                        value={v.razonSocial}
                        onChangeText={(x) => poner('razonSocial', x)}
                        error={fallos.get('razonSocial')}
                      />
                    </>
                  ),
                },
                {
                  clave: 'legal',
                  casillas: PASOS[1]?.casillas ?? [],
                  titulo: t.pasoLegal,
                  ayuda: t.pasoLegalAyuda,
                  contenido: (
                    <>
                      <Campo
                        etiqueta={t.fiscal(fiscal.nombre)}
                        value={v.numeroFiscal}
                        placeholder={fiscal.ejemplo}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        onChangeText={(x) => poner('numeroFiscal', x)}
                        error={fallos.get('numeroFiscal')}
                      />
                      <CampoDireccion
                        etiqueta={t.direccionFiscal}
                        valor={v.direccionFiscal}
                        cambiar={(x) => poner('direccionFiscal', x)}
                        alElegir={(d) => poner('direccionFiscal', d.direccion)}
                        pais={v.pais}
                        error={fallos.get('direccionFiscal')}
                        testID="empresa-direccion-fiscal"
                      />
                      <Campo
                        tipo="nombreCompleto"
                        etiqueta={t.representante}
                        value={v.representante}
                        autoComplete="name"
                        placeholder={idioma === 'en' ? 'First and last name' : 'Nombre y apellido'}
                        onChangeText={(x) => poner('representante', x)}
                        error={fallos.get('representante')}
                      />
                      <Campo
                        tipo="celular"
                        etiqueta={t.telefono}
                        value={v.telefono}
                        placeholder={idioma === 'en' ? 'Phone number' : 'Número de teléfono'}
                        onChangeText={(x) => poner('telefono', x)}
                        error={fallos.get('telefono')}
                      />
                    </>
                  ),
                },
                {
                  clave: 'centro',
                  casillas: PASOS[2]?.casillas ?? [],
                  titulo: t.centro,
                  ayuda: t.centroAyuda,
                  contenido: (
                    <>
                      <Campo
                        etiqueta={t.centroNombre}
                        value={v.centroNombre}
                        onChangeText={(x) => poner('centroNombre', x)}
                        error={fallos.get('centroNombre')}
                      />
                      <CampoDireccion
                        etiqueta={t.centroDireccion}
                        valor={v.centroDireccion}
                        cambiar={(x) => {
                          poner('centroDireccion', x);
                          b.cambiar('centroLat', '');
                          b.cambiar('centroLng', '');
                        }}
                        alElegir={(d) => {
                          poner('centroDireccion', d.direccion);
                          b.cambiar('centroLat', String(d.punto.lat));
                          b.cambiar('centroLng', String(d.punto.lng));
                        }}
                        pais={v.pais}
                        error={fallos.get('centroDireccion')}
                        testID="empresa-centro"
                      />
                      <Campo
                        etiqueta={t.ciudad}
                        value={v.ciudad}
                        onChangeText={(x) => poner('ciudad', x)}
                        error={fallos.get('ciudad')}
                      />
                      <Pressable
                        onPress={() => {
                          b.cambiar('acepto', !v.acepto);
                          setPorQue('');
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: v.acepto }}
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          alignItems: 'center',
                          paddingVertical: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: v.acepto ? C.exito : '#6B7078',
                            backgroundColor: v.acepto ? C.exito : '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {v.acepto ? (
                            <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>
                          ) : null}
                        </View>
                        <Text style={{ flex: 1, color: C.secundario }}>{t.acepto}</Text>
                      </Pressable>
                    </>
                  ),
                },
              ]}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default conCuenta(PantallaEmpresas);

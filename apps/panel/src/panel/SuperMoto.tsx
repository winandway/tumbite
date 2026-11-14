import { useCallback, useEffect, useState } from 'react';
import {
  CIUDAD_PRUEBAS_VENEZUELA,
  ErrorApi,
  type Idioma,
  tarifaDeMercado,
  CIUDAD_EL_VIGIA,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { AvisoBorrador } from './AvisoBorrador';
import { CampoClave } from './CampoClave';
import { MenuTresPuntos } from './MenuTresPuntos';
import { pedir } from './api';

/**
 * C-MOTO-PANEL (13 nov 2026): lo que el equipo necesita para preparar y operar Divoox Moto por país,
 * empezando por Venezuela. Abrir Moto en una ciudad, la compuerta de producción del país, los
 * papeles de los conductores, lo que le falta a cada uno y las motos por revisar. Todo en un lugar.
 */
const T = {
  es: {
    titulo: 'Moto · Abrir y aprobar',
    intro:
      'Aquí se prepara Divoox Moto en cada país: se abre la ciudad, se revisan los papeles de los conductores y sus motos, y se habilita a cada conductor. Las tarifas y las emergencias siguen en Moto · Viajes.',
    // 1. Abrir en una ciudad
    abrir: 'Abrir un servicio de viajes en una ciudad',
    abrirAyuda:
      'Para cualquier país: crea la ciudad (o la pone al día), le pone la tarifa y enciende el servicio en ella. En producción, primero tiene que estar abierto el país (abajo). Para cubrir un estado entero, dibuja después el área en Áreas de cobertura de esa ciudad.',
    servicio: 'Servicio',
    nombresServicio: { moto: 'Moto', carro: 'Carro', envios: 'Envíos' } as Record<string, string>,
    tarifaEscribe: 'Tarifa de esta ciudad (en la moneda de los viajes)',
    tarifaEscribeAyuda:
      'Se cobra por calles: banderazo, más lo que cuesta cada kilómetro y cada minuto por la ruta real, sin bajar del mínimo. Se puede cambiar después en Moto · Viajes.',
    usarCaracas: 'Usar Caracas de pruebas',
    usarElVigia: 'Usar El Vigía',
    codigo: 'Código de la ciudad',
    codigoEjemplo: 'País-ciudad-zona, por ejemplo VE-CCS-CENTRO',
    nombre: 'Nombre de la ciudad',
    nombreEjemplo: 'Nombre que verá el equipo',
    lat: 'Latitud del centro',
    lng: 'Longitud del centro',
    coordenada: 'Grados con decimales',
    radio: 'Radio de cobertura (km)',
    zonaHoraria: 'Zona horaria',
    moneda: 'Moneda de los viajes (opcional)',
    monedaEjemplo: 'Código de tres letras; vacío = la del país',
    motivo: 'Motivo (queda en el registro)',
    motivoEjemplo: 'Por qué se abre esta ciudad',
    abrirBoton: (servicio: string) => `Abrir ${servicio} en esta ciudad`,
    abierta: (servicio: string, id: string, pais: string, moneda: string, estado: string) =>
      `${servicio} quedó abierto en ${id} (${pais}, viajes en ${moneda}). Estado: ${estado}.`,
    estados: {
      disponible: 'encendido para todos',
      piloto: 'solo para el piloto',
      proximamente: 'todavía apagado',
    } as Record<string, string>,
    tarifaTitulo: 'Tarifa que se va a cobrar (mercado de Venezuela)',
    tarifaAyuda:
      'Es la tarifa de mercado de Venezuela, en dólares. Se puede cambiar después en Moto · Viajes.',
    base: 'Banderazo',
    porKm: 'Por kilómetro',
    porMinuto: 'Por minuto',
    minimo: 'Precio mínimo',
    numeroInvalido: 'Revisa la latitud, la longitud y el radio: van en números.',
    // 2. Compuerta del país
    compuerta: 'Producción por país',
    compuertaAyuda:
      'En el sitio de pruebas no hace falta abrir el país: Moto se prueba sin esta compuerta. En producción, Moto solo funciona en un país abierto aquí.',
    abiertoEstado: 'Abierto',
    cerradoEstado: 'Cerrado',
    servicioMoto: 'Moto',
    desde: 'desde',
    solicitudVista: 'Solicitud de marca',
    solicitud: 'Número de la solicitud de registro de la marca Divoox en este país',
    solicitudEjemplo: 'El número que dio la oficina de marcas',
    confirmo: 'Confirmo que lo legal y el seguro de pasajeros de este país están listos',
    clave: 'Tu contraseña',
    ver: 'Ver la contraseña',
    ocultar: 'Ocultar la contraseña',
    nota: 'Nota (opcional)',
    abrirPais: 'Abrir en producción',
    paisAbierto: 'El país quedó abierto para Moto en producción.',
    opcionesPais: 'Más opciones del país',
    cerrarPais: 'Cerrar en producción',
    cerrarAviso:
      'Al cerrar, Moto deja de funcionar en todas las ciudades de este país en producción.',
    confirmarCierre: 'Confirmar el cierre',
    cancelar: 'Cancelar',
    paisCerrado: 'El país quedó cerrado para Moto en producción.',
    sinPaises: 'Ningún país se puede abrir todavía para pasajeros.',
    // 3. Papeles
    papeles: 'Papeles de los conductores',
    pendientes: 'Por revisar',
    aprobados: 'Aprobados',
    rechazados: 'Rechazados',
    sinPapeles: 'No hay papeles en esta lista.',
    tiposPapel: {
      licencia_moto: 'Licencia de moto',
      antecedentes_penales: 'Certificado de antecedentes penales',
      licencia_conducir: 'Licencia de conducir',
    } as Record<string, string>,
    estadosPapel: {
      pendiente: 'Por revisar',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
    } as Record<string, string>,
    verArchivo: 'Ver el archivo',
    vence: 'Vence el (opcional)',
    aprobar: 'Aprobar',
    aprobado: 'Aprobado.',
    opcionesPapel: 'Más opciones del papel',
    rechazar: 'Rechazar',
    motivoRechazo: 'Motivo del rechazo (la persona lo ve para corregir)',
    motivoRechazoEjemplo: 'Qué tiene que corregir',
    confirmarRechazo: 'Confirmar el rechazo',
    rechazado: 'Rechazado. La persona ya puede ver el motivo.',
    verConductor: 'Ver lo que le falta',
    subido: 'subido el',
    // 4. Conductor
    conductor: 'Conductor',
    cerrarConductor: 'Cerrar',
    ciudad: 'Ciudad',
    tasaTitulo: 'Tasa de referencia en bolívares',
    tasaAyuda:
      'Copia aquí la tasa oficial del BCV de hoy. Con ella, el pasajero y el conductor ven el equivalente en bolívares junto al precio en dólares. Es solo informativa: el viaje y la comisión siguen en dólares. Si pasan 48 horas sin actualizarla, el equivalente deja de mostrarse.',
    tasaPorDolar: 'bolívares por dólar',
    tasaDel: 'del',
    tasaVigente: 'Vigente',
    tasaVencida: 'Vencida: ya no se muestra',
    tasaSinCargar: 'todavía no hay tasa',
    tasaNueva: 'Tasa de hoy (bolívares por dólar)',
    tasaGuardar: 'Guardar la tasa de hoy',
    tasaGuardada: 'Tasa guardada.',
    cambiarCiudad: 'Cambiar la ciudad del conductor',
    cambiarCiudadAyuda:
      'El conductor puede cambiarla él mismo una vez cada 24 horas y dentro de su país. Aquí el equipo la cambia a cualquier ciudad (también de país); queda en la auditoría.',
    nuevaCiudad: 'Código de la nueva ciudad',
    motivoCiudad: 'Motivo del cambio',
    motivoCiudadEjemplo: 'Por qué se cambia la ciudad',
    cambiarCiudadBoton: 'Cambiar la ciudad',
    ciudadCambiada: 'Ciudad cambiada.',
    nacimiento: 'Fecha de nacimiento',
    sinFecha: 'sin fecha',
    identidad: 'Identidad',
    identidadAyuda: 'La identidad se aprueba en Verificaciones.',
    irVerificaciones: 'Ir a Verificaciones',
    estadosIdentidad: {
      sin_enviar: 'Todavía no la envió',
      pendiente: 'Por revisar',
      aprobado: 'Aprobada',
      aprobada: 'Aprobada',
      rechazado: 'Rechazada',
      rechazada: 'Rechazada',
    } as Record<string, string>,
    motoActiva: 'Moto activa',
    sinMoto: 'Todavía no tiene una moto activa.',
    habilitacion: 'Habilitación para Moto',
    estadosHabilitacion: {
      aprobada: 'Habilitado',
      pendiente: 'Pendiente',
      rechazada: 'Rechazado',
      suspendida: 'Suspendido',
      ninguna: 'Sin habilitar',
    } as Record<string, string>,
    leFalta: 'Le falta',
    nadaFalta: 'No le falta nada para Moto.',
    requisitos: {
      identidad: 'Identidad verificada',
      antecedentes_pasajeros: 'Antecedentes para llevar pasajeros',
      antecedentes: 'Antecedentes penales',
      historial_manejo: 'Historial de manejo',
      licencia_moto: 'Licencia de moto',
      edad_minima_21: 'Tener 21 años o más',
      seguro_pasajeros: 'Seguro de pasajeros',
      casco_pasajero: 'Casco para el pasajero',
      seguro_vehiculo: 'Seguro del vehículo',
      licencia: 'Licencia de conducir',
      inspeccion_vehiculo: 'Revisión del vehículo',
    } as Record<string, string>,
    aprobarEdad: 'Aprobar la edad',
    aprobarCasco: 'Aprobar el casco del pasajero',
    cascoSinMoto: 'El casco se aprueba sobre su moto activa: primero hay que aprobar la moto.',
    habilitar: 'Habilitar para Moto',
    habilitado: 'Conductor habilitado para Moto.',
    // C-CARRO-PANEL: lo mismo para Carro.
    habilitacionCarro: 'Habilitación para Carro',
    nadaFaltaCarro: 'No le falta nada para Carro.',
    habilitarCarro: 'Habilitar para Carro',
    habilitadoCarro: 'Conductor habilitado para Carro.',
    vehiculoActivo: 'Vehículo activo',
    noHabilitado: 'Todavía no se puede habilitar. Le falta:',
    hecho: 'Listo.',
    // 5. Motos
    motos: 'Motos y carros por revisar',
    sinMotos: 'No hay motos ni carros esperando revisión.',
    tiposVehiculo: { moto: 'Moto', carro: 'Carro' } as Record<string, string>,
    plazas: (n: number) => `${n} plazas`,
    documentosCarro: {
      registro: 'Título de propiedad o carnet de circulación',
      seguro: 'Póliza RCV del carro',
      seguro_pasajeros: 'Póliza que cubre a los pasajeros',
      inspeccion: 'Revisión del vehículo (inspección)',
      foto_frente: 'Foto de frente',
      foto_lado: 'Foto de lado',
      foto_placa: 'Foto de la placa',
      foto_interior: 'Foto del interior',
    } as Record<string, string>,
    aprobarCarro: 'Aprobar el carro',
    carroAprobado: 'Carro aprobado.',
    opcionesCarro: 'Más opciones del carro',
    rechazarCarro: 'Rechazar el carro',
    placa: 'Placa',
    documentosMoto: {
      registro: 'Registro (título) de la moto',
      seguro: 'Seguro de la moto',
      seguro_pasajeros: 'Seguro de pasajeros',
      inspeccion: 'Inspección',
      foto_frente: 'Foto de frente',
      foto_lado: 'Foto de lado',
      foto_placa: 'Foto de la placa',
      foto_interior: 'Foto del interior',
    } as Record<string, string>,
    aprobarDoc: 'Aprobar documento',
    aprobarMoto: 'Aprobar la moto',
    motoAprobada: 'Moto aprobada.',
    opcionesMoto: 'Más opciones de la moto',
    rechazarMoto: 'Rechazar la moto',
    sinDocumentos: 'Todavía no subió documentos.',
  },
  en: {
    titulo: 'Moto · Launch and approve',
    intro:
      'This is where Divoox Moto is prepared in each country: open the city, review drivers’ documents and motorbikes, and approve each driver. Pricing and emergencies stay in Moto · Rides.',
    abrir: 'Open a ride service in a city',
    abrirAyuda:
      'For any country: creates the city (or updates it), sets its pricing and turns the service on there. In production, the country has to be open first (below). To cover a whole state, draw the area afterwards in that city’s Coverage areas.',
    servicio: 'Service',
    nombresServicio: { moto: 'Moto', carro: 'Car', envios: 'Courier' } as Record<string, string>,
    tarifaEscribe: 'Pricing for this city (in the ride currency)',
    tarifaEscribeAyuda:
      'Charged by street distance: a base fare, plus each kilometer and each minute along the real route, never below the minimum. You can change it later in Moto · Rides.',
    usarCaracas: 'Use Caracas test city',
    usarElVigia: 'Use El Vigía',
    codigo: 'City code',
    codigoEjemplo: 'Country-city-area, for example VE-CCS-CENTRO',
    nombre: 'City name',
    nombreEjemplo: 'Name the team will see',
    lat: 'Center latitude',
    lng: 'Center longitude',
    coordenada: 'Decimal degrees',
    radio: 'Coverage radius (km)',
    zonaHoraria: 'Time zone',
    moneda: 'Ride currency (optional)',
    monedaEjemplo: 'Three-letter code; empty = the country’s',
    motivo: 'Reason (kept in the log)',
    motivoEjemplo: 'Why this city is opening',
    abrirBoton: (servicio: string) => `Open ${servicio} in this city`,
    abierta: (servicio: string, id: string, pais: string, moneda: string, estado: string) =>
      `${servicio} is now open in ${id} (${pais}, rides in ${moneda}). Status: ${estado}.`,
    estados: {
      disponible: 'on for everyone',
      piloto: 'pilot only',
      proximamente: 'still off',
    } as Record<string, string>,
    tarifaTitulo: 'Pricing that will be charged (Venezuela market)',
    tarifaAyuda:
      'This is the Venezuela market pricing, in dollars. You can change it later in Moto · Rides.',
    base: 'Base fare',
    porKm: 'Per kilometer',
    porMinuto: 'Per minute',
    minimo: 'Minimum fare',
    numeroInvalido: 'Check the latitude, longitude and radius: they must be numbers.',
    compuerta: 'Production by country',
    compuertaAyuda:
      'On the test site you don’t need to open the country: Moto is tested without this gate. In production, Moto only works in a country opened here.',
    abiertoEstado: 'Open',
    cerradoEstado: 'Closed',
    servicioMoto: 'Moto',
    desde: 'since',
    solicitudVista: 'Trademark application',
    solicitud: 'Divoox trademark application number in this country',
    solicitudEjemplo: 'The number given by the trademark office',
    confirmo: 'I confirm the legal work and passenger insurance for this country are ready',
    clave: 'Your password',
    ver: 'Show password',
    ocultar: 'Hide password',
    nota: 'Note (optional)',
    abrirPais: 'Open in production',
    paisAbierto: 'The country is now open for Moto in production.',
    opcionesPais: 'More country options',
    cerrarPais: 'Close in production',
    cerrarAviso: 'Closing stops Moto in every city of this country in production.',
    confirmarCierre: 'Confirm closing',
    cancelar: 'Cancel',
    paisCerrado: 'The country is now closed for Moto in production.',
    sinPaises: 'No country can be opened for passengers yet.',
    papeles: 'Driver documents',
    pendientes: 'To review',
    aprobados: 'Approved',
    rechazados: 'Rejected',
    sinPapeles: 'No documents in this list.',
    tiposPapel: {
      licencia_moto: 'Motorcycle license',
      antecedentes_penales: 'Criminal record certificate',
      licencia_conducir: 'Driver’s license',
    } as Record<string, string>,
    estadosPapel: {
      pendiente: 'To review',
      aprobado: 'Approved',
      rechazado: 'Rejected',
    } as Record<string, string>,
    verArchivo: 'View file',
    vence: 'Expires on (optional)',
    aprobar: 'Approve',
    aprobado: 'Approved.',
    opcionesPapel: 'More document options',
    rechazar: 'Reject',
    motivoRechazo: 'Reason for rejecting (the person sees it to fix it)',
    motivoRechazoEjemplo: 'What they need to fix',
    confirmarRechazo: 'Confirm rejection',
    rechazado: 'Rejected. The person can now see the reason.',
    verConductor: 'See what’s missing',
    subido: 'uploaded on',
    conductor: 'Driver',
    cerrarConductor: 'Close',
    ciudad: 'City',
    tasaTitulo: 'Bolívar reference rate',
    tasaAyuda:
      'Paste today’s official BCV rate here. Riders and drivers then see the bolívar equivalent next to the dollar price. It’s for reference only: the ride and the commission stay in dollars. If it isn’t updated for 48 hours, the equivalent stops showing.',
    tasaPorDolar: 'bolívars per dollar',
    tasaDel: 'from',
    tasaVigente: 'Current',
    tasaVencida: 'Expired: no longer shown',
    tasaSinCargar: 'no rate yet',
    tasaNueva: 'Today’s rate (bolívars per dollar)',
    tasaGuardar: 'Save today’s rate',
    tasaGuardada: 'Rate saved.',
    cambiarCiudad: 'Change the driver’s city',
    cambiarCiudadAyuda:
      'Drivers can change it themselves once every 24 hours, within their country. Here the team can move them to any city (including another country); it’s logged in the audit trail.',
    nuevaCiudad: 'New city code',
    motivoCiudad: 'Reason for the change',
    motivoCiudadEjemplo: 'Why the city is changing',
    cambiarCiudadBoton: 'Change city',
    ciudadCambiada: 'City changed.',
    nacimiento: 'Date of birth',
    sinFecha: 'no date',
    identidad: 'Identity',
    identidadAyuda: 'Identity is approved in Verifications.',
    irVerificaciones: 'Go to Verifications',
    estadosIdentidad: {
      sin_enviar: 'Not sent yet',
      pendiente: 'To review',
      aprobado: 'Approved',
      aprobada: 'Approved',
      rechazado: 'Rejected',
      rechazada: 'Rejected',
    } as Record<string, string>,
    motoActiva: 'Active motorbike',
    sinMoto: 'No active motorbike yet.',
    habilitacion: 'Moto approval',
    estadosHabilitacion: {
      aprobada: 'Approved',
      pendiente: 'Pending',
      rechazada: 'Rejected',
      suspendida: 'Suspended',
      ninguna: 'Not approved',
    } as Record<string, string>,
    leFalta: 'Missing',
    nadaFalta: 'Nothing missing for Moto.',
    requisitos: {
      identidad: 'Verified identity',
      antecedentes_pasajeros: 'Background check to carry passengers',
      antecedentes: 'Criminal background',
      historial_manejo: 'Driving record',
      licencia_moto: 'Motorcycle license',
      edad_minima_21: 'Age 21 or older',
      seguro_pasajeros: 'Passenger insurance',
      casco_pasajero: 'Passenger helmet',
      seguro_vehiculo: 'Vehicle insurance',
      licencia: 'Driver’s license',
      inspeccion_vehiculo: 'Vehicle inspection',
    } as Record<string, string>,
    aprobarEdad: 'Approve age',
    aprobarCasco: 'Approve passenger helmet',
    cascoSinMoto: 'The helmet is approved on the active motorbike: approve the motorbike first.',
    habilitar: 'Approve for Moto',
    habilitado: 'Driver approved for Moto.',
    habilitacionCarro: 'Car approval',
    nadaFaltaCarro: 'Nothing missing for Car.',
    habilitarCarro: 'Approve for Car',
    habilitadoCarro: 'Driver approved for Car.',
    vehiculoActivo: 'Active vehicle',
    noHabilitado: 'Can’t approve yet. Missing:',
    hecho: 'Done.',
    motos: 'Motorbikes and cars to review',
    sinMotos: 'No motorbikes or cars waiting for review.',
    tiposVehiculo: { moto: 'Moto', carro: 'Car' } as Record<string, string>,
    plazas: (n: number) => `${n} seats`,
    documentosCarro: {
      registro: 'Vehicle title or registration',
      seguro: 'Car liability insurance',
      seguro_pasajeros: 'Policy that covers passengers',
      inspeccion: 'Vehicle inspection',
      foto_frente: 'Front photo',
      foto_lado: 'Side photo',
      foto_placa: 'Plate photo',
      foto_interior: 'Interior photo',
    } as Record<string, string>,
    aprobarCarro: 'Approve car',
    carroAprobado: 'Car approved.',
    opcionesCarro: 'More car options',
    rechazarCarro: 'Reject car',
    placa: 'Plate',
    documentosMoto: {
      registro: 'Motorbike registration',
      seguro: 'Motorbike insurance',
      seguro_pasajeros: 'Passenger insurance',
      inspeccion: 'Inspection',
      foto_frente: 'Front photo',
      foto_lado: 'Side photo',
      foto_placa: 'Plate photo',
      foto_interior: 'Interior photo',
    } as Record<string, string>,
    aprobarDoc: 'Approve document',
    aprobarMoto: 'Approve motorbike',
    motoAprobada: 'Motorbike approved.',
    opcionesMoto: 'More motorbike options',
    rechazarMoto: 'Reject motorbike',
    sinDocumentos: 'No documents uploaded yet.',
  },
};

type Textos = (typeof T)['es'];
const enPalabras = (mapa: Record<string, string>, clave: string | null | undefined) =>
  new Map(Object.entries(mapa)).get(clave ?? '') ?? clave ?? '';
const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

// ---------------------------------------------------------------- 1. abrir en una ciudad

const CODIGO_CIUDAD = /^[A-Z]{2}-[A-Z0-9]{2,3}-[A-Z0-9-]{2,30}$/;

function AbrirCiudad({ idioma, t }: { idioma: Idioma; t: Textos }) {
  const b = useBorrador({
    formulario: 'moto-abrir-ciudad',
    cuenta: 'superadmin',
    inicial: {
      id: '',
      nombre: '',
      lat: '',
      lng: '',
      radioKm: '25',
      zonaHoraria: 'America/Caracas',
      moneda: '',
      motivo: '',
      servicio: 'moto',
      base: '',
      porKm: '',
      porMinuto: '',
      minimo: '',
    },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);
  const v = b.valores;
  const servicio = v.servicio === 'carro' || v.servicio === 'envios' ? v.servicio : 'moto';
  const nombreServicio = enPalabras(t.nombresServicio, servicio);
  const venezuela = v.id.trim().toUpperCase().startsWith('VE');
  // C-ABRIR-CIUDAD (13 nov 2026): Moto y Carro en Venezuela traen tarifa de mercado
  // (C-CARRO-TARIFA-VE); lo demás se escribe.
  const deMercado = tarifaDeMercado('VE', servicio);
  const conTarifaDeMercado = Boolean(deMercado) && (venezuela || !v.id.trim());
  const monedaTarifa = v.moneda.trim().toUpperCase() || 'USD';
  const tarifaEscrita = {
    base: textoAMonto(v.base || '', monedaTarifa),
    porKm: textoAMonto(v.porKm || '', monedaTarifa),
    porMinuto: textoAMonto(v.porMinuto || '', monedaTarifa),
    minimo: textoAMonto(v.minimo || '', monedaTarifa),
  };
  const tarifaLista =
    [v.base, v.porKm, v.porMinuto, v.minimo].every((x) => (x ?? '').trim() !== '') &&
    Object.values(tarifaEscrita).every((n) => Number.isFinite(n) && n >= 0);
  const usd = (c: number) => formatearMonto(c, 'USD', idioma);

  function usarCiudad(c: typeof CIUDAD_PRUEBAS_VENEZUELA | typeof CIUDAD_EL_VIGIA) {
    b.setValores((antes) => ({
      ...antes,
      id: c.id,
      nombre: c.nombre,
      lat: String(c.lat),
      lng: String(c.lng),
      radioKm: String(c.radioKm),
      zonaHoraria: c.zonaHoraria,
      moneda: c.moneda,
    }));
  }

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const lat = Number(v.lat);
    const lng = Number(v.lng);
    const radioKm = Number(v.radioKm || '25');
    if (![lat, lng, radioKm].every(Number.isFinite) || v.lat.trim() === '' || v.lng.trim() === '') {
      setError(t.numeroInvalido);
      return;
    }
    setEnviando(true);
    try {
      const moneda = v.moneda.trim().toUpperCase();
      const r = await pedir<{
        zona: { id: string; pais: string; moneda: string };
        estado: string;
      }>('POST', '/datos/admin/viajes/ciudades', {
        servicio,
        zona: {
          id: v.id.trim().toUpperCase(),
          nombre: v.nombre.trim(),
          lat,
          lng,
          radioKm,
          zonaHoraria: v.zonaHoraria.trim(),
          ...(moneda ? { moneda } : {}),
        },
        ...(conTarifaDeMercado ? {} : { tarifa: tarifaEscrita }),
        motivo: v.motivo.trim(),
      });
      await b.limpiar();
      setOk(
        t.abierta(
          nombreServicio,
          r.zona.id,
          r.zona.pais,
          r.zona.moneda,
          enPalabras(t.estados, String(r.estado)),
        ),
      );
    } catch (x) {
      // Lo escrito se queda para corregirlo.
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  const listo =
    CODIGO_CIUDAD.test(v.id.trim().toUpperCase()) &&
    v.nombre.trim().length >= 2 &&
    v.lat.trim() !== '' &&
    v.lng.trim() !== '' &&
    v.zonaHoraria.trim().length >= 3 &&
    v.motivo.trim().length >= 3 &&
    (conTarifaDeMercado || tarifaLista);

  return (
    <form className="formulario tarjeta-form" onSubmit={(e) => void abrir(e)} noValidate>
      <h2>{t.abrir}</h2>
      <p className="pista">{t.abrirAyuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label>
        {t.servicio}
        <select value={servicio} onChange={(e) => b.cambiar('servicio', e.target.value)}>
          {(['moto', 'carro', 'envios'] as const).map((s) => (
            <option key={s} value={s}>
              {enPalabras(t.nombresServicio, s)}
            </option>
          ))}
        </select>
      </label>
      <div className="fila-botones">
        <button
          type="button"
          className="boton secundario"
          onClick={() => usarCiudad(CIUDAD_PRUEBAS_VENEZUELA)}
        >
          {t.usarCaracas}
        </button>
        <button
          type="button"
          className="boton secundario"
          onClick={() => usarCiudad(CIUDAD_EL_VIGIA)}
        >
          {t.usarElVigia}
        </button>
      </div>
      <label>
        {t.codigo}
        <input
          value={v.id}
          onChange={(e) => b.cambiar('id', e.target.value.toUpperCase())}
          placeholder={t.codigoEjemplo}
          autoComplete="off"
        />
      </label>
      <label>
        {t.nombre}
        <input
          value={v.nombre}
          onChange={(e) => b.cambiar('nombre', e.target.value)}
          placeholder={t.nombreEjemplo}
        />
      </label>
      <label>
        {t.lat}
        <input
          inputMode="decimal"
          value={v.lat}
          onChange={(e) => b.cambiar('lat', e.target.value)}
          placeholder={t.coordenada}
        />
      </label>
      <label>
        {t.lng}
        <input
          inputMode="decimal"
          value={v.lng}
          onChange={(e) => b.cambiar('lng', e.target.value)}
          placeholder={t.coordenada}
        />
      </label>
      <label>
        {t.radio}
        <input
          type="number"
          min="1"
          max="100"
          value={v.radioKm}
          onChange={(e) => b.cambiar('radioKm', e.target.value)}
        />
      </label>
      <label>
        {t.zonaHoraria}
        <input value={v.zonaHoraria} onChange={(e) => b.cambiar('zonaHoraria', e.target.value)} />
      </label>
      <label>
        {t.moneda}
        <input
          value={v.moneda}
          maxLength={3}
          onChange={(e) => b.cambiar('moneda', e.target.value.toUpperCase())}
          placeholder={t.monedaEjemplo}
        />
      </label>
      <label>
        {t.motivo}
        <input
          value={v.motivo}
          maxLength={200}
          onChange={(e) => b.cambiar('motivo', e.target.value)}
          placeholder={t.motivoEjemplo}
        />
      </label>
      {conTarifaDeMercado && deMercado ? (
        <div aria-label={t.tarifaTitulo}>
          <h3>{t.tarifaTitulo}</h3>
          <p className="pista">{t.tarifaAyuda}</p>
          <ul className="lista">
            {(
              [
                [t.base, deMercado.base],
                [t.porKm, deMercado.porKm],
                [t.porMinuto, deMercado.porMinuto],
                [t.minimo, deMercado.minimo],
              ] as const
            ).map(([nombre, centavos]) => (
              <li key={nombre}>
                <div className="lista-texto">
                  <strong>{nombre}</strong>
                  <span>{usd(centavos)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <fieldset aria-label={t.tarifaEscribe}>
          <legend>{t.tarifaEscribe}</legend>
          <p className="pista">{t.tarifaEscribeAyuda}</p>
          {(
            [
              ['base', t.base],
              ['porKm', t.porKm],
              ['porMinuto', t.porMinuto],
              ['minimo', t.minimo],
            ] as const
          ).map(([clave, nombre]) => (
            <label key={clave}>
              {nombre}
              <input
                inputMode="decimal"
                value={new Map(Object.entries(v)).get(clave) ?? ''}
                onChange={(e) => b.cambiar(clave, e.target.value)}
                placeholder="0.00"
              />
            </label>
          ))}
        </fieldset>
      )}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      <button type="submit" className="boton" disabled={!listo || enviando}>
        {t.abrirBoton(nombreServicio)}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- 2. compuerta del país

type PaisPasajeros = {
  servicio: string;
  pais: string;
  abierto: boolean;
  solicitudMarca: string | null;
  abiertoEn: string | null;
};

function FilaPais({
  p,
  idioma,
  t,
  alCambiar,
}: {
  p: PaisPasajeros;
  idioma: Idioma;
  t: Textos;
  alCambiar: () => void;
}) {
  const b = useBorrador({
    formulario: `moto-pais-${p.pais}-${p.servicio}`,
    cuenta: 'superadmin',
    inicial: { solicitudMarca: '', confirmo: false, clave: '', nota: '' },
    almacen: almacenNavegador,
    sensibles: ['clave'],
  });
  const [cerrando, setCerrando] = useState(false);
  const [claveCierre, setClaveCierre] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const v = b.valores;

  async function enviar(abierto: boolean) {
    setError('');
    setOk('');
    try {
      await pedir('PUT', `/datos/admin/pasajeros-pais/${p.pais}/${p.servicio}`, {
        abierto,
        solicitudMarca: abierto ? v.solicitudMarca.trim() : '',
        confirmo: abierto ? v.confirmo : false,
        clave: abierto ? v.clave : claveCierre,
        nota: v.nota.trim(),
      });
      if (abierto) await b.limpiar();
      setCerrando(false);
      setClaveCierre('');
      setOk(abierto ? t.paisAbierto : t.paisCerrado);
      alCambiar();
    } catch (x) {
      setError(mensaje(x));
    }
  }

  const puedeAbrir = v.solicitudMarca.trim().length >= 4 && v.confirmo && v.clave.length > 0;

  return (
    <li
      className="tarjeta-form"
      data-testid={`pais-${p.pais}${p.servicio === 'moto' ? '' : `-${p.servicio}`}`}
    >
      <div className="lista-texto">
        <strong>
          {p.pais} · {enPalabras(t.nombresServicio, p.servicio)}{' '}
          <span className={`insignia ${p.abierto ? 'insignia-aprobado' : ''}`}>
            {p.abierto ? t.abiertoEstado : t.cerradoEstado}
          </span>
        </strong>
        {p.abierto ? (
          <span>
            {t.solicitudVista}: {p.solicitudMarca ?? ''}
            {p.abiertoEn ? ` · ${t.desde} ${p.abiertoEn}` : ''}
          </span>
        ) : null}
      </div>
      {p.abierto ? (
        <>
          <MenuTresPuntos
            etiqueta={t.opcionesPais}
            opciones={[{ texto: t.cerrarPais, peligro: true, alTocar: () => setCerrando(true) }]}
          />
          {cerrando ? (
            <div className="formulario">
              <p className="aviso">{t.cerrarAviso}</p>
              <CampoClave
                etiqueta={t.clave}
                valor={claveCierre}
                cambiar={setClaveCierre}
                textoVer={t.ver}
                textoOcultar={t.ocultar}
              />
              <div className="fila-botones">
                <button
                  type="button"
                  className="boton"
                  disabled={!claveCierre}
                  onClick={() => void enviar(false)}
                >
                  {t.confirmarCierre}
                </button>
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => {
                    setCerrando(false);
                    setClaveCierre('');
                  }}
                >
                  {t.cancelar}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            if (puedeAbrir) void enviar(true);
          }}
          noValidate
        >
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <label>
            {t.solicitud}
            <input
              value={v.solicitudMarca}
              maxLength={60}
              onChange={(e) => b.cambiar('solicitudMarca', e.target.value)}
              placeholder={t.solicitudEjemplo}
              autoComplete="off"
            />
          </label>
          <label className="casilla">
            <input
              type="checkbox"
              checked={v.confirmo}
              onChange={(e) => b.cambiar('confirmo', e.target.checked)}
            />
            {t.confirmo}
          </label>
          <label>
            {t.nota}
            <input
              value={v.nota}
              maxLength={300}
              onChange={(e) => b.cambiar('nota', e.target.value)}
            />
          </label>
          <CampoClave
            etiqueta={t.clave}
            valor={v.clave}
            cambiar={(x) => b.cambiar('clave', x)}
            textoVer={t.ver}
            textoOcultar={t.ocultar}
          />
          <button type="submit" className="boton" disabled={!puedeAbrir}>
            {t.abrirPais}
          </button>
        </form>
      )}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </li>
  );
}

function CompuertaPais({ idioma, t }: { idioma: Idioma; t: Textos }) {
  const [paises, setPaises] = useState<PaisPasajeros[] | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<{ paises: PaisPasajeros[] }>('GET', '/datos/admin/pasajeros-pais')
      .then((r) => setPaises(r.paises))
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  useEffect(cargar, [cargar]);
  return (
    <>
      <h2>{t.compuerta}</h2>
      <p className="pista">{t.compuertaAyuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {paises && paises.length === 0 ? <p className="pista">{t.sinPaises}</p> : null}
      <ul className="lista">
        {(paises ?? []).map((p) => (
          <FilaPais
            key={`${p.pais}-${p.servicio}`}
            p={p}
            idioma={idioma}
            t={t}
            alCambiar={cargar}
          />
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- 3. papeles del conductor

type Papel = {
  id: string;
  conductorId: string;
  conductor: string;
  tipo: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  motivo: string;
  venceEn: string | null;
  creadoEn: string;
  pais: string | null;
};

/** Rechazar con motivo: se abre desde los tres puntos y el motivo es obligatorio. */
function Rechazo({
  formulario,
  cuenta,
  idioma,
  t,
  alConfirmar,
  alCancelar,
}: {
  formulario: string;
  cuenta: string;
  idioma: Idioma;
  t: Textos;
  alConfirmar: (motivo: string) => Promise<boolean>;
  alCancelar: () => void;
}) {
  const b = useBorrador({
    formulario,
    cuenta,
    inicial: { motivo: '' },
    almacen: almacenNavegador,
  });
  return (
    <form
      className="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const motivo = b.valores.motivo.trim();
        if (!motivo) return;
        void alConfirmar(motivo).then((bien) => {
          if (bien) void b.limpiar();
        });
      }}
      noValidate
    >
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label>
        {t.motivoRechazo}
        <input
          value={b.valores.motivo}
          maxLength={200}
          onChange={(e) => b.cambiar('motivo', e.target.value)}
          placeholder={t.motivoRechazoEjemplo}
        />
      </label>
      <div className="fila-botones">
        <button type="submit" className="boton" disabled={!b.valores.motivo.trim()}>
          {t.confirmarRechazo}
        </button>
        <button type="button" className="boton secundario" onClick={alCancelar}>
          {t.cancelar}
        </button>
      </div>
    </form>
  );
}

function FilaPapel({
  d,
  idioma,
  t,
  alCambiar,
  verConductor,
}: {
  d: Papel;
  idioma: Idioma;
  t: Textos;
  alCambiar: () => void;
  verConductor: (id: string) => void;
}) {
  const [vence, setVence] = useState(d.venceEn?.slice(0, 10) ?? '');
  const [rechazando, setRechazando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function cambiar(cuerpo: Record<string, unknown>, exito: string) {
    setError('');
    setOk('');
    try {
      await pedir('PUT', `/datos/admin/papeles-conductor/${d.id}`, cuerpo);
      setOk(exito);
      alCambiar();
      return true;
    } catch (x) {
      setError(mensaje(x));
      return false;
    }
  }

  return (
    <li className="tarjeta-form" data-testid={`papel-${d.id}`}>
      <div className="lista-texto">
        <strong>
          {enPalabras(t.tiposPapel, d.tipo)}{' '}
          <span
            className={`insignia ${
              d.estado === 'aprobado'
                ? 'insignia-aprobado'
                : d.estado === 'rechazado'
                  ? 'insignia-rechazado'
                  : ''
            }`}
          >
            {enPalabras(t.estadosPapel, d.estado)}
          </span>
        </strong>
        <span>
          {d.conductor}
          {d.pais ? ` · ${d.pais}` : ''} · {t.subido} {d.creadoEn}
          {d.motivo ? ` · ${d.motivo}` : ''}
        </span>
      </div>
      <div className="fila-botones">
        <a
          className="boton secundario"
          href={`/datos/admin/papeles-conductor/${d.id}/archivo`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.verArchivo}
        </a>
        <button
          type="button"
          className="boton secundario"
          onClick={() => verConductor(d.conductorId)}
        >
          {t.verConductor}
        </button>
      </div>
      {d.estado !== 'aprobado' ? (
        <div className="fila-botones">
          <label>
            {t.vence}
            <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
          </label>
          <button
            type="button"
            className="boton exito"
            onClick={() =>
              void cambiar({ estado: 'aprobado', ...(vence ? { venceEn: vence } : {}) }, t.aprobado)
            }
          >
            {t.aprobar}
          </button>
        </div>
      ) : null}
      {d.estado !== 'rechazado' ? (
        <MenuTresPuntos
          etiqueta={t.opcionesPapel}
          opciones={[{ texto: t.rechazar, peligro: true, alTocar: () => setRechazando(true) }]}
        />
      ) : null}
      {rechazando ? (
        <Rechazo
          formulario="moto-rechazo-papel"
          cuenta={d.id}
          idioma={idioma}
          t={t}
          alCancelar={() => setRechazando(false)}
          alConfirmar={async (motivo) => {
            const bien = await cambiar({ estado: 'rechazado', motivo }, t.rechazado);
            if (bien) setRechazando(false);
            return bien;
          }}
        />
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </li>
  );
}

function Papeles({
  idioma,
  t,
  verConductor,
}: {
  idioma: Idioma;
  t: Textos;
  verConductor: (id: string) => void;
}) {
  const [estado, setEstado] = useState<'pendiente' | 'aprobado' | 'rechazado'>('pendiente');
  const [lista, setLista] = useState<Papel[] | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<{ documentos: Papel[] }>('GET', `/datos/admin/papeles-conductor?estado=${estado}`)
      .then((r) => setLista(r.documentos))
      .catch((x: unknown) => setError(mensaje(x)));
  }, [estado]);
  useEffect(cargar, [cargar]);
  return (
    <>
      <h2>{t.papeles}</h2>
      <div className="super-filtros" role="tablist">
        {(
          [
            ['pendiente', t.pendientes],
            ['aprobado', t.aprobados],
            ['rechazado', t.rechazados],
          ] as const
        ).map(([v, texto]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={estado === v}
            className={estado === v ? 'activa' : undefined}
            onClick={() => setEstado(v)}
          >
            {texto}
          </button>
        ))}
      </div>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {lista && lista.length === 0 ? <p className="pista">{t.sinPapeles}</p> : null}
      <ul className="lista">
        {(lista ?? []).map((d) => (
          <FilaPapel
            key={`${d.id}-${d.estado}`}
            d={d}
            idioma={idioma}
            t={t}
            alCambiar={cargar}
            verConductor={verConductor}
          />
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- 4. conductor en detalle

type DetalleConductor = {
  nombre: string;
  fechaNacimiento: string | null;
  ciudad: { id: string; nombre: string; pais: string };
  identidad: string;
  documentos: {
    id: string;
    tipo: string;
    estado: string;
    motivo: string;
    venceEn: string | null;
  }[];
  vehiculoActivo: { id: string; tipo: string; estado: string } | null;
  servicios: {
    servicioId: string;
    habilitacion: string | null;
    requisitosFaltantes: string[];
    puedeActivar: boolean;
    motivo: string;
  }[];
};

// ---------------------------------------------------------------- tasa de referencia (bolívares)

type FilaTasaRef = {
  pais: string;
  moneda: string;
  tasa: number | null;
  fecha: string | null;
  puestaEn: string | null;
  puestaPor: string | null;
  vigente: boolean;
};

/**
 * C-BS-REFERENCIA: el equipo escribe la tasa oficial del día (bolívares por dólar). Con ella, el
 * pasajero y el conductor ven el equivalente en bolívares junto al precio en dólares. Solo
 * informativa; con más de 48 horas no se muestra.
 */
function TasaReferencia({ idioma, t }: { idioma: Idioma; t: Textos }) {
  const b = useBorrador({
    formulario: 'moto-tasa-referencia',
    cuenta: 'superadmin',
    inicial: { tasa: '' },
    almacen: almacenNavegador,
  });
  const [filas, setFilas] = useState<FilaTasaRef[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const cargar = useCallback(() => {
    pedir<{ tasas: FilaTasaRef[] }>('GET', '/datos/admin/tasas-referencia')
      .then((r) => setFilas(r.tasas))
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  useEffect(cargar, [cargar]);
  async function guardar(e: React.FormEvent, pais: string) {
    e.preventDefault();
    setError('');
    setOk('');
    const tasa = Number(b.valores.tasa.replace(',', '.'));
    if (!(tasa > 0)) {
      setError(t.numeroInvalido);
      return;
    }
    try {
      await pedir('PUT', `/datos/admin/tasas-referencia/${pais}`, { tasa });
      await b.limpiar();
      setOk(t.tasaGuardada);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }
  return (
    <div className="tarjeta-form" data-testid="tasa-referencia">
      <h2>{t.tasaTitulo}</h2>
      <p className="pista">{t.tasaAyuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {filas.map((f) => (
        <form key={f.pais} onSubmit={(e) => void guardar(e, f.pais)}>
          <p>
            <strong>{f.pais}</strong> ·{' '}
            {f.tasa != null ? (
              <>
                {f.tasa} {t.tasaPorDolar} · {t.tasaDel} {f.fecha} · {f.puestaPor ?? ''}{' '}
                <span className={`insignia ${f.vigente ? 'insignia-aprobado' : ''}`}>
                  {f.vigente ? t.tasaVigente : t.tasaVencida}
                </span>
              </>
            ) : (
              t.tasaSinCargar
            )}
          </p>
          <label>
            {t.tasaNueva}
            <input
              value={b.valores.tasa}
              onChange={(e) => b.cambiar('tasa', e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              required
            />
          </label>
          <button type="submit" className="boton">
            {t.tasaGuardar}
          </button>
        </form>
      ))}
      {error ? <p className="error">{error}</p> : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </div>
  );
}

/** C-CIUDAD-CONDUCTOR: el equipo cambia la ciudad de un conductor (a cualquiera), con motivo. */
function CambiarCiudad({
  id,
  idioma,
  t,
  alCambiar,
}: {
  id: string;
  idioma: Idioma;
  t: Textos;
  alCambiar: (texto: string) => void;
}) {
  const b = useBorrador({
    formulario: `moto-ciudad-conductor-${id}`,
    cuenta: 'superadmin',
    inicial: { zonaId: '', motivo: '' },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await pedir('PUT', `/datos/admin/conductores/${id}/ciudad`, {
        zonaId: b.valores.zonaId.trim().toUpperCase(),
        motivo: b.valores.motivo.trim(),
      });
      await b.limpiar();
      alCambiar(t.ciudadCambiada);
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form onSubmit={(e) => void enviar(e)} data-testid="cambiar-ciudad-conductor">
      <h3>{t.cambiarCiudad}</h3>
      <p className="pista">{t.cambiarCiudadAyuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <label>
        {t.nuevaCiudad}
        <input
          value={b.valores.zonaId}
          onChange={(e) => b.cambiar('zonaId', e.target.value.toUpperCase())}
          placeholder={t.codigoEjemplo}
          autoComplete="off"
          required
        />
      </label>
      <label>
        {t.motivoCiudad}
        <input
          value={b.valores.motivo}
          onChange={(e) => b.cambiar('motivo', e.target.value)}
          placeholder={t.motivoCiudadEjemplo}
          required
          minLength={3}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="boton" disabled={enviando}>
        {t.cambiarCiudadBoton}
      </button>
    </form>
  );
}

function Conductor({
  id,
  base,
  idioma,
  t,
  alCerrar,
}: {
  id: string;
  base: string;
  idioma: Idioma;
  t: Textos;
  alCerrar: () => void;
}) {
  const [d, setD] = useState<DetalleConductor | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [faltan, setFaltan] = useState<string[]>([]);
  const cargar = useCallback(() => {
    pedir<DetalleConductor>('GET', `/datos/admin/conductores/${id}/pasajeros`)
      .then(setD)
      .catch((x: unknown) => setError(mensaje(x)));
  }, [id]);
  useEffect(cargar, [cargar]);

  async function hacer(metodo: 'PUT', ruta: string, cuerpo: unknown, exito: string) {
    setError('');
    setOk('');
    setFaltan([]);
    try {
      await pedir(metodo, ruta, cuerpo);
      setOk(exito);
      cargar();
    } catch (x) {
      const lista =
        x instanceof ErrorApi && Array.isArray(x.datos?.requisitosFaltantes)
          ? (x.datos.requisitosFaltantes as unknown[]).map(String)
          : [];
      if (lista.length) {
        setFaltan(lista);
        setError(t.noHabilitado);
      } else setError(mensaje(x));
    }
  }

  const requisito = (r: string) => enPalabras(t.requisitos, r);
  // C-CARRO-PANEL: la habilitación de cada servicio de pasajeros que el conductor tenga a la vista.
  const deServicio = (s: string) => d?.servicios.find((x) => x.servicioId === s);
  const moto = deServicio('moto');
  const carro = deServicio('carro');
  const bloqueServicio = (
    x: NonNullable<ReturnType<typeof deServicio>>,
    titulo: string,
    nadaFalta: string,
  ) => (
    <div key={x.servicioId}>
      <h3>
        {titulo}:{' '}
        <span className={`insignia ${x.habilitacion === 'aprobada' ? 'insignia-aprobado' : ''}`}>
          {enPalabras(t.estadosHabilitacion, x.habilitacion ?? 'ninguna')}
        </span>
      </h3>
      {x.requisitosFaltantes.length ? (
        <>
          <p>{t.leFalta}:</p>
          <ul aria-label={`${t.leFalta} · ${titulo}`}>
            {x.requisitosFaltantes.map((r) => (
              <li key={r}>{requisito(r)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="texto-exito">{nadaFalta}</p>
      )}
      {x.motivo ? <p className="pista">{x.motivo}</p> : null}
    </div>
  );
  return (
    <div className="tarjeta-form" data-testid="detalle-conductor">
      <div className="fila-botones">
        <h2>
          {t.conductor}: {d?.nombre ?? '…'}
        </h2>
        <button type="button" className="boton secundario" onClick={alCerrar}>
          {t.cerrarConductor}
        </button>
      </div>
      {d ? (
        <>
          <ul className="lista">
            <li>
              <div className="lista-texto">
                <strong>{t.ciudad}</strong>
                <span>
                  {d.ciudad.nombre} ({d.ciudad.pais})
                </span>
              </div>
            </li>
            <li>
              <div className="lista-texto">
                <strong>{t.nacimiento}</strong>
                <span>{d.fechaNacimiento ?? t.sinFecha}</span>
              </div>
            </li>
            <li>
              <div className="lista-texto">
                <strong>{t.identidad}</strong>
                <span>
                  {enPalabras(t.estadosIdentidad, d.identidad)} · {t.identidadAyuda}{' '}
                  <Enlace a={`${base}/verifications`}>{t.irVerificaciones}</Enlace>
                </span>
              </div>
            </li>
            <li>
              <div className="lista-texto">
                <strong>{carro && !moto ? t.vehiculoActivo : t.motoActiva}</strong>
                <span>
                  {d.vehiculoActivo
                    ? `${d.vehiculoActivo.tipo} · ${d.vehiculoActivo.estado}`
                    : t.sinMoto}
                </span>
              </div>
            </li>
            {d.documentos.map((doc) => (
              <li key={doc.id}>
                <div className="lista-texto">
                  <strong>{enPalabras(t.tiposPapel, doc.tipo)}</strong>
                  <span>
                    {enPalabras(t.estadosPapel, doc.estado)}
                    {doc.venceEn ? ` · ${doc.venceEn}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <CambiarCiudad
            id={id}
            idioma={idioma}
            t={t}
            alCambiar={(texto) => {
              setOk(texto);
              cargar();
            }}
          />
          {moto ? bloqueServicio(moto, t.habilitacion, t.nadaFalta) : null}
          {carro ? bloqueServicio(carro, t.habilitacionCarro, t.nadaFaltaCarro) : null}
          <div className="fila-botones">
            <button
              type="button"
              className="boton exito"
              onClick={() =>
                void hacer(
                  'PUT',
                  `/datos/admin/cumplimientos/${id}/edad_minima_21`,
                  { estado: 'aprobado' },
                  t.hecho,
                )
              }
            >
              {t.aprobarEdad}
            </button>
            {moto || !carro ? (
              <button
                type="button"
                className="boton exito"
                disabled={!d.vehiculoActivo}
                onClick={() =>
                  d.vehiculoActivo &&
                  void hacer(
                    'PUT',
                    `/datos/admin/cumplimientos/${id}/casco_pasajero`,
                    { estado: 'aprobado', vehiculoId: d.vehiculoActivo.id },
                    t.hecho,
                  )
                }
              >
                {t.aprobarCasco}
              </button>
            ) : null}
            {moto || !carro ? (
              <button
                type="button"
                className="boton exito"
                onClick={() =>
                  void hacer(
                    'PUT',
                    `/datos/admin/habilitaciones/${id}/moto`,
                    { estado: 'aprobada' },
                    t.habilitado,
                  )
                }
              >
                {t.habilitar}
              </button>
            ) : null}
            {carro ? (
              <button
                type="button"
                className="boton exito"
                onClick={() =>
                  void hacer(
                    'PUT',
                    `/datos/admin/habilitaciones/${id}/carro`,
                    { estado: 'aprobada' },
                    t.habilitadoCarro,
                  )
                }
              >
                {t.habilitarCarro}
              </button>
            ) : null}
          </div>
          {!d.vehiculoActivo && (moto || !carro) ? <p className="pista">{t.cascoSinMoto}</p> : null}
        </>
      ) : null}
      {error ? (
        <div className="error-general" role="alert">
          <p>{error}</p>
          {faltan.length ? (
            <ul>
              {faltan.map((r) => (
                <li key={r}>{requisito(r)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- 5. motos por revisar

type Moto = {
  id: string;
  conductor: string;
  conductor_id?: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string;
  placa: string;
  placa_estado: string;
  plazas?: number | null;
  estado: string;
  documentos: { id: string; tipo: string; estado: string; venceEn: string | null }[];
};

function FilaMoto({
  m,
  idioma,
  t,
  alCambiar,
  verConductor,
}: {
  m: Moto;
  idioma: Idioma;
  t: Textos;
  alCambiar: () => void;
  verConductor: (id: string) => void;
}) {
  const [vences, setVences] = useState<Map<string, string>>(
    () => new Map(m.documentos.map((d) => [d.id, d.venceEn?.slice(0, 10) ?? ''])),
  );
  const [rechazando, setRechazando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  // C-CARRO-PANEL: la misma cola revisa motos y carros, cada uno con sus textos.
  const esCarro = m.tipo === 'carro';
  const nombresDoc = esCarro ? t.documentosCarro : t.documentosMoto;

  async function hacer(ruta: string, cuerpo: Record<string, unknown>, exito: string) {
    setError('');
    setOk('');
    try {
      await pedir('PUT', ruta, cuerpo);
      setOk(exito);
      alCambiar();
      return true;
    } catch (x) {
      setError(mensaje(x));
      return false;
    }
  }

  return (
    <li className="tarjeta-form" data-testid={`moto-${m.id}`}>
      <div className="lista-texto">
        <strong>
          {[m.marca, m.modelo, m.anio ? String(m.anio) : ''].filter(Boolean).join(' ')}
          {m.color ? ` · ${m.color}` : ''}
        </strong>
        <span>
          {enPalabras(t.tiposVehiculo, m.tipo)}
          {esCarro && m.plazas ? ` · ${t.plazas(m.plazas)}` : ''} · {m.conductor} · {t.placa}:{' '}
          {m.placa}
          {m.placa_estado ? ` (${m.placa_estado})` : ''}
        </span>
      </div>
      {m.conductor_id ? (
        <button
          type="button"
          className="boton secundario"
          onClick={() => m.conductor_id && verConductor(m.conductor_id)}
        >
          {t.verConductor}
        </button>
      ) : null}
      {m.documentos.length === 0 ? <p className="pista">{t.sinDocumentos}</p> : null}
      <ul className="lista">
        {m.documentos.map((d) => (
          <li key={d.id}>
            <div className="lista-texto">
              <strong>
                {enPalabras(nombresDoc, d.tipo)}{' '}
                <span
                  className={`insignia ${
                    d.estado === 'aprobado'
                      ? 'insignia-aprobado'
                      : d.estado === 'rechazado'
                        ? 'insignia-rechazado'
                        : ''
                  }`}
                >
                  {enPalabras(t.estadosPapel, d.estado)}
                </span>
              </strong>
              <a
                href={`/datos/admin/vehiculos/${m.id}/documentos/${d.id}/archivo`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.verArchivo}
              </a>
            </div>
            {d.estado !== 'aprobado' ? (
              <div className="fila-botones">
                <label>
                  {t.vence}
                  <input
                    type="date"
                    value={vences.get(d.id) ?? ''}
                    onChange={(e) => {
                      const valor = e.target.value;
                      setVences((antes) => new Map(antes).set(d.id, valor));
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="boton exito"
                  onClick={() => {
                    const vence = vences.get(d.id) ?? '';
                    void hacer(
                      `/datos/admin/vehiculos/${m.id}/documentos/${d.id}`,
                      { estado: 'aprobado', venceEn: vence || null },
                      t.aprobado,
                    );
                  }}
                >
                  {t.aprobarDoc}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="fila-botones">
        <button
          type="button"
          className="boton exito"
          onClick={() =>
            void hacer(
              `/datos/admin/vehiculos/${m.id}`,
              { estado: 'aprobado' },
              esCarro ? t.carroAprobado : t.motoAprobada,
            )
          }
        >
          {esCarro ? t.aprobarCarro : t.aprobarMoto}
        </button>
        <MenuTresPuntos
          etiqueta={esCarro ? t.opcionesCarro : t.opcionesMoto}
          opciones={[
            {
              texto: esCarro ? t.rechazarCarro : t.rechazarMoto,
              peligro: true,
              alTocar: () => setRechazando(true),
            },
          ]}
        />
      </div>
      {rechazando ? (
        <Rechazo
          formulario="moto-rechazo-vehiculo"
          cuenta={m.id}
          idioma={idioma}
          t={t}
          alCancelar={() => setRechazando(false)}
          alConfirmar={async (motivo) => {
            const bien = await hacer(
              `/datos/admin/vehiculos/${m.id}`,
              { estado: 'rechazado', motivo },
              t.rechazado,
            );
            if (bien) setRechazando(false);
            return bien;
          }}
        />
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </li>
  );
}

function Motos({
  idioma,
  t,
  verConductor,
}: {
  idioma: Idioma;
  t: Textos;
  verConductor: (id: string) => void;
}) {
  const [lista, setLista] = useState<Moto[] | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<{ vehiculos: Moto[] }>('GET', '/datos/admin/vehiculos?estado=en_revision')
      .then((r) => setLista(r.vehiculos.filter((v) => v.tipo === 'moto' || v.tipo === 'carro')))
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  useEffect(cargar, [cargar]);
  return (
    <>
      <h2>{t.motos}</h2>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {lista && lista.length === 0 ? <p className="pista">{t.sinMotos}</p> : null}
      <ul className="lista">
        {(lista ?? []).map((m) => (
          <FilaMoto
            key={`${m.id}-${m.estado}-${m.documentos.map((d) => d.estado).join('')}`}
            m={m}
            idioma={idioma}
            t={t}
            alCambiar={cargar}
            verConductor={verConductor}
          />
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- la sección

export function SuperMoto({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [conductor, setConductor] = useState<string | null>(null);
  return (
    <section className="super" data-testid="super-moto">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.intro}</p>
      <AbrirCiudad idioma={idioma} t={t} />
      <CompuertaPais idioma={idioma} t={t} />
      <TasaReferencia idioma={idioma} t={t} />
      {conductor ? (
        <Conductor
          key={conductor}
          id={conductor}
          base={base}
          idioma={idioma}
          t={t}
          alCerrar={() => setConductor(null)}
        />
      ) : null}
      <Papeles idioma={idioma} t={t} verConductor={setConductor} />
      <Motos idioma={idioma} t={t} verConductor={setConductor} />
    </section>
  );
}

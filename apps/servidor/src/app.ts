import { disparadoresPresentes } from './canarioLecturas';
import { presupuestoVueltaPruebas, saludVueltasPruebas } from './vueltaPruebas';
import { DOMINIO_PRINCIPAL, redireccionDominio } from './dominio';
import { rewardsSombra } from './rewards/rutas';
import { guardarError, saludErrores } from './errores';
import { saludBandeja } from './internacional/bandeja';
import { finanzasAdmin } from './finanzas/rutasAdmin';
import { controlDual } from './finanzas/controlDual';
import { flexRecargasLocalesAdmin } from './flex/recargasLocales';
import { saludBilleteras } from './finanzas/reloj';
import {
  blindarStripeEnPruebas,
  entornoDe,
  marcarSitioDePruebas,
  problemasDeEntorno,
} from './entorno';
import { saludRetiros } from './retiros';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  CORREOS_SOPORTE,
  MARCA,
  direccionNueva,
  enIdiomaDireccion,
  panelNuevo,
} from '@tumbite/compartido';
import { type Env, revisarEnv } from './env';
import { usarStripeLocal } from './stripe';
import { enIdiomaDePeticion, idiomaDeLaPeticion } from './mensajesEn';
import {
  cabecerasSeguridad,
  frenoLlaveVencida,
  limiteIntentos,
  limiteIntentosPersistente,
} from './seguridad';
import { SESION_TERMINADA, type Variables, cargarSesion } from './sesion';
import { ErrorDatos } from './validar';
import {
  asegurarEsquema,
  columnasFaltantes,
  entornoDeServicios,
  ultimoErrorEsquema,
} from './esquema';
import { cuentas } from './rutas/cuentas';
import { repararCuentasDePaisUnaVez } from './reparacionPais';
import { catalogo } from './rutas/catalogo';
import { dinero } from './rutas/dinero';
import { pedidos } from './rutas/pedidos';
import { esRevisor, operacion } from './rutas/operacion';
import { rutasPractica } from './entregaPractica';
import { regalos } from './rutas/regalos';
import { zonas } from './rutas/zonas';
import { espera } from './rutas/espera';
import { flota } from './rutas/flota';
import { cancelaciones } from './rutas/cancelaciones';
import { ciudadesWeb } from './rutas/ciudadesWeb';
import { equipo, permisosInternos } from './rutas/equipo';
import { piloto } from './rutas/piloto';
import { cuentaPrueba } from './rutas/cuentaPrueba';
import { informes } from './rutas/informes';
import { tableroPanel } from './rutas/tableroPanel';
import { turnos } from './rutas/turnos';
import { grupos } from './rutas/grupos';
import { pedidoCompartido } from './rutas/pedidoCompartido';
import { seguridadRepartidor } from './rutas/seguridadRepartidor';
import { apiPos } from './rutas/apiPos';
import { gerente } from './rutas/gerente';
import { tickets } from './rutas/tickets';
import { erroresApp } from './rutas/erroresApp';
import { referidos } from './referidos';
import { lineas } from './rutas/lineas';
import { franquicias } from './rutas/franquicias';
import { superadmin } from './rutas/superadmin';
import { equipoInterno } from './rutas/equipoInterno';
import { segundoFactor } from './segundoFactor';
import { buscadorInterno } from './rutas/buscadorInterno';
import { fichaViajeRutas } from './rutas/fichaViaje';
import { rastreoVivoRutas } from './rutas/rastreoVivo';
import { preferenciasInternas } from './rutas/preferenciasInternas';
import { kyc } from './rutas/kyc';
import { CAPTURA_INTERNA, fotos, media } from './rutas/fotos';
import { diagnostico } from './rutas/diagnostico';
import { ciudadPruebas } from './rutas/ciudadPruebas';
import { fijarAppCiudad } from './ciudadJuego';
import { saludServicios, saludTarifas, servicios } from './rutas/servicios';
import { avisameServicio } from './rutas/avisameServicio';
import { conductorPapeles } from './rutas/conductorPapeles';
import { verificacionConductor } from './rutas/verificacionConductor';
import { saludVerificacionIa } from './verificacionIa';
import { serviciosConectados } from './rutas/serviciosConectados';
import { tasasReferencia } from './rutas/tasasReferencia';
import { buscar } from './rutas/buscar';
import { demanda } from './rutas/demanda';
import { avisos } from './rutas/avisos';
import { repartidorGrandes } from './rutas/repartidorGrandes';
import { perfilConductor } from './rutas/perfilConductor';
import { interno, saludTiempoReal } from './rutas/interno';
import { relojEnPausa, saludReloj } from './reloj';
import { alertarCanario } from './canario';
import { versionMinimaApp } from './versionApp';
import { saludDisputas } from './disputas';
import { internacional } from './rutas/internacional';
import { favoritos } from './rutas/favoritos';
import { flex } from './flex';
import { cupones } from './rutas/cupones';
import { regalosDivoox } from './rutas/regalosDivoox';
import { saldoConductores } from './rutas/saldoConductores';
import { programaReferidos } from './rutas/programaReferidos';
import { agentes } from './rutas/agentes';
import { saludAgentes } from './agentes';
import { saludRegalos } from './regalosDivoox';
import { camila } from './rutas/camila';
import { camilaFallos } from './rutas/camilaFallos';
import { saludCamila } from './camila/salud';
import { saludCorreoEntrante } from './camila/correoEntrante';
import { direcciones } from './rutas/direcciones';
import { fotoPuerta } from './rutas/fotoPuerta';
import { videosAyuda } from './rutas/videosAyuda';
import { restauranteMas } from './rutas/restauranteMas';
import { anuncios } from './rutas/anuncios';
import { banners } from './rutas/banners';
import { saludBanners } from './banners';
import { promociones } from './rutas/promociones';
import { modoDestino } from './modoDestino';
import { plus } from './plus';
import { tarjetasRegalo } from './tarjetasRegalo';
import { stripeAvisos } from './rutas/stripeAvisos';
import { saludConnect } from './connectPaises';
import { saludLibro } from './internacional/libro';
import { viajes } from './rutas/viajes';
import { saludViajes, viajesPasajero } from './rutas/viajesPasajero';
import { viajesProgramados } from './rutas/viajesProgramados';
import { viajesFijos } from './rutas/viajesFijos';
import { chatViaje } from './rutas/chatViaje';
import { moderacion } from './rutas/moderacion';
import { ayudaInterna } from './rutas/ayudaInterna';
import { paradasViaje } from './rutas/paradasViaje';
import { dinamicaViaje } from './rutas/dinamicaViaje';
import { comidaCiudad } from './rutas/comidaCiudad';
import { pruebasComidaVe } from './rutas/pruebasComidaVe';
import { saludComidaPaises } from './internacional/tarifas';
import { saludPagoComida } from './internacional/pagoComida';
import { pagoComidaRutas } from './rutas/pagoComida';
import { viajesHistorial } from './rutas/viajesHistorial';
import { seguridadViaje } from './rutas/seguridadViaje';
import { ajustesViaje } from './rutas/ajustesViaje';
import { lugares } from './rutas/lugares';
import { tiendas } from './rutas/tiendas';
import { tiendasPeso } from './rutas/tiendasPeso';
import { saludExclusividad } from './operaciones';
import { correoConfigurado, saludCorreo, ultimoErrorCorreo } from './correo';
import { ultimoErrorAviso } from './notificaciones';
// C-AVISOS-WEB (13 nov 2026): avisos de las apps instaladas desde el navegador.
import { rutasAvisosWeb, saludAvisosWeb } from './avisosWeb';
// C-TASA-BCV-AUTO (14 nov 2026): canario de la tasa oficial automática de Venezuela.
import { saludTasaBcv } from './rutas/tasasReferencia';
import { smsConfigurado, ultimoErrorSms } from './sms';
import { saludSmsMasivo } from './smsMasivo';
import { saludCodigo } from './telefonoVuelta';
import { whatsappAviso } from './rutas/whatsappAviso';
import { rastroRutas } from './rutas/rastro';
import { rezagadosRutas } from './rutas/rezagados';
import { saludDinero } from './conciliacion';
import { excepcionesConciliacion } from './rutas/excepcionesConciliacion';
import { estadoRespaldo, fechaUltimoRespaldo, respaldo, ultimoErrorRespaldo } from './respaldo';
import { VERSION_SERVIDOR } from './version';
import { saludTransiciones } from './esquemaPedidos';
import { saludCobros } from './liquidaciones';
import { saludAutorizaciones } from './autorizacionVencida';
import { saludRutas } from './rutaPorCalles';
import { saludLlegada } from './llegadaEstimada';

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// C-DOMINIO-DIVOOX: las páginas viven en divoox.com; la API sigue respondiendo en los dos.
app.use('*', async (c, next) => {
  const destino = redireccionDominio(new URL(c.req.url), c.req.method);
  if (destino) return c.redirect(destino, 301);
  await next();
});
app.use('*', cabecerasSeguridad);
// C-AVISOS-WEB: el trabajo que no hace falta para responder (los avisos web) va con waitUntil.
app.use('/datos/*', async (c, next) => {
  let ctx: { waitUntil: (p: Promise<unknown>) => void } | null;
  try {
    ctx = c.executionCtx;
  } catch {
    ctx = null; // en las pruebas no hay contexto de ejecución
  }
  if (ctx) {
    const ejecucion = ctx;
    c.env = { ...c.env, ESPERAR_DESPUES: (p) => ejecucion.waitUntil(p) };
  }
  await next();
});
// C-PRESUPUESTO-VUELTA-PRUEBAS: las pruebas automáticas contra el sitio de pruebas tienen tope
// de filas por vuelta y por día; en producción no hace nada.
app.use('/datos/*', presupuestoVueltaPruebas);
// C-PRUEBAS-SIN-INDEXAR: nada del sitio de pruebas sale en los buscadores (duplicaría divoox.com).
app.use('*', async (c, next) => {
  await next();
  if (entornoDe(c.req.url) === 'pruebas') c.res.headers.set('X-Robots-Tag', 'noindex, nofollow');
});
// C-ENTORNOS-SEPARADOS: el sitio de pruebas nunca usa una llave real de Stripe.
app.use('*', async (c, next) => {
  const host = new URL(c.req.url).host;
  blindarStripeEnPruebas(host, c.env);
  // C-GUIONES-SIN-CODIGO-REAL: las cuentas del recorrido no reciben códigos de verdad en pruebas.
  marcarSitioDePruebas(host, c.env);
  await next();
});
// Stripe simulado solo en la computadora del programador (ver stripe.ts). En producción no existe.
app.use('*', async (c, next) => {
  usarStripeLocal((c.env as unknown as Record<string, unknown>).STRIPE_API_URL);
  await next();
});
// Una sola dirección oficial: www.tumbite.com manda a tumbite.com (Google no ve dos copias).
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return c.redirect(url.toString(), 301);
  }
  await next();
});
// El inglés es el idioma principal y todas las direcciones van en inglés (regla de Richard,
// 13 oct 2026). Lo viejo que ya circuló sigue funcionando con 301, con sus parámetros:
// «/privacidad» (que era la página en español) → «/es/privacy»; «/en/terminos» → «/terms».
// Candado C-INGLES-PRINCIPAL.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next();
  const url = new URL(c.req.url);
  const ruta = url.pathname;
  // El panel también va en inglés: «/panel/pedidos» → «/panel/orders».
  const panel = panelNuevo(ruta);
  if (panel) return c.redirect(`${panel}${url.search}`, 301);
  // Las pantallas de la app web del cliente también pasaron a inglés.
  const partesApp = ruta.split('/');
  const pantallaNueva = new Map([
    ['pedido', 'order'],
    ['restaurante', 'restaurant'],
    ['carrito', 'cart'],
    ['cuenta', 'account'],
  ]).get(partesApp[2] ?? '');
  if (partesApp[1] === 'app' && pantallaNueva) {
    const resto = partesApp.slice(3).join('/');
    return c.redirect(`/app/${pantallaNueva}${resto ? `/${resto}` : ''}${url.search}`, 301);
  }
  // La app web del repartidor se llama /driver (antes /repartidor).
  if (ruta === '/repartidor' || ruta.startsWith('/repartidor/'))
    return c.redirect(`/driver${ruta.slice(11)}${url.search}`, 301);
  // C-REZAGADOS: la dirección corta de los SMS de registro (cada letra cuenta dentro de los 160).
  if (ruta === '/go') return c.redirect('/driver', 302);
  if (/^\/(datos|media|panel|app|driver|restaurant|t)(\/|$)/.test(ruta)) return next();
  let destino: string | null = null;
  if (ruta === '/en' || ruta.startsWith('/en/')) {
    const resto = ruta.slice(3) || '/';
    destino = direccionNueva(resto) ?? resto;
  } else {
    const espanol = ruta === '/es' || ruta.startsWith('/es/');
    const base = espanol ? ruta.slice(3) || '/' : ruta;
    const nueva = direccionNueva(base);
    if (nueva) destino = enIdiomaDireccion(nueva, 'es');
  }
  if (!destino) return next();
  return c.redirect(`${destino}${url.search}`, 301);
});
// Las apps nativas no mandan «Origin». Esto solo abre la puerta a la vista web de las apps en la
// computadora del programador. Nunca se abre a sitios ajenos.
app.use(
  '/datos/*',
  cors({
    origin: (origen) => (/^http:\/\/localhost:(8081|8082|8083)$/.test(origen) ? origen : null),
    allowHeaders: ['content-type', 'authorization', 'cf-turnstile-response', 'x-idioma'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);
/** Páginas privadas por enlace (tickets, viaje compartido, entrega): ningún buscador las guarda. */
// C-AYUDA-INTERNA: el panel (y la ayuda del equipo que vive en el superadmin) tampoco se indexa.
// C-AGENTE-DIVOOX: el panel del agente tampoco se indexa.
export const RUTAS_PRIVADAS = ['/t/', '/ride/', '/deliver/', '/panel', '/agent'];
const limiteGeneral = limiteIntentos(120, 60_000);
// Los avisos de Stripe llegan de sus servidores y ya vienen firmados: no se frenan por IP.
app.use('/datos/*', (c, next) =>
  c.req.path === '/datos/stripe/aviso' || c.req.path === '/datos/whatsapp/aviso'
    ? next()
    : limiteGeneral(c, next),
);
app.use('/datos/cuentas/entrar', limiteIntentosPersistente(10, 60_000));
app.use('/datos/cuentas/registro', limiteIntentosPersistente(10, 60_000));
app.use('/datos/cuentas/recuperar', limiteIntentosPersistente(5, 60_000));
app.use('/datos/cuentas/confirmar/reenviar', limiteIntentos(3, 60_000));
app.use('/datos/cuentas/restablecer', limiteIntentosPersistente(10, 60_000));
// C-TELEFONO-TOPES: el código por SMS cuesta dinero; además de los topes por cuenta, número y red del
// día, una ráfaga desde la misma red se frena aquí. Probar el código también tiene su límite.
app.use('/datos/cuentas/telefono/codigo', limiteIntentos(5, 60_000));
app.use('/datos/repartidor/telefono/codigo', limiteIntentos(5, 60_000));
app.use('/datos/cuentas/telefono/verificar', limiteIntentos(10, 60_000));
app.use('/datos/repartidor/telefono/verificar', limiteIntentos(10, 60_000));
app.use('/datos/equipo-interno/invitacion/*', limiteIntentosPersistente(10, 60_000));
app.use('/datos/mi-restaurante/fotos', limiteIntentos(30, 60_000));
app.use('/datos/viajes/cotizar', limiteIntentos(30, 60_000));
// C-VIAJE-PARADAS: mirar o cambiar las paradas pide una ruta cada vez (como cotizar).
app.use('/datos/viajes/:id/paradas', limiteIntentos(30, 60_000));
app.use('/datos/publico/viaje/*', limiteIntentos(60, 60_000));
// Cada búsqueda de Google cuesta: tope por persona (red).
app.use('/datos/lugares/*', limiteIntentos(40, 60_000));
// C-TIENDAS-CODIGO: Open Food Facts pide no abusar de su servicio gratuito.
app.use('/datos/mi-restaurante/productos/codigo/*', limiteIntentos(30, 60_000));
// C-OCHO-ICONOS-SIEMPRE: «Avísame cuando llegue» (en memoria: el límite no escribe en la base).
app.use('/datos/servicios/avisame', limiteIntentos(10, 60_000));
// C-COMIDA-PAGO-RESTAURANTE: la referencia del pago, la cuenta de cobro y la recarga del restaurante.
app.use('/datos/pedidos/:id/pago-comida', limiteIntentos(20, 60_000));
app.use('/datos/restaurante/cuenta-cobro', limiteIntentos(20, 60_000));
app.use('/datos/restaurante/saldo/recargas', limiteIntentos(20, 60_000));
// F16: una app vieja recibe 426 «actualiza» en toda la API (lo público y la web no se tocan).
app.use('/datos/*', (c, next) =>
  ['/datos/publico', '/datos/version', '/datos/salud', '/datos/whatsapp/aviso'].includes(c.req.path)
    ? next()
    : versionMinimaApp(c, next),
);
app.use('/datos/*', async (c, next) => {
  if (c.env.DB)
    await asegurarEsquema(
      c.env.DB,
      entornoDeServicios(entornoDe(c.req.url), c.env.SERVICIOS_PRUEBA_LOCAL),
    );
  // C-REPARACION-PAIS: una sola vez por base (lee una fila de config por servidor después de eso).
  if (c.env.DB) await repararCuentasDePaisUnaVez(c.env, c.env.DB);
  await next();
});
app.use('/datos/*', cargarSesion);
// C-SESION-TERMINADA: las llaves vencidas no martillan las rutas del conductor (versión vieja de Driver).
const frenoConductor = frenoLlaveVencida();
app.use('/datos/repartidor/*', frenoConductor);
app.use('/datos/conductor/*', frenoConductor);
// C-ROLES-INTERNOS: el perfil del equipo frena lo que no le toca y queda anotado quién cambió qué.
app.use('/datos/admin/*', permisosInternos);

/**
 * Canario de salud. Cada pieza dice ok / error / pendiente. Nada falla en silencio:
 * si una pieza se cae, aquí se ve.
 */
app.get('/datos/salud', async (c) => {
  const piezas: Record<string, 'ok' | 'error' | 'pendiente' | 'atrasado' | 'estimada' | 'tope'> =
    {};

  if (!c.env.DB) {
    piezas.base = 'pendiente';
  } else {
    try {
      await c.env.DB.prepare('SELECT 1').first();
      piezas.base = 'ok';
    } catch (e) {
      console.error('salud: la base no responde', e);
      piezas.base = 'error';
    }
  }

  piezas.almacen = c.env.BUCKET ? 'ok' : 'pendiente';
  const entorno = problemasDeEntorno(new URL(c.req.url).host, c.env);
  if (entorno.length) console.error('salud: entorno', entorno.join(' · '));
  piezas.entorno = entorno.length ? 'error' : 'ok';
  if (c.env.DB) piezas.esquema = ultimoErrorEsquema || columnasFaltantes.length ? 'error' : 'ok';

  const env = revisarEnv(c.env as unknown as Record<string, unknown>);
  piezas.variables = env.ok ? 'ok' : 'error';
  piezas.stripe = c.env.STRIPE_SECRET_KEY ? 'ok' : 'pendiente';
  piezas.webhookStripe = c.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'pendiente';
  piezas.webhookStripeConectadas = c.env.STRIPE_WEBHOOK_SECRET_CONECTADAS ? 'ok' : 'pendiente';
  // Escudo anti-robots: con la secreta sin la pública, la web y las apps no podrían entrar (F5).
  piezas.turnstile = !c.env.TURNSTILE_SECRET_KEY
    ? 'pendiente'
    : c.env.TURNSTILE_SITE_KEY
      ? 'ok'
      : 'error';
  // C-CORREO-HONESTO (19 nov 2026): los fallos del correo se leen de la base (todas las instancias),
  // no solo de la memoria de la instancia que contesta. El cupo alto del día también pone rojo.
  const correo = c.env.DB
    ? await saludCorreo(c.env.DB).catch((e: unknown) => {
        console.error('salud: correo', e);
        return null;
      })
    : null;
  const correoMal =
    Boolean(ultimoErrorCorreo) || correo?.estado === 'error' || (Boolean(c.env.DB) && !correo);
  piezas.correo = !correoConfigurado(c.env) ? 'pendiente' : correoMal ? 'error' : 'ok';
  // C-CORREO-REBOTES-CANARIO: la tasa de rebote de 24 h (amarilla desde el 10 %, roja desde el 25 %,
  // con un mínimo de 20 enlaces). Sale de la misma lectura de arriba.
  if (correo) piezas.correoRebotes = correo.rebotes;
  piezas.avisosCelular = ultimoErrorAviso ? 'error' : 'ok';
  // C-AVISOS-WEB: sin llaves VAPID, «pendiente».
  piezas.avisosWeb = saludAvisosWeb(c.env);
  // C-TASA-BCV-AUTO: «pendiente» mientras no se haya tomado nunca; «error» si la última quedó retenida.
  if (c.env.DB)
    piezas.tasaBcv = await saludTasaBcv(c.env.DB).catch((e: unknown) => {
      console.error('salud: tasa bcv', e);
      return 'error' as const;
    });
  piezas.sms = !smsConfigurado(c.env) ? 'pendiente' : ultimoErrorSms ? 'error' : 'ok';
  // C-SMS-VENEZUELA: «pendiente» mientras esté apagado; «tope» si se alcanzó el máximo del día.
  piezas.smsVenezuela = await saludSmsMasivo(c.env, c.env.DB).catch((e: unknown) => {
    console.error('salud: sms venezuela', e);
    return 'error' as const;
  });
  // C-SMS-GASTO: el gasto de SMS de las últimas 24 horas contra el presupuesto del día.
  // C-CODIGO-CANALES: y el canal WhatsApp del código (apagado = «pendiente»). Una sola lectura.
  const codigo = await saludCodigo(c.env, c.env.DB).catch((e: unknown) => {
    console.error('salud: gasto de sms y whatsapp', e);
    return { smsGasto: 'error' as const, whatsapp: 'error' as const };
  });
  piezas.smsGasto = codigo.smsGasto;
  piezas.whatsapp = codigo.whatsapp;
  // C-LECTURAS-SALUD: los disparadores en UNA lectura de sqlite_master para las cuatro piezas que
  // los miran (antes, cuatro recorridos). Si falla, cada pieza vuelve a preguntar por su cuenta.
  const presentes = c.env.DB
    ? await disparadoresPresentes(c.env.DB).catch((e: unknown) => {
        console.error('salud: disparadores', e);
        return undefined;
      })
    : undefined;
  // C-DINERO-30-DIAS (NXT-1): los últimos 30 días, no solo la última conciliación.
  if (c.env.DB)
    piezas.dinero = await saludDinero(c.env.DB).catch((e: unknown) => {
      console.error('salud: dinero', e);
      return 'error' as const;
    });
  // Fase 0: retiros sin doble pago (disparadores puestos, conciliación al día, nada en revisión).
  if (c.env.DB)
    piezas.retiros = await saludRetiros(c.env, c.env.DB, presentes).catch((e: unknown) => {
      console.error('salud: retiros', e);
      return 'error' as const;
    });
  // C-AGENTE-DIVOOX: ningún fondo de agente en negativo y lo pagado cuadra con lo que bajó de los fondos.
  if (c.env.DB)
    piezas.agentes = await saludAgentes(c.env.DB, presentes).catch((e: unknown) => {
      console.error('salud: agentes', e);
      return 'error' as const;
    });
  // C-CONNECT-UN-INTENTO: si Stripe rechazó una cuenta conectada, el freno queda a la vista.
  if (c.env.DB)
    piezas.connect = await saludConnect(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: connect', e);
      return 'error' as const;
    });
  // Fase 1: catálogo de servicios (Moto y Carro apagados, disparadores puestos). Moto se admite
  // encendida solo en el sitio de pruebas (C-MOTO-SOLO-PRUEBAS).
  if (c.env.DB)
    piezas.servicios = await saludServicios(c.env.DB, entornoDe(c.req.url), presentes).catch(
      (e: unknown) => {
        console.error('salud: servicios', e);
        return 'error' as const;
      },
    );
  // C-SERVICIO-SIN-TARIFA: nada encendido sin su tarifa en la ciudad.
  if (c.env.DB)
    piezas.tarifas = await saludTarifas(c.env.DB, entornoDe(c.req.url)).catch((e: unknown) => {
      console.error('salud: tarifas', e);
      return 'error' as const;
    });
  // Divoox Moto · M7: ningún viaje cerrado con comisión apartada ni deudas sin su viaje.
  if (c.env.DB)
    piezas.viajes = await saludViajes(c.env.DB).catch((e: unknown) => {
      console.error('salud: viajes', e);
      return 'error' as const;
    });
  // C-COMIDA-VENEZUELA: ciudad con Comida encendida fuera de EE. UU. en otra moneda que su país.
  if (c.env.DB)
    piezas.comidaPaises = await saludComidaPaises(c.env.DB).catch((e: unknown) => {
      console.error('salud: comida por país', e);
      return 'error' as const;
    });
  // C-COMIDA-PAGO-RESTAURANTE: ningún pago de la comida atascado (el vigilante los cierra a tiempo).
  if (c.env.DB)
    piezas.pagoComida = await saludPagoComida(c.env.DB).catch((e: unknown) => {
      console.error('salud: pago de la comida', e);
      return 'error' as const;
    });
  // Fase 2: tiempo real (apagado = «pendiente»; las apps siguen con la consulta normal).
  if (c.env.DB)
    piezas.tiempoReal = await saludTiempoReal(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: tiempo real', e);
      return 'pendiente' as const;
    });
  // Fase 3: exclusividad (cero inconsistencias entre pedidos, operaciones y ocupación).
  if (c.env.DB)
    piezas.exclusividad = await saludExclusividad(c.env.DB, presentes).catch((e: unknown) => {
      console.error('salud: exclusividad', e);
      return 'error' as const;
    });
  // Reloj seguro: vueltas buenas a tiempo, sin rachas de errores ni tareas críticas fallidas.
  // C-RELOJ-PRUEBAS-PAUSA: con el reloj de pruebas en pausa, su salud no se consulta.
  if (relojEnPausa(c.req.url)) piezas.reloj = 'pendiente';
  else if (c.env.DB)
    piezas.reloj = await saludReloj(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: reloj', e);
      return 'error' as const;
    });
  // C-PRESUPUESTO-VUELTA-PRUEBAS: hoy ninguna vuelta de pruebas se frenó ni se pasó el tope diario.
  if (c.env.DB && entornoDe(c.req.url) !== 'produccion')
    piezas.pruebasContinuas = await saludVueltasPruebas(c.env.DB).catch((e: unknown) => {
      console.error('salud: vueltas de pruebas', e);
      return 'error' as const;
    });
  // C-TRANSICIONES-PEDIDO: el disparador que impide los saltos de estado de los pedidos existe.
  if (c.env.DB)
    piezas.transiciones = await saludTransiciones(c.env.DB, presentes).catch((e: unknown) => {
      console.error('salud: transiciones', e);
      return 'error' as const;
    });
  // Fase 2: el libro internacional nunca deja un prepago, una reserva ni un fondo de punto en negativo.
  if (c.env.DB)
    piezas.libro = await saludLibro(c.env.DB).catch((e: unknown) => {
      console.error('salud: libro', e);
      return 'error' as const;
    });
  // C-CUPON-DIVOOX: ningún cupón gasta más que su presupuesto y todo regalo cobrado llega al conductor.
  if (c.env.DB)
    piezas.regalos = await saludRegalos(c.env.DB).catch((e: unknown) => {
      console.error('salud: regalos', e);
      return 'error' as const;
    });
  // C-CAMILA-TOPE: Camila no gasta más IA que su tope ni da más regalos que los permitidos.
  if (c.env.DB)
    piezas.camila = await saludCamila(c.env.DB).catch((e: unknown) => {
      console.error('salud: camila', e);
      return 'error' as const;
    });
  // C-VERIFICACION-IA: la verificación de fotos con IA no gasta más que su tope del día.
  if (c.env.DB)
    piezas.verificacion_ia = await saludVerificacionIa(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: verificación con IA', e);
      return 'error' as const;
    });
  // C-CAMILA-CORREO-HILO: la entrada de correo de Camila (y sus respuestas) no falló en 24 horas.
  const correoEntrante = c.env.DB
    ? await saludCorreoEntrante(c.env.DB).catch((e: unknown) => {
        console.error('salud: correo entrante', e);
        return null;
      })
    : null;
  // Si ni siquiera se pudo leer, «atrasado»: la entrada de correo no tumba el sitio.
  if (c.env.DB) piezas.correoEntrante = correoEntrante?.estado ?? 'atrasado';
  // Disputas (contracargos) sin responder que vencen pronto: rojo para que alguien las atienda.
  if (c.env.DB)
    piezas.disputas = await saludDisputas(c.env.DB).catch((e: unknown) => {
      console.error('salud: disputas', e);
      return 'error' as const;
    });
  // C-ERRORES-VISIBLES: errores no controlados en la última hora («pendiente», para revisar).
  if (c.env.DB)
    piezas.errores = await saludErrores(c.env.DB).catch((e: unknown) => {
      console.error('salud: errores', e);
      return 'error' as const;
    });
  // C-BANDEJA-DINERO: casos del cobro en mano esperando a soporte («pendiente», no es un error).
  if (c.env.DB)
    piezas.bandeja = await saludBandeja(c.env.DB).catch((e: unknown) => {
      console.error('salud: bandeja', e);
      return 'error' as const;
    });
  // C-COBRO-AL-ENTREGAR: ningún cobro de una entrega en revisión ni atrasado más de 2 horas.
  if (c.env.DB)
    piezas.cobros = await saludCobros(c.env.DB).catch((e: unknown) => {
      console.error('salud: cobros', e);
      return 'error' as const;
    });
  // C-AUTORIZACION-VENCIDA: un pedido abierto con la tarjeta autorizada hace 96 horas o más
  // («pendiente»: a la vista para que alguien lo entregue o lo cancele antes de que venza).
  if (c.env.DB)
    piezas.autorizaciones = await saludAutorizaciones(c.env.DB).catch((e: unknown) => {
      console.error('salud: autorizaciones', e);
      return 'error' as const;
    });
  // Flex · Fase 4: la última conciliación de las billeteras de empresa no encontró diferencias.
  if (c.env.DB)
    piezas.billeteras = await saludBilleteras(c.env.DB).catch((e: unknown) => {
      console.error('salud: billeteras', e);
      return 'error' as const;
    });
  // C-RUTA-POR-CALLES: Google Routes respondiendo (ok), sin llave o sin la API (estimada: se usa la
  // fórmula) o roto (error), y cuántas consultas van hoy contra el tope. Solo lee.
  // C-BANNERS: la llave de fal, el tope diario de imágenes con IA y el último error (una lectura).
  if (c.env.DB)
    piezas.banners = await saludBanners(c.env, c.env.DB).catch((e: unknown) => {
      console.error('salud: banners', e);
      // Los banners del inicio no tumban el sitio: si no se pudo leer, «atrasado» (sin 503).
      return 'atrasado' as const;
    });
  const rutas = await saludRutas(c.env, c.env.DB).catch((e: unknown) => {
    console.error('salud: rutas', e);
    return { estado: 'error' as const, consultasHoy: 0, tope: 0 };
  });
  piezas.rutas = rutas.estado;
  // C-HORA-LLEGADA: la hora de llegada con tráfico (ok), con la fórmula (estimada: sin llave), al
  // tope del día (tope: no tumba el sitio; avisa por correo una vez al día) o rota (error). Solo lee.
  const llegada = await saludLlegada(c.env, c.env.DB).catch((e: unknown) => {
    console.error('salud: llegada', e);
    return { estado: 'error' as const, calculosHoy: 0, tope: 0 };
  });
  piezas.llegada = llegada.estado;
  let fechaRespaldo: string | null = null;
  if (!c.env.BUCKET) piezas.respaldo = 'pendiente';
  else {
    fechaRespaldo = await fechaUltimoRespaldo(c.env.BUCKET).catch(() => null);
    piezas.respaldo = ultimoErrorRespaldo ? 'error' : estadoRespaldo(fechaRespaldo);
  }

  const algunError = Object.values(piezas).includes('error');
  // F11: un correo al equipo cuando una pieza pasa a rojo y otro cuando se recupera.
  if (c.env.DB)
    await alertarCanario(c.env, c.env.DB, piezas).catch((e: unknown) =>
      console.error('salud: alertas del canario', e),
    );
  return c.json(
    {
      servicio: MARCA.nombre,
      ok: !algunError,
      piezas,
      rutas: { consultasHoy: rutas.consultasHoy, tope: rutas.tope },
      llegada: { calculosHoy: llegada.calculosHoy, tope: llegada.tope },
      correo: correo
        ? {
            fallos24h: correo.fallos24h,
            ultimoFallo: correo.ultimoFallo,
            cupoAlto: correo.cupoAlto,
            rebotes24h: correo.rebotes24h,
            enlaces24h: correo.enlaces24h,
          }
        : null,
      correoEntrante,
      ultimoRespaldo: fechaRespaldo,
      version: VERSION_SERVIDOR,
    },
    algunError ? 503 : 200,
  );
});

/** Versión y commit con que se COMPILÓ este servidor (C-VERSION-DEL-ARTEFACTO). Público: no lleva secretos. */
app.get('/datos/version', (c) =>
  c.json({ servidor: VERSION_SERVIDOR }, 200, { 'Cache-Control': 'no-store' }),
);

/** Datos públicos que la landing y las apps leen sin sesión (el WhatsApp de soporte, por ahora). */
app.get('/datos/publico', (c) =>
  c.json(
    {
      whatsapp: c.env.WHATSAPP_SOPORTE ?? '',
      whatsappVentas: c.env.WHATSAPP_VENTAS ?? '',
      correoSoporte: CORREOS_SOPORTE.divoox,
      stripePublica: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
      // Clave pública del escudo anti-robots: vacía = apagado (F5).
      turnstileSitio: c.env.TURNSTILE_SITE_KEY ?? '',
    },
    200,
    {
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  ),
);

const RUTAS_PUBLICAS = new Set([
  '/',
  '/how-it-works',
  '/privacy',
  '/terms',
  '/restaurant-terms',
  '/driver-terms',
  '/promo-terms',
  '/delete-account',
  '/support',
  '/sms-consent',
  '/contact',
  '/register-line',
  '/docs',
  '/flex',
  '/track',
  '/download',
]);
const esRutaPublica = (rutaConIdioma: string) => {
  // /es/... es la misma página pública en español (el inglés va sin prefijo).
  const ruta =
    rutaConIdioma === '/es' || rutaConIdioma.startsWith('/es/')
      ? rutaConIdioma.slice(3) || '/'
      : rutaConIdioma;
  return RUTAS_PUBLICAS.has(ruta) || /^\/(docs|country|city|food)\//.test(ruta);
};
// C-DOMINIO-DIVOOX: la etiqueta canónica que pone el servidor apunta a la dirección principal.
export const urlCanonica = (ruta: string) => `https://${DOMINIO_PRINCIPAL}${ruta}`;

export function conCanonica(res: Response, href: string): Response {
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  if (typeof HTMLRewriter === 'undefined') return res;
  return new HTMLRewriter()
    .on('link[rel="canonical"]', {
      element(e) {
        e.setAttribute('href', href);
      },
    })
    .transform(res);
}

/**
 * Todo lo que no es /datos lo sirven los estáticos. Las páginas de la app web
 * (landing, legales, panel) son una sola página: si el archivo no existe, se
 * entrega index.html y el navegador decide qué mostrar.
 */
/**
 * C-AYUDA-INTERNA: direcciones de Docs que fueron del equipo interno (la sección «Operations team» y
 * sus capturas). Responden 410 «ya no existe» para que los buscadores las olviden.
 */
export const esDocsInterno = (ruta: string) =>
  /^(\/es)?\/docs\/operations(\/|$)/.test(ruta) ||
  // La guía de la doble firma mostraba la bandeja «Para aprobar» del equipo (estaba en «trust»).
  /^(\/es)?\/docs\/(trust\/)?two-person-approval$/.test(ruta) ||
  (/^\/(docs|media\/docs-grande)\/[^/]+$/.test(ruta) &&
    CAPTURA_INTERNA.test(ruta.replace(/^.*\//, '')));

const PAGINA_RETIRADA = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page removed · Divoox</title></head><body style="font-family:system-ui,sans-serif;margin:0;padding:48px 16px;text-align:center;color:#101010;background:#fff"><h1>This page no longer exists</h1><p>Esta página ya no existe.</p><p><a href="/docs" style="color:#C20A1A">Divoox Docs</a></p></body></html>`;

/** A qué raíz cae una ruta de página que no existe como archivo. */
export function raizDeApp(ruta: string): string {
  // C-ENLACE-INVITACION: los enlaces con que una empresa (Flex) o un restaurante (flota propia)
  // invitan a su repartidor son páginas del sitio; si caían en la app Driver salía «página no existe».
  // C-INVITAR-LIDER-UN-PASO: también el enlace personal del líder de una línea (/driver/lead/…).
  if (/^\/driver\/(join|fleet|lead)\//.test(ruta)) return '/';
  for (const base of ['/app', '/driver', '/restaurant'])
    if (ruta === base || ruta.startsWith(`${base}/`)) return `${base}/`;
  return '/';
}

app.notFound(async (c) => {
  if (c.req.path.startsWith('/datos/'))
    return c.json(
      {
        error: enIdiomaDePeticion(
          'Esta dirección no existe.',
          idiomaDeLaPeticion((n) => c.req.header(n)),
        ),
      },
      404,
    );
  // C-AYUDA-INTERNA (16 nov 2026, Richard): lo que fue la sección pública del equipo de operaciones
  // ya no existe (410, fuera de los buscadores); esas guías viven solo en la ayuda interna.
  if (esDocsInterno(c.req.path))
    return c.html(PAGINA_RETIRADA, 410, {
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'public, max-age=300',
    });
  if (!c.env.ASSETS) return c.text('No encontrado', 404);
  let res = await c.env.ASSETS.fetch(c.req.raw);
  const esPagina =
    (c.req.method === 'GET' || c.req.method === 'HEAD') && !/\.[a-z0-9]+$/i.test(c.req.path);
  if (res.status === 404 && esPagina) {
    // Se pide la raíz «/», no «/index.html»: la plataforma redirige /index.html a / (307)
    // y eso mandaba a la persona a la portada en vez de a la página que pidió.
    // Las apps web viven en /app (cliente), /driver y /restaurant: sus rutas internas caen en su raíz.
    const raiz = raizDeApp(c.req.path);
    res = await c.env.ASSETS.fetch(
      new Request(new URL(raiz, c.req.url), { method: c.req.method, headers: c.req.raw.headers }),
    );
  }
  let respuesta = new Response(res.body, res);
  // Las conversaciones de tickets (/t/<codigo>) son privadas: ningún buscador las guarda.
  // Igual el viaje compartido (/ride/<codigo>, M6): privado y en vivo.
  // C-NOINDEX-ES: también sus versiones en español (/es/ride/…).
  if (RUTAS_PRIVADAS.some((p) => c.req.path.startsWith(p) || c.req.path.startsWith(`/es${p}`)))
    respuesta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (esRutaPublica(c.req.path) && res.ok) {
    // Caché de borde para las páginas públicas (sin cookies). El panel nunca se cachea.
    respuesta.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    // La etiqueta canónica dice la dirección de ESTA página (el index.html trae la de la portada
    // para todas; sin esto Google cree que privacidad y términos son copias de la portada).
    respuesta = conCanonica(respuesta, urlCanonica(c.req.path));
  }
  return respuesta;
});

app.route('/datos/cuentas', cuentas);
// C-RASTRO: antes de las fichas del superadmin (rutas más específicas primero).
// C-WHATSAPP-ENTREGA: el aviso de estados de Meta (firmado; sin sesión).
app.route('/datos', whatsappAviso);
app.route('/datos', rastroRutas);
app.route('/datos', rezagadosRutas);
// C-AVISOS-WEB: suscribirse y darse de baja de los avisos en el navegador.
app.route('/datos/avisos-web', rutasAvisosWeb);
// C-ENTREGA-PRACTICA: antes que las de verdad; solo atiende los pedidos «prueba-…».
app.route('/datos', rutasPractica(esRevisor));
app.route('/datos', gerente);
app.route('/datos', camila);
app.route('/datos', camilaFallos);
app.route('/datos', catalogo);
app.route('/datos', dinero);
app.route('/datos', diagnostico);
app.route('/datos', ciudadPruebas);
// C-CIUDAD-JUEGO: los robots de la ciudad de pruebas le hablan a esta misma app por dentro.
fijarAppCiudad(app);
app.route('/datos', servicios);
app.route('/datos', avisameServicio);
app.route('/datos', conductorPapeles);
app.route('/datos', verificacionConductor);
app.route('/datos', serviciosConectados);
app.route('/datos', tasasReferencia);
app.route('/datos', buscar);
app.route('/datos', demanda);
app.route('/datos', avisos);
app.route('/datos', repartidorGrandes);
// C-PERFIL-CONDUCTOR: «Así te ven los pasajeros» (el conductor) y el perfil del conductor del viaje (el pasajero).
app.route('/datos', perfilConductor);
app.route('/datos', viajes);
// C-VIAJES-HISTORIAL: antes que viajesPasajero, para que /viajes/historial no caiga en /viajes/:id.
app.route('/datos', viajesHistorial);
// C-VIAJE-PROGRAMADO: antes que viajesPasajero, para que /viajes/programados no caiga en /viajes/:id.
app.route('/datos', viajesProgramados);
app.route('/datos', viajesFijos);
app.route('/datos', chatViaje);
// C-MODERACION: reportar, bloquear y la bandeja de reportes del equipo.
app.route('/datos', moderacion);
// C-AYUDA-INTERNA: la ayuda del equipo («?» del superadmin), solo con sesión del equipo.
app.route('/datos', ayudaInterna);
// C-VIAJE-PARADAS y C-CARRO-DINAMICA (14 nov 2026).
app.route('/datos', paradasViaje);
app.route('/datos', dinamicaViaje);
app.route('/datos', viajesPasajero);
app.route('/datos', comidaCiudad);
app.route('/datos', pruebasComidaVe);
app.route('/datos', seguridadViaje);
app.route('/datos', ajustesViaje);
app.route('/datos', lugares);
app.route('/datos', tiendas);
app.route('/datos', tiendasPeso);
app.route('/datos', interno);
app.route('/datos', pagoComidaRutas);
app.route('/datos', pedidos);
app.route('/datos', operacion);
app.route('/datos', regalos);
app.route('/datos', zonas);
app.route('/datos', espera);
app.route('/datos', flota);
app.route('/datos', cancelaciones);
app.route('/datos', ciudadesWeb);
app.route('/datos', equipo);
// C-PERMISOS-FINOS (MON-5, 15 nov 2026): equipo interno, invitaciones, «Ver dato» y segundo factor.
app.route('/datos', equipoInterno);
app.route('/datos', segundoFactor);
// C-BUSCADOR-SERIO y C-FILTROS-GUARDADOS (15 nov 2026): el buscador y los filtros del superadmin.
app.route('/datos', buscadorInterno);
// C-FICHA-OPERACION: después de /admin/viajes/tarifas, /ajustes y /dinamica (rutas fijas de arriba).
app.route('/datos', fichaViajeRutas);
// C-RASTREO-VIVO: el mapa en vivo de la ficha del pedido y del viaje (solo lectura).
app.route('/datos', rastreoVivoRutas);
app.route('/datos', preferenciasInternas);
app.route('/datos', piloto);
app.route('/datos', cuentaPrueba);
app.route('/datos', informes);
// C-PANEL-ARMAZON: lecturas de los tableros del panel web (nunca escriben).
app.route('/datos', tableroPanel);
app.route('/datos', turnos);
app.route('/datos', grupos);
app.route('/datos', pedidoCompartido);
app.route('/datos', seguridadRepartidor);
app.route('/datos', apiPos);
app.route('/datos', tickets);
app.route('/datos', erroresApp);
app.route('/datos', franquicias);
app.route('/datos', superadmin);
app.route('/datos', internacional);
app.route('/datos', favoritos);
app.route('/datos', cupones);
app.route('/datos', regalosDivoox);
app.route('/datos', saldoConductores);
app.route('/datos', programaReferidos);
// C-AGENTE-DIVOOX: el panel del agente, «Cobrar en efectivo» del conductor y Dinero → Agentes.
app.route('/datos', agentes);
app.route('/datos', direcciones);
app.route('/datos', fotoPuerta);
app.route('/datos', videosAyuda);
app.route('/datos', restauranteMas);
app.route('/datos', anuncios);
// C-BANNERS: los banners del inicio de la app (lectura pública) y su administrador.
app.route('/datos', banners);
app.route('/datos', promociones);
app.route('/datos', modoDestino);
app.route('/datos', plus);
app.route('/datos', tarjetasRegalo);
app.route('/datos', referidos);
app.route('/datos', lineas);
app.route('/datos', stripeAvisos);
app.route('/datos', kyc);
app.route('/datos', fotos);
app.route('/', media);
app.route('/datos', respaldo);
app.route('/datos/v1/flex', flex);
app.route('/datos', finanzasAdmin);
app.route('/datos', controlDual);
// C-FLEX-RECARGA-LOCAL: lo del equipo bajo /datos/admin/finanzas (perfiles y bitácora del equipo).
app.route('/datos', flexRecargasLocalesAdmin);
app.route('/datos', excepcionesConciliacion);
// Divoox Rewards · Fase 2: lectura del modo sombra (solo admin y solo en pruebas).
app.route('/datos', rewardsSombra);

app.onError(async (err, c) => {
  // Cada mensaje sale en el idioma de quien pidió (el inglés es el principal).
  const idioma = idiomaDeLaPeticion((n) => c.req.header(n));
  if (err instanceof ErrorDatos) {
    // C-SESION-TERMINADA: la sesión vencida va marcada sin dudas (código y cabecera): las apps solo
    // salen con esta marca; cualquier otro 401 (llave de una API, firma) no cierra una sesión.
    if (err.estado === 401 && err.message === SESION_TERMINADA) {
      c.header('x-sesion', 'terminada');
      return c.json(
        {
          error: enIdiomaDePeticion(err.message, idioma),
          campo: err.campo,
          codigo: 'sesion_terminada',
        },
        401,
      );
    }
    return c.json({ error: enIdiomaDePeticion(err.message, idioma), campo: err.campo }, err.estado);
  }
  console.error('error no controlado', err);
  // C-ERRORES-VISIBLES: queda escrito para poder diagnosticarlo después (si la base responde).
  if (c.env.DB)
    await guardarError(
      c.env.DB,
      c.req.method,
      c.req.path,
      err,
      (c.get('usuario') as { id?: string } | null | undefined)?.id ?? null,
    ).catch((e: unknown) => console.error('no se pudo guardar el error', e));
  return c.json(
    {
      error: enIdiomaDePeticion('Algo salió mal de nuestro lado. Ya lo estamos revisando.', idioma),
    },
    500,
  );
});

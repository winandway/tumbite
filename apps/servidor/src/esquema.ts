import { CONFIG_DINERO_ANTERIOR, CONFIG_DINERO_INICIAL, type Entorno } from '@tumbite/compartido';
import { COLUMNAS_DEL_ESQUEMA } from './esquemaColumnas';
import { aperturasVigentes } from './pasajerosPais';
import { rehacerFranquicias } from './esquemaTerritorio';
import { ESQUEMA_FASE3 } from './esquemaFase3';
import { ESQUEMA_PEDIDOS } from './esquemaPedidos';
import { ESQUEMA_AGENTES } from './esquemaAgentes';
import {
  ESQUEMA_SALDO_CLIENTE,
  MOVIMIENTOS_DDL,
  rehacerSaldoClienteMovimientos,
} from './esquemaSaldoCliente';
import { migrarSaldosALotes, sentenciasMigrarLotes } from './saldoLotes';
import { ESQUEMA_FLEX, rehacerFlex } from './esquemaFlex';
import { rehacerAprobacionesDinero } from './esquemaDinero';
import {
  COLUMNAS_RESUMEN_CATALOGO,
  DISPARADORES_RESUMEN_CATALOGO,
  asegurarResumenCatalogo,
} from './resumenCatalogo';
import { rehacerConductorDocumentos } from './esquemaPapeles';
import { rehacerCuentasCobro } from './esquemaCuentasCobro';
import { rehacerPoliticasFinancieras } from './esquemaPoliticas';
import {
  DISPARADORES_HABILITACION,
  DISPARADOR_APROBAR_VEHICULO,
  rehacerAprobarVehiculo,
  rehacerElegibilidad,
  sincronizarPoliticaRequisitos,
} from './esquemaPlazo';
import { PAISES_CON_PLAZO, politicaPlazoDeFabrica } from '@tumbite/compartido';
import { INDICES_BUSCADOR } from './buscadorSql';
import { INDICES_LUGAR, LUGAR_COLUMNAS } from './esquemaLugar';
import { SQL_CANDIDATOS_LLEGA_SOLO, repararLlegaSoloARevision } from './reparacionLlegaSolo';
import { SQL_CANDIDATOS_VEHICULO_ACTIVO, repararVehiculoActivo } from './reparacionVehiculoActivo';
import {
  CLAVE_SEMILLA_TABULADOR_VIGIA,
  ZONA_TABULADOR_VIGIA,
  leerMarcaSemilla,
  semillaPorCorrer,
  sembrarTabuladorVigia,
} from './semillaTabuladorVigia';
import { QUIEN_PAGA_DDL, rehacerQuienPaga } from './esquemaQuienPaga';
import { TABULADOR_EL_VIGIA } from './tabuladorElVigia';
import {
  SQL_CANDIDATOS_SERVICIOS_VEHICULO,
  repararServiciosVehiculo,
} from './reparacionServiciosVehiculo';
import { ESQUEMA_CUENTA_UNICA } from './esquemaCuentaUnica';
import {
  DISPARADORES_RASTRO,
  FUENTES_PASO,
  VERSION_RELLENO,
  asegurarRastro,
  rellenarRastro,
} from './esquemaRastro';
/**
 * Migraciones seguras. schema.sql corre en cada publicación pero solo crea lo que no existe:
 * NO agrega columnas a tablas que ya están en producción. Esto sí, sin tocar datos:
 * revisa qué columnas faltan, las agrega, y crea los índices que dependen de ellas.
 * Corre una vez por arranque del servidor. Si algo falla, lo dice la salud.
 */
const COLUMNAS: [tabla: string, columna: string, definicion: string][] = [
  // C-REGALO-CONDUCTOR-TOPE-VENCE (26 nov 2026, Richard: 5 USD por conductor nuevo, 50 USD al día por
  // ciudad, 30 días si no se usan): el tope del día y la vigencia del regalo de arranque de la ciudad.
  ['regalo_conductor_nuevo', 'tope_diario', 'INTEGER'],
  ['regalo_conductor_nuevo', 'vigencia_dias', 'INTEGER'],
  ['regalo_conductor_nuevo', 'encendido_en', 'TEXT'],
  ['cargas_saldo_conductor', 'vence_en', 'TEXT'],
  // C-RASTRO (22 nov 2026): la posición del repartidor en cada cambio de estado del pedido, en la misma
  // fila que ya se escribía.
  ['historial_estados', 'lat', 'REAL'],
  ['historial_estados', 'lng', 'REAL'],
  // C-SMS-VENEZUELA (22 nov 2026): por qué proveedor salió cada SMS y su número de solicitud; con eso
  // se cuenta el tope diario del proveedor de Venezuela y se le pregunta el estado de un envío.
  ['sms_enviados', 'proveedor', 'TEXT'],
  ['sms_enviados', 'referencia', 'TEXT'],
  // C-CUENTA-PRUEBA (21 nov 2026): la marca única de «cuenta de prueba». La pone solo el equipo desde el
  // panel (con auditoría). Habilita los servicios encendidos solo para pruebas en una ciudad y deja la
  // cuenta fuera de reportes, conteos y registros nuevos.
  ['usuarios', 'es_prueba', 'INTEGER NOT NULL DEFAULT 0'],
  // C-PERMISO-IA-CHAT (21 nov 2026, Apple 5.1.2(i)): el permiso explícito de la persona para que su
  // chat de ayuda se procese con la IA de un proveedor. NULL = no ha contestado; 1 = sí; 0 = no.
  ['camila_personas', 'permiso_ia', 'INTEGER'],
  ['camila_personas', 'permiso_ia_en', 'TEXT'],
  // C-CHAT-WEB-SIN-MURO (23 nov 2026): con qué texto se informó o se dio el permiso del chat
  // («linea-2026-11-23/web», «explicito-2026-11-21»). Prueba de qué se le dijo a la persona.
  ['camila_personas', 'permiso_ia_version', 'TEXT'],
  // C-FOTO-RECOGIDA (21 nov 2026): la dirección guardada de donde sale el viaje (si el punto de
  // recogida cae en una dirección guardada del pasajero). Queda con la cotización y pasa al viaje.
  ['cotizaciones_viaje', 'origen_direccion_id', 'TEXT'],
  ['viajes', 'origen_direccion_id', 'TEXT'],
  // C-TERRITORIO-OFICIAL (21 nov 2026): el municipio oficial donde cae cada zona (P-code del INE en
  // Venezuela, «VE1401»). Sale de los contornos oficiales; el panel lo muestra y lo puede corregir.
  ['zonas', 'municipio_pcode', 'TEXT'],
  // C-ZONA-MUNICIPIO (24 nov 2026): el municipio que el equipo elige o escribe para la zona (todos los
  // países). Vacío = el oficial que sale de su centro (municipio_pcode), si su país lo tiene.
  ['zonas', 'municipio', "TEXT NOT NULL DEFAULT ''"],
  // C-INVITAR-LIDER-UN-PASO (21 nov 2026): el enlace personal de la invitación (secreto, de un solo
  // líder) y cuándo se le mandó el correo.
  ['invitaciones_lider', 'token', 'TEXT'],
  ['invitaciones_lider', 'correo_enviado_en', 'TEXT'],
  // C-BS-EN-MANO (18 nov 2026, Venezuela): la tasa del día FIJADA con la operación (al cotizar el
  // viaje o al crear el pedido) y, al cerrar el viaje, lo cobrado en mano en céntimos de bolívar.
  // Conductor y pasajero ven el mismo número aunque la tasa cambie después.
  ['cotizaciones_viaje', 'ref_tasa', 'REAL'],
  ['cotizaciones_viaje', 'ref_fecha', 'TEXT'],
  ['viajes', 'ref_tasa', 'REAL'],
  ['viajes', 'ref_fecha', 'TEXT'],
  ['viajes', 'ref_monto', 'INTEGER'],
  ['pedidos', 'ref_tasa', 'REAL'],
  ['pedidos', 'ref_fecha', 'TEXT'],
  // C-REOFERTA-TOPE (18 nov 2026): cuántas veces se le ofreció el viaje a ese conductor (tope 3).
  ['ofertas_operacion', 'intentos', 'INTEGER NOT NULL DEFAULT 1'],
  // C-REFERIDOS-SIN-TRAMPA (18 nov 2026): por qué un referido de cliente pendiente ya no da premio.
  ['referidos', 'cierre', 'TEXT'],
  // C-LUGARES-GUARDADOS (17 nov 2026): el ícono del lugar guardado (casa, trabajo, escuela…).
  ['direcciones_cliente', 'icono', "TEXT NOT NULL DEFAULT ''"],
  // C-PUNTO-EXACTO (16 nov 2026): el punto de referencia de la dirección guardada y del pedido.
  ['direcciones_cliente', 'referencia', "TEXT NOT NULL DEFAULT ''"],
  ['pedidos', 'referencia', "TEXT NOT NULL DEFAULT ''"],
  // C-FLEX-PAGO-BLOQUE (16 nov 2026): lo que la empresa le paga al conductor por el bloque (centavos).
  ['rutas_flex', 'pago_bloque', 'INTEGER'],
  // C-TIEMPOS-OPERACION (15 nov 2026): de dónde salen la ida del repartidor y la llegada del
  // conductor en la ficha del superadmin (se escriben en el mismo INSERT/UPDATE de la oferta).
  ['ofertas', 'km', 'REAL'],
  ['ofertas', 'respondida_en', 'TEXT'],
  ['ofertas_operacion', 'km', 'REAL'],
  // C-MONITOREO-SERVICIOS (15 nov 2026): el viaje de un reclamo.
  ['tickets', 'operacion_id', 'TEXT'],
  // C-CARRO-CATEGORIAS, C-VIAJE-PARADAS (14 nov 2026): Comfort y Premium, y paradas intermedias.
  ['tarifas_viaje', 'comfort_pb', 'INTEGER'],
  ['tarifas_viaje', 'premium_pb', 'INTEGER'],
  ['tarifas_viaje', 'espera_parada_gratis_s', 'INTEGER NOT NULL DEFAULT 120'],
  // C-DESTINO-EN-EL-PAIS: tope de seguridad de km por ciudad y servicio (vacío = el alto de siempre).
  ['tarifas_viaje', 'km_maximo', 'INTEGER'],
  // C-PRECIO-ZONA (24 nov 2026): umbral del precio de la zona por ciudad y servicio (NULL = 10 %).
  ['tarifas_viaje', 'umbral_precio_zona_pb', 'INTEGER'],
  // C-RECARGO-NOCHE (25 nov 2026): tarifa nocturna por ciudad y servicio (NULL = sin recargo, 21 a 6).
  ['tarifas_viaje', 'recargo_noche_pb', 'INTEGER'],
  ['tarifas_viaje', 'noche_desde_h', 'INTEGER'],
  ['tarifas_viaje', 'noche_hasta_h', 'INTEGER'],
  // C-TABULADOR-VIGIA (25 nov 2026): la vía de la ruta y «revisar el punto en el mapa».
  ['rutas_precio_zona', 'grupo', 'TEXT'],
  ['rutas_precio_zona', 'revisar', 'INTEGER NOT NULL DEFAULT 0'],
  // C-QUIEN-PAGA-SERVICIO (25 nov 2026): la regla de quién paga puede ser de un solo servicio. La
  // clave primaria nueva la pone rehacerQuienPaga (la columna sola no basta).
  ['quien_paga_viajes', 'servicio', "TEXT NOT NULL DEFAULT ''"],
  ['cotizaciones_viaje', 'paradas_json', "TEXT NOT NULL DEFAULT '[]'"],
  ['vehiculos', 'categoria', "TEXT NOT NULL DEFAULT 'estandar'"],
  ['vehiculos', 'acepta_menores', 'INTEGER NOT NULL DEFAULT 1'],
  // C-AVISOS-WEB (14 nov 2026): la sesión que registró la suscripción web (al borrarla, se borra).
  ['suscripciones_web', 'sesion_id', 'TEXT'],
  // C-AVISOS-IDIOMA (16 nov 2026): cada teléfono y cada navegador guarda el idioma de su app (el
  // elegido en el selector o, si no eligió, el del teléfono). El aviso sale en ESE idioma.
  ['dispositivos', 'idioma', 'TEXT'],
  // C-OFERTA-SUENA-EN-BUCLE (18 nov 2026): lo que el teléfono dijo que trae (p. ej. «ofertas-bucle»:
  // el canal de ofertas con el tono largo). Sin esto, el aviso sigue por el canal de siempre.
  ['dispositivos', 'capacidades', 'TEXT'],
  ['suscripciones_web', 'idioma', 'TEXT'],
  // C-RUTA-POR-CALLES (13 nov 2026): de dónde salió la distancia cobrada en la cotización.
  ['cotizaciones_viaje', 'fuente_distancia', "TEXT NOT NULL DEFAULT 'estimada'"],
  // C-CIUDAD-ERRORES (13 nov 2026): de quién era la sesión del error no controlado (solo el id).
  ['errores_servidor', 'usuario_id', 'TEXT'],
  // C-CAMILA-FALLOS (18 nov 2026): la tabla del gasto diario de Camila ya existía; sus dos columnas
  // nuevas no estaban aquí y el sitio de pruebas quedó con «esquema: error», frenando toda publicación.
  ['camila_gasto', 'capturas', 'INTEGER NOT NULL DEFAULT 0'],
  ['camila_gasto', 'resumen_fallos', 'INTEGER NOT NULL DEFAULT 0'],
  // C-CAMILA-REPORTE-CONVERSADO (19 nov 2026): el reporte de fallo conversado y el contacto dicho.
  ['camila_reportes_fallo', 'campos_json', "TEXT NOT NULL DEFAULT '{}'"],
  ['camila_reportes_fallo', 'resumen', "TEXT NOT NULL DEFAULT ''"],
  ['camila_reportes_fallo', 'captura_lectura', "TEXT NOT NULL DEFAULT ''"],
  ['camila_reportes_fallo', 'turnos', 'INTEGER NOT NULL DEFAULT 0'],
  ['camila_personas', 'contacto_correo', 'TEXT'],
  ['camila_personas', 'contacto_telefono', 'TEXT'],
  // C-PENDIENTE-ABANDONADO (13 nov 2026): huella de los datos con que se creó el pedido sin pagar.
  ['pedidos', 'huella_cuerpo', 'TEXT'],
  // C-FLOTA-PROPIA (10 nov 2026): el restaurante reparte con los suyos; respaldo con la red.
  ['restaurantes', 'flota_modo', "TEXT NOT NULL DEFAULT 'divoox'"],
  ['restaurantes', 'flota_respaldo', 'INTEGER NOT NULL DEFAULT 0'],
  ['pedidos', 'flota_aviso_en', 'TEXT'],
  // C-DISPONIBLE-MUNDO (10 nov 2026): de qué país y de dónde llegó cada «Avísame cuando llegue».
  ['lista_espera', 'pais', "TEXT NOT NULL DEFAULT ''"],
  ['lista_espera', 'lat', 'REAL'],
  ['lista_espera', 'lng', 'REAL'],
  ['lista_espera', 'origen', "TEXT NOT NULL DEFAULT 'web'"],
  // C-CARRO-XL (30 oct 2026): carro grande (6 plazas o más).
  ['cotizaciones_viaje', 'categoria', "TEXT NOT NULL DEFAULT 'estandar'"],
  ['viajes', 'categoria', "TEXT NOT NULL DEFAULT 'estandar'"],
  ['tarifas_viaje', 'xl_pb', 'INTEGER'],
  // C-ENVIOS (30 oct 2026): tope del valor declarado de un paquete en la ciudad.
  ['tarifas_viaje', 'valor_maximo', 'INTEGER'],
  // C-MOTO-CIUDAD (30 oct 2026): si este viaje pide el código para empezar (según la ciudad y la hora).
  ['viajes', 'pin_requerido', 'INTEGER NOT NULL DEFAULT 1'],
  // C-REGALO-VIAJE-REAL (19 nov 2026): lecturas del teléfono del pasajero durante un viaje con regalo
  // (junto al conductor o lejos de él). El recorrido se suma en distancia_m_real, que ya existía.
  ['viajes', 'pasajero_cerca', 'INTEGER NOT NULL DEFAULT 0'],
  ['viajes', 'pasajero_lejos', 'INTEGER NOT NULL DEFAULT 0'],
  ['viajes', 'pasajero_ubicacion_en', 'TEXT'],
  // C-CARGO-AL-AFECTADO (30 oct 2026): el conductor al que le cancelaron (el cargo es suyo).
  ['deudas_pasajero', 'conductor_id', 'TEXT'],
  // C-KYC-AUTO (29 oct 2026): las dos tomas girando la cabeza y el consentimiento antes de la selfie.
  ['kyc', 'giro_1', 'TEXT'],
  ['kyc', 'giro_2', 'TEXT'],
  ['kyc', 'consentimiento_en', 'TEXT'],
  // C-PEDIDO-PROGRAMADO (29 oct 2026): inicio de la franja elegida (UTC); NULL = lo antes posible.
  ['pedidos', 'programado_para', 'TEXT'],
  // C-TICKETS-EQUIPO (29 oct 2026): prioridad y persona del equipo a cargo.
  ['tickets', 'prioridad', "TEXT NOT NULL DEFAULT 'normal'"],
  ['tickets', 'asignado_a', 'TEXT'],
  // C-REPARTIDOR-DESTACADO (29 oct 2026): cumple los requisitos del «Top Dasher».
  ['repartidores', 'destacado', 'INTEGER NOT NULL DEFAULT 0'],
  // C-PEDIDO-GRUPO-HORA (29 oct 2026): hora de cierre opcional y cuándo se avisó al anfitrión.
  ['pedidos_grupo', 'cierra_en', 'TEXT'],
  ['pedidos_grupo', 'avisado_en', 'TEXT'],
  // C-PEDIDO-GRUPO-TIENDA: en una tienda, qué hacer si falta cada producto.
  ['pedidos_grupo_items', 'sustitucion', 'TEXT'],
  ['usuarios', 'zona_id', 'TEXT'],
  ['usuarios', 'correo_confirmado_en', 'TEXT'],
  ['usuarios', 'stripe_cliente', 'TEXT'],
  // F19 (18 oct 2026): tope de intentos del PIN de entrega.
  ['pines_entrega', 'intentos', 'INTEGER NOT NULL DEFAULT 0'],
  // Pantalla de dinero del superadmin (18 oct 2026): abonos fallidos resueltos a mano.
  ['abonos_fallidos', 'resuelto_en', 'TEXT'],
  // Impuesto de ventas por pedido (18 oct 2026).
  ['pedidos', 'impuesto', 'INTEGER NOT NULL DEFAULT 0'],
  // Fase 2 · cobro directo (18 oct 2026). En SQLite el CHECK no se puede agregar después: lo vigila el código.
  ['pedidos', 'metodo_pago', "TEXT NOT NULL DEFAULT 'tarjeta'"],
  ['pedidos', 'cobro_estado', "TEXT NOT NULL DEFAULT 'no_aplica'"],
  ['pedidos', 'monto_recibido', 'INTEGER'],
  ['pedidos', 'cobro_confirmado_en', 'TEXT'],
  ['pedidos', 'cobro_nota', 'TEXT'],
  ['pedidos', 'cobro_confirmado_por', 'TEXT'],
  // Cupones (18 oct 2026).
  ['calificaciones', 'respuesta', 'TEXT'],
  ['calificaciones', 'respondida_en', 'TEXT'],
  ['restaurantes', 'categorias_orden', 'TEXT'],
  ['pedidos', 'cupon', 'TEXT'],
  ['pedidos', 'descuento', 'INTEGER NOT NULL DEFAULT 0'],
  ['pedidos', 'conciliacion_estado', "TEXT NOT NULL DEFAULT 'no_aplica'"],
  ['restaurantes', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  ['restaurantes', 'geohash', 'TEXT'],
  // C-ACEPTAR-SOLO: los pedidos se aceptan solos al pagarse (como el «auto-confirm» de DoorDash).
  ['restaurantes', 'aceptar_solo', 'INTEGER NOT NULL DEFAULT 0'],
  // C-AGOTADO-HOY: plato agotado «por hoy»: vuelve solo a esta hora (UTC, medianoche del restaurante).
  ['platos', 'agotado_hasta', 'TEXT'],
  // C-DIRECCION-APTO: apartamento, piso o edificio en su propia casilla (como DoorDash).
  ['pedidos', 'apto', "TEXT NOT NULL DEFAULT ''"],
  // C-ALERGIAS (2 nov 2026): pedido de alergias del cliente, aparte de las notas (como Uber Eats).
  ['pedidos', 'alergias', "TEXT NOT NULL DEFAULT ''"],
  // C-REGALAR-PEDIDO (2 nov 2026): pedido enviado como regalo (como «Send as a gift» de DoorDash).
  ['pedidos', 'para_nombre', "TEXT NOT NULL DEFAULT ''"],
  ['pedidos', 'para_telefono', "TEXT NOT NULL DEFAULT ''"],
  ['pedidos', 'para_mensaje', "TEXT NOT NULL DEFAULT ''"],
  ['direcciones_cliente', 'apto', "TEXT NOT NULL DEFAULT ''"],
  // C-FOTO-PUERTA (15 nov 2026): casa o edificio de la dirección guardada; el pedido recuerda de qué
  // dirección guardada salió (para mostrarle sus fotos al repartidor); y el interruptor por zona
  // que exige la primera foto (apagado en todas partes: lo enciende el superadmin).
  ['direcciones_cliente', 'tipo_lugar', "TEXT NOT NULL DEFAULT ''"],
  ['pedidos', 'direccion_id', 'TEXT'],
  ['zonas', 'foto_puerta_obligatoria', 'INTEGER NOT NULL DEFAULT 0'],
  // C-PANICO-ZONA (16 nov 2026): la persona responsable de la zona que recibe el SMS de pánico.
  ['zonas', 'responsable_nombre', "TEXT NOT NULL DEFAULT ''"],
  ['zonas', 'responsable_telefono', "TEXT NOT NULL DEFAULT ''"],
  // C-OPCIONES-ANIDADAS: la opción abre otro grupo del mismo plato (combo → bebida → tamaño).
  ['opciones', 'abre_grupo_id', 'TEXT'],
  // C-CHAT-FOTOS: foto dentro del chat del pedido (privada, en chat/<pedido>/…).
  ['mensajes_pedido', 'foto_clave', 'TEXT'],
  ['repartidores', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  ['repartidores', 'geohash', 'TEXT'],
  ['pedidos', 'zona_id', "TEXT NOT NULL DEFAULT 'US-FL-MIAMI'"],
  // Superadmin a escala (12 oct 2026): código de ciudad (MIA, NOV…) e ID del repartidor.
  ['zonas', 'codigo_ciudad', 'TEXT'],
  ['repartidores', 'codigo', 'TEXT'],
  // Inglés como idioma principal (13 oct 2026): la categoría del plato también va en inglés.
  ['platos', 'categoria_en', "TEXT NOT NULL DEFAULT ''"],
  // Retención de fotos (14 oct 2026): a los 30 días se borra el archivo y queda cuándo.
  ['evidencias', 'borrada_en', 'TEXT'],
  // Mayoría de edad (14 oct 2026): platos que solo se entregan en mano a un adulto con documento.
  ['platos', 'requiere_edad', 'INTEGER NOT NULL DEFAULT 0'],
  // C-FILTROS-DIETA (29 oct 2026): marcas del plato separadas por coma («vegano,halal»).
  ['platos', 'etiquetas', "TEXT NOT NULL DEFAULT ''"],
  // C-CALORIAS (2 nov 2026): calorías opcionales por plato, como Uber Eats.
  ['platos', 'calorias', 'INTEGER'],
  // Cómo se entregó (14 oct 2026). Se agregaron al CREATE de una tabla que ya existía y nunca
  // llegaron a la base: el estado del repartidor y las fotos de recogida y entrega fallaban
  // (encontrado en la validación del 15 oct; candado C-ESQUEMA-COMPLETO).
  ['evidencias', 'modo', 'TEXT'],
  ['evidencias', 'nota', "TEXT NOT NULL DEFAULT ''"],
  // Multiservicio, Fase 1 (15 oct 2026): el vehículo con el que el conductor trabaja ahora.
  // Nadie lo lee todavía para Comida; queda vacío hasta la migración M5 (docs/fase-1/).
  ['repartidores', 'vehiculo_activo_id', 'TEXT REFERENCES vehiculos(id)'],
  // Idempotencia persistente de los avisos de Stripe (16 oct 2026, C-FALLOS-CRITICOS 1): los
  // avisos ya guardados estaban aplicados, por eso nacen como 'hecho'.
  ['avisos_stripe', 'estado', "TEXT NOT NULL DEFAULT 'hecho'"],
  // Divoox Flex · Fase 2 (27 oct 2026): pruebas de entrega exigidas por empresa y por envío.
  ['empresas', 'config_entrega_json', "TEXT NOT NULL DEFAULT '{}'"],
  ['envios', 'config_entrega_json', 'TEXT'],
  ['ruta_paradas', 'llegada_en', 'TEXT'],
  // Flex · Fase 3: archivo de prueba borrado por una política de retención aprobada.
  ['flex_pruebas', 'purgada_en', 'TEXT'],
  // Divoox Moto · M1 (28 oct 2026, después de REA): cargo fijo, ruta estimada por ciudad y la copia
  // de la tarifa dentro de cada cotización. Las tablas ya existían en el sitio de pruebas.
  ['tarifas_viaje', 'cargo_fijo', 'INTEGER NOT NULL DEFAULT 0'],
  ['tarifas_viaje', 'factor_calle_pb', 'INTEGER NOT NULL DEFAULT 13000'],
  ['tarifas_viaje', 'velocidad_kmh', 'INTEGER NOT NULL DEFAULT 24'],
  ['cotizaciones_viaje', 'tarifa_json', "TEXT NOT NULL DEFAULT '{}'"],
  // C-VIAJE-PASOS-REALES: tope de intentos del código de inicio del viaje.
  ['viajes', 'intentos_pin', 'INTEGER NOT NULL DEFAULT 0'],
  // C-CHAT-VIAJE-LLEGA (24 nov 2026): hasta qué mensaje del chat vio cada uno (una escritura al abrir
  // el chat, nada por mirar). Con eso la ficha del viaje dice cuántos no ha visto.
  ['viajes', 'chat_visto_cliente', 'INTEGER'],
  ['viajes', 'chat_visto_conductor', 'INTEGER'],
  // Divoox Moto · M2: con qué paga el pasajero y de qué cotización salió el viaje.
  ['viajes', 'metodo_pago', "TEXT NOT NULL DEFAULT 'efectivo'"],
  ['viajes', 'cotizacion_id', 'TEXT'],
  // Divoox Moto · M7: el viaje en el que se cobró la deuda del pasajero.
  ['deudas_pasajero', 'cobrada_en', 'TEXT'],
  // Flex · Fase 5 (C-FLEX-UBICACION): destinatario y ubicación exacta de cada envío.
  ['envios', 'destinatario_correo', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'destinatario_documento', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'referencias', "TEXT NOT NULL DEFAULT ''"],
  // C-EMPRESA-LEGAL (LG1): los datos legales de la empresa de logística.
  ['empresas', 'numero_fiscal', "TEXT NOT NULL DEFAULT ''"],
  ['empresas', 'direccion_fiscal', "TEXT NOT NULL DEFAULT ''"],
  ['empresas', 'representante', "TEXT NOT NULL DEFAULT ''"],
  ['empresas', 'telefono', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'ubicacion_estado', "TEXT NOT NULL DEFAULT 'sin_coordenadas'"],
  ['envios', 'ubicacion_fuente', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'ubicacion_confirmada_en', 'TEXT'],
  ['envios', 'destinatario_usuario_id', 'TEXT'],
  ['envios', 'enlace_ubicacion_huella', 'TEXT'],
  ['envios', 'enlace_ubicacion_vence', 'TEXT'],
  // Flex · Fase 6 (C-FLEX-COBRO): cobro contra entrega y quién recibió.
  ['envios', 'cobro_monto', 'INTEGER'],
  ['envios', 'cobro_moneda', 'TEXT'],
  ['envios', 'cobro_estado', "TEXT NOT NULL DEFAULT 'sin_cobro'"],
  ['envios', 'cobro_metodo', 'TEXT'],
  ['envios', 'cobro_monto_recibido', 'INTEGER'],
  ['envios', 'cobro_moneda_recibida', 'TEXT'],
  ['envios', 'cobro_referencia', 'TEXT'],
  ['envios', 'cobro_conductor_id', 'TEXT'],
  ['envios', 'cobro_ruta_id', 'TEXT'],
  ['envios', 'cobrado_en', 'TEXT'],
  ['envios', 'liquidado_en', 'TEXT'],
  ['envios', 'liquidado_por', 'TEXT'],
  ['envios', 'recibio_documento', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'recibio_relacion', "TEXT NOT NULL DEFAULT ''"],
  // Tiendas · C-TIENDAS-CATALOGO: el tipo de comercio (restaurante, mercado, farmacia…).
  ['restaurantes', 'tipo_comercio', "TEXT NOT NULL DEFAULT 'restaurante'"],
  // Flex · C-FLEX-RETIRO: retiro en un punto (centro) con plazo.
  ['envios', 'entrega_tipo', "TEXT NOT NULL DEFAULT 'domicilio'"],
  ['envios', 'punto_centro_id', 'TEXT'],
  // C-FLEX-ENCUENTRO (LG2): el nombre del punto de encuentro en la vía («Estación Doña María»).
  ['envios', 'punto_encuentro', "TEXT NOT NULL DEFAULT ''"],
  ['envios', 'retiro_disponible_en', 'TEXT'],
  ['envios', 'retiro_vence', 'TEXT'],
  // Flex · Fase 4: disputa de una recarga de la billetera de una empresa.
  ['disputas', 'recarga_empresa_id', 'TEXT'],
  ['ruta_paradas', 'resuelta_en', 'TEXT'],
  // Pausa automática sin señal (16 oct 2026, C-PAUSA-SIN-SENAL): la última vez que la app o el
  // panel del restaurante preguntó por pedidos, y cuándo se le avisó de la pausa.
  ['restaurantes', 'senal_en', 'TEXT'],
  ['restaurantes', 'pausa_aviso_en', 'TEXT'],
  // C-REVISION-SIN-SENAL (3 nov 2026): solo el restaurante de la cuenta de revisión de las tiendas
  // sale abierto sin su app o su panel encendidos (el revisor de Apple no los tiene abiertos).
  ['restaurantes', 'revision_sin_senal', 'INTEGER NOT NULL DEFAULT 0'],
  // Territorio (17 oct 2026, C-TERRITORIO): estado o provincia e idioma de cada ciudad, y el área
  // de cobertura (polígono) en la que cae cada restaurante, repartidor y pedido.
  ['zonas', 'region', "TEXT NOT NULL DEFAULT ''"],
  ['zonas', 'idioma', "TEXT NOT NULL DEFAULT 'en'"],
  ['restaurantes', 'area_id', 'TEXT'],
  ['repartidores', 'area_id', 'TEXT'],
  ['pedidos', 'area_id', 'TEXT'],
  // Repartidor como los grandes (18 oct 2026, C-REPARTIDOR-GRANDES): pausa sin desconectarse.
  ['repartidores', 'pausado', 'INTEGER NOT NULL DEFAULT 0'],
  // C-COBRO-DIRECTO-LOCAL (19 oct 2026): foto del ticket del restaurante.
  ['pagos_local', 'ticket_clave', 'TEXT'],
  // C-TARIFAS-PAIS (19 oct 2026): moneda del pedido y tarifas aplicadas al crearlo.
  ['pedidos', 'moneda', "TEXT NOT NULL DEFAULT 'USD'"],
  ['pedidos', 'tarifas_json', 'TEXT'],
  // Disputa de una recarga del saldo prepago pagada con tarjeta (19 oct 2026).
  ['disputas', 'recarga_id', 'TEXT'],
  // C-TIENDAS-REEMPLAZOS (29 oct 2026): los reemplazos que propone la tienda y el que se eligió.
  ['ajustes_pedido', 'propuestas_json', 'TEXT'],
  ['ajustes_pedido', 'reemplazo_id', 'TEXT'],
  // C-IDENTIDAD-UNICA (29 oct 2026): correo y teléfono en su forma única.
  ['usuarios', 'correo_canonico', 'TEXT'],
  ['usuarios', 'telefono_canonico', 'TEXT'],
  // C-TELEFONO-VUELTA: cuándo confirmó su teléfono por SMS por última vez.
  ['usuarios', 'telefono_verificado_en', 'TEXT'],
  // C-TELEFONO-AL-REGISTRARSE (22 nov 2026): la cuenta nació en una app que exige confirmar el celular.
  ['usuarios', 'telefono_exigido_en', 'TEXT'],
  // C-CODIGO-CANALES (23 nov 2026): por dónde salió el código (WhatsApp o SMS).
  ['codigos_telefono', 'canal', 'TEXT'],
  ['envios_codigo_telefono', 'canal', 'TEXT'],
  // C-WHATSAPP-ENTREGA (23 nov 2026): la entrega de cada mensaje de WhatsApp y el respaldo por SMS.
  ['codigos_telefono', 'referencia', 'TEXT'],
  ['codigos_telefono', 'respaldo_en', 'TEXT'],
  // C-TELEFONO-SIN-CANAL (23 nov 2026): el código no salió por ningún canal; la puerta se abre.
  ['codigos_telefono', 'sin_canal_en', 'TEXT'],
  // C-COMIDA-VE-QUIEN-PAGA (23 nov 2026): la comisión del restaurante congelada al pedir.
  ['pagos_comida', 'comision_regla_json', 'TEXT'],
  ['sms_enviados', 'entrega', 'TEXT'],
  ['sms_enviados', 'entrega_error', 'TEXT'],
  ['sms_enviados', 'entrega_en', 'TEXT'],
  // C-CUPON-USOS (20 nov 2026): tope por número de usos de un cupón de Divoox.
  ['cupones_divoox', 'usos_maximos', 'INTEGER'],
  // C-SMS-CONSENTIMIENTO (9 nov 2026): la casilla de SMS (fecha, versión del texto y canal).
  ['usuarios', 'sms_consentido_en', 'TEXT'],
  ['usuarios', 'sms_consentimiento_version', 'TEXT'],
  ['usuarios', 'sms_consentimiento_canal', 'TEXT'],
  // C-PERFIL-CONDUCTOR (20 nov 2026, todos los países): lo que el conductor cuenta a sus pasajeros:
  // los idiomas que habla («es,en,pt») y un dato corto (filtrado por C-MODERACION).
  ['repartidores', 'idiomas_perfil', "TEXT NOT NULL DEFAULT ''"],
  ['repartidores', 'dato_perfil', "TEXT NOT NULL DEFAULT ''"],
  // C-GANAR-POR-TIEMPO: «oferta» (lo de siempre) o «tiempo».
  ['repartidores', 'modo_pago', "TEXT NOT NULL DEFAULT 'oferta'"],
  // C-CIUDAD-CONDUCTOR (13 nov 2026): cuándo eligió el conductor su ciudad por última vez (una vez
  // cada 24 horas y dentro de su país; sin valor, todavía no la eligió).
  ['repartidores', 'ciudad_elegida_en', 'TEXT'],
  // C-BARRA-ACTIVACION (23 nov 2026): cuándo se le avisó «Ya puedes recibir carreras» (una vez en la vida).
  ['repartidores', 'activacion_avisada_en', 'TEXT'],
  // C-REGRESO-PASAJERO (25 nov 2026): la ciudad base del conductor y el tipo de la fila del modo
  // destino («destino» o «regreso») con su marca de uso contado.
  ['repartidores', 'zona_base_id', 'TEXT'],
  ['modo_destino', 'tipo', "TEXT NOT NULL DEFAULT 'destino'"],
  ['modo_destino', 'uso_contado', 'INTEGER NOT NULL DEFAULT 0'],
  // C-PAGO-MOVIL-CORREGIR (13 nov 2026): el «no me llegó» corregido a «sí me llegó» (una sola vez).
  ['viajes_pago_movil', 'corregido_en', 'TEXT'],
  // C-VIAJE-PROGRAMADO (14 nov 2026): la hora reservada del viaje (sin valor, es para ya) y cuántos
  // minutos antes empieza a buscar conductor en esa ciudad (sin valor, 15).
  ['viajes', 'programado_para', 'TEXT'],
  ['ajustes_viaje_zona', 'programado_antes_min', 'INTEGER'],
  // C-FOTO-CONDUCTOR-MINIATURA (14 nov 2026): la miniatura de la selfie aprobada que ve el pasajero
  // (nunca la original). La hace el panel al aprobar la verificación.
  ['kyc', 'selfie_miniatura', 'TEXT'],
  // C-ENVIO-TAMANO y C-ENVIO-FOTO-ENTREGA (14 nov 2026): el tamaño del paquete, si la moto lleva
  // cajón (mediano) y la foto opcional al entregar.
  ['envios_persona', 'tamano', "TEXT NOT NULL DEFAULT 'pequeno'"],
  ['envios_persona', 'foto_entrega', 'TEXT'],
  ['vehiculos', 'con_cajon', 'INTEGER NOT NULL DEFAULT 0'],
  // C-LECTURAS-CATALOGO (14 nov 2026): el resumen de calificaciones y turnos de cada restaurante.
  ...COLUMNAS_RESUMEN_CATALOGO,
  // C-PERMISOS-FINOS (15 nov 2026): los permisos efectivos del equipo, calculados una vez por sesión
  // (cargarSesion ya lee la sesión: comprobar un permiso no cuesta lecturas), y cuándo confirmó el
  // segundo factor esa sesión.
  ['sesiones', 'permisos_json', 'TEXT'],
  ['sesiones', 'segundo_factor_en', 'TEXT'],
  // C-EQUIPO-INVITACION (15 nov 2026): los permisos y topes concretos que se aprobaron al invitar
  // (congelados): si la plantilla crece después, la invitación ya no sirve.
  ['invitaciones_equipo', 'acceso_json', 'TEXT'],
  // C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026): a quién se le ofrece primero el viaje, de
  // qué viaje fijo nace y, si lleva a un menor, su nombre (el responsable recibe los avisos).
  ['viajes_programados', 'rutina_id', 'TEXT'],
  ['viajes_programados', 'conductor_preferido_id', 'TEXT'],
  ['viajes', 'conductor_preferido_id', 'TEXT'],
  ['viajes', 'rutina_id', 'TEXT'],
  ['viajes', 'menor_nombre', 'TEXT'],
  // C-VIAJES-FIJOS: el conductor decide si lleva menores en ESE vehículo (nace apagado). No es
  // `acepta_menores`, que en Carro significa «recibir también los viajes de categorías de abajo».
  ['vehiculos', 'lleva_menores', 'INTEGER NOT NULL DEFAULT 0'],
  // C-CUENTA-UNICA (24 nov 2026, todos los países): el papel con el que actúa cada sesión (el de la app
  // que la abrió), el negocio del dueño en el panel web, la app de cada token de avisos y el papel del
  // puente al panel. Sin valor, todo sigue como hoy (una cuenta, un papel).
  ['sesiones', 'papel', 'TEXT'],
  ['sesiones', 'actua_como', 'TEXT'],
  ['dispositivos', 'app', 'TEXT'],
  ['puentes_sesion', 'papel', 'TEXT'],
  // C-REGISTRO-TODO-EL-PAIS (25 nov 2026; Venezuela y Estados Unidos): dónde VIVE la persona (País →
  // Estado → Ciudad del catálogo, `packages/compartido/src/lugarCuenta.ts`). `lugar_espera` = 1
  // mientras su ciudad no tiene una zona abierta (lista de espera de su ciudad); vuelve a 0 cuando
  // recibe su zona. Sin valor, todo sigue como hoy (cuentas viejas: la app se lo pide).
  ...LUGAR_COLUMNAS,
  // C-SALDO-CLIENTE (25 nov 2026, Venezuela): cuánto del viaje cubre el Saldo Divoox del pasajero
  // (apartado al pedir, ajustado al terminar, 0 si el viaje no se hizo). Todas las pantallas lo leen.
  ['viajes', 'saldo_divoox', 'INTEGER NOT NULL DEFAULT 0'],
];

/**
 * Los últimos diez dígitos del teléfono guardado tal cual (cuentas de antes del teléfono único). La
 * consulta del registro usa EXACTAMENTE esta expresión: así SQLite usa el índice que la guarda.
 */
export const TELEFONO_DIEZ =
  "substr(replace(replace(replace(replace(replace(telefono, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), -10)";

/** Índices compuestos: primero la zona (filtra casi todo), luego el estado, luego orden o celda. */
const INDICES = [
  // C-AVISOS-WEB: sobre la columna sesion_id (llega con COLUMNAS). Una sesión cerrada, vencida o
  // borrada por cualquier camino (salir, cambio de clave, el reloj, el superadmin) se lleva sus
  // suscripciones web: el navegador deja de recibir los pedidos de esa cuenta.
  'CREATE INDEX IF NOT EXISTS suscripciones_web_sesion ON suscripciones_web(sesion_id)',
  'CREATE TRIGGER IF NOT EXISTS suscripciones_web_sin_sesion AFTER DELETE ON sesiones BEGIN DELETE FROM suscripciones_web WHERE sesion_id = OLD.id; END',
  // Flex · Fase 5: sobre columnas que llegan con COLUMNAS (en schema.sql romperían la publicación).
  'CREATE INDEX IF NOT EXISTS envios_destinatario ON envios(destinatario_usuario_id, creado_en)',
  // Fase 6: el efectivo en la mano de cada conductor y los cobros de cada ruta.
  'CREATE INDEX IF NOT EXISTS envios_cobro_conductor ON envios(cobro_conductor_id, cobro_estado)',
  'CREATE INDEX IF NOT EXISTS envios_cobro_ruta ON envios(cobro_ruta_id, cobro_estado)',
  'CREATE UNIQUE INDEX IF NOT EXISTS envios_enlace_ubicacion ON envios(enlace_ubicacion_huella) WHERE enlace_ubicacion_huella IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS restaurantes_zona_estado ON restaurantes(zona_id, estado, abierto)',
  'CREATE INDEX IF NOT EXISTS restaurantes_zona_celda ON restaurantes(zona_id, geohash)',
  'CREATE INDEX IF NOT EXISTS repartidores_zona_celda ON repartidores(zona_id, conectado, geohash)',
  'CREATE INDEX IF NOT EXISTS pedidos_zona_estado ON pedidos(zona_id, estado, creado_en)',
  'CREATE INDEX IF NOT EXISTS pedidos_repartidor_estado ON pedidos(repartidor_id, estado)',
  'CREATE INDEX IF NOT EXISTS lista_espera_zona ON lista_espera(zona_id, tipo, creado_en)',
  // Buscadores del superadmin pensados para millones de cuentas: por ID, por nombre (que empiece
  // por…), por teléfono, y listas por ciudad paginadas por clave (sin OFFSET).
  'CREATE UNIQUE INDEX IF NOT EXISTS repartidores_codigo ON repartidores(codigo)',
  'CREATE INDEX IF NOT EXISTS repartidores_zona_codigo ON repartidores(zona_id, codigo)',
  'CREATE INDEX IF NOT EXISTS usuarios_rol_nombre ON usuarios(rol, nombre COLLATE NOCASE)',
  'CREATE INDEX IF NOT EXISTS usuarios_rol_zona ON usuarios(rol, zona_id, creado_en)',
  // C-VERIFICACIONES-SIN-ENVIAR: «Sin enviar» baja desde la cuenta más nueva de cada rol y corta al
  // llenar la página (una fila más por cuenta creada).
  'CREATE INDEX IF NOT EXISTS usuarios_rol_creado ON usuarios(rol, creado_en)',
  'CREATE INDEX IF NOT EXISTS usuarios_telefono ON usuarios(telefono)',
  // C-CUENTA-PRUEBA: solo las cuentas de prueba (pocas): los reportes arman su lista sin recorrer a todos.
  'CREATE INDEX IF NOT EXISTS usuarios_es_prueba ON usuarios(es_prueba) WHERE es_prueba = 1',
  'CREATE INDEX IF NOT EXISTS pedidos_repartidor_fecha ON pedidos(repartidor_id, creado_en)',
  'CREATE INDEX IF NOT EXISTS restaurantes_area ON restaurantes(area_id)',
  'CREATE INDEX IF NOT EXISTS repartidores_area ON repartidores(area_id, conectado)',
  'CREATE INDEX IF NOT EXISTS pedidos_area_estado ON pedidos(area_id, estado, creado_en)',
  // C-PANEL-ARMAZON (14 nov 2026): el tablero del superadmin cuenta pedidos y viajes por día. Sin
  // estos dos índices recorría las tablas enteras en cada carga.
  'CREATE INDEX IF NOT EXISTS pedidos_creado ON pedidos(creado_en)',
  'CREATE INDEX IF NOT EXISTS operaciones_viaje_creado ON operaciones(tipo_operacion, creado_en)',
  // C-LECTURAS-POR-PETICION (13 nov 2026): el registro buscaba el correo y el teléfono únicos
  // recorriendo TODAS las cuentas (5.600 filas con el volumen del sitio de pruebas, y crece con
  // cada cliente). Una fila por cuenta nueva en cada índice; el registro pasa a leer unas pocas.
  'CREATE INDEX IF NOT EXISTS usuarios_correo_canonico ON usuarios(correo_canonico)',
  'CREATE INDEX IF NOT EXISTS usuarios_telefono_canonico ON usuarios(telefono_canonico)',
  // Solo las cuentas viejas sin teléfono único (de antes del 29 oct): las nuevas no escriben aquí.
  `CREATE INDEX IF NOT EXISTS usuarios_telefono_viejo ON usuarios(${TELEFONO_DIEZ})
     WHERE telefono_canonico IS NULL AND telefono IS NOT NULL AND telefono != ''`,
  // C-LECTURAS-VUELTA-RUTAS (13 nov 2026): el reloj devuelve cada minuto los platos agotados «por
  // un rato» y recorría el menú entero (3.000 filas con el volumen del sitio de pruebas). Solo
  // guarda los platos con hora de vuelta: una escritura al agotarlo con hora y otra al volver.
  'CREATE INDEX IF NOT EXISTS platos_agotados_hasta ON platos(agotado_hasta) WHERE agotado_hasta IS NOT NULL',
  // LECT-4 (14 nov 2026): borrar un vehículo hace que SQLite busque si algún repartidor lo tiene
  // como activo (clave foránea): sin índice recorría TODOS los repartidores por cada vehículo (las
  // pruebas F1, F3 y M4/M5 borran sus vehículos temporales). Solo guarda los que tienen vehículo
  // activo y se escribe solo cuando ese vehículo cambia: la ubicación, que cambia cada pocos
  // segundos, no lo toca.
  'CREATE INDEX IF NOT EXISTS repartidores_vehiculo_activo ON repartidores(vehiculo_activo_id) WHERE vehiculo_activo_id IS NOT NULL',
  // C-BUSCADOR-SERIO (15 nov 2026): los índices del buscador del superadmin (buscadorSql.ts).
  ...INDICES_BUSCADOR,
  // C-REGISTRO-TODO-EL-PAIS: el lugar donde vive la persona (esquemaLugar.ts).
  ...INDICES_LUGAR,
  // C-INVITAR-LIDER-UN-PASO: la página del enlace personal busca la invitación por su token.
  'CREATE UNIQUE INDEX IF NOT EXISTS invitaciones_lider_token ON invitaciones_lider(token) WHERE token IS NOT NULL',
  // C-FICHA-OPERACION y C-MONITOREO-SERVICIOS (15 nov 2026): los reclamos de un pedido y de un viaje
  // en su ficha (sin esto, cada ficha recorría todos los tickets). Parciales: un ticket sin pedido o
  // sin viaje no entra; un reclamo enlazado es UNA escritura más al crearlo, y mirar no escribe.
  // El de pedidos también lo usa la retención de fotos (NOT EXISTS de un reclamo abierto).
  'CREATE INDEX IF NOT EXISTS tickets_pedido ON tickets(pedido_id) WHERE pedido_id IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS tickets_operacion ON tickets(operacion_id) WHERE operacion_id IS NOT NULL',
];

/**
 * Precios de fábrica nuevos (13 oct 2026, C-EQUILIBRIO): si la configuración de dinero guardada
 * es EXACTAMENTE la de fábrica anterior, pasa a la nueva. Si alguien ya la cambió a mano en el
 * superadmin, no se toca: lo que decidió una persona manda sobre la fábrica.
 */
async function preciosDeFabrica(db: D1Database): Promise<void> {
  const f = await db
    .prepare("SELECT valor FROM config WHERE clave = 'dinero'")
    .first<{ valor: string }>()
    .catch(() => null);
  if (!f) return;
  let guardada: unknown;
  try {
    guardada = JSON.parse(f.valor);
  } catch {
    return;
  }
  // Comparación completa, sin importar el orden de las claves (también las de adentro).
  const ordenar = (v: unknown): unknown =>
    v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, ordenar(x)]),
        )
      : v;
  const igual = (a: unknown, b: unknown) =>
    JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
  if (!igual(guardada, CONFIG_DINERO_ANTERIOR)) return;
  await db
    .prepare("UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave = 'dinero'")
    .bind(JSON.stringify(CONFIG_DINERO_INICIAL))
    .run();
  console.warn('esquema: precios de fábrica actualizados al punto de equilibrio');
}

/**
 * Multiservicio, Fase 1 (C-SERVICIOS-IMPLEMENTADOS): los servicios que ESTE código sabe atender,
 * con la versión de su contrato. Solo Comida. Moto, Carro, Mercado, Envíos y Farmacia están en el
 * catálogo pero, sin fila aquí, los disparadores de schema.sql no dejan encenderlos. Agregar un
 * servicio a esta lista exige su fase aprobada (V1.2 §11).
 */
export const SERVICIOS_IMPLEMENTADOS = new Map<string, number>([['comida', 1]]);

/**
 * Divoox Moto · Fase M1 (C-MOTO-SOLO-PRUEBAS): servicios que este código atiende SOLO en el sitio
 * de pruebas, mientras se construyen (docs/PLAN-MOTO-PASAJEROS.md). En producción no existen: la
 * sincronización los suspende como a cualquier servicio no implementado.
 */
export const SERVICIOS_EN_PRUEBA = new Map<string, number>([
  ['moto', 1],
  // Carro (30 oct 2026): sobre el motor de Moto, solo en pruebas hasta que Richard decida país y seguro.
  ['carro', 1],
  // Envíos (30 oct 2026): paquetes de persona a persona sobre el motor de viajes, solo en pruebas.
  ['envios', 1],
  // Tiendas (C-TIENDAS-VITRINA, 28 oct 2026): solo en pruebas hasta que Richard abra cada país.
  ['mercado', 1],
  ['farmacia', 1],
  ['licores', 1],
  ['mas', 1],
]);

/**
 * C-PILOTO-SERVICIOS (30 oct 2026): lo que se puede encender «solo piloto» en producción para los
 * participantes autorizados. Moto y Carro NO: llevan pasajeros y esperan lo legal y el seguro.
 */
export const SERVICIOS_PILOTO = new Set(['envios', 'mercado', 'farmacia', 'licores', 'mas']);

/** Lo que este código atiende en ese entorno (el entorno sale del dominio que sirve la petición). */
export function serviciosImplementados(entorno: Entorno | null): Map<string, number> {
  return entorno === 'pruebas'
    ? new Map([...SERVICIOS_IMPLEMENTADOS, ...SERVICIOS_EN_PRUEBA])
    : SERVICIOS_IMPLEMENTADOS;
}

/**
 * C-SERVICIOS-RECORRIDO-LOCAL (SIG-8): el servidor LOCAL del recorrido (localhost con
 * SERVICIOS_PRUEBA_LOCAL=1) declara los servicios en prueba igual que el sitio de pruebas. Sin esto,
 * cada arranque nuevo del servidor local suspendía Carro, Moto y Envíos aunque una prueba los acabara
 * de encender («servicio no disponible en tu ciudad»). En un sitio publicado no cambia nada.
 */
export function entornoDeServicios(
  entorno: Entorno | null,
  pruebaLocal: string | undefined,
): Entorno | null {
  return entorno === 'local' && pruebaLocal === '1' ? 'pruebas' : entorno;
}

async function sincronizarServicios(db: D1Database, entorno: Entorno | null): Promise<void> {
  const hay = await db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'servicios_implementados'",
    )
    .first();
  if (!hay) return;
  const implementados = new Map(serviciosImplementados(entorno));
  // C-MOTO-POR-PAIS: en producción, un servicio de pasajeros abierto por el superadmin en un país
  // (con la marca en registro) también lo atiende este código. Hoy no hay ninguno.
  for (const [servicio] of await aperturasVigentes(db).catch((e: unknown) => {
    console.error('esquema: no se pudieron leer las aperturas por país', e);
    return [] as Array<[string, string]>;
  }))
    if (!implementados.has(servicio)) implementados.set(servicio, 1);
  const ids = [...implementados.keys()];
  const marcas = ids.map(() => '?').join(',');
  await db.batch([
    ...[...implementados].map(([id, contrato]) =>
      db
        .prepare(
          'INSERT INTO servicios_implementados (servicio_id, contrato) SELECT id, ? FROM servicios WHERE id = ? ' +
            "ON CONFLICT(servicio_id) DO UPDATE SET contrato = excluded.contrato, desplegado_en = datetime('now') " +
            // Sin cambio de contrato no se escribe: cada arranque en frío dejaba la base ocupada.
            'WHERE servicios_implementados.contrato <> excluded.contrato',
        )
        .bind(contrato, id),
    ),
    // Lo que este código ya no sabe atender se suspende antes de dejar de declararlo.
    db
      .prepare(
        `UPDATE servicios SET estado = 'suspendido', actualizado_en = datetime('now') WHERE estado = 'disponible' AND id NOT IN (${marcas})`,
      )
      .bind(...ids),
    db
      .prepare(
        `UPDATE servicios_zona SET estado = 'suspendido', motivo = 'no implementado en esta versión', actualizado_en = datetime('now') WHERE estado = 'disponible' AND servicio_id NOT IN (${marcas})`,
      )
      .bind(...ids),
    db
      .prepare(`DELETE FROM servicios_implementados WHERE servicio_id NOT IN (${marcas})`)
      .bind(...ids),
  ]);
  // La primera vez, Comida queda disponible en las zonas activas (como funciona hoy). Después
  // manda lo que decida el panel: esto no vuelve a correr.
  const primera = await db.prepare("SELECT 1 FROM config WHERE clave = 'servicios_inicio'").first();
  if (!primera)
    await db.batch([
      db.prepare(
        "UPDATE servicios SET estado = 'disponible' WHERE id = 'comida' AND estado = 'proximamente'",
      ),
      db.prepare(
        "UPDATE servicios_zona SET estado = 'disponible' WHERE servicio_id = 'comida' AND estado = 'proximamente' AND zona_id IN (SELECT id FROM zonas WHERE activa = 1)",
      ),
      db.prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES ('servicios_inicio', '1')"),
    ]);
}

/**
 * C-ESQUEMA-COMPLETO: cada columna de schema.sql tiene que existir en la base real. Una columna
 * nueva en una tabla que ya existe NO la crea schema.sql: va en COLUMNAS. Si falta alguna, la
 * salud dice «esquema: error» y el semáforo frena la publicación antes de producción.
 */
export let columnasFaltantes: string[] = [];
async function revisarColumnas(db: D1Database): Promise<void> {
  // D1 no deja cruzar sqlite_master con pragma_table_info: se arma UNA consulta con una parte por
  // tabla (pragma_table_info('…') solo sí está permitido). Los nombres salen del propio esquema.
  const tablasEsquema = Object.keys(COLUMNAS_DEL_ESQUEMA).filter((t) =>
    /^[a-z_][a-z0-9_]*$/.test(t),
  );
  try {
    // D1 acepta hasta 5 partes por consulta: bloques de 5, todos en un solo lote (un viaje).
    const bloques: string[][] = [];
    for (let i = 0; i < tablasEsquema.length; i += 5) bloques.push(tablasEsquema.slice(i, i + 5));
    const respuestas = await db.batch(
      bloques.map((b) =>
        db.prepare(
          b
            .map((t) => `SELECT '${t}' AS t, name AS c FROM pragma_table_info('${t}')`)
            .join(' UNION ALL '),
        ),
      ),
    );
    const results = respuestas.flatMap((r) => (r.results ?? []) as { t: string; c: string }[]);
    const reales = new Set(results.map((r) => `${r.t}.${r.c}`));
    const tablas = new Set(results.map((r) => r.t));
    columnasFaltantes = Object.entries(COLUMNAS_DEL_ESQUEMA).flatMap(([t, cols]) =>
      tablas.has(t) ? cols.filter((c) => !reales.has(`${t}.${c}`)).map((c) => `${t}.${c}`) : [],
    );
  } catch (e) {
    columnasFaltantes = [`no se pudo revisar: ${String(e).slice(0, 120)}`];
  }
  if (columnasFaltantes.length)
    console.error('esquema: faltan columnas en la base', columnasFaltantes.join(', '));
}

/**
 * Fase 3: disparadores, vistas y cuadre de la ocupación (después de las columnas nuevas). Una
 * consulta comprueba si ya están todos; solo si falta alguno se crean, todos en UN lote (una
 * transacción: el cuadre ve los disparadores ya puestos). Antes corrían uno por uno en cada
 * arranque: la primera respuesta tardaba más de 5 s y el tiempo real se cortaba (16 oct 2026).
 */
async function asegurarFase3(db: D1Database): Promise<void> {
  // Una sola consulta para los disparadores de la Fase 3 y los de los pedidos
  // (C-TRANSICIONES-PEDIDO): el arranque sigue barato.
  // C-AGENTE-DIVOOX: los disparadores del dinero del Agente Divoox van en la misma comprobación.
  // C-CUENTA-UNICA: los frenos de la cuenta única (nadie se ofrece, lleva ni califica lo suyo).
  const todo = [
    ...ESQUEMA_FASE3,
    ...ESQUEMA_PEDIDOS,
    ...ESQUEMA_FLEX,
    ...ESQUEMA_AGENTES,
    ...ESQUEMA_CUENTA_UNICA,
    // C-SALDO-CLIENTE: el libro del Saldo Divoox, inmutable y nunca en negativo.
    ...ESQUEMA_SALDO_CLIENTE,
  ];
  const nombres = todo
    .map((sql) => /CREATE (?:TRIGGER|VIEW) IF NOT EXISTS (\w+)/.exec(sql)?.[1])
    .filter((n): n is string => Boolean(n));
  const { results } = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN (${nombres.map(() => '?').join(',')})`,
    )
    .bind(...nombres)
    .all<{ n: number }>();
  if (Number(results[0]?.n) === nombres.length) return;
  await db.batch(todo.map((sql) => db.prepare(sql)));
  console.warn('esquema: disparadores y vistas de la Fase 3 y de los pedidos creados');
}

let listo: Promise<void> | null = null;
export let ultimoErrorEsquema: string | null = null;

/**
 * C-ARRANQUE-SIN-LECTURAS (13 nov 2026, regla global «la nube no se come el dinero»). Todos los
 * países. Revisar la base entera (las columnas de las 230 tablas, los índices, los disparadores y los
 * servicios) cuesta unas 3.200 filas leídas en D1, y corría en CADA arranque de un servidor: en el
 * sitio de pruebas casi cada petición que escribía pagaba esas filas. Ahora, cuando la revisión sale
 * completa (sin columnas faltantes), se guarda su huella en `config`; el arranque siguiente con el
 * MISMO código, contra la misma base y en el mismo entorno lee esa fila y no repite nada. Un código
 * nuevo (otra lista de columnas, índices, disparadores o migraciones) cambia la huella y la revisión
 * completa vuelve a correr una vez.
 */
export const CLAVE_HUELLA_ESQUEMA = 'esquema_huella';

function huellaDe(texto: string): string {
  // cyrb53: corta, estable y sin depender de crypto (es una marca, no un secreto).
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** La huella de todo lo que la migración deja puesto (el código mismo incluido). */
export function huellaEsquema(entorno: Entorno | null): string {
  return (
    huellaDe(
      JSON.stringify([
        COLUMNAS,
        INDICES,
        ESQUEMA_FASE3,
        ESQUEMA_PEDIDOS,
        ESQUEMA_FLEX,
        ESQUEMA_AGENTES,
        ESQUEMA_CUENTA_UNICA,
        ESQUEMA_SALDO_CLIENTE,
        MOVIMIENTOS_DDL,
        String(rehacerSaldoClienteMovimientos),
        String(sentenciasMigrarLotes),
        COLUMNAS_DEL_ESQUEMA,
        CONFIG_DINERO_INICIAL,
        [...serviciosImplementados(entorno)],
        String(migrarCompleto),
        String(rehacerFranquicias),
        String(rehacerFlex),
        String(rehacerAprobacionesDinero),
        String(rehacerConductorDocumentos),
        String(rehacerCuentasCobro),
        String(rehacerPoliticasFinancieras),
        DISPARADORES_HABILITACION,
        String(rehacerElegibilidad),
        DISPARADOR_APROBAR_VEHICULO,
        String(rehacerAprobarVehiculo),
        String(repararLlegaSoloARevision),
        SQL_CANDIDATOS_LLEGA_SOLO,
        String(repararVehiculoActivo),
        SQL_CANDIDATOS_VEHICULO_ACTIVO,
        String(repararServiciosVehiculo),
        SQL_CANDIDATOS_SERVICIOS_VEHICULO,
        DISPARADORES_RASTRO,
        String(asegurarRastro),
        FUENTES_PASO,
        VERSION_RELLENO,
        String(rellenarRastro),
        String(sincronizarPoliticaRequisitos),
        PAISES_CON_PLAZO.map((p) => [p, politicaPlazoDeFabrica(p)]),
        String(sincronizarServicios),
        String(preciosDeFabrica),
        DISPARADORES_RESUMEN_CATALOGO,
        String(asegurarResumenCatalogo),
        SQL_MARCA_VIEJA,
        String(renombrarMarcaVieja),
        String(sembrarTabuladorVigia),
        SQL_ARRANQUE,
        TABULADOR_EL_VIGIA,
        QUIEN_PAGA_DDL,
        String(rehacerQuienPaga),
      ]),
    ) + `:${entorno ?? 'local'}`
  );
}

/**
 * C-TABULADOR-VIGIA: el arranque lee en UNA consulta la huella del esquema, la marca de la semilla de
 * El Vigía y si esa zona existe (tres búsquedas por clave). Así el reintento de la semilla no cuesta
 * otra consulta, y donde El Vigía no existe no se lee nada más.
 */
export const SQL_ARRANQUE = `SELECT valor,
  (SELECT s.valor FROM config s WHERE s.clave = ?2) AS semilla,
  (SELECT COUNT(*) FROM zonas z WHERE z.id = ?3) AS zona_vigia
  FROM config WHERE clave = ?1`;

async function migrar(db: D1Database, entorno: Entorno | null): Promise<void> {
  const huella = huellaEsquema(entorno);
  const hecha = await db
    .prepare(SQL_ARRANQUE)
    .bind(CLAVE_HUELLA_ESQUEMA, CLAVE_SEMILLA_TABULADOR_VIGIA, ZONA_TABULADOR_VIGIA)
    .first<{ valor: string; semilla: string | null; zona_vigia: number }>()
    .catch(() => null);
  if (hecha?.valor === huella) {
    columnasFaltantes = [];
    // C-TABULADOR-VIGIA: la semilla tiene su propio reintento: si la zona no existía al publicar, o
    // falló, o un servidor se cortó a mitad, se vuelve a intentar en el arranque siguiente.
    if (Number(hecha.zona_vigia) > 0 && semillaPorCorrer(leerMarcaSemilla(hecha.semilla)))
      await sembrarTabuladorVigia(db).catch((e: unknown) =>
        console.error('esquema: el reintento de la semilla de El Vigía falló', e),
      );
    return;
  }
  await migrarCompleto(db, entorno);
  // Solo una revisión limpia deja su huella: si falta algo, el próximo arranque vuelve a mirar.
  if (!columnasFaltantes.length)
    await db
      .prepare(
        `INSERT INTO config (clave, valor) VALUES (?, ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
      )
      .bind(CLAVE_HUELLA_ESQUEMA, huella)
      .run();
}

/**
 * C-NOMBRE-CON-MARCA (25 nov 2026, Richard: la línea de tiempo firmaba «por Soporte Tumbite») —
 * todos los países. Las cuentas del EQUIPO (rol admin) y los restaurantes de esas cuentas creados
 * antes del cambio de marca llevan «Tumbite» en el nombre visible: se renombran a «Divoox». Solo
 * cuentas nuestras (nunca el nombre de un cliente, un conductor o un restaurante ajeno). Idempotente:
 * el WHERE solo toma las filas que todavía dicen «Tumbite», así que una base ya al día no escribe
 * nada. Corre con la migración, nunca a mano.
 */
export const SQL_MARCA_VIEJA = [
  "UPDATE usuarios SET nombre = 'Soporte Divoox' WHERE nombre = 'Soporte Tumbite' AND rol = 'admin'",
  "UPDATE usuarios SET nombre = replace(nombre, 'Tumbite', 'Divoox') WHERE rol = 'admin' AND instr(nombre, 'Tumbite') > 0",
  `UPDATE restaurantes SET nombre = replace(nombre, 'Tumbite', 'Divoox')
    WHERE instr(nombre, 'Tumbite') > 0 AND dueno_id IN (SELECT id FROM usuarios WHERE rol = 'admin')`,
] as const;
export async function renombrarMarcaVieja(db: D1Database): Promise<number> {
  const r = await db.batch(SQL_MARCA_VIEJA.map((sql) => db.prepare(sql)));
  const cambiadas = r.reduce((n, x) => n + Number(x.meta?.changes ?? 0), 0);
  if (cambiadas) console.warn(`esquema: ${cambiadas} nombres del equipo pasaron a Divoox`);
  return cambiadas;
}

async function migrarCompleto(db: D1Database, entorno: Entorno | null): Promise<void> {
  await rehacerFranquicias(db);
  // C-ARRANQUE-RAPIDO: las columnas de TODAS las tablas de la lista en un solo lote (un viaje a la
  // base). Antes era una consulta por columna: 40 viajes seguidos en cada arranque, y la primera
  // respuesta tardaba tanto que la app del cliente no alcanzaba a confirmar la sesión (18 oct 2026).
  const tablasLista = [...new Set(COLUMNAS.map(([t]) => t))];
  const bloques: string[][] = [];
  for (let i = 0; i < tablasLista.length; i += 5) bloques.push(tablasLista.slice(i, i + 5));
  const respuestas = await db.batch(
    bloques.map((b) =>
      db.prepare(
        b
          .map((t) => `SELECT '${t}' AS t, name AS c FROM pragma_table_info('${t}')`)
          .join(' UNION ALL '),
      ),
    ),
  );
  const reales = new Set(
    respuestas
      .flatMap((r) => (r.results ?? []) as { t: string; c: string }[])
      .map((r) => `${r.t}.${r.c}`),
  );
  const existen = new Set([...reales].map((x) => x.split('.')[0]));
  for (const [tabla, columna, definicion] of COLUMNAS) {
    if (!existen.has(tabla)) continue; // la tabla aún no existe (la crea schema.sql)
    if (!reales.has(`${tabla}.${columna}`)) {
      await db.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`).run();
      console.warn(`esquema: columna agregada ${tabla}.${columna}`);
    }
  }
  // Un solo viaje a la base para todos los índices (antes, uno por índice en cada arranque).
  await db.batch(INDICES.map((sql) => db.prepare(sql)));
  // C-LECTURAS-CATALOGO: los disparadores del resumen del listado (y su relleno, una sola vez).
  await asegurarResumenCatalogo(db);
  // Flex · Fase 2: rehacer rutas_flex y conductor_ocupacion si vienen de antes (sin perder filas);
  // suelta sus disparadores y vistas, que asegurarFase3 vuelve a crear justo después.
  await rehacerFlex(db);
  // C-CONTROL-DUAL (SIG-4x): los tipos nuevos de la segunda firma (excedente devuelto, límite).
  await rehacerAprobacionesDinero(db);
  // C-CARRO-PAPELES-PAIS: la licencia de conducir del taxista en los papeles del conductor.
  await rehacerConductorDocumentos(db);
  // C-PAGO-A-CELULAR: Yape y Plin en los tipos de cuenta de cobro (Perú).
  await rehacerCuentasCobro(db);
  // C-QUIEN-PAGA-SERVICIO: la regla de quién paga por servicio (clave primaria nueva).
  await rehacerQuienPaga(db);
  // C-SALDO-RESTAURANTE: la política de comisión también puede ser de un restaurante.
  await rehacerPoliticasFinancieras(db);
  // C-PLAZO-PAPELES: la vista y los disparadores que conocen el plazo, y la política de cada país
  // en la forma que la base lee.
  await rehacerElegibilidad(db);
  // C-SEGURO-EN-PLAZO: aprobar el vehículo con la póliza pendiente dentro del plazo.
  await rehacerAprobarVehiculo(db);
  // C-RASTRO: los pasos del registro los anota la base, y el viaje guarda dónde estaba el conductor.
  await asegurarRastro(db);
  // C-SALDO-LOTES: el libro del saldo acepta «vencimiento» (antes de poner sus disparadores).
  await rehacerSaldoClienteMovimientos(db);
  await asegurarFase3(db);
  // C-SALDO-LOTES: los saldos de antes pasan a lotes (una vez; los ya pasados no se tocan).
  await migrarSaldosALotes(db).catch((e: unknown) =>
    console.error('esquema: pasar los saldos de clientes a lotes falló', e),
  );
  await sincronizarPoliticaRequisitos(db);
  await preciosDeFabrica(db);
  await sincronizarServicios(db, entorno);
  await revisarColumnas(db);
  // C-LLEGA-SOLO-A-REVISION: una sola vez, los conductores que ya tenían todo y no tocaron «Enviar».
  await repararLlegaSoloARevision(db).catch((e: unknown) =>
    console.error('esquema: la reparación «llega solo a revisión» falló', e),
  );
  // C-VEHICULO-ACTIVO-SOLO: una sola vez, el único vehículo aprobado queda activo.
  await repararVehiculoActivo(db).catch((e: unknown) =>
    console.error('esquema: la reparación «vehículo activo» falló', e),
  );
  // C-SERVICIOS-DEL-VEHICULO: una sola vez, Envíos encendido a quien su vehículo ya se lo permite.
  // Después de la anterior: usa el vehículo que esa dejó en uso.
  await repararServiciosVehiculo(db).catch((e: unknown) =>
    console.error('esquema: la reparación «servicios del vehículo» falló', e),
  );
  // C-NOMBRE-CON-MARCA: el equipo firma «Soporte Divoox» también en la base.
  await renombrarMarcaVieja(db).catch((e: unknown) =>
    console.error('esquema: renombrar la marca vieja del equipo falló', e),
  );
  // C-TABULADOR-VIGIA: una sola vez, el tabulador de moto de El Vigía y su tarifa (Venezuela).
  await sembrarTabuladorVigia(db).catch((e: unknown) =>
    console.error('esquema: la semilla del tabulador de El Vigía falló', e),
  );
}

/**
 * C-ESQUEMA-SIN-ATASCO (29 oct 2026): la migración corre una vez por servidor y todas las
 * peticiones la esperan. Si una consulta suya se quedaba trabada, ese servidor dejaba colgadas
 * TODAS sus peticiones durante minutos (visto en el sitio de pruebas: la sesión y el resumen del
 * superadmin sin respuesta mientras otro servidor contestaba al instante). Ahora ninguna petición
 * espera más de ESPERA_ESQUEMA_MS; la que pasa la espera sigue (la base ya tiene sus tablas), la
 * salud lo dice en rojo, y una migración que pasa de ESQUEMA_TRABADO_MS se descarta y se reintenta.
 */
export const ESPERA_ESQUEMA_MS = 8_000;
export const ESQUEMA_TRABADO_MS = 30_000;
let inicioMigracion = 0;

export function asegurarEsquema(db: D1Database, entorno: Entorno | null = null): Promise<void> {
  if (listo && inicioMigracion && Date.now() - inicioMigracion > ESQUEMA_TRABADO_MS) {
    ultimoErrorEsquema = `la migración lleva más de ${ESQUEMA_TRABADO_MS / 1000} s sin terminar; se reintenta`;
    console.error('esquema:', ultimoErrorEsquema);
    listo = null;
  }
  if (!listo) {
    inicioMigracion = Date.now();
    const esta: Promise<void> = migrar(db, entorno).then(
      () => {
        if (listo === esta) inicioMigracion = 0;
        ultimoErrorEsquema = null;
      },
      (e: unknown) => {
        ultimoErrorEsquema = String(e);
        console.error('esquema: la migración falló', e);
        if (listo === esta) listo = null; // se reintenta en la siguiente petición
      },
    );
    listo = esta;
  }
  const actual = listo;
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const espera = new Promise<void>((resolver) => {
    reloj = setTimeout(() => {
      if (listo === actual && inicioMigracion) {
        ultimoErrorEsquema = `la migración tardó más de ${ESPERA_ESQUEMA_MS / 1000} s`;
        console.error('esquema:', ultimoErrorEsquema);
      }
      resolver();
    }, ESPERA_ESQUEMA_MS);
  });
  return Promise.race([actual, espera]).finally(() => clearTimeout(reloj));
}

/** Solo para pruebas: cada base nueva vuelve a migrar. */
export function reiniciarEsquema(): void {
  listo = null;
  inicioMigracion = 0;
}

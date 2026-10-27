// GENERADO por scripts/generar-columnas.mjs a partir de schema.sql. No editar a mano.
export const COLUMNAS_DEL_ESQUEMA: Record<string, readonly string[]> = {
  "zonas": [
    "id",
    "nombre",
    "pais",
    "moneda",
    "zona_horaria",
    "lat",
    "lng",
    "radio_km",
    "activa",
    "creado_en"
  ],
  "trabajos_en_proceso": [
    "id",
    "trabajo",
    "estado",
    "activo",
    "creado_en"
  ],
  "usuarios": [
    "id",
    "correo",
    "nombre",
    "telefono",
    "fecha_nacimiento",
    "rol",
    "idioma",
    "zona_id",
    "clave_hash",
    "activo",
    "creado_en"
  ],
  "dispositivos": [
    "token",
    "usuario_id",
    "plataforma",
    "activo",
    "creado_en",
    "visto_en"
  ],
  "sesiones": [
    "id",
    "usuario_id",
    "creada_en",
    "expira_en"
  ],
  "confirmaciones": [
    "id",
    "usuario_id",
    "creada_en",
    "expira_en",
    "usada_en"
  ],
  "recuperaciones": [
    "id",
    "usuario_id",
    "creada_en",
    "expira_en",
    "usada_en"
  ],
  "restaurantes": [
    "id",
    "dueno_id",
    "nombre",
    "descripcion_es",
    "descripcion_en",
    "categoria",
    "telefono",
    "direccion",
    "lat",
    "lng",
    "imagen",
    "plan",
    "estado",
    "abierto",
    "tiempo_prep_min",
    "regalos_pb",
    "zona_id",
    "geohash",
    "categorias_orden",
    "creado_en"
  ],
  "platos": [
    "id",
    "restaurante_id",
    "nombre_es",
    "nombre_en",
    "descripcion_es",
    "descripcion_en",
    "categoria",
    "categoria_en",
    "precio_centavos",
    "imagen",
    "disponible",
    "eliminado",
    "orden",
    "creado_en"
  ],
  "config": [
    "clave",
    "valor",
    "actualizado_en"
  ],
  "pedidos": [
    "id",
    "cliente_id",
    "restaurante_id",
    "repartidor_id",
    "estado",
    "lineas_json",
    "subtotal",
    "envio",
    "servicio",
    "cargo_pequeno",
    "propina",
    "regalo",
    "regalo_tipo",
    "zona_id",
    "total",
    "impuesto",
    "cupon",
    "descuento",
    "metodo_pago",
    "cobro_estado",
    "monto_recibido",
    "cobro_confirmado_en",
    "cobro_nota",
    "cobro_confirmado_por",
    "conciliacion_estado",
    "moneda",
    "tarifas_json",
    "comision",
    "pago_restaurante",
    "pago_repartidor",
    "complemento",
    "ganancia",
    "plan",
    "direccion",
    "notas",
    "lat",
    "lng",
    "distancia_km",
    "tiempo_prep_min",
    "stripe_sesion",
    "stripe_pago",
    "creado_en",
    "pagado_en",
    "aceptado_en",
    "listo_en",
    "recogido_en",
    "entregado_en",
    "cancelado_en"
  ],
  "movimientos": [
    "id",
    "usuario_id",
    "pedido_id",
    "monto",
    "concepto",
    "referencia",
    "creado_en"
  ],
  "cuentas_stripe": [
    "usuario_id",
    "stripe_cuenta",
    "pagos_activos",
    "creado_en"
  ],
  "avisos_stripe": [
    "id",
    "tipo",
    "recibido_en",
    "estado"
  ],
  "repartidores": [
    "usuario_id",
    "tipo",
    "conectado",
    "lat",
    "lng",
    "ubicacion_en",
    "puntos",
    "zona_id",
    "geohash",
    "pausado",
    "creado_en"
  ],
  "abandonos_repartidor": [
    "pedido_id",
    "repartidor_id",
    "motivo",
    "creado_en"
  ],
  "ofertas": [
    "pedido_id",
    "repartidor_id",
    "estado",
    "creada_en"
  ],
  "calificaciones": [
    "pedido_id",
    "estrellas_restaurante",
    "estrellas_repartidor",
    "culpa_restaurante",
    "comentario",
    "respuesta",
    "respondida_en",
    "creado_en"
  ],
  "regalos_config": [
    "restaurante_id",
    "cumpleanos",
    "cumple_plato_id",
    "sellos",
    "sellos_meta",
    "sellos_plato_id",
    "vuelve",
    "vuelve_dias",
    "vuelve_pb"
  ],
  "historial_estados": [
    "id",
    "pedido_id",
    "estado",
    "actor_id",
    "creado_en"
  ],
  "bitacora_pedidos": [
    "id",
    "pedido_id",
    "evento",
    "detalle",
    "creado_en"
  ],
  "lista_espera": [
    "id",
    "tipo",
    "zona_id",
    "nombre",
    "correo",
    "telefono",
    "ciudad",
    "codigo_postal",
    "negocio",
    "vehiculo",
    "idioma",
    "creado_en"
  ],
  "tickets": [
    "id",
    "codigo",
    "tipo",
    "estado",
    "nombre",
    "correo",
    "telefono",
    "pais",
    "ciudad",
    "idioma",
    "asunto",
    "datos_json",
    "usuario_id",
    "pedido_id",
    "zona_id",
    "creado_en",
    "actualizado_en"
  ],
  "ticket_mensajes": [
    "id",
    "ticket_id",
    "autor",
    "texto",
    "creado_en"
  ],
  "franquicias": [
    "id",
    "zona_id",
    "codigo",
    "estado",
    "dueno_id",
    "dueno_correo",
    "motos",
    "notas",
    "creado_en",
    "vendida_en",
    "nombre",
    "ticket_id",
    "condiciones_json"
  ],
  "areas": [
    "id",
    "zona_id",
    "nombre",
    "estado",
    "poligono",
    "min_lat",
    "max_lat",
    "min_lng",
    "max_lng",
    "prioridad",
    "apertura_prevista",
    "creado_en",
    "actualizado_en",
    "actualizado_por"
  ],
  "franquicia_areas": [
    "area_id",
    "franquicia_id",
    "asignada_en",
    "asignada_por"
  ],
  "franquicia_miembros": [
    "franquicia_id",
    "correo",
    "rol",
    "creado_en",
    "creado_por"
  ],
  "repartidor_datos": [
    "usuario_id",
    "vehiculo_tipo",
    "marca",
    "modelo",
    "anio",
    "color",
    "placa",
    "licencia_numero",
    "licencia_estado",
    "licencia_vence",
    "seguro_aseguradora",
    "seguro_poliza",
    "seguro_vence",
    "seguro_tumbite",
    "antecedentes",
    "antecedentes_fecha",
    "actualizado_en"
  ],
  "restaurante_empresa": [
    "restaurante_id",
    "nombre_legal",
    "tipo_empresa",
    "direccion_fiscal",
    "dueno_nombre",
    "dueno_telefono",
    "dueno_correo",
    "manager_nombre",
    "manager_telefono",
    "manager_correo",
    "horario",
    "sitio_web",
    "actualizado_en"
  ],
  "contadores": [
    "clave",
    "n"
  ],
  "kyc": [
    "usuario_id",
    "estado",
    "motivo",
    "doc_tipo",
    "doc_frente",
    "doc_reverso",
    "selfie",
    "local",
    "local_lat",
    "local_lng",
    "local_distancia_m",
    "enviado_en",
    "revisado_en",
    "revisado_por",
    "proxima_revision"
  ],
  "evidencias": [
    "pedido_id",
    "tipo",
    "clave",
    "lat",
    "lng",
    "distancia_m",
    "modo",
    "nota",
    "creada_en",
    "confirmada_en"
  ],
  "hitos_pedido": [
    "pedido_id",
    "hito",
    "valor",
    "creado_en"
  ],
  "preferencias_entrega": [
    "pedido_id",
    "modo"
  ],
  "mensajes_pedido": [
    "id",
    "pedido_id",
    "de_usuario_id",
    "texto",
    "creado_en"
  ],
  "ajustes_pedido": [
    "pedido_id",
    "plato_id",
    "nombre_es",
    "nombre_en",
    "estado",
    "devolucion",
    "creado_en",
    "resuelto_en"
  ],
  "cobros": [
    "pedido_id",
    "autorizado_en",
    "capturado_en",
    "capturado",
    "cancelado_en"
  ],
  "liquidaciones": [
    "pedido_id",
    "estado",
    "pi",
    "monto",
    "intentos",
    "proximo_en",
    "error",
    "capturado_en",
    "alertado_en",
    "creado_en",
    "actualizado_en"
  ],
  "pines_entrega": [
    "pedido_id",
    "pin",
    "usado_en",
    "intentos"
  ],
  "devoluciones": [
    "id",
    "pedido_id",
    "monto",
    "motivo",
    "cargar_a",
    "actor_id",
    "stripe_reembolso",
    "creado_en"
  ],
  "disputas": [
    "id",
    "pedido_id",
    "stripe_pago",
    "monto",
    "motivo",
    "estado",
    "vence_en",
    "creado_en",
    "actualizado_en",
    "recarga_id"
  ],
  "alertas_canario": [
    "pieza",
    "estado",
    "cambiado_en",
    "avisado_en"
  ],
  "intentos_limite": [
    "llave",
    "cuenta",
    "desde"
  ],
  "horarios_restaurante": [
    "restaurante_id",
    "dia",
    "abre",
    "cierra"
  ],
  "grupos_opciones": [
    "id",
    "plato_id",
    "nombre_es",
    "nombre_en",
    "minimo",
    "maximo",
    "orden"
  ],
  "opciones": [
    "id",
    "grupo_id",
    "nombre_es",
    "nombre_en",
    "precio_centavos",
    "disponible",
    "orden"
  ],
  "ubicaciones_recientes": [
    "id",
    "usuario_id",
    "lat",
    "lng",
    "precision_m",
    "creado_en"
  ],
  "excepciones_ubicacion": [
    "pedido_id",
    "motivo",
    "creado_en",
    "autorizado_en",
    "autorizado_por"
  ],
  "bonos_pedido": [
    "pedido_id",
    "centavos",
    "motivo",
    "creado_en"
  ],
  "cocina_ocupada": [
    "restaurante_id",
    "extra_min",
    "desde"
  ],
  "sms_enviados": [
    "id",
    "usuario_id",
    "pedido_id",
    "tipo",
    "estado",
    "creado_en"
  ],
  "llamadas": [
    "id",
    "pedido_id",
    "de_usuario",
    "estado",
    "creado_en"
  ],
  "avisos_pedido": [
    "pedido_id",
    "aviso",
    "creado_en"
  ],
  "conciliaciones": [
    "dia",
    "pedidos",
    "vendido",
    "capturado",
    "devuelto",
    "abonado",
    "retirado",
    "cuadra",
    "detalle",
    "creado_en"
  ],
  "abonos_fallidos": [
    "id",
    "usuario_id",
    "stripe_cuenta",
    "motivo",
    "creado_en",
    "resuelto_en"
  ],
  "antecedentes_checkr": [
    "usuario_id",
    "candidato_id",
    "invitacion_id",
    "invitacion_url",
    "reporte_id",
    "resultado",
    "estado",
    "creado_en",
    "actualizado_en"
  ],
  "revisores": [
    "correo",
    "rol",
    "creado_en"
  ],
  "selfies_control": [
    "id",
    "usuario_id",
    "clave",
    "pedida_en",
    "tomada_en",
    "revisada_en",
    "resultado"
  ],
  "recogidas": [
    "pedido_id",
    "creado_en"
  ],
  "propinas_extra": [
    "pedido_id",
    "centavos",
    "stripe_pago",
    "creado_en"
  ],
  "grupos_pedido": [
    "pedido_id",
    "grupo_id",
    "creado_en"
  ],
  "retiros": [
    "id",
    "usuario_id",
    "stripe_cuenta",
    "monto_centavos",
    "estado",
    "intentos",
    "proximo_intento_en",
    "enviando_desde",
    "stripe_transferencia",
    "ultimo_error",
    "creado_en",
    "actualizado_en"
  ],
  "servicios": [
    "id",
    "tipo_operacion",
    "nombre_es",
    "nombre_en",
    "descripcion_es",
    "descripcion_en",
    "icono",
    "orden",
    "estado",
    "transporta_personas",
    "version_min_cliente",
    "version_min_driver",
    "creado_en",
    "actualizado_en",
    "actualizado_por"
  ],
  "servicios_implementados": [
    "servicio_id",
    "contrato",
    "desplegado_en"
  ],
  "servicios_zona": [
    "servicio_id",
    "zona_id",
    "estado",
    "activo_desde",
    "activo_hasta",
    "motivo",
    "actualizado_en",
    "actualizado_por"
  ],
  "requisitos_def": [
    "requisito",
    "nivel",
    "verifica",
    "doc_tipo",
    "vigencia_max_dias"
  ],
  "servicio_requisitos": [
    "servicio_id",
    "requisito",
    "obligatorio"
  ],
  "servicio_vehiculos": [
    "servicio_id",
    "vehiculo_tipo",
    "anio_minimo"
  ],
  "vehiculos": [
    "id",
    "conductor_id",
    "tipo",
    "marca",
    "modelo",
    "anio",
    "color",
    "placa",
    "placa_estado",
    "plazas",
    "estado",
    "motivo",
    "aprobado_en",
    "aprobado_por",
    "origen",
    "creado_en",
    "actualizado_en"
  ],
  "vehiculo_documentos": [
    "id",
    "vehiculo_id",
    "tipo",
    "clave",
    "vence_en",
    "estado",
    "motivo",
    "revisado_por",
    "revisado_en",
    "creado_en"
  ],
  "vehiculo_revisiones": [
    "id",
    "vehiculo_id",
    "estado_anterior",
    "estado_nuevo",
    "actor_id",
    "motivo",
    "creado_en"
  ],
  "cumplimientos": [
    "conductor_id",
    "vehiculo_id",
    "requisito",
    "estado",
    "fuente",
    "fuente_id",
    "vence_en",
    "aprobado_por",
    "actualizado_en"
  ],
  "habilitaciones": [
    "conductor_id",
    "servicio_id",
    "estado",
    "motivo",
    "aprobado_por",
    "aprobado_en",
    "vence_en",
    "origen",
    "actualizado_en"
  ],
  "habilitaciones_historial": [
    "id",
    "conductor_id",
    "servicio_id",
    "estado_anterior",
    "estado_nuevo",
    "actor_id",
    "motivo",
    "creado_en"
  ],
  "preferencias_servicio": [
    "conductor_id",
    "servicio_id",
    "activa",
    "actualizado_en"
  ],
  "conductor_bloqueos": [
    "id",
    "conductor_id",
    "servicio_id",
    "motivo",
    "desde",
    "hasta",
    "creado_por",
    "levantado_en",
    "levantado_por"
  ],
  "auditoria_admin": [
    "id",
    "actor_id",
    "accion",
    "objeto",
    "antes_json",
    "despues_json",
    "creado_en"
  ],
  "tareas_programadas": [
    "clave",
    "tarea",
    "empezada_en",
    "terminada_en",
    "resultado"
  ],
  "reloj_tareas": [
    "clave",
    "tarea",
    "critica",
    "ok",
    "ms",
    "error",
    "creado_en"
  ],
  "peticiones_internas": [
    "nonce",
    "llave_id",
    "ruta",
    "recibida_en"
  ],
  "lotes_ubicacion": [
    "lote_id",
    "zona_id",
    "muestras",
    "recibido_en"
  ],
  "empresas": [
    "id",
    "nombre",
    "razon_social",
    "pais",
    "moneda",
    "estado",
    "dueno_id",
    "creado_en",
    "actualizado_en"
  ],
  "empresa_miembros": [
    "empresa_id",
    "usuario_id",
    "rol",
    "estado",
    "desde",
    "actualizado_en"
  ],
  "empresa_invitaciones": [
    "id",
    "empresa_id",
    "correo",
    "rol",
    "token_hash",
    "expira_en",
    "estado",
    "emisor_id",
    "aceptada_por",
    "aceptada_en",
    "revocada_en",
    "creado_en"
  ],
  "empresa_centros": [
    "id",
    "empresa_id",
    "nombre",
    "direccion",
    "pais",
    "ciudad",
    "lat",
    "lng",
    "zona_horaria",
    "estado",
    "creado_en",
    "actualizado_en"
  ],
  "empresa_conductores": [
    "empresa_id",
    "usuario_id",
    "vinculo",
    "estado",
    "desde",
    "actualizado_en"
  ],
  "empresa_claves": [
    "id",
    "empresa_id",
    "nombre",
    "prefijo",
    "clave_hash",
    "permisos",
    "estado",
    "creado_por",
    "creado_en",
    "revocada_en",
    "ultimo_uso_en",
    "usos"
  ],
  "empresa_auditoria": [
    "id",
    "empresa_id",
    "actor_id",
    "actor_tipo",
    "accion",
    "objeto",
    "detalle_json",
    "creado_en"
  ],
  "envios": [
    "id",
    "empresa_id",
    "centro_id",
    "referencia_externa",
    "remitente_nombre",
    "destinatario_nombre",
    "destinatario_telefono",
    "direccion",
    "lat",
    "lng",
    "instrucciones",
    "ventana_desde",
    "ventana_hasta",
    "estado",
    "creado_en",
    "actualizado_en"
  ],
  "paquetes": [
    "id",
    "envio_id",
    "empresa_id",
    "codigo_seguimiento",
    "codigo_etiqueta",
    "peso_g",
    "largo_cm",
    "ancho_cm",
    "alto_cm",
    "descripcion",
    "estado",
    "creado_en",
    "actualizado_en"
  ],
  "transiciones_paquete": [
    "desde",
    "hacia"
  ],
  "paquete_eventos": [
    "id",
    "paquete_id",
    "empresa_id",
    "tipo",
    "actor_id",
    "actor_tipo",
    "lat",
    "lng",
    "operacion_ref",
    "idempotencia",
    "metadatos_json",
    "creado_en"
  ],
  "idempotencia_flex": [
    "empresa_id",
    "clave",
    "ruta",
    "cuerpo_hash",
    "estado",
    "respuesta_json",
    "creado_en"
  ],
  "importaciones": [
    "id",
    "empresa_id",
    "centro_id",
    "nombre_archivo",
    "huella",
    "estado",
    "total",
    "validas",
    "procesadas",
    "creado_por",
    "creado_en",
    "actualizado_en"
  ],
  "importacion_filas": [
    "importacion_id",
    "numero",
    "datos_json",
    "error",
    "envio_id"
  ],
  "lotes": [
    "id",
    "empresa_id",
    "centro_id",
    "nombre",
    "estado",
    "creado_en",
    "actualizado_en"
  ],
  "lote_paquetes": [
    "paquete_id",
    "lote_id",
    "agregado_en"
  ],
  "rutas_flex": [
    "id",
    "empresa_id",
    "centro_id",
    "lote_id",
    "nombre",
    "conductor_id",
    "vehiculo_id",
    "estado",
    "bloque_desde",
    "bloque_hasta",
    "creado_en",
    "actualizado_en"
  ],
  "ruta_paradas": [
    "id",
    "ruta_id",
    "orden",
    "envio_id",
    "estado",
    "ventana_desde",
    "ventana_hasta",
    "creado_en"
  ],
  "ruta_asignaciones": [
    "id",
    "ruta_id",
    "conductor_id",
    "clave",
    "inicio",
    "fin",
    "resultado"
  ],
  "operaciones": [
    "id",
    "servicio_id",
    "tipo_operacion",
    "cliente_id",
    "conductor_id",
    "vehiculo_id",
    "zona_id",
    "estado_general",
    "ultima_clave",
    "version",
    "creado_en",
    "actualizado_en"
  ],
  "viajes": [
    "operacion_id",
    "estado",
    "ultimo_actor",
    "ultimo_actor_id",
    "ultima_clave",
    "motivo_transicion",
    "origen_lat",
    "destino_lat",
    "pasajeros",
    "pin_recogida",
    "liberaciones",
    "distancia_m_real",
    "asignado_en"
  ],
  "transiciones_pedido": [
    "desde"
  ],
  "transiciones_viaje": [
    "desde"
  ],
  "ofertas_operacion": [
    "operacion_id",
    "conductor_id",
    "vehiculo_id",
    "estado",
    "ganancia_centavos",
    "creada_en",
    "expira_en",
    "respondida_en"
  ],
  "eventos_operacion": [
    "id",
    "operacion_id",
    "tipo",
    "estado_anterior",
    "estado_nuevo",
    "actor_id",
    "actor_rol",
    "datos_json",
    "idempotencia",
    "creado_en"
  ],
  "asignaciones_operacion": [
    "id",
    "operacion_id",
    "conductor_id",
    "vehiculo_id",
    "clave",
    "inicio",
    "fin",
    "resultado",
    "motivo"
  ],
  "conductor_ocupacion": [
    "conductor_id",
    "tipo",
    "operacion_id",
    "pedidos",
    "desde"
  ],
  "libro": [
    "id",
    "cuenta_id",
    "bolsillo",
    "pais",
    "moneda",
    "monto",
    "concepto",
    "pedido_id",
    "referencia",
    "autor_id",
    "creado_en"
  ],
  "puntos_venta": [
    "id",
    "nombre",
    "pais",
    "moneda",
    "usuario_id",
    "activo",
    "creado_en"
  ],
  "codigos_recarga": [
    "id",
    "codigo_hash",
    "punto_id",
    "pais",
    "moneda",
    "monto",
    "estado",
    "emitido_por",
    "canjeado_por",
    "canjeado_en",
    "anulado_en",
    "creado_en"
  ],
  "intentos_canje": [
    "usuario_id",
    "fallidos",
    "ultimo_en"
  ],
  "recargas": [
    "id",
    "usuario_id",
    "pais",
    "moneda",
    "monto",
    "canal",
    "estado",
    "referencia",
    "creado_en",
    "acreditada_en"
  ],
  "cuentas_cobro": [
    "id",
    "usuario_id",
    "pais",
    "moneda",
    "tipo",
    "banco",
    "titular",
    "identificador",
    "verificacion",
    "activa",
    "activa_desde",
    "creado_en"
  ],
  "cuentas_cobro_historial": [
    "id",
    "cuenta_id",
    "usuario_id",
    "cambio",
    "autor_id",
    "creado_en"
  ],
  "favoritos": [
    "usuario_id",
    "restaurante_id",
    "creado_en"
  ],
  "direcciones_cliente": [
    "id",
    "usuario_id",
    "etiqueta",
    "direccion",
    "lat",
    "lng",
    "instrucciones",
    "entrega",
    "creado_en",
    "usada_en"
  ],
  "cupones": [
    "codigo",
    "tipo",
    "valor",
    "descripcion_es",
    "descripcion_en",
    "minimo_subtotal",
    "usos_max",
    "usos_por_cliente",
    "solo_primer_pedido",
    "restaurante_id",
    "zona_id",
    "destacado",
    "vence_en",
    "activo",
    "creado_en"
  ],
  "usos_cupon": [
    "pedido_id",
    "codigo",
    "usuario_id",
    "descuento",
    "creado_en"
  ],
  "miembros_restaurante": [
    "restaurante_id",
    "usuario_id",
    "rol",
    "creado_en"
  ],
  "cierres_restaurante": [
    "id",
    "restaurante_id",
    "fecha",
    "motivo",
    "creado_en"
  ],
  "pagos_local": [
    "pedido_id",
    "repartidor_id",
    "monto_esperado",
    "monto_pagado",
    "importe_ticket",
    "metodo",
    "diferencia_pago",
    "diferencia_ticket",
    "creado_en",
    "confirmado_restaurante_en",
    "confirmado_por",
    "ticket_clave"
  ],
  "incidencias_dinero": [
    "id",
    "tipo",
    "referencia",
    "pedido_id",
    "recarga_id",
    "cuenta_id",
    "pais",
    "moneda",
    "monto_esperado",
    "monto_recibido",
    "detalle",
    "estado",
    "creado_en",
    "resuelta_en"
  ],
  "casos_dinero": [
    "clave",
    "estado",
    "responsable_id",
    "actualizado_en"
  ],
  "casos_dinero_historial": [
    "id",
    "clave",
    "accion",
    "nota",
    "autor_id",
    "idempotencia",
    "creado_en"
  ],
  "errores_servidor": [
    "id",
    "metodo",
    "ruta",
    "mensaje",
    "pila",
    "creado_en"
  ]
};

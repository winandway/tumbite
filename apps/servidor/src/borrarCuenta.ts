import type { Env } from './env';
import { borrarPuertasDeUsuario } from './rutas/fotoPuerta';
import { ErrorDatos } from './validar';
import { capturasDeCamila, sentenciasBorrarDeCamila } from './camila/memoria';

/**
 * C-BORRAR-DESDE-SUPERADMIN (4 nov 2026): el borrado de una cuenta, en UNA sola pieza. Lo usan la app
 * (DELETE /datos/cuentas/yo, la persona borra la suya) y el superadmin (soporte borra una cuenta
 * creada con un correo equivocado). Lo que prometen la política de privacidad y /delete-account:
 * datos personales fuera, importes guardados sin nombre (C-BORRADO-COMPLETO). Con un pedido en
 * curso no se borra (409).
 */
export async function borrarCuenta(
  env: Pick<Env, 'BUCKET'>,
  db: D1Database,
  u: { id: string; correo: string },
): Promise<void> {
  const activo = await db
    .prepare(
      "SELECT 1 FROM pedidos WHERE (cliente_id = ? OR repartidor_id = ?) AND estado IN ('pagado','aceptado','listo','en_camino')",
    )
    .bind(u.id, u.id)
    .first();
  if (activo)
    throw new ErrorDatos(
      'Tienes un pedido en curso. Espera a que termine para borrar tu cuenta.',
      undefined,
      409,
    );
  // C-BORRADO-SERVICIOS (16 nov 2026): tampoco con un viaje o un envío en curso, como pasajero o
  // como conductor. Antes el 409 solo miraba los pedidos de comida.
  const viajeActivo = await db
    .prepare(
      "SELECT 1 FROM operaciones WHERE (cliente_id = ?1 OR conductor_id = ?1) AND estado_general IN ('buscando','asignada','en_curso')",
    )
    .bind(u.id)
    .first();
  if (viajeActivo)
    throw new ErrorDatos(
      'Tienes un viaje o un envío en curso. Espera a que termine para borrar tu cuenta.',
      undefined,
      409,
    );
  // C-CUENTA-UNICA-RESTAURANTE: el dueño de un restaurante activo no borra su cuenta personal sin
  // antes cerrarlo o traspasarlo (el restaurante es un negocio aparte, con su dinero y su equipo).
  const negocio = await db
    .prepare(
      'SELECT 1 FROM duenos_negocio d JOIN usuarios n ON n.id = d.negocio_id WHERE d.persona_id = ? AND n.activo = 1',
    )
    .bind(u.id)
    .first();
  if (negocio)
    throw new ErrorDatos(
      'Eres dueño de un restaurante en Divoox. Escríbenos a soporte para cerrarlo o traspasarlo antes de borrar tu cuenta.',
      undefined,
      409,
    );
  // C-BORRADO-SERVICIOS: las claves de las fotos de recogida y de entrega de sus pedidos (como
  // cliente o como repartidor) y de sus envíos, y de su selfie con casco, para borrar los archivos.
  const misPedidos = 'SELECT id FROM pedidos WHERE cliente_id = ?1 OR repartidor_id = ?1';
  const misOperaciones = 'SELECT id FROM operaciones WHERE cliente_id = ?1 OR conductor_id = ?1';
  const fotosServicios = (
    await db
      .prepare(
        `SELECT clave FROM evidencias WHERE clave != '' AND pedido_id IN (${misPedidos})
         UNION SELECT foto_recogida FROM envios_persona WHERE foto_recogida IS NOT NULL AND operacion_id IN (${misOperaciones})
         UNION SELECT foto_entrega FROM envios_persona WHERE foto_entrega IS NOT NULL AND operacion_id IN (${misOperaciones})
         UNION SELECT clave FROM selfies_casco WHERE usuario_id = ?1
         UNION SELECT clave FROM selfies_control WHERE usuario_id = ?1 AND clave != ''`,
      )
      .bind(u.id)
      .all<{ clave: string }>()
  ).results.map((f) => f.clave);
  // C-UNIONES-D1: la base real no admite más de cinco consultas unidas; el comprobante del pago de
  // la comida (C-COMIDA-PAGO-RESTAURANTE) va en su propia consulta.
  fotosServicios.push(
    ...(
      await db
        .prepare(
          'SELECT comprobante_clave AS clave FROM pagos_comida WHERE cliente_id = ? AND comprobante_clave IS NOT NULL',
        )
        .bind(u.id)
        .all<{ clave: string }>()
    ).results.map((f) => f.clave),
  );
  const comoPasajero = 'SELECT id FROM operaciones WHERE cliente_id = ?1';
  // C-BORRADO-SERVICIOS, tercera vuelta: el correo y el teléfono canónicos, para encontrar las
  // invitaciones de empresas y restaurantes que lo nombran aunque no las haya aceptado.
  const canon = await db
    .prepare('SELECT correo_canonico, telefono_canonico, telefono FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{
      correo_canonico: string | null;
      telefono_canonico: string | null;
      telefono: string | null;
    }>();
  // C-BORRADO-SERVICIOS, cuarta vuelta: sus casos de soporte (por usuario o por su correo) se listan
  // ANTES del lote, porque el lote les cambia el correo y les vacía datos_json, donde la queja guarda
  // su foto (datos_json.foto, archivo quejas/<ticket>/…). Con esta lista se borran adjuntos y archivos.
  const misTickets = (
    await db
      .prepare('SELECT id, datos_json FROM tickets WHERE usuario_id = ?1 OR correo = ?2')
      .bind(u.id, u.correo)
      .all<{ id: string; datos_json: string }>()
  ).results;
  const idsTickets = JSON.stringify(misTickets.map((t) => t.id));
  const fotosQueja = [
    ...(
      await db
        .prepare(
          'SELECT clave FROM ticket_adjuntos WHERE ticket_id IN (SELECT value FROM json_each(?))',
        )
        .bind(idsTickets)
        .all<{ clave: string }>()
    ).results.map((f) => f.clave),
    ...misTickets
      .map((t) => {
        try {
          return (JSON.parse(t.datos_json || '{}') as { foto?: unknown }).foto;
        } catch {
          return undefined; // datos_json dañado: igual se borra la carpeta quejas/<ticket>/ abajo
        }
      })
      .filter((f): f is string => typeof f === 'string' && f !== ''),
  ];
  // C-BORRADO-CHAT (16 nov 2026): las claves de las fotos que mandó en los chats, para borrar los
  // archivos después de vaciar las filas.
  const fotosChat = (
    await db
      .prepare(
        'SELECT foto_clave FROM mensajes_pedido WHERE de_usuario_id = ? AND foto_clave IS NOT NULL',
      )
      .bind(u.id)
      .all<{ foto_clave: string }>()
  ).results.map((f) => f.foto_clave);
  // C-CAMILA-FALLOS: las capturas de sus reportes de fallo se listan antes del lote (que borra las filas).
  const capturasCamila = await capturasDeCamila(
    db,
    u.id,
    u.correo,
    canon?.telefono_canonico ?? null,
  );
  // Primero los archivos y después las filas: si el almacén falla, el borrado se corta aquí y las
  // claves siguen en la base para reintentar (nunca queda una captura sin fila que la apunte).
  if (env.BUCKET && capturasCamila.length) await env.BUCKET.delete(capturasCamila);
  await db.batch([
    // C-CAMILA-BORRADO: sus conversaciones con soporte (Camila) se borran enteras.
    ...sentenciasBorrarDeCamila(db, u.id, u.correo, canon?.telefono_canonico ?? null),
    db
      .prepare(
        "UPDATE usuarios SET correo = ?, nombre = 'Cuenta borrada', telefono = NULL, fecha_nacimiento = NULL, clave_hash = 'borrada', activo = 0, correo_canonico = NULL, telefono_canonico = NULL WHERE id = ?",
      )
      .bind(`borrada-${u.id}@tumbite.invalid`, u.id),
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
    // C-ID-DEL-PAIS: los ID viejos del conductor se van con su cuenta.
    db.prepare('DELETE FROM codigos_repartidor_anteriores WHERE usuario_id = ?').bind(u.id),
    // C-KYC-AUTO: la huella de la cara se borra con la cuenta (la de mala conducta se queda).
    db.prepare('DELETE FROM huellas_caras WHERE usuario_id = ? AND mala_conducta = 0').bind(u.id),
    db
      .prepare('UPDATE repartidores SET conectado = 0, lat = NULL, lng = NULL WHERE usuario_id = ?')
      .bind(u.id),
    // Lo que prometen la política de privacidad y la página /delete-account: se quitan direcciones,
    // indicaciones y ubicación de sus pedidos y el texto de sus calificaciones. Los importes se
    // guardan (impuestos y contabilidad). Candado C-BORRADO-COMPLETO.
    db
      .prepare(
        "UPDATE pedidos SET direccion = 'Dirección borrada', notas = '', lat = NULL, lng = NULL, direccion_id = NULL WHERE cliente_id = ?",
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE calificaciones SET comentario = '' WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ?)",
      )
      .bind(u.id),
    // C-BORRADO-DIRECCIONES (15 nov 2026): las direcciones guardadas y las fotos de la puerta se
    // van con la cuenta. Antes se quedaban: la casa de la persona seguía en la base.
    db
      .prepare(
        'DELETE FROM direcciones_fotos WHERE direccion_id IN (SELECT id FROM direcciones_cliente WHERE usuario_id = ?)',
      )
      .bind(u.id),
    db.prepare('DELETE FROM direcciones_cliente WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM dispositivos WHERE usuario_id = ?').bind(u.id),
    // C-CUENTA-UNICA: sus papeles y el vínculo con restaurantes ya cerrados se van con la persona.
    db.prepare('DELETE FROM usuario_papeles WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM duenos_negocio WHERE persona_id = ?').bind(u.id),
    // C-CAMPANA-SE-VACIA: hasta cuándo vio cada campana.
    db.prepare('DELETE FROM campana_vista WHERE usuario_id = ?').bind(u.id),
    // C-VERIFICACIONES-EN-VIVO: el aviso al equipo de su verificación.
    db.prepare('DELETE FROM avisos_verificacion WHERE usuario_id = ?').bind(u.id),
    // C-AVISOS-GUARDADOS: lo que llegó a su campana se va con la cuenta.
    db.prepare('DELETE FROM avisos_enviados WHERE usuario_id = ?').bind(u.id),
    // C-RASTRO: de dónde entró (app, plataforma, red aproximada) y sus pasos del registro se van con la cuenta.
    db.prepare('DELETE FROM rastro_cuenta WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM embudo_cuenta WHERE usuario_id = ?').bind(u.id),
    // C-INTENTOS-ACCESO: los intentos fallidos de entrar o crear cuenta con su correo.
    db.prepare('DELETE FROM intentos_acceso WHERE correo = ?').bind(u.correo.toLowerCase()),
    // C-FOTO-CARA-A-LA-VISTA: sus hitos (vio la tarjeta, abrió la cámara, la subida falló…).
    db.prepare('DELETE FROM hitos_cuenta WHERE usuario_id = ?').bind(u.id),
    // C-REZAGADOS: los recordatorios de registro que recibió y su baja.
    db.prepare('DELETE FROM rezagados_mensajes WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM rezagados_bajas WHERE usuario_id = ?').bind(u.id),
    // C-OCHO-ICONOS-SIEMPRE: sus «Avísame cuando llegue» (llevan su zona y su punto aproximado).
    db.prepare('DELETE FROM avisos_servicio WHERE usuario_id = ?').bind(u.id),
    // C-CUPON-DIVOOX: los códigos de regalo que agregó. Los usos quedan (son contabilidad) y solo
    // guardan huellas del teléfono y del aparato, nunca el número.
    db.prepare('DELETE FROM cupones_divoox_guardados WHERE cliente_id = ?').bind(u.id),
    // C-VIAJES-FIJOS (16 nov 2026): sus conductores de confianza (y si es conductor, sus clientes
    // fijos) y sus viajes fijos: direcciones de casa, escuela y trabajo, el nombre y el PIN del menor.
    db
      .prepare('DELETE FROM conductores_confianza WHERE cliente_id = ?1 OR conductor_id = ?1')
      .bind(u.id),
    db
      .prepare(
        `UPDATE rutinas_viaje SET estado = 'borrada', nombre = '', origen_direccion = '', destino_direccion = '',
           origen_lat = 0, origen_lng = 0, destino_lat = 0, destino_lng = 0, menor_nombre = NULL,
           pin_menor = NULL, paquete_json = NULL, proxima_revision_en = NULL WHERE cliente_id = ?`,
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE rutinas_viaje SET conductor_id = NULL WHERE conductor_id = ? AND estado != 'borrada'",
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE viajes_programados SET estado = 'cancelado', motivo = 'cuenta_borrada', resuelto_en = datetime('now') WHERE cliente_id = ? AND estado = 'programado'",
      )
      .bind(u.id),
    db
      .prepare(
        'UPDATE viajes SET menor_nombre = NULL WHERE menor_nombre IS NOT NULL AND operacion_id IN (SELECT id FROM operaciones WHERE cliente_id = ?)',
      )
      .bind(u.id),
    db.prepare('DELETE FROM suscripciones_web WHERE usuario_id = ?').bind(u.id),
    // C-MODERACION: sus bloqueos (los que hizo y los que le hicieron) y la nota de sus reportes.
    db.prepare('DELETE FROM bloqueos_usuario WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM bloqueos_usuario WHERE bloqueado_id = ?').bind(u.id),
    db.prepare("UPDATE reportes_contenido SET nota = '' WHERE reporta_id = ?").bind(u.id),
    // C-BORRADO-CHAT (16 nov 2026): el texto y las fotos de sus mensajes del chat (pedidos y viajes)
    // y la copia de lo que escribió guardada en los reportes de otros. La fila queda vacía para que
    // el chat de la otra persona no se desordene. Antes se quedaban: Google Play lo dio NO APTO.
    db
      .prepare("UPDATE mensajes_pedido SET texto = '', foto_clave = NULL WHERE de_usuario_id = ?")
      .bind(u.id),
    db.prepare("UPDATE mensajes_viaje SET texto = '' WHERE de_usuario_id = ?").bind(u.id),
    db.prepare("UPDATE reportes_contenido SET texto = '' WHERE autor_id = ?").bind(u.id),
    // C-BORRADO-SERVICIOS (16 nov 2026): lo que dejan los viajes, los envíos y las fotos de entrega.
    // Origen, destino y paradas de sus viajes como pasajero, el enlace en vivo que compartió y sus
    // contactos de confianza. Los importes se guardan (contabilidad), sin lugares.
    db
      .prepare(
        `UPDATE viajes SET origen_direccion = 'Dirección borrada', destino_direccion = 'Dirección borrada',
           origen_lat = 0, origen_lng = 0, destino_lat = 0, destino_lng = 0 WHERE operacion_id IN (${comoPasajero})`,
      )
      .bind(u.id),
    db
      .prepare(
        `UPDATE paradas_viaje SET direccion = 'Dirección borrada', lat = 0, lng = 0 WHERE operacion_id IN (${comoPasajero})`,
      )
      .bind(u.id),
    db
      .prepare(
        `UPDATE cambios_viaje SET paradas_json = '[]' WHERE operacion_id IN (${comoPasajero})`,
      )
      .bind(u.id),
    db.prepare('DELETE FROM viajes_compartidos WHERE creado_por = ?').bind(u.id),
    db.prepare('DELETE FROM contactos_confianza WHERE cliente_id = ?').bind(u.id),
    db.prepare('DELETE FROM ubicaciones_recientes WHERE usuario_id = ?').bind(u.id),
    // Envíos de persona a persona que mandó: qué era y quién lo recibía (nombre y teléfono).
    db
      .prepare(
        `UPDATE envios_persona SET descripcion = '', destinatario_nombre = '', destinatario_telefono = ''
         WHERE operacion_id IN (${comoPasajero})`,
      )
      .bind(u.id),
    // Fotos de recogida y de entrega (de sus pedidos y envíos, como cliente o como quien las tomó):
    // primero la ubicación sacada de cada foto, después la referencia y el punto de entrega.
    db
      .prepare(
        `DELETE FROM fotos_gps WHERE clave IN (SELECT clave FROM evidencias WHERE pedido_id IN (${misPedidos}))
           OR clave IN (SELECT foto_recogida FROM envios_persona WHERE operacion_id IN (${misOperaciones}))
           OR clave IN (SELECT foto_entrega FROM envios_persona WHERE operacion_id IN (${misOperaciones}))`,
      )
      .bind(u.id),
    db
      .prepare(
        `UPDATE evidencias SET clave = '', lat = NULL, lng = NULL, nota = '' WHERE pedido_id IN (${misPedidos})`,
      )
      .bind(u.id),
    db
      .prepare(
        `UPDATE envios_persona SET foto_recogida = NULL, foto_entrega = NULL WHERE operacion_id IN (${misOperaciones})`,
      )
      .bind(u.id),
    db
      .prepare(
        'DELETE FROM fotos_entrega_publicas WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ?)',
      )
      .bind(u.id),
    // C-COMIDA-PAGO-RESTAURANTE: la foto del pago móvil que el cliente le mandó al restaurante (el
    // importe y la referencia se quedan, sin nombre, como dinero) y la cuenta de cobro del restaurante
    // de un dueño que se va (banco, teléfono, documento y titular).
    db
      .prepare(
        "UPDATE pagos_comida SET comprobante_clave = NULL, banco_emisor = '' WHERE cliente_id = ?",
      )
      .bind(u.id),
    db
      .prepare(
        `UPDATE cuentas_cobro_restaurante SET banco = '', telefono = '', documento = '', titular = 'Cuenta borrada', activa = 0
          WHERE restaurante_id IN (SELECT id FROM restaurantes WHERE dueno_id = ?)`,
      )
      .bind(u.id),
    // Conductor: su cuenta de cobro (banco, titular, pago móvil) y sus selfies con casco y de control.
    db
      .prepare(
        "UPDATE cuentas_cobro SET banco = '', titular = 'Cuenta borrada', identificador = '', activa = 0 WHERE usuario_id = ?",
      )
      .bind(u.id),
    db.prepare('DELETE FROM selfies_casco WHERE usuario_id = ?').bind(u.id),
    db.prepare("UPDATE selfies_control SET clave = '' WHERE usuario_id = ?").bind(u.id),
    // Restaurante: sus respuestas públicas a las reseñas (la reseña es del cliente y se queda).
    db
      .prepare(
        `UPDATE calificaciones SET respuesta = NULL, respondida_en = NULL WHERE pedido_id IN
           (SELECT p.id FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id WHERE r.dueno_id = ?)`,
      )
      .bind(u.id),
    // C-BORRADO-SERVICIOS, segunda vuelta (16 nov 2026, auditor de tiendas): cotizaciones de viaje,
    // pedido como regalo, calificaciones escritas de viajes y de clientes, papeles del conductor,
    // modo destino, historial de la cuenta de cobro, contactos del dueño y del manager, y tickets.
    db
      .prepare(
        `UPDATE cotizaciones_viaje SET origen_direccion = 'Dirección borrada', destino_direccion = 'Dirección borrada',
           origen_lat = 0, origen_lng = 0, destino_lat = 0, destino_lng = 0, paradas_json = '[]' WHERE cliente_id = ?`,
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE pedidos SET para_nombre = '', para_telefono = '', para_mensaje = '' WHERE cliente_id = ?",
      )
      .bind(u.id),
    db.prepare("UPDATE calificaciones_viaje SET comentario = '' WHERE autor_id = ?").bind(u.id),
    db
      .prepare("UPDATE calificaciones_cliente SET comentario = '' WHERE repartidor_id = ?")
      .bind(u.id),
    db.prepare("UPDATE conductor_documentos SET clave = '' WHERE conductor_id = ?").bind(u.id),
    db.prepare('DELETE FROM modo_destino WHERE repartidor_id = ?').bind(u.id),
    // C-LEGALES-COHERENTES: su código de invitación (lleva parte de su nombre). Los vínculos de quién
    // invitó a quién quedan por id, sin nombre, para el antifraude de los premios.
    db.prepare('DELETE FROM codigos_referido WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM usos_modo_destino WHERE repartidor_id = ?').bind(u.id),
    db.prepare("UPDATE cuentas_cobro_historial SET cambio = '' WHERE usuario_id = ?").bind(u.id),
    db
      .prepare(
        `UPDATE restaurante_empresa SET dueno_nombre = '', dueno_telefono = '', dueno_correo = '',
           manager_nombre = '', manager_telefono = '', manager_correo = ''
         WHERE restaurante_id IN (SELECT id FROM restaurantes WHERE dueno_id = ?)`,
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE tickets SET nombre = 'Cuenta borrada', correo = ?1, telefono = '', datos_json = '{}' WHERE usuario_id = ?2 OR correo = ?3",
      )
      .bind(`borrada-${u.id}@tumbite.invalid`, u.id, u.correo),
    // C-BORRADO-SERVICIOS, tercera vuelta (17 nov 2026): apartamento, referencia y alergias de sus
    // pedidos; su nombre en los pedidos en grupo; las fotos de sus quejas; las invitaciones que lo
    // nombran; su posición en las rutas Flex (dónde escaneó cada paquete se guarda: los eventos del
    // paquete son inmutables, comprobante para la empresa, y se declara en la privacidad); su accesibilidad auditiva y
    // el código de teléfono sin usar.
    db
      .prepare("UPDATE pedidos SET apto = '', referencia = '', alergias = '' WHERE cliente_id = ?")
      .bind(u.id),
    db.prepare("UPDATE pedidos_grupo_items SET nombre = '—' WHERE participante_id = ?").bind(u.id),
    db
      .prepare('DELETE FROM ticket_adjuntos WHERE ticket_id IN (SELECT value FROM json_each(?))')
      .bind(idsTickets),
    ...['invitaciones_conductor', 'invitaciones_flota'].map((t) =>
      db
        .prepare(
          `UPDATE ${t} SET nombre = '', telefono_canonico = NULL, correo_canonico = NULL
           WHERE usuario_id = ?1 OR (?2 IS NOT NULL AND correo_canonico = ?2) OR (?3 IS NOT NULL AND telefono_canonico = ?3)`,
        )
        .bind(u.id, canon?.correo_canonico ?? null, canon?.telefono_canonico ?? null),
    ),
    db
      .prepare(
        'UPDATE rutas_flex SET conductor_lat = NULL, conductor_lng = NULL WHERE conductor_id = ?',
      )
      .bind(u.id),
    db.prepare('DELETE FROM accesibilidad_repartidor WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM codigos_telefono WHERE usuario_id = ?').bind(u.id),
    // C-TELEFONO-TOPES: el celular y la red de cada código enviado también son datos de la persona.
    db.prepare('DELETE FROM envios_codigo_telefono WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM confirmaciones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM recuperaciones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM lista_espera WHERE correo = ?').bind(u.correo),
    // C-BORRADO-ESQUEMA: su correo en la lista de correos que rebotaron.
    db.prepare('DELETE FROM correos_rebotados WHERE correo = ?').bind(u.correo),
    // Verificación de identidad y datos del vehículo, licencia y seguro: se borran con la cuenta.
    db.prepare('DELETE FROM kyc WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM repartidor_datos WHERE usuario_id = ?').bind(u.id),
    // C-BORRADO-PAPELES (20 nov 2026): todo lo del asistente de papeles. Las fotos tienen lo que la
    // IA leyó del documento (nombre, número, vencimiento); la cara, su comparación; y el perfil que
    // ven los pasajeros, lo que el conductor escribió de sí mismo.
    db.prepare('DELETE FROM verificacion_fotos WHERE conductor_id = ?').bind(u.id),
    db.prepare('DELETE FROM verificacion_caras WHERE conductor_id = ?').bind(u.id),
    db.prepare('DELETE FROM verificacion_avisos WHERE conductor_id = ?').bind(u.id),
    db.prepare('DELETE FROM verificacion_permiso_ia WHERE conductor_id = ?').bind(u.id),
    db.prepare('DELETE FROM plazo_papeles WHERE conductor_id = ?').bind(u.id),
    db
      .prepare("UPDATE repartidores SET idiomas_perfil = '', dato_perfil = '' WHERE usuario_id = ?")
      .bind(u.id),
    // C-LIDER-INVITADO: la línea que esperaba a esta persona como líder (lleva su celular o correo).
    db
      .prepare(
        `DELETE FROM invitaciones_lider WHERE estado = 'pendiente'
           AND (lider_correo = ?1 OR (?2 <> '' AND lider_telefono_canonico = ?2))`,
      )
      .bind(String(u.correo).toLowerCase(), canon?.telefono_canonico ?? ''),
    // C-BORRADO-ESQUEMA (21 nov 2026, auditor de tiendas): lo que quedaba fuera al repasar TODO el
    // esquema tabla por tabla. Lo que escribió a soporte (y lo que el equipo le contestó, que cita sus
    // datos); la fila queda vacía, como en los chats.
    db
      .prepare(
        "UPDATE ticket_mensajes SET texto = '' WHERE ticket_id IN (SELECT value FROM json_each(?))",
      )
      .bind(idsTickets),
    db.prepare("UPDATE ayuda_viajes SET detalle = '' WHERE cliente_id = ?").bind(u.id),
    // Enlaces y pases de un solo uso para entrar, lo que seguía, sus preferencias y sus intentos.
    ...[
      'puentes_sesion',
      'pases_web',
      'favoritos',
      'paquetes_seguidos',
      'intentos_canje',
      'piloto_participantes',
      // Antecedentes y la comparación automática de su cara: datos de identidad.
      'antecedentes_checkr',
      'verificaciones_auto',
      // Su lugar en una línea o equipo y su pedido de entrar a una.
      'miembros_equipo',
      'pedidos_linea',
    ].map((t) => db.prepare(`DELETE FROM ${t} WHERE usuario_id = ?`).bind(u.id)),
    db.prepare('DELETE FROM ajustes_seguridad WHERE cliente_id = ?').bind(u.id),
    db.prepare('DELETE FROM recorridos_compartidos WHERE repartidor_id = ?').bind(u.id),
    db.prepare('DELETE FROM pedidos_compartidos WHERE creado_por = ?').bind(u.id),
    // Lo que contó en un incidente (y dónde estaba) y en una apelación. El registro del hecho queda.
    db
      .prepare(
        "UPDATE incidentes_repartidor SET detalle = '', lat = NULL, lng = NULL WHERE repartidor_id = ?",
      )
      .bind(u.id),
    db.prepare("UPDATE apelaciones_repartidor SET motivo = '' WHERE repartidor_id = ?").bind(u.id),
    // La invitación de una empresa a su correo.
    db
      .prepare('UPDATE empresa_invitaciones SET correo = ?1 WHERE correo = ?2')
      .bind(`borrada-${u.id}@tumbite.invalid`, u.correo),
    // Si lideraba una línea: los nombres y teléfonos de contacto que dio (los suyos y los del segundo
    // contacto), en la línea y en la solicitud. La solicitud sin línea se reconoce por su teléfono.
    db
      .prepare(
        `UPDATE lineas SET contacto2_nombre = '', contacto2_telefono = ''
         WHERE equipo_id IN (SELECT id FROM equipos WHERE lider_id = ?)`,
      )
      .bind(u.id),
    db
      .prepare(
        `UPDATE solicitudes_linea SET lider_nombre = '', lider_telefono = '', contacto2_nombre = '', contacto2_telefono = ''
         WHERE equipo_id IN (SELECT id FROM equipos WHERE lider_id = ?1)
            OR (?2 <> '' AND lider_telefono = ?2) OR (?3 <> '' AND lider_telefono = ?3)`,
      )
      .bind(u.id, canon?.telefono ?? '', canon?.telefono_canonico ?? ''),
    // Su vehículo: se retira y se le quitan placa, marca, modelo y color. Primero el estado (un
    // vehículo aprobado no puede quedar sin placa) y después los datos; así la placa queda libre.
    db
      .prepare(
        "UPDATE vehiculos SET estado = 'retirado', motivo = 'cuenta_borrada' WHERE conductor_id = ? AND estado != 'retirado'",
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE vehiculos SET placa = '', marca = '', modelo = '', color = '' WHERE conductor_id = ?",
      )
      .bind(u.id),
    // C-BORRADO-VEHICULO (20 oct 2026): los documentos del vehículo (registro, seguro, fotos de la
    // placa) también son datos personales: se quita el archivo y queda la fila sin él.
    db
      .prepare(
        "UPDATE vehiculo_documentos SET clave = '' WHERE vehiculo_id IN (SELECT id FROM vehiculos WHERE conductor_id = ?)",
      )
      .bind(u.id),
  ]);
  // Y las fotos del documento, la cara y el local, del almacén privado.
  if (env.BUCKET) {
    for (const prefix of [
      `kyc/${u.id}/`,
      `vehiculos/${u.id}/`,
      `casco/${u.id}/`,
      `conductores/${u.id}/`,
      // C-BORRADO-PAPELES: las fotos del asistente (documento, licencia, seguro y cara).
      `verificacion/${u.id}/`,
    ]) {
      let cursor: string | undefined;
      do {
        const lista = await env.BUCKET.list({ prefix, cursor });
        if (lista.objects.length) await env.BUCKET.delete(lista.objects.map((o) => o.key));
        cursor = lista.truncated ? lista.cursor : undefined;
      } while (cursor);
    }
  }
  // Y los archivos de las fotos que mandó en los chats.
  if (env.BUCKET && fotosChat.length) {
    for (let i = 0; i < fotosChat.length; i += 1000)
      await env.BUCKET.delete(fotosChat.slice(i, i + 1000));
  }
  // Y las fotos que adjuntó a sus quejas.
  if (env.BUCKET) {
    if (fotosQueja.length) await env.BUCKET.delete(fotosQueja);
    for (const t of misTickets) {
      const lista = await env.BUCKET.list({ prefix: `quejas/${t.id}/` });
      if (lista.objects.length) await env.BUCKET.delete(lista.objects.map((o) => o.key));
    }
  }
  // C-BORRADO-SERVICIOS: y los archivos de las fotos de recogida, entrega y selfies.
  if (env.BUCKET && fotosServicios.length) {
    for (let i = 0; i < fotosServicios.length; i += 1000)
      await env.BUCKET.delete(fotosServicios.slice(i, i + 1000));
  }
  // Y los archivos de las fotos de la puerta (puertas/<usuario>/…), del almacén privado.
  await borrarPuertasDeUsuario(env, u.id);
}

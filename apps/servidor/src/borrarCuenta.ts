import type { Env } from './env';
import { borrarPuertasDeUsuario } from './rutas/fotoPuerta';
import { ErrorDatos } from './validar';

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
  await db.batch([
    db
      .prepare(
        "UPDATE usuarios SET correo = ?, nombre = 'Cuenta borrada', telefono = NULL, fecha_nacimiento = NULL, clave_hash = 'borrada', activo = 0, correo_canonico = NULL, telefono_canonico = NULL WHERE id = ?",
      )
      .bind(`borrada-${u.id}@tumbite.invalid`, u.id),
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
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
    db.prepare('DELETE FROM confirmaciones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM recuperaciones WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM lista_espera WHERE correo = ?').bind(u.correo),
    // Verificación de identidad y datos del vehículo, licencia y seguro: se borran con la cuenta.
    db.prepare('DELETE FROM kyc WHERE usuario_id = ?').bind(u.id),
    db.prepare('DELETE FROM repartidor_datos WHERE usuario_id = ?').bind(u.id),
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
    for (const prefix of [`kyc/${u.id}/`, `vehiculos/${u.id}/`]) {
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
  // Y los archivos de las fotos de la puerta (puertas/<usuario>/…), del almacén privado.
  await borrarPuertasDeUsuario(env, u.id);
}

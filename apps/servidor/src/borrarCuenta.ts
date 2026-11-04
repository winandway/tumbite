import type { Env } from './env';
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
        "UPDATE pedidos SET direccion = 'Dirección borrada', notas = '', lat = NULL, lng = NULL WHERE cliente_id = ?",
      )
      .bind(u.id),
    db
      .prepare(
        "UPDATE calificaciones SET comentario = '' WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ?)",
      )
      .bind(u.id),
    db.prepare('DELETE FROM dispositivos WHERE usuario_id = ?').bind(u.id),
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
}

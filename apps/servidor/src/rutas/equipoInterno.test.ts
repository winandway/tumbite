import { afterEach, describe, expect, it } from 'vitest';
import { FOTO_PRUEBA, RESTAURANTE_BASE, mundo } from '../pruebas/ayuda';
import { PERMISOS_RUTAS_ADMIN } from '@tumbite/compartido';
import { depurarAccesosSensibles } from '../accesoInterno';
import { olvidarSegundoFactor } from '../segundoFactor';

/**
 * Candados C-PERMISOS-FINOS, C-EQUIPO-INVITACION y C-SEGUNDO-FACTOR-EQUIPO (MON-5, 15 nov 2026).
 * Cada uno se vio en rojo quitando su pieza (anotado en CANDADOS.md).
 */
type Mundo = ReturnType<typeof mundo>;

afterEach(() => olvidarSegundoFactor());

async function invitar(
  m: Mundo,
  token: string,
  plantillas: string[],
  extra: Record<string, unknown> = {},
) {
  const correo = `emp-${Math.random().toString(36).slice(2)}@ejemplo.com`;
  const r = await m.llamar(
    'POST',
    '/datos/admin/equipo/invitaciones',
    { correo, nombre: 'Persona Equipo', plantillas, motivo: 'Alta de prueba', ...extra },
    token,
  );
  return {
    r,
    correo,
    codigo: r.datos.enlace ? new URL(r.datos.enlace).searchParams.get('code') : null,
  };
}

/** Invita y acepta: una persona nueva del equipo con esas plantillas (y su sesión abierta). */
async function empleado(
  m: Mundo,
  token: string,
  plantillas: string[],
  extra: Record<string, unknown> = {},
) {
  const inv = await invitar(m, token, plantillas, extra);
  expect(inv.r.estado, JSON.stringify(inv.r.datos)).toBe(201);
  const a = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
    codigo: inv.codigo,
    nombre: 'Persona Equipo',
    clave: 'clave-segura-1',
  });
  expect(a.estado, JSON.stringify(a.datos)).toBe(201);
  return { token: a.datos.token as string, id: a.datos.usuario.id as string, correo: inv.correo };
}

/** Un restaurante aprobado con un pedido entregado, sus dos fotos y un cliente con teléfono. */
async function conPedido(m: Mundo, adminToken: string) {
  const dueno = await m.cuenta('restaurante');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  await m.DB.prepare("UPDATE usuarios SET telefono = '+13135550142' WHERE id = ?")
    .bind(cliente.id)
    .run();
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, adminToken);
  const zonaRest = await m.DB.prepare('SELECT zona_id FROM restaurantes WHERE id = ?')
    .bind(rid)
    .first<{ zona_id: string | null }>();
  const id = crypto.randomUUID();
  await m.DB.prepare(
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio,
       cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia,
       plan, direccion, lat, lng, zona_id)
     VALUES (?, ?, ?, 'pago_pendiente', '[]', 2000, 300, 200, 0, 300, 2800, 400, 1600, 600, 0, 200,
       'basico', '200 Calle Prueba', 25.78, -80.2, ?)`,
  )
    .bind(id, cliente.id, rid, zonaRest?.zona_id ?? 'US-FL-MIAMI')
    .run();
  for (const tipo of ['recogida', 'entrega']) {
    const clave = `evidencias/${id}/${tipo}-x`;
    await (m.extra.BUCKET as R2Bucket).put(clave, FOTO_PRUEBA);
    await m.DB.prepare('INSERT INTO evidencias (pedido_id, tipo, clave) VALUES (?, ?, ?)')
      .bind(id, tipo, clave)
      .run();
  }
  const z = await m.DB.prepare('SELECT zona_id FROM pedidos WHERE id = ?')
    .bind(id)
    .first<{ zona_id: string | null }>();
  return { id, cliente, dueno, rid, zona: z?.zona_id ?? null };
}

const foto = (m: Mundo, id: string, token: string, tipo = 'entrega') =>
  m.crudo(`/datos/pedidos/${id}/evidencia/${tipo}`, {
    headers: { authorization: `Bearer ${token}` },
  });

const accesos = (m: Mundo) =>
  m.DB.prepare('SELECT * FROM accesos_sensibles ORDER BY id').all<Record<string, unknown>>();

describe('C-PERMISOS-FINOS: compatibilidad y dueño', () => {
  it('una cuenta sin plantillas nuevas conserva su acceso de hoy; «Solo lectura» mira y no cambia', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const lector = await m.cuenta('admin', 'Soporte Lector');
    expect(
      (
        await m.llamar(
          'PUT',
          `/datos/admin/equipo/${lector.id}`,
          { perfil: 'lectura' },
          total.token,
        )
      ).estado,
    ).toBe(200);
    // El cambio vale en su próxima petición, sin volver a entrar.
    expect((await m.llamar('GET', '/datos/admin/clientes', undefined, lector.token)).estado).toBe(
      200,
    );
    expect(
      (await m.llamar('GET', '/datos/admin/finanzas/empresas', undefined, lector.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('PUT', '/datos/admin/web/ciudades/miami', { estado: 'pronto' }, lector.token))
        .estado,
    ).toBe(403);
    // Total (sin perfil guardado) sigue pudiendo todo.
    expect(
      (await m.llamar('PUT', '/datos/admin/web/ciudades/miami', { estado: 'pronto' }, total.token))
        .estado,
    ).toBe(200);
  });

  it('el dueño (ADMIN_CORREOS) es siempre Total: nadie lo suspende ni le cambia el acceso', async () => {
    const m = mundo({ ADMIN_CORREOS: 'dueno@ejemplo.com' });
    const otro = await m.cuenta('admin', 'Soporte Otro');
    const r = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Dueño',
      correo: 'dueno@ejemplo.com',
      clave: 'clave-segura-1',
      rol: 'cliente',
    });
    const id = r.datos.usuario.id as string;
    await m.DB.prepare("UPDATE usuarios SET rol = 'admin' WHERE id = ?").bind(id).run();
    // Aunque alguien le hubiera puesto una plantilla chica a mano, sigue siendo Total.
    await m.DB.prepare(
      "INSERT INTO asignaciones_internas (usuario_id, plantilla_id) VALUES (?, 'monitor')",
    )
      .bind(id)
      .run();
    const yo = await m.llamar('GET', '/datos/admin/equipo/yo', undefined, r.datos.token);
    expect(yo.datos.dueno).toBe(true);
    expect(yo.datos.permisos).toContain('equipo.gestionar');
    for (const accion of ['suspender', 'quitar'])
      expect(
        (
          await m.llamar(
            'POST',
            `/datos/admin/equipo/miembros/${id}/${accion}`,
            { motivo: 'no debería poder' },
            otro.token,
          )
        ).estado,
      ).toBe(409);
    expect(
      (await m.llamar('PUT', `/datos/admin/equipo/${id}`, { perfil: 'lectura' }, otro.token))
        .estado,
    ).toBe(409);
  });
});

describe('C-PERMISOS-FINOS: invitación, plantillas y «nadie da más de lo que tiene»', () => {
  it('Total invita a Soporte nivel 1: un solo uso, entra con su contraseña y solo ve lo suyo', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const inv = await invitar(m, total.token, ['soporte_1']);
    expect(inv.r.estado).toBe(201);
    // En local el correo NO sale: el enlace vuelve solo a quien invitó.
    expect(inv.r.datos.correoEnviado).toBe(false);
    expect(inv.r.datos.enlace).toMatch(/\/team-invite\?code=/);
    // La base guarda solo la huella del código.
    const fila = await m.DB.prepare('SELECT codigo_hash FROM invitaciones_equipo').first<{
      codigo_hash: string;
    }>();
    expect(fila?.codigo_hash).not.toBe(inv.codigo);
    const ver = await m.llamar('POST', '/datos/equipo-interno/invitacion/ver', {
      codigo: inv.codigo,
    });
    expect(ver.datos).toMatchObject({ correo: inv.correo, invitadoPor: 'Soporte Total' });
    const ok = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
      codigo: inv.codigo,
      nombre: 'Persona Equipo',
      clave: 'clave-segura-1',
    });
    expect(ok.estado).toBe(201);
    const otra = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
      codigo: inv.codigo,
      nombre: 'Persona Equipo',
      clave: 'clave-segura-1',
    });
    expect(otra.estado).toBe(410);
    const t = ok.datos.token as string;
    const yo = await m.llamar('GET', '/datos/admin/equipo/yo', undefined, t);
    expect(yo.datos.permisos).toContain('pedidos.fotos');
    expect(yo.datos.permisos).not.toContain('clientes.datos_personales');
    expect((await m.llamar('GET', '/datos/admin/pedidos', undefined, t)).estado).toBe(200);
    expect((await m.llamar('GET', '/datos/admin/tickets', undefined, t)).estado).toBe(200);
    expect((await m.llamar('GET', '/datos/admin/finanzas/empresas', undefined, t)).estado).toBe(
      403,
    );
    expect((await m.llamar('GET', '/datos/admin/equipo/miembros', undefined, t)).estado).toBe(403);
    expect(
      (await m.llamar('POST', '/datos/admin/pedidos/x/cancelar', { motivo: 'x' }, t)).estado,
    ).toBe(403);
    // Y vuelve a entrar con su contraseña.
    const entrar = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: inv.correo,
      clave: 'clave-segura-1',
    });
    expect(entrar.estado).toBe(200);
  });

  it('quien invita no da más de lo que tiene: permisos, plantillas y ciudades (servidor)', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    // Un jefe de soporte que gestiona el equipo, solo en una ciudad.
    const jefe = await empleado(m, total.token, ['soporte_2'], {
      alcance: { zonas: ['miami'] },
    });
    const conGestion = await m.llamar(
      'PUT',
      `/datos/admin/equipo/miembros/${jefe.id}`,
      {
        asignaciones: [{ plantillaId: 'soporte_2', alcance: { zonas: ['miami'] } }],
        ajustes: [
          { permiso: 'equipo.gestionar', tipo: 'extra', motivo: 'Jefe de soporte de Miami' },
          { permiso: 'equipo.ver', tipo: 'extra', motivo: 'Jefe de soporte de Miami' },
        ],
        motivo: 'Jefe de soporte',
      },
      total.token,
    );
    expect(conGestion.estado).toBe(200);
    // Finanzas: permisos que el jefe no tiene.
    const finanzas = await invitar(m, jefe.token, ['finanzas'], { alcance: { zonas: ['miami'] } });
    expect(finanzas.r.estado).toBe(403);
    expect(finanzas.r.datos.campo).toBe('permisos');
    // Soporte nivel 1 en su ciudad: sí. En todas las ciudades: no.
    expect(
      (await invitar(m, jefe.token, ['soporte_1'], { alcance: { zonas: ['miami'] } })).r.estado,
    ).toBe(201);
    const todas = await invitar(m, jefe.token, ['soporte_1']);
    expect(todas.r.estado).toBe(403);
    expect(todas.r.datos.campo).toBe('alcance');
    // Una plantilla nueva con un permiso que no tiene: no.
    const plantilla = await m.llamar(
      'POST',
      '/datos/admin/equipo/plantillas',
      { nombre: { es: 'Caja', en: 'Cash' }, permisos: ['dinero.aprobar'] },
      jefe.token,
    );
    expect(plantilla.estado).toBe(403);
    // Ni tocar a quien tiene más que él (la cuenta Total).
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/equipo/miembros/${total.id}/suspender`,
          { motivo: 'no debería poder' },
          jefe.token,
        )
      ).estado,
    ).toBe(403);
    // Y el perfil viejo «total» tampoco lo da quien no lo tiene todo.
    const nuevo = await empleado(m, total.token, ['monitor']);
    expect(
      (await m.llamar('PUT', `/datos/admin/equipo/${nuevo.id}`, { perfil: 'total' }, jefe.token))
        .estado,
    ).toBe(403);
  });

  it('una cuenta de @windoce.com exige «Soporte» en el nombre; un correo con cuenta no se invita', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const sin = await m.llamar(
      'POST',
      '/datos/admin/equipo/invitaciones',
      {
        correo: 'jose@windoce.com',
        nombre: 'José',
        plantillas: ['monitor'],
        motivo: 'Alta de prueba',
      },
      total.token,
    );
    expect(sin.estado).toBe(400);
    expect(sin.datos.campo).toBe('nombre');
    const con = await m.llamar(
      'POST',
      '/datos/admin/equipo/invitaciones',
      {
        correo: 'jose@windoce.com',
        nombre: 'José (Soporte)',
        plantillas: ['monitor'],
        motivo: 'Alta de prueba',
      },
      total.token,
    );
    expect(con.estado).toBe(201);
    // Al aceptar tampoco se puede quitar «Soporte».
    const codigo = new URL(con.datos.enlace).searchParams.get('code');
    const quitar = await m.llamar('POST', '/datos/equipo-interno/invitacion/aceptar', {
      codigo,
      nombre: 'José',
      clave: 'clave-segura-1',
    });
    expect(quitar.estado).toBe(400);
    const cliente = await m.cuenta('cliente', 'Ana Cliente');
    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?').bind(cliente.id).first<{
        correo: string;
      }>()
    )?.correo;
    const existe = await m.llamar(
      'POST',
      '/datos/admin/equipo/invitaciones',
      { correo, nombre: 'Ana', plantillas: ['monitor'], motivo: 'Alta de prueba' },
      total.token,
    );
    expect(existe.estado).toBe(409);
  });

  it('un cambio de permisos vale en la petición siguiente; editar la plantilla también', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const e = await empleado(m, total.token, ['monitor']);
    expect((await m.llamar('GET', '/datos/admin/tickets', undefined, e.token)).estado).toBe(403);
    await m.llamar(
      'PUT',
      `/datos/admin/equipo/miembros/${e.id}`,
      { asignaciones: [{ plantillaId: 'soporte_1' }], motivo: 'Pasa a soporte' },
      total.token,
    );
    expect((await m.llamar('GET', '/datos/admin/tickets', undefined, e.token)).estado).toBe(200);
    // Una plantilla propia, y al quitarle un permiso, quien la tiene lo pierde enseguida.
    const p = await m.llamar(
      'POST',
      '/datos/admin/equipo/plantillas',
      { nombre: { es: 'Casos', en: 'Cases' }, permisos: ['tickets.ver', 'pedidos.ver'] },
      total.token,
    );
    expect(p.estado).toBe(200);
    await m.llamar(
      'PUT',
      `/datos/admin/equipo/miembros/${e.id}`,
      { asignaciones: [{ plantillaId: p.datos.id }], motivo: 'Solo casos' },
      total.token,
    );
    expect((await m.llamar('GET', '/datos/admin/tickets', undefined, e.token)).estado).toBe(200);
    await m.llamar(
      'PUT',
      `/datos/admin/equipo/plantillas/${p.datos.id}`,
      { nombre: { es: 'Casos', en: 'Cases' }, permisos: ['pedidos.ver'] },
      total.token,
    );
    expect((await m.llamar('GET', '/datos/admin/tickets', undefined, e.token)).estado).toBe(403);
    // La de fábrica no se borra; Total no se edita.
    expect(
      (await m.llamar('DELETE', '/datos/admin/equipo/plantillas/soporte_1', undefined, total.token))
        .estado,
    ).toBe(409);
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/equipo/plantillas/total',
          { nombre: { es: 'Total', en: 'Full' }, permisos: ['pedidos.ver'] },
          total.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('los permisos van en la sesión: mirar no lee las tablas de permisos en cada petición', async () => {
    const consultas: string[] = [];
    const m = mundo(
      {},
      {
        envolver: (db) =>
          new Proxy(db, {
            get(t, k) {
              if (k === 'prepare')
                return (sql: string) => {
                  consultas.push(sql);
                  return t.prepare(sql);
                };
              if (k === 'batch') return (lote: D1PreparedStatement[]) => t.batch(lote);
              const v = Reflect.get(t, k);
              return typeof v === 'function' ? v.bind(t) : v;
            },
          }),
      },
    );
    const total = await m.cuenta('admin', 'Soporte Total');
    const e = await empleado(m, total.token, ['soporte_1']);
    await m.llamar('GET', '/datos/admin/pedidos', undefined, e.token);
    consultas.length = 0;
    for (let i = 0; i < 3; i++) await m.llamar('GET', '/datos/admin/pedidos', undefined, e.token);
    expect(
      consultas.filter((s) => /asignaciones_internas|permisos_persona|perfiles_internos/.test(s)),
    ).toEqual([]);
  });
});

describe('C-PERMISOS-FINOS: suspender y quitar el acceso', () => {
  it('suspender cierra sus sesiones al instante y no deja entrar; reactivar sí', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const e = await empleado(m, total.token, ['soporte_1']);
    expect((await m.llamar('GET', '/datos/admin/pedidos', undefined, e.token)).estado).toBe(200);
    const s = await m.llamar(
      'POST',
      `/datos/admin/equipo/miembros/${e.id}/suspender`,
      { motivo: 'Investigación interna' },
      total.token,
    );
    expect(s.estado).toBe(200);
    // Sus sesiones ya no existen (en todos sus aparatos), antes de que vuelva a pedir nada.
    const sesiones = await m.DB.prepare('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ?')
      .bind(e.id)
      .first<{ n: number }>();
    expect(Number(sesiones?.n)).toBe(0);
    expect((await m.llamar('GET', '/datos/admin/pedidos', undefined, e.token)).estado).toBe(401);
    const entrar = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: e.correo,
      clave: 'clave-segura-1',
    });
    expect(entrar.estado).toBe(403);
    expect(entrar.datos.error).toMatch(/suspended|suspendido/);
    await m.llamar(
      'POST',
      `/datos/admin/equipo/miembros/${e.id}/reactivar`,
      { motivo: 'Investigación cerrada' },
      total.token,
    );
    const otra = await m.llamar('POST', '/datos/cuentas/entrar', {
      correo: e.correo,
      clave: 'clave-segura-1',
    });
    expect(otra.estado).toBe(200);
    // Quitar el acceso: igual, y queda en el registro con su motivo.
    await m.llamar(
      'POST',
      `/datos/admin/equipo/miembros/${e.id}/quitar`,
      { motivo: 'Ya no trabaja aquí' },
      total.token,
    );
    expect(
      (await m.llamar('GET', '/datos/admin/pedidos', undefined, otra.datos.token)).estado,
    ).toBe(401);
    const ficha = await m.llamar(
      'GET',
      `/datos/admin/equipo/miembros/${e.id}`,
      undefined,
      total.token,
    );
    expect(ficha.datos.miembro.estado).toBe('retirado');
    expect(ficha.datos.cambios.map((x: { accion: string }) => x.accion)).toEqual(
      expect.arrayContaining(['equipo.suspendido', 'equipo.activo', 'equipo.retirado']),
    );
    // Nadie se suspende a sí mismo.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/equipo/miembros/${total.id}/suspender`,
          { motivo: 'prueba propia' },
          total.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('una asignación vencida deja la cuenta «vencida» y fuera', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const e = await empleado(m, total.token, ['monitor']);
    await m.DB.prepare(
      "UPDATE asignaciones_internas SET vence_en = datetime('now', '-1 minute') WHERE usuario_id = ?",
    )
      .bind(e.id)
      .run();
    await m.DB.prepare('UPDATE sesiones SET permisos_json = NULL WHERE usuario_id = ?')
      .bind(e.id)
      .run();
    expect((await m.llamar('GET', '/datos/admin/pedidos', undefined, e.token)).estado).toBe(401);
    const lista = await m.llamar('GET', '/datos/admin/equipo/miembros', undefined, total.token);
    expect(lista.datos.miembros.find((x: { id: string }) => x.id === e.id).estado).toBe('vencido');
  });
});

describe('C-PERMISOS-FINOS: fotos de evidencia, datos personales y registro de lo que se vio', () => {
  it('sin `pedidos.fotos` la foto da 403; con él se ve y queda UNA fila sin la foto ni el contacto', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { id, cliente } = await conPedido(m, total.token);
    const monitor = await empleado(m, total.token, ['monitor']);
    const soporte = await empleado(m, total.token, ['soporte_1']);
    expect((await foto(m, id, monitor.token)).status).toBe(403);
    expect((await accesos(m)).results).toHaveLength(0);
    expect((await foto(m, id, soporte.token)).status).toBe(200);
    expect((await foto(m, id, soporte.token, 'recogida')).status).toBe(200);
    const filas = (await accesos(m)).results;
    expect(filas.map((f) => [f.usuario_id, f.objeto, f.tipo, f.permiso])).toEqual([
      [soporte.id, `pedido:${id}`, 'foto_entrega', 'pedidos.fotos'],
      [soporte.id, `pedido:${id}`, 'foto_recogida', 'pedidos.fotos'],
    ]);
    // El registro nunca guarda la foto ni datos de contacto.
    const todo = JSON.stringify(filas);
    expect(todo).not.toMatch(/evidencias\/|5550142|@ejemplo\.com/);
    // El cliente sigue viendo su foto como siempre, sin dejar fila.
    expect((await foto(m, id, cliente.token)).status).toBe(200);
    expect((await accesos(m)).results).toHaveLength(2);
  });

  it('la foto de la puerta de la casa sigue invisible a todo el equipo (C-FOTO-PUERTA)', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { cliente } = await conPedido(m, total.token);
    const d = await m.llamar(
      'POST',
      '/datos/mis-direcciones',
      { etiqueta: 'Casa', direccion: '200 Calle Prueba', lat: 25.78, lng: -80.2 },
      cliente.token,
    );
    const dir = d.datos.direccion.id as string;
    expect(
      (await m.foto(`/datos/mis-direcciones/${dir}/fotos/1`, cliente.token)).estado,
    ).toBeLessThan(300);
    const ver = (t: string) =>
      m.crudo(`/datos/mis-direcciones/${dir}/fotos/1`, {
        headers: { authorization: `Bearer ${t}` },
      });
    expect((await ver(cliente.token)).status).toBe(200);
    // Ni siquiera la cuenta Total del equipo: no hay ninguna ruta del superadmin para esa foto.
    expect([403, 404]).toContain((await ver(total.token)).status);
    expect(Object.keys(PERMISOS_RUTAS_ADMIN).filter((k) => /puerta/.test(k))).toEqual([]);
  });

  it('teléfono y correo: enmascarados en listas, fichas y buscador; «Ver dato» con su permiso deja fila', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { cliente } = await conPedido(m, total.token);
    const n1 = await empleado(m, total.token, ['soporte_1']);
    const n2 = await empleado(m, total.token, ['soporte_2']);
    for (const t of [n1.token, n2.token, total.token]) {
      const ficha = await m.llamar('GET', `/datos/admin/clientes/${cliente.id}`, undefined, t);
      const texto = JSON.stringify(ficha.datos);
      expect(texto).not.toMatch(/3135550142/);
      expect(texto).not.toMatch(/cliente-[a-z0-9]+@ejemplo\.com/);
      const lista = await m.llamar('GET', '/datos/admin/clientes', undefined, t);
      expect(JSON.stringify(lista.datos)).not.toMatch(/3135550142/);
      const busca = await m.llamar('GET', '/datos/admin/buscar?q=0142', undefined, t);
      expect(JSON.stringify(busca.datos)).not.toMatch(/3135550142/);
    }
    const sin = await m.llamar(
      'GET',
      `/datos/admin/datos-personales/cliente/${cliente.id}/telefono`,
      undefined,
      n1.token,
    );
    expect(sin.estado).toBe(403);
    const con = await m.llamar(
      'GET',
      `/datos/admin/datos-personales/cliente/${cliente.id}/telefono`,
      undefined,
      n2.token,
    );
    expect(con.estado).toBe(200);
    expect(con.datos.valor).toBe('+13135550142');
    const filas = (await accesos(m)).results;
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      usuario_id: n2.id,
      objeto: `cliente:${cliente.id}`,
      tipo: 'telefono',
      permiso: 'clientes.datos_personales',
    });
    expect(JSON.stringify(filas)).not.toMatch(/5550142/);
    // El registro tampoco muestra contactos a quien lo mira.
    const reg = await m.llamar(
      'GET',
      '/datos/admin/equipo/registro?tipo=accesos',
      undefined,
      total.token,
    );
    expect(JSON.stringify(reg.datos)).not.toMatch(/5550142/);
  });
});

describe('C-PERMISOS-FINOS: alcance por ciudad y servicio', () => {
  it('quien trabaja en otra ciudad no ve los pedidos ni la ficha de esta', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { id, zona } = await conPedido(m, total.token);
    expect(zona).toBeTruthy();
    const aqui = await empleado(m, total.token, ['soporte_1'], { alcance: { zonas: [zona] } });
    const otra = await empleado(m, total.token, ['soporte_1'], {
      alcance: { zonas: ['otra-zona'] },
    });
    const comida = await empleado(m, total.token, ['soporte_1'], {
      alcance: { servicios: ['moto'] },
    });
    const ids = async (t: string) =>
      (await m.llamar('GET', '/datos/admin/pedidos?estado=todos', undefined, t)).datos.pedidos.map(
        (p: { id: string }) => p.id,
      );
    expect(await ids(aqui.token)).toContain(id);
    expect(await ids(otra.token)).not.toContain(id);
    expect(await ids(comida.token)).not.toContain(id);
    expect(
      (await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, aqui.token)).estado,
    ).toBe(200);
    expect(
      (await m.llamar('GET', `/datos/admin/pedidos/${id}`, undefined, otra.token)).estado,
    ).toBe(404);
    expect((await foto(m, id, otra.token)).status).toBe(404);
    expect((await foto(m, id, aqui.token)).status).toBe(200);
    // El código exacto tampoco se lo salta.
    const porCodigo = await m.llamar(
      'GET',
      `/datos/admin/pedidos?q=${id.slice(0, 6)}`,
      undefined,
      otra.token,
    );
    expect(porCodigo.datos.pedidos.map((p: { id: string }) => p.id)).not.toContain(id);
  });
});

describe('C-SEGUNDO-FACTOR-EQUIPO: construido y apagado de fábrica', () => {
  it('apagado no pide nada; encendido pide el código para lo delicado y no toca a las apps', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { cliente } = await conPedido(m, total.token);
    const n2 = await empleado(m, total.token, ['soporte_2']);
    const ruta = `/datos/admin/datos-personales/cliente/${cliente.id}/correo`;
    expect((await m.llamar('GET', ruta, undefined, n2.token)).estado).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/admin/equipo/ajustes/segundo-factor', undefined, total.token))
        .datos.activo,
    ).toBe(false);
    // Solo quien gestiona el equipo lo enciende.
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/equipo/ajustes/segundo-factor',
          { activo: true },
          n2.token,
        )
      ).estado,
    ).toBe(403);
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/equipo/ajustes/segundo-factor',
          { activo: true },
          total.token,
        )
      ).estado,
    ).toBe(200);
    const pide = await m.llamar('GET', ruta, undefined, n2.token);
    expect(pide.estado).toBe(403);
    expect(pide.datos.campo).toBe('segundo_factor');
    // Lo no delicado sigue sin código.
    expect((await m.llamar('GET', '/datos/admin/pedidos', undefined, n2.token)).estado).toBe(200);
    const codigo = await m.llamar(
      'POST',
      '/datos/equipo-interno/segundo-factor/pedir',
      {},
      n2.token,
    );
    expect(codigo.datos.codigoPrueba).toMatch(/^\d{6}$/);
    const mal = await m.llamar(
      'POST',
      '/datos/equipo-interno/segundo-factor/verificar',
      { codigo: codigo.datos.codigoPrueba === '000000' ? '111111' : '000000' },
      n2.token,
    );
    expect(mal.estado).toBe(403);
    const bien = await m.llamar(
      'POST',
      '/datos/equipo-interno/segundo-factor/verificar',
      { codigo: codigo.datos.codigoPrueba },
      n2.token,
    );
    expect(bien.estado).toBe(200);
    expect((await m.llamar('GET', ruta, undefined, n2.token)).estado).toBe(200);
    // Las apps (y los revisores de las tiendas) entran y piden como siempre.
    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?').bind(cliente.id).first<{
        correo: string;
      }>()
    )?.correo;
    expect(
      (await m.llamar('POST', '/datos/cuentas/entrar', { correo, clave: 'clave-segura-1' })).estado,
    ).toBe(200);
    expect((await m.llamar('GET', '/datos/cuentas/yo', undefined, cliente.token)).estado).toBe(200);
  });
});

describe('C-PERMISOS-FINOS: registro, exportación y retención', () => {
  it('el CSV del registro escapa las celdas que una hoja de cálculo leería como fórmula', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', '=HYPERLINK("x") Soporte');
    await m.llamar('PUT', '/datos/admin/web/ciudades/miami', { estado: 'pronto' }, total.token);
    const r = await m.crudo('/datos/admin/equipo/registro?tipo=acciones&formato=csv', {
      headers: { authorization: `Bearer ${total.token}` },
    });
    expect(r.status).toBe(200);
    const csv = await r.text();
    expect(csv).toContain(`"'=HYPERLINK(""x"") Soporte"`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('el registro de lo que se vio se borra a los 90 días, por la llave', async () => {
    const m = mundo();
    for (const dias of [120, 95, 10, 0])
      await m.DB.prepare(
        "INSERT INTO accesos_sensibles (usuario_id, objeto, tipo, permiso, creado_en) VALUES ('u', 'pedido:x', 'foto_entrega', 'pedidos.fotos', datetime('now', ?))",
      )
        .bind(`-${dias} days`)
        .run();
    expect(await depurarAccesosSensibles(m.DB, 90)).toBe(2);
    const quedan = await m.DB.prepare('SELECT COUNT(*) AS n FROM accesos_sensibles').first<{
      n: number;
    }>();
    expect(Number(quedan?.n)).toBe(2);
  });

  it('la ficha del empleado muestra sus permisos con su plantilla, lo que hizo y lo que vio', async () => {
    const m = mundo();
    const total = await m.cuenta('admin', 'Soporte Total');
    const { id } = await conPedido(m, total.token);
    const e = await empleado(m, total.token, ['soporte_1']);
    await foto(m, id, e.token);
    const ficha = await m.llamar(
      'GET',
      `/datos/admin/equipo/miembros/${e.id}`,
      undefined,
      total.token,
    );
    expect(ficha.estado).toBe(200);
    expect(ficha.datos.acceso.fuentes['pedidos.fotos']).toEqual(['soporte_1']);
    expect(ficha.datos.accesos[0]).toMatchObject({ tipo: 'foto_entrega', objeto: `pedido:${id}` });
    expect(ficha.datos.miembro).toMatchObject({ estado: 'activo', plantillas: ['soporte_1'] });
    // Quien no tiene `auditoria.accesos` ve la ficha sin lo que vio.
    const sup = await empleado(m, total.token, ['supervisor']);
    const vista = await m.llamar(
      'GET',
      `/datos/admin/equipo/miembros/${e.id}`,
      undefined,
      sup.token,
    );
    expect(vista.datos.accesos).toBeNull();
  });
});

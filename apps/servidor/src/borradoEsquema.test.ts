import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOTIVOS_CONSERVAR, TABLAS_QUE_SE_CONSERVAN } from './borradoEsquema';
import { COLUMNAS_DEL_ESQUEMA } from './esquemaColumnas';
import { mundo } from './pruebas/ayuda';

/**
 * C-BORRADO-ESQUEMA (21 nov 2026, pedido del auditor de tiendas) — todos los países. El borrado de
 * cuenta se comprueba contra TODO el esquema: cada tabla o la limpia `borrarCuenta`, o está en
 * `TABLAS_QUE_SE_CONSERVAN` con su motivo. Una tabla nueva sin clasificar pone esto en rojo.
 */
const FUENTES = ['borrarCuenta.ts', 'camila/memoria.ts', 'rutas/fotoPuerta.ts']
  .map((f) => readFileSync(join(__dirname, f), 'utf8'))
  .join('\n');
/** La tabla se limpia de verdad: aparece en un DELETE o en un UPDATE (también en las listas `${t}`). */
const seLimpia = (t: string) =>
  [`DELETE FROM ${t} `, `DELETE FROM ${t}\n`, `UPDATE ${t} `, `UPDATE ${t}\n`, `'${t}'`].some((x) =>
    FUENTES.includes(x),
  );

describe('borrado de cuenta contra todo el esquema (C-BORRADO-ESQUEMA)', () => {
  it('cada tabla del esquema o se limpia al borrar la cuenta o se conserva con un motivo escrito', () => {
    const sinClasificar: string[] = [];
    const dobles: string[] = [];
    for (const t of Object.keys(COLUMNAS_DEL_ESQUEMA)) {
      const limpia = seLimpia(t);
      const conserva = t in TABLAS_QUE_SE_CONSERVAN;
      if (!limpia && !conserva) sinClasificar.push(t);
      if (limpia && conserva) dobles.push(t);
    }
    expect(
      sinClasificar,
      'tablas sin clasificar: bórralas en borrarCuenta o anótalas con su motivo',
    ).toEqual([]);
    expect(dobles, 'tablas que se limpian Y figuran como conservadas').toEqual([]);
    // La lista no guarda tablas que ya no existen ni motivos inventados.
    for (const [t, motivo] of Object.entries(TABLAS_QUE_SE_CONSERVAN)) {
      expect(COLUMNAS_DEL_ESQUEMA[t], `${t} ya no existe en el esquema`).toBeDefined();
      expect(MOTIVOS_CONSERVAR[motivo], `${t}: motivo desconocido`).toBeTruthy();
    }
  });

  it('una tabla que apunta a una persona nunca figura como «sin datos de persona»', () => {
    const DE_PERSONA =
      /^(usuario|conductor|cliente|repartidor|dueno|autor|anfitrion|lider|invitado|invitador|beneficiario|comprador|participante)_id$|correo|telefono/;
    for (const [t, motivo] of Object.entries(TABLAS_QUE_SE_CONSERVAN)) {
      if (motivo !== 'sin_persona') continue;
      const cols = (COLUMNAS_DEL_ESQUEMA[t] ?? []).filter((c) => DE_PERSONA.test(c));
      expect(cols, `${t} apunta a una persona y dice «sin_persona»`).toEqual([]);
    }
  });

  it('borra lo que antes quedaba: mensajes a soporte, enlaces, favoritos, antecedentes, placa y línea', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Luis Prueba');
    const otro = await m.cuenta('repartidor', 'Otra Persona');
    const q = (sql: string, ...v: unknown[]) =>
      m.DB.prepare(sql)
        .bind(...v)
        .run();
    const tel = '+13135550142';
    await q('UPDATE usuarios SET telefono = ? WHERE id = ?', tel, rep.id);
    for (const u of [rep, otro]) {
      const s = u === rep ? 'a' : 'b';
      await q(
        `INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, usuario_id) VALUES (?, ?, 'soporte', 'Ejemplo', ?, 'Consulta', ?)`,
        `tk-${s}`,
        `TK${s}`,
        `${s}@ejemplo.com`,
        u.id,
      );
      await q(
        "INSERT INTO ticket_mensajes (id, ticket_id, autor, texto) VALUES (?, ?, 'persona', 'Vivo en la calle Ejemplo 1')",
        `tm-${s}`,
        `tk-${s}`,
      );
      await q(
        "INSERT INTO ticket_mensajes (id, ticket_id, autor, texto) VALUES (?, ?, 'equipo', 'Anotamos su calle Ejemplo 1')",
        `te-${s}`,
        `tk-${s}`,
      );
      await q(
        "INSERT INTO puentes_sesion (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+1 hour'))",
        `ps-${s}`,
        u.id,
      );
      await q(
        "INSERT INTO pases_web (codigo_hash, usuario_id, vence_en) VALUES (?, ?, datetime('now', '+1 hour'))",
        `pw-${s}`,
        u.id,
      );
      await q('INSERT INTO paquetes_seguidos (usuario_id, codigo) VALUES (?, ?)', u.id, `EJ${s}`);
      await q("INSERT INTO ajustes_seguridad (cliente_id, compartir) VALUES (?, 'siempre')", u.id);
      await q(
        "INSERT INTO antecedentes_checkr (usuario_id, candidato_id, resultado) VALUES (?, 'cand', 'clear')",
        u.id,
      );
      await q(
        `INSERT INTO verificaciones_auto (id, usuario_id, decision, similitud) VALUES (?, ?, 'verificado', 0.9)`,
        `va-${s}`,
        u.id,
      );
      await q('INSERT INTO miembros_equipo (usuario_id, equipo_id) VALUES (?, ?)', u.id, `eq-${s}`);
      await q('INSERT INTO pedidos_linea (usuario_id, equipo_id) VALUES (?, ?)', u.id, `eq-${s}`);
      await q("INSERT INTO piloto_participantes (usuario_id, nota) VALUES (?, 'nota')", u.id);
      await q(
        "INSERT INTO recorridos_compartidos (huella, repartidor_id, expira_en) VALUES (?, ?, datetime('now', '+1 hour'))",
        `rc-${s}`,
        u.id,
      );
      await q('INSERT INTO intentos_canje (usuario_id, fallidos) VALUES (?, 2)', u.id);
      await q(
        `INSERT INTO incidentes_repartidor (id, repartidor_id, tipo, motivo, detalle, lat, lng) VALUES (?, ?, 'incidente', 'otro', 'Me caí frente a mi casa', 1.5, 2.5)`,
        `in-${s}`,
        u.id,
      );
      await q(
        `INSERT INTO apelaciones_repartidor (id, repartidor_id, unidad_tipo, unidad_id, motivo) VALUES (?, ?, 'pedido', 'p1', 'Estaba enfermo')`,
        `ap-${s}`,
        u.id,
      );
      await q(
        `INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, estado) VALUES (?, ?, 'moto', 'Marca', 'Modelo', 'Rojo', ?, 'ZZ', 'registrado')`,
        `vh-${s}`,
        u.id,
        `EJ${s}123`,
      );
      await q(
        `INSERT INTO equipos (id, nombre, zona_id, lider_id, codigo) VALUES (?, 'Línea Ejemplo', 'z', ?, ?)`,
        `eq-${s}`,
        u.id,
        `COD${s}`,
      );
      await q(
        `INSERT INTO lineas (equipo_id, contacto2_nombre, contacto2_telefono) VALUES (?, 'Segundo Ejemplo', '+13135550199')`,
        `eq-${s}`,
      );
      await q(
        `INSERT INTO solicitudes_linea (id, nombre, zona_id, tipo, lider_nombre, lider_telefono, contacto2_nombre, contacto2_telefono, equipo_id)
         VALUES (?, 'Línea Ejemplo', 'z', 'taxi', 'Líder Ejemplo', '+13135550188', 'Segundo Ejemplo', '+13135550199', ?)`,
        `sl-${s}`,
        `eq-${s}`,
      );
    }
    // Una solicitud todavía sin línea, que solo se reconoce por el teléfono del líder.
    await q(
      `INSERT INTO solicitudes_linea (id, nombre, zona_id, tipo, lider_nombre, lider_telefono) VALUES ('sl-tel', 'Otra línea', 'z', 'taxi', 'Luis Prueba', ?)`,
      tel,
    );

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, rep.token)).estado).toBe(200);

    const n = async (sql: string, ...v: unknown[]) =>
      (
        await m.DB.prepare(sql)
          .bind(...v)
          .first<{ n: number }>()
      )?.n;
    const POR_USUARIO: [string, string][] = [
      ['puentes_sesion', 'usuario_id'],
      ['pases_web', 'usuario_id'],
      ['paquetes_seguidos', 'usuario_id'],
      ['ajustes_seguridad', 'cliente_id'],
      ['antecedentes_checkr', 'usuario_id'],
      ['verificaciones_auto', 'usuario_id'],
      ['miembros_equipo', 'usuario_id'],
      ['pedidos_linea', 'usuario_id'],
      ['piloto_participantes', 'usuario_id'],
      ['recorridos_compartidos', 'repartidor_id'],
      ['intentos_canje', 'usuario_id'],
    ];
    for (const [t, col] of POR_USUARIO) {
      expect(await n(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`, rep.id), t).toBe(0);
      expect(await n(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`, otro.id), t).toBe(1);
    }
    // Lo escrito se vacía; la fila queda para que el historial del equipo no se desordene.
    const vacio = async (sql: string, s: string) =>
      Object.values((await m.DB.prepare(sql).bind(s).first<Record<string, unknown>>()) ?? {});
    expect(await vacio('SELECT texto FROM ticket_mensajes WHERE id = ?', 'tm-a')).toEqual(['']);
    expect(await vacio('SELECT texto FROM ticket_mensajes WHERE id = ?', 'te-a')).toEqual(['']);
    expect(await vacio('SELECT texto FROM ticket_mensajes WHERE id = ?', 'tm-b')).not.toEqual(['']);
    expect(
      await vacio('SELECT detalle, lat, lng FROM incidentes_repartidor WHERE id = ?', 'in-a'),
    ).toEqual(['', null, null]);
    expect(
      await vacio('SELECT detalle, lat, lng FROM incidentes_repartidor WHERE id = ?', 'in-b'),
    ).toEqual(['Me caí frente a mi casa', 1.5, 2.5]);
    expect(await vacio('SELECT motivo FROM apelaciones_repartidor WHERE id = ?', 'ap-a')).toEqual([
      '',
    ]);
    expect(await vacio('SELECT motivo FROM apelaciones_repartidor WHERE id = ?', 'ap-b')).toEqual([
      'Estaba enfermo',
    ]);
    // La placa queda libre (y el vehículo retirado) para que nadie más quede bloqueado por ella.
    expect(
      await vacio('SELECT placa, marca, modelo, color, estado FROM vehiculos WHERE id = ?', 'vh-a'),
    ).toEqual(['', '', '', '', 'retirado']);
    expect(await vacio('SELECT placa, marca, estado FROM vehiculos WHERE id = ?', 'vh-b')).toEqual([
      'EJb123',
      'Marca',
      'registrado',
    ]);
    // La línea que lideraba: fuera los nombres y teléfonos de contacto, por línea y por su teléfono.
    for (const id of ['sl-a', 'sl-tel'])
      expect(
        await vacio(
          'SELECT lider_nombre, lider_telefono, contacto2_nombre, contacto2_telefono FROM solicitudes_linea WHERE id = ?',
          id,
        ),
        id,
      ).toEqual(['', '', '', '']);
    expect(
      await vacio(
        'SELECT lider_nombre, lider_telefono FROM solicitudes_linea WHERE id = ?',
        'sl-b',
      ),
    ).toEqual(['Líder Ejemplo', '+13135550188']);
    expect(
      await vacio(
        'SELECT contacto2_nombre, contacto2_telefono FROM lineas WHERE equipo_id = ?',
        'eq-a',
      ),
    ).toEqual(['', '']);
    expect(await vacio('SELECT contacto2_nombre FROM lineas WHERE equipo_id = ?', 'eq-b')).toEqual([
      'Segundo Ejemplo',
    ]);
  });
});

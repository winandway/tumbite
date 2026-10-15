"""
Pruebas reproducibles de ARQUITECTURA-MULTISERVICIO-V1.2 (solo diseño: no toca la base real ni Stripe).
Uso:            python3 docs/arquitectura-v1.2/probar.py
Comprobar rojo: MUTAR=<disparador o índice> python3 docs/arquitectura-v1.2/probar.py
Grupos:  [SQLite]  base SQLite local en memoria o en un archivo temporal.
         [Stripe simulado]  un Stripe falso que imita lo que dice su documentación oficial:
                            idempotencia v1 (guarda la primera respuesta, incluso un 500; las claves
                            pueden borrarse después de 24 h), lista de transferencias por
                            transfer_group y avisos transfer.created.
Lo que necesita YaDominios Cloud de verdad está en la matriz del documento (§7), no aquí.
"""
import os, re, sqlite3, sys, random, tempfile, uuid
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
V11 = os.path.join(RAIZ, 'docs', 'arquitectura-v1.1')
def leer(ruta): return open(ruta).read()
def mios(n): return leer(os.path.join(AQUI, n))

def base(ruta=':memory:'):
    db = sqlite3.connect(ruta, isolation_level=None, timeout=0)
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript(leer(os.path.join(RAIZ, 'schema.sql')))
    v1 = re.findall(r"```sql\n(.*?)```", leer(os.path.join(RAIZ, 'docs', 'ARQUITECTURA-MULTISERVICIO-V1.md')), re.S)
    db.executescript(v1[0]); db.executescript(v1[1])
    for t in ('compra_lineas', 'compras', 'viajes', 'libro_movimientos', 'operaciones'):
        db.execute(f'DROP TABLE {t}')
    db.execute('ALTER TABLE repartidores ADD COLUMN vehiculo_activo_id TEXT REFERENCES vehiculos(id)')
    db.executescript(mios('10-operaciones-y-viajes.sql'))
    for f in ('01-requisitos-y-elegibilidad.sql', '05-pagos.sql', '06-libro.sql', '07-comercios.sql'):
        db.executescript(leer(os.path.join(V11, f)))
    db.executescript(mios('11-exclusividad.sql'))
    db.executescript(mios('13-retiros.sql'))
    for m in filter(None, os.environ.get('MUTAR', '').split(',')):
        tipo = db.execute("SELECT type FROM sqlite_master WHERE name=?", (m,)).fetchone()[0]
        db.execute(f'DROP {tipo.upper()} {m}')
    return db

def sentencia(archivo, origen=None):
    txt = re.sub(r'--[^\n]*', '', leer(origen or os.path.join(AQUI, archivo)))
    return [x.strip() for x in txt.split(';') if x.strip()]
def correr(db, archivo, params, origen=None):
    """Una acción. Devuelve filas afectadas o 'ERROR: …'. Sin BEGIN: la sentencia sola es atómica."""
    sts = sentencia(archivo, origen)
    try:
        filas = None
        for st in sts:
            q = re.sub(r'\?(\d)', lambda m: ':p' + m.group(1), st)
            c = db.execute(q, {f'p{k}': v for k, v in params.items() if f'?{k}' in st})
            filas = c.rowcount if filas is None else filas
        return filas
    except sqlite3.DatabaseError as e:
        return 'ERROR: ' + str(e)
def uno(db, q, p=()): r = db.execute(q, p).fetchone(); return r[0] if r else None
def inconsistencias(db): return db.execute('SELECT problema, referencia FROM inconsistencias_operaciones').fetchall()

ok = mal = 0
def caso(nombre, cond, grupo='SQLite'):
    global ok, mal
    print(('OK   ' if cond else 'FALLA'), f'[{grupo}]', nombre); ok += bool(cond); mal += (not cond)

def mundo(ruta=':memory:'):
    db = base(ruta)
    db.executescript("""
    INSERT INTO usuarios (id,correo,nombre,rol,clave_hash,fecha_nacimiento) VALUES
      ('a1','a1@x.com','Admin 1','admin','h',NULL),('a2','a2@x.com','Admin 2','admin','h',NULL),
      ('c1','c1@x.com','C1','repartidor','h','1990-01-01'),('c2','c2@x.com','C2','repartidor','h','1990-01-01'),
      ('c3','c3@x.com','C3','repartidor','h','1990-01-01'),
      ('cl','cl@x.com','Cliente','cliente','h','1990-01-01'),('du','du@x.com','Dueño','restaurante','h',NULL);
    INSERT INTO servicios_implementados (servicio_id, contrato) VALUES ('comida',1),('moto',1);
    INSERT INTO servicio_requisitos (servicio_id, requisito) VALUES
      ('moto','identidad'),('moto','antecedentes_pasajeros'),('moto','historial_manejo'),('moto','seguro_pasajeros');
    UPDATE servicios SET estado='disponible' WHERE id='moto';
    INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('moto','US-FL-MIAMI','proximamente');
    UPDATE servicios_zona SET estado='disponible' WHERE servicio_id='moto';
    INSERT INTO restaurantes (id,dueno_id,nombre,estado,abierto) VALUES ('r1','du','R','aprobado',1);
    """)
    for i, c in enumerate(('c1', 'c2', 'c3')):
        v = 'v' + c
        db.execute("INSERT INTO vehiculos (id,conductor_id,tipo,placa,placa_estado,estado) VALUES (?,?,'moto',?,'FL','aprobado')", (v, c, 'P' + c))
        db.execute("INSERT INTO repartidores (usuario_id,conectado,lat,lng,ubicacion_en,vehiculo_activo_id) VALUES (?,1,25.7,-80.1,datetime('now'),?)", (c, v))
        for r in ('identidad', 'antecedentes_pasajeros', 'historial_manejo'):
            db.execute("INSERT INTO cumplimientos (conductor_id,requisito,estado,fuente) VALUES (?,?,'aprobado','checkr')", (c, r))
        db.execute("INSERT INTO cumplimientos (conductor_id,vehiculo_id,requisito,estado,fuente,aprobado_por) VALUES (?,?,'seguro_pasajeros','aprobado','documento_vehiculo','a1')", (c, v))
        db.execute("INSERT INTO habilitaciones (conductor_id,servicio_id,estado,aprobado_por) VALUES (?,'moto','aprobada','a1')", (c,))
        db.execute("INSERT INTO preferencias_servicio (conductor_id,servicio_id,activa) VALUES (?,'moto',1)", (c,))
    return db

def viaje(db, op='o1', conductores=('c1', 'c2', 'c3')):
    db.execute("INSERT INTO operaciones (id,servicio_id,tipo_operacion,cliente_id,zona_id,estado_general) VALUES (?,'moto','viaje_pasajero','cl','US-FL-MIAMI','buscando')", (op,))
    db.execute("INSERT INTO viajes (operacion_id,estado,ultimo_actor,ultimo_actor_id,ultima_clave,origen_lat,origen_lng,origen_direccion,destino_lat,destino_lng,destino_direccion,pin_recogida) VALUES (?,'buscando','sistema',NULL,?, 1,1,'a',2,2,'b','1234')", (op, 'crear-' + op))
    for c in conductores: ofrecer(db, op, c)
def ofrecer(db, op, c):
    db.execute("INSERT INTO ofertas_operacion (operacion_id,conductor_id,vehiculo_id,estado,ganancia_centavos,expira_en) VALUES (?,?,?,'ofrecida',500,datetime('now','+45 seconds')) ON CONFLICT(operacion_id,conductor_id) DO UPDATE SET estado='ofrecida', vehiculo_id=excluded.vehiculo_id, expira_en=excluded.expira_en", (op, c, 'v' + c))
def aceptar(db, op, c, clave): return correr(db, 'aceptar-viaje.sql', {1: op, 2: c, 3: 'v' + c, 4: clave})
def respuesta(db, op, c, clave): return db.execute(re.sub(r'\?(\d)', lambda m: ':p' + m.group(1), sentencia('respuesta-aceptar.sql')[0]), {'p1': op, 'p2': c, 'p4': clave}).fetchone()
def transicion(db, op, nuevo, actor, actor_id, clave, esperado, motivo=''):
    return correr(db, 'cambiar-estado-viaje.sql', {1: op, 2: nuevo, 3: actor, 4: actor_id, 5: clave, 6: motivo, 7: esperado})
def liberar(db, op, c, clave, motivo='me bajo'): return correr(db, 'liberar-viaje.sql', {1: op, 2: c, 3: motivo, 4: clave})
def pedido(db, pid, estado='listo'):
    db.execute("""INSERT INTO pedidos (id,cliente_id,restaurante_id,estado,lineas_json,subtotal,envio,servicio,cargo_pequeno,propina,total,comision,pago_restaurante,pago_repartidor,complemento,ganancia,plan,direccion)
      VALUES (?,'cl','r1',?,'[]',1000,300,100,0,0,1400,100,900,300,0,100,'inicial','x')""", (pid, estado))
COMIDA = "UPDATE pedidos SET repartidor_id = ? WHERE id = ? AND repartidor_id IS NULL AND estado IN ('aceptado','listo')"
def comida(db, c, pid):
    try: return db.execute(COMIDA, (c, pid)).rowcount
    except sqlite3.DatabaseError as e: return 'ERROR: ' + str(e)
def _try(db, q):
    try: db.execute(q); return 'ok'
    except sqlite3.DatabaseError as e: return 'ERROR: ' + str(e)
def cuenta(db, q, p=()): return uno(db, 'SELECT COUNT(*) FROM ' + q, p)

# ============================ 1. Aceptación atómica ============================
print('== 1. Aceptación atómica y respuesta repetida')
db = mundo(); viaje(db)
caso('c1 acepta: 1 fila', aceptar(db, 'o1', 'c1', 'k1') == 1)
caso('la MISMA solicitud repetida (respuesta perdida): 0 filas y nada más ocurre', aceptar(db, 'o1', 'c1', 'k1') == 0)
caso('…la respuesta se decide con una lectura: «ya es tuya» y «misma solicitud»', respuesta(db, 'o1', 'c1', 'k1') == ('ya_es_tuya', 1))
caso('doble toque con OTRA clave: 0 filas, «ya es tuya», no es la misma solicitud', aceptar(db, 'o1', 'c1', 'k1b') == 0 and respuesta(db, 'o1', 'c1', 'k1b') == ('ya_es_tuya', 0))
caso('una sola asignación, un solo evento «asignado», una sola oferta aceptada, una sola ocupación',
     cuenta(db, 'asignaciones_operacion') == 1 and cuenta(db, "eventos_operacion WHERE estado_nuevo='asignado'") == 1
     and cuenta(db, "ofertas_operacion WHERE estado='aceptada'") == 1 and cuenta(db, 'conductor_ocupacion') == 1)
caso('ninguna operación financiera nace de aceptar (el cobro se autorizó al pedir)', cuenta(db, 'pagos_intentos') == 0 and cuenta(db, 'asientos') == 0)
caso('c2 intenta después: 0 filas y «otro conductor»', aceptar(db, 'o1', 'c2', 'k2') == 0 and respuesta(db, 'o1', 'c2', 'k2')[0] == 'otro_conductor')
caso('todo cuadra (0 inconsistencias)', inconsistencias(db) == [])

print('== 1b. Lo que pasaba con V1.1 si el batch NO fuera atómico (motivo del cambio)')
d11 = sqlite3.connect(':memory:', isolation_level=None); d11.execute('PRAGMA foreign_keys=ON')
d11.executescript(leer(os.path.join(RAIZ, 'schema.sql')))
v1 = re.findall(r"```sql\n(.*?)```", leer(os.path.join(RAIZ, 'docs', 'ARQUITECTURA-MULTISERVICIO-V1.md')), re.S)
d11.executescript(v1[0]); d11.executescript(v1[1])
for t in ('compra_lineas', 'compras', 'viajes', 'libro_movimientos'): d11.execute(f'DROP TABLE {t}')
d11.execute('ALTER TABLE repartidores ADD COLUMN vehiculo_activo_id TEXT REFERENCES vehiculos(id)')
for f in ('01-requisitos-y-elegibilidad.sql', '03-exclusividad.sql', '04-estados-de-viaje.sql'): d11.executescript(leer(os.path.join(V11, f)))
d11.executescript("""INSERT INTO usuarios (id,correo,nombre,rol,clave_hash) VALUES ('c1','c1@x','C1','repartidor','h'),('cl','cl@x','Cl','cliente','h');
INSERT INTO vehiculos (id,conductor_id,tipo,placa,placa_estado,estado) VALUES ('vc1','c1','moto','P1','FL','aprobado');
INSERT INTO operaciones (id,servicio_id,tipo_operacion,cliente_id,conductor_id,vehiculo_id,zona_id,estado_general) VALUES ('o1','moto','viaje_pasajero','cl',NULL,NULL,'US-FL-MIAMI','buscando');
INSERT INTO viajes (operacion_id,estado,origen_lat,origen_lng,origen_direccion,destino_lat,destino_lng,destino_direccion,pin_recogida) VALUES ('o1','buscando',1,1,'a',2,2,'b','1234');
INSERT INTO asignaciones_operacion (operacion_id,conductor_id,vehiculo_id) VALUES ('o1','c1','vc1');
UPDATE operaciones SET conductor_id='c1', vehiculo_id='vc1' WHERE id='o1';
INSERT INTO contexto_transicion (operacion_id,actor,actor_id) VALUES ('o1','conductor','c1'); UPDATE viajes SET estado='asignado' WHERE operacion_id='o1';""")
sts11 = sentencia(None, os.path.join(V11, 'aceptar-viaje.sql'))
for st in sts11:  # cada sentencia por separado, como si el batch no fuera una transacción
    try: d11.execute(re.sub(r'\?(\d)', lambda m: ':p' + m.group(1), st), {k: v for k, v in {'p1': 'o1', 'p2': 'c1', 'p3': 'vc1', 'p4': 'k-repetida'}.items() if '?' + k[1:] in st})
    except sqlite3.DatabaseError: pass
caso('V1.1 sin atomicidad: la aceptación repetida deja un contexto colgado', uno(d11, "SELECT COUNT(*) FROM contexto_transicion") == 1, 'SQLite · V1.1')
try: d11.execute("INSERT INTO contexto_transicion (operacion_id,actor) VALUES ('o1','cliente')"); d11.execute("UPDATE viajes SET estado='cancelado' WHERE operacion_id='o1'"); bloqueado = False
except sqlite3.DatabaseError: bloqueado = True
caso('…y el pasajero ya no puede cancelar (queda trabado): por eso V1.2 quita contexto_transicion', bloqueado, 'SQLite · V1.1')

# ============================ 2. Contexto y transiciones ============================
print('== 2. Transiciones: reintentos, duplicados, fuera de orden')
db = mundo(); viaje(db); aceptar(db, 'o1', 'c1', 'k1')
caso('llegó: 1 fila', transicion(db, 'o1', 'conductor_llego', 'conductor', 'c1', 'k-llego', 'asignado') == 1)
caso('el mismo «llegó» repetido (reintento): 0 filas, sin segundo evento', transicion(db, 'o1', 'conductor_llego', 'conductor', 'c1', 'k-llego', 'asignado') == 0 and cuenta(db, "eventos_operacion WHERE estado_nuevo='conductor_llego'") == 1)
caso('terminar sin haber iniciado (fuera de orden): la base lo rechaza', str(transicion(db, 'o1', 'terminado', 'conductor', 'c1', 'k-fin', 'conductor_llego')).startswith('ERROR'))
caso('iniciar reusando la clave de «llegó»: la base lo rechaza (clave no nueva)', 'transicion_sin_clave_nueva' in str(transicion(db, 'o1', 'en_curso', 'conductor', 'c1', 'k-llego', 'conductor_llego')))
caso('el pasajero no puede iniciar el viaje (actor no permitido)', str(transicion(db, 'o1', 'en_curso', 'cliente', 'cl', 'k-x', 'conductor_llego')).startswith('ERROR'))
caso('cambiar el actor sin cambiar el estado: rechazado', 'actor_sin_transicion' in _try(db, "UPDATE viajes SET ultimo_actor='cliente', ultima_clave='zz' WHERE operacion_id='o1'"))
caso('escribir la cabecera a mano en contra del viaje: rechazado', 'estado_general_incoherente' in _try(db, "UPDATE operaciones SET estado_general='terminada' WHERE id='o1'"))
caso('pasar el viaje de un conductor a otro a mano: rechazado', 'cambio_de_conductor_no_permitido' in _try(db, "UPDATE operaciones SET conductor_id='c2' WHERE id='o1'"))
caso('iniciar y terminar en orden: 1 y 1', transicion(db, 'o1', 'en_curso', 'conductor', 'c1', 'k-ini', 'conductor_llego') == 1 and transicion(db, 'o1', 'terminado', 'conductor', 'c1', 'k-fin', 'en_curso') == 1)
caso('al terminar: asignación «completada», conductor libre, cuatro eventos con claves distintas',
     uno(db, "SELECT resultado FROM asignaciones_operacion") == 'completada' and cuenta(db, 'conductor_ocupacion') == 0
     and cuenta(db, 'eventos_operacion') == 4 and uno(db, 'SELECT COUNT(DISTINCT idempotencia) FROM eventos_operacion') == 4)
caso('todo cuadra', inconsistencias(db) == [])

print('== 2b. Error en un paso intermedio y transacción revertida')
db = mundo(); viaje(db)
db.execute("CREATE TRIGGER falla_a_proposito BEFORE INSERT ON asignaciones_operacion BEGIN SELECT RAISE(ABORT,'fallo_simulado'); END")
r = aceptar(db, 'o1', 'c1', 'k1')
caso('si falla un efecto dentro de la aceptación, la sentencia entera se deshace', 'fallo_simulado' in str(r))
caso('…nada quedó a medias: sin conductor, viaje buscando, ofertas intactas, sin ocupación, sin eventos',
     uno(db, "SELECT conductor_id FROM operaciones") is None and uno(db, "SELECT estado FROM viajes") == 'buscando'
     and cuenta(db, "ofertas_operacion WHERE estado='ofrecida'") == 3 and cuenta(db, 'conductor_ocupacion') == 0 and cuenta(db, 'eventos_operacion') == 0)
db.execute('DROP TRIGGER falla_a_proposito')
caso('…y se puede volver a intentar con la misma clave', aceptar(db, 'o1', 'c1', 'k1') == 1 and inconsistencias(db) == [])

print('== 2c. Recuperación después de una interrupción (el proceso muere en medio)')
ruta = tempfile.mktemp(suffix='.db'); d = mundo(ruta); viaje(d); d.close()
p = sqlite3.connect(ruta, isolation_level=None); p.execute('PRAGMA foreign_keys=ON')
p.execute('BEGIN'); aceptar(p, 'o1', 'c1', 'k1'); p.close()   # se cierra SIN confirmar: como un corte
d = sqlite3.connect(ruta, isolation_level=None); d.execute('PRAGMA foreign_keys=ON')
caso('al volver, la aceptación interrumpida no dejó rastro', uno(d, "SELECT conductor_id FROM operaciones") is None and cuenta(d, 'eventos_operacion') == 0)
caso('…y se reintenta sin problema', aceptar(d, 'o1', 'c1', 'k1') == 1 and inconsistencias(d) == [])

# ============================ 1c / 3. Concurrencia ============================
print('== 3. Aceptación simultánea de dos conductores (dos conexiones a la misma base)')
ruta = tempfile.mktemp(suffix='.db'); d = mundo(ruta); viaje(d); d.close()
A = sqlite3.connect(ruta, isolation_level=None, timeout=0); B = sqlite3.connect(ruta, isolation_level=None, timeout=0)
for x in (A, B): x.execute('PRAGMA foreign_keys=ON')
A.execute('BEGIN IMMEDIATE'); ra = aceptar(A, 'o1', 'c1', 'kA')
try: B.execute('BEGIN IMMEDIATE'); espera = False
except sqlite3.OperationalError: espera = True
A.execute('COMMIT'); rb = aceptar(B, 'o1', 'c2', 'kB')
caso('la segunda escritura espera a la primera', espera)
caso('gana una sola (1 y 0), y la otra recibe «otro conductor»', ra == 1 and rb == 0 and respuesta(B, 'o1', 'c2', 'kB')[0] == 'otro_conductor')

print('== 4. Cancelación durante una aceptación (los dos órdenes posibles)')
db = mundo(); viaje(db)
transicion(db, 'o1', 'cancelado', 'cliente', 'cl', 'k-cancel', 'buscando')
caso('primero cancela el pasajero: la aceptación posterior da 0 y «no disponible»', aceptar(db, 'o1', 'c1', 'k1') == 0 and respuesta(db, 'o1', 'c1', 'k1')[0] == 'no_disponible')
db = mundo(); viaje(db); aceptar(db, 'o1', 'c1', 'k1')
caso('primero acepta y luego cancela: asignación «cancelada», conductor libre, todo cuadra',
     transicion(db, 'o1', 'cancelado', 'cliente', 'cl', 'k-cancel', 'asignado') == 1 and uno(db, 'SELECT resultado FROM asignaciones_operacion') == 'cancelada'
     and cuenta(db, 'conductor_ocupacion') == 0 and inconsistencias(db) == [])

print('== 5. Liberación y reasignación')
db = mundo(); viaje(db); aceptar(db, 'o1', 'c1', 'k1')
caso('c1 se baja: el viaje vuelve a buscar sin conductor', liberar(db, 'o1', 'c1', 'k-lib') == 1 and db.execute("SELECT v.estado, o.estado_general, o.conductor_id FROM viajes v JOIN operaciones o ON o.id=v.operacion_id").fetchone() == ('buscando', 'buscando', None))
caso('…la liberación repetida no hace nada (0)', liberar(db, 'o1', 'c1', 'k-lib') == 0)
caso('…c2 ya tenía su oferta retirada: no puede aceptar sin oferta nueva', aceptar(db, 'o1', 'c2', 'k2') == 0)
ofrecer(db, 'o1', 'c2')
caso('…con oferta nueva, c2 la toma', aceptar(db, 'o1', 'c2', 'k2') == 1)
caso('…dos asignaciones en la historia, una abierta, de c2; eventos con claves distintas; todo cuadra',
     cuenta(db, 'asignaciones_operacion') == 2 and uno(db, 'SELECT conductor_id FROM asignaciones_operacion WHERE fin IS NULL') == 'c2'
     and uno(db, "SELECT resultado FROM asignaciones_operacion WHERE conductor_id='c1'") == 'liberada_conductor'
     and uno(db, 'SELECT COUNT(*) - COUNT(DISTINCT idempotencia) FROM eventos_operacion') == 0 and inconsistencias(db) == [])
caso('una segunda asignación abierta para el mismo viaje es imposible (defensa extra)', 'UNIQUE' in _try(db, "INSERT INTO asignaciones_operacion (operacion_id, conductor_id, vehiculo_id, clave) VALUES ('o1','c3','vc3','k-otra')"))
caso('c1 no puede liberar un viaje que ya no es suyo', liberar(db, 'o1', 'c1', 'k-lib2') == 0)

# ============================ 3. Exclusividad con el código real de comida ============================
print('== 6. Exclusividad comida ↔ viaje con las rutas reales de comida')
db = mundo(); viaje(db); pedido(db, 'p1'); pedido(db, 'p2')
comida(db, 'c1', 'p1'); comida(db, 'c1', 'p2')
caso('dos pedidos agrupados: una ocupación con 2', db.execute("SELECT tipo,pedidos FROM conductor_ocupacion WHERE conductor_id='c1'").fetchone() == ('comida', 2))
caso('con comida, aceptar un viaje: error y nada cambia', str(aceptar(db, 'o1', 'c1', 'k1')).startswith('ERROR') and uno(db, "SELECT conductor_id FROM operaciones") is None)
db.execute("UPDATE pedidos SET estado='cancelado', cancelado_en=datetime('now') WHERE id='p1' AND estado='listo'")   # manager.ts:70
caso('el Manager cancela uno: queda 1', uno(db, "SELECT pedidos FROM conductor_ocupacion WHERE conductor_id='c1'") == 1)
db.execute("UPDATE pedidos SET estado='listo', cancelado_en=NULL WHERE id='p1' AND estado='cancelado'")             # manager.ts:100 (Stripe falló)
caso('el Manager REVIERTE la cancelación (Stripe falló): vuelve a 2 (caso nuevo de V1.2)', uno(db, "SELECT pedidos FROM conductor_ocupacion WHERE conductor_id='c1'") == 2 and inconsistencias(db) == [])
db.execute("UPDATE pedidos SET repartidor_id = NULL WHERE id = 'p1' AND repartidor_id = 'c1' AND estado IN ('aceptado','listo')")  # soltarPedido
db.execute("UPDATE pedidos SET estado='en_camino' WHERE id='p2'"); db.execute("UPDATE pedidos SET estado='entregado' WHERE id='p2'")
caso('soltar uno y entregar el otro: libre y todo cuadra', cuenta(db, 'conductor_ocupacion') == 0 and inconsistencias(db) == [])
caso('ahora sí puede aceptar el viaje', aceptar(db, 'o1', 'c1', 'k1') == 1)
caso('en el viaje, la consulta ACTUAL de comida es rechazada por la base', 'conductor_ocupado_en_otra_operacion' in str(comida(db, 'c1', 'p1')))
db2 = mundo(); viaje(db2); pedido(db2, 'p1', 'listo'); comida(db2, 'c1', 'p1')
db2.execute("UPDATE pedidos SET estado='cancelado', cancelado_en=datetime('now') WHERE id='p1' AND estado='listo'")   # manager.ts:70
caso('el Manager cancela el pedido de c1: c1 queda libre', cuenta(db2, "conductor_ocupacion WHERE conductor_id='c1'") == 0)
caso('…c1 toma un viaje', aceptar(db2, 'o1', 'c1', 'k1') == 1)
caso('…y si el Manager REVIERTE la cancelación (Stripe falló), la base aborta: c1 no queda con pedido y viaje a la vez',
     'conductor_ocupado_en_otra_operacion' in _try(db2, "UPDATE pedidos SET estado='listo', cancelado_en=NULL WHERE id='p1' AND estado='cancelado'"))
db3 = mundo(); viaje(db3); pedido(db3, 'p1'); comida(db3, 'c2', 'p1'); aceptar(db3, 'o1', 'c1', 'k1')
caso('pasar un pedido de c2 a c1 (que está en un viaje) directamente: la base aborta', 'conductor_ocupado_en_otra_operacion' in _try(db3, "UPDATE pedidos SET repartidor_id='c1' WHERE id='p1'"))
caso('pasar un pedido de c2 a c3 (libre) directamente: la ocupación se mueve y cuadra', _try(db3, "UPDATE pedidos SET repartidor_id='c3' WHERE id='p1'") == 'ok' and inconsistencias(db3) == [])
db4 = mundo(); pedido(db4, 'p1')
db4.execute("UPDATE pedidos SET repartidor_id='c2' WHERE id='p1'")
db4.execute("UPDATE pedidos SET estado='cancelado', repartidor_id=NULL WHERE id='p1'")
caso('cancelar y quitar el repartidor en la misma sentencia: se descuenta una sola vez', cuenta(db4, 'conductor_ocupacion') == 0 and inconsistencias(db4) == [])

print('== 7. Migración con repartidores que tienen pedidos activos')
dm = sqlite3.connect(':memory:', isolation_level=None); dm.execute('PRAGMA foreign_keys=ON')
dm.executescript(leer(os.path.join(RAIZ, 'schema.sql')))
dm.executescript("""INSERT INTO usuarios (id,correo,nombre,rol,clave_hash) VALUES ('c1','c1@x','C1','repartidor','h'),('c2','c2@x','C2','repartidor','h'),('cl','cl@x','Cl','cliente','h'),('du','du@x','D','restaurante','h');
INSERT INTO restaurantes (id,dueno_id,nombre,estado,abierto) VALUES ('r1','du','R','aprobado',1);""")
for pid, est in (('p1', 'listo'), ('p2', 'en_camino'), ('p3', 'aceptado'), ('p4', 'entregado')): pedido(dm, pid, est)
dm.execute("UPDATE pedidos SET repartidor_id='c1' WHERE id IN ('p1','p2')"); dm.execute("UPDATE pedidos SET repartidor_id='c2' WHERE id IN ('p3','p4')")
# migración: tablas nuevas + llenado + disparadores, en UNA transacción
v1b = re.findall(r"```sql\n(.*?)```", leer(os.path.join(RAIZ, 'docs', 'ARQUITECTURA-MULTISERVICIO-V1.md')), re.S)
dm.executescript(v1b[0]); dm.executescript(v1b[1])
for t in ('compra_lineas', 'compras', 'viajes', 'libro_movimientos', 'operaciones'): dm.execute(f'DROP TABLE {t}')
dm.execute('ALTER TABLE repartidores ADD COLUMN vehiculo_activo_id TEXT REFERENCES vehiculos(id)')
dm.executescript(mios('10-operaciones-y-viajes.sql'))
ex = mios('11-exclusividad.sql'); corte = ex.index('-- Comida (tabla existente')
dm.executescript(ex[:corte])                                   # (1) la tabla
dm.executescript(sentencia('12-migracion-ocupacion.sql')[0])   # (2) llenado con los pedidos activos
dm.executescript(ex[corte:])                                   # (3) disparadores
caso('después de migrar: c1 con 2 pedidos, c2 con 1 (el entregado no cuenta), 0 inconsistencias',
     dict(dm.execute("SELECT conductor_id, pedidos FROM conductor_ocupacion").fetchall()) == {'c1': 2, 'c2': 1} and inconsistencias(dm) == [])
dm.execute("UPDATE pedidos SET estado='entregado' WHERE id='p2'"); dm.execute("UPDATE pedidos SET repartidor_id=NULL WHERE id='p3'")
caso('los pedidos que ya estaban en curso se cierran bien con los disparadores', dict(dm.execute("SELECT conductor_id, pedidos FROM conductor_ocupacion").fetchall()) == {'c1': 1} and inconsistencias(dm) == [])

print('== 8. Prueba aleatoria: miles de acciones mezcladas y la base siempre cuadra')
random.seed(20261015)
db = mundo()
for i in range(4): viaje(db, f'o{i}')
for i in range(4): pedido(db, f'p{i}', random.choice(['aceptado', 'listo']))
cond = ['c1', 'c2', 'c3']; ops = [f'o{i}' for i in range(4)]; peds = [f'p{i}' for i in range(4)]
acciones = errores = 0; ruptura = None
for n in range(4000):
    a = random.randrange(10); c = random.choice(cond); o = random.choice(ops); p = random.choice(peds); k = uuid.uuid4().hex
    est = uno(db, 'SELECT estado FROM viajes WHERE operacion_id=?', (o,))
    cnd = uno(db, 'SELECT conductor_id FROM operaciones WHERE id=?', (o,))
    if a == 0: ofrecer(db, o, c); r = 'ok'
    elif a == 1: r = aceptar(db, o, c, k)
    elif a == 2: r = liberar(db, o, cnd or c, k)
    elif a == 3: r = transicion(db, o, 'conductor_llego', 'conductor', cnd, k, 'asignado')
    elif a == 4: r = transicion(db, o, 'en_curso', 'conductor', cnd, k, 'conductor_llego')
    elif a == 5: r = transicion(db, o, 'terminado', 'conductor', cnd, k, 'en_curso')
    elif a == 6: r = transicion(db, o, 'cancelado', random.choice(['cliente', 'soporte']), None, k, est)
    elif a == 7: r = comida(db, c, p)
    elif a == 8: r = _try(db, f"UPDATE pedidos SET repartidor_id = NULL WHERE id = '{p}' AND estado IN ('aceptado','listo')")
    else:
        r = _try(db, f"UPDATE pedidos SET estado = CASE estado WHEN 'listo' THEN 'en_camino' WHEN 'en_camino' THEN 'entregado' WHEN 'aceptado' THEN 'listo' ELSE estado END WHERE id = '{p}' AND repartidor_id IS NOT NULL")
    # reciclar: lo terminado vuelve a empezar como un pedido o viaje nuevo
    if est in ('terminado', 'cancelado', 'no_show', 'sin_conductor') and random.random() < 0.3:
        nuevo = 'o' + uuid.uuid4().hex[:8]; ops.append(nuevo); viaje(db, nuevo); ops.remove(o)
    if uno(db, 'SELECT estado FROM pedidos WHERE id=?', (p,)) in ('entregado', 'cancelado') and random.random() < 0.3:
        nuevo = 'p' + uuid.uuid4().hex[:8]; pedido(db, nuevo, random.choice(['aceptado', 'listo'])); peds.append(nuevo); peds.remove(p)
    acciones += 1; errores += str(r).startswith('ERROR')
    inc = inconsistencias(db)
    if inc: ruptura = (n, a, inc); break
caso(f'{acciones} acciones al azar ({errores} rechazadas por la base): 0 inconsistencias en todo momento', ruptura is None and acciones == 4000)
if ruptura: print('   primera ruptura:', ruptura)
caso('…nunca un conductor con dos cosas a la vez', uno(db, "SELECT COUNT(*) FROM (SELECT conductor_id FROM conductor_ocupacion GROUP BY conductor_id HAVING COUNT(*) > 1)") == 0)

# ============================ 4. Retiros ============================
print('== 9. Retiros: pedir sin pasarse del saldo [SQLite]')
db = mundo()
db.execute("INSERT INTO cuentas_stripe (usuario_id, stripe_cuenta, pagos_activos) VALUES ('c1','acct_c1',1)")
def acreditar(db, uid, monto, clave):
    db.execute("INSERT INTO asientos (id, clave_evento, tipo) VALUES (?, ?, 'liquidacion')", ('s-' + clave, clave))
    db.execute("INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES (?, 'billetera', ?, ?)", ('s-' + clave, uid, monto))
    db.execute("INSERT INTO apuntes (asiento_id, cuenta, usuario_id, monto) VALUES (?, 'stripe_cobrado', NULL, ?)", ('s-' + clave, -monto))
    db.execute("UPDATE asientos SET estado='cerrado' WHERE id=?", ('s-' + clave,))
acreditar(db, 'c1', 1000, 'pedido:x:entrega')
def saldo(db, u='c1'): return uno(db, 'SELECT COALESCE((SELECT saldo FROM saldos_billetera WHERE usuario_id=?),0)', (u,))
def pedir(db, iid, monto, u='c1'): return correr(db, 'pedir-retiro.sql', {1: iid, 2: u, 3: monto})
caso('pedir 10.00 con 10.00 de saldo: 1 intento y el saldo baja a 0 en la misma sentencia', pedir(db, 'w1', 1000) == 1 and saldo(db) == 0)
caso('pedir otra vez: 0 (no hay saldo)', pedir(db, 'w2', 1000) == 0 and cuenta(db, 'pagos_intentos') == 1)
ruta = tempfile.mktemp(suffix='.db'); d = mundo(ruta); d.execute("INSERT INTO cuentas_stripe VALUES ('c1','acct_c1',1,datetime('now'))"); acreditar(d, 'c1', 1000, 'k'); d.close()
A = sqlite3.connect(ruta, isolation_level=None, timeout=5); B = sqlite3.connect(ruta, isolation_level=None, timeout=5)
for x in (A, B): x.execute('PRAGMA foreign_keys=ON')
ra = pedir(A, 'wa', 800); rb = pedir(B, 'wb', 800)
caso('dos retiros de 8.00 a la vez con 10.00: pasa uno solo', sorted([ra, rb]) == [0, 1] and saldo(A) == 200)

print('== 10. Retiros con Stripe simulado: respuesta perdida, reintentos, avisos, interrupción [Stripe simulado]')
class Red(Exception): pass
class Stripe:
    """Imita la documentación oficial de Stripe (API v1)."""
    def __init__(s): s.transfer = {}; s.cache = {}; s.eventos = []; s.falla = []; s.n = 0
    def post_transfer(s, clave, monto, destino, grupo, intento):
        modo = s.falla.pop(0) if s.falla else 'ok'
        if modo == 'red_antes': raise Red('no llegó a Stripe')
        if clave in s.cache:                               # misma clave: misma respuesta guardada
            st, cuerpo = s.cache[clave]
        elif modo == 'rechazo':
            st, cuerpo = 400, {'error': {'message': 'Insufficient funds in Stripe account'}}; s.cache[clave] = (st, cuerpo)
        else:
            s.n += 1; tid = f'tr_{s.n}'
            s.transfer[tid] = {'id': tid, 'amount': monto, 'destination': destino, 'transfer_group': grupo, 'metadata': {'intento_id': intento}}
            s.eventos.append({'id': f'evt_{s.n}', 'type': 'transfer.created', 'data': {'object': s.transfer[tid]}})
            st, cuerpo = (500, {'error': {'message': 'unknown'}}) if modo == '500' else (200, s.transfer[tid])
            s.cache[clave] = (st, cuerpo)
        if modo in ('perder', 'perder_y_ok') and st == 200: raise Red('respuesta perdida')
        return st, cuerpo
    def listar(s, grupo):
        modo = s.falla.pop(0) if s.falla and s.falla[0] == 'red_lista' else 'ok'
        if modo == 'red_lista': raise Red('sin conexión al verificar')
        return [t for t in s.transfer.values() if t['transfer_group'] == grupo]
    def podar(s): s.cache.clear()                          # «pueden borrarse después de 24 h»

MAX_INTENTOS = 8
def confirmar(db, iid, tid):
    db.execute("UPDATE pagos_intentos SET estado='confirmado', stripe_objeto=?, actualizado_en=datetime('now') WHERE id=? AND estado IN ('pendiente','enviando','reintentar')", (tid, iid))
def procesar(db, stripe, iid, morir_tras_reclamo=False):
    """El proceso propuesto (en el servidor sería TypeScript; aquí el mismo algoritmo)."""
    r = db.execute("UPDATE pagos_intentos SET estado='enviando', intentos=intentos+1, enviando_desde=datetime('now') WHERE id=? AND (estado IN ('pendiente','reintentar') OR (estado='enviando' AND enviando_desde < datetime('now','-5 minutes'))) AND proximo_intento_en <= datetime('now')", (iid,))
    if r.rowcount == 0: return 'no_reclamado'
    if morir_tras_reclamo: return 'murio'
    i = db.execute('SELECT clave_idempotencia, monto_centavos, usuario_id, intentos FROM pagos_intentos WHERE id=?', (iid,)).fetchone()
    clave, monto, uid, n = i
    destino = uno(db, 'SELECT stripe_cuenta FROM cuentas_stripe WHERE usuario_id=?', (uid,))
    def verificar():
        hallado = stripe.listar(clave)
        if hallado: confirmar(db, iid, hallado[0]['id']); return True
        return False
    try:
        if n > 1 and verificar(): return 'confirmado_por_verificacion'
        st, cuerpo = stripe.post_transfer(clave, monto, destino, clave, iid)
        if st == 200: confirmar(db, iid, cuerpo['id']); return 'confirmado'
        if st in (400, 402, 403, 404):
            if verificar(): return 'confirmado_por_verificacion'
            db.execute("UPDATE pagos_intentos SET estado='fallido', ultimo_error=? WHERE id=?", (cuerpo['error']['message'], iid)); return 'fallido'
        raise Red(f'Stripe {st}')
    except Red as e:
        try:
            if verificar(): return 'confirmado_por_verificacion'
        except Red: pass
        nuevo = 'revision' if n >= MAX_INTENTOS else 'reintentar'
        db.execute(f"UPDATE pagos_intentos SET estado=?, ultimo_error=?, proximo_intento_en=datetime('now') WHERE id=?", (nuevo, str(e), iid))
        return nuevo
def aviso(db, ev):
    """Receptor de avisos: deduplica por id de evento (avisos_stripe, existe hoy) y confirma."""
    if db.execute('INSERT OR IGNORE INTO avisos_stripe (id, tipo) VALUES (?, ?)', (ev['id'], ev['type'])).rowcount == 0: return 'duplicado'
    t = ev['data']['object']; iid = t['metadata'].get('intento_id')
    estado = uno(db, 'SELECT estado FROM pagos_intentos WHERE id=?', (iid,))
    if estado == 'fallido':
        db.execute("UPDATE pagos_intentos SET estado='revision' WHERE id=? AND estado='fallido'", (iid,)); return 'alerta'
    confirmar(db, iid, t['id']); return 'confirmado'
def escenario(fallas):
    db = mundo(); db.execute("INSERT INTO cuentas_stripe VALUES ('c1','acct_c1',1,datetime('now'))"); acreditar(db, 'c1', 1000, 'pedido:x:entrega')
    s = Stripe(); s.falla = list(fallas); pedir(db, 'w1', 1000); return db, s
def estado_w(db): return uno(db, "SELECT estado FROM pagos_intentos WHERE id='w1'")

db, s = escenario(['perder'])
r1 = procesar(db, s, 'w1')
caso('Stripe transfiere y se pierde la respuesta: la verificación por transfer_group lo encuentra y confirma', r1 == 'confirmado_por_verificacion' and estado_w(db) == 'confirmado', 'Stripe simulado')
caso('…UNA sola transferencia y el saldo NO vuelve (0)', len(s.transfer) == 1 and saldo(db) == 0, 'Stripe simulado')
caso('…el conductor no puede volver a retirar ese dinero', pedir(db, 'w2', 1000) == 0, 'Stripe simulado')

db, s = escenario(['perder', 'red_lista'])
r1 = procesar(db, s, 'w1'); r2 = procesar(db, s, 'w1')
caso('respuesta perdida y además falla la verificación: queda «reintentar», nunca devuelve saldo', r1 == 'reintentar' and saldo(db) == 0, 'Stripe simulado')
caso('…el reintento encuentra la transferencia y confirma sin crear otra', r2 == 'confirmado_por_verificacion' and len(s.transfer) == 1, 'Stripe simulado')

db, s = escenario(['red_antes'])
r1 = procesar(db, s, 'w1'); r2 = procesar(db, s, 'w1')
caso('la llamada no llegó a Stripe: reintentar y luego una sola transferencia', (r1, r2) == ('reintentar', 'confirmado') and len(s.transfer) == 1, 'Stripe simulado')

db, s = escenario(['500'])
r1 = procesar(db, s, 'w1')
caso('Stripe responde 500 pero sí transfirió: se verifica y se confirma (no se devuelve saldo)', r1 == 'confirmado_por_verificacion' and saldo(db) == 0 and len(s.transfer) == 1, 'Stripe simulado')

db, s = escenario(['rechazo'])
r1 = procesar(db, s, 'w1')
caso('rechazo definitivo de Stripe: «fallido» y el saldo vuelve UNA vez', r1 == 'fallido' and saldo(db) == 1000 and len(s.transfer) == 0, 'Stripe simulado')
caso('…procesarlo otra vez no devuelve nada más', procesar(db, s, 'w1') == 'no_reclamado' and saldo(db) == 1000, 'Stripe simulado')

db, s = escenario(['ok'])
procesar(db, s, 'w1'); ev = s.eventos[0]
caso('aviso transfer.created duplicado: se procesa una vez', aviso(db, ev) == 'confirmado' and aviso(db, ev) == 'duplicado' and estado_w(db) == 'confirmado', 'Stripe simulado')

db, s = escenario(['perder'])
s.falla = ['perder']; tid = None
try: s.post_transfer('retiro:w1', 1000, 'acct_c1', 'retiro:w1', 'w1')
except Red: pass
db.execute("UPDATE pagos_intentos SET estado='enviando', intentos=1, enviando_desde=datetime('now') WHERE id='w1'")
caso('el aviso llega ANTES que la respuesta: confirma', aviso(db, s.eventos[0]) == 'confirmado' and estado_w(db) == 'confirmado', 'Stripe simulado')
caso('…y el proceso que venía atrás no hace nada', procesar(db, s, 'w1') == 'no_reclamado' and len(s.transfer) == 1, 'Stripe simulado')

db, s = escenario([])
caso('el proceso muere justo después de reclamar el intento', procesar(db, s, 'w1', morir_tras_reclamo=True) == 'murio' and estado_w(db) == 'enviando', 'Stripe simulado')
caso('…otro proceso no lo toca mientras no pasen 5 minutos', procesar(db, s, 'w1') == 'no_reclamado', 'Stripe simulado')
db.execute("UPDATE pagos_intentos SET enviando_desde=datetime('now','-6 minutes') WHERE id='w1'")
caso('…pasados 5 minutos el reloj lo recupera y transfiere una sola vez', procesar(db, s, 'w1') == 'confirmado' and len(s.transfer) == 1, 'Stripe simulado')

db, s = escenario(['perder'])
s.falla = ['perder']
try: s.post_transfer('retiro:w1', 1000, 'acct_c1', 'retiro:w1', 'w1')
except Red: pass
db.execute("UPDATE pagos_intentos SET estado='reintentar', intentos=3 WHERE id='w1'")
s.podar()   # pasaron más de 24 h: la clave ya no protege
caso('clave de idempotencia borrada por Stripe (más de 24 h): la verificación evita la segunda transferencia', procesar(db, s, 'w1') == 'confirmado_por_verificacion' and len(s.transfer) == 1, 'Stripe simulado')

db, s = escenario(['red_antes'] * 20 + ['red_lista'] * 20)
for _ in range(MAX_INTENTOS): r = procesar(db, s, 'w1')
caso(f'tras {MAX_INTENTOS} intentos dudosos pasa a «revision» (soporte) y el saldo sigue descontado', estado_w(db) == 'revision' and saldo(db) == 0, 'Stripe simulado')

db, s = escenario(['ok'])
procesar(db, s, 'w1')
caso('un proceso atrasado intenta marcar «fallido» un retiro ya confirmado: la base lo impide y el saldo no vuelve',
     'pago_confirmado_no_cambia' in _try(db, "UPDATE pagos_intentos SET estado='fallido' WHERE id='w1'") and saldo(db) == 0, 'Stripe simulado')

print('== 11. Reconciliación diaria de retiros contra Stripe [Stripe simulado]')
db, s = escenario(['perder', 'red_lista', 'red_lista'])
procesar(db, s, 'w1')
db.execute("UPDATE pagos_intentos SET estado='revision' WHERE id='w1'")
s.falla = []   # al día siguiente la red está bien
pendientes = db.execute("SELECT id, clave_idempotencia FROM pagos_intentos WHERE accion='transferir' AND estado IN ('enviando','reintentar','revision')").fetchall()
for iid, clave in pendientes:
    t = s.listar(clave)
    if t: db.execute("UPDATE pagos_intentos SET estado='confirmado', stripe_objeto=? WHERE id=?", (t[0]['id'], iid))
caso('la reconciliación encuentra en Stripe el retiro dudoso y lo confirma; el libro y Stripe coinciden',
     estado_w(db) == 'confirmado' and len(s.transfer) == 1 and uno(db, "SELECT SUM(monto_centavos) FROM pagos_intentos WHERE estado='confirmado' AND accion='transferir'") == sum(t['amount'] for t in s.transfer.values()), 'Stripe simulado')

print(f'\n{ok} pruebas bien, {mal} mal')
sys.exit(1 if mal else 0)

"""
Pruebas reproducibles de ARQUITECTURA-MULTISERVICIO-V1.1 (solo diseño: no toca la base real).
Arma una base SQLite EN MEMORIA con el schema.sql actual + el SQL de V1 + el SQL de V1.1 y
comprueba cada punto. Uso:  python3 docs/arquitectura-v1.1/probar.py
Comprobar en rojo:  MUTAR=<nombre de un disparador o índice> python3 docs/arquitectura-v1.1/probar.py
"""
import re, sqlite3, sys, os
AQUI=os.path.dirname(os.path.abspath(__file__))
RAIZ=os.path.abspath(os.path.join(AQUI,'..','..'))
def leer(n): return open(os.path.join(AQUI,n)).read()
def base():
    db=sqlite3.connect(':memory:', isolation_level=None); db.execute('PRAGMA foreign_keys=ON')
    db.executescript(open(RAIZ+'/schema.sql').read())
    v1=re.findall(r"```sql\n(.*?)```", open(RAIZ+'/docs/ARQUITECTURA-MULTISERVICIO-V1.md').read(), re.S)
    db.executescript(v1[0]); db.executescript(v1[1])
    # V1.1 reemplaza estas tablas de V1 (no existen en producción).
    for t in ('compra_lineas','compras','viajes','libro_movimientos'): db.execute(f'DROP TABLE {t}')
    db.execute('ALTER TABLE repartidores ADD COLUMN vehiculo_activo_id TEXT REFERENCES vehiculos(id)')
    for f in ('01-requisitos-y-elegibilidad.sql','03-exclusividad.sql','04-estados-de-viaje.sql','05-pagos.sql','06-libro.sql','07-comercios.sql'): db.executescript(leer(f))
    for m in filter(None, os.environ.get('MUTAR','').split(',')):
        tipo=db.execute("SELECT type FROM sqlite_master WHERE name=?",(m,)).fetchone()[0]
        db.execute(f'DROP {tipo.upper()} {m}')
    return db
def lote(db, archivo, params):
    """Corre un archivo de sentencias como un db.batch: todo o nada."""
    sent=[x.strip() for x in re.sub(r'--[^\n]*','',leer(archivo)).split(';') if x.strip()]
    db.execute('BEGIN')
    try:
        filas=None
        for i,st in enumerate(sent):
            q=re.sub(r'\?(\d)', lambda m: ':p'+m.group(1), st)
            c=db.execute(q, {f'p{k}':v for k,v in params.items() if f'?{k}' in st})
            if i==0: filas=c.rowcount
        db.execute('COMMIT'); return filas
    except Exception as e:
        db.execute('ROLLBACK'); return 'ERROR: '+str(e)
ok=0; mal=0
def caso(nombre, cond):
    global ok, mal
    print(('OK   ' if cond else 'FALLA'), nombre); ok+=cond; mal+=(not cond)

def mundo():
    db=base()
    db.executescript("""
    INSERT INTO usuarios (id,correo,nombre,rol,clave_hash,fecha_nacimiento) VALUES
      ('a1','a1@x.com','Admin 1','admin','h',NULL),('a2','a2@x.com','Admin 2','admin','h',NULL),
      ('c1','c1@x.com','Conductor 1','repartidor','h','1990-01-01'),('c2','c2@x.com','Conductor 2','repartidor','h','1990-01-01'),
      ('cl','cl@x.com','Cliente','cliente','h','1990-01-01'),('du','du@x.com','Dueño','restaurante','h',NULL);
    INSERT INTO servicios_implementados (servicio_id, contrato) VALUES ('comida',1),('moto',1),('carro',1);
    INSERT INTO servicio_requisitos (servicio_id, requisito) VALUES
      ('moto','identidad'),('moto','antecedentes_pasajeros'),('moto','historial_manejo'),('moto','licencia_moto'),
      ('moto','seguro_pasajeros'),('moto','edad_minima_21'),('moto','casco_pasajero');
    UPDATE servicios SET estado='disponible' WHERE id IN ('moto','carro');
    INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('comida','US-FL-MIAMI','disponible'),('moto','US-FL-MIAMI','proximamente');
    UPDATE servicios_zona SET estado='disponible' WHERE servicio_id='moto';
    INSERT INTO vehiculos (id,conductor_id,tipo,placa,placa_estado,estado,anio) VALUES
      ('v1','c1','moto','M1','FL','aprobado',2020),('v1c','c1','carro','C1','FL','aprobado',2020),('v2','c2','moto','M2','FL','aprobado',2021);
    INSERT INTO repartidores (usuario_id,conectado,lat,lng,ubicacion_en,vehiculo_activo_id) VALUES
      ('c1',1,25.7,-80.1,datetime('now'),'v1'),('c2',1,25.7,-80.1,datetime('now'),'v2');
    """)
    for c,v in (('c1','v1'),('c2','v2')):
        for r in ('identidad','antecedentes_pasajeros','historial_manejo','edad_minima_21'):
            db.execute("INSERT INTO cumplimientos (conductor_id,requisito,estado,fuente,vence_en) VALUES (?,?,'aprobado','checkr',datetime('now','+300 days'))",(c,r))
        db.execute("INSERT INTO cumplimientos (conductor_id,requisito,estado,fuente,aprobado_por) VALUES (?,'licencia_moto','aprobado','documento_conductor','a1')",(c,))
        for r in ('seguro_pasajeros','casco_pasajero'):
            db.execute("INSERT INTO cumplimientos (conductor_id,vehiculo_id,requisito,estado,fuente,aprobado_por,vence_en) VALUES (?,?,?,'aprobado','documento_vehiculo','a1',datetime('now','+100 days'))",(c,v,r))
        db.execute("INSERT INTO habilitaciones (conductor_id,servicio_id,estado,aprobado_por) VALUES (?,'moto','aprobada','a1')",(c,))
        db.execute("INSERT INTO preferencias_servicio (conductor_id,servicio_id,activa) VALUES (?,'moto',1)",(c,))
    return db

def viaje(db, op='o1'):
    db.execute("INSERT INTO operaciones (id,servicio_id,tipo_operacion,cliente_id,zona_id,estado_general) VALUES (?,'moto','viaje_pasajero','cl','US-FL-MIAMI','buscando')",(op,))
    db.execute("INSERT INTO viajes (operacion_id,estado,origen_lat,origen_lng,origen_direccion,destino_lat,destino_lng,destino_direccion,pin_recogida) VALUES (?,'buscando',1,1,'a',2,2,'b','1234')",(op,))
    for c,v in (('c1','v1'),('c2','v2')):
        db.execute("INSERT INTO ofertas_operacion (operacion_id,conductor_id,vehiculo_id,estado,ganancia_centavos,expira_en) VALUES (?,?,?,'ofrecida',500,datetime('now','+45 seconds'))",(op,c,v))

def elegibles(db): return sorted(r[0] for r in db.execute("SELECT conductor_id FROM conductores_elegibles WHERE servicio_id='moto'"))

print('== Punto 1: requisitos completos')
db=mundo()
caso('con todo en regla, los dos conductores son elegibles para Moto', elegibles(db)==['c1','c2'])
db.execute("DELETE FROM cumplimientos WHERE conductor_id='c2' AND requisito='casco_pasajero'")
caso('si falta UN requisito (casco), deja de ser elegible aunque nada esté vencido', elegibles(db)==['c1'])
db.execute("UPDATE cumplimientos SET vence_en=datetime('now','-1 day') WHERE conductor_id='c1' AND requisito='seguro_pasajeros'")
caso('un seguro vencido también lo saca', elegibles(db)==[])
db=mundo(); db.execute("UPDATE repartidores SET vehiculo_activo_id='v1c' WHERE usuario_id='c1'")
caso('con el CARRO activo no recibe Moto (requisitos del vehículo son por vehículo)', elegibles(db)==['c2'])
db=mundo(); db.execute("DELETE FROM cumplimientos WHERE conductor_id='c2' AND requisito='licencia_moto'"); db.execute("DELETE FROM habilitaciones WHERE conductor_id='c2'")
try: db.execute("INSERT INTO habilitaciones (conductor_id,servicio_id,estado,aprobado_por) VALUES ('c2','moto','aprobada','a1')"); r=False
except sqlite3.IntegrityError as e: r='habilitacion_con_requisitos_faltantes' in str(e)
caso('no se puede aprobar la habilitación si le falta la licencia de moto', r)
caso('la vista de faltantes lo dice', [x[0] for x in db.execute("SELECT requisito FROM requisitos_faltantes WHERE conductor_id='c2' AND servicio_id='moto'")]==['licencia_moto'])
db=mundo(); db.execute("DELETE FROM servicio_requisitos WHERE servicio_id='moto' AND requisito='seguro_pasajeros'")
db.execute("UPDATE servicios_zona SET estado='proximamente' WHERE servicio_id='moto'")
try: db.execute("UPDATE servicios_zona SET estado='disponible' WHERE servicio_id='moto'"); r=False
except sqlite3.IntegrityError as e: r='servicio_pasajeros_sin_requisitos_minimos' in str(e)
caso('no se enciende un servicio de pasajeros sin su piso de requisitos (sin seguro de pasajeros)', r)

print('== Punto 2: elegibilidad al aceptar')
db=mundo(); viaje(db)
db.execute("UPDATE habilitaciones SET estado='suspendida' WHERE conductor_id='c1'")
r=lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})
caso('habilitación suspendida entre la oferta y la aceptación: no la toma (0 filas)', r==0 and db.execute("SELECT conductor_id FROM operaciones WHERE id='o1'").fetchone()[0] is None)
db=mundo(); viaje(db); db.execute("UPDATE cumplimientos SET vence_en=datetime('now','-1 minute') WHERE conductor_id='c1' AND requisito='seguro_pasajeros'")
caso('seguro vencido un minuto antes de aceptar: no la toma', lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})==0)
db=mundo(); viaje(db); db.execute("UPDATE repartidores SET conectado=0 WHERE usuario_id='c1'")
caso('se desconectó: no la toma', lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})==0)
db=mundo(); viaje(db)
caso('vehículo distinto al de la oferta: no la toma', lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1c',4:'k1'})==0)
db=mundo(); viaje(db); db.execute("UPDATE ofertas_operacion SET expira_en=datetime('now','-1 second') WHERE conductor_id='c1'")
caso('oferta vencida: no la toma', lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})==0)
db=mundo(); viaje(db)
caso('todo en regla: la toma (1 fila)', lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})==1)
caso('el segundo conductor ya no puede (0 filas) y su oferta queda retirada',
     lote(db,'aceptar-viaje.sql',{1:'o1',2:'c2',3:'v2',4:'k2'})==0 and db.execute("SELECT estado FROM ofertas_operacion WHERE conductor_id='c2'").fetchone()[0]=='retirada')
caso('estado derivado: viaje asignado y cabecera asignada, con su evento y su asignación abierta',
     db.execute("SELECT v.estado, o.estado_general FROM viajes v JOIN operaciones o ON o.id=v.operacion_id").fetchone()==('asignado','asignada')
     and db.execute("SELECT COUNT(*) FROM eventos_operacion WHERE estado_nuevo='asignado'").fetchone()[0]==1
     and db.execute("SELECT COUNT(*) FROM asignaciones_operacion WHERE fin IS NULL").fetchone()[0]==1)

print('== Punto 3: exclusividad comida ↔ viaje')
def con_pedido(db):
    db.executescript("""INSERT INTO restaurantes (id,dueno_id,nombre,estado,abierto) VALUES ('r1','du','R','aprobado',1);
    INSERT INTO pedidos (id,cliente_id,restaurante_id,estado,lineas_json,subtotal,envio,servicio,cargo_pequeno,propina,total,comision,pago_restaurante,pago_repartidor,complemento,ganancia,plan,direccion)
      VALUES ('p1','cl','r1','listo','[]',1000,300,100,0,0,1400,100,900,300,0,100,'inicial','x'),
             ('p2','cl','r1','listo','[]',1000,300,100,0,0,1400,100,900,300,0,100,'inicial','x');""")
FOOD="UPDATE pedidos SET repartidor_id = ? WHERE id = ? AND repartidor_id IS NULL AND estado IN ('aceptado','listo')"
db=mundo(); con_pedido(db); viaje(db)
db.execute(FOOD,('c1','p1'))
caso('c1 con un pedido de comida intenta aceptar un viaje: la base lo impide y NO queda nada a medias',
     str(lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})).startswith('ERROR'))
caso('…la operación sigue buscando y sin conductor', db.execute("SELECT estado_general, conductor_id FROM operaciones WHERE id='o1'").fetchone()==('buscando',None))
db=mundo(); con_pedido(db); viaje(db)
lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})
try: db.execute(FOOD,('c1','p1')); r=False
except sqlite3.IntegrityError as e: r='conductor_ocupado_en_otra_operacion' in str(e)
caso('c1 en un viaje intenta tomar un pedido de comida con la consulta ACTUAL de comida: la base aborta', r)
caso('…y el pedido sigue libre', db.execute("SELECT repartidor_id FROM pedidos WHERE id='p1'").fetchone()[0] is None)
db=mundo(); con_pedido(db)
db.execute(FOOD,('c1','p1')); db.execute(FOOD,('c1','p2'))
caso('dos pedidos de comida agrupados siguen permitidos (una fila, 2 pedidos)', db.execute("SELECT tipo,pedidos FROM conductor_ocupacion WHERE conductor_id='c1'").fetchone()==('comida',2))
db.execute("UPDATE pedidos SET estado='en_camino' WHERE id='p1'"); db.execute("UPDATE pedidos SET estado='entregado' WHERE id='p1'")
caso('al entregar uno, queda 1', db.execute("SELECT pedidos FROM conductor_ocupacion WHERE conductor_id='c1'").fetchone()[0]==1)
db.execute("UPDATE pedidos SET repartidor_id=NULL WHERE id='p2'")
caso('al soltar el otro (soltarPedido), el conductor queda libre', db.execute("SELECT COUNT(*) FROM conductor_ocupacion").fetchone()[0]==0)
db=mundo(); viaje(db); lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})
try: db.execute("UPDATE repartidores SET vehiculo_activo_id='v1c' WHERE usuario_id='c1'"); r=False
except sqlite3.IntegrityError as e: r='no_se_cambia_vehiculo_en_operacion' in str(e)
caso('no cambia de vehículo con una operación en curso', r)
# Concurrencia real: dos conexiones a la MISMA base en disco.
import tempfile
ruta=tempfile.mktemp(suffix='.db'); d0=mundo(); con_pedido(d0); viaje(d0)
d0.execute(f"VACUUM INTO '{ruta}'")
A=sqlite3.connect(ruta,isolation_level=None,timeout=0); B=sqlite3.connect(ruta,isolation_level=None,timeout=0)
for x in (A,B): x.execute('PRAGMA foreign_keys=ON')
A.execute('BEGIN IMMEDIATE'); A.execute(FOOD,('c1','p1'))
try: B.execute('BEGIN IMMEDIATE'); bloqueada=False
except sqlite3.OperationalError as e: bloqueada='locked' in str(e)
A.execute('COMMIT')
caso('dos escrituras a la vez: la segunda espera a la primera (SQLite escribe de a una)', bloqueada)
r=lote(B,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})
caso('…y cuando entra ya ve al conductor ocupado: el viaje no se asigna', B.execute("SELECT conductor_id FROM operaciones WHERE id='o1'").fetchone()[0] is None)

print('== Punto 4: cancelar no es reasignar')
db=mundo(); viaje(db); lote(db,'aceptar-viaje.sql',{1:'o1',2:'c1',3:'v1',4:'k1'})
lote(db,'liberar-viaje.sql',{1:'o1',2:'c1',3:'se me dañó la moto',4:'k3'})
caso('el conductor se baja: el viaje vuelve a BUSCAR (no se cancela al pasajero)', db.execute("SELECT v.estado,o.estado_general,o.conductor_id FROM viajes v JOIN operaciones o ON o.id=v.operacion_id").fetchone()==('buscando','buscando',None))
caso('…queda registrada como «liberada_conductor», no como cancelación', db.execute("SELECT resultado FROM asignaciones_operacion").fetchone()[0]=='liberada_conductor' and db.execute("SELECT COUNT(*) FROM cancelaciones_operacion").fetchone()[0]==0)
caso('…y el conductor queda libre', db.execute("SELECT COUNT(*) FROM conductor_ocupacion").fetchone()[0]==0)
db.execute("UPDATE ofertas_operacion SET estado='ofrecida', expira_en=datetime('now','+45 seconds') WHERE conductor_id='c2'")  # el despachador le ofrece de nuevo
caso('otro conductor la puede tomar con una oferta nueva', lote(db,'aceptar-viaje.sql',{1:'o1',2:'c2',3:'v2',4:'k4'})==1)
db=mundo(); viaje(db)
db.execute("INSERT INTO contexto_transicion (operacion_id,actor) VALUES ('o1','cliente')")
db.execute("UPDATE viajes SET estado='cancelado' WHERE operacion_id='o1'")
caso('el pasajero cancela: estado final «cancelado» y cabecera «cancelada»', db.execute("SELECT v.estado,o.estado_general FROM viajes v JOIN operaciones o ON o.id=v.operacion_id").fetchone()==('cancelado','cancelada'))
db.execute("INSERT INTO contexto_transicion (operacion_id,actor) VALUES ('o1','soporte')")
try: db.execute("UPDATE viajes SET estado='buscando' WHERE operacion_id='o1'"); r=False
except sqlite3.IntegrityError as e: r='transicion_de_viaje_no_permitida' in str(e)
caso('un viaje cancelado NO vuelve a buscar (la contradicción de V1 queda imposible)', r)
db=mundo(); viaje(db)
db.execute("INSERT INTO contexto_transicion (operacion_id,actor) VALUES ('o1','conductor')")
try: db.execute("UPDATE viajes SET estado='en_curso' WHERE operacion_id='o1'"); r=False
except sqlite3.IntegrityError as e: r=True
caso('no se salta pasos (de buscando a en curso)', r)
try: db.execute("UPDATE viajes SET estado='asignado' WHERE operacion_id='o1'"); r=False
except sqlite3.IntegrityError: r=True
caso('sin actor declarado, ningún cambio de estado pasa', r)

print('== Punto 5: pagos (bandeja de salida)')
db=mundo(); viaje(db)
db.execute("INSERT INTO pagos_intentos (id,clave_idempotencia,ambito,operacion_id,accion,monto_centavos) VALUES ('i1','operacion:o1:capturar','operacion','o1','capturar',900)")
try: db.execute("INSERT INTO pagos_intentos (id,clave_idempotencia,ambito,operacion_id,accion,monto_centavos) VALUES ('i2','operacion:o1:capturar-b','operacion','o1','capturar',900)"); r=False
except sqlite3.IntegrityError: r=True
caso('no puede haber dos capturas de la misma operación', r)
reclamo="UPDATE pagos_intentos SET estado='enviando', intentos=intentos+1, enviando_desde=datetime('now') WHERE id='i1' AND estado IN ('pendiente','reintentar') AND proximo_intento_en <= datetime('now')"
caso('dos procesos reclaman el mismo intento: solo uno lo envía', db.execute(reclamo).rowcount==1 and db.execute(reclamo).rowcount==0)
try: db.execute("UPDATE pagos_intentos SET estado='confirmado' WHERE id='i1'"); r=False
except sqlite3.IntegrityError: r=True
caso('no se marca confirmado sin el objeto de Stripe', r)
db.execute("UPDATE pagos_intentos SET estado='confirmado', stripe_objeto='pi_123' WHERE id='i1'")
try: db.execute("UPDATE pagos_intentos SET estado='reintentar' WHERE id='i1'"); r=False
except sqlite3.IntegrityError: r=True
caso('un pago confirmado no vuelve atrás (un webhook tardío no lo revierte)', r)

print('== Punto 6: libro de partida doble')
db=mundo()
def asiento(db, id, clave, tipo, apuntes, **k):
    cols=['id','clave_evento','tipo']+list(k); vals=[id,clave,tipo]+list(k.values())
    db.execute(f"INSERT INTO asientos ({','.join(cols)}) VALUES ({','.join('?'*len(vals))})", vals)
    for cuenta,usuario,monto in apuntes: db.execute("INSERT INTO apuntes (asiento_id,cuenta,usuario_id,monto) VALUES (?,?,?,?)",(id,cuenta,usuario,monto))
    db.execute("UPDATE asientos SET estado='cerrado' WHERE id=?",(id,))
asiento(db,'s1','operacion:o1:liquidacion','liquidacion',[('stripe_cobrado',None,-1000),('billetera','c1',800),('plataforma_ingresos',None,200)])
caso('un evento financiero cuadrado se asienta y el saldo del conductor es 8.00', db.execute("SELECT saldo FROM saldos_billetera WHERE usuario_id='c1'").fetchone()[0]==800)
try: asiento(db,'s2','operacion:o1:liquidacion','liquidacion',[('stripe_cobrado',None,-1000),('billetera','c1',1000)]); r=False
except sqlite3.IntegrityError: r=True; db.execute('ROLLBACK') if db.in_transaction else None
caso('el MISMO evento repetido (reintento, webhook doble) no se asienta dos veces', r)
db.execute("INSERT INTO asientos (id,clave_evento,tipo) VALUES ('s3','x:descuadre','cobro')")
db.execute("INSERT INTO apuntes (asiento_id,cuenta,usuario_id,monto) VALUES ('s3','billetera','c1',500)")
try: db.execute("UPDATE asientos SET estado='cerrado' WHERE id='s3'"); r=False
except sqlite3.IntegrityError: r=True
caso('un asiento que no suma cero no se puede cerrar ni cuenta en el saldo', r and db.execute("SELECT saldo FROM saldos_billetera WHERE usuario_id='c1'").fetchone()[0]==800)
try: db.execute("UPDATE apuntes SET monto=999 WHERE asiento_id='s1'"); r=False
except sqlite3.IntegrityError: r=True
caso('un apunte no se edita', r)
db.execute("INSERT INTO ajustes_financieros (id,usuario_id,monto,motivo,solicitado_por) VALUES ('aj1','c1',150,'propina extra del cliente','a1')")
try: asiento(db,'s4','ajuste:aj1','ajuste',[('stripe_cobrado',None,-150),('billetera','c1',150)],ajuste_id='aj1'); r=False
except sqlite3.IntegrityError: r=True
caso('un ajuste sin aprobar no se asienta', r)
db.execute("DELETE FROM apuntes WHERE asiento_id='s4'") if False else None
db.execute("UPDATE ajustes_financieros SET aprobado_por='a2' WHERE id='aj1'")
db.execute("INSERT INTO ajustes_financieros (id,usuario_id,monto,motivo,solicitado_por,aprobado_por) VALUES ('aj2','c1',100,'compensación por espera','a1','a2')")
asiento(db,'s5','ajuste:aj1','ajuste',[('stripe_cobrado',None,-150),('billetera','c1',150)],ajuste_id='aj1')
asiento(db,'s6','ajuste:aj2','ajuste',[('plataforma_bonos',None,-100),('billetera','c1',100)],ajuste_id='aj2')
caso('DOS ajustes legítimos del mismo viaje sí entran (cada uno con su clave)', db.execute("SELECT saldo FROM saldos_billetera WHERE usuario_id='c1'").fetchone()[0]==1050)
asiento(db,'s7','reverso:s6','reverso',[('plataforma_bonos',None,100),('billetera','c1',-100)],reverso_de='s6')
try: asiento(db,'s8','reverso:s6-b','reverso',[('plataforma_bonos',None,100),('billetera','c1',-100)],reverso_de='s6'); r=False
except sqlite3.IntegrityError: r=True
caso('un asiento se revierte una sola vez', r and db.execute("SELECT saldo FROM saldos_billetera WHERE usuario_id='c1'").fetchone()[0]==950)
caso('todo el libro cuadra (la suma de todos los asientos cerrados es cero)', db.execute("SELECT SUM(a.monto) FROM apuntes a JOIN asientos s ON s.id=a.asiento_id AND s.estado='cerrado'").fetchone()[0]==0)

print('== Punto 7: comercios sobre restaurantes y platos')
db=mundo()
db.executescript("""INSERT INTO usuarios (id,correo,nombre,rol,clave_hash) VALUES ('dm','dm@x.com','Dueño mercado','restaurante','h');
INSERT INTO restaurantes (id,dueno_id,nombre,estado,abierto) VALUES ('r1','du','Restaurante','aprobado',1);
INSERT INTO restaurantes (id,dueno_id,nombre,estado,abierto,tipo_comercio) VALUES ('m1','dm','Mercado','aprobado',1,'mercado');
INSERT INTO platos (id,restaurante_id,nombre_es,precio_centavos) VALUES ('leche','m1','Leche',399),('pizza','r1','Pizza',1400);""")
caso('los restaurantes existentes quedan como «restaurante» sin tocarlos', db.execute("SELECT tipo_comercio FROM restaurantes WHERE id='r1'").fetchone()[0]=='restaurante')
db.execute("INSERT INTO producto_detalles (plato_id,comercio_id,codigo_barras,unidad,inventario) VALUES ('leche','m1','0001','unidad',2)")
try: db.execute("INSERT INTO producto_detalles (plato_id,comercio_id,codigo_barras) VALUES ('pizza','m1','0002')"); r=False
except sqlite3.IntegrityError: r=True
caso('un producto no puede quedar a nombre de otro comercio', r)
baja="UPDATE producto_detalles SET inventario = inventario - ? WHERE plato_id = ? AND (inventario IS NULL OR inventario >= ?)"
caso('el inventario baja al vender…', db.execute(baja,(2,'leche',2)).rowcount==1)
caso('…y no se vende lo que no hay (0 filas, nunca negativo)', db.execute(baja,(1,'leche',1)).rowcount==0)
try: db.execute("INSERT INTO platos (id,restaurante_id,nombre_es,precio_centavos) VALUES ('rx','m1','Antibiótico',999)"); db.execute("INSERT INTO producto_detalles (plato_id,comercio_id,restriccion) VALUES ('rx','m1','receta')"); r=False
except sqlite3.IntegrityError: r=True
caso('productos con receta: bloqueados hasta la aprobación legal', r)
db.execute("INSERT INTO operaciones (id,servicio_id,tipo_operacion,cliente_id,zona_id,estado_general) VALUES ('e1','mercado','compra_encargo','cl','US-FL-MIAMI','buscando')")
try: db.execute("INSERT INTO compras (operacion_id,rubro,tienda_texto,estado,presupuesto_max_centavos,total_real_centavos,destino_lat,destino_lng,destino_direccion) VALUES ('e1','mercado','Tienda X','comprado',5000,4000,1,1,'x')"); r=False
except sqlite3.IntegrityError: r=True
caso('compra por encargo: no se marca «comprado» sin recibo', r)
try: db.execute("INSERT INTO compras (operacion_id,rubro,tienda_texto,estado,presupuesto_max_centavos,total_real_centavos,comprobante_clave,destino_lat,destino_lng,destino_direccion) VALUES ('e1','mercado','Tienda X','comprado',5000,6000,'r2/recibo',1,1,'x')"); r=False
except sqlite3.IntegrityError: r=True
caso('…ni por encima del presupuesto que autorizó el cliente', r)

print(f'\n{ok} pruebas bien, {mal} mal')
sys.exit(1 if mal else 0)

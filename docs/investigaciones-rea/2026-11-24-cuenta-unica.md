# Ficha: «Cuenta Única Divoox» (la misma identidad para conducir y para pedir)

Fecha: 24 nov 2026 · Puesto: investigador · Todos los países · Decisión de origen: Richard, 23 nov 2026 (caso real: un conductor de Tucaní quiso pedir con su correo y la app le dijo que creara otra cuenta con otro correo).

Etiquetas: [DOC] documentación o ayuda pública leída hoy · [OBS] observado hoy en nuestro código o en la ficha pública de una tienda · [INF] inferencia nuestra · [NV] no verificable con fuentes públicas.
REA con hash: no se usó. Los grandes no se descompilan ni se usan sus cuentas (límite legal del proyecto) y la pregunta se contesta con ayuda pública y con nuestro código. Nada se construyó ni se publicó.

## 1. Referencia estudiada: cómo lo resuelven los grandes

Resumen: casi todos tienen UNA identidad por persona (mismo teléfono o correo) y le suman papeles. Cambia si el papel se activa dentro de una sola app o hay apps separadas con el mismo inicio. Ninguno documenta públicamente dos cuentas distintas con el mismo correo.

- Uber, un solo correo para Viajes y Eats [DOC, ayuda oficial «My phone or email is already in use»]: solo se puede crear una cuenta de Uber para Viajes y Uber Eats. Es el rider y el cliente de comida compartiendo identidad.
- Uber, conductor [DOC parcial]: la búsqueda arrojó que, si además tienes cuenta de conductor o de repartidor, tu cuenta de pasajero o de Eats puede estar vinculada y un cambio de teléfono, correo o contraseña se refleja en las dos. Esa frase salió resumida de un buscador, no leída en una página oficial. Marcado [NV] hasta leerla en la ayuda de Uber con la sesión del equipo (no se usan cuentas ajenas).
- Uber, de repartidor a conductor [DOC, página oficial «Switch to driving», Australia]: pasar de entregas a conducir revisa documentos hasta 24 horas, activa hasta 24 horas más y no se puede volver a entregas por 12 días. Es un papel nuevo sobre la misma persona, con su propia verificación.
- Uber, apps [OBS, fichas de tiendas y páginas de «Drive»]: la app del pasajero y la del conductor son apps separadas. Cómo entra un conductor a la del pasajero no está documentado [NV].
- DoorDash [DOC, ayuda del Dasher «Dasher Signup Process»]: el registro de Dasher arranca iniciando sesión con el correo y la contraseña de la cuenta de cliente y una verificación en dos pasos. DoorDash también dice que si eres Dasher y cambias la contraseña de cliente, cambia la del Dasher [DOC, ayuda]. Es decir: UNA identidad, con el papel de Dasher añadido. Las apps son dos (cliente y Dasher).
- DoorDash, dos números [DOC, ayuda]: la función de llamar al cliente solo sirve con el mismo número del Dasher. Que Dasher y cliente compartan celular no está prohibido en ayuda oficial; un blog de terceros lo lista como práctica prohibida [NV].
- Lyft [DOC parcial, Lyft Hub y guías de terceros]: dentro de la app del pasajero hay un interruptor «Switch to Driver»; Lyft pasa a los conductores a su app propia. Misma cuenta, modo conductor. La parte de la app del pasajero es de una nota de 2018 y guías de terceros [NV para hoy].
- DiDi [DOC, términos y condiciones de Ecuador, conductor]: la app de pasajero se abre por defecto con la cuenta y la contraseña de DiDi Conductor del usuario, y la cuenta es personal e intransferible. Una persona, una cuenta, dos apps.
- inDrive [DOC, ayuda «cómo desbloquear una cuenta» y página de conducir]: un solo teléfono; el pasajero verifica con un código al teléfono y el conductor abre «Modo conductor» en el menú, toca «Ya tengo cuenta» e ingresa el mismo teléfono. Un interruptor de modo en una sola app, con registro de conductor aparte (documentos y aprobación).
- Yummy Rides, Venezuela [OBS, ficha de la tienda]: «dos apps en una», con modo Usuario y modo Conductor dentro de la misma app.
- Ridery, Venezuela [OBS, fichas de tienda]: apps separadas, «Ridery: Safety rides» (pasajero) y «Ridery Drivers» (conductor). Si comparten cuenta no está documentado [NV].
- Rappi [NV]: su ayuda pública no dice si el correo del usuario sirve en RappiTendero. Quejas de usuarios cuentan que, tras ser shopper, no les dejaban crear la cuenta de repartidor con ese correo: es un dato anecdótico, no documentación.

### Lo que se comparte y lo que queda separado en el mercado

- Se comparte [INF, patrón de lo anterior]: correo o teléfono, contraseña, nombre, la verificación de que la persona es quien dice (código al celular) y los cambios de datos de contacto.
- Queda separado [INF]: todo lo que es de cada papel: documentos y aprobación del conductor, vehículo, ganancias y saldo, historial de viajes hechos, y la calificación como conductor frente a la calificación como pasajero. Uber, DoorDash e inDrive muestran la nota del conductor al pasajero y la del pasajero al conductor por separado; ninguno las mezcla [INF].
- Formas de pago del cliente no se usan para cobrar ganancias del conductor, y los cobros al conductor salen de su saldo o de sus ganancias, no de la tarjeta de pedir [INF].
- Qué pasa al borrar la cuenta o al suspender un papel [NV]: ninguno lo documenta con claridad. Sí es común que suspender como conductor no te quite el poder de pedir [INF], y que borrar la cuenta borre la persona entera.

### Límites de la evidencia

Solo lectura de ayuda pública y fichas de tienda. Cómo hace cada app su pantalla de entrada con una cuenta de otro papel [NV]. No se probó con cuentas de terceros ni se vio tráfico ajeno.

## 2. Cómo está HOY en nuestro código (solo lectura) [OBS]

- Una cuenta = un solo rol. `usuarios.rol` es una columna con CHECK de cuatro valores (cliente, repartidor, restaurante, admin) y `correo` es único sin importar el rol (`schema.sql`, tabla `usuarios`). Las sesiones no guardan rol: el rol se lee de `usuarios` en cada petición (`apps/servidor/src/sesion.ts`, función `exigir(c, ...roles)`).
- Registro: `rutas/cuentas.ts` busca el correo; si ya existe contesta «Ya existe una cuenta con ese correo. Entra con tu contraseña.» y, desde C-ENTRAR-APP-EQUIVOCADA, el aviso de que es de otra app. El teléfono ya es único POR ROL (la consulta mira `telefono_canonico` junto con `rol`), así que el celular ya podría repetirse entre cliente y conductor; el correo no.
- Entrada: `POST /datos/cuentas/entrar` llama a `exigirAppDeLaCuenta` con la tabla `ROL_DE_APP` de `packages/compartido/src/appDeCuenta.ts` (cada app acepta exactamente su rol). Las apps además comprueban `rolesPermitidos` en `packages/movil/src/Acceso.tsx`. Cabecera de la app: `x-tumbite-app`. Panel web, superadmin y Flex no la mandan.
- Conductor: al entrar un repartidor se borran sus otras sesiones (C-REPARTIDOR-UN-TELEFONO). Si la misma cuenta entrara a la app de clientes, cada entrada le cerraría Driver. Es la razón de ser de C-ENTRAR-APP-EQUIVOCADA.
- Elegibilidad para trabajar: la vista `conductores_elegibles` (`apps/servidor/src/esquemaFase3.ts`) exige `u.rol = 'repartidor'`. Hay muchas otras condiciones con `rol = 'repartidor'` o `'cliente'` (saldoConductores, reparación de vehículo activo, finanzas/controlDual, programaReferidos, plazoPapeles, rastro, kyc, buscador interno, Camila…): más de veinte archivos del servidor.
- Dinero: el libro (`libro.cuenta_id`) no distingue papeles, es una sola cuenta por persona con bolsillos (prepago, reservado, comisiones, punto, deuda_cliente, directo). El saldo prepago de conductor y la deuda de cliente ya son bolsillos distintos del mismo libro, lo que ayuda.
- Calificaciones: ya están separadas por papel: `calificaciones` (cliente califica comida y repartidor), `calificaciones_cliente` (repartidor califica al cliente) y `calificaciones_viaje` con `de IN ('pasajero','conductor')` y `autor_id`.
- Operaciones: `pedidos.cliente_id` / `repartidor_id` y `operaciones.cliente_id` / `conductor_id` son dos columnas hacia `usuarios`. Hoy NADA impide que sean la misma persona, porque nunca ha podido serlo. Solo `programaReferidos.ts` mira `cliente_id <> conductor` (para sus propias carreras) y los referidos cierran `misma_persona`.
- Conductor de confianza y clientes fijos (`conductores_confianza`): `(cliente_id, conductor_id)` sin CHECK de que sean distintos. Con una cuenta única una persona podría ser su propio conductor de confianza.
- Referidos: el `CHECK (invitado_id <> invitador_id)` y el cierre `misma_persona`; el código de referido de conductor busca `rol = 'repartidor'` por correo o teléfono (`programaReferidos.ts` línea 354) y asume un solo rol por correo.
- Borrado: `borrarCuenta.ts` (app y superadmin) frena con un pedido o viaje en curso como cliente O como repartidor, borra datos personales y deja importes sin nombre. Borra la persona entera, que coincide con lo que se espera de una cuenta única; falta decidir el borrado de un solo papel.
- Cuentas de prueba (`es_prueba`) y de revisión de tiendas (restaurante y cliente que Apple y Google usan): son cuentas con un rol; no deben cambiar de comportamiento. `conductores_elegibles` ya trata distinto a `es_prueba`.
- Un solo celular con varias apps: `dispositivos` (token de aviso) apunta a `usuario_id` sin rol: con dos apps y una cuenta, los avisos de conductor llegarían al token de la app de clientes si el teléfono tiene ambas. Hay que separar por app [INF].

### Qué se rompe si una misma cuenta tiene los dos papeles

1. Auto-viajes: una persona pide y acepta su propio viaje, pedido o envío para cobrar premios o regalos, o inflar el saldo de conductor. Hoy no hay guardia en el despacho.
2. Autocalificación: las tablas permiten `autor_id` = conductor; con la misma persona de los dos lados se calificaría a sí misma.
3. Conductor de confianza de sí mismo y clientes fijos.
4. Sesiones: la regla «un repartidor, un teléfono» le cerraría Driver cada vez que abra la app de clientes con la misma sesión.
5. Referidos: un conductor invitado y un cliente invitador son hoy filas distintas; con una cuenta, `invitado_id UNIQUE` impide recibir referido como cliente y como conductor.
6. Reglas con `rol = 'repartidor'` (vista elegible, saldos, plazo de papeles, kyc, buscador) pasan a ser falsas para quien además es cliente si se cambia la columna por una sola lista de roles.
7. Dinero: regalos de arranque (conductor) y cupones (cliente) se canjean por cuenta; una cuenta con ambos papeles podría canjear ambos arranques si no se separan por papel.
8. Cuentas de revisión de tiendas: cualquier cambio en el inicio de sesión las toca; por eso se dejan aparte.

## 3. Diagrama del flujo recomendado

```
 Una persona (correo + celular verificados + contraseña)
        │
        ├─ papel «cliente»     ← se activa solo al entrar a la app de clientes
        │     (términos del cliente con un toque; datos ya verificados)
        │
        └─ papel «conductor»   ← se activa al abrir Driver y completar SU registro
              (documentos, vehículo, aprobación: separados y propios)

 App de clientes ─ entra con la identidad ─► papel cliente (nuevo o ya activo)
 Driver          ─ entra con la identidad ─► papel conductor (si no existe, empieza el registro con lo que ya hay)
 Restaurants     ─ sin cambios (cuenta de negocio)
```

## 4. Comparación y decisión (una sola)

El mercado hace «una identidad por persona con papeles añadidos» (Uber, DoorDash, inDrive, Lyft, DiDi). No hace dos cuentas con el mismo correo. Esa es la decisión: **una sola fila de usuario por persona y varios papeles**, no dos filas con el mismo correo.

Por qué no dos cuentas con el mismo correo: rompería la unicidad del correo (el inicio de sesión, la recuperación de contraseña y el código por SMS no sabrían cuál cuenta), duplicaría el borrado y la verificación, y es lo que el mercado NO hace.

### Diseño recomendado

1. **Papeles en una tabla propia** (`usuario_papeles`: `usuario_id`, `papel`, `estado`, `desde`), con el papel original copiado de `usuarios.rol` para todas las cuentas existentes. `usuarios.rol` se queda como el papel principal por compatibilidad con las apps publicadas y con cada consulta que hoy lo lee; no se elimina en esta etapa.
2. **El inicio de sesión sigue siendo uno**: mismo correo o celular verificado, misma contraseña, mismo código por SMS. La sesión no lleva papel; lo que cambia es qué app la usa (cabecera `x-tumbite-app`, que ya existe).
3. **Entrar a la app de clientes con una cuenta de conductor** activa el papel cliente en ese momento (con sus datos ya verificados) y solo pide aceptar los términos del cliente con un toque. **Entrar a Driver con una cuenta de cliente** abre el registro de conductor con lo que ya está (nombre, correo, celular), sin repetirlos. Restaurants queda fuera.
4. **Sesiones por app**: la regla «un repartidor, un teléfono» pasa a ser «una sesión de conductor por teléfono» solo para sesiones abiertas desde Driver; abrir la app de clientes no borra ni cierra la sesión de Driver (se conserva el espíritu de C-ENTRAR-APP-EQUIVOCADA).
5. **Todo lo de cada papel se queda separado**: saldo y ganancias del conductor, historial de viajes hechos, documentos y vehículo (conductor); pedidos, tarjetas, direcciones y deuda de cliente (cliente). La persona comparte nombre, correo, celular, foto de perfil y contraseña.
6. **Calificaciones**: ya separadas por papel en las tablas. Se muestran por papel; ninguna mezcla de notas de conductor con notas de pasajero.
7. **Suspender un papel no suspende el otro** (un conductor suspendido por papeles puede seguir pidiendo, salvo fraude con dinero o seguridad: ahí la suspensión es de la persona y la decide el equipo). **Borrar la cuenta borra la persona entera**, con las mismas reglas de siempre (nada con un pedido o viaje en curso). Quitar solo un papel (dejar de ser conductor) es una opción posterior [INF].

### Frenos contra fraude (obligatorios, con prueba en rojo)

- No se le ofrece una carrera, viaje, pedido o envío a un conductor cuando la misma persona es el cliente: se compara `cliente_id` con `conductor_id` y `repartidor_id` en TODAS las rutas de oferta (viaje, comida, envío, Flex, conductor de confianza). Hoy no existe esa guardia.
- Nadie se califica a sí mismo (CHECK o validación en las tablas de calificación y en el cálculo de puntos).
- Nadie es su propio conductor de confianza ni su propio cliente fijo (`CHECK (cliente_id <> conductor_id)` o validación).
- Los regalos y cupones que paga Divoox por viajes (regalo con viaje real, referidos, regalo de arranque) NO cuentan viajes donde el cliente y el conductor son la misma persona ni el mismo dispositivo ni el mismo celular. El cierre `misma_persona` de referidos ya existe: se extiende.
- Un regalo de arranque por persona, no por papel: se canjea una vez entre los dos papeles.
- Los avisos se guardan por app (`dispositivos` con la app de origen) para que los de conductor no lleguen a la de clientes.

## 5. Fases de construcción, en orden

Las fases 1 a 3 no necesitan app nueva: son del servidor. La cuenta única de punta a punta (4 y 5) sí la necesita, porque las apps publicadas rechazan la cuenta de otra app.

1. **Frenos primero (servidor).** Guardia de auto-viaje en todas las ofertas, autocalificación, conductor de confianza de sí mismo, y los candados de dinero. Se pueden publicar solos: hoy no cambian nada y protegen el día en que haya doble papel.
2. **Papeles (servidor, solo datos).** Tabla `usuario_papeles` llenada desde `usuarios.rol`; ayudantes `tienePapel(usuario, papel)` que reemplazan a `u.rol = 'repartidor'` en la vista `conductores_elegibles`, saldos, plazo de papeles, kyc, buscador y Camila, uno por uno con su prueba. `usuarios.rol` se mantiene.
3. **Servidor acepta la identidad en cualquier app.** `exigirAppDeLaCuenta` cambia de «rechaza» a «activa el papel que falta» y pide el aceptar de los términos del papel. Sesiones por app. Respuesta nueva con un código estable (por ejemplo `papel_por_activar`) para que la app lo muestre. Se prueba en el sitio de pruebas con cuentas marcadas de prueba (`es_prueba`).
4. **Apps nuevas (cliente y Driver).** La app de clientes muestra «Activar mi cuenta de cliente» con un toque para aceptar términos; Driver muestra «Empezar mi registro de conductor» con lo ya conocido. Entran por el auditor de tiendas. Las versiones viejas siguen viendo el aviso actual, que es correcto.
5. **Docs públicos es/en y ayuda de Camila.** Guía pública «Una cuenta, dos papeles» con capturas (en inglés con ejemplos de EE. UU.), sin explicar nada interno; Camila sabe contestar «¿puedo pedir con mi cuenta de conductor?».
6. **Herramienta de unir cuentas (panel del equipo, ayuda interna).** Para quienes hoy tienen dos correos con la misma persona: no se fusionan solos.

### Migración de quienes ya tienen dos cuentas con correos distintos

No se fusionan solas. Se deja en el panel del equipo (detrás de la sesión del equipo) una herramienta para unir dos cuentas con la decisión de una persona del equipo, tras comprobar que el celular verificado es el mismo y que no hay pedido ni viaje en curso. Al unir: una cuenta queda como principal, la otra pasa su papel a la principal, se guardan los dos libros sin tocarlos (no se mezclan saldos), las calificaciones y el historial se mueven con su papel, y la cuenta sobrante se cierra con su correo reservado. Operación atómica con registro. Dinero: nada se mueve entre bolsillos; solo cambia el dueño del papel [INF].

## 6. Pruebas de aceptación

1. (Servidor, rojo antes) Un conductor entra con su correo en la app de clientes: recibe la respuesta de «activar papel cliente», sin cuenta nueva ni correo nuevo, y su sesión de Driver sigue abierta.
2. Un cliente abre Driver con su correo: empieza el registro de conductor con nombre y celular ya cargados; no se crea otro usuario.
3. Un mismo usuario con dos papeles no puede recibir su propia oferta de viaje, comida, envío ni Flex; no se califica a sí mismo; no es su conductor de confianza.
4. Un viaje con cliente = conductor no cuenta para regalo, referido ni premio.
5. Un regalo de arranque se canjea una sola vez entre los dos papeles.
6. Saldo y ganancias del conductor no aparecen en los pedidos del cliente; la deuda de cliente no baja el saldo de conductor.
7. Suspender el papel de conductor no impide pedir; el fraude con dinero suspende la persona.
8. Borrar la cuenta con un viaje o pedido en curso como cualquiera de los dos papeles es 409; sin nada en curso borra la persona entera.
9. Las cuentas de revisión de tiendas se comportan idéntico al de hoy.
10. Las apps publicadas (versiones viejas) siguen funcionando con el aviso actual.
11. Cada candado comprobado en rojo antes de publicar; documentado en `CANDADOS.md` al construirse.

## 7. Riesgos y quién decide

- Fraude: auto-viajes para cobrar regalos y autocalificarse. Freno: sección «Frenos contra fraude», fase 1, antes que cualquier apertura.
- Seguridad: con una sola contraseña, una sola fuga abre los dos papeles. Freno: el código por SMS del celular para acciones de dinero del conductor (retiros) sigue pidiéndose aparte [INF].
- Compatibilidad: toda lectura de `usuarios.rol` en el servidor y en el panel debe revisarse antes de dejar a alguien con dos papeles. La vista `conductores_elegibles` y el despacho son lo más delicado.

**Decide Richard** (negocio y legal, no la IA):

- Si un conductor suspendido por fraude pierde también la cuenta de cliente (hoy se recomienda sí, por la persona).
- Si quien ya tiene dos cuentas que hoy gozan de regalos o premios puede acumularlos al unirlas (tope de dinero).
- Texto legal: que los términos de cliente y de conductor sigan siendo dos aceptaciones distintas en una sola cuenta, y qué dice la política de privacidad de una identidad con dos papeles. Eso es legal y lo valida Richard.
- No hay que decidir nada de dinero real para empezar las fases 1 a 3.

## Qué quedó [NV]

- Que la cuenta de conductor de Uber esté vinculada con la de pasajero, con su texto oficial, y cómo entra un conductor a la app del pasajero.
- Si Ridery y Rappi aceptan el mismo correo en sus dos apps.
- Qué pasa en cada gran plataforma al suspender un solo papel o al borrar la cuenta.
- Que un celular compartido entre papeles esté permitido o prohibido por DoorDash en sus términos.

## Fuentes

- Uber, ayuda: https://help.uber.com/h/121c9c63-33a3-4b89-867f-79ae0c9538a1
- Uber, de entregas a conducir: https://www.uber.com/au/en/u/switch-to-driving
- DoorDash, registro de Dasher: https://help.doordash.com/en-us/dashers/article/dasher-signup-process
- DoorDash, entrar como Dasher: https://help.doordash.com/en-au/dashers/article/trouble-logging-in-to-your-dasher-account
- DoorDash, llamar al cliente: https://help.doordash.com/en-nz/dashers/article/unable-to-call-the-customer-on-dasher-app
- Lyft, app del conductor: https://www.lyft.com/hub/posts/explore-the-lyft-driver-app
- DiDi Ecuador, términos de conductor: https://web.didiglobal.com/ec/legal/2024-ec-terminos-y-condiciones-de-uso-usuario-conductor.pdf
- inDrive, desbloquear cuenta: https://indrive.com/help/passengers/how-to-unblock-an-indrive-account
- inDrive, conducir: https://indrive.com/en-br/driver
- Yummy Rides, tienda: https://apps.apple.com/app/id1577004455
- Ridery, tienda pasajero: https://apps.apple.com/us/app/ridery/id1553877900
- Ridery, tienda conductor: https://apps.apple.com/us/app/ridery-drivers/id1553878292
- Nuestro código: `schema.sql`, `apps/servidor/src/sesion.ts`, `apps/servidor/src/rutas/cuentas.ts`, `packages/compartido/src/appDeCuenta.ts`, `apps/servidor/src/esquemaFase3.ts`, `apps/servidor/src/borrarCuenta.ts`, `apps/servidor/src/programaReferidos.ts`; candados C-ENTRAR-APP-EQUIVOCADA y C-REPARTIDOR-UN-TELEFONO en `CANDADOS.md`.

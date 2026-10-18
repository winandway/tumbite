# Ficha REA: la app del repartidor de punta a punta (18 oct 2026)

Metodología permanente (Richard, 18 oct 2026): estudiar el **proceso completo** de las referencias, no una pantalla; comparar con Tumbite; reutilizar lo que funciona; construir lo que falta con código propio; coherencia entre cliente, restaurante, repartidor, servidor y paneles; distinguir lo observado de lo que no se puede verificar. Eslogan: «No inventemos la rueda».

## 1. Referencias

- DoorDash Dasher (EE.UU.): Centro de ayuda de Dashers (artículos «How to Accept an Offer», «Dasher Ratings Explained», «How Dasher Pay Works») y la guía oficial del blog de Dasher «How to Use the DoorDash Dasher App». [DOC]
- Uber Eats / Uber Driver: página oficial «Deliver with Uber Eats» (EE.UU.) y «Delivering using the Driver app» (Reino Unido; las reglas de espera y cancelación varían por país). [DOC]
- Estudios de Richard: E1 «Del primer registro a la entrega» (p. 6 alta de repartidores, p. 9-10 minutos de la oferta, p. 13 asignación, p. 19 excepciones, p. 22 lo que gana cada participante) y E2 «Cómo funcionan DoorDash, Uber Eats y Rappi» (p. 3 requisitos y activación, p. 4 flujo de doce pasos y tiempos medidos, p. 11 pagos). [DOC]
- Lo que no se pudo verificar en fuente oficial queda marcado [NV]; lo que es deducción nuestra, [INF]. No se descompiló ninguna app de tienda (límite legal de la metodología).

## 2. El proceso completo del repartidor en los grandes (estándar del mercado)

### 2.1 Registro y activación

- **Requisitos por vehículo** [DOC Uber]: bici o a pie 18+; moto o scooter 19+ con licencia; carro 19+ (21 en California y Nueva York), vehículo de 2 o 4 puertas, licencia; en todos, documento oficial y número de Seguro Social para antecedentes. DoorDash [DOC E2 p.3]: 18+ (19 en Texas y Florida, 21 en California para nuevos), licencia y seguro si va en carro.
- **Pasos** [DOC Uber, DOC Dasher]: crear cuenta → elegir vehículo → aceptar antecedentes → subir documentos y foto → verificación de identidad con selfie (se puede volver a pedir antes de un turno) → agregar banco (se puede después, desde Ganancias) → correo de activación (minutos a 48 h en Uber; DoorDash ~1 día, hasta 2 semanas).
- **Identidad continua** [DOC E2 p.3]: selfie al azar contra el documento para evitar cuentas prestadas.

### 2.2 Pestañas de la app Dasher [DOC blog Dasher]

Dasher (pantalla principal: botón «Dash Now», mapa con zonas calientes, menú para pausar/extender/terminar, campana de anuncios), Schedule (reservar zona y horario hasta una semana antes), Earnings (por semana y por día, banco, Fast Pay, meta semanal), Ratings (calificación de clientes, aceptación, finalización, entregas totales), Account (perfil, vehículo, preferencia de navegación interna o externa). Uber [DOC]: estado en línea/fuera de línea, solicitudes cercanas, Ganancias, Ayuda en la app.

### 2.3 Conectarse

- DoorDash: «Dash Now» si hay cupo en la zona, o turno reservado; zonas calientes para recibir más ofertas; se puede pausar el turno (no llegan ofertas y no cuenta como rechazo). Si la zona está llena no deja conectarse. [DOC]
- Uber: ponerse en línea cuando quiera; se puede apagar la recepción de solicitudes en cualquier momento. [DOC]
- Preferencias de tipos de oferta (compras, efectivo, alcohol 21+) en prueba en DoorDash. [DOC]

### 2.4 La oferta

- **Qué muestra** [DOC]: ganancia mínima garantizada (puede subir con propina posterior), distancia, tiempo estimado, recogida y entrega. DoorDash: 50 segundos para aceptar (salvo que la app diga otro tiempo); ofertas agrupadas en horas pico; una oferta nueva puede llegar mientras hay una entrega activa. Uber: aceptar, rechazar o ignorar «sin consecuencias» (Reino Unido); E2 p.4: oferta exclusiva ~10-15 s o «Trip Radar» a varios. [DOC]
- **Rechazo**: en DoorDash dejar vencer el temporizador cuenta como rechazo; la tasa de aceptación no tiene mínimo pero define el nivel de recompensas; «Worry-free Declines» (piloto Platinum) no cuentan. [DOC]
- **Modos de ganancia** DoorDash [DOC]: Earn per Offer (base 2 a 10+ dólares por oferta según tiempo, distancia y atractivo) o Earn by Time (tarifa por hora garantizada en tiempo activo, limita los rechazos).

### 2.5 Ir al restaurante y recoger

- Navegación paso a paso en la app o en la app de mapas externa, a elección. [DOC]
- Llegada: deslizar «Slide upon arrival» (DoorDash); decir el nombre del cliente al personal; «I have the order». Uber: comparar nombre y número de pedido con la bolsa antes de salir; si el restaurante está lento, marcar «Not ready» en el pedido. [DOC]
- Espera en el local: DoorDash mide desde 25 m, meta menor a 2 min (E2 p.4); la «protección por retraso del comercio» no castiga al Dasher si llegó a tiempo, esperó en el lugar y salió de inmediato. [DOC]
- Recogida verificada: DoorDash escanea QR del ticket o últimos tres caracteres; Uber nombre + código (E2 p.4). [DOC]

### 2.6 En camino y entrega

- La app traza la ruta y muestra las **instrucciones de entrega** del cliente (DoorDash sugiere leerlas mientras se espera la comida); al llegar, Uber muestra datos como interfono y piso. [DOC]
- Avisos al cliente: DoorDash SMS «Delivery Arriving» al entrar en la zona; Uber comparte ubicación a ~3 min e «imminent» a 1 min (E2 p.4). [DOC]
- Entrega sin contacto por defecto con **foto de confirmación** que pide la app; en mano: PIN de 4 dígitos cuando aplica; alcohol: identificación. [DOC E2 p.4]
- **Cliente no responde** (Uber) [DOC]: llamar o escribir en la app; tocar el banner «no respondió» → se le manda una notificación y empieza un temporizador; si no contesta antes de que termine y el repartidor sigue los pasos para finalizar, cobra igual y no afecta su tasa de cancelación; muchas cancelaciones antes del fin del temporizador se tratan como posible fraude. Los minutos exactos no están publicados [NV].
- **Cambio de dirección** (Uber) [DOC]: ir a la nueva dirección y pedir ajuste de tarifa por Ayuda, o esperar en la original el tiempo de las pautas y marcar «Unable to deliver».
- DoorDash marca «Delivery Complete» y 60 s después se captura el cobro (E2 p.4). [DOC]

### 2.7 Ganancias y pagos [DOC]

- Tres componentes: pago base, propinas (100 % al repartidor, separadas; si el cliente da propina después, llega una notificación y el desglose se actualiza) y promociones (Peak Pay, Challenges, Delivery Streaks, Boosts).
- La pantalla de aceptación muestra el mínimo garantizado; al terminar se ve el desglose por pedido en Ganancias; durante el turno, ganancias en tiempo real; fuera del turno, la semana anterior y el historial. Meta semanal con barra de avance.
- Pagos: depósito semanal gratis (lunes a domingo, llega el miércoles), Fast Pay diario con tarifa (1,99 dólares) a tarjeta de débito, DoorDash Crimson (cuenta integrada, retiro instantáneo sin tarifa). Uber: Instant Pay hasta 6 veces al día con comisión, o semanal.

### 2.8 Calificaciones y niveles [DOC Dasher Ratings Explained]

- Calificación de clientes: 1 a 5 sobre las últimas 100; mínimo 4,2; filtro de equidad (esperas largas en el restaurante, retraso ya al aceptar, clima, caídas del sistema no cuentan); si el cliente no califica no afecta.
- Tasa de finalización: últimas 100 aceptadas; mínimo 90 % o desactivación; desasignarse cuenta salvo motivo justificado.
- Tasa de aceptación: últimas 100 ofertas; sin mínimo; vencer el temporizador es rechazo; pausar la app evita ofertas.
- Puntualidad: entregado dentro del tiempo mostrado al aceptar (últimas 100); protección por retraso del comercio; se puede disputar.
- Calidad (piloto): problemas verificados restan 1 % (faltantes) o 3 % (entregado a otro o no entregado).
- Pedidos de los últimos 30 días y totales de por vida; primeras 50 entregas con ventajas de novato.
- Niveles Silver, Gold, Platinum (acceso prioritario, pedidos grandes, horarios anticipados, soporte VIP); umbrales por mercado [NV].

### 2.9 Seguridad y soporte [DOC blog Dasher]

SafeDash (compartir ubicación, seguimiento, botón de emergencia 911), SafeChat+ (detecta lenguaje ofensivo y permite desasignarse), compartir el viaje con alguien de confianza, soporte en la app y por teléfono, cuenta bloqueada con aviso claro, «no puedes conectarte: zona llena o cuenta requiere atención».

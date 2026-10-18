# La app del repartidor como los grandes — 18 oct 2026

Primera entrega con la metodología permanente: proceso completo de Dasher y Uber Driver estudiado por fuentes oficiales y los estudios de Richard, comparado con nuestra app, y lo que faltaba construido con código propio. Ficha técnica: `docs/investigaciones-rea/2026-10-18-repartidor.md`. Candado: C-REPARTIDOR-GRANDES.

## Lo que ya teníamos al nivel del estándar (no se tocó)

Despacho justo a tiempo con oferta exclusiva de 45 segundos y oferta abierta con bono, aceptación atómica, QR y foto de recogida con confirmación del restaurante, avisos al cliente (5 minutos, sal a recibir, casi llega, llegó con SMS), chat y llamada oculta, llegada confiable con dos lecturas, entrega en puerta con foto y en mano con PIN y edad, cliente que no aparece con reloj y lugar seguro, cola sin señal, soltar con motivo, repartidor perdido, billetera con Stripe, niveles, foto de control, verificación de identidad y antecedentes.

## Lo que se construyó (nueve brechas de la ficha)

1. **La oferta en pantalla completa**, como en Dasher y Uber: ganancia garantizada en grande con la propina y el bono, distancia hasta el local, viaje total, minutos aproximados y cuántos artículos; cuenta regresiva real de 45 segundos y vibración al llegar. Vencer cuenta como rechazo.
2. **Mis calificaciones** (Perfil): calificación de clientes sobre las últimas 100, tasa de aceptación, de finalización y de puntualidad, entregas en 30 días y totales, con la referencia de las grandes apps (4,2 y 90 %) como guía. Nadie se desactiva por ellas: es una decisión de negocio que no se ha tomado.
3. **Ganancias con desglose**: por día, semana o mes, pago base, bonos y propinas separados, y cada pedido con su desglose. La propina que llega después de entregar ahora cuenta como propina.
4. **Campana real**: pedido listo, cancelación del restaurante o del cliente, cambio de dirección con la nueva dirección, excepción autorizada, propina posterior, ofertas vencidas hoy y foto de control. Además, avisos al celular cuando el restaurante marca listo, cancela o el cliente cambia la dirección; y el idioma de los avisos sigue al de la app.
5. **Pausa**: «Pausar ofertas» lo deja conectado sin recibir ofertas; al conectarse fuera de cobertura, la app lo dice.
6. **«Llegué al restaurante»** (funciona a menos de 200 metros y, si no, dice a cuántos metros) y **«El pedido no está listo»** (aviso al restaurante y registro en la bitácora: la espera no cuenta en su contra).
7. **Empieza a repartir** (Perfil): los cuatro pasos del alta con su estado (datos y vehículo, documento y foto, antecedentes, banco), cada uno abre su sección.
8. **Ayuda con este pedido**: motivos predefinidos que abren la conversación con soporte con el pedido adjunto.
9. **Emergencia**: llama al 911 desde la app y Tumbite queda avisado.

## Documentación pública

Guías nuevas en Docs, en español e inglés, sección Repartidores: «Mis calificaciones», «Ganancias con desglose», «La campana y la pausa», «Llegué al restaurante, el pedido no está listo y ayuda». Actualizadas: «Las ofertas» y «Empezar a repartir».

## Cómo se comprobó

Nueve pruebas del servidor escritas en rojo y luego en verde; todas las pruebas del proyecto en verde; recorrido completo en el navegador en los dos idiomas con las pantallas nuevas (de ahí salen las capturas de Docs).

## Fase 2 (fichas aparte, no se construyó ahora)

GPS en segundo plano (trabajo nativo con prueba en teléfono real), navegación dentro de la app (necesita proveedor de rutas y la llave de Google Maps), compartir el viaje. Después del piloto: modos de ganancia por hora, turnos programados, zonas calientes, retos y pago extra en hora pico (decisiones de negocio pendientes).

## Publicado (flujo permanente)

- Staging: rama `fase-repartidor-grandes` `a5f6081a`, flujo de pruebas en verde.
- Producción: commit `824bc7cc` (código idéntico al de staging). Control previo VERDE, etiquetas `restauracion-antes-repartidor-grandes-main` y `-paquete`, verificación posterior VERDE: sin pedidos activos, sin cobros abiertos, retiros apagados, solo Comida.
- En vivo: las rutas nuevas del repartidor responden (protegidas con sesión) y las guías nuevas de Docs cargan en los dos idiomas.
- Simulador de iPhone: las apps del cliente y del repartidor recompiladas contra staging e instaladas; la del repartidor abierta con la cuenta demo.

## Arreglo aparte encontrado en la prueba

El enlace «Empezar de nuevo» del aviso de borrador no respondía al toque en el iPhone (texto anidado con toque). Ahora es un botón real para las tres apps, con su candado en la prueba del aviso de borrador; va por su propia rama `fase-aviso-borrador` por el flujo permanente.

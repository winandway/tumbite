# Amazon Flex, observado en un bloque real · comparación con Divoox Flex «Mi ruta»

Fecha: 30 de octubre de 2026. País: todos los países (el bloque fue en EE. UU.). Servicio: Divoox Flex
(logística) y la elección de Envíos.

## Evidencia y límites

- **[OBS] 17 capturas de pantalla** que hizo Richard con su propia cuenta de repartidor durante un bloque
  real. Están guardadas FUERA del repositorio (es público y las capturas tienen nombre y dirección de
  clientes reales, números de paquete y la foto de Richard): carpeta privada
  `~/Divoox-privado/estudios/amazon-flex-2026-10-30` en la computadora del proyecto. En este documento
  solo se describen, sin datos personales.
- No se descompiló ni se analizó con REA la app de Amazon (lo prohíben sus términos). Lo de abajo es
  lo que se VE en pantalla [OBS]; lo que pasa por detrás se marca [INF].
- Siguiente paso con REA: recorrer nuestra «Mi ruta» en el sitio de pruebas con una ruta de prueba
  (capturas, red y lo que guarda) y cerrar cada brecha con su prueba en rojo.

## Lo observado, pantalla por pantalla [OBS]

1. **Color propio de logística.** Toda la app es azul petróleo oscuro (cabecera y fondo) con botones
   azul claro. No se parece a ninguna app de comida: en una captura se sabe al instante que es la de
   paquetes.
2. **Cabecera fija**: menú, título de la pantalla (VIAJAR, VISIÓN GENERAL, ENTREGA, FOTO), chat y ayuda
   siempre a la vista. Debajo, tres pestañas con ícono: **Lista**, **Mapa** y **Resumen** del itinerario.
3. **Viajar**: dirección de la parada arriba, mapa con la ruta y el pin numerado de la parada, «5 min ·
   3.2 km», «Se espera para 6:00 p. m.» (ventana de entrega), botón grande **Iniciar viaje** y un botón
   para abrir en otra app. Al tocarlo pregunta **¿Apple Maps o Google Maps?**
4. **Navegación dentro de la app**: giro siguiente («50 m · McKinley Street»), límite de velocidad,
   paradas de tránsito, voz y ajustes. Abajo «1 min · 1 paquete» y el botón **YA ESTACIONÉ**.
5. **Visión general de la parada** (después de estacionar): mapa del edificio con los números de las
   unidades, tarjeta de la parada con: tipo (Edificio), dirección y apartamento, destinatario, «No se
   requiere un destinatario», cómo entrar (acceso con un clic o llave), **instrucciones del cliente
   traducidas automáticamente** con «Mostrar original», tipo de paquete (Sobre), código de zona del
   paquete y número de seguimiento, y la **foto de una entrega anterior en esa misma puerta** como
   referencia. Botones «Editar parada» y **Continuar con 1 paquete**.
6. **Escanear los paquetes** de esa parada con la cámara: «1 de 1 paquetes escaneados», cada uno con
   su check.
7. **Fuera del área de entrega**: si el repartidor no está dentro del círculo resaltado, no deja
   terminar: «Tendrás que moverte dentro del área resaltada». Opción «Actualizar PIN de entrega».
8. **¿Dónde está dejando los paquetes?**: el destinatario o alguien del hogar, recepcionista o portero,
   puerta principal o porche, buzón seguro, otra ubicación segura. Más las notas de la parada.
9. **Foto**: cámara con un recuadro guía, «Entregar a: Puerta principal…» con lápiz para cambiarlo,
   flash y obturador. Después, la revisión: la foto, «Asegúrate de que la ubicación de entrega sea clara
   y que no haya personas en la foto», **Volver a tomar foto**, «Agregar código de acceso» y
   **Deslice para finalizar** (deslizar, no tocar: evita terminar por error).
10. **Lista del itinerario**: línea de tiempo con cada parada numerada; las hechas en gris con «Entregado
    a las 2:18 p. m.» y un check verde; la **Próxima parada** resaltada en verde con su ventana; botón
    fijo **Parada actual**.
11. **Mapa del itinerario**: todas las paradas con su número, la siguiente en verde, filtros **Todos /
    Apartamentos / Prioridad**, «8 paradas · 8 paquetes» y **Parada actual**.
12. **Resumen**: «Trabajo restante» con tres barras (paradas, ubicaciones, paquetes); Paradas:
    **Pendientes 8 · Correcto 9 · Problemas 0**; «Paquetes y equipo».
13. **Menú lateral**: foto y nombre, Parada actual, Itinerario de hoy, Recolectar, Actualizaciones,
    Horario, Ofertas, Mi panel, Portal de aprendizaje, Calendario, Ganancias, Configuración, Servicio al
    conductor y **Ayuda de emergencia** (en rojo).

## Comparación con nuestra «Mi ruta» (Divoox Flex)

| #   | Del estándar                                              | Divoox hoy                                                   | Brecha                                                                         |
| --- | --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | Color propio de logística                                 | Usa los colores de la marca (rojo y negro), igual que comida | **Falta**: color de logística (decisión de Richard, 30 oct)                    |
| 2   | Pestañas Lista / Mapa / Resumen                           | Una sola pantalla con lista y mapa                           | Parcial                                                                        |
| 3   | Elegir app de mapas al iniciar                            | Abre una sola app                                            | **Falta**                                                                      |
| 4   | Navegación dentro de la app                               | No (abre la app de mapas)                                    | Fuera de alcance por ahora (costo de un proveedor de navegación)               |
| 5   | «Ya estacioné» y la tarjeta completa de la parada         | Tarjeta de la parada con datos básicos                       | **Falta** el botón y la foto de entrega anterior; las instrucciones traducidas |
| 6   | Escanear cada paquete en la parada                        | Hay escaneo de código                                        | Comprobar con REA que exige todos los de la parada                             |
| 7   | No deja terminar fuera del área                           | Distancia aproximada, sin bloqueo                            | **Falta**: geocerca con círculo y mensaje claro                                |
| 8   | ¿Dónde lo dejaste? (cinco opciones)                       | Solo foto o firma                                            | **Falta**                                                                      |
| 9   | Revisión de la foto, rehacer y «Deslizar para finalizar»  | Foto y confirmar con un toque                                | **Falta** la revisión con aviso y el deslizar                                  |
| 10  | Lista con hora de entrega, check verde y «Próxima parada» | Paradas con estado                                           | Parcial: falta la hora y la próxima resaltada                                  |
| 11  | Filtros del mapa (Todos, Apartamentos, Prioridad)         | Mapa con pines numerados (hecho en verde, actual en rojo)    | **Falta** los filtros; la actual debería ir en el color de logística           |
| 12  | Resumen con barras y Pendientes / Correcto / Problemas    | Contadores                                                   | Parcial                                                                        |
| 13  | Menú con Ayuda de emergencia                              | Seguridad existe en Driver                                   | Revisar que se vea desde «Mi ruta»                                             |

## Decisión de Richard (30 oct 2026)

- **Logística lleva su propio color, distinto de comida.** Si alguien manda una captura con un error,
  se tiene que saber de un vistazo si es de comida, de tienda o de logística. Al entrar a Envíos, la
  persona elige entre los dos tipos de logística: de A a B, para algo cerca, o un bloque largo de
  reparto. Los dos van con el color de logística.
- Se toma como referencia el azul petróleo oscuro con botones azul claro que se ve en el bloque real.
  El tono exacto para Divoox se fija en `MARCA` como color de servicio («logística»), sin tocar el
  rojo de la marca.

## Pruebas de aceptación

- Una captura de cualquier pantalla de Flex o Envíos se reconoce como logística por el color.
- No se puede terminar una entrega fuera del área sin pasar por soporte.
- Toda entrega guarda dónde se dejó (una de las cinco opciones) y la foto revisada.
- Terminar exige deslizar, no un toque.

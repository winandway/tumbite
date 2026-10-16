# Trabajo en paralelo mientras esperamos la conciliación: informe

**Fecha:** 16 de octubre de 2026, tarde. **Estado:** todo hecho en ramas y probado en el sitio de pruebas.

**No se hizo nada de esto:**

- tocar producción;
- fusionar a `main`;
- publicar las apps;
- activar Cloudflare en producción;
- mover dinero real;
- tocar las conciliaciones;
- empezar las Fases 4 o 5;
- correr el reloj a mano.

## 1. Hito 1 del cliente: catálogo y sesión

### Catálogo estable (C-CATALOGO-ESTABLE)

**Qué fallaba:**

- El inicio y la pantalla de Comida pedían cada uno su lista: primero sin ubicación y después con ella.
- Si la respuesta sin ubicación llegaba tarde, borraba la buena. Por eso los restaurantes «desaparecían».
- La lista se volvía a pedir al cambiar la sesión o el idioma.

**Qué se hizo:**

- Una sola lista compartida por el inicio y Comida.
- Solo vale la última consulta, y una sin ubicación nunca pisa a una con ubicación.
- Dos consultas iguales que salen a la vez se juntan en una. La lista se recuerda durante 60 segundos.
- La ubicación se conserva: primero la del enlace, después la guardada (el mapa del carrito la guarda) y al final el GPS del teléfono.
- Estados claros en español e inglés:
  - todavía no hay restaurantes en tu zona;
  - todavía no llegamos a tu zona;
  - no se pudo cargar, con «Intentar de nuevo»;
  - no se pudo actualizar, mostrando la última lista que cargó.

### Sesión con tiempo máximo (C-SESION-CON-LIMITE)

**Qué fallaba:** si el servidor no respondía al abrir la app, la pantalla de carga escarlata se quedaba para siempre.

**Qué se hizo:**

- La comprobación de la sesión tiene un tope de 8 segundos.
- Si el servidor dice que la sesión no vale (401 o 403), se borra.
- Si se agota el tiempo, no hay red o el servidor falla:
  - la sesión no se da por buena, pero tampoco se borra;
  - sale «No pudimos confirmar tu sesión», con «Reintentar» y «Entrar con otra cuenta»;
  - no se abre nada protegido.
- Todos los textos en los dos idiomas.

**Guía pública en Docs**, en español e inglés, con captura: «¿Por qué no veo restaurantes? ¿Y si la app no termina de abrir?».

## 2. Versionado visible (C-VERSION-DEL-ARTEFACTO)

Cada pieza muestra la versión y el commit **con que se compiló**, no el último de GitHub.

| Pieza                                      | Dónde se ve                                                                         | De dónde sale el número                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Web (sitio público)                        | Pie de página: «Versión 0.1.0 · commit»                                             | Se graba al compilar la web                                                                                                                  |
| Panel administrativo                       | Menú de la cuenta: la de la web y, al lado, la del servidor. Si no coinciden, se ve | La web es la misma compilación que el panel; la del servidor se lee en vivo                                                                  |
| Servidor                                   | Dirección pública de versión y dentro de la salud                                   | Se graba al compilar el servidor                                                                                                             |
| Apps del cliente, repartidor y restaurante | Menú de tres puntos de la cuenta                                                    | Número de la app y commit pegados al compilar. En las tiendas lo pone un gancho de EAS (**sin probar todavía en una compilación de tienda**) |

- Sin compilación (la computadora del equipo) dice «local»: nunca inventa un commit.
- **Candado:** el revisor de paquetes no deja publicar si el servidor, la web o una de las tres apps no lleva el commit de esa publicación.
- No muestra ningún secreto: solo el número y siete letras del commit.

**Comprobado en el sitio de pruebas:**

- el servidor, la web en inglés y en español y las tres apps dicen el mismo commit, `fd8e36a`;
- la prueba en el navegador vio en la app el mismo número que da el servidor, en los dos idiomas.

## 3. Documento WebP

**DISENO-IMAGENES-WEBP**, en la carpeta docs. Solo diseño, sin código.

**Recomendación:**

- convertir y achicar en el dispositivo que sube la foto;
- tres tamaños para las fotos públicas: 400, 800 y 1600 px, en WebP al 80 %;
- uno solo para las privadas;
- el servidor solo revisa tipo, medidas y peso, y guarda. Nunca codifica.

**Descartados por ahora:**

- Cloudflare Images: YaDominios Cloud no lo ofrece;
- codificar en el servidor: no entra en el tiempo de procesamiento;
- tareas aparte: no hay colas.

Cuesta cero por imagen. Necesita aprobar la opción y una compilación nueva de las apps.

## 4. Pruebas ejecutadas

La prueba de punta a punta del Hito 1 se puede repetir sola contra el sitio de pruebas (archivo `e2e/hito1`).

| Prueba                                                                                       | Resultado                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verificación completa en la rama del Hito 1 (tipos, estilo, pruebas, compilación, auditoría) | ✅ 567 pruebas                                                                                                                                                                                                                                                                                                           |
| Verificación completa en la rama del versionado                                              | ✅ 563 pruebas                                                                                                                                                                                                                                                                                                           |
| Verificación completa de la integración temporal                                             | ✅ 577 pruebas, 0 vulnerabilidades                                                                                                                                                                                                                                                                                       |
| Pruebas nuevas comprobadas en rojo                                                           | ✅ catálogo (7), sesión (6), versión (4 compartidas y 3 del servidor), revisor del paquete (3), candado de la ubicación (actualizado)                                                                                                                                                                                    |
| Sitio de pruebas, corrida completa de la integración (corrida 38934294548)                   | ✅ todo en verde: retiros con Stripe de prueba, Fases 1, 2 y 3, reloj seguro, tiempo real, recorrido completo de Comida en inglés y en español, conciliación de prueba                                                                                                                                                   |
| Catálogo con la respuesta sin ubicación retrasada 5 s a propósito (inglés y español)         | ✅ la lista no se borra; ir a Comida y volver no repite la consulta; sin conexión se conserva y avisa                                                                                                                                                                                                                    |
| Sesión con el servidor colgado (inglés y español)                                            | ✅ en menos de 15 s sale «No pudimos confirmar tu sesión»; nada protegido abierto; la sesión sigue guardada; «Reintentar» entra sin contraseña                                                                                                                                                                           |
| 100 aperturas seguidas de la app                                                             | ✅ 100 de 100 al inicio, con el servidor respondiendo bien las 100 veces; aparte, 60 aperturas sin pausa: 60 de 60. **Una corrida**, hecha mientras el sitio de pruebas se volvía a publicar, terminó las 100 en «Reintentar»: la app no se colgó nunca, siempre dio salida. No se volvió a repetir en tres intentos más |
| Versión visible en la app (inglés y español)                                                 | ✅ igual a la del servidor                                                                                                                                                                                                                                                                                               |
| Capturas a 375 px                                                                            | ✅ guardadas en docs/capturas/hito1; la de la sesión, en Docs. La del catálogo trae nombres de prueba del sitio de pruebas y **no** se publicó                                                                                                                                                                           |
| Segunda corrida del sitio de pruebas, con las pruebas y la captura nuevas (38938776134)      | ✅ todo en verde otra vez                                                                                                                                                                                                                                                                                                |

## 5. Ramas y commits

| Rama                     | Para qué                                                                                           | Commits                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fase-reloj-seguro`      | El reloj seguro, validado. **No se tocó**                                                          | `7ba6ed1`, igual que antes                                                                                                                                                                                |
| `hito1-catalogo-sesion`  | Hito 1                                                                                             | `e8732aa` catálogo · `a74309f` sesión · `0f99db7` guía y candados · `6f5e075` candado de la ubicación · `d3740ea` prueba de punta a punta y captura · el último, cien aperturas con registro del servidor |
| `versionado-visible`     | Versionado                                                                                         | `f087b28` versionado · `0183d37` prueba en el sitio de pruebas                                                                                                                                            |
| `docs-webp`              | Documentos (WebP y este informe)                                                                   | `fbdcdda` y el de este informe                                                                                                                                                                            |
| `fase-integracion-hito1` | **Temporal**, solo para el sitio de pruebas: reloj seguro + Hito 1 + versionado. Nunca va a `main` | `fd8e36a`, `4fde0fc` y `827516d`                                                                                                                                                                          |

Las dos ramas de trabajo salen de `fase-reloj-seguro` y no se mezclan entre sí. Cada una puede publicarse después del reloj, por su cuenta.

## 6. El reloj seguro sigue aislado y publicable

- La rama `fase-reloj-seguro` no recibió ningún commit en este trabajo.
- Nada del Hito 1 ni del versionado está dentro de ella.
- **El sitio de pruebas hoy tiene la integración temporal**, no el reloj solo. Antes de publicar el reloj, como está acordado:
  1. se vuelve a poner el reloj solo en el sitio de pruebas, con la corrida manual de su rama (unos 30 minutos);
  2. se repiten todas sus pruebas;
  3. se corre el verificador de producción en modo «antes».
- La vigilancia de la conciliación del 16 sigue corriendo, solo leyendo. Hasta ahora no apareció (llega entre las 8:00 y las 9:30 p. m. de Miami).

## Después, en este orden, cada paso con su autorización

1. Conciliación del 16 en verde.
2. Sitio de pruebas con el reloj solo y sus pruebas en verde.
3. Su autorización para publicar el reloj seguro.
4. Reloj de Cloudflare en producción, con su autorización aparte.
5. Hito 1 y versionado, con su autorización.
6. Validar el MVP de Comida.

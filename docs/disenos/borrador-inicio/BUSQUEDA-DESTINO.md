# «¿A dónde vas?»: cómo se llena la lista (regla de Richard, 17 nov 2026)

Vale para el borrador y para lo que se construya después en Moto, Carro y Envíos. Todas las ciudades y
todos los países por igual (Detroit, Cúcuta, Caracas, El Vigía): nada fijo de una sola ciudad.

## 1. Casilla vacía: tres bloques, en este orden

1. **Atajos**: Casa y Trabajo (y «Agregar»), arriba.
2. **Recientes**: el historial de esa persona. Se ordena con código, sin IA, por lo que suele pedir
   **a esa hora y ese día de la semana**. Ejemplo: un lunes a las 7 de la mañana, Trabajo sale primero.
   Regla de orden: puntaje = viajes a ese destino en la misma franja horaria (±1 hora) y el mismo día
   de la semana, luego los del mismo tipo de día (entre semana o fin de semana), y por último lo más
   reciente. Se muestran como mucho cinco.
3. **Populares cerca de ti**: según la ciudad donde está la persona en ese momento.
   - Con datos: los destinos más pedidos en esa ciudad, con nuestros propios datos agregados.
     **Solo lugares pedidos por varias personas distintas** (mínimo **diez** clientes distintos en los
     últimos 90 días; subido de cinco el 18 nov por la revisión de calidad: con cinco en un mismo
     edificio, la calle exacta ya era la dirección de personas). Nunca la dirección de una persona: se guarda el lugar redondeado (el nombre del
     sitio del buscador de mapas o la coordenada redondeada a unos 100 metros) y la calle **sin el número
     de ninguna casa**, nunca la casa de nadie.
   - Ciudad nueva sin datos (por ejemplo, Tucaní): lugares conocidos cercanos del buscador de mapas, por
     tipo: terminal de pasajeros, hospital, plaza, centro comercial, universidad.
   - La lista de populares se calcula una vez al día por ciudad y se guarda; no se calcula por cada
     visita (regla de la nube: mirar no escribe). Si no hay nada (ni datos ni buscador de mapas), ese
     «nada» también se guarda una hora.

## 2. Casilla con texto: «Resultados»

- El título es **«Resultados»** (en inglés, «Results»). Ya no hay «Sugerencias» fijas.
- Son lugares del buscador de mapas **cercanos a la persona**, ordenados por distancia, lo más cercano
  primero, con la distancia a la derecha (km en español, millas en inglés de EE. UU.).
- Casa y Trabajo salen arriba **solo si coinciden** con lo escrito (por nombre o por dirección).
- Sin resultados: una línea en palabras y la opción «Fijar destino en el mapa», que siempre está debajo
  de la casilla.

## 3. Costo del buscador de mapas

El buscador de mapas se cobra por búsqueda. Por eso, en código:

- **Sesiones de búsqueda**: un mismo token de sesión desde la primera letra hasta que la persona elige
  un lugar, para que se cobre como una sola sesión.
- **Espera de unos 300 ms entre teclas** antes de pedir resultados, y nada antes de la segunda letra.
- **Tope diario** por proyecto y por cuenta; al pasarlo, quedan los recientes, los populares y «Fijar en
  el mapa», y el canario de salud lo avisa. Se reutiliza la pieza que ya existe para las direcciones
  (`useSugerenciasDireccion` en `packages/compartido/src/lugares.ts`, que pasa siempre por el servidor
  en `/datos/lugares/*` con los topes de Google Cloud).
- Los populares por ciudad se guardan, así que no gastan búsquedas.

## En el borrador

La pantalla 4 (casilla vacía) y la 5 (casilla escribiendo) del borrador muestran esto con datos de ejemplo
neutros, y cada bloque lleva debajo de su título una nota de dónde sale. La casilla es de verdad: se puede
escribir («trab» deja solo Trabajo; «Termi» trae las terminales, la más cercana primero).

Capturas: `4-destino-es.png`, `4-destino-en.png`, `4b-destino-escribiendo-es.png` y
`4b-destino-escribiendo-en.png`.

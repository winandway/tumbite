# Tabulador de El Vigía (moto taxi) y la tarifa aprendida

> C-TABULADOR-VIGIA · Venezuela · zona `VE-MER-ELVIGIA` · generado por
> `scripts/tabulador/aprender-tarifa-vigia.mjs` (no se edita a mano: se corre otra vez).

Encargo de Richard del 25 nov 2026: Divoox cobra como la calle de El Vigía, no más. La hoja que se
transcribe aquí es el «Tabulador de Carreras Urbanas y Extra Urbanas de Moto Taxis». Los precios son en
dólares, desde El Vigía. De noche (9 pm a 6 am, hora de Venezuela) llevan un recargo del 30 %.

## 1. El tabulador, tal cual, por vía

### Vía Mérida

- La Vega I: 2 $
- La Vega II: 3 $
- Peaje Vía Mérida: 3 $
- Palmita: 7 $
- Mesa Bolívar: 15 $
- Alcabala La Victoria: 20 $
- Santa Cruz: 20 $
- Tovar: 25 $
- Bailadores: 40 $
- El Anís: 12 $
- La Lagunillas: 20 $
- Ejido: 25 $
- Mérida: 30 $
- Tabay: 35 $
- Apartadero: 60 $
- La Providencia: 15 $
- Mesa de las Palmas: 25 $

### Vía El Zulia

- Pedeca: 2 $
- Caño Frío: 3 $
- Los Pozones: 3 $
- Parque Chama: 3 $
- Parque Chama II: 4 $
- Alcabala Vera Agua: 5 $
- Cañito: 5 $
- Caracolí: 10 $
- KM 35: 15 $
- El Ubito: 17 $
- Moralito: 15 $
- Santa Bárbara: 25 $
- Encontrado: 45 $
- Santa Cruz Zulia: 40 $
- Casigua El Cubo: 90 $
- El Taparo: 3 $
- El Guayabo: 60 $

### Vía Táchira

- Puente de Onia: 2 $
- Carlos Andrés: 5 $
- Culebria: 10 $
- Los Giros: 15 $
- KM 9: 3 $
- KM 12: 4 $
- KM 15: 6 $
- Peaje Zea: 10 $
- Caño Tigre: 15 $
- Zea: 20 $
- La Tendida: 15 $
- Coloncito: 20 $
- El Puerto: 35 $
- La Fría: 30 $
- Aguas Clara: 45 $
- San Juan de Colón: 45 $
- San Cristóbal: 70 $

### Vía Panamericana

- Redoma de la Blanca: 2 $
- Prado Hermoso: 3 $
- Aroa II: 3 $
- Aroa I: 5 $
- Los Naranjos: 12 $
- 4 Esquinas: 15 $
- El Chivo: 25 $
- Blanca Universidad: 3 $
- Los Robles: 4 $
- Villa los Ángeles: 5 $
- Alta Vista: 3 $
- Las Delicias: 3 $
- Mucujepe: 5 $
- Guayabones: 15 $
- Santa Elena: 20 $
- Tucaní: 30 $
- Caja Seca: 45 $

### Carreras cortas

- Centro: 1 $
- Av. 15: 1 $
- Paraíso: 1 $
- Campo Alegre: 2 $
- La Páez: 1 $
- La Pedregosa (Redoma): 1 $
- La Pedregosa ULA: 2 $
- Buenos Aires (Asodega): 1 $
- Colinas de Buenos Aires: 2 $
- La Playita: 1 $
- 23 de Enero: 1 $
- El Bosque: 1 $
- Cementerio Onia: 1 $
- Las Primicias: 1 $
- La Motoza: 2 $

## 2. Distancia real por carretera y dólares por kilómetro

Distancia medida con Google Routes desde el centro de El Vigía (Plaza Bolívar, 8,6219 / -71,6506)
hasta el punto de cada destino. «Revisar» = el punto es aproximado (Google no lo ubicó con confianza):
su km también lo es. En el panel se corrige el punto y queda desmarcado.

«Cobra la app» = lo que paga el pasajero de día desde el centro: el menor entre la hoja y el calculado
con la tarifa de la sección 4 (en El Vigía el fijo gana siempre que no sea más caro). «Contra la calle»
= cuánto menos que la hoja (0 = igual que la calle). De noche, las dos columnas llevan un 30 % más.

| Vía              | Destino                 |    km | Hoja | $ por km | Cobra la app |  Contra la calle | Punto   |
| ---------------- | ----------------------- | ----: | ---: | -------: | -----------: | ---------------: | ------- |
| Vía Mérida       | La Vega I               |   6,0 |  2 $ |     0,33 |       2,00 $ |                0 | ok      |
| Vía Mérida       | La Vega II              |   5,1 |  3 $ |     0,59 |       2,35 $ |  -0,65 $ (-22 %) | revisar |
| Vía Mérida       | Peaje Vía Mérida        |   5,4 |  3 $ |     0,56 |       2,48 $ |  -0,52 $ (-17 %) | ok      |
| Vía Mérida       | Palmita                 |  13,3 |  7 $ |     0,53 |       6,12 $ |  -0,88 $ (-13 %) | ok      |
| Vía Mérida       | Mesa Bolívar            |  23,0 | 15 $ |     0,65 |      10,58 $ |  -4,42 $ (-29 %) | ok      |
| Vía Mérida       | Alcabala La Victoria    |  26,3 | 20 $ |     0,76 |      12,10 $ |  -7,90 $ (-39 %) | revisar |
| Vía Mérida       | Santa Cruz              |  45,1 | 20 $ |     0,44 |      20,00 $ |                0 | ok      |
| Vía Mérida       | Tovar                   |  56,1 | 25 $ |     0,45 |      25,00 $ |                0 | ok      |
| Vía Mérida       | Bailadores              |  70,6 | 40 $ |     0,57 |      32,48 $ |  -7,52 $ (-19 %) | ok      |
| Vía Mérida       | El Anís                 |  29,1 | 12 $ |     0,41 |      12,00 $ |                0 | ok      |
| Vía Mérida       | La Lagunillas           |  45,1 | 20 $ |     0,44 |      20,00 $ |                0 | ok      |
| Vía Mérida       | Ejido                   |  61,8 | 25 $ |     0,40 |      25,00 $ |                0 | ok      |
| Vía Mérida       | Mérida                  |  71,2 | 30 $ |     0,42 |      30,00 $ |                0 | ok      |
| Vía Mérida       | Tabay                   |  91,1 | 35 $ |     0,38 |      35,00 $ |                0 | ok      |
| Vía Mérida       | Apartadero              | 133,4 | 60 $ |     0,45 |      60,00 $ |                0 | ok      |
| Vía Mérida       | La Providencia          |  22,0 | 15 $ |     0,68 |      10,12 $ |  -4,88 $ (-33 %) | ok      |
| Vía Mérida       | Mesa de las Palmas      |  35,9 | 25 $ |     0,70 |      16,51 $ |  -8,49 $ (-34 %) | ok      |
| Vía El Zulia     | Pedeca                  |   2,6 |  2 $ |     0,77 |       1,20 $ |  -0,80 $ (-40 %) | revisar |
| Vía El Zulia     | Caño Frío               |   3,6 |  3 $ |     0,83 |       1,66 $ |  -1,34 $ (-45 %) | revisar |
| Vía El Zulia     | Los Pozones             |   6,3 |  3 $ |     0,48 |       2,90 $ |   -0,10 $ (-3 %) | ok      |
| Vía El Zulia     | Parque Chama            |   5,6 |  3 $ |     0,54 |       2,58 $ |  -0,42 $ (-14 %) | ok      |
| Vía El Zulia     | Parque Chama II         |   6,3 |  4 $ |     0,63 |       2,90 $ |  -1,10 $ (-28 %) | ok      |
| Vía El Zulia     | Alcabala Vera Agua      |  11,6 |  5 $ |     0,43 |       5,00 $ |                0 | ok      |
| Vía El Zulia     | Cañito                  |   8,6 |  5 $ |     0,58 |       3,96 $ |  -1,04 $ (-21 %) | revisar |
| Vía El Zulia     | Caracolí                |  19,6 | 10 $ |     0,51 |       9,02 $ |  -0,98 $ (-10 %) | ok      |
| Vía El Zulia     | KM 35                   |  38,2 | 15 $ |     0,39 |      15,00 $ |                0 | revisar |
| Vía El Zulia     | El Ubito                |  37,1 | 17 $ |     0,46 |      17,00 $ |                0 | ok      |
| Vía El Zulia     | Moralito                |  29,6 | 15 $ |     0,51 |      13,62 $ |   -1,38 $ (-9 %) | ok      |
| Vía El Zulia     | Santa Bárbara           |  53,6 | 25 $ |     0,47 |      24,66 $ |   -0,34 $ (-1 %) | ok      |
| Vía El Zulia     | Encontrado              |  97,0 | 45 $ |     0,46 |      44,62 $ |   -0,38 $ (-1 %) | ok      |
| Vía El Zulia     | Santa Cruz Zulia        |  75,5 | 40 $ |     0,53 |      34,73 $ |  -5,27 $ (-13 %) | ok      |
| Vía El Zulia     | Casigua El Cubo         | 144,5 | 90 $ |     0,62 |      66,47 $ | -23,53 $ (-26 %) | ok      |
| Vía El Zulia     | El Taparo               |   3,0 |  3 $ |     1,00 |       1,38 $ |  -1,62 $ (-54 %) | ok      |
| Vía El Zulia     | El Guayabo              | 125,6 | 60 $ |     0,48 |      57,78 $ |   -2,22 $ (-4 %) | ok      |
| Vía Táchira      | Puente de Onia          |   6,6 |  2 $ |     0,30 |       2,00 $ |                0 | ok      |
| Vía Táchira      | Carlos Andrés           |  10,1 |  5 $ |     0,50 |       4,65 $ |   -0,35 $ (-7 %) | revisar |
| Vía Táchira      | Culebria                |  21,6 | 10 $ |     0,46 |       9,94 $ |   -0,06 $ (-1 %) | revisar |
| Vía Táchira      | Los Giros               |  49,4 | 15 $ |     0,30 |      15,00 $ |                0 | ok      |
| Vía Táchira      | KM 9                    |   9,8 |  3 $ |     0,31 |       3,00 $ |                0 | ok      |
| Vía Táchira      | KM 12                   |  13,0 |  4 $ |     0,31 |       4,00 $ |                0 | revisar |
| Vía Táchira      | KM 15                   |  20,1 |  6 $ |     0,30 |       6,00 $ |                0 | revisar |
| Vía Táchira      | Peaje Zea               |  22,2 | 10 $ |     0,45 |      10,00 $ |                0 | ok      |
| Vía Táchira      | Caño Tigre              |  30,5 | 15 $ |     0,49 |      14,03 $ |   -0,97 $ (-6 %) | ok      |
| Vía Táchira      | Zea                     |  42,4 | 20 $ |     0,47 |      19,50 $ |   -0,50 $ (-2 %) | ok      |
| Vía Táchira      | La Tendida              |  31,2 | 15 $ |     0,48 |      14,35 $ |   -0,65 $ (-4 %) | ok      |
| Vía Táchira      | Coloncito               |  68,5 | 20 $ |     0,29 |      20,00 $ |                0 | ok      |
| Vía Táchira      | El Puerto               | 103,5 | 35 $ |     0,34 |      35,00 $ |                0 | revisar |
| Vía Táchira      | La Fría                 |  90,6 | 30 $ |     0,33 |      30,00 $ |                0 | ok      |
| Vía Táchira      | Aguas Clara             | 124,1 | 45 $ |     0,36 |      45,00 $ |                0 | revisar |
| Vía Táchira      | San Juan de Colón       | 118,4 | 45 $ |     0,38 |      45,00 $ |                0 | ok      |
| Vía Táchira      | San Cristóbal           | 166,0 | 70 $ |     0,42 |      70,00 $ |                0 | ok      |
| Vía Panamericana | Redoma de la Blanca     |   4,7 |  2 $ |     0,43 |       2,00 $ |                0 | ok      |
| Vía Panamericana | Prado Hermoso           |   6,6 |  3 $ |     0,45 |       3,00 $ |                0 | ok      |
| Vía Panamericana | Aroa II                 |   7,1 |  3 $ |     0,42 |       3,00 $ |                0 | ok      |
| Vía Panamericana | Aroa I                  |   6,5 |  5 $ |     0,77 |       2,99 $ |  -2,01 $ (-40 %) | revisar |
| Vía Panamericana | Los Naranjos            |  19,3 | 12 $ |     0,62 |       8,88 $ |  -3,12 $ (-26 %) | ok      |
| Vía Panamericana | 4 Esquinas              |  32,4 | 15 $ |     0,46 |      14,90 $ |   -0,10 $ (-1 %) | ok      |
| Vía Panamericana | El Chivo                |     — | 25 $ |        — |      25,00 $ |                0 | revisar |
| Vía Panamericana | Blanca Universidad      |   6,5 |  3 $ |     0,46 |       2,99 $ |    -0,01 $ (0 %) | ok      |
| Vía Panamericana | Los Robles              |   7,9 |  4 $ |     0,51 |       3,63 $ |   -0,37 $ (-9 %) | revisar |
| Vía Panamericana | Villa los Ángeles       |   7,8 |  5 $ |     0,64 |       3,59 $ |  -1,41 $ (-28 %) | ok      |
| Vía Panamericana | Alta Vista              |   7,3 |  3 $ |     0,41 |       3,00 $ |                0 | ok      |
| Vía Panamericana | Las Delicias            |   6,8 |  3 $ |     0,44 |       3,00 $ |                0 | ok      |
| Vía Panamericana | Mucujepe                |  11,5 |  5 $ |     0,43 |       5,00 $ |                0 | ok      |
| Vía Panamericana | Guayabones              |  21,9 | 15 $ |     0,68 |      10,07 $ |  -4,93 $ (-33 %) | ok      |
| Vía Panamericana | Santa Elena             |  36,4 | 20 $ |     0,55 |      16,74 $ |  -3,26 $ (-16 %) | ok      |
| Vía Panamericana | Tucaní                  |  65,3 | 30 $ |     0,46 |      30,00 $ |                0 | ok      |
| Vía Panamericana | Caja Seca               |  99,3 | 45 $ |     0,45 |      45,00 $ |                0 | ok      |
| Carreras cortas  | Centro                  |   0,7 |  1 $ |     1,43 |       1,00 $ |                0 | ok      |
| Carreras cortas  | Av. 15                  |   1,0 |  1 $ |     1,00 |       1,00 $ |                0 | ok      |
| Carreras cortas  | Paraíso                 |   3,6 |  1 $ |     0,28 |       1,00 $ |                0 | ok      |
| Carreras cortas  | Campo Alegre            |   3,1 |  2 $ |     0,65 |       1,43 $ |  -0,57 $ (-28 %) | ok      |
| Carreras cortas  | La Páez                 |   2,9 |  1 $ |     0,34 |       1,00 $ |                0 | ok      |
| Carreras cortas  | La Pedregosa (Redoma)   |   4,7 |  1 $ |     0,21 |       1,00 $ |                0 | ok      |
| Carreras cortas  | La Pedregosa ULA        |   7,9 |  2 $ |     0,25 |       2,00 $ |                0 | ok      |
| Carreras cortas  | Buenos Aires (Asodega)  |   4,1 |  1 $ |     0,24 |       1,00 $ |                0 | ok      |
| Carreras cortas  | Colinas de Buenos Aires |   4,9 |  2 $ |     0,41 |       2,00 $ |                0 | revisar |
| Carreras cortas  | La Playita              |   1,9 |  1 $ |     0,53 |       1,00 $ |                0 | ok      |
| Carreras cortas  | 23 de Enero             |   3,0 |  1 $ |     0,33 |       1,00 $ |                0 | ok      |
| Carreras cortas  | El Bosque               |   2,4 |  1 $ |     0,42 |       1,00 $ |                0 | ok      |
| Carreras cortas  | Cementerio Onia         |   5,9 |  1 $ |     0,17 |       1,00 $ |                0 | revisar |
| Carreras cortas  | Las Primicias           |   5,1 |  1 $ |     0,20 |       1,00 $ |                0 | ok      |
| Carreras cortas  | La Motoza               |   2,1 |  2 $ |     0,95 |       1,00 $ |  -1,00 $ (-50 %) | ok      |

## 3. Promedio y mediana por vía ($ por km)

| Vía                                   | Destinos medidos | Promedio | Mediana |
| ------------------------------------- | ---------------: | -------: | ------: |
| Vía Mérida                            |               17 |     0,52 |    0,45 |
| Vía El Zulia                          |               17 |     0,57 |    0,51 |
| Vía Táchira                           |               17 |     0,38 |    0,36 |
| Vía Panamericana                      |               16 |     0,51 |    0,46 |
| Carreras cortas                       |               15 |     0,49 |    0,34 |
| Todas, sin carreras cortas            |               67 |     0,49 |    0,46 |
| Con punto seguro, sin carreras cortas |               53 |     0,48 |    0,46 |

### Precio de la app contra la hoja, por vía (de día, desde el centro)

| Vía              | Destinos | Igual a la hoja | Por debajo | Suma de la hoja | Suma de la app |    La app cobra |
| ---------------- | -------: | --------------: | ---------: | --------------: | -------------: | --------------: |
| Vía Mérida       |       17 |               9 |          8 |        357,00 $ |       321,74 $ | 90 % de la hoja |
| Vía El Zulia     |       17 |               3 |         14 |        345,00 $ |       304,48 $ | 88 % de la hoja |
| Vía Táchira      |       17 |              12 |          5 |        350,00 $ |       347,47 $ | 99 % de la hoja |
| Vía Panamericana |       17 |               9 |          8 |        198,00 $ |       182,79 $ | 92 % de la hoja |
| Carreras cortas  |       15 |              13 |          2 |         19,00 $ |        17,43 $ | 92 % de la hoja |

## 4. La tarifa de moto de El Vigía (para los destinos que no están en la lista)

- **Mínimo: 1,00 $** (la carrera corta de la hoja).
- **Base: 0,00 $** y **0,46 $ por km** por carretera.
- **Por minuto: 0** (el precio no depende del tráfico: como en la calle, se sabe antes de salir).
- Recargo nocturno: +30 % de 9 pm a 6 am (C-RECARGO-NOCHE).

Cómo se eligió: el por km es la MEDIANA de los dólares por km de los 53 destinos con punto
seguro (sin las carreras cortas ni los puntos «revisar»): 0,4594 $, redondeada al
centavo. Base 0 y por minuto 0 (como en la calle, el precio se sabe antes de salir) y mínimo 1 $ (la
carrera corta de la hoja). En El Vigía el pasajero paga el MENOR entre la hoja y el calculado: con la
mediana, en la mitad de los destinos el calculado pasa la hoja y gana el fijo (el pasajero paga
exactamente el tabulador), y en la otra mitad el calculado queda cerca, apenas por debajo. Así el
tabulador se usa de verdad y el conductor cobra como en la calle.

Por qué no otras rectas: la de mínimos cuadrados (base 0,81 $ y 0,44 $ por km) cobra
1 $ de base aun en lo corto. La más alta que no pasa NINGÚN destino (0,29 $ por km) y la que dejaba
el 90 % por debajo de la calle (0,33 $, la primera versión) dejaban el calculado muy por debajo de la
hoja en la mayoría de los destinos: casi nunca se cobraba el tabulador y el conductor perdía.

Lo que no cubre una sola recta: la vía Táchira cobra menos por km (mediana 0,36) y ahí el fijo gana
casi siempre; dentro del casco la calle cobra 1 $ hasta unos 4 km, y un viaje urbano FUERA de la lista
sale por km (por ejemplo 3 km = 1,38 $): los barrios de la lista sí cobran su precio de la hoja.

Destinos con punto seguro donde el calculado pasa la hoja (ahí la app cobra la hoja): 27.
En las carreras cortas el calculado pasa la hoja en 10 de 15; ahí también
cobra la hoja.

### Calculado contra calle (destinos medidos)

| Destino              |    km | Calle | Calculado |
| -------------------- | ----: | ----: | --------: |
| La Vega I            |   6,0 |   2 $ |    2,76 $ |
| La Vega II           |   5,1 |   3 $ |    2,35 $ |
| Peaje Vía Mérida     |   5,4 |   3 $ |    2,48 $ |
| Palmita              |  13,3 |   7 $ |    6,12 $ |
| Mesa Bolívar         |  23,0 |  15 $ |   10,58 $ |
| Alcabala La Victoria |  26,3 |  20 $ |   12,10 $ |
| Santa Cruz           |  45,1 |  20 $ |   20,75 $ |
| Tovar                |  56,1 |  25 $ |   25,81 $ |
| Bailadores           |  70,6 |  40 $ |   32,48 $ |
| El Anís              |  29,1 |  12 $ |   13,39 $ |
| La Lagunillas        |  45,1 |  20 $ |   20,75 $ |
| Ejido                |  61,8 |  25 $ |   28,43 $ |
| Mérida               |  71,2 |  30 $ |   32,75 $ |
| Tabay                |  91,1 |  35 $ |   41,91 $ |
| Apartadero           | 133,4 |  60 $ |   61,36 $ |
| La Providencia       |  22,0 |  15 $ |   10,12 $ |
| Mesa de las Palmas   |  35,9 |  25 $ |   16,51 $ |
| Pedeca               |   2,6 |   2 $ |    1,20 $ |
| Caño Frío            |   3,6 |   3 $ |    1,66 $ |
| Los Pozones          |   6,3 |   3 $ |    2,90 $ |
| Parque Chama         |   5,6 |   3 $ |    2,58 $ |
| Parque Chama II      |   6,3 |   4 $ |    2,90 $ |
| Alcabala Vera Agua   |  11,6 |   5 $ |    5,34 $ |
| Cañito               |   8,6 |   5 $ |    3,96 $ |
| Caracolí             |  19,6 |  10 $ |    9,02 $ |
| KM 35                |  38,2 |  15 $ |   17,57 $ |
| El Ubito             |  37,1 |  17 $ |   17,07 $ |
| Moralito             |  29,6 |  15 $ |   13,62 $ |
| Santa Bárbara        |  53,6 |  25 $ |   24,66 $ |
| Encontrado           |  97,0 |  45 $ |   44,62 $ |
| Santa Cruz Zulia     |  75,5 |  40 $ |   34,73 $ |
| Casigua El Cubo      | 144,5 |  90 $ |   66,47 $ |
| El Taparo            |   3,0 |   3 $ |    1,38 $ |
| El Guayabo           | 125,6 |  60 $ |   57,78 $ |
| Puente de Onia       |   6,6 |   2 $ |    3,04 $ |
| Carlos Andrés        |  10,1 |   5 $ |    4,65 $ |
| Culebria             |  21,6 |  10 $ |    9,94 $ |
| Los Giros            |  49,4 |  15 $ |   22,72 $ |
| KM 9                 |   9,8 |   3 $ |    4,51 $ |
| KM 12                |  13,0 |   4 $ |    5,98 $ |
| KM 15                |  20,1 |   6 $ |    9,25 $ |
| Peaje Zea            |  22,2 |  10 $ |   10,21 $ |
| Caño Tigre           |  30,5 |  15 $ |   14,03 $ |
| Zea                  |  42,4 |  20 $ |   19,50 $ |
| La Tendida           |  31,2 |  15 $ |   14,35 $ |
| Coloncito            |  68,5 |  20 $ |   31,51 $ |
| El Puerto            | 103,5 |  35 $ |   47,61 $ |
| La Fría              |  90,6 |  30 $ |   41,68 $ |
| Aguas Clara          | 124,1 |  45 $ |   57,09 $ |
| San Juan de Colón    | 118,4 |  45 $ |   54,46 $ |
| San Cristóbal        | 166,0 |  70 $ |   76,36 $ |
| Redoma de la Blanca  |   4,7 |   2 $ |    2,16 $ |
| Prado Hermoso        |   6,6 |   3 $ |    3,04 $ |
| Aroa II              |   7,1 |   3 $ |    3,27 $ |
| Aroa I               |   6,5 |   5 $ |    2,99 $ |
| Los Naranjos         |  19,3 |  12 $ |    8,88 $ |
| 4 Esquinas           |  32,4 |  15 $ |   14,90 $ |
| Blanca Universidad   |   6,5 |   3 $ |    2,99 $ |
| Los Robles           |   7,9 |   4 $ |    3,63 $ |
| Villa los Ángeles    |   7,8 |   5 $ |    3,59 $ |
| Alta Vista           |   7,3 |   3 $ |    3,36 $ |
| Las Delicias         |   6,8 |   3 $ |    3,13 $ |
| Mucujepe             |  11,5 |   5 $ |    5,29 $ |
| Guayabones           |  21,9 |  15 $ |   10,07 $ |
| Santa Elena          |  36,4 |  20 $ |   16,74 $ |
| Tucaní               |  65,3 |  30 $ |   30,04 $ |
| Caja Seca            |  99,3 |  45 $ |   45,68 $ |

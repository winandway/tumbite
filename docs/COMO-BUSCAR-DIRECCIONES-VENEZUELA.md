# Cómo se buscan las direcciones en Venezuela

**Fecha:** 28 oct 2026 · **País:** Venezuela (sirve igual en todo el mundo) · Probado contra Google en vivo.

## En una frase

Se escribe **la calle o el lugar y la ciudad o el sector**, sin el número de casa al principio: «Calle 3, El Vigía», «Av. Francisco de Miranda, Chacao», «Los Palos Grandes, Caracas». Se elige la sugerencia y después se marca la puerta exacta con el pin y un punto de referencia.

## Lo que se probó (28 oct 2026)

| Lo que se escribió              | Lo que sugirió Google                                         |
| ------------------------------- | ------------------------------------------------------------- |
| calle 3 el vigia                | Calle 3, El Vigía, Mérida, Venezuela (y Avenida 3…)           |
| El Vigía, Mérida                | El Vigía, Mérida, Venezuela                                   |
| Los Palos Grandes Caracas       | Los Palos Grandes, Caracas, Miranda, Venezuela                |
| Av. Francisco de Miranda Chacao | Av. Francisco de Miranda, Chacao, Caracas, Miranda, Venezuela |

## Por qué en la portada salían direcciones de EE. UU.

La portada no sabe de qué país es quien escribe, y el servidor limitaba las sugerencias al país de la conexión. Desde EE. UU., «calle 3 el vigia» solo mostraba calles de EE. UU. Arreglado el 28 oct 2026: sin país en la pantalla, se busca en todo el mundo y el país de la conexión solo va primero. En Flex, la empresa venezolana busca solo en Venezuela.

## Lo que Google no da en Venezuela

- Muchas casas no tienen número en Google. Por eso, después de elegir la calle, **el pin en el mapa y el punto de referencia** («casa azul frente a la panadería») son los que llevan al conductor a la puerta.
- La etiqueta lleva además el **código plus** del punto exacto, que Google Maps entiende aunque no haya internet.
